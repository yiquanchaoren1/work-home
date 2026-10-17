import http from 'node:http';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateBackup, mergeData } from './public/store.js';
import { seedData } from './public/seed.js';
import { buildPersonalDocument } from './public/personal.js';
import { collectDailySummaries,applyDailySummaries,applyArchiveDocuments,isLegacyCodexNote } from './codex-archive.mjs';
import {archiveDocumentKinds} from './public/archive-documents.js';

const projectDir = path.dirname(fileURLToPath(import.meta.url));
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_STATE_BYTES = 64 * 1024 * 1024;
const MAX_RESTORE_BYTES = 256 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}
function schema(value) { try { return validateBackup(value); } catch (error) { throw new HttpError(400, error.message); } }
async function exists(filename) {
  try { await fs.access(filename); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function atomicWrite(filename, content) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await fs.open(temporary, 'wx', 0o600);
    await handle.writeFile(content); await handle.sync(); await handle.close(); handle = null;
    await fs.rename(temporary, filename);
  } finally {
    if (handle) await handle.close().catch(() => {});
    await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
function attachmentMeta(value) {
  if (!value || typeof value !== 'object' || !UUID.test(value.id || '')) throw new HttpError(400, '附件 ID 必须是合法 UUID');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(value.name) || ['.', '..'].includes(value.name)) throw new HttpError(400, '附件名称无效，不能包含路径或控制字符');
  if (typeof value.type !== 'string' || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(value.type)) throw new HttpError(400, '附件类型无效');
  if (!Number.isSafeInteger(value.size) || value.size < 0 || value.size > MAX_FILE_BYTES) throw new HttpError(413, '每个附件最多 50 MiB');
  return { id: value.id.toLowerCase(), name: value.name, type: value.type.toLowerCase(), size: value.size };
}
function detectedType(bytes, filename) {
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return ({ '.txt': 'text/plain', '.md': 'text/markdown', '.markdown': 'text/markdown', '.csv': 'text/csv', '.json': 'application/json', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}
function sameMeta(a, b) { return ['id', 'name', 'type', 'size'].every(key => a[key] === b[key]); }
function migrationMerge(current, incoming) {
  const imported = clone(incoming), taskMap = new Map();
  const semantic = item => JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key]) => !['createdAt', 'updatedAt'].includes(key))));
  for (const key of ['tasks', 'links', 'notes', 'records']) for (const item of imported[key]) {
    const oldId = item.id, existing = current[key].find(value => value.id === oldId);
    if (existing && semantic(existing) !== semantic(item)) {
      item.id = `migration:${key}:${hash(semantic(item)).slice(0, 32)}`;
      if (key === 'tasks') taskMap.set(oldId, item.id);
      if (key === 'notes' || key === 'records') item.title += '（浏览器迁移副本）';
    }
  }
  for (const key of ['links', 'notes', 'records']) for (const item of imported[key]) if (taskMap.has(item.taskId)) item.taskId = taskMap.get(item.taskId);
  return mergeData(current, imported);
}

export class FileWorkspace {
  constructor(dataDir,{workspaceRoot=path.dirname(projectDir)}={}) {
    this.dataDir = path.resolve(dataDir || process.env.WORK_HUB_DATA_DIR || path.join(projectDir, 'data'));
    this.statePath = path.join(this.dataDir, 'workspace.json');
    this.previousPath = path.join(this.dataDir, 'workspace.previous.json');
    this.filesDir = path.join(this.dataDir, 'files');
    this.documentsDir = path.join(this.dataDir, 'documents');
    this.backupsDir = path.join(this.dataDir, 'backups');
    this.personalDir = path.join(this.dataDir, 'personal');
    this.masterPath = path.join(this.personalDir, '我的个人主档案.md');
    this.codexDir=path.join(this.dataDir,'daily-archives');
    this.archiveDir=path.join(this.dataDir,'archives');
    this.codexOptions={workspaceRoot};
    this.pending = Promise.resolve();
  }
  async init() { await Promise.all([this.dataDir, this.filesDir, this.documentsDir, this.backupsDir].map(directory => fs.mkdir(directory, { recursive: true }))); }
  async withLock(operation) {
    const lockPath = path.join(this.dataDir, '.workspace.lock');
    const deadline = Date.now() + 10000;
    let handle;
    while (!handle) {
      try { handle = await fs.open(lockPath, 'wx', 0o600); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        try {
          const lock = JSON.parse(await fs.readFile(lockPath, 'utf8'));
          if (Number.isInteger(lock.pid) && lock.pid > 0) {
            try { process.kill(lock.pid, 0); }
            catch (ownerError) { if (ownerError.code === 'ESRCH') { await fs.unlink(lockPath); continue; } }
          }
        } catch (readError) { if (readError.code === 'ENOENT') continue; }
        if (Date.now() >= deadline) throw new HttpError(503, '本地数据文件正被另一进程使用，请稍后重试');
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }
    try { await handle.writeFile(JSON.stringify({ pid: process.pid })); await handle.close(); handle = null; return await operation(); }
    finally { if (handle) await handle.close().catch(() => {}); await fs.unlink(lockPath).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  run(operation) { const promise = this.pending.then(() => this.withLock(operation)); this.pending = promise.catch(() => {}); return promise; }
  envelope(value) { return { data: value.data, revision: value.revision, dataDir: this.dataDir, features:['personal-archive-v1','task-links-v1','daily-archive-v2','archive-documents-v1','ui-refresh-v1'], masterPath:this.masterPath,codexDir:this.codexDir,archiveDir:this.archiveDir,codexWorkspace:this.codexOptions.workspaceRoot, ...(value.warning ? { warning: value.warning } : {}) }; }
  async syncCodex(value) {
    const collected=await collectDailySummaries({...this.codexOptions,since:value.since||''});
    return this.run(async()=>{
      const current=await this.load();this.checkRevision(value.revision,current);
      const next=clone(current.data),stats=applyDailySummaries(next,collected.documents);
      const archiveStats=applyArchiveDocuments(next,collected.archiveDocuments);
      if(Buffer.byteLength(JSON.stringify(next))>MAX_STATE_BYTES)throw new HttpError(413,'归档内容超过64 MiB，请选择较近的起始日期后同步。原数据未覆盖。');
      let result;
      if(stats.added||stats.updated||archiveStats.added||archiveStats.updated)result=await this.commit(next,current,'before-daily-sync');
      else {await this.writeDocuments(current.data);result=this.envelope(await this.syncMaster(current));}
      return {...result,codexSync:{...stats,...collected.stats,archiveDocuments:archiveStats,documents:collected.documents.length,warnings:collected.warnings}};
    });
  }
  async clearLegacyCodexImports(revision) { return this.run(async()=>{
    const current=await this.load();this.checkRevision(revision,current);
    const removed=current.data.notes.filter(isLegacyCodexNote);
    if(!removed.length)return {...this.envelope(current),removed:0};
    const next=clone(current.data);next.notes=next.notes.filter(note=>!isLegacyCodexNote(note));
    const result=await this.commit(next,current,'before-remove-codex-imports');
    // Automatic recovery should also use the cleaned state. The explicit
    // pre-cleanup backup retains a recoverable copy of the removed imports.
    await atomicWrite(this.previousPath,JSON.stringify({data:result.data,revision:result.revision},null,2));
    for(const note of removed)if(!note.attachment)await fs.unlink(path.join(this.documentsDir,hash(note.id)+(note.format==='markdown'?'.md':'.txt'))).catch(error=>{if(error.code!=='ENOENT')throw error;});
    // Only delete the old generator's exact filenames; never traverse links or
    // touch unrelated user files or the original Codex conversation history.
    const legacyDir=path.join(this.dataDir,'codex');
    for(const dir of await fs.readdir(legacyDir,{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;})) {
      if(!dir.isDirectory()||!/^\d{4}-\d{2}-\d{2}$/.test(dir.name))continue;
      const folder=path.join(legacyDir,dir.name);
      for(const file of await fs.readdir(folder,{withFileTypes:true}))if(file.isFile()&&/^(会话|工作总结)-[0-9a-f]{12}\.md$/.test(file.name))await fs.unlink(path.join(folder,file.name));
      await fs.rmdir(folder).catch(error=>{if(!['ENOTEMPTY','EEXIST'].includes(error.code))throw error;});
    }
    await fs.rmdir(legacyDir).catch(error=>{if(!['ENOENT','ENOTEMPTY','EEXIST'].includes(error.code))throw error;});
    return {...result,removed:removed.length};
  }); }
  async syncMaster(value) {
    try {
      const markdown=buildPersonalDocument(value.data);
      await fs.mkdir(this.personalDir,{recursive:true});
      let old='';try{old=await fs.readFile(this.masterPath,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
      if(old!==markdown) {
        const signaturePath=path.join(this.personalDir,'.generated.sha256');
        let signature='';try{signature=await fs.readFile(signaturePath,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
        if(old&&hash(old)!==signature) {
          const saved=path.join(this.backupsDir,`external-personal-${hash(old)}.md`);
          await atomicWrite(saved,old);
          value.warning=[value.warning,`主档案曾在站外编辑，原文已保存在 ${saved}；可在个人档案中重新上传并核对。`].filter(Boolean).join('\n');
        }
        await atomicWrite(this.masterPath,markdown);
        await atomicWrite(signaturePath,hash(markdown));
      }
    } catch(error) { value.warning=[value.warning,'工作数据已保留，但主档案文档未更新：'+error.message].filter(Boolean).join('\n'); }
    return value;
  }
  async readEnvelope(filename) {
    const value = JSON.parse(await fs.readFile(filename, 'utf8'));
    if (!value || typeof value.revision !== 'string' || !UUID.test(value.revision)) throw new Error('工作台版本标识无效');
    const data = schema(value.data); await this.checkAttachments(data);
    return { data, revision: value.revision, ...(typeof value.warning === 'string' ? { warning: value.warning } : {}) };
  }
  async load() {
    const hasState = await exists(this.statePath);
    if (hasState) {
      try { return await this.readEnvelope(this.statePath); }
      catch (error) { if (!await exists(this.previousPath)) throw new HttpError(500, `本地 workspace.json 无法读取，原文件未被覆盖：${error.message}`); }
    }
    if (await exists(this.previousPath)) {
      let previous;
      try { previous = await this.readEnvelope(this.previousPath); }
      catch { throw new HttpError(500, 'workspace.json 与上一版备份均无法读取，未覆盖任何原始数据'); }
      const corruptPath = path.join(this.backupsDir, `recovery-corrupt-${randomUUID()}.json`);
      if (hasState) await atomicWrite(corruptPath, await fs.readFile(this.statePath));
      const restored = { data: previous.data, revision: randomUUID(), warning: `当前数据文件${hasState ? '损坏' : '缺失'}，已恢复上一版本。${hasState ? `原损坏文件已保存在：${corruptPath}` : `恢复来源：${this.previousPath}`}。请核对最近一次修改。` };
      await atomicWrite(this.statePath, JSON.stringify(restored, null, 2)); await this.writeDocuments(restored.data);
      return restored;
    }
    const initial = { data: schema(seedData), revision: randomUUID() };
    await this.writeDocuments(initial.data); await atomicWrite(this.statePath, JSON.stringify(initial, null, 2)); return initial;
  }
  async backup(value, reason) {
    await atomicWrite(path.join(this.backupsDir, `${reason}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.json`), JSON.stringify(await this.backupData(value.data), null, 2));
  }
  async writeDocuments(data) {
    for (const note of data.notes) if (!note.attachment) await atomicWrite(path.join(this.documentsDir, hash(note.id) + (note.format === 'markdown' ? '.md' : '.txt')), note.body);
    if(data.dailyArchives?.length)await fs.mkdir(this.codexDir,{recursive:true});
    for(const item of data.dailyArchives||[])await atomicWrite(path.join(this.codexDir,item.date+'.md'),item.body);
    const dates=new Set((data.dailyArchives||[]).map(item=>item.date+'.md'));
    for(const file of await fs.readdir(this.codexDir,{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;}))if(file.isFile()&&/^\d{4}-\d{2}-\d{2}\.md$/.test(file.name)&&!dates.has(file.name))await fs.unlink(path.join(this.codexDir,file.name));
    if(data.archiveDocuments?.length)await fs.mkdir(this.archiveDir,{recursive:true});
    for(const [id,spec] of Object.entries(archiveDocumentKinds)) {
      const item=data.archiveDocuments?.find(doc=>doc.id===id),target=path.join(this.archiveDir,spec.filename);
      if(item)await atomicWrite(target,item.body);
      else await fs.unlink(target).catch(error=>{if(error.code!=='ENOENT')throw error;});
    }
  }
  async checkAttachments(data) {
    for (const note of data.notes) if (note.attachment) {
      const expected = attachmentMeta(note.attachment); let actual;
      try { actual = await this.readFileMetadata(expected.id); } catch { throw new HttpError(400, `附件文件不存在或损坏：${expected.name}`); }
      if (!sameMeta(expected, actual)) throw new HttpError(400, `附件元数据与磁盘文件不一致：${expected.name}`);
    }
  }
  async commit(data, current, reason = '') {
    const next = { data: schema(data), revision: randomUUID() }; await this.checkAttachments(next.data);
    if (reason) await this.backup(current, reason);
    await this.writeDocuments(next.data);
    await atomicWrite(this.previousPath, JSON.stringify(current, null, 2));
    await atomicWrite(this.statePath, JSON.stringify(next, null, 2)); await this.syncMaster(next); return this.envelope(next);
  }
  checkRevision(revision, current) { if (revision !== current.revision) throw new HttpError(409, '本地文件已被其他窗口更新，请重新加载后再保存。', { revision: current.revision }); }
  async getState() { return this.run(async () => this.envelope(await this.syncMaster(await this.load()))); }
  async personalDocument() { return this.run(async()=>{const state=await this.syncMaster(await this.load());return {markdown:buildPersonalDocument(state.data),path:this.masterPath,revision:state.revision,...(state.warning?{warning:state.warning}:{})};}); }
  async putState(value) { return this.run(async () => {
    const current = await this.load(); this.checkRevision(value.revision, current);
    // Older open tabs know only the original collections. A normal save from
    // such a client must not erase an archive it could not deserialize.
    let proposed=value.data;
    if(current.data.settings.theme&&proposed?.settings&&typeof proposed.settings==='object'&&!Object.hasOwn(proposed.settings,'theme'))proposed={...proposed,settings:{...proposed.settings,theme:current.data.settings.theme}};
    if(current.data.personal && proposed && typeof proposed==='object' && !Array.isArray(proposed) && !Object.hasOwn(proposed,'personal'))proposed={...proposed,personal:current.data.personal};
    if(current.data.dailyArchives && proposed && typeof proposed==='object' && !Array.isArray(proposed) && !Object.hasOwn(proposed,'dailyArchives'))proposed={...proposed,dailyArchives:current.data.dailyArchives};
    if(current.data.archiveDocuments && proposed && typeof proposed==='object' && !Array.isArray(proposed) && !Object.hasOwn(proposed,'archiveDocuments'))proposed={...proposed,archiveDocuments:current.data.archiveDocuments};
    if(Array.isArray(proposed?.tasks)&&Array.isArray(proposed?.links)) {
      const currentTasks=new Map(current.data.tasks.map(task=>[task.id,task]));
      const linkIds=new Set(proposed.links.map(link=>link?.id));
      proposed={...proposed,tasks:proposed.tasks.map(task=>{
        const previous=currentTasks.get(task?.id);
        return task&&previous?.linkIds&&!Object.hasOwn(task,'linkIds')?{...task,linkIds:previous.linkIds.filter(id=>linkIds.has(id))}:task;
      })};
    }
    if(Array.isArray(proposed?.notes)) {
      const notes=new Map(current.data.notes.map(note=>[note.id,note]));
      proposed={...proposed,notes:proposed.notes.map(note=>note&&notes.get(note.id)?.codex&&!Object.hasOwn(note,'codex')?{...note,codex:notes.get(note.id).codex}:note)};
    }
    return this.commit(proposed, current);
  }); }
  async migrate(value) {
    return this.run(async () => {
      const incoming = schema(value.data), raw = JSON.stringify(value.data, null, 2);
      const rawPath = path.join(this.backupsDir, `migration-original-${hash(raw)}.json`);
      if (!await exists(rawPath)) await atomicWrite(rawPath, raw);
      const current = await this.load();
      const pristine = JSON.stringify(current.data) === JSON.stringify(schema(seedData));
      const merged = pristine ? incoming : migrationMerge(current.data, incoming);
      return JSON.stringify(merged) === JSON.stringify(current.data) ? this.envelope(current) : this.commit(merged, current, 'before-migration');
    });
  }
  async readFileMetadata(id) {
    if (!UUID.test(id || '')) throw new HttpError(400, '附件 ID 无效');
    const parsed = JSON.parse(await fs.readFile(path.join(this.filesDir, `${id.toLowerCase()}.json`), 'utf8'));
    const meta = attachmentMeta(parsed);
    if (meta.id !== id.toLowerCase()) throw new HttpError(500, '附件索引不一致');
    const stat = await fs.stat(path.join(this.filesDir, `${meta.id}.bin`));
    if (stat.size !== meta.size || !stat.isFile()) throw new HttpError(500, '附件内容大小不一致');
    return { ...meta, sha256: parsed.sha256 };
  }
  async storeFile(meta, bytes) {
    await atomicWrite(path.join(this.filesDir, `${meta.id}.bin`), bytes);
    await atomicWrite(path.join(this.filesDir, `${meta.id}.json`), JSON.stringify({ ...meta, sha256: hash(bytes) }, null, 2));
  }
  async upload(bytes, name) { return this.run(async () => { const meta = attachmentMeta({ id: randomUUID(), name, type: detectedType(bytes, name), size: bytes.length }); await this.storeFile(meta, bytes); return meta; }); }
  async backupData(data) {
      const files = [], seen = new Set();
      for (const note of data.notes) if (note.attachment && !seen.has(note.attachment.id)) {
        const meta = await this.readFileMetadata(note.attachment.id), bytes = await fs.readFile(path.join(this.filesDir, `${meta.id}.bin`));
        if (meta.sha256 && meta.sha256 !== hash(bytes)) throw new HttpError(500, `附件校验失败：${meta.name}`);
        files.push({ ...attachmentMeta(meta), base64: bytes.toString('base64') }); seen.add(meta.id);
      }
      return { ...data, files };
  }
  async exportBackup() {
    return this.run(async () => this.backupData((await this.load()).data));
  }
  async restore(value) {
    return this.run(async () => {
      const current = await this.load(); this.checkRevision(value.revision, current);
      if (!['merge', 'replace'].includes(value.mode)) throw new HttpError(400, '恢复模式必须是 merge 或 replace');
      const incoming = schema(value.data);
      if (value.files !== undefined && !Array.isArray(value.files)) throw new HttpError(400, '备份 files 必须是数组');
      const prepared = [], seen = new Set(), remap = new Map();
      for (const entry of value.files || []) {
        const original = attachmentMeta(entry);
        if (seen.has(original.id)) throw new HttpError(400, '备份含重复附件 ID'); seen.add(original.id);
        if (typeof entry.base64 !== 'string' || entry.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(entry.base64)) throw new HttpError(400, `附件 base64 无效：${original.name}`);
        const bytes = Buffer.from(entry.base64, 'base64');
        if (bytes.toString('base64') !== entry.base64) throw new HttpError(400, `附件 base64 编码不规范：${original.name}`);
        if (bytes.length !== original.size) throw new HttpError(400, `附件大小校验失败：${original.name}`);
        if (detectedType(bytes, original.name) !== original.type) throw new HttpError(400, `附件实际类型与备份不符：${original.name}`);
        let meta = original;
        if (await exists(path.join(this.filesDir, `${original.id}.json`)) || await exists(path.join(this.filesDir, `${original.id}.bin`))) {
          try {
            const existing = await this.readFileMetadata(original.id), oldBytes = await fs.readFile(path.join(this.filesDir, `${original.id}.bin`));
            if (sameMeta(existing, original) && hash(oldBytes) === hash(bytes)) continue;
          } catch {
            // Preserve damaged or incomplete originals as well as intact UUID collisions.
          }
          meta = { ...original, id: randomUUID() }; remap.set(original.id, meta);
        }
        prepared.push({ original, meta, bytes });
      }
      for (const note of incoming.notes) if (note.attachment) {
        const expected = attachmentMeta(note.attachment), supplied = prepared.find(item => item.original.id === expected.id);
        if (supplied && !sameMeta(supplied.original, expected)) throw new HttpError(400, `文档与附件元数据不一致：${expected.name}`);
        if (remap.has(expected.id)) note.attachment = remap.get(expected.id);
        else if (!supplied) {
          let existing;
          try { existing = await this.readFileMetadata(expected.id); } catch { throw new HttpError(400, `备份缺少附件内容：${expected.name}`); }
          if (!sameMeta(existing, expected)) throw new HttpError(400, `备份附件元数据不匹配：${expected.name}`);
        }
      }
      const next = value.mode === 'merge' ? mergeData(current.data, incoming) : incoming;
      for (const item of prepared) await this.storeFile(item.meta, item.bytes);
      return this.commit(next, current, 'before-restore');
    });
  }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    if (Number(req.headers['content-length']) > limit) { req.resume(); reject(new HttpError(413, `请求超过 ${Math.floor(limit / 1024 / 1024)} MiB 限制`)); return; }
    let size = 0, completed = false; const chunks = [];
    req.on('data', chunk => {
      if (completed) return; size += chunk.length;
      if (size > limit) { completed = true; chunks.length = 0; reject(new HttpError(413, `请求超过 ${Math.floor(limit / 1024 / 1024)} MiB 限制`)); return; }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!completed) { completed = true; resolve(Buffer.concat(chunks)); } });
    req.on('error', error => { if (!completed) { completed = true; reject(error); } });
    req.on('aborted', () => { if (!completed) { completed = true; reject(new HttpError(400, '请求传输中断')); } });
  });
}
async function readJson(req, limit = MAX_STATE_BYTES) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, '请使用 application/json');
  try { const value = JSON.parse((await readBody(req, limit)).toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, '请求不是有效的 JSON 对象'); }
}
function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); }
function disposition(name, inline) {
  const encoded = encodeURIComponent(name).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${inline ? 'inline' : 'attachment'}; filename="download"; filename*=UTF-8''${encoded}`;
}
async function serveAttachment(req, res, workspace, id, download) {
  let meta;
  try { meta = await workspace.readFileMetadata(id); } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(404, '附件不存在'); }
  const inline = !download && /^(?:application\/pdf|image\/(?:png|jpeg|gif|webp))$/.test(meta.type);
  const headers = { 'Content-Type': inline ? meta.type : 'application/octet-stream', 'Content-Disposition': disposition(meta.name, inline), 'Accept-Ranges': 'bytes', 'Content-Security-Policy': "default-src 'none'; sandbox", 'X-Frame-Options': 'SAMEORIGIN' };
  let start = 0, end = meta.size - 1, status = 200;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!match || (!match[1] && !match[2]) || !meta.size) { res.setHeader('Content-Range', `bytes */${meta.size}`); throw new HttpError(416, '请求的附件范围无效'); }
    if (!match[1]) start = Math.max(0, meta.size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= meta.size) { res.setHeader('Content-Range', `bytes */${meta.size}`); throw new HttpError(416, '请求的附件范围无效'); }
    status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${meta.size}`;
  }
  headers['Content-Length'] = meta.size ? end - start + 1 : 0; res.writeHead(status, headers);
  if (req.method === 'HEAD' || !meta.size) return res.end();
  createReadStream(path.join(workspace.filesDir, `${meta.id}.bin`), { start, end }).on('error', () => res.destroy()).pipe(res);
}

export async function createWorkHubServer({ dataDir, publicDir = path.join(projectDir, 'public'),workspaceRoot } = {}) {
  const workspace = new FileWorkspace(dataDir,{workspaceRoot}); await workspace.init(); const root = path.resolve(publicDir);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.otf': 'font/otf' };
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (req.url.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    try {
      const port = server.address()?.port, host = String(req.headers.host || '').toLowerCase();
      const allowed = [`localhost:${port}`, `127.0.0.1:${port}`, ...(port === 80 ? ['localhost', '127.0.0.1'] : [])];
      if (!allowed.includes(host) || req.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === 'host').length !== 1) throw new HttpError(403, '只允许从当前本地地址访问');
      if (!req.url.startsWith('/') || req.url.startsWith('//')) throw new HttpError(400, '请求路径无效');
      const url = new URL(req.url, `http://${host}`); let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { throw new HttpError(400, '路径编码无效'); }
      if (pathname.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store');
        if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== `http://${host}`) throw new HttpError(403, '写入操作的 Origin 必须匹配当前本地网站');
        if (pathname === '/api/state' && req.method === 'GET') return json(res, 200, await workspace.getState());
        if (pathname === '/api/personal-document' && req.method === 'GET') return json(res,200,await workspace.personalDocument());
        if (pathname === '/api/codex/sync' && req.method === 'POST') return json(res,200,await workspace.syncCodex(await readJson(req)));
        if (pathname === '/api/state' && req.method === 'PUT') return json(res, 200, await workspace.putState(await readJson(req)));
        if (pathname === '/api/migrate' && req.method === 'POST') return json(res, 200, await workspace.migrate(await readJson(req)));
        if (pathname === '/api/files' && req.method === 'POST') {
          let name; try { name = decodeURIComponent(req.headers['x-file-name'] || ''); } catch { throw new HttpError(400, '附件文件名编码无效'); }
          attachmentMeta({ id: randomUUID(), name, type: 'application/octet-stream', size: 0 });
          return json(res, 201, await workspace.upload(await readBody(req, MAX_FILE_BYTES), name));
        }
        if (pathname.startsWith('/api/files/') && ['GET', 'HEAD'].includes(req.method)) return await serveAttachment(req, res, workspace, pathname.slice('/api/files/'.length), url.searchParams.get('download') === '1');
        if (pathname === '/api/backup' && req.method === 'GET') { res.setHeader('Content-Disposition', disposition(`工作间完整备份-${new Date().toISOString().slice(0, 10)}.json`, false)); return json(res, 200, await workspace.exportBackup()); }
        if (pathname === '/api/restore' && req.method === 'POST') return json(res, 200, await workspace.restore(await readJson(req, MAX_RESTORE_BYTES)));
        throw new HttpError(404, 'API 不存在或请求方法不支持');
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new HttpError(405, '仅支持 GET / HEAD');
      const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!filename.startsWith(root + path.sep)) throw new HttpError(403, '禁止访问此路径');
      let stat;
      try { const real = await fs.realpath(filename); if (!real.startsWith(await fs.realpath(root) + path.sep)) throw new HttpError(403, '禁止访问此路径'); stat = await fs.stat(filename); }
      catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(404, '文件不存在'); }
      if (!stat.isFile()) throw new HttpError(404, '文件不存在');
      res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
      if (req.method === 'HEAD') return res.end();
      createReadStream(filename).on('error', () => res.destroy()).pipe(res);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      json(res, error instanceof HttpError ? error.status : 500, { error: error instanceof HttpError ? error.message : '本地文件操作失败，请检查磁盘空间和文件权限。', ...(error.extra || {}) });
    }
  });
  server.workspace = workspace; return server;
}

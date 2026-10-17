import { validateBackup, mergeData } from './store.js?v=themes-20261017';
import { buildPersonalDocument, dayKey } from './personal.js';
import { validArchiveDate, validateDailyArchives } from './daily-archives.js';
import { archiveDocumentKinds, validateArchiveDocuments } from './archive-documents.js';

const encoder = new TextEncoder(), decoder = new TextDecoder();
const failure = (message, status = 400) => Object.assign(new Error(message), { status });
export const encodeBytes = bytes => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 16384) text += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(text);
};
export const decodeBytes = text => Uint8Array.from(atob(text.replace(/\s/g, '')), c => c.charCodeAt(0));
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
const metaEqual = (a, b) => ['id', 'name', 'type', 'size'].every(k => a[k] === b[k]);
const features = ['personal-archive-v1', 'task-links-v1', 'daily-archive-v2', 'archive-documents-v1', 'ui-refresh-v1','appearance-v1', 'github-storage-v1'];
const fileType = (bytes, name) => {
  const head = decoder.decode(bytes.subarray(0, 12));
  if (head.startsWith('%PDF-')) return 'application/pdf';
  if ([137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (/^GIF8[79]a/.test(head)) return 'image/gif';
  if (head.startsWith('RIFF') && head.slice(8,12) === 'WEBP') return 'image/webp';
  return ({txt:'text/plain',md:'text/markdown',markdown:'text/markdown',csv:'text/csv',json:'application/json',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})[name.split('.').pop().toLowerCase()] || 'application/octet-stream';
};

/** GitHub is the durable store. This object holds credentials only in memory. */
export class GithubWorkspace {
  #token; #fetch; #ready = false; #pending = Promise.resolve(); #archiveCache = new Map();
  constructor({owner, repo, branch = '', token, fetchImpl = globalThis.fetch.bind(globalThis)}) {
    if (!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo) || typeof branch !== 'string' || /[\u0000-\u0020]/.test(branch)) throw failure('仓库地址格式无效');
    if (typeof token !== 'string' || !token.trim()) throw failure('请输入 GitHub 访问密钥');
    this.owner = owner; this.repo = repo; this.branch = branch;
    this.#token = token.trim(); this.#fetch = fetchImpl;
    this.base = `https://api.github.com/repos/${owner}/${repo}`;
  }
  async api(suffix, {method = 'GET', body, accept = 'application/vnd.github+json', optional = false} = {}) {
    let response;
    try {
      response = await this.#fetch(this.base + suffix, {method, redirect:'error', cache:'no-store', headers:{Accept:accept, Authorization:`Bearer ${this.#token}`, 'X-GitHub-Api-Version':'2022-11-28', ...(body ? {'Content-Type':'application/json'} : {})}, ...(body ? {body:JSON.stringify(body)} : {})});
    } catch { throw failure('无法连接 GitHub，未确认保存成功，请保留当前编辑后重试。', 503); }
    if (optional && response.status === 404) return null;
    if (!response.ok) {
      if ([409,422].includes(response.status)) throw failure('其他设备已更新资料，本次没有覆盖。请保留草稿并重新载入。', 409);
      if (response.status === 401) throw failure('GitHub 访问密钥已失效，请重新登录。', 401);
      if (response.status === 403 || response.status === 429) throw failure('GitHub 拒绝了操作：请检查密钥的 Contents 读写权限，或稍后重试。', response.status);
      throw failure(response.status === 404 ? '资料仓库或文件不存在，或密钥没有访问权限。' : `GitHub 操作失败（${response.status}）`, response.status);
    }
    return response;
  }
  async connect() {
    const meta = await (await this.api('')).json();
    if (meta.private !== true) throw failure('资料仓库必须是私有仓库，当前连接已拒绝。');
    if (meta.archived) throw failure('资料仓库已归档，不能保存。');
    this.branch ||= meta.default_branch || 'main';
    this.#ready = true; return this;
  }
  guard() { if (!this.#ready) throw failure('请先连接并验证私有仓库'); }
  queue(operation) { const pending = this.#pending.then(operation); this.#pending = pending.catch(() => {}); return pending; }
  path(name) { return '/contents/' + name.split('/').map(encodeURIComponent).join('/'); }
  async file(name, optional = false) {
    this.guard();
    const suffix = this.path(name) + '?ref=' + encodeURIComponent(this.branch);
    const response = await this.api(suffix, {optional}); if (!response) return null;
    const item = await response.json();
    if (Array.isArray(item)) return item;
    if (item.type !== 'file') throw failure('仓库文件类型无效');
    const bytes = item.encoding === 'base64' ? decodeBytes(item.content) : new Uint8Array(await (await this.api(suffix, {accept:'application/vnd.github.raw+json'})).arrayBuffer());
    return {bytes, sha:item.sha};
  }
  async put(name, bytes, sha) {
    this.guard();
    const response = await this.api(this.path(name), {method:'PUT', body:{message:'Update private workspace', branch:this.branch, content:encodeBytes(bytes), ...(sha ? {sha} : {})}});
    return response.json();
  }
  envelope(value) {
    const root = `GitHub 私有仓库：${this.owner}/${this.repo}`;
    return {...value, features, dataDir:root, masterPath:root + '/个人主档案（按当前资料生成）', codexDir:root + '/codex-worklogs', archiveDir:root + '/workspace.json 内的独立档案', codexWorkspace:root};
  }
  async state() {
    await this.connect();
    const file = await this.file('workspace.json');
    let value; try { value = JSON.parse(decoder.decode(file.bytes)); } catch { throw failure('私有仓库的数据文件损坏，未覆盖任何内容。'); }
    if (typeof value.revision !== 'string') throw failure('私有仓库的数据缺少版本号');
    return {...this.envelope({revision:value.revision, data:validateBackup(value.data)}), sha:file.sha};
  }
  async readWithArchives({now = new Date()} = {}) {
    const current=await this.state(),cutoff=dayKey(now),checkedAt=now.toISOString();
    try {
      const view=await this.archiveView(current,{before:cutoff});
      return {...current,data:view.data,archiveSync:{...view.stats,automatic:true,cutoff,checkedAt}};
    }catch(error){
      const cached=await this.archiveView(current,{before:cutoff,cachedOnly:true});
      return {...current,data:cached.data,archiveSync:{...cached.stats,automatic:true,cutoff,checkedAt,warnings:[error.message,...cached.stats.warnings]}};
    }
  }
  async save(data, revision) { return this.queue(() => this.saveNow(data, revision)); }
  async saveNow(data, revision) {
    const clean = validateBackup(data), current = await this.state();
    if (current.revision !== revision) throw failure('其他设备已更新资料，本次没有覆盖。请保留草稿并重新载入。', 409);
    for(const key of ['theme','design'])if(current.data.settings[key]&&!Object.hasOwn(clean.settings,key))clean.settings[key]=current.data.settings[key];
    for (const note of clean.notes) if (note.attachment) {
      const file = await this.file(`files/${note.attachment.id}.json`);
      if (!metaEqual(JSON.parse(decoder.decode(file.bytes)), note.attachment)) throw failure('附件信息不一致，未保存工作台。');
    }
    const value = {revision:crypto.randomUUID(), data:clean}, bytes = encoder.encode(JSON.stringify(value, null, 2));
    if (bytes.length > 64 * 1024 * 1024) throw failure('资料超过 64 MiB，请拆分正文后重试。');
    await this.put('workspace.json', bytes, current.sha);
    return this.envelope(value);
  }
  async storeFile(meta, bytes) {
    await this.put(`files/${meta.id}.bin`, bytes);
    await this.put(`files/${meta.id}.json`, encoder.encode(JSON.stringify({...meta, sha256:await digest(bytes)})));
  }
  async upload(file) {
    return this.queue(async () => {
      await this.connect();
      if (!file.name || file.name.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(file.name) || file.size > 50 * 1024 * 1024) throw failure('附件文件名无效或超过 50 MiB');
      const bytes = new Uint8Array(await file.arrayBuffer()), meta = {id:crypto.randomUUID(), name:file.name, type:fileType(bytes,file.name), size:bytes.length};
      await this.storeFile(meta, bytes); return meta;
    });
  }
  async attachment(meta) {
    const stored = await this.file(`files/${meta.id}.json`), info = JSON.parse(decoder.decode(stored.bytes));
    if (!metaEqual(info, meta)) throw failure('附件信息不一致');
    const file = await this.file(`files/${meta.id}.bin`);
    if (file.bytes.length !== meta.size || !info.sha256 || info.sha256 !== await digest(file.bytes)) throw failure('附件校验失败，请从备份恢复原件。');
    return file.bytes;
  }
  async backup() {
    const current = await this.readWithArchives(), files = [], seen = new Set();
    for (const note of current.data.notes) if (note.attachment && !seen.has(note.attachment.id)) { const meta = note.attachment; files.push({...meta, base64:encodeBytes(await this.attachment(meta))}); seen.add(meta.id); }
    return {...current.data, files};
  }
  async restore(backup, mode, revision) {
    return this.queue(async () => {
      if (!['merge','replace'].includes(mode)) throw failure('恢复方式无效');
      const incoming = validateBackup(backup), current = await this.state();
      if (current.revision !== revision) throw failure('其他设备已更新资料，请保留备份并重新载入。',409);
      const entries = new Map();
      for (const item of backup.files || []) {
        if (entries.has(item.id) || typeof item.base64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.base64)) throw failure('备份附件重复或编码无效');
        const bytes = decodeBytes(item.base64);
        if (bytes.length !== item.size || fileType(bytes,item.name) !== item.type) throw failure('备份附件大小或类型不符');
        entries.set(item.id, {item,bytes});
      }
      const prepared = new Map();
      for (const note of incoming.notes) if (note.attachment) {
        const meta = note.attachment, entry = entries.get(meta.id);
        if (entry && !metaEqual(entry.item,meta)) throw failure('备份文档与附件信息不符');
        if (!entry) { await this.attachment(meta); continue; }
        if (!prepared.has(meta.id)) {
          const old = await this.file(`files/${meta.id}.json`,true);
          let replacement = meta;
          if (old) {
            let same = false;
            try { same = metaEqual(JSON.parse(decoder.decode(old.bytes)),meta) && await digest(await this.attachment(meta)) === await digest(entry.bytes); } catch { /* Preserve old files under their original ID. */ }
            if (same) { prepared.set(meta.id,meta); continue; }
            replacement = {...meta,id:crypto.randomUUID()};
          }
          prepared.set(meta.id,replacement);
        }
      }
      // Only after validating the complete backup do we upload any new files.
      for (const [oldId,meta] of prepared) {
        const exists = await this.file(`files/${meta.id}.json`,true);
        if (!exists) await this.storeFile(meta,entries.get(oldId).bytes);
      }
      for (const note of incoming.notes) if (note.attachment && prepared.has(note.attachment.id)) note.attachment = prepared.get(note.attachment.id);
      return this.saveNow(mode === 'merge' ? mergeData(current.data,incoming) : incoming, revision);
    });
  }
  async personalDocument() { const state = await this.readWithArchives(); return {markdown:buildPersonalDocument(state.data), path:state.masterPath, revision:state.revision}; }
  async archiveView(current,{since='',before='',cachedOnly=false} = {}) {
    const entries=cachedOnly?[...this.#archiveCache.entries()].map(([name,value])=>({name,sha:value.sha,type:'file'})):await this.file('codex-worklogs',true) || [];
    if(!Array.isArray(entries))throw failure('摘要来源不是文件夹，请检查私有仓库的 codex-worklogs。');
    const data=structuredClone(current.data);
    const stats={added:0,updated:0,unchanged:0,documents:0,warnings:[],archiveDocuments:{added:0,updated:0,unchanged:0}};
    for(const entry of entries) {
      const date=entry.name.replace(/\.md$/,''),kind=Object.entries(archiveDocumentKinds).find(([,v])=>v.filename===entry.name);
      if(entry.type!=='file'||(!kind&&(!validArchiveDate(date)||(since&&date<since)||(before&&date>=before))))continue;
      const cached=this.#archiveCache.get(entry.name);
      const apply=body=>{
        const at=new Date().toISOString();
        const old=(kind?data.archiveDocuments:data.dailyArchives)?.find(x=>kind?x.id===kind[0]:x.date===date);
        const value={...(kind?{id:kind[0]}:{date}),title:kind?kind[1].title:`${date} 工作摘要`,body,createdAt:old?.createdAt||at,updatedAt:at};
        if(kind)validateArchiveDocuments([value]);else validateDailyArchives([value]);
        const target=kind?(data.archiveDocuments ||= []):(data.dailyArchives ||= []);
        const counter=kind?stats.archiveDocuments:stats;
        if(!old){target.push(value);counter.added++;}else if(old.body!==body){Object.assign(old,value);counter.updated++;}else counter.unchanged++;
        if(!kind)stats.documents++;
      };
      try {
        const body=cachedOnly||(entry.sha&&cached?.sha===entry.sha)?cached.body:decoder.decode((await this.file('codex-worklogs/'+entry.name)).bytes);
        apply(body);this.#archiveCache.set(entry.name,{sha:entry.sha,body});
      }catch(error){stats.warnings.push(`${entry.name}：${error.message}`);if(cached&&!cachedOnly)apply(cached.body);}
    }
    return {data,stats};
  }
  async sync(revision, since = '') {
    return this.queue(async () => {
      if (since && !validArchiveDate(since)) throw failure('同步起始日期无效');
      const current = await this.state(); if (current.revision !== revision) throw failure('其他设备已更新资料，请重新载入后同步。',409);
      const {data,stats}=await this.archiveView(current,{since});
      const changed = stats.added+stats.updated+stats.archiveDocuments.added+stats.archiveDocuments.updated;
      return {...(changed ? await this.saveNow(data,revision) : current), codexSync:stats};
    });
  }
}

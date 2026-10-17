import { seedData } from './seed.js';
import { validatePersonal } from './personal.js';
import { validateDailyArchives } from './daily-archives.js';
import { validateArchiveDocuments } from './archive-documents.js';

export const STORAGE_KEY = 'work-hub:data:v1';

const collections = ['tasks', 'links', 'notes', 'records', 'activity'];
const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeUrl(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('请输入完整的 http:// 或 https:// 链接');
  const value = input.trim();
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new Error('链接中不能包含控制字符');
  let url;
  try { url = new URL(value); } catch { throw new Error('链接格式无效，请使用完整的 http:// 或 https:// 地址'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('仅支持 http:// 和 https:// 链接');
  if (url.username || url.password) throw new Error('请移除链接中的用户名和密码后再导入');
  // Preserve query strings, fragments and non-root trailing slashes: they may identify different pages.
  return url.pathname === '/' ? url.href.replace(/\/(?=[?#]|$)/, '') : url.href;
}

function requireString(value, path, nonempty = false) {
  if (typeof value !== 'string' || (nonempty && !value.trim())) throw new Error(`${path} 必须是${nonempty ? '非空' : ''}文本`);
}

function requireDate(value, path) {
  requireString(value, path, true);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`${path} 不是有效的 ISO 日期`);
}

/** Return a clean copy, or throw before any storage operation occurs. */
export function validateBackup(value) {
  if (!isObject(value) || value.version !== 1) throw new Error('备份格式或版本不支持，需要 version: 1 的工作台数据');
  for (const key of collections) {
    if (!Array.isArray(value[key])) throw new Error(`备份缺少 ${key} 数组`);
  }
  if (!isObject(value.settings)) throw new Error('备份缺少 settings 设置');
  requireString(value.settings.name, 'settings.name', true);

  const ids = new Set();
  const result = { version: 1, tasks: [], links: [], notes: [], records: [], activity: [], settings: { name: value.settings.name } };
  if(value.settings.theme!==undefined) {
    if(!['light','dark'].includes(value.settings.theme))throw new Error('settings.theme 仅支持 light 或 dark');
    result.settings.theme=value.settings.theme;
  }
  if(value.settings.design!==undefined) {
    if(!['paper','experimental','gallery','porcelain'].includes(value.settings.design))throw new Error('settings.design 主题无效');
    result.settings.design=value.settings.design;
  }
  const textFields = {
    tasks: ['title', 'type', 'status', 'summary', 'nextStep'],
    links: ['title', 'url', 'category', 'description'],
    notes: ['title', 'category', 'body'],
    records: ['title', 'kind', 'result', 'environment', 'version', 'command', 'log', 'body'],
  };

  for (const key of collections) {
    value[key].forEach((item, index) => {
      const path = `${key}[${index + 1}]`;
      if (!isObject(item)) throw new Error(`${path} 必须是对象`);
      requireString(item.id, `${path}.id`, true);
      if (ids.has(item.id)) throw new Error(`备份中存在重复 ID：${item.id}`);
      ids.add(item.id);
      if (key === 'activity') {
        requireString(item.text, `${path}.text`, true);
        requireDate(item.at, `${path}.at`);
        result[key].push({ id: item.id, text: item.text, at: item.at });
        return;
      }

      const clean = { id: item.id };
      for (const field of textFields[key]) {
        requireString(item[field], `${path}.${field}`, field === 'title');
        clean[field] = item[field];
      }
      if (key === 'links') clean.url = normalizeUrl(item.url);
      if(key==='tasks'&&item.linkIds!==undefined) {
        if(!Array.isArray(item.linkIds)||item.linkIds.some(id=>typeof id!=='string'))throw new Error(`${path}.linkIds 必须为链接 ID 数组`);
        clean.linkIds=[...new Set(item.linkIds)];
      }
      if (key === 'notes') {
        if(item.codex!==undefined) {
          const meta=item.codex;
          if(!isObject(meta)||!['session','worklog','upload'].includes(meta.source))throw new Error(`${path}.codex 来源无效`);
          for(const field of ['sourceId','date','bodyHash','titleHash','sourceUpdatedAt','syncedAt'])requireString(meta[field],`${path}.codex.${field}`,true);
          if(!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)||!Number.isFinite(Date.parse(meta.date+'T00:00:00Z'))||new Date(meta.date+'T00:00:00Z').toISOString().slice(0,10)!==meta.date||!/^[0-9a-f]{64}$/.test(meta.bodyHash)||!/^[0-9a-f]{64}$/.test(meta.titleHash))throw new Error(`${path}.codex 日期或校验值无效`);
          requireDate(meta.sourceUpdatedAt,`${path}.codex.sourceUpdatedAt`);requireDate(meta.syncedAt,`${path}.codex.syncedAt`);
          clean.codex=Object.fromEntries(['source','sourceId','date','bodyHash','titleHash','sourceUpdatedAt','syncedAt'].map(field=>[field,meta[field]]));
        }
        if (item.attachment !== undefined) {
          const attachment = item.attachment;
          if (!isObject(attachment) || typeof attachment.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attachment.id)) throw new Error(`${path}.attachment.id 不是有效文件 ID`);
          requireString(attachment.name, `${path}.attachment.name`, true);
          requireString(attachment.type, `${path}.attachment.type`, true);
          if (attachment.name.length > 255 || /[\\/\u0000-\u001f]/.test(attachment.name)) throw new Error(`${path}.attachment.name 不是有效文件名`);
          if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(attachment.type)) throw new Error(`${path}.attachment.type 不是有效文件类型`);
          if (!Number.isSafeInteger(attachment.size) || attachment.size < 0 || attachment.size > 50 * 1024 * 1024) throw new Error(`${path}.attachment.size 超出文件大小限制`);
          clean.attachment = { id: attachment.id, name: attachment.name, type: attachment.type, size: attachment.size };
        }
        if (item.format !== undefined) {
          if (!['text', 'markdown'].includes(item.format)) throw new Error(`${path}.format 只支持 text 或 markdown`);
          clean.format = item.format;
        }
        if (item.sourceName !== undefined) {
          requireString(item.sourceName, `${path}.sourceName`);
          clean.sourceName = item.sourceName;
        }
      }
      if (key !== 'records') {
        if (!Array.isArray(item.tags) || item.tags.some((tag) => typeof tag !== 'string')) throw new Error(`${path}.tags 必须是文本数组`);
        if (typeof item.pinned !== 'boolean') throw new Error(`${path}.pinned 必须是布尔值`);
        clean.tags = [...item.tags];
        clean.pinned = item.pinned;
      }
      if (key !== 'tasks') {
        if (item.taskId !== null) requireString(item.taskId, `${path}.taskId`);
        clean.taskId = item.taskId ?? '';
      }
      requireDate(item.createdAt, `${path}.createdAt`);
      requireDate(item.updatedAt, `${path}.updatedAt`);
      clean.createdAt = item.createdAt;
      clean.updatedAt = item.updatedAt;
      result[key].push(clean);
    });
  }
  const taskIds = new Set(result.tasks.map((task) => task.id));
  const linkIds = new Set(result.links.map(link=>link.id));
  for(const task of result.tasks)if(task.linkIds?.some(id=>!linkIds.has(id)))throw new Error(`事项「${task.title}」关联了不存在的链接`);
  for (const key of ['links', 'notes', 'records']) {
    for (const item of result[key]) {
      if (item.taskId && !taskIds.has(item.taskId)) throw new Error(`${key} 中的「${item.title}」关联了不存在的事项：${item.taskId}`);
    }
  }
  if(value.personal!==undefined)result.personal=validatePersonal(value.personal,ids);
  if(value.dailyArchives!==undefined)result.dailyArchives=validateDailyArchives(value.dailyArchives);
  if(value.archiveDocuments!==undefined)result.archiveDocuments=validateArchiveDocuments(value.archiveDocuments);
  return result;
}

function getStorage(storage) {
  // Legacy import/test adapters only. The live application uses the local file API.
  if (!storage) throw new Error('请显式提供旧数据适配器；工作台已改用本机文件存储');
  return storage;
}

export function loadData(storage) {
  let raw;
  try { raw = getStorage(storage).getItem(STORAGE_KEY); }
  catch (error) { throw new Error(`读取工作台数据失败：${error.message}`); }
  if (raw === null || raw === undefined) return clone(seedData);
  let value;
  try { value = JSON.parse(raw); }
  catch { throw new Error('已有工作台数据不是有效的 JSON，未覆盖原数据。请先导出原始数据再恢复备份。'); }
  try { return validateBackup(value); }
  catch (error) { throw new Error(`已有工作台数据校验失败，未覆盖原数据：${error.message}`); }
}

export function saveData(data, storage) {
  const clean = validateBackup(data);
  try { getStorage(storage).setItem(STORAGE_KEY, JSON.stringify(clean)); }
  catch (error) { throw new Error(`保存失败，请导出备份并检查浏览器存储权限或剩余空间：${error.message}`); }
  return clean;
}

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? all;
    const number = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : '\ufffd';
  });
}

function csvRows(text) {
  const rows = [];
  const errors = [];
  let fields = [], field = '', quoted = false, afterQuote = false, line = 1, rowLine = 1, malformed = false;
  const pushRow = () => {
    fields.push(field);
    if (!malformed && fields.some((part) => part.trim())) rows.push({ fields, line: rowLine });
    fields = []; field = ''; quoted = false; afterQuote = false; malformed = false;
  };
  for (let index = 0; index < text.length; index++) {
    const ch = text[index];
    if (quoted) {
      if (ch === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (ch === '"') { quoted = false; afterQuote = true; }
      else { field += ch; if (ch === '\n') line++; }
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      if (ch === ',') { fields.push(field); field = ''; afterQuote = false; }
      else {
        if (ch === '\r' && text[index + 1] === '\n') index++;
        pushRow(); line++; rowLine = line;
      }
    } else if (ch === '"' && !field.trim() && !afterQuote) { field = ''; quoted = true; }
    else if ((afterQuote && !/\s/.test(ch)) || ch === '"') {
      if (!malformed) errors.push({ line: rowLine, message: 'CSV 引号格式错误' });
      malformed = true; field += ch;
    } else if (!afterQuote) field += ch;
  }
  if (quoted) errors.push({ line: rowLine, message: 'CSV 的引号未闭合' });
  else pushRow();
  return { rows, errors };
}

/** Parses only data. HTML is never mounted, evaluated or fetched. */
export function parseLinks(text, format = 'text') {
  const links = [];
  const errors = [];
  if (typeof text !== 'string') return { links, errors: [{ line: 1, message: '导入内容必须是文本' }] };
  const source = text.replace(/^\ufeff/, '');
  const add = (input, title, line, category = '未分类', description = '') => {
    try {
      const url = normalizeUrl(input);
      links.push({ title: title?.trim() || new URL(url).hostname, url, category: category?.trim() || '未分类', description: description?.trim() || '' });
    } catch (error) { errors.push({ line, message: error.message }); }
  };
  const kind = format.toLowerCase();
  if (kind === 'html' || (kind === 'text' && /<!doctype\s+netscape-bookmark|<a\b[^>]*\bhref\s*=/i.test(source))) {
    const anchors = /<a\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/a\s*>/gi;
    let match;
    while ((match = anchors.exec(source))) {
      const href = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(match[1]);
      const line = source.slice(0, match.index).split('\n').length;
      if (!href) { errors.push({ line, message: '书签缺少 href 链接地址' }); continue; }
      add(decodeEntities(href[1] ?? href[2] ?? href[3]), decodeEntities(match[2].replace(/<[^>]*>/g, '')), line);
    }
    if (!links.length && !errors.length && source.trim()) errors.push({ line: 1, message: '没有找到书签链接，请选择浏览器导出的书签 HTML 文件' });
  } else if (kind === 'csv') {
    const parsed = csvRows(source);
    errors.push(...parsed.errors);
    const [header, ...rows] = parsed.rows;
    if (!header) return { links, errors };
    const names = header.fields.map((name) => name.trim().toLowerCase());
    const column = (aliases) => names.findIndex((name) => aliases.includes(name));
    const urlIndex = column(['url', '链接', '网址']);
    if (urlIndex < 0) return { links, errors: [...errors, { line: header.line, message: 'CSV 首行需要包含 url 列；可选 title、category、description 列' }] };
    const titleIndex = column(['title', '标题', '名称']);
    const categoryIndex = column(['category', '分类']);
    const descriptionIndex = column(['description', '说明', '备注']);
    for (const row of rows) {
      if (row.fields.length !== names.length) { errors.push({ line: row.line, message: 'CSV 列数与表头不一致' }); continue; }
      add(row.fields[urlIndex], row.fields[titleIndex], row.line, row.fields[categoryIndex], row.fields[descriptionIndex]);
    }
  } else if (kind === 'text' || kind === 'markdown' || kind === 'txt') {
    source.split(/\r?\n/).forEach((raw, index) => {
      const line = raw.trim();
      if (!line) return;
      const markdown = /^(?:[-*]\s+)?\[([^\]]*)\]\(\s*<?(\S+?)>?(?:\s+"[^"]*")?\s*\)$/.exec(line);
      if (markdown) { add(markdown[2], markdown[1], index + 1); return; }
      const match = /[a-z][a-z\d+.-]*:\/\/[^\s<>"']+/i.exec(line);
      if (match) {
        const title = `${line.slice(0, match.index)} ${line.slice(match.index + match[0].length)}`.replace(/^[\s|,，;；:：—–-]+|[\s|,，;；:：—–-]+$/g, '');
        add(match[0], title, index + 1);
      } else add(line, '', index + 1);
    });
  } else errors.push({ line: 1, message: `不支持的导入格式：${format}` });
  return { links, errors };
}

/** Existing records win conflicts; remap imported task IDs when cross-type IDs collide. */
export function mergeData(current, incoming) {
  const result = validateBackup(current);
  const imported = validateBackup(incoming);
  const used = new Map(collections.flatMap((key) => result[key].map((item) => [item.id, key])));
  for(const key of ['entries','journals'])for(const item of result.personal?.[key]||[])used.set(item.id,'personal:'+key);
  const taskMap = new Map();
  const noteMap = new Map();
  const linkMap = new Map(),addedTasks=[];
  const claimId = (id, key) => {
    let next = id;
    // Stable remapping makes re-importing the same backup idempotent, even when
    // an imported task ID originally collided with an existing note or link.
    while (used.has(next) && used.get(next) !== key) next = `${key}:${next}`;
    const existing = used.has(next);
    used.set(next, key);
    return { id: next, existing };
  };
  for (const task of imported.tasks) {
    const { id, existing } = claimId(task.id, 'tasks');
    taskMap.set(task.id, id);
    if (!existing) { const added={...task,id};result.tasks.push(added);addedTasks.push(added); }
  }
  for (const key of ['links', 'notes', 'records', 'activity']) {
    const urls = key === 'links' ? new Set(result.links.map((item) => normalizeUrl(item.url))) : null;
    for (const item of imported[key]) {
      if (urls && urls.has(item.url)) { linkMap.set(item.id,result.links.find(link=>normalizeUrl(link.url)===item.url).id);continue; }
      const { id, existing } = claimId(item.id, key);
      if(key==='notes')noteMap.set(item.id,id);
      if(key==='links')linkMap.set(item.id,id);
      if (existing) continue;
      const added = { ...item, id };
      if ('taskId' in added) added.taskId = added.taskId ? taskMap.get(added.taskId) : '';
      result[key].push(added);
      if (urls) urls.add(item.url);
    }
  }
  for(const task of addedTasks)if(task.linkIds)task.linkIds=[...new Set(task.linkIds.map(id=>linkMap.get(id)||id))];
  if(imported.personal) {
    result.personal ||= {entries:[],journals:[]};
    for(const key of ['entries','journals'])for(const original of imported.personal[key]) {
      const item=clone(original);
      if(key==='entries'&&item.sourceNoteId)item.sourceNoteId=noteMap.get(item.sourceNoteId)||item.sourceNoteId;
      if(key==='journals')item.taskIds=item.taskIds.map(id=>taskMap.get(id)||id);
      let claim=claimId(item.id,'personal:'+key);
      if(claim.existing) {
        const existing=result.personal[key].find(e=>e.id===claim.id);
        if(JSON.stringify(existing)===JSON.stringify({...item,id:claim.id}))continue;
        const signature=JSON.stringify(item);let code=2166136261;
        for(let i=0;i<signature.length;i++)code=Math.imul(code^signature.charCodeAt(i),16777619)>>>0;
        claim=claimId(`personal:${key}:${item.id}:${code.toString(16)}`,'personal:'+key);
        if(claim.existing)continue;
        if(key==='entries')item.status='pending';
        item.title+='（合并副本）';
      }
      result.personal[key].push({...item,id:claim.id});
    }
  }
  if(imported.dailyArchives) {
    result.dailyArchives ||= [];
    // Merging backups keeps the current day's summary and adds missing dates.
    for(const item of imported.dailyArchives)if(!result.dailyArchives.some(existing=>existing.date===item.date))result.dailyArchives.push(item);
  }
  if(imported.archiveDocuments) {
    result.archiveDocuments ||= [];
    for(const item of imported.archiveDocuments)if(!result.archiveDocuments.some(existing=>existing.id===item.id))result.archiveDocuments.push(item);
  }
  return validateBackup(result);
}

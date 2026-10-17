import { cloudMode, githubSession, rememberReaderState, readerPreview } from './cloud-session.js?v=sync-20261018';
export { cloudMode };
export { readerPreview };
export { rememberReaderState };
// Disk mode uses localhost; Pages mode uses the user's private GitHub repository.
async function request(url, options = {}, readOptions = {}) {
  if (cloudMode) {
    const workspace=await githubSession(),value=options.body&&typeof options.body==='string'?JSON.parse(options.body):{};
    if(url==='/api/state'){
      if(options.method==='PUT'&&value.expectedStore&&value.expectedStore!==workspace.envelope({}).dataDir)throw Object.assign(new Error('连接的资料仓库发生变化，草稿仍保留，未向其他仓库上传。'),{status:409});
      return options.method==='PUT'?workspace.save(value.data,value.revision):readOptions.archive||readOptions.date?workspace.readArchive(readOptions):readOptions.archives===false?workspace.state({reuse:readOptions.fresh!==true}):workspace.readWithArchives();
    }
    if(url==='/api/personal-document')return workspace.personalDocument();
    if(url==='/api/codex/sync')return workspace.sync(value.revision,value.since);
    if(url==='/api/backup')return workspace.backup();
    if(url==='/api/restore')return workspace.restore({...value.data,files:value.files},value.mode,value.revision);
    if(url==='/api/files')return workspace.upload(options.body);
    throw new Error('云端不支持此操作，请使用完整备份迁移资料。');
  }
  let response;
  try { response = await fetch(url, { cache: 'no-store', ...options }); }
  catch { throw new Error('无法连接本机服务。请启动工作间后重试，当前编辑内容尚未保存。'); }
  let body;
  try { body = await response.json(); }
  catch { throw new Error('本机服务未返回有效数据，请确认已启动新版工作间服务。'); }
  if (!response.ok) {
    const error = new Error(response.status === 409
      ? '其他页面已更新了本机数据，本次未覆盖。请先复制未保存的内容，关闭编辑后点击“重新载入”，再继续编辑。'
      : (typeof body.error === 'string' ? body.error : body.error?.message) || body.message || `本机操作失败（${response.status}）`);
    error.status = response.status;
    throw error;
  }
  return body;
}

const json = (value, method = 'POST') => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
export const readWorkspace = (options = {}) => request('/api/state',{},options);
export const readPersonalDocument = () => request('/api/personal-document');
export const syncCodexRecords = (revision,since='') => request('/api/codex/sync',json({revision,since}));
export const writeWorkspace = (data, revision, expectedStore) => request('/api/state', json({ data, revision, ...(expectedStore?{expectedStore}:{}) }, 'PUT'));
export const migrateWorkspace = (data) => request('/api/migrate', json({ data }));
export const readBackup = () => request('/api/backup');
export const restoreWorkspace = (backup, mode, revision) => request('/api/restore', json({ data: backup, files: backup.files || [], mode, revision }));
export const uploadFile = (file) => request('/api/files', { method: 'POST', headers: { 'X-File-Name': encodeURIComponent(file.name), 'Content-Type': file.type || 'application/octet-stream' }, body: file });

const attachmentUrls = new Map();
export async function attachmentUrl(file) {
  if(!cloudMode)return `/api/files/${encodeURIComponent(file.id)}`;
  if(!attachmentUrls.has(file.id)) {
    const task=(async()=>URL.createObjectURL(new Blob([await (await githubSession()).attachment(file)],{type:file.type})))();
    attachmentUrls.set(file.id,task);task.catch(()=>attachmentUrls.delete(file.id));
  }
  return attachmentUrls.get(file.id);
}

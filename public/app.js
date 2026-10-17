import { STORAGE_KEY, createId, normalizeUrl, parseLinks, validateBackup } from './store.js';
import { seedData } from './seed.js';
import { renderMarkdown, markdownExcerpt, documentTitle, embedLocalImages } from './markdown.js';
import { readWorkspace, writeWorkspace, migrateWorkspace, readBackup, restoreWorkspace, uploadFile,cloudMode } from './local-api.js';
import { createPersonalUI } from './personal-ui.js';
import { personalData,dayKey } from './personal.js';
import { linksForTask,setTaskLinks,removeTaskLink } from './task-links.js';
import { applyTheme,refreshVisuals,installSpotlight } from './ui-effects.js';
import { installAppPanel } from './install-app.js';
import { cloudConnectionPanel,refreshConnectionPanel } from './cloud-session.js';

const $ = (s, root = document) => root.querySelector(s);
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  task:'M9 5H5v16h14V5h-4 M9 3h6v4H9z M8 12l2 2 5-5 M8 18h8',
  link:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
  book:'M12 5v16 M12 5C8 2 4 3 2 4v16c3-2 7-1 10 1 3-2 7-3 10-1V4c-3-1-7-2-10 1',
  flask:'M9 3h6 M10 3v7L4 20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1l-6-10V3 M7 16h10',
  clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  plus:'M12 5v14 M5 12h14', search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  arrow:'M5 12h14 M13 6l6 6-6 6', external:'M14 3h7v7 M21 3L10 14 M10 3H3v18h18v-7',
  upload:'M12 16V3 M7 8l5-5 5 5 M3 15v6h18v-6', download:'M12 3v13 M7 11l5 5 5-5 M3 17v4h18v-4',
  pin:'M8 3h8l-1 7 4 4H5l4-4z M12 14v8', edit:'M14 4l6 6 M3 21l5-1L21 7l-4-4L4 16z',
  trash:'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7', close:'M6 6l12 12 M18 6L6 18',
  folder:'M3 5h6l3 3h9v12H3z', code:'M8 6l-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18',
  check:'M5 12l4 4L19 6', settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  note:'M6 3h9l5 5v13H4V3z M14 3v6h6 M8 13h8 M8 17h6', heart:'M12 21L3 12C-2 3 8-1 12 6c4-7 14-3 9 6z',
};
const icon = (name, cls = '') => `<svg class="${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.note}"/></svg>`;
const labels = {dashboard:'工作台',tasks:'工作事项',links:'链接库',notes:'知识库',activity:'工作记录',settings:'数据与设置',detail:'事项详情',profile:'工作档案',journal:'工作档案',portable:'工作档案',archives:'工作档案'};
const kinds = {tasks:'事项',links:'链接',notes:'文档',records:'验证记录'};
const statuses = ['待开始','进行中','等待反馈','已完成','暂缓','资料归档'];
const categories = ['未分类','代码评审','任务需求','技术文档','环境工具','测试结果','参考资料'];
const noteCategories = ['源码学习','公共组件','精度分析','环境与验证','需求讨论','工作交付','个人档案材料','其他'];
const recordKinds = ['源码核对','构建','QEMU 功能','EMU 性能','真机性能','环境说明','待核实'];
const modal = $('#modal');
let data = {...structuredClone(seedData), tasks:[],links:[],notes:[],records:[],activity:[]}, revision, dataDir = '', loadError = '', migrationWarning = '', diskWarning = '', busy = false, initializing = false, filter = '', query = '', importCandidates = [], importDraft = '', importFileFormat = '', restoreCandidate = null;
let noteDirty = false, previewTimer, documentDrafts = [], documentSelectedFiles = [], documentImageFiles = [], documentImportGeneration = 0;
let lastView='',commandIndex=-1;
let masterPath='',codexDir='',codexWorkspace='',documentUploadReturn='notes';
let archiveStatus={},reloading=false;
const personalUI=createPersonalUI({data:()=>data,archiveStatus:()=>archiveStatus,masterPath:()=>masterPath,codexDir:()=>codexDir,codexWorkspace:()=>codexWorkspace,esc,field,selectField,showModal,commit,toast,download,render,dirty:value=>{noteDirty=value;},discard:canDiscardDocument,upload:startDocumentUpload});
let route = () => { const parts = location.hash.slice(1).split('/'); return {page:parts[0]==='records'?'dashboard':parts[0] || 'dashboard', id:decodeURIComponent(parts.slice(1).join('/'))}; };
const date = (s) => new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit'}).format(new Date(s));
const fullDate = (s) => new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date(s));
const sorted = (xs) => [...xs].sort((a,b) => Number(b.pinned)-Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
const sortedTasks = (xs) => xs;
function reorderVisibleTasks(tasks, visibleIds) {
  const visible = new Set(visibleIds), byId = new Map(tasks.map(task => [task.id, task]));
  let index = 0;
  return tasks.map(task => visible.has(task.id) ? byId.get(visibleIds[index++]) : task);
}
const tags = (xs = []) => `<div class="tags">${xs.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div>`;
const badge = (s) => `<span class="badge ${/已完成|通过/.test(s)?'green':/等待|待核实|暂缓/.test(s)?'amber':/进行|QEMU/.test(s)?'blue':'gray'}">${esc(s)}</span>`;
const taskName = (id) => data.tasks.find(t=>t.id===id)?.title || '';
const opts = (xs,selected) => xs.map(x=>`<option ${x===selected?'selected':''} value="${esc(x)}">${esc(x)}</option>`).join('');
const taskOptions = (selected='') => `<option value="">暂不关联</option>${data.tasks.map(t=>`<option value="${esc(t.id)}" ${t.id===selected?'selected':''}>${esc(t.title)}</option>`).join('')}`;
function toast(message, error = false) { const el = document.createElement('div'); el.className = 'toast' + (error?' error':''); el.textContent = message; $('#toasts').append(el); setTimeout(()=>el.remove(),error?7000:3500); }
function acceptState(state) {
  if(!state.features?.includes('personal-archive-v1'))throw new Error('请重新启动本机工作间服务以加载个人档案功能，当前版本不能保存新档案。');
  if(!state.features.includes('task-links-v1'))throw new Error('请重新启动本机工作间服务以加载事项链接关联功能。');
  if(!state.features.includes('daily-archive-v2'))throw new Error('请重新启动本机工作间服务以加载每日摘要功能。');
  if(!state.features.includes('archive-documents-v1'))throw new Error('请重新启动本机工作间服务以加载历史总结和个人档案文档。');
  if(!state.features.includes('ui-refresh-v1'))throw new Error('请重新启动本机工作间服务以加载新版界面。');
  codexDir=state.codexDir||codexDir;codexWorkspace=state.codexWorkspace||codexWorkspace;
  masterPath=state.masterPath||masterPath;
  archiveStatus=state.archiveSync || archiveStatus;
  data = validateBackup(state.data); revision = state.revision; dataDir = state.dataDir || dataDir; diskWarning=state.warning||''; loadError = '';
  applyTheme(data.settings.theme);
}
async function initialize() {
  if(initializing||busy||modal.open)return;
  initializing=true;
  try {
    acceptState(await readWorkspace());
    if(!cloudMode)try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        acceptState(await migrateWorkspace(validateBackup(JSON.parse(raw))));
        // Remove the legacy copy only after the server confirms durable storage.
        localStorage.removeItem(STORAGE_KEY);
        toast('旧数据已迁移到本机文件夹');
      }
      migrationWarning = '';
    } catch (error) {
      migrationWarning = `旧浏览器数据尚未完成迁移，原副本保留：${error.message}`;
    }
  } catch (error) { loadError = error.message; }
  initializing=false; render(); openEditRoute();
}
async function reloadWorkspace(silent = false) {
  if (busy || initializing || reloading || modal.open) return;
  if (silent && document.activeElement?.matches('input,textarea,select')) return;
  const previousRevision=revision;
  reloading=true;
  try {
    const current = await readWorkspace();
    if (modal.open || busy || initializing || previousRevision!==revision) return;
    const changed = current.revision !== revision;
    acceptState(current); render();
    if (!silent) toast(changed ? '已载入本机最新数据' : '当前已是最新数据');
  } catch (error) { if (!silent) { loadError=error.message; render(); } }
  finally {reloading=false;}
}
async function withBusy(operation) {
  if (busy) throw new Error('正在保存到本机，请稍候。');
  busy = true;
  const buttons = $$('button,input,select,textarea').filter(button=>!button.disabled);
  buttons.forEach(button=>button.disabled=true);
  try { return await operation(); }
  finally { busy=false; buttons.forEach(button=>{if(button.isConnected)button.disabled=false;}); }
}
async function commit(mutator, message) {
  if (loadError || initializing || revision === undefined) throw new Error('本机数据暂时无法读取，请启动服务并重新载入。');
  const next = structuredClone(data);
  mutator(next);
  if (message) next.activity.unshift({id:createId(),text:message,at:new Date().toISOString()});
  next.activity = next.activity.slice(0,300);
  acceptState(await withBusy(()=>writeWorkspace(next, revision))); render();
}
function empty(title, text, action = '', actionText = '') { return `<div class="empty-state">${icon('folder')}<h3>${title}</h3><p>${text}</p>${action?`<button class="button secondary small" data-action="${action}">${icon('plus')}${actionText}</button>`:''}</div>`; }
function pageHeader(eyebrow,title,description,actions='') { return `<div class="page-header"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="page-description">${description}</p></div><div class="header-actions">${actions}</div></div>`; }
const addButton = (collection,label) => `<button class="button primary" data-action="new" data-collection="${collection}">${icon('plus')}${label}</button>`;
const importButton = () => `<button class="button secondary" data-action="import">${icon('upload')}导入链接</button>`;
function menu() {
  const p = route().page === 'detail' ? 'tasks' : ['profile','journal','portable'].includes(route().page)?'archives':route().page;
  $('#navigation').innerHTML = [['dashboard','grid'],['tasks','task'],['links','link'],['notes','book'],['activity','clock'],['archives','folder']].map(([key,ico])=>`<a href="#${key}" class="nav-item ${p===key?'active':''}" title="${labels[key]}" aria-label="${labels[key]}" ${p===key?'aria-current="page"':''}>${icon(ico)}<span>${labels[key]}</span>${data[key]?`<span class="nav-count">${data[key].length}</span>`:''}</a>`).join('');
  $('#breadcrumb-title').textContent = labels[route().page] || '工作台';
  $('#workspace-name').textContent = data.settings.name;
}
function taskCard(t, sortable = false) {
  const draggable=sortable===true,linked=linksForTask(data,t.id);
  return `<article class="task-card" data-task-id="${esc(t.id)}"><div class="task-top">${draggable?`<button class="task-drag-handle" type="button" data-task-drag="${esc(t.id)}" aria-label="拖动排序 ${esc(t.title)}" title="拖动排序；方向键也可调整">⠿</button>`:''}<span class="muted">${esc(t.type)}</span><select class="task-status-select" data-task-status="${esc(t.id)}" aria-label="调整事项状态：${esc(t.title)}">${opts([...new Set([...statuses,t.status])],t.status)}</select></div><a class="task-title" href="#detail/${encodeURIComponent(t.id)}">${esc(t.title)}</a><p class="task-summary">${esc(t.summary || '添加目标，让下一步更清晰。')}</p>${t.nextStep?`<div class="task-next"><span>下一步</span>${esc(t.nextStep)}</div>`:''}<div class="task-footer">${tags(t.tags)}<div class="task-card-actions"><button class="text-button" data-action="task-links" data-id="${esc(t.id)}" aria-label="关联链接：${esc(t.title)}">${icon('link')}关联链接${linked.length?` (${linked.length})`:''}</button><button class="icon-button ${t.pinned?'is-pinned':''}" data-action="pin" data-collection="tasks" data-id="${esc(t.id)}" aria-label="${t.pinned?'取消置顶':'置顶'} ${esc(t.title)}">${icon('pin')}</button></div></div></article>`;
}
function linkCard(l) {
  const associated=data.tasks.filter(task=>task.id===l.taskId||task.linkIds?.includes(l.id));
  return `<article class="link-card"><div class="card-top"><span class="link-icon">${icon(/评审/.test(l.category)?'code':'link')}</span><div class="card-actions"><button class="icon-button ${l.pinned?'is-pinned':''}" data-action="pin" data-collection="links" data-id="${esc(l.id)}" aria-label="${l.pinned?'取消置顶':'置顶'} ${esc(l.title)}">${icon('pin')}</button><button class="icon-button" data-action="edit" data-collection="links" data-id="${esc(l.id)}" aria-label="编辑 ${esc(l.title)}">${icon('edit')}</button></div></div><a class="card-title" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" data-track="${esc(l.id)}">${esc(l.title)}${icon('external')}</a><p class="card-description">${esc(l.description || new URL(l.url).hostname)}</p>${tags(l.tags)}<div class="card-footer"><span class="badge gray">${esc(l.category)}</span>${associated.length?`<div class="linked-task-group">${associated.map(task=>`<a class="linked-task" href="#detail/${encodeURIComponent(task.id)}" title="${esc(task.title)}">${icon('task')}${esc(task.title)}</a>`).join('')}</div>`:`<span class="link-domain">${esc(new URL(l.url).hostname)}</span>`}</div></article>`;
}
function documentUrl(id) { return `./document.html?id=${encodeURIComponent(id)}`; }
function noteCard(n) { return `<a class="note-card" href="${documentUrl(n.id)}" target="_blank" rel="noopener noreferrer" aria-label="打开文档：${esc(n.title)}（新标签页）"><div class="card-top"><span class="topic-icon">${icon(n.category==='公共组件'?'code':'book')}</span><span class="badge gray">${esc(n.category)}</span></div><h3>${esc(n.title)}</h3><p class="card-description">${esc(n.attachment?(n.body || n.attachment.name):n.format==='markdown'?markdownExcerpt(n.body):n.body.slice(0,105))}</p><div class="card-footer">${tags(n.tags.slice(0,2))}<span class="muted">${n.attachment?esc(n.attachment.name.split('.').pop().toUpperCase())+' · ':n.format==='markdown'?'MD · ':''}${date(n.updatedAt)}</span>${icon('external')}</div></a>`; }
function activities(limit=30) { return data.activity.length?`<div class="activity-list">${data.activity.slice(0,limit).map(a=>`<div class="activity-item"><span class="activity-dot"></span><div class="activity-content"><p>${esc(a.text)}</p><time>${date(a.at)} · ${new Date(a.at).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit'})}</time></div></div>`).join('')}</div>`:empty('每一步，都会留下记录','添加事项、收集链接后，你的工作足迹会出现在这里。'); }
function workspaceVisual() {
  return `<div class="workspace-orbit" aria-hidden="true"><div class="orbit-ring ring-one"></div><div class="orbit-ring ring-two"></div><div class="orbit-path"></div><div class="orbit-core"><span class="core-glyph">间</span><span>WORKSPACE</span></div><div class="orbit-node node-tasks">${icon('task')}<span>工作事项<strong>${data.tasks.length}</strong></span></div><div class="orbit-node node-notes">${icon('book')}<span>知识文档<strong>${data.notes.length}</strong></span></div><div class="orbit-node node-links">${icon('link')}<span>常用链接<strong>${data.links.length}</strong></span></div><div class="orbit-caption"><span class="status-dot"></span>灵感、行动与知识，在这里连接</div></div>`;
}
function dashboard() {
  const active = sortedTasks(data.tasks.filter(t=>!['已完成','资料归档'].includes(t.status)));
  const shortcuts = sorted(data.links).slice(0,6);
  return pageHeader(fullDate(new Date()),'今天，从这里开始。','把正在做的事和需要的资料，放在触手可及的地方。',`<button class="button secondary" data-action="journal-new">${icon('note')}记录今天</button>`+importButton()+addButton('tasks','新建事项'))+
    `<section class="hero"><div class="hero-copy"><span class="hero-tag"><span class="status-dot"></span>你的个人研发空间</span><h2>把思路连起来，<br><em>让工作向前一步。</em></h2><p>事项、资料与每一天的积累，<br>在一个安静、有序的空间里继续。</p><div class="hero-actions"><button class="button primary" data-action="${active.length?'continue':'import'}">${active.length?'继续当前工作':'导入我的工作链接'}${icon('arrow')}</button><a class="text-button" href="#archives">查看工作档案 ${icon('arrow')}</a></div><div class="hero-footnote"><span>LOCAL FIRST</span><i></i>数据保存在本机</div></div><div class="hero-visual">${workspaceVisual()}</div></section>`+
    `<div class="stats-grid">${[['task',active.length,'待推进事项','tasks'],['link',data.links.length,'收集的链接','links'],['book',data.notes.length,'知识笔记','notes'],['clock',(data.dailyArchives||[]).filter(item=>item.date<dayKey()).length,'每日工作摘要','archives']].map(([ico,n,label,target])=>`<a class="stat-card" href="#${target}"><span class="stat-icon">${icon(ico)}</span><div><span class="stat-number">${n}</span><span class="stat-label">${label}</span></div>${icon('arrow','stat-arrow')}</a>`).join('')}</div>`+
    `<div class="dashboard-grid"><div class="stack"><section class="panel"><div class="section-head"><h2>当前关注 <span class="section-count">${active.length}</span></h2><a href="#tasks" class="text-button">全部事项 ${icon('arrow')}</a></div>${active.length?`<div class="task-list">${active.slice(0,3).map(taskCard).join('')}</div>`:empty('下一件值得推进的事是什么？','记下目标和下一步，下次回来就能继续。','new-task','创建第一个工作事项')}</section><section class="panel"><div class="section-head"><h2>常用入口</h2><a href="#links" class="text-button">链接库 ${icon('arrow')}</a></div><div class="quick-grid">${shortcuts.length?shortcuts.map(l=>`<a class="quick-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" data-track="${esc(l.id)}"><span class="link-icon">${icon('link')}</span><span><strong class="link-name">${esc(l.title)}</strong><small class="link-domain">${esc(new URL(l.url).hostname)}</small></span>${icon('external')}</a>`).join(''):[['代码评审','Gerrit / Pull request','代码评审'],['任务需求','Jira / 工作需求','任务需求'],['团队文档','钉钉 / 技术资料','技术文档'],['开发环境','环境说明 / 常用工具','环境工具']].map(([name,desc,cat])=>`<button class="quick-link" data-action="add-entry" data-category="${cat}" data-title="${name}"><span class="link-icon">${icon('plus')}</span><span><strong class="link-name">添加${name}</strong><small class="link-domain">${desc}</small></span></button>`).join('')}</div></section></div><div class="stack"><section class="panel"><div class="section-head"><h2>最近记录</h2><a class="text-button" href="#activity">查看全部</a></div>${activities(5)}</section><aside class="quote-card"><span class="eyebrow">一个小习惯</span><p>结束工作前，<br>给明天留一句「下一步」。</p><span class="muted">不用重新想起，就能继续向前。</span></aside></div></div>`+
    `<section class="panel knowledge-panel"><div class="section-head"><div><h2>你的知识积累</h2><p class="section-subtitle">从源码到验证，把经验留在这里。</p></div><a class="text-button" href="#notes">打开知识库 ${icon('arrow')}</a></div><div class="topic-grid">${sorted(data.notes).slice(0,3).map(noteCard).join('')}</div></section>`;
}
function filtered(xs,key) { return (key==='status'?sortedTasks(xs):sorted(xs)).filter(x=>(!filter || (filter==='置顶'?x.pinned:x[key]===filter)) && (!query || [x.title,x.summary,x.description,x.body,...(x.tags||[])].join(' ').toLowerCase().includes(query.toLowerCase()))); }
function toolbar(filters,placeholder) { return `<div class="toolbar"><div class="filters">${['全部',...filters].map(f=>`<button class="filter-chip ${filter===(f==='全部'?'':f)?'active':''}" data-action="filter" data-value="${f==='全部'?'':esc(f)}">${esc(f)}</button>`).join('')}</div><label class="local-search">${icon('search')}<input id="list-search" type="search" placeholder="${placeholder}" value="${esc(query)}" aria-label="${placeholder}"></label></div>`; }
function listPage(page) {
  if(page==='tasks') return pageHeader('MAKE PROGRESS','工作事项','拖动卡片左上角的手柄调整顺序；也可以用方向键排序。顺序会保存到本机。',addButton('tasks','新建事项'))+toolbar(['进行中','待开始','等待反馈','已完成','暂缓','资料归档'],'查找事项')+`<div class="card-grid" id="sortable-tasks">${filtered(data.tasks,'status').map(t=>taskCard(t,true)).join('') || empty('这里还没有事项','试试其他筛选，或新建一件工作。','new-task','新建事项')}</div>`;
  if(page==='links') return pageHeader('EVERYTHING CONNECTED','链接库','工作中用到的入口，都有一个好找的位置。',importButton()+addButton('links','添加链接'))+toolbar([...new Set(data.links.map(l=>l.category))],'搜索标题、用途、标签')+`<div class="card-grid">${filtered(data.links,'category').map(linkCard).join('') || empty('收下你的第一个工作链接','支持批量粘贴、浏览器书签和 CSV 文件导入。','import','导入链接')}</div>`;
  if(page==='notes') return pageHeader('BUILD YOUR KNOWLEDGE','知识库','文档保存在本机文件夹，点击卡片在新标签页阅读。',`<button class="button secondary" data-action="upload-documents">${icon('upload')}上传文档</button>`+addButton('notes','新建文档'))+toolbar([...new Set(data.notes.map(n=>n.category))],'搜索文档、标签')+`<div class="note-grid">${filtered(data.notes,'category').map(noteCard).join('') || empty('还没有相关文档','上传 Markdown、PDF、文本或图片，或直接开始写作。','new-note','新建文档')}</div>`;
}
function detail(id) {
  const t = data.tasks.find(x=>x.id===id);
  if(!t) return pageHeader('WORK ITEM','事项不存在','它可能已被删除。')+'<a class="button secondary" href="#tasks">返回事项列表</a>';
  const related = Object.fromEntries(['links','notes'].map(k=>[k,k==='links'?linksForTask(data,id):data[k].filter(x=>x.taskId===id)]));
  return pageHeader(esc(t.type),esc(t.title),`更新于 ${date(t.updatedAt)} · ${esc(t.status)}`,`<a class="button secondary" href="#tasks">返回列表</a><button class="button secondary" data-action="task-links" data-id="${esc(id)}">${icon('link')}关联已有链接</button><button class="button primary" data-action="edit" data-collection="tasks" data-id="${esc(id)}">${icon('edit')}编辑事项</button>`)+
    `<div class="detail-layout"><div class="stack"><section class="panel detail-section"><h2>目标与当前结论</h2><div class="prose">${esc(t.summary || '还没有填写。')}</div>${tags(t.tags)}</section><section class="panel detail-section"><div class="section-head"><h2>相关链接 <span class="section-count">${related.links.length}</span></h2><button class="text-button" data-action="new" data-collection="links" data-task-id="${esc(id)}">${icon('plus')}添加链接</button></div>${related.links.length?`<div class="card-grid">${related.links.map(linkCard).join('')}</div>`:empty('把资料关联到这件事','需求、评审与参考资料，可以放在一起。')}</section><section class="panel detail-section"><div class="section-head"><h2>笔记与交付</h2><button class="text-button" data-action="new" data-collection="notes" data-task-id="${esc(id)}">${icon('plus')}添加笔记</button></div><div class="note-grid">${related.notes.map(noteCard).join('') || '<p class="muted">还没有相关笔记。</p>'}</div></section></div><div class="stack"><section class="panel detail-section"><h2>下一步</h2><div class="prose">${esc(t.nextStep || '写下一件可以继续执行的小事。')}</div><label class="field">工作状态<select id="detail-status" data-id="${esc(id)}">${opts([...new Set([...statuses,t.status])],t.status)}</select></label></section><section class="panel detail-section"><h2>事项管理</h2><p class="muted">删除事项会解除资料关联，已有链接和文档仍然保留。</p><button class="button danger small" data-action="delete" data-collection="tasks" data-id="${esc(id)}">${icon('trash')}删除事项</button></section></div></div>`;
}
function settings() {
  return pageHeader('YOUR SPACE, YOUR DATA','数据与设置','所有资料保存在本机文件夹。换浏览器、清除网站数据不会删除已保存的资料。',`<button class="button secondary" data-action="reload-data">${icon('folder')}重新载入</button>`)+installAppPanel()+cloudConnectionPanel()+
    `<div class="settings-grid"><section class="panel backup-panel"><h2>工作台名称</h2><form id="settings-form"><label class="field">空间名称<input name="name" required maxlength="50" value="${esc(data.settings.name)}"></label><button class="button primary" type="submit">保存名称</button></form></section><section class="panel backup-panel"><h2>导出备份</h2><p>包含全部事项、链接、文档原文件、工作档案和设置。下载的 JSON 文件可在这里恢复。</p><button class="button primary" data-action="export">${icon('download')}下载完整备份</button><p class="hint">${data.tasks.length} 个事项 · ${data.links.length} 个链接 · ${data.notes.length} 篇文档</p></section><section class="panel backup-panel"><h2>恢复或合并数据</h2><p>选择工作间导出的 JSON 文件，预览后决定合并或替换。合并保留现有内容；替换前会自动保存本机恢复副本。</p><label class="field">备份文件<input id="backup-file" type="file" accept=".json,application/json"></label><div id="restore-preview"></div></section><section class="panel backup-panel"><h2>本机数据位置</h2><div class="prose">${esc(dataDir || '等待本机服务连接……')}

工作内容、文档和图片写入此文件夹，不写入浏览器存储。请保留此文件夹；完整备份也包含上传的原文件。

清理浏览器网站数据或使用无痕窗口不会删除已保存的本机资料。同一台电脑的不同浏览器使用同一份数据；其他设备需要复制数据文件夹或导入完整备份。

预置笔记和归档主题用于帮助你开始，均可编辑或删除。</div></section></div>`;
}
function render() {
  menu(); const {page,id} = route();
  const body = page==='dashboard'?dashboard():['archives','profile','journal','portable'].includes(page)?personalUI.page(page,id):['tasks','links','notes'].includes(page)?listPage(page):page==='detail'?detail(id):page==='activity'?pageHeader('ONE STEP AT A TIME','工作记录','每一次收集、思考和推进，都值得留下。')+`<section class="panel">${activities(300)}</section>`:page==='settings'?settings():dashboard();
  $('.storage-state span:nth-child(2)').textContent=loadError?'本机服务未连接':'数据保存在本机文件夹';
  $('#content').innerHTML = (loadError?`<div class="callout error"><div><strong>本机数据暂时无法读取</strong><p>${esc(loadError)}</p><button class="button secondary small" data-action="retry-connect">重新连接</button></div></div>`:'')+(migrationWarning?`<div class="callout error"><div><strong>旧数据迁移提示</strong><p>${esc(migrationWarning)}</p><button class="button secondary small" data-action="raw-export">下载旧浏览器数据</button><button class="button secondary small" data-action="retry-connect">重试迁移</button></div></div>`:'')+body;
  if(diskWarning)$('#content').insertAdjacentHTML('afterbegin',`<div class="callout error"><div><strong>本机文件提示</strong><p>${esc(diskWarning)}</p></div></div>`);
  if(page==='settings')$('#content').insertAdjacentHTML('beforeend',`<section class="panel" style="margin-top:20px"><h2>个人档案也随完整备份保存</h2><p class="hint">${personalData(data).entries.length} 条个人档案 · ${personalData(data).journals.length} 篇每日记录（含修订历史）。完整备份同时保留知识库原文件；Markdown 主档案可在“我的 AI 文档”下载。</p><a class="text-button" href="#portable">查看我的 AI 文档 →</a></section>`);
  if(page==='settings')$('#content').insertAdjacentHTML('beforeend',`<section class="panel appearance-panel"><div><div class="eyebrow">APPEARANCE</div><h2>选择你的工作氛围</h2><p class="hint">主题随本机设置保存，文档阅读页也会使用同一主题。</p></div><button class="button secondary" data-action="theme-toggle">${data.settings.theme==='dark'?'切换到浅色主题':'切换到深色主题'}</button></section>`);
  refreshConnectionPanel();
  const view=page+'/'+id;refreshVisuals($('#content'),view!==lastView);lastView=view;
}
function showModal(title,body,footer='',wide=false) {
  clearTimeout(previewTimer);
  modal.classList.remove('note-modal','command-modal');
  modal.classList.toggle('wide',wide);
  modal.innerHTML = `<div class="modal-header"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close" aria-label="关闭">${icon('close')}</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}`;
  if(!modal.open) modal.showModal();
}
function field(label,name,value='',type='text',full=false,required=false) { return `<label class="field ${full?'full':''}">${label}${required?' <span class="required">*</span>':''}${type==='textarea'?`<textarea name="${name}" rows="${full?5:3}" ${required?'required':''}>${esc(value)}</textarea>`:`<input name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${name==='title'?'maxlength="180"':''}>`}</label>`; }
function selectField(label,name,options,full=false) { return `<label class="field ${full?'full':''}">${label}<select name="${name}">${options}</select></label>`; }
function taskLinkChoices(taskId='',name='taskLinkIds') {
  const selected=new Set(linksForTask(data,taskId).map(link=>link.id));
  return `<fieldset class="field full task-link-choices"><legend>从链接库选择（可多选）</legend>${data.links.length?data.links.map(link=>`<label class="task-link-choice" data-link-choice><input type="checkbox" name="${name}" value="${esc(link.id)}" ${selected.has(link.id)?'checked':''}><span><strong>${esc(link.title)}</strong><small>${esc(link.url)}</small><small>${esc(link.category)}${link.taskId&&link.taskId!==taskId?` · 已关联 ${esc(taskName(link.taskId))}，可共用`:''}</small></span></label>`).join(''):'<p class="muted">链接库还没有链接。先到链接库添加或导入。</p>'}</fieldset>`;
}
function chooseTaskLinks(id) {
  const task=data.tasks.find(task=>task.id===id);if(!task)throw new Error('事项已不存在');
  showModal('关联已有链接',`<form id="task-links-form" data-id="${esc(id)}"><p class="muted">${esc(task.title)} · 同一链接可用于多个事项。取消勾选只解除本事项关联。</p><label class="field">搜索链接<input id="task-link-search" type="search" placeholder="标题、网址或分类"></label>${taskLinkChoices(id)}<p class="hint" id="task-link-empty" hidden>没有匹配的链接，已选项会保留。</p><p class="form-error" id="form-error" role="alert"></p></form>`,`<a class="button secondary" href="#links" data-close>打开链接库</a><button class="button secondary" data-action="close">取消</button><button class="button primary" type="submit" form="task-links-form" ${data.links.length?'':'disabled'}>保存关联</button>`,true);
}
function editForm(collection,id='',defaults={}) {
  const item = data[collection].find(x=>x.id===id) || defaults;
  const common = field('标题','title',item.title||'','text',true,true);
  let extra='';
  if(collection==='tasks') extra=selectField('事项类型','type',opts(['开发','排查','评审','学习','需求讨论','日常事务'],item.type||'开发'))+selectField('工作状态','status',opts(statuses,item.status||'待开始'))+field('目标与当前结论','summary',item.summary,'textarea',true)+field('下一步','nextStep',item.nextStep,'textarea',true);
  if(collection==='tasks')extra+=taskLinkChoices(id);
  if(collection==='links') extra=field('链接地址（http / https）','url',item.url,'url',true,true)+selectField('分类','category',opts([...new Set([...categories,item.category].filter(Boolean))],item.category||'未分类'))+selectField('关联事项','taskId',taskOptions(item.taskId))+field('用途备注','description',item.description,'textarea',true);
  if(collection==='notes') extra=selectField('文档分类','category',opts([...new Set([...noteCategories,item.category].filter(Boolean))],item.category||'其他'))+selectField('关联事项','taskId',taskOptions(item.taskId))+(item.attachment?`<div class="field full"><p class="hint">原文件：${esc(item.attachment.name)} · ${(item.attachment.size/1024).toFixed(1)} KB。此处编辑分类与说明，原文件保持不变。</p></div>`+field('文档说明','body',item.body,'textarea',true):documentEditor(item));
  if(collection==='records') extra=selectField('记录类型','kind',opts(recordKinds,item.kind||'QEMU 功能'))+selectField('结果','result',opts(['待验证','通过','失败','部分通过','仅记录'],item.result||'待验证'))+selectField('关联事项','taskId',taskOptions(item.taskId),true)+field('环境 / 设备','environment',item.environment)+field('代码版本 / 分支','version',item.version)+field('复现或运行命令','command',item.command,'textarea',true)+field('日志地址或本地路径','log',item.log,'text',true)+field('结论、条件与未覆盖范围','body',item.body,'textarea',true);
  if(collection!=='records') extra+=field('标签（逗号分隔）','tags',(item.tags||[]).join('，'),'text',true)+`<label class="checkbox-label field full"><input type="checkbox" name="pinned" ${item.pinned?'checked':''}>置顶，优先显示</label>`;
  showModal(`${id?'编辑':'新建'}${kinds[collection]}`,`<form id="editor-form" data-collection="${collection}" data-id="${esc(id)}"><div class="form-grid">${common}${extra}</div><p class="form-error" id="form-error" role="alert"></p></form>`,`${id?`<button class="button danger" data-action="delete" data-collection="${collection}" data-id="${esc(id)}">删除</button>`:''}<span class="spacer"></span><button class="button secondary" data-action="close">取消</button><button class="button primary" form="editor-form" type="submit">保存${kinds[collection]}</button>`,collection==='records'||collection==='notes');
  noteDirty = false;
  if(collection==='notes'){modal.classList.add('note-modal');updateDocumentPreview();}
}
function viewItem(collection,id) {
  if(collection==='notes'){window.open(documentUrl(id),'_blank','noopener,noreferrer');return;}
  const item=data[collection].find(x=>x.id===id); if(!item) return toast('内容已不存在',true);
  const body = `<div class="detail-meta">${badge(item.kind)}${badge(item.result)}</div>${[['环境',item.environment],['版本',item.version],['命令',item.command],['日志',item.log],['结论与范围',item.body]].map(([l,v])=>`<section class="detail-section"><h3>${l}</h3><div class="prose ${l==='命令'?'mono':''}">${esc(v||'未填写')}</div></section>`).join('')}`;
  showModal(esc(item.title),body+(item.taskId?`<p class="related-task">关联事项：<a href="#detail/${encodeURIComponent(item.taskId)}" data-close>${esc(taskName(item.taskId))}</a></p>`:''),`<button class="button secondary" data-action="close">关闭</button><button class="button primary" data-action="edit" data-collection="${collection}" data-id="${esc(id)}">${icon('edit')}直接编辑</button>`,true);
}
function documentEditor(item) {
  const mode = innerWidth < 900 ? 'edit' : 'split';
  const tools = [['heading','H1','标题'],['bold','B','粗体'],['italic','I','斜体'],['list','≡','列表'],['quote','❝','引用'],['code','</>','代码块'],['table','▦','表格'],['link','↗','链接']];
  return `<section class="document-editor field full"><input type="hidden" name="format" value="markdown"><input type="hidden" name="sourceName" value="${esc(item.sourceName||'')}"><div class="editor-toolbar"><div class="document-actions">${tools.map(([tool,text,title])=>`<button type="button" class="editor-tool" data-action="editor-insert" data-tool="${tool}" title="${title}" aria-label="插入${title}">${esc(text)}</button>`).join('')}<button type="button" class="editor-tool" data-action="editor-images">添加图片</button><input id="editor-images" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden></div><div class="editor-modes" role="group" aria-label="编辑视图">${[['edit','编辑'],['split','分屏'],['preview','预览']].map(([value,label])=>`<button type="button" class="${mode===value?'active':''}" data-action="editor-mode" data-mode="${value}" aria-pressed="${mode===value}">${label}</button>`).join('')}</div></div><div class="editor-workspace" data-mode="${mode}"><div class="editor-source"><label for="document-body">Markdown 源码</label><textarea id="document-body" name="body" rows="18" spellcheck="false" placeholder="# 我的文档\n\n从这里开始记录……">${esc(item.body||'')}</textarea></div><section class="editor-preview" aria-label="Markdown 预览"><div id="document-preview" class="markdown-body"></div></section></div><p class="hint">支持标题、列表、表格、代码块和图片。Ctrl / ⌘ + S 保存；原始 HTML、数学公式与 Mermaid 暂按源码显示。</p></section>`;
}
function updateDocumentPreview() {
  const input=$('#document-body'), preview=$('#document-preview');
  if(input&&preview)preview.innerHTML=input.value?renderMarkdown(input.value):'<p class="document-empty">开始写作，预览会在这里更新。</p>';
}
function insertMarkdown(tool) {
  const input=$('#document-body');if(!input)return;
  const selected=input.value.slice(input.selectionStart,input.selectionEnd);
  const snippets={heading:`\n# ${selected||'标题'}\n`,bold:`**${selected||'粗体文字'}**`,italic:`*${selected||'斜体文字'}*`,list:`\n- ${selected||'列表项目'}\n`,quote:`\n> ${selected||'引用内容'}\n`,code:'\n```text\n'+(selected||'代码内容')+'\n```\n',table:'\n| 项目 | 说明 |\n| --- | --- |\n| 内容 | 内容 |\n',link:`[${selected||'链接文字'}](https://example.com)`};
  const mode=$('.editor-workspace').dataset.mode;if(mode==='preview')setEditorMode('edit');
  input.setRangeText(snippets[tool]||'',input.selectionStart,input.selectionEnd,'end');
  input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();
}
function setEditorMode(mode) {
  const workspace=$('.editor-workspace');if(!workspace||!['edit','split','preview'].includes(mode))return;
  workspace.dataset.mode=mode;
  $$('.editor-modes button').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
  updateDocumentPreview();
}
function $$(s,root=document){return [...root.querySelectorAll(s)];}
function canDiscardDocument() { if(!noteDirty)return true;if(!confirm('当前内容尚未保存，确定放弃这些修改？'))return false;noteDirty=false;return true; }
async function readImages(files) {
  const selected=[...files];
  if(selected.reduce((sum,f)=>sum+f.size,0)>20*1024*1024)throw new Error('本次正文图片总大小超过 20 MB，请压缩后再导入。');
  return Promise.all(selected.map(async file=>{
    const bytes=new Uint8Array(await file.arrayBuffer());
    const type=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':String.fromCharCode(...bytes.slice(0,3))==='GIF'?'image/gif':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':'';
    if(!type)throw new Error(`「${file.name}」不是支持的 PNG / JPEG / GIF / WebP 图片。`);
    const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error(`无法读取图片：${file.name}`));reader.readAsDataURL(new Blob([bytes],{type}));});
    return {name:file.name,path:file.webkitRelativePath||file.name,dataUrl};
  }));
}
function startDocumentUpload(defaultCategory='其他',returnPage='notes') {
  documentUploadReturn=returnPage;
  documentDrafts=[];documentSelectedFiles=[];documentImageFiles=[];documentImportGeneration++;
  showModal('上传文档',`<div class="document-import"><p class="muted">支持 Typora 的 Markdown、PDF、文本和图片。文件存入本机文件夹，点击卡片后在独立标签页查看。</p><label class="upload-zone field">文档或图片（可多选）<input id="document-files" type="file" multiple></label><div class="form-grid"><label class="field">可选：Markdown 中的本地图片<input id="document-assets" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple></label><label class="field">或选择整个文档文件夹<input id="document-folder" type="file" webkitdirectory multiple></label>${selectField('统一分类','document-category',opts(noteCategories,defaultCategory))}${selectField('关联事项','document-task',taskOptions())}</div><p class="hint">Markdown 可直接编辑；PDF、文本和图片保留原文件。其他格式可以保存和下载。每篇 Markdown 不超过 2 MB，其他单文件不超过 50 MB，正文图片总计不超过 20 MB。文件夹中的图片会用于补齐 Markdown 引用。</p><div id="document-upload-preview" class="document-list"></div><p class="form-error" id="form-error" role="alert"></p></div>`,`<button class="button secondary" data-action="close">取消</button><button class="button primary" data-action="confirm-documents" disabled>导入文档</button>`,true);
}
async function prepareDocuments(files,images=documentImageFiles) {
  const generation=++documentImportGeneration,button=$('[data-action="confirm-documents"]'),preview=$('#document-upload-preview');
  button.disabled=true;documentDrafts=[];preview.textContent='正在读取文档……';$('#form-error').textContent='';
  try {
    const chosen=[...files];
    if(!chosen.length)throw new Error('请先选择文档或图片。');
    if(chosen.length>50)throw new Error('一次最多导入 50 篇文档，请分批选择。');
    if(chosen.some(f=>/\.(md|markdown)$/i.test(f.name)&&f.size>2*1024*1024))throw new Error('单篇 Markdown 超过 2 MB，请拆分后导入。');
    if(chosen.some(f=>f.size>50*1024*1024))throw new Error('单个文件超过 50 MB，请拆分后导入。');
    const assets=await readImages(images);
    const drafts=await Promise.all(chosen.map(async file=>{
      if(!/\.(md|markdown)$/i.test(file.name))return {title:file.name.slice(0,180),sourceName:file.name,file,body:'',binary:true,missing:[],embedded:[]};
      const original=await file.text();
      // Preserve source bytes as text; only local image destinations are embedded.
      const result=embedLocalImages(original,assets);
      return {title:documentTitle(original,file.name).slice(0,180),sourceName:file.name,original,file,...result};
    }));
    if(generation!==documentImportGeneration||!$('#document-upload-preview'))return;
    documentDrafts=drafts;documentImageFiles=[...images];
    preview.innerHTML=drafts.map((d,i)=>`<div class="document-row"><label class="field">文档标题<input data-document-index="${i}" value="${esc(d.title)}" maxlength="180" aria-label="${esc(d.sourceName)}的标题"></label><div class="file-summary">${esc(d.sourceName)} · ${d.binary?`${(d.file.size/1024).toFixed(1)} KB · 保存原文件`:`${d.embedded.length} 张本地图片已关联`}</div>${d.missing.length?`<p class="import-notice">未找到图片：${d.missing.map(esc).join('、')}。可补选图片，或导入后在编辑器添加。</p>`:''}</div>`).join('');
    button.disabled=false;
  }catch(e){if(generation===documentImportGeneration&&$('#document-upload-preview')){preview.textContent='';$('#form-error').textContent=e.message;button.disabled=true;}}
}
async function importDocuments() {
  if(!documentDrafts.length)throw new Error('请先选择有效文档。');
  const drafts=documentDrafts.map((d,i)=>({...d,title:$(`[data-document-index="${i}"]`).value.trim()}));
  if(drafts.some(d=>!d.title))throw new Error('请为每篇文档填写标题。');
  const category=$('[name="document-category"]').value,taskId=$('[name="document-task"]').value;let count=0;
  // Keep uploaded metadata in the draft if saving fails, so a retry reuses the same files.
  await withBusy(async()=>{
    for(const d of drafts)if(d.binary){const original=documentDrafts.find(x=>x.file===d.file);d.attachment=original.attachment || await uploadFile(d.file);original.attachment=d.attachment;}
  });
  await commit(next=>{const now=new Date().toISOString();for(const d of drafts){if(next.notes.some(n=>n.title===d.title&&(d.binary?n.attachment?.id===d.attachment.id:!n.attachment&&n.body===d.body)))continue;next.notes.push({id:createId(),title:d.title,category,taskId,body:d.body,format:d.binary?'text':'markdown',...(d.attachment?{attachment:d.attachment}:{}),sourceName:d.sourceName,tags:[],pinned:false,createdAt:now,updatedAt:now});count++;}if(!count)throw new Error('这些文档已存在，没有重复导入。');},'导入了文档');
  documentDrafts=[];documentImageFiles=[];modal.close();location.hash=documentUploadReturn;toast(`已导入 ${count} 篇文档`);
}
function startImport() {
  importCandidates=[]; importDraft=''; importFileFormat='';
  showModal('导入工作链接',`<p class="muted">粘贴多个链接，每行一个；也支持「标题 + 链接」和 Markdown 链接。</p><label class="field">链接内容<textarea id="import-text" rows="7" placeholder="评审入口 https://你的评审地址\n[环境说明](https://你的文档地址)"></textarea></label><div class="form-grid">${selectField('统一分类','import-category',opts(categories,'未分类'))}${selectField('关联事项','import-task',taskOptions())}<label class="field full">或选择文件（书签 HTML / CSV / TXT）<input id="import-file" type="file" accept=".html,.htm,.csv,.txt,text/plain,text/csv,text/html"></label></div><p class="hint">导入前会预览并检查重复链接。只保存链接与备注，不读取登录页面内容。</p><div id="import-preview"></div><p id="form-error" class="form-error" role="alert"></p>`,`<button class="button secondary" data-action="close">取消</button><button class="button secondary" data-action="preview-import">预览链接</button><button class="button primary" data-action="confirm-import" disabled>确认导入</button>`,true);
}
function previewImport() {
  const text = $('#import-text').value;
  const header = text.trim().split(/\r?\n/)[0];
  const format = importFileFormat || (/^\s*</.test(text)?'html':/(?:^|,)\s*"?(?:url|链接|网址)"?\s*(?=,|$)/i.test(header) && header.includes(',')?'csv':'text');
  const parsed = parseLinks(text,format); const seen = new Set(data.links.map(l=>normalizeUrl(l.url))); let duplicate=0;
  importCandidates = parsed.links.filter(l=>{const url=normalizeUrl(l.url); if(seen.has(url)){duplicate++;return false;} seen.add(url);return true;});
  importDraft=text;
  $('#import-preview').innerHTML=`<div class="import-preview"><h3>可导入 ${importCandidates.length} 条 · 跳过重复 ${duplicate} 条</h3>${importCandidates.length?`<div class="table-scroll"><table><thead><tr><th>标题</th><th>地址</th></tr></thead><tbody>${importCandidates.map(l=>`<tr><td>${esc(l.title)}</td><td>${esc(l.url)}</td></tr>`).join('')}</tbody></table></div>`:''}${parsed.errors.length?`<div class="error-list">${parsed.errors.map(e=>`<p>第 ${esc(e.line)} 行：${esc(e.message)}</p>`).join('')}</div>`:''}</div>`;
  $('[data-action="confirm-import"]',modal).disabled=!importCandidates.length;
}
async function confirmImport() {
  if($('#import-text').value!==importDraft) { previewImport(); throw new Error('内容已变化，请检查更新后的预览，再确认导入。'); }
  const cat=$('[name="import-category"]').value, taskId=$('[name="import-task"]').value;
  let count=0;
  await commit(next=>{const seen=new Set(next.links.map(l=>normalizeUrl(l.url)));const now=new Date().toISOString();for(const l of importCandidates){if(seen.has(l.url))continue;seen.add(l.url);next.links.push({id:createId(),title:l.title||new URL(l.url).hostname,url:l.url,category:cat==='未分类'?(l.category||cat):cat,description:l.description||'',tags:[],taskId,pinned:false,createdAt:now,updatedAt:now});count++;}},`导入了 ${importCandidates.length} 个工作链接`);
  modal.close(); location.hash='links'; toast(`已导入 ${count} 个链接`);
}
function download(filename,text,type='application/json') { const url=URL.createObjectURL(new Blob([text],{type})); const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000); }
async function exportData() { const backup=await withBusy(()=>readBackup());download(`工作间备份-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(backup,null,2));toast('包含原文件的完整备份已开始下载'); }
async function restoreBackup(mode) {
  if(!restoreCandidate)throw new Error('请先选择有效备份');
  acceptState(await withBusy(()=>restoreWorkspace(restoreCandidate,mode,revision)));
  restoreCandidate=null;modal.close();render();toast(mode==='merge'?'已合并备份到本机':'已恢复备份到本机');
}
function askDelete(collection,id) {
  const item=data[collection].find(x=>x.id===id);if(!item)return;
  showModal(`删除${kinds[collection]}`,`<p>确定删除「${esc(item.title)}」？</p><p class="muted">${collection==='tasks'?'关联资料会保留，只解除关联。':'此操作无法撤销，重要内容可以先导出备份。'}</p>`,`<button class="button secondary" data-action="close">取消</button><button class="button danger" data-action="confirm-delete" data-collection="${collection}" data-id="${esc(id)}">确定删除</button>`);
}
function quickCommands() {
  return `<section class="search-group"><h3>快速开始</h3>${[['new','tasks','新建工作事项','记录目标与下一步','plus'],['new','notes','新建文档','把新的思路留在本机','note'],['navigate','archives','打开工作档案','每日摘要、历史总结与个人档案','folder'],['navigate','tasks','查看工作事项','继续推进，或调整顺序与状态','task'],['navigate','settings','打开数据与设置','主题、完整备份与恢复','settings']].map(([action,target,title,desc,ico])=>`<button class="search-result" data-action="${action}" ${action==='new'?`data-collection="${target}"`:`data-page="${target}"`}>${icon(ico)}<span><strong>${title}</strong><small>${desc}</small></span>${icon('arrow')}</button>`).join('')}</section>`;
}
function selectCommand(index=0) {
  const items=$$('.search-result',$('#search-results'));commandIndex=items.length?(index+items.length)%items.length:-1;
  items.forEach((item,i)=>item.classList.toggle('command-selected',i===commandIndex));
  const current=items[commandIndex];current?.scrollIntoView({block:'nearest'});
  if($('#command-status'))$('#command-status').textContent=current?.querySelector('strong')?.textContent||'没有匹配的结果';
}
function searchModal() {
  showModal('搜索与快速操作',`<label class="command-input">${icon('search')}<input id="global-search" type="search" aria-label="搜索内容" aria-describedby="command-help" placeholder="搜索事项、文档，或直接开始行动…" autocomplete="off"><kbd>ESC</kbd></label><div class="search-results" id="search-results">${quickCommands()}</div><div class="command-help" id="command-help"><span><kbd>↑</kbd> <kbd>↓</kbd> 选择</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span><span>你的整个工作空间</span></div><div id="command-status" class="visually-hidden" aria-live="polite"></div>`,'',true);
  modal.classList.add('command-modal');$('#global-search').focus();selectCommand();
}
function searchAll(value) {
  const q=value.trim().toLowerCase(); let total=0;
  if(!q){$('#search-results').innerHTML=quickCommands();return;}
  $('#search-results').innerHTML=!q?'<p class="muted">输入关键词开始搜索。</p>':['tasks','links','notes'].map(k=>{const found=data[k].filter(x=>[x.title,x.url,x.summary,x.nextStep,x.description,x.body,...(x.tags||[])].join(' ').toLowerCase().includes(q));total+=found.length;return found.length?`<section class="search-group"><h3>${labels[k]} · ${found.length}</h3>${found.slice(0,25).map(x=>`<button class="search-result" data-action="search-open" data-collection="${k}" data-id="${esc(x.id)}">${icon(k==='links'?'link':k==='tasks'?'task':'note')}<span><strong>${esc(x.title)}</strong><small>${esc((x.description||x.summary||x.body||x.url||'').slice(0,90))}</small></span>${icon('arrow')}</button>`).join('')}</section>`:'';}).join('') || empty('没有找到相关内容','试试其他关键词。');
}
function appendPersonalSearch(value) {
  const q=value.trim().toLowerCase();if(!q)return;
  const personal=personalData(data);
  for(const [key,label,action] of [['entries','个人档案','personal-edit'],['journals','每日记录','journal-edit']]) {
    const found=personal[key].filter(item=>JSON.stringify(item).toLowerCase().includes(q));if(!found.length)continue;
    $('#search-results .empty-state')?.remove();
    $('#search-results').insertAdjacentHTML('beforeend',`<section class="search-group"><h3>${label} · ${found.length}</h3>${found.slice(0,25).map(item=>`<button class="search-result" data-action="${action}" data-id="${esc(item.id)}">${icon('note')}<span><strong>${esc(item.title)}</strong><small>${esc((item.body||item.work||item.learning||'').slice(0,90))}</small></span></button>`).join('')}</section>`);
  }
  const summaries=(data.dailyArchives||[]).filter(item=>item.date<dayKey()&&[item.title,item.body].join(' ').toLowerCase().includes(q));
  if(summaries.length){$('#search-results .empty-state')?.remove();$('#search-results').insertAdjacentHTML('beforeend',`<section class="search-group"><h3>每日摘要 · ${summaries.length}</h3>${summaries.slice(0,25).map(item=>`<a class="search-result" href="./daily-archive.html?date=${encodeURIComponent(item.date)}" target="_blank" rel="noopener noreferrer">${icon('note')}<span><strong>${esc(item.title)}</strong><small>${esc(item.body.slice(0,90))}</small></span></a>`).join('')}</section>`);}
  const documents=(data.archiveDocuments||[]).filter(item=>[item.title,item.body].join(' ').toLowerCase().includes(q));
  if(documents.length){$('#search-results .empty-state')?.remove();$('#search-results').insertAdjacentHTML('beforeend',`<section class="search-group"><h3>档案文档 · ${documents.length}</h3>${documents.map(item=>`<a class="search-result" href="./daily-archive.html?archive=${encodeURIComponent(item.id)}" target="_blank" rel="noopener noreferrer">${icon('note')}<span><strong>${esc(item.title)}</strong><small>${esc(item.body.slice(0,90))}</small></span></a>`).join('')}</section>`);}
}
function formError(e) {
  const target=$('#form-error');if(target)target.textContent=e.message;else toast(e.message,true);
  if(e.status===409&&!$('#reload-conflict',modal)){
    const parent=target||$('#content');const button=document.createElement('button');button.id='reload-conflict';button.type='button';button.className='button secondary small';button.textContent='重新载入';button.dataset.action='reload-conflict';parent.append(button);
  }
}
document.addEventListener('submit',async event=>{
  if(event.target.id==='task-links-form') {
    event.preventDefault();const form=event.target,ids=new FormData(form).getAll('taskLinkIds');
    try{await commit(next=>setTaskLinks(next,form.dataset.id,ids),'更新了工作事项关联的链接');noteDirty=false;modal.close();toast('链接关联已保存到本机');}catch(e){formError(e);}return;
  }
  if(['personal-entry-form','personal-journal-form','archive-filter-form'].includes(event.target.id)){event.preventDefault();try{await personalUI.submit(event.target);}catch(e){formError(e);}return;}
  if(!['editor-form','settings-form'].includes(event.target.id))return;event.preventDefault();
  try {
    const f=event.target, fd=new FormData(f);
    if(f.id==='settings-form'){const name=String(fd.get('name')).trim();if(!name)throw new Error('请输入名称');await commit(next=>next.settings.name=name,'更新了工作台名称');toast('名称已保存到本机');return;}
    const collection=f.dataset.collection,id=f.dataset.id, now=new Date().toISOString();
    const selectedLinks=fd.getAll('taskLinkIds');
    const fields=Object.fromEntries([...fd].filter(([k])=>k!=='taskLinkIds').map(([k,v])=>[k,collection==='notes'&&k==='body'?String(v):String(v).trim()]));if(!fields.title)throw new Error('请填写标题');
    if(collection!=='records'){fields.tags=(fields.tags||'').split(/[,，]/).map(s=>s.trim()).filter(Boolean);fields.pinned=fd.has('pinned');}
    if(collection==='links')fields.url=normalizeUrl(fields.url);
    await commit(next=>{if(collection==='links'&&next.links.some(l=>l.id!==id&&normalizeUrl(l.url)===fields.url))throw new Error('该链接已经存在，可在链接库中编辑。'); const index=next[collection].findIndex(x=>x.id===id);if(id&&index<0)throw new Error('内容已被其他窗口删除，请重新打开。');const value={...(index>=0?next[collection][index]:{id:createId(),createdAt:now}),...fields,updatedAt:now};if(index>=0)next[collection][index]=value;else if(collection==='tasks')next.tasks.unshift(value);else next[collection].push(value);if(collection==='tasks')setTaskLinks(next,value.id,selectedLinks);},`${id?'更新':'添加'}${kinds[collection]}：${fields.title}`);
    noteDirty=false;modal.close();toast('已保存到本机');
  }catch(e){formError(e);}
});
document.addEventListener('click',async event=>{
  const close=event.target.closest('[data-close]');if(close)modal.close();
  const tracked=event.target.closest('[data-track]');if(tracked){try{const l=data.links.find(x=>x.id===tracked.dataset.track);if(l)await commit(()=>{},`打开链接：${l.title}`);}catch(e){toast(e.message,true);}}
  const el=event.target.closest('[data-action]');if(!el)return;
  const {action,collection,id}=el.dataset;
  try {
    if(await personalUI.action(el))return;
    if(noteDirty&&['close','search','new','new-note','edit','view','upload-documents','delete'].includes(action)&&!canDiscardDocument())return;
    if(action==='menu')document.body.classList.toggle('menu-open');
    if(action==='sidebar-toggle') {
      const collapsed=document.body.classList.toggle('sidebar-collapsed');
      el.setAttribute('aria-expanded',String(!collapsed));el.setAttribute('aria-label',collapsed?'展开侧栏':'收起侧栏');el.title=el.getAttribute('aria-label');
    }
    if(action==='theme-toggle'){await commit(next=>{next.settings.theme=next.settings.theme==='dark'?'light':'dark';});toast(data.settings.theme==='dark'?'已切换到深色主题':'已切换到浅色主题');return;}
    if(action==='navigate'){modal.close();location.hash=el.dataset.page;}
    if(action==='settings')location.hash='settings';
    if(action==='reload-data')await reloadWorkspace();
    if(action==='retry-connect')await initialize();
    if(action==='reload-conflict'){if(!canDiscardDocument())return;modal.close();await reloadWorkspace();}
    if(action==='close')modal.close();
    if(action==='search')searchModal();
    if(action==='new')editForm(collection,'',{taskId:el.dataset.taskId||''});
    if(action==='new-task')editForm('tasks');
    if(action==='task-links'){if(canDiscardDocument())chooseTaskLinks(id);}
    if(action==='new-note')editForm('notes');
    if(action==='edit')editForm(collection,id);
    if(action==='view')viewItem(collection,id);
    if(action==='upload-documents')startDocumentUpload();
    if(action==='confirm-documents')await importDocuments();
    if(action==='editor-mode')setEditorMode(el.dataset.mode);
    if(action==='editor-insert')insertMarkdown(el.dataset.tool);
    if(action==='editor-images')$('#editor-images').click();
    if(action==='add-entry')editForm('links','',{title:el.dataset.title,category:el.dataset.category});
    if(action==='pin'){await commit(next=>{const items=next[collection],index=items.findIndex(x=>x.id===id),item=items[index];if(!item)throw new Error('内容已不存在');item.pinned=!item.pinned;item.updatedAt=new Date().toISOString();if(collection==='tasks'&&item.pinned){items.splice(index,1);items.unshift(item);}},'调整了置顶内容');toast('已更新置顶');}
    if(action==='filter'){filter=el.dataset.value;render();}
    if(action==='continue'){const t=sortedTasks(data.tasks.filter(t=>!['已完成','资料归档'].includes(t.status)))[0];if(t)location.hash=`detail/${encodeURIComponent(t.id)}`;}
    if(action==='import')startImport();
    if(action==='preview-import')previewImport();
    if(action==='confirm-import')await confirmImport();
    if(action==='export')await exportData();
    if(action==='raw-export'){download('工作间旧浏览器数据.json',localStorage.getItem(STORAGE_KEY)||'','application/json');}
    if(action==='delete')askDelete(collection,id);
    if(action==='confirm-delete'){await commit(next=>{next[collection]=next[collection].filter(x=>x.id!==id);if(collection==='links')removeTaskLink(next,id);if(collection==='tasks')for(const k of ['links','notes','records'])for(const x of next[k])if(x.taskId===id)x.taskId='';},`删除了一个${kinds[collection]}`);modal.close();if(route().page==='detail'&&collection==='tasks')location.hash='tasks';toast('已删除');}
    if(action==='search-open'){if(collection==='tasks'){modal.close();location.hash=`detail/${encodeURIComponent(id)}`;}else if(collection==='links'){const l=data.links.find(x=>x.id===id);window.open(l.url,'_blank','noopener,noreferrer');}else viewItem(collection,id);}
    if(action==='merge-backup')await restoreBackup('merge');
    if(action==='replace-backup'){if(!restoreCandidate)throw new Error('请先选择有效备份');showModal('用备份替换当前数据',`<p>本机工作台中的数据将被所选备份替换。</p><p class="muted">替换前会自动在本机保存恢复副本；也可以先下载完整备份。</p>`,`<button class="button secondary" data-action="close">取消</button><button class="button danger" data-action="confirm-replace">确认替换</button>`);}
    if(action==='confirm-replace')await restoreBackup('replace');
  }catch(e){formError(e);}
});
let taskDrag = null;
function taskOrderFromGrid(grid) { return [...grid.querySelectorAll('[data-task-id]')].map(card=>card.dataset.taskId); }
async function saveTaskOrder(grid) {
  const ids=taskOrderFromGrid(grid), before=filtered(data.tasks,'status').map(task=>task.id);
  if(ids.every((id,index)=>id===before[index]))return;
  await commit(next=>{next.tasks=reorderVisibleTasks(next.tasks,ids);},'调整了工作事项顺序');
  toast('事项顺序已保存到本机');
}
document.addEventListener('pointerdown',event=>{
  const handle=event.target.closest('[data-task-drag]');
  if(!handle||busy||event.button!==0)return;
  const card=handle.closest('[data-task-id]'),grid=card?.parentElement;
  if(!grid||grid.id!=='sortable-tasks')return;
  taskDrag={handle,card,grid,pointerId:event.pointerId,x:event.clientX,y:event.clientY,started:false};
  handle.setPointerCapture(event.pointerId);
});
document.addEventListener('pointermove',event=>{
  const drag=taskDrag;if(!drag||event.pointerId!==drag.pointerId)return;
  if(!drag.started&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<5)return;
  drag.started=true;drag.card.classList.add('task-dragging');
  const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-task-id]');
  if(!target||target===drag.card||target.parentElement!==drag.grid)return;
  const cards=[...drag.grid.querySelectorAll('[data-task-id]')];
  drag.grid.insertBefore(drag.card,cards.indexOf(drag.card)<cards.indexOf(target)?target.nextSibling:target);
});
document.addEventListener('pointerup',async event=>{
  const drag=taskDrag;if(!drag||event.pointerId!==drag.pointerId)return;
  taskDrag=null;drag.card.classList.remove('task-dragging');
  if(drag.started)try{await saveTaskOrder(drag.grid);}catch(error){render();toast(error.message,true);}
});
document.addEventListener('pointercancel',()=>{if(taskDrag){taskDrag=null;render();}});
document.addEventListener('keydown',async event=>{
  const handle=event.target.closest('[data-task-drag]');
  if(!handle||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();
  const grid=handle.closest('#sortable-tasks'),cards=[...grid.querySelectorAll('[data-task-id]')];
  const card=handle.closest('[data-task-id]'),index=cards.indexOf(card),step=['ArrowUp','ArrowLeft'].includes(event.key)?-1:1;
  const target=cards[index+step];if(!target)return;
  grid.insertBefore(card,step<0?target:target.nextSibling);
  const id=card.dataset.taskId;
  try{await saveTaskOrder(grid);document.querySelector(`[data-task-drag="${CSS.escape(id)}"]`)?.focus();}catch(error){render();toast(error.message,true);}
});
document.addEventListener('input',event=>{
  if(event.target.closest('#task-links-form input[type="checkbox"]'))noteDirty=true;
  if(event.target.id==='task-link-search') {
    const value=event.target.value.trim().toLowerCase();let visible=0;
    for(const row of $$('[data-link-choice]',modal)){row.hidden=!row.textContent.toLowerCase().includes(value);if(!row.hidden)visible++;}
    $('#task-link-empty').hidden=visible>0;
  }
  if(event.target.closest('#personal-entry-form,#personal-journal-form'))noteDirty=true;
  if(event.target.closest('#editor-form[data-collection="notes"]'))noteDirty=true;
  if(event.target.id==='document-body'){clearTimeout(previewTimer);previewTimer=setTimeout(updateDocumentPreview,150);}
  if(event.target.id==='global-search'){searchAll(event.target.value);appendPersonalSearch(event.target.value);selectCommand();}
  if(event.target.id==='import-text'){importFileFormat='';const b=$('[data-action="confirm-import"]',modal);if(b)b.disabled=true;}
  if(event.target.id==='list-search'){const start=event.target.selectionStart;query=event.target.value;render();const input=$('#list-search');input.focus();try{input.setSelectionRange(start,start);}catch{}}
});
document.addEventListener('change',async event=>{
  if(event.target.closest('#task-links-form input[type="checkbox"]'))noteDirty=true;
  try {
    if(event.target.id==='document-files'){documentSelectedFiles=[...event.target.files];await prepareDocuments(documentSelectedFiles);}
    if(event.target.id==='document-assets'){documentImageFiles=[...event.target.files];if(documentSelectedFiles.length)await prepareDocuments(documentSelectedFiles);}
    if(event.target.id==='document-folder'){const files=[...event.target.files];documentSelectedFiles=files.filter(f=>/\.(md|markdown|pdf|txt|log|csv|json|xml|yaml|yml|ini|py|js|ts|cpp|h|c|sh)$/i.test(f.name));documentImageFiles=files.filter(f=>/\.(png|jpe?g|gif|webp)$/i.test(f.name));await prepareDocuments(documentSelectedFiles);}
    if(event.target.id==='editor-images'){
      const input=$('#document-body'),assets=await readImages(event.target.files);if(!input?.isConnected)return;
      if(!assets.length)return;
      const start=input.selectionStart,end=input.selectionEnd,usedAssets=new Set(),resolved=embedLocalImages(input.value,assets,asset=>usedAssets.add(asset));input.value=resolved.body;
      const extra=assets.filter(a=>!usedAssets.has(a));
      if(extra.length){const addition=extra.map(a=>`![${a.name.replace(/[\[\]]/g,'')}](${a.dataUrl})`).join('\n');const from=resolved.embedded.length?input.value.length:start,to=resolved.embedded.length?input.value.length:end;input.setRangeText('\n'+addition+'\n',from,to,'end');}
      input.dispatchEvent(new Event('input',{bubbles:true}));updateDocumentPreview();event.target.value='';toast(resolved.embedded.length?'已补齐正文中的本地图片':'图片已加入正文');
    }
    if(event.target.id==='detail-status'||event.target.matches('[data-task-status]')) {
      const control=event.target,id=control.dataset.taskStatus||control.dataset.id,value=control.value;
      const previous=data.tasks.find(task=>task.id===id)?.status;
      if(value!==previous)try {
        if(!statuses.includes(value))throw new Error('工作状态无效');
        await commit(next=>{const task=next.tasks.find(task=>task.id===id);if(!task)throw new Error('事项已不存在');task.status=value;task.updatedAt=new Date().toISOString();},`事项状态更新为：${value}`);
        toast('状态已保存到本机');
      } catch(error) { if(control.isConnected)control.value=previous||'';throw error; }
    }
    if(event.target.id==='import-file'){const file=event.target.files[0];if(!file)return;if(file.size>5*1024*1024)throw new Error('文件超过 5 MB，请分批导入');importFileFormat=/\.csv$/i.test(file.name)?'csv':/\.html?$/i.test(file.name)?'html':'text';$('#import-text').value=await file.text();previewImport();}
    if(event.target.id==='backup-file'){restoreCandidate=null;const file=event.target.files[0];if(!file)return;if(file.size>256*1024*1024)throw new Error('备份文件超过 256 MB，请改为复制本机数据文件夹');const parsed=JSON.parse(await file.text());restoreCandidate={...validateBackup(parsed),files:parsed.files||[]};if(!Array.isArray(restoreCandidate.files))throw new Error('备份 files 必须为数组');$('#restore-preview').innerHTML=`<div class="callout"><p>${restoreCandidate.tasks.length} 个事项 · ${restoreCandidate.links.length} 个链接 · ${restoreCandidate.notes.length} 篇文档 · ${restoreCandidate.files.length} 个原文件</p></div><div class="header-actions"><button class="button primary" data-action="merge-backup" ${loadError?'disabled':''}>合并，保留现有内容</button><button class="button secondary" data-action="replace-backup">用备份替换</button></div>`;}
  }catch(e){if(event.target.id==='backup-file'){$('#restore-preview').textContent='备份无效：'+e.message;restoreCandidate=null;}else formError(e);}
});
document.addEventListener('keydown',event=>{
  if(modal.open&&modal.classList.contains('command-modal')&&event.target.id==='global-search') {
    if(event.key==='Escape'){event.preventDefault();modal.close();return;}
    if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();selectCommand(commandIndex+(event.key==='ArrowDown'?1:-1));return;}
    if(event.key==='Enter'){event.preventDefault();$$('.search-result',$('#search-results'))[commandIndex]?.click();return;}
  }
  if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!modal.open&&!busy&&!event.target.closest('input,textarea,select,[contenteditable="true"]')){event.preventDefault();if(canDiscardDocument())searchModal();return;}
  if(!(event.ctrlKey||event.metaKey))return;
  const key=event.key.toLowerCase(),form=$('#editor-form[data-collection="notes"]');
  const personalForm=$('#personal-entry-form,#personal-journal-form');
  if(personalForm&&key==='s'){event.preventDefault();personalForm.requestSubmit();return;}
  if(key==='k'){event.preventDefault();if(canDiscardDocument())searchModal();}
  if(form&&key==='s'){event.preventDefault();form.requestSubmit();}
  if(form&&event.target.id==='document-body'&&['b','i'].includes(key)){event.preventDefault();insertMarkdown(key==='b'?'bold':'italic');}
});
modal.addEventListener('cancel',event=>{if(busy||!canDiscardDocument())event.preventDefault();});
modal.addEventListener('close',()=>{noteDirty=false;clearTimeout(previewTimer);documentImportGeneration++;});
function openEditRoute() {
  const {page,id}=route();
  if(page!=='notes'||!id.startsWith('edit/')||loadError)return;
  if(!canDiscardDocument())return;
  const noteId=id.slice(5);
  if(data.notes.some(note=>note.id===noteId))editForm('notes',noteId);
  else toast('文档已不存在，请返回知识库重新选择',true);
  history.replaceState(null,'','#notes');
}
window.addEventListener('beforeunload',event=>{if(noteDirty||busy){event.preventDefault();event.returnValue='';}});
window.addEventListener('hashchange',()=>{filter='';query='';document.body.classList.remove('menu-open');render();openEditRoute();window.scrollTo(0,0);if(['archives','profile','journal','portable'].includes(route().page))void reloadWorkspace(true);});
window.addEventListener('focus',()=>{if(!modal.open)void reloadWorkspace(true);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void reloadWorkspace(true);});
setInterval(()=>{if(document.visibilityState==='visible')void reloadWorkspace(true);},60000);
$('#content').textContent='正在读取本机工作台……';
installSpotlight();
await initialize();

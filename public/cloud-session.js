import { cloudConfig } from './cloud-config.js';
import { GithubWorkspace } from './github-workspace.js?v=perf-20261018';
import { createDeviceSession } from './device-session.js';

export const cloudMode = cloudConfig.enabled === true;
let connection, connecting, credentials;
let remembered = false, deviceMessage = '';
let readerState, inheritedSession;
let hasPendingSync=()=>false;
export function setPendingSyncCheck(check){hasPendingSync=check;}
const pendingReaders = new Map();
const trustedReaders = new Set();
const appRoot = new URL('./',import.meta.url);
const deviceSession = createDeviceSession(appRoot);
const sessionChannel = cloudMode && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('work-hub-signout:'+appRoot.pathname) : null;
if(sessionChannel)sessionChannel.onmessage=event=>{if(event.data?.type==='signout'){
  connection=credentials=undefined;
  if(hasPendingSync()){deviceMessage='其他页面已退出连接，未同步草稿仍保留在当前页面。';window.dispatchEvent(new Event('work-hub-session-ended'));refreshConnectionPanel();}
  else location.replace(appRoot.href);
}};

export function cloudConnectionPanel() {
  if (!cloudMode) return '';
  return `<section class="panel cloud-device-panel"><div><div class="eyebrow">THIS DEVICE</div><h2>此设备自动连接</h2><p class="hint" data-device-status></p><p class="hint">仅在此设备加密保存连接凭据；工作资料继续保存在私有仓库。</p></div><div class="cloud-device-actions"><button class="button secondary" type="button" data-cloud-session="remember" ${remembered?'hidden':''}>记住此设备</button><button class="button secondary" type="button" data-cloud-session="logout">退出并清除此设备</button></div></section>`;
}

export function refreshConnectionPanel() {
  for(const status of document.querySelectorAll('[data-device-status]'))status.textContent=deviceMessage || (remembered?'已记住此设备，下次打开会自动连接。':'当前仅本次连接，重新打开后需要填写密钥。');
  for(const button of document.querySelectorAll('[data-cloud-session="remember"]'))button.hidden=remembered;
}

async function connect(value) {
  const workspace=new GithubWorkspace(value);
  await workspace.state();
  return workspace;
}

export function rememberReaderState(state) {
  if(cloudMode && state?.data && typeof state.revision==='string')readerState=structuredClone(state);
}
function previewFor(url) {
  if(!readerState)return null;
  const {data,...meta}=readerState;
  const note=url.pathname.endsWith('/document.html')&&data.notes.find(n=>n.id===url.searchParams.get('id'));
  const archive=url.searchParams.get('archive'),date=url.searchParams.get('date');
  const document=url.pathname.endsWith('/daily-archive.html')&&(archive?data.archiveDocuments?.find(n=>n.id===archive):data.dailyArchives?.find(n=>n.date===date));
  if(!note&&!document)return readerState.pendingSync?{...meta,data:{settings:data.settings,notes:[],tasks:[],archiveDocuments:[],dailyArchives:[]}}:null;
  return {...meta,data:{settings:data.settings,notes:note?[note]:[],tasks:note?data.tasks.filter(t=>t.id===note.taskId).map(t=>({id:t.id,title:t.title})):[],...(archive?{archiveDocuments:[document]}:{dailyArchives:document?[document]:[]})}};
}

async function discardInvalidSaved(cause) {
  if(cause.status===401) {
    await deviceSession.clear();remembered=false;
    return '保存的密钥已失效或没有资料访问权限，请更新后重新连接。';
  }
  return [400,403,404].includes(cause.status)
    ? '已保留此设备的登录信息，但暂时无法读取资料。请检查仓库及权限，重试自动连接，或填写更新后的密钥。'
    : '已保留此设备的登录信息。暂时无法连接 GitHub，请检查网络后重试自动连接。';
}

if (cloudMode && typeof window !== 'undefined') {
  document.addEventListener('click',async event=>{
    const button=event.target.closest?.('[data-cloud-session]');
    if(!button)return;
    button.disabled=true;
    try {
      if(button.dataset.cloudSession==='remember') {
        if(!credentials)throw new Error('请先连接私有资料。');
        await deviceSession.save(credentials);remembered=true;deviceMessage='';refreshConnectionPanel();
      }else if(button.dataset.cloudSession==='logout') {
        if(hasPendingSync())throw new Error('还有未同步修改，请先同步成功，或下载并处理待同步草稿后再退出。');
        await deviceSession.clear();remembered=false;connection=credentials=undefined;
        readerState=undefined;pendingReaders.clear();trustedReaders.clear();sessionChannel?.postMessage({type:'signout'});
        location.replace(appRoot.href);
      }
    }catch(cause){deviceMessage=cause.message;refreshConnectionPanel();}
    finally{button.disabled=false;}
  });
  window.addEventListener('message',event => {
    const nonce = event.data?.nonce;
    if (event.origin !== location.origin || event.data?.type !== 'work-hub-reader-request' || !credentials || (pendingReaders.get(nonce) !== event.source && !trustedReaders.has(event.source))) return;
    try { if(![appRoot.pathname,appRoot.pathname+'index.html',appRoot.pathname+'document.html',appRoot.pathname+'daily-archive.html'].includes(event.source.location.pathname))return; } catch { return; }
    pendingReaders.delete(nonce);
    const url=new URL(event.source.location.href);
    event.source.postMessage({type:'work-hub-reader-session',nonce,credentials,snapshot:previewFor(url)},location.origin);
  });
  document.addEventListener('click',event => {
    const anchor = event.target.closest?.('a[target="_blank"]');
    if (!anchor || !credentials || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const url = new URL(anchor.href,location.href);
    if (url.origin !== location.origin || !['document.html','daily-archive.html'].some(name => url.pathname === appRoot.pathname+name)) return;
    const nonce = crypto.randomUUID(); url.hash = 'cloud-session='+nonce;
    const child = window.open(url.href,'_blank');
    if (!child) return;
    event.preventDefault(); pendingReaders.set(nonce,child);trustedReaders.add(child);
    for(const reader of trustedReaders)if(reader.closed)trustedReaders.delete(reader);
    setTimeout(()=>pendingReaders.delete(nonce),10000);
  });
}

function readerSession() {
  return inheritedSession ||= requestReaderSession();
}
async function requestReaderSession() {
  const sharedNonce = new URLSearchParams(location.hash.slice(1)).get('cloud-session');
  if (!window.opener || window.opener.closed) return null;
  const nonce = sharedNonce || crypto.randomUUID();
  if(sharedNonce)history.replaceState(null,'',location.pathname+location.search);
  return new Promise(resolve => {
    const finish = value => { clearTimeout(timer);window.removeEventListener('message',receive);resolve(value); };
    const receive = event => { if (event.origin === location.origin && event.source === window.opener && event.data?.type === 'work-hub-reader-session' && event.data.nonce === nonce) finish({credentials:event.data.credentials,snapshot:event.data.snapshot}); };
    const timer = setTimeout(()=>finish(null),1800);
    window.addEventListener('message',receive);
    window.opener.postMessage({type:'work-hub-reader-request',nonce},location.origin);
  });
}
export async function readerPreview({refresh=false} = {}) {
  if(!cloudMode)return null;
  return (await (refresh?requestReaderSession():readerSession()))?.snapshot || null;
}

function promptLogin({saved=null,notice=''} = {}) {
  return new Promise(resolve => {
    const modal = document.createElement('dialog');modal.className='modal cloud-login';
    modal.innerHTML = `<form class="cloud-login-form"><div class="cloud-login-mark" aria-hidden="true">B</div><div class="eyebrow">YOUR PRIVATE WORKSPACE</div><h1>欢迎来到 Bing‘ House</h1><p class="hint">资料只从你的私有仓库读取。关闭页面后，访问密钥会从当前会话中清除。</p><label class="field">资料仓库<input name="repository" required autocomplete="off" placeholder="用户名/资料仓库" aria-label="资料仓库"></label><label class="field">GitHub 访问密钥<input name="token" type="password" required autocomplete="off" spellcheck="false" placeholder="只授权资料仓库的访问密钥" aria-label="GitHub 访问密钥"></label><p class="hint">首次使用：<a target="_blank" rel="noopener noreferrer" href="https://github.com/settings/personal-access-tokens/new">创建访问密钥 ↗</a>，仅选择资料仓库，Contents 设置为 Read and write。不要使用 GitHub 登录密码。</p><p class="form-error" role="alert"></p><button class="button primary" type="submit">连接私有资料</button><p class="cloud-login-foot">网站不会把密钥写入源码、localStorage、IndexedDB 或 Cookie。</p></form>`;
    modal.querySelector('.hint').textContent='首次输入访问密钥。记住此设备后，下次打开可自动连接，资料仍从私有仓库读取。';
    const remember=document.createElement('label');remember.className='cloud-remember';
    remember.innerHTML='<input name="remember" type="checkbox"><span>记住此设备，下次自动连接<small>在此设备加密保存访问凭据，可在设置中退出并清除。</small></span>';
    const submit=modal.querySelector('button[type="submit"]');submit.before(remember);
    const retry=document.createElement('button');retry.type='button';retry.className='button secondary';retry.textContent='重试自动连接';retry.hidden=!saved;submit.before(retry);
    modal.querySelector('.cloud-login-foot').textContent='工作内容不写入浏览器存储。仅在选择“记住此设备”时保存加密连接凭据。';
    const install = document.createElement('button');
    install.type='button';install.className='text-button cloud-install-entry';install.dataset.installApp='';install.setAttribute('aria-haspopup','dialog');install.textContent='安装到手机 · 查看步骤';
    modal.querySelector('form').append(install);
    const form = modal.querySelector('form'), button = submit, error = form.querySelector('[role="alert"]');
    form.elements.repository.value = saved?saved.owner+'/'+saved.repo:cloudConfig.owner && cloudConfig.repo ? cloudConfig.owner+'/'+cloudConfig.repo : '';
    form.elements.remember.checked = remembered || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
    error.textContent=notice;
    const finish=(workspace,value)=>{credentials=value;connection=workspace;deviceMessage='';form.reset();modal.close();modal.remove();resolve(workspace);};
    retry.addEventListener('click',async()=>{
      if(!saved)return;retry.disabled=button.disabled=true;error.textContent='';
      try {const workspace=await connect(saved);finish(workspace,saved);}
      catch(cause){try{error.textContent=await discardInvalidSaved(cause);}catch{error.textContent='无法清除失效登录信息，请检查设备的存储设置。';}if(!remembered){saved=null;retry.hidden=true;}}
      finally{retry.disabled=button.disabled=false;}
    });
    modal.addEventListener('cancel',event=>event.preventDefault());
    form.addEventListener('submit',async event => {
      event.preventDefault();button.disabled=true;error.textContent='';
      const [owner,repo,...extra] = form.elements.repository.value.trim().replace(/^https:\/\/github\.com\//,'').replace(/\/$/,'').split('/');
      const next = {owner,repo,branch:cloudConfig.branch||'',token:form.elements.token.value.trim()};
      try {
        if (extra.length) throw new Error('请填写“用户名/仓库名”');
        const workspace = await connect(next);
        if(form.elements.remember.checked){await deviceSession.save(next);remembered=true;}
        else if(remembered){await deviceSession.clear();remembered=false;}
        finish(workspace,next);
      } catch (cause) { error.textContent=cause.message;button.disabled=false; }
    });
    document.body.append(modal);modal.showModal();form.elements.token.focus();
  });
}

export async function githubSession() {
  if (connection) return connection;
  if (!connecting) connecting=(async()=>{
    let saved,notice='';
    try {saved=await deviceSession.read();remembered=!!saved;}
    catch {try{await deviceSession.clear();}catch{/* Storage may be blocked; session-only login still works. */}notice='设备登录信息暂时无法读取，可重新填写密钥连接。';}
    if(saved){try{const workspace=await connect(saved);connection=workspace;credentials=saved;return workspace;}
      catch(cause){try{notice=await discardInvalidSaved(cause);}catch{notice='无法清除失效登录信息，请检查设备的存储设置。';}if(!remembered)saved=null;}}
    const inherited=await readerSession();
    if(inherited?.credentials){try{connection=await connect(inherited.credentials);credentials=inherited.credentials;return connection;}catch{/* Ask again if the parent session no longer works. */}}
    return promptLogin({saved,notice});
  })().finally(()=>{connecting=undefined;});
  return connecting;
}

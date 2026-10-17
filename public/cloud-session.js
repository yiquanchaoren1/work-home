import { cloudConfig } from './cloud-config.js';
import { GithubWorkspace } from './github-workspace.js';

export const cloudMode = cloudConfig.enabled === true;
let connection, connecting, credentials;
const pendingReaders = new Map();
const trustedReaders = new Set();
const appRoot = new URL('./',import.meta.url);

if (cloudMode && typeof window !== 'undefined') {
  window.addEventListener('message',event => {
    const nonce = event.data?.nonce;
    if (event.origin !== location.origin || event.data?.type !== 'work-hub-reader-request' || !credentials || (pendingReaders.get(nonce) !== event.source && !trustedReaders.has(event.source))) return;
    try { if(![appRoot.pathname,appRoot.pathname+'index.html',appRoot.pathname+'document.html',appRoot.pathname+'daily-archive.html'].includes(event.source.location.pathname))return; } catch { return; }
    pendingReaders.delete(nonce);
    event.source.postMessage({type:'work-hub-reader-session',nonce,credentials},location.origin);
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

async function readerSession() {
  const sharedNonce = new URLSearchParams(location.hash.slice(1)).get('cloud-session');
  if (!window.opener) return null;
  const nonce = sharedNonce || crypto.randomUUID();
  if(sharedNonce)history.replaceState(null,'',location.pathname+location.search);
  return new Promise(resolve => {
    const finish = value => { clearTimeout(timer);window.removeEventListener('message',receive);resolve(value); };
    const receive = event => { if (event.origin === location.origin && event.source === window.opener && event.data?.type === 'work-hub-reader-session' && event.data.nonce === nonce) finish(event.data.credentials); };
    const timer = setTimeout(()=>finish(null),1800);
    window.addEventListener('message',receive);
    window.opener.postMessage({type:'work-hub-reader-request',nonce},location.origin);
  });
}

function promptLogin() {
  return new Promise(resolve => {
    const modal = document.createElement('dialog');modal.className='modal cloud-login';
    modal.innerHTML = `<form class="cloud-login-form"><div class="cloud-login-mark" aria-hidden="true">间</div><div class="eyebrow">YOUR PRIVATE WORKSPACE</div><h1>打开你的云端工作间</h1><p class="hint">资料只从你的私有仓库读取。关闭页面后，访问密钥会从当前会话中清除。</p><label class="field">资料仓库<input name="repository" required autocomplete="off" placeholder="用户名/资料仓库" aria-label="资料仓库"></label><label class="field">GitHub 访问密钥<input name="token" type="password" required autocomplete="off" spellcheck="false" placeholder="只授权资料仓库的访问密钥" aria-label="GitHub 访问密钥"></label><p class="hint">首次使用：<a target="_blank" rel="noopener noreferrer" href="https://github.com/settings/personal-access-tokens/new">创建访问密钥 ↗</a>，仅选择资料仓库，Contents 设置为 Read and write。不要使用 GitHub 登录密码。</p><p class="form-error" role="alert"></p><button class="button primary" type="submit">连接私有资料</button><p class="cloud-login-foot">网站不会把密钥写入源码、localStorage、IndexedDB 或 Cookie。</p></form>`;
    const form = modal.querySelector('form'), button = form.querySelector('button'), error = form.querySelector('[role="alert"]');
    form.elements.repository.value = cloudConfig.owner && cloudConfig.repo ? cloudConfig.owner+'/'+cloudConfig.repo : '';
    modal.addEventListener('cancel',event=>event.preventDefault());
    form.addEventListener('submit',async event => {
      event.preventDefault();button.disabled=true;error.textContent='';
      const [owner,repo,...extra] = form.elements.repository.value.trim().replace(/^https:\/\/github\.com\//,'').replace(/\/$/,'').split('/');
      const next = {owner,repo,branch:cloudConfig.branch||'',token:form.elements.token.value};
      try {
        if (extra.length) throw new Error('请填写“用户名/仓库名”');
        const workspace = await new GithubWorkspace(next).connect();
        // Check the data before dismissing login; a bad token cannot leave a blank app.
        await workspace.state();credentials=next;connection=workspace;form.reset();modal.close();modal.remove();resolve(workspace);
      } catch (cause) { error.textContent=cause.message;button.disabled=false; }
    });
    document.body.append(modal);modal.showModal();form.elements.token.focus();
  });
}

export async function githubSession() {
  if (connection) return connection;
  if (!connecting) connecting=(async()=>{
    const inherited=await readerSession();
    if(inherited){try{connection=await new GithubWorkspace(inherited).connect();credentials=inherited;return connection;}catch{/* Ask again if the parent session no longer works. */}}
    return promptLogin();
  })().finally(()=>{connecting=undefined;});
  return connecting;
}

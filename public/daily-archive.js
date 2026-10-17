import {readWorkspace,readerPreview} from './local-api.js?v=sync2-20261018';
import {renderMarkdown} from './markdown.js';
import {archiveDocumentKinds} from './archive-documents.js';
import {applyTheme} from './ui-effects.js?v=themes-20261017';
import {dayKey} from './personal.js';

const reader=document.querySelector('#reader'),button=document.querySelector('#summary-download');
const date=new URL(location.href).searchParams.get('date');
const archive=new URL(location.href).searchParams.get('archive');
let current;
let loading=false;
let pendingPreview=false,previewTimer;
const element=(tag,className,text)=>{const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node;};
function render(state) {
    const summary=archive?state.data.archiveDocuments?.find(item=>item.id===archive):state.data.dailyArchives?.find(item=>item.date===date);
    if(!summary)throw new Error('此文档尚未归档，上传完成后会自动显示，请稍后重新查看。');
    applyTheme(state.data.settings.theme,state.data.settings.design);
    current=summary;document.title=summary.title+' · Bing‘ House';
    const paper=element('article','reader-paper');
    const filename=archive?archiveDocumentKinds[archive].filename:summary.date+'.md';
    const label=archive?summary.title:summary.date;
    const folder=archive?state.archiveDir:state.codexDir;
    paper.append(element('div','eyebrow',archive?'MY WORK ARCHIVE':'DAILY WORK SUMMARY'),element('p','reader-meta',`${label} · 本机文件：${folder}/${filename}`));
    if(archive){document.querySelector('.reader-brand small').textContent='工作档案 / '+summary.title;document.querySelector('.reader-footer').textContent='工作档案 · 本机保存';}
    const content=element('div','reader-content markdown-body');content.innerHTML=renderMarkdown(summary.body);paper.append(content);
    reader.replaceChildren(paper);button.hidden=false;
}
function notice(message) {reader.querySelector('.reader-refresh-warning')?.remove();if(message){const p=element('p','reader-refresh-warning callout',message);reader.prepend(p);}}
async function load() {
  if(loading)return;loading=true;
  clearTimeout(previewTimer);
  try {
    if(archive&&!Object.hasOwn(archiveDocumentKinds,archive))throw new Error('档案地址无效。');
    if(!archive && date>=dayKey())throw new Error('当天摘要将在次日归档完成后显示。');
    const preview=await readerPreview({refresh:Boolean(current)||pendingPreview});
    const previewSummary=archive?preview?.data.archiveDocuments?.find(item=>item.id===archive):preview?.data.dailyArchives?.find(item=>item.date===date);
    if(previewSummary){render(preview);notice('已显示当前会话内容，正在核对云端版本…');}
    if(preview?.pendingSync){pendingPreview=true;notice(preview.syncError?'当前页面有未同步修改：'+preview.syncError:'已显示当前会话内容，正在等待主页面后台同步…');if(document.visibilityState==='visible'&&window.opener&&!window.opener.closed)previewTimer=setTimeout(()=>void load(),1500);return;}
    if(pendingPreview&&!preview){notice('主页面已关闭或无法连接，保留当前会话内容。');return;}
    pendingPreview=false;
    const state=await readWorkspace({archive,date});render(state);notice(state.warning);
  }catch(error){if(current)notice('暂时无法核对云端版本，保留已打开的内容。'+error.message);else{current=undefined;button.hidden=true;const panel=element('section','reader-status error');panel.append(element('h1','','无法读取每日摘要'),element('p','',error.message));const retry=element('button','button secondary','重新读取');retry.addEventListener('click',load);panel.append(retry);reader.replaceChildren(panel);}}
  finally{loading=false;}
}
button.addEventListener('click',()=>{
  if(!current)return;
  const url=URL.createObjectURL(new Blob([current.body],{type:'text/markdown;charset=utf-8'})),anchor=document.createElement('a');anchor.href=url;anchor.download=archive?archiveDocumentKinds[archive].filename:current.date+'.md';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
});
window.addEventListener('focus',load);
window.addEventListener('pagehide',()=>clearTimeout(previewTimer));
load();

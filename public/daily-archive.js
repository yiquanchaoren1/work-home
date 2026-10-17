import {readWorkspace} from './local-api.js';
import {renderMarkdown} from './markdown.js';
import {archiveDocumentKinds} from './archive-documents.js';
import {applyTheme} from './ui-effects.js?v=gallery-20261017';
import {dayKey} from './personal.js';

const reader=document.querySelector('#reader'),button=document.querySelector('#summary-download');
const date=new URL(location.href).searchParams.get('date');
const archive=new URL(location.href).searchParams.get('archive');
let current;
const element=(tag,className,text)=>{const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node;};
async function load() {
  try {
    if(!archive && date>=dayKey())throw new Error('当天摘要将在次日归档完成后显示。');
    const state=await readWorkspace(),summary=archive?state.data.archiveDocuments?.find(item=>item.id===archive):state.data.dailyArchives?.find(item=>item.date===date);
    applyTheme(state.data.settings.theme);
    if(!summary)throw new Error('此文档尚未归档，上传完成后会自动显示，请稍后重新查看。');
    current=summary;document.title=summary.title+' · Bing‘ House';
    const paper=element('article','reader-paper');
    const filename=archive?archiveDocumentKinds[archive].filename:summary.date+'.md';
    const label=archive?summary.title:summary.date;
    const folder=archive?state.archiveDir:state.codexDir;
    paper.append(element('div','eyebrow',archive?'MY WORK ARCHIVE':'DAILY WORK SUMMARY'),element('p','reader-meta',`${label} · 本机文件：${folder}/${filename}`));
    if(archive){document.querySelector('.reader-brand small').textContent='工作档案 / '+summary.title;document.querySelector('.reader-footer').textContent='工作档案 · 本机保存';}
    const content=element('div','reader-content markdown-body');content.innerHTML=renderMarkdown(summary.body);paper.append(content);
    reader.replaceChildren(paper);button.hidden=false;
  }catch(error){current=undefined;button.hidden=true;const panel=element('section','reader-status error');panel.append(element('h1','','无法读取每日摘要'),element('p','',error.message));const retry=element('button','button secondary','重新读取');retry.addEventListener('click',load);panel.append(retry);reader.replaceChildren(panel);}
}
button.addEventListener('click',()=>{
  if(!current)return;
  const url=URL.createObjectURL(new Blob([current.body],{type:'text/markdown;charset=utf-8'})),anchor=document.createElement('a');anchor.href=url;anchor.download=archive?archiveDocumentKinds[archive].filename:current.date+'.md';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
});
window.addEventListener('focus',load);
load();

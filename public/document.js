import { renderMarkdown } from './markdown.js';
import { readWorkspace, attachmentUrl, cloudMode, readerPreview } from './local-api.js?v=perf-20261018';
import { mountPdf } from './pdf-viewer.js';
import { applyTheme } from './ui-effects.js?v=themes-20261017';

const root = document.querySelector('#reader');
const downloadButton = document.querySelector('#document-download');
const editLink = document.querySelector('#document-edit');
const id = new URL(location.href).searchParams.get('id');
let currentNote, revision, signature, loading = false, generation = 0, cleanupPreview;
const element = (tag, className, text) => {
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
};
const fileUrl = attachmentUrl;
function status(title, text, error = false) {
  cleanupPreview?.();cleanupPreview=undefined;
  const panel=element('section',`reader-status${error?' error':''}`);
  panel.append(element('h2','',title),element('p','',text));
  const retry=element('button','button secondary','重新读取');retry.addEventListener('click',()=>load(true));panel.append(retry);
  root.replaceChildren(panel);
}
function storageNotice(message) {
  root.querySelector('.reader-storage-warning')?.remove();
  if(message){const notice=element('div','reader-storage-warning callout');notice.append(element('p','',message));root.prepend(notice);}
}
async function download() {
  const note=currentNote;if(!note)return;
  const anchor=document.createElement('a');
  if(note.attachment){anchor.href=await fileUrl(note.attachment)+(cloudMode?'':'?download=1');anchor.download=note.attachment.name;}
  else {
    const markdown=note.format==='markdown';
    anchor.href=URL.createObjectURL(new Blob([note.body],{type:markdown?'text/markdown;charset=utf-8':'text/plain;charset=utf-8'}));
    anchor.download=(note.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,120)||'文档')+(markdown?'.md':'.txt');
    setTimeout(()=>URL.revokeObjectURL(anchor.href),10000);
  }
  anchor.click();
}
function decodeText(bytes) {
  if(bytes[0]===0xff&&bytes[1]===0xfe)return new TextDecoder('utf-16le').decode(bytes);
  if(bytes[0]===0xfe&&bytes[1]===0xff)return new TextDecoder('utf-16be').decode(bytes);
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch{return new TextDecoder('gb18030').decode(bytes);}
}
async function showAttachment(note, content, ticket) {
  const file=note.attachment;
  if(note.body)content.append(element('p','reader-note',note.body));
  if(file.type==='application/pdf'){
    const host=element('div','reader-pdf-host');content.append(host);
    return mountPdf(host,{url:await fileUrl(file),title:note.title});
  } else if(/^image\/(png|jpeg|gif|webp)$/.test(file.type)){
    const wrap=element('div','reader-image-wrap');const image=element('img','reader-image');image.alt=note.title;image.src=await fileUrl(file);
    image.addEventListener('error',()=>{if(wrap.isConnected)wrap.replaceChildren(element('p','reader-note','图片暂时无法读取，请确认本机服务运行后重试。'));});
    wrap.append(image);content.append(wrap);
  } else if(file.type.startsWith('text/')||/\.(txt|log|csv|json|xml|ya?ml|ini|py|js|ts|css|cpp|hpp|h|c|sh|toml|sql)$/i.test(file.name)){
    const limit=1024*1024;
    const response=await fetch(await fileUrl(file),{cache:'no-store',headers:file.size>limit?{Range:`bytes=0-${limit-1}`}:{}});
    if(!response.ok)throw new Error('本机文本文件暂时无法读取。');
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(ticket!==generation)return;
    if(file.size>limit)content.append(element('p','reader-note','此文件较大，当前预览前 1 MiB；下载原文件可查看全部内容。'));
    content.append(element('pre','reader-text',decodeText(bytes.slice(0,limit))));
  } else {
    const panel=element('div','reader-status');panel.append(element('h2','','原文件已保存在本机'),element('p','',`${file.name} 暂不支持直接预览。下载后可用电脑上的对应程序打开。`));
    const button=element('button','button primary','下载原文件');button.addEventListener('click',download);panel.append(button);content.append(panel);
  }
}
async function render(note, state, ticket) {
  const paper=element('article','reader-paper');
  paper.append(element('div','eyebrow','YOUR KNOWLEDGE, AT HAND'),element('h1','reader-title',note.title));
  const meta=element('div','reader-meta');
  meta.append(element('span','badge gray',note.category),element('span','',note.attachment?`${(note.attachment.size/1024).toFixed(1)} KB`:note.format==='markdown'?'Markdown':'文本笔记'));
  const time=element('time','',`更新于 ${new Date(note.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}`);time.dateTime=note.updatedAt;meta.append(time);
  if(note.sourceName||note.attachment)meta.append(element('span','reader-source',note.attachment?.name||note.sourceName));
  const task=state.data.tasks.find(item=>item.id===note.taskId);
  if(task){const link=element('a','',`关联：${task.title}`);link.href=`./#detail/${encodeURIComponent(task.id)}`;meta.append(link);}
  paper.append(meta);
  const content=element('div','reader-content');paper.append(content);
  let nextCleanup;
  if(note.attachment)nextCleanup=await showAttachment(note,content,ticket);
  else if(note.format==='markdown'){content.classList.add('markdown-body');content.innerHTML=renderMarkdown(note.body);}
  else content.append(element('div','reader-plain',note.body||'暂无正文'));
  if(note.tags.length){const tags=element('div','reader-tags');for(const tag of note.tags)tags.append(element('span','tag',tag));paper.append(tags);}
  cleanupPreview?.();cleanupPreview=nextCleanup;
  currentNote=note;document.title=`${note.title} · Bing‘ House`;
  editLink.href=`./#notes/edit/${encodeURIComponent(note.id)}`;editLink.textContent=note.attachment?'编辑说明':'编辑文档';editLink.hidden=false;
  downloadButton.textContent=note.attachment?'下载原文件':note.format==='markdown'?'下载 .md':'下载 .txt';downloadButton.hidden=false;
  root.replaceChildren(paper);
}
async function load(force = false) {
  if(loading)return;loading=true;const ticket=++generation;
  try {
    if(!id)throw new Error('文档地址缺少 ID，请从知识库重新打开。');
    if(!currentNote&&!force){
      const preview=await readerPreview(),note=preview?.data.notes?.find(item=>item.id===id);
      // Text can be shown from the trusted opener without waiting for GitHub.
      // Attachments still need authenticated integrity-checked bytes before rendering.
      if(note&&!note.attachment){
        applyTheme(preview.data.settings.theme,preview.data.settings.design);
        await render(note,preview,ticket);signature=JSON.stringify([note,preview.data.tasks.find(item=>item.id===note.taskId)?.title]);
        storageNotice('已显示当前会话内容，正在核对云端版本…');
      }
    }
    const state=await readWorkspace({archives:false});
    applyTheme(state.data.settings.theme,state.data.settings.design);
    root.querySelector('.reader-refresh-warning')?.remove();
    storageNotice(state.warning);
    if(!force&&state.revision===revision)return;
    const note=state.data.notes.find(item=>item.id===id);
    if(!note){const error=new Error('这篇文档可能已删除，或不在当前本机数据中。请返回知识库查看。');error.code='not-found';throw error;}
    const nextSignature=JSON.stringify([note,state.data.tasks.find(item=>item.id===note.taskId)?.title]);
    // Other workspace activity must not reset a PDF reader's internal position.
    if(!force&&nextSignature===signature){revision=state.revision;return;}
    const scroll=scrollY;await render(note,state,ticket);revision=state.revision;signature=nextSignature;storageNotice(state.warning);
    if(scroll)window.scrollTo(0,scroll);
  } catch(error) {
    if(currentNote&&signature!==undefined&&!force&&error.code!=='not-found'){
      root.querySelector('.reader-refresh-warning')?.remove();
      const warning=element('div','reader-refresh-warning callout');warning.append(element('p','','暂时无法刷新本机数据，以下保留已打开的内容。'));
      const retry=element('button','button secondary small','重新读取');retry.addEventListener('click',()=>load());warning.append(retry);root.prepend(warning);
    }else{revision=undefined;signature=undefined;currentNote=null;downloadButton.hidden=true;editLink.hidden=true;status('暂时无法打开文档',error.message,true);}
  }
  finally {loading=false;}
}
downloadButton.addEventListener('click',download);
window.addEventListener('focus',()=>load());
window.addEventListener('pagehide',()=>{cleanupPreview?.();cleanupPreview=undefined;});
window.addEventListener('pageshow',event=>{if(event.persisted)void load(true);});
await load();

// File drops use the existing preview/import path; text and task-card drags stay untouched.
export function installDocumentDrop({document,onFiles,pageEnabled,blocked,onWarning}) {
  let active=null,depth=0;
  const fileDrag=event=>[...(event.dataTransfer?.types||[])].includes('Files');
  const clear=()=>{active?.classList.remove('document-drop-active');active=null;depth=0;};
  const zone=event=>{
    if(blocked())return null;
    const modal=document.querySelector('#modal');
    if(modal?.open)return event.target.closest?.('.document-import')?modal.querySelector('.upload-zone'):null;
    return pageEnabled()&&document.querySelector('#content')?.contains(event.target)?document.querySelector('#content'):null;
  };
  const highlight=target=>{if(active!==target){active?.classList.remove('document-drop-active');active=target;depth=0;}active?.classList.add('document-drop-active');};
  document.addEventListener('dragenter',event=>{if(!fileDrag(event))return;event.preventDefault();const target=zone(event);highlight(target);if(target)depth++;});
  document.addEventListener('dragover',event=>{if(!fileDrag(event))return;event.preventDefault();const target=zone(event);highlight(target);event.dataTransfer.dropEffect=target?'copy':'none';});
  document.addEventListener('dragleave',event=>{if(!fileDrag(event)||!active)return;if(--depth<=0)clear();});
  document.addEventListener('drop',event=>{
    if(!fileDrag(event))return;
    event.preventDefault();const target=zone(event);clear();if(!target)return;
    const items=[...(event.dataTransfer.items||[])];
    if(items.some(item=>item.webkitGetAsEntry?.()?.isDirectory)){onWarning('文件夹请使用“选择整个文档文件夹”导入。');return;}
    const files=[...(event.dataTransfer.files||[])];if(!files.length)return;
    Promise.resolve(onFiles(files)).catch(()=>onWarning('文件读取失败，请重新选择文档。'));
  });
  document.addEventListener('dragend',clear);
  document.defaultView?.addEventListener('blur',clear);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')clear();});
}

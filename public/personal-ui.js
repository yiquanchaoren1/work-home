import { entryKinds,entryStates,journalFields,personalData,dayKey,buildPersonalDocument } from './personal.js';
import { createId } from './store.js';
import { readPersonalDocument, attachmentUrl } from './local-api.js';
import { markdownExcerpt } from './markdown.js';

export function createPersonalUI(ctx) {
  const {esc,field,selectField,showModal,commit,toast,download}=ctx;
  const $=s=>document.querySelector(s);
  let entryFilter='all';
  let archiveDate='',archiveSearch='';
  const data=()=>ctx.data(), p=()=>personalData(data());
  const options=(map,value)=>Object.entries(map).map(([key,label])=>`<option value="${key}" ${key===value?'selected':''}>${esc(label)}</option>`).join('');
  const action=(name,label,id='',style='secondary')=>`<button type="button" class="button ${style} small" data-action="${name}" data-id="${esc(id)}">${label}</button>`;
  const head=(title,desc,buttons)=>`<div class="page-header"><div><div class="eyebrow">MY PERSONAL KNOWLEDGE</div><h1>${title}</h1><p class="page-description">${desc}</p></div><div class="header-actions">${buttons}</div></div>`;
  const status=s=>`<span class="badge ${s==='pending'?'amber':s==='confirmed'?'green':'gray'}">${entryStates[s]}</span>`;
  const empty=text=>`<div class="empty-state"><h3>${text}</h3><p>从自己的资料、真实工作和明确的偏好开始。</p></div>`;
  const revisionText=item=>JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key])=>key!=='history')),null,2);
  function remember(item) { return [...item.history,{at:new Date().toISOString(),text:revisionText(item)}]; }
  function sourceLink(e) { const note=data().notes.find(n=>n.id===e.sourceNoteId);return note?`<a class="text-button" href="./document.html?id=${encodeURIComponent(note.id)}" target="_blank" rel="noopener noreferrer">${esc(note.title)} ↗</a>`:esc(e.sourceLabel||'本人填写'); }
  function archiveDocumentCard(id) {
    const item=data().archiveDocuments?.find(doc=>doc.id===id);if(!item)return '';
    const desc=id==='profile'?'从过往记录提取的工作背景、研究经历、项目、学习方向和协作偏好；明确区分本人陈述与待确认归纳。':'将过往记录按工作阶段和主题合并，保留重要成果、经验和待办。';
    return `<section class="panel archive-document-card" data-archive-document="${id}"><div class="section-head"><div><div class="eyebrow">${id==='profile'?'个人档案':'历史总览'} · 独立 Markdown 文档</div><h2>${esc(item.title)}.md</h2></div><a class="button secondary small" href="./daily-archive.html?archive=${id}" target="_blank" rel="noopener noreferrer">${id==='profile'?'查看个人档案':'查看历史总结'} ↗</a></div><p class="hint">${desc}</p></section>`;
  }
  function profilePage() {
    const list=p().entries.filter(e=>entryFilter==='all'||e.status===entryFilter||e.kind===entryFilter);
    const sources=data().notes.filter(n=>n.category==='个人档案材料'||p().entries.some(e=>e.sourceNoteId===n.id));
    return head('个人档案','记录背景、目标、喜好与长期经验。只有你确认的内容才作为稳定偏好。',action('personal-upload','上传档案材料')+action('personal-source','从知识库选取')+action('personal-new','＋ 添加档案','','primary'))+archiveDocumentCard('profile')+
      `<div class="toolbar"><div class="filters">${[['all','全部'],...Object.entries(entryStates),...Object.entries(entryKinds)].map(([value,label])=>`<button class="filter-chip ${entryFilter===value?'active':''}" data-action="personal-filter" data-id="${value}">${label}</button>`).join('')}</div></div><div class="personal-layout"><div class="stack">${list.length?list.map(e=>`<article class="panel archive-entry" data-entry-id="${esc(e.id)}"><div class="section-head"><div><span class="eyebrow">${entryKinds[e.kind]}</span><h2>${esc(e.title)}</h2></div>${status(e.status)}</div><div class="archive-prose">${esc(e.body)}</div><div class="archive-source">来源：${sourceLink(e)} · 更新：${esc(e.updatedAt.slice(0,10))}</div><div class="archive-actions">${e.status==='pending'?action('personal-confirm','确认收录',e.id,'primary'):''}${action('personal-edit','编辑与历史',e.id)}${action('personal-delete','删除',e.id,'danger')}</div></article>`).join(''):empty('还没有这类档案')}</div><div class="stack"><section class="panel"><h2>档案材料</h2><p class="hint">原文仍在知识库，点击文档在新标签页查看。可以提取 Markdown、文本和有文字层的 PDF 后核对；图片可先查看并手动记录。</p>${sources.map(n=>`<div class="archive-material"><a href="./document.html?id=${encodeURIComponent(n.id)}" target="_blank" rel="noopener noreferrer">${esc(n.title)} ↗</a>${action('personal-extract','整理为待确认档案',n.id)}</div>`).join('')||'<p class="muted">尚未上传或关联档案材料。</p>'}</section><section class="panel"><h2>从记录到个人知识</h2><p class="hint">每日记录保存事实和思考，长期偏好由你确认。待确认项不会进入精简 AI 上下文。</p><div class="archive-actions"><a class="button secondary small" href="#journal">每日记录</a><a class="button secondary small" href="#portable">我的 AI 文档</a></div></section></div></div>`;
  }
  function journalPage() {
    const rows=[...p().journals].sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt));
    return head('每日记录','记录实际做了什么、结论与证据、个人收获和下一步。支持补记过去的日期。',action('journal-new','＋ 记录今天','','primary'))+
      `<div class="personal-journals">${rows.map(j=>`<article class="panel" data-journal-id="${esc(j.id)}"><div class="section-head"><div><span class="eyebrow">${j.date}</span><h2>${esc(j.title)}</h2></div>${action('journal-edit','查看与编辑',j.id)}</div><div class="archive-prose">${esc(j.work||j.learning||'尚未填写工作内容')}</div><p class="hint">下一步：${esc(j.nextStep||'尚未记录')}</p><div class="tags">${j.taskIds.map(id=>data().tasks.find(t=>t.id===id)).filter(Boolean).map(t=>`<a class="tag" href="#detail/${encodeURIComponent(t.id)}">${esc(t.title)}</a>`).join('')}</div><div class="archive-actions">${action('journal-experience','沉淀为长期经验',j.id)}${action('journal-delete','删除',j.id,'danger')}</div></article>`).join('')||empty('给今天留下一条记录')}</div>`;
  }
  function portablePage() {
    return head('我的 AI 文档','一份完整 Markdown 主档案，持续包含个人档案、全部每日记录、事项、文档、链接与验证证据。',action('archive-context','准备 AI 上下文')+action('archive-copy','复制完整主档案')+action('archive-download','下载完整 .md','','primary'))+
      `<div class="personal-layout"><section class="panel"><h2>我的个人主档案.md</h2><p class="hint">本机文件：<span class="mono">${esc(ctx.masterPath()||'保存后自动生成')}</span></p><textarea class="master-document" aria-label="完整个人主档案" readonly>${esc(buildPersonalDocument(data()))}</textarea></section><div class="stack"><section class="panel"><h2>当前收录</h2><div class="archive-counts"><span>${p().entries.length} 条档案</span><span>${p().journals.length} 篇每日记录</span><span>${data().tasks.length} 个事项</span><span>${data().notes.length} 篇文档</span></div><p class="hint">完整文档包括待确认项和修订历史，并明确标注状态。精简上下文只选已确认档案、未归档事项和最近 7 篇记录。</p></section><section class="panel"><h2>给任何 AI 使用</h2><p class="hint">填写你想生成的内容，系统用已确认偏好准备可复制的上下文。当前不会调用外部模型或发送档案。</p>${action('archive-context','准备本次上下文','','primary')}</section><section class="panel"><h2>保留原文件</h2><p class="hint">Markdown 保存文本与来源索引。PDF 和图片原件仍保存在本机，迁移时请同时下载“数据与设置”中的完整备份。</p><a class="text-button" href="#settings">完整备份与恢复 →</a><p class="hint">站外修改主档案会先保留副本再刷新；要纳入档案，请重新上传核对。</p></section></div></div>`;
  }
  function recordsPage() {
    const summaries=(data().dailyArchives||[]).filter(item=>item.date<dayKey());
    const sync=ctx.archiveStatus?.()||{},warnings=sync.warnings||[];
    const checked=sync.checkedAt?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(sync.checkedAt)):'';
    const visible=summaries.filter(n=>(!archiveDate||n.date===archiveDate)&&(!archiveSearch||[n.title,n.body].join(' ').toLowerCase().includes(archiveSearch.toLowerCase()))).sort((a,b)=>b.date.localeCompare(a.date));
    return head('工作档案','每天一份简要总结，自动归档昨天的重要工作、结论与下一步。','')+archiveDocumentCard('history')+archiveDocumentCard('profile')+
      `<section class="panel archive-auto-panel"><div><div class="eyebrow">A LITTLE PROGRESS, EVERY DAY</div><h2>每天零点，留住昨天</h2><p class="hint">北京时间 00:00 整理前一天摘要，上传完成后自动显示。打开页面或回到 App 时会自动检查更新。</p><p class="hint">一天一份，只留重要内容，独立收录在工作档案。</p></div><div class="archive-auto-state"><span class="badge ${warnings.length?'amber':'green'}">${warnings.length?'部分档案暂未更新':'自动更新'}</span><strong>${summaries.length}<small> 天工作积累</small></strong><p class="hint">${checked?'已检查 '+esc(checked):'等待首次归档'}</p></div></section>${warnings.length?`<section class="callout error"><div><strong>稍后会自动重试</strong><p>${warnings.map(esc).join('；')}</p></div></section>`:''}<details class="archive-how"><summary>归档什么时候更新？</summary><p>工作中由 Codex 合并当天记录，每天北京时间 00:00 再整理刚结束的一天并上传。同一天只保留一份摘要，不收录问答原文，也不进入知识库。今天的摘要会在明天归档后显示。</p><p>零点整理需要电脑和 Codex 能够运行；如果当时未运行，下次任务执行时会检查并补传漏传摘要。上传完成后，手机查看无需电脑开机。页面打开时会自动读取，也会定期检查更新。</p></details><form id="archive-filter-form" class="archive-filter"><label class="field">记录日期<input type="date" name="date" value="${esc(archiveDate)}"></label><label class="field">搜索摘要<input name="search" type="search" value="${esc(archiveSearch)}" placeholder="重要工作或结论"></label><button class="button secondary" type="submit">筛选</button>${action('codex-filter-clear','清除筛选')}</form><div class="personal-journals">${visible.map(n=>`<article class="panel" data-daily-archive="${esc(n.date)}"><div class="section-head"><div><div class="eyebrow">${n.date} · 每日摘要</div><h2>${esc(n.title)}</h2></div><a class="button secondary small" href="./daily-archive.html?date=${encodeURIComponent(n.date)}" target="_blank" rel="noopener noreferrer">查看摘要 ↗</a></div><p class="archive-prose">${esc(markdownExcerpt(n.body.replace(/^# .*\n+/,''),300))}</p><p class="hint">${n.date}.md</p></article>`).join('')||empty(summaries.length?'没有符合筛选条件的摘要':'首份归档完成后，会自动显示在这里')}</div>`;
  }
  function archivePage(name,tab='') {
    const selected=name==='archives'?(tab||'records'):{profile:'profile',journal:'journal',portable:'export'}[name]||'records';
    const tabs=[['records','每日摘要'],['profile','个人资料与偏好'],['journal','手动补充'],['export','迁移与导出']];
    return `<nav class="archive-tabs" aria-label="工作档案分区">${tabs.map(([key,label])=>`<a href="#archives/${key}" class="${selected===key?'active':''}" ${selected===key?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`+(selected==='profile'?profilePage():selected==='journal'?journalPage():selected==='export'?portablePage():recordsPage());
  }
  function entryForm(id='',defaults={}) {
    const e=p().entries.find(e=>e.id===id)||{title:'',body:'',kind:'background',status:'confirmed',sourceNoteId:'',sourceLabel:'本人填写',sourceQuote:'',history:[],...defaults};
    showModal(id?'编辑个人档案':'添加个人档案',`<form id="personal-entry-form" data-id="${esc(id)}"><div class="form-grid">${field('标题','title',e.title,'text',true,true)}${selectField('档案分类','kind',options(entryKinds,e.kind))}${selectField('确认状态','status',options(entryStates,e.status))}${field('档案内容','body',e.body,'textarea',true,true)}${field('来源说明','sourceLabel',e.sourceLabel,'text',true)}<input type="hidden" name="sourceNoteId" value="${esc(e.sourceNoteId)}">${field('原文摘录（可核对）','sourceQuote',e.sourceQuote,'textarea',true)}</div><p class="hint">新推断请先保存为待确认，核对后再收录。来源原件不会被修改。</p>${e.history.length?`<details><summary>修订历史（${e.history.length}）</summary>${e.history.map(h=>`<p class="hint">${esc(h.at)}</p><pre class="archive-history">${esc(h.text)}</pre>`).join('')}</details>`:''}<p class="form-error" id="form-error" role="alert"></p></form>`,`<button class="button secondary" data-action="close">取消</button><button class="button primary" type="submit" form="personal-entry-form">保存档案</button>`,true);
  }
  function journalForm(id='') {
    const j=p().journals.find(j=>j.id===id)||{title:dayKey()+' 工作记录',date:dayKey(),taskIds:[],history:[],...Object.fromEntries(Object.keys(journalFields).map(k=>[k,'']))};
    const activity=data().activity.filter(a=>dayKey(new Date(a.at))===j.date).slice(0,20);
    const taskChoices=[...data().tasks,...j.taskIds.filter(id=>!data().tasks.some(t=>t.id===id)).map(id=>({id,title:'已移除事项（保留历史关联）'}))];
    showModal(id?'编辑每日记录':'记录今天',`<form id="personal-journal-form" data-id="${esc(id)}"><div class="form-grid">${field('标题','title',j.title,'text',true,true)}${field('日期','date',j.date,'date',true,true)}<fieldset class="field full journal-task-list"><legend>关联工作事项</legend>${taskChoices.map(t=>`<label class="checkbox-label"><input type="checkbox" name="taskIds" value="${esc(t.id)}" ${j.taskIds.includes(t.id)?'checked':''}>${esc(t.title)}</label>`).join('')||'<span class="muted">尚无事项</span>'}</fieldset>${Object.entries(journalFields).map(([key,label])=>field(label,key,j[key],'textarea',true)).join('')}</div>${activity.length?`<details><summary>当天站内操作线索（不是完成结论）</summary>${activity.map((a,i)=>`<div class="archive-material"><span>${esc(a.text)}</span><button type="button" class="text-button" data-action="journal-add-activity" data-text="${esc(a.text)}">加入待核实线索</button></div>`).join('')}</details>`:''}${j.history.length?`<details><summary>修订历史（${j.history.length}）</summary>${j.history.map(h=>`<pre class="archive-history">${esc(h.text)}</pre>`).join('')}</details>`:''}<p class="form-error" id="form-error" role="alert"></p></form>`,`<button class="button secondary" data-action="close">取消</button><button class="button primary" form="personal-journal-form" type="submit">保存每日记录</button>`,true);
  }
  async function extract(note) {
    if(!note)throw new Error('来源文档已不存在');
    let text=note.body;
    if(note.attachment) {
      if(note.attachment.type.startsWith('image/'))throw new Error('图片尚不支持自动文字识别。请打开原图核对，并手动添加档案。');
      if(note.attachment.type==='application/pdf') {
        const asset=path=>new URL('./vendor/pdfjs/'+path,import.meta.url).href;
        const pdfjs=await import('./vendor/pdfjs/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=asset('pdf.worker.mjs');
        const loading=pdfjs.getDocument({url:await attachmentUrl(note.attachment),standardFontDataUrl:asset('standard_fonts/'),cMapUrl:asset('cmaps/'),cMapPacked:true,isEvalSupported:false});
        loading.onPassword=()=>{void loading.destroy();};
        let doc;
        try{doc=await loading.promise;if(doc.numPages>100)throw new Error('PDF 超过 100 页，请先按章节拆分。');const pages=[];for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),content=await page.getTextContent();pages.push(content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join(''));if(pages.join('').length>2*1024*1024)throw new Error('提取文字超过 2 MB，请拆分文档。');}text=pages.join('\n\n');}catch(error){throw new Error('PDF 文字提取失败，请使用未加密、有文字层的文档或手动记录。'+error.message);}finally{await loading.destroy();}
      } else if(note.attachment.type.startsWith('text/')||/\.(txt|md|markdown)$/i.test(note.attachment.name)) {
        if(note.attachment.size>2*1024*1024)throw new Error('文本超过 2 MB，请先拆分。');
        const response=await fetch(await attachmentUrl(note.attachment));if(!response.ok)throw new Error('读取原文件失败');text=await response.text();
      } else throw new Error('该格式可保留原件，请手动填写档案或转换为 Markdown / 文本 / PDF。');
    }
    if(!text.trim())throw new Error('没有提取到文字，请查看原文并手动记录。');
    entryForm('',{title:note.title,body:text,status:'pending',sourceNoteId:note.id,sourceLabel:note.sourceName||note.title,sourceQuote:text});
    ctx.dirty(true);
  }
  async function submit(form) {
    if(form.id==='archive-filter-form'){const fd=new FormData(form);archiveDate=String(fd.get('date')||'');archiveSearch=String(fd.get('search')||'');ctx.render();return;}
    const fd=new FormData(form),id=form.dataset.id,now=new Date().toISOString();
    if(form.id==='personal-entry-form') {
      const fields=Object.fromEntries(['title','kind','status','body','sourceNoteId','sourceLabel','sourceQuote'].map(k=>[k,String(fd.get(k)||'')]));
      if(!fields.title.trim()||!fields.body.trim())throw new Error('请填写标题与档案内容');
      await commit(next=>{next.personal ||= {entries:[],journals:[]};const old=next.personal.entries.find(e=>e.id===id);if(id&&!old)throw new Error('档案已被删除，请重新载入');const value={...(old||{id:createId(),createdAt:now}),...fields,updatedAt:now,history:old?remember(old):[]};if(old)Object.assign(old,value);else next.personal.entries.push(value);},'保存了个人档案');
    } else {
      const title=String(fd.get('title')||'').trim();if(!title)throw new Error('请填写标题');
      const fields={title,date:String(fd.get('date')),taskIds:fd.getAll('taskIds'),...Object.fromEntries(Object.keys(journalFields).map(k=>[k,String(fd.get(k)||'')]))};
      if(!Object.keys(journalFields).some(k=>fields[k].trim()))throw new Error('请至少记录一项工作、结论或收获');
      await commit(next=>{next.personal ||= {entries:[],journals:[]};const old=next.personal.journals.find(j=>j.id===id);if(id&&!old)throw new Error('记录已被删除，请重新载入');const value={...(old||{id:createId(),createdAt:now}),...fields,updatedAt:now,history:old?remember(old):[]};if(old)Object.assign(old,value);else next.personal.journals.push(value);},'保存了每日工作记录');
    }
    ctx.dirty(false);$('#modal').close();toast('档案内容已保存到本机');
  }
  async function handle(el) {
    const name=el.dataset.action,id=el.dataset.id;
    if(!/^(personal-|journal-|archive-|codex-)/.test(name))return false;
    if(name==='codex-filter-clear'){archiveDate='';archiveSearch='';ctx.render();return true;}
    if(['personal-new','personal-edit','personal-upload','personal-source','personal-extract','personal-extract-selected','journal-new','journal-edit','journal-experience','personal-delete','journal-delete','archive-context'].includes(name)&&!ctx.discard())return true;
    if(name==='personal-filter'){entryFilter=id;ctx.render();}
    if(name==='personal-new')entryForm();
    if(name==='personal-edit')entryForm(id);
    if(name==='personal-upload')ctx.upload('个人档案材料','profile');
    if(name==='personal-source')showModal('选择档案来源',`<label class="field">知识库文档<select id="personal-source-note">${data().notes.map(n=>`<option value="${esc(n.id)}">${esc(n.title)}</option>`).join('')}</select></label><p class="hint">提取原文后由你编辑、确认；此操作不调用 AI。</p><p class="form-error" id="form-error" role="alert"></p>`,action('personal-extract-selected','提取原文','','primary'));
    if(name==='personal-extract'||name==='personal-extract-selected'){el.disabled=true;try{await extract(data().notes.find(n=>n.id===(id||$('#personal-source-note')?.value)));}finally{el.disabled=false;}}
    if(name==='personal-confirm')await commit(next=>{const e=next.personal.entries.find(e=>e.id===id);if(!e)throw new Error('档案已不存在');e.history=remember(e);e.status='confirmed';e.updatedAt=new Date().toISOString();},'确认收录了个人档案');
    if(name==='journal-new')journalForm();
    if(name==='journal-edit')journalForm(id);
    if(name==='journal-experience'){const j=p().journals.find(j=>j.id===id);entryForm('',{title:j.title+' · 经验',kind:'experience',status:'pending',body:j.learning||j.conclusion,sourceLabel:`每日记录 ${j.date} [${j.id}]`,sourceQuote:Object.entries(journalFields).map(([k,v])=>v+'：\n'+j[k]).join('\n\n')});ctx.dirty(true);}
    if(name==='journal-add-activity'){const input=$('#personal-journal-form [name="work"]');input.value+=(input.value?'\n':'')+'待核实线索：'+el.dataset.text;ctx.dirty(true);}
    if(name==='personal-delete'||name==='journal-delete')showModal('确认删除',`<p>删除此条档案或每日记录及其修订历史。来源文档和已有备份仍保留，可分别管理。</p>`,action(name+'-confirm','确定删除',id,'danger')+`<button class="button secondary" data-action="close">取消</button>`);
    if(name==='personal-delete-confirm'||name==='journal-delete-confirm'){await commit(next=>{const key=name.startsWith('personal-')?'entries':'journals';next.personal[key]=next.personal[key].filter(e=>e.id!==id);},'删除了一条个人记录');$('#modal').close();}
    if(name==='archive-download'||name==='archive-copy'){const document=await readPersonalDocument();if(document.warning)toast(document.warning,true);if(name==='archive-download')download('我的个人主档案.md',document.markdown,'text/markdown;charset=utf-8');else {await navigator.clipboard.writeText(document.markdown);toast('完整主档案已复制');}}
    if(name==='archive-context')showModal('准备给 AI 的上下文',`<label class="field">本次希望 AI 完成什么<textarea id="archive-request" rows="4" placeholder="例如：按照我的表达偏好，整理今天的工作总结"></textarea></label><label class="field">使用范围<select id="archive-scope"><option value="compact">精简：已确认档案、当前事项、最近7篇记录</option><option value="full">完整：含资料、待确认项与全部历史（状态会标明）</option></select></label><p class="hint">只在本机准备文本，不会发送给外部模型。请按目标 AI 的上下文容量选择范围。</p><p class="form-error" id="form-error" role="alert"></p>`,action('archive-generate','生成上下文','','primary'),true);
    if(name==='archive-generate'){const request=$('#archive-request').value;if(!request.trim())throw new Error('请先填写本次需求');const text=buildPersonalDocument(data(),{compact:$('#archive-scope').value==='compact',request});showModal('AI 上下文已准备',`<p class="hint">可复制或下载后交给你选择的 AI；这是输入材料，不是 AI 答复。</p><textarea class="master-document" id="archive-result" aria-label="AI 上下文" readonly>${esc(text)}</textarea>`,action('archive-result-copy','复制上下文')+action('archive-result-download','下载上下文','','primary'),true);}
    if(name==='archive-result-copy'){await navigator.clipboard.writeText($('#archive-result').value);toast('上下文已复制');}
    if(name==='archive-result-download')download('我的AI上下文.md',$('#archive-result').value,'text/markdown;charset=utf-8');
    return true;
  }
  return { page:archivePage,submit,action:handle };
}

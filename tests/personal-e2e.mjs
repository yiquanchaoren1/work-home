import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';
import {seedData} from '../public/seed.js';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-personal-e2e-'));
let server,browser,base,passed=0;
const start=async(port=0)=>{server=await createWorkHubServer({dataDir:path.join(dir,'data')});await new Promise(r=>server.listen(port,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;};
const stop=async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));};
try {
  await start();browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  const page=await context.newPage(),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')external.push(r.url());});
  const state=async()=>{const r=await fetch(base+'/api/state');assert.equal(r.status,200);return r.json();};
  const go=async hash=>{await page.goto(base+'/#'+hash,{waitUntil:'networkidle'});await page.locator('#content h1').waitFor();};
  const act=name=>page.locator('[data-action="'+name+'"]');
  const field=name=>page.locator('#modal [name="'+name+'"]');
  const save=async()=>{await page.locator('#modal button[type=submit]').click();await page.locator('#modal').waitFor({state:'hidden'});};
  const download=async action=>{const pending=page.waitForEvent('download');await action();const file=await pending;return fs.readFile(await file.path(),'utf8');};
  const check=async(name,fn)=>{await fn();console.log('PASS '+name);passed++;};
  let confirmedId,pendingId,journalId;
  const pdfBytes=()=>{
    const paint='BT /F1 14 Tf 10 50 Td (Portable personal profile) Tj ET\n';
    const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 250 100] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(paint)} >>\nstream\n${paint}endstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
    let text='%PDF-1.4\n';const offsets=[0];for(const [i,obj]of objects.entries()){offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${obj}\nendobj\n`;}const start=Buffer.byteLength(text);text+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;return Buffer.from(text);
  };
  await check('existing interface and confirmed profile save persist exact text without executing HTML',async()=>{
    await go('dashboard');for(const key of ['tasks','links','notes','activity'])assert.equal(await page.locator('#navigation a[href="#'+key+'"]').count(),1);assert.equal(await page.locator('#navigation a[href="#records"]').count(),0);
    await go('profile');await act('personal-new').click();await field('title').fill('我的回答习惯');await field('kind').selectOption('preference');await field('body').fill('先给结论。\n<script>window.__bad=true</script>');await save();
    const current=await state();confirmedId=current.data.personal.entries[0].id;assert.equal(current.data.personal.entries[0].status,'confirmed');assert.equal(await page.evaluate(()=>window.__bad),undefined);assert.match(await page.locator('.archive-prose').textContent(),/<script>/);
    await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('[data-entry-id]').count(),1);
  });
  await check('profile material reuses upload, extracts Markdown to pending and protects dirty drafts',async()=>{
    await act('personal-upload').click();assert.equal(await field('document-category').inputValue(),'个人档案材料');
    await page.locator('#document-files').setInputFiles({name:'我的介绍.md',mimeType:'text/markdown',buffer:Buffer.from('# 我的介绍\n\n候选偏好独有内容。\n')});
    await page.waitForFunction(()=>!document.querySelector('[data-action="confirm-documents"]').disabled);await act('confirm-documents').click();await page.locator('#modal').waitFor({state:'hidden'});
    assert.equal(new URL(page.url()).hash,'#profile');await act('personal-extract').click();assert.equal(await field('status').inputValue(),'pending');await field('title').fill('待核对的介绍');
    page.once('dialog',d=>d.dismiss());await act('close').last().click();assert.equal(await page.locator('#modal').isVisible(),true);assert.equal(await field('title').inputValue(),'待核对的介绍');await save();
    pendingId=(await state()).data.personal.entries.find(e=>e.status==='pending').id;assert.ok((await state()).data.personal.entries.find(e=>e.id===pendingId).sourceNoteId);
  });
  await check('journal saves associations, all fields, edits and revisions without changing existing task order',async()=>{
    await go('journal');await act('journal-new').click();await field('title').fill('真实工作小结');await field('work').fill('核对了参数。\n保留第二行');await field('conclusion').fill('只核对源码，还未运行');await field('learning').fill('本次收获');await field('nextStep').fill('准备测试输入');await field('taskIds').first().check();await save();
    journalId=(await state()).data.personal.journals[0].id;await act('journal-edit').click();await field('problems').fill('环境仍需确认');await save();
    const current=(await state()).data;assert.equal(current.personal.journals[0].history.length,1);assert.deepEqual(current.tasks,seedData.tasks);assert.deepEqual(current.personal.journals[0].taskIds,[seedData.tasks[0].id]);
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:1440,height:1000});
  });
  await check('PDF and UTF-8 text materials extract locally without losing original bytes',async()=>{
    await go('profile');await act('personal-upload').click();
    await page.locator('#document-files').setInputFiles([{name:'原始档案.pdf',mimeType:'application/pdf',buffer:pdfBytes()},{name:'偏好.txt',mimeType:'text/plain',buffer:Buffer.from('中文偏好\n原始第二行')}]);
    await page.waitForFunction(()=>!document.querySelector('[data-action="confirm-documents"]').disabled);await act('confirm-documents').click();await page.locator('#modal').waitFor({state:'hidden'});
    const notes=(await state()).data.notes,doc=notes.find(n=>n.sourceName==='原始档案.pdf'),txt=notes.find(n=>n.sourceName==='偏好.txt');
    await page.locator('[data-action="personal-extract"][data-id="'+doc.id+'"]').click();await field('body').waitFor();assert.match(await field('body').inputValue(),/Portable personal profile/);page.once('dialog',d=>d.accept());await act('close').last().click();
    await page.locator('[data-action="personal-extract"][data-id="'+txt.id+'"]').click();assert.equal(await field('body').inputValue(),'中文偏好\n原始第二行');page.once('dialog',d=>d.accept());await act('close').last().click();
    assert.deepEqual(Buffer.from(await(await fetch(base+'/api/files/'+doc.attachment.id)).arrayBuffer()),pdfBytes());
  });
  await check('full Markdown and scoped AI context download real data; pending preference is excluded from compact context',async()=>{
    await go('portable');const full=await download(()=>act('archive-download').click());assert.ok(full.includes('核对了参数。\n保留第二行'));assert.ok(full.includes('候选偏好独有内容'));assert.ok(full.includes('我的回答习惯'));
    const current=await state();assert.equal(await fs.readFile(current.masterPath,'utf8'),full);
    await act('archive-context').first().click();await page.locator('#archive-request').fill('按照我的偏好写一段日报');await act('archive-generate').click();const text=await page.locator('#archive-result').inputValue();assert.ok(text.includes('先给结论'));assert.ok(!text.includes('候选偏好独有内容'));assert.ok(text.includes('按照我的偏好写一段日报'));await act('close').last().click();
    await go('profile');await page.locator('[data-entry-id="'+pendingId+'"] [data-action="personal-confirm"]').click();await page.waitForFunction(async()=>{const s=await(await fetch('/api/state')).json();return s.data.personal.entries.every(e=>e.status==='confirmed');});assert.equal((await state()).data.personal.entries.find(e=>e.id===pendingId).history.length,1);
  });
  await check('stale profile save and network failure retain editable drafts and committed state',async()=>{
    const second=await context.newPage();await second.goto(base+'/#profile',{waitUntil:'networkidle'});await second.locator('[data-entry-id="'+confirmedId+'"] [data-action="personal-edit"]').click();await second.locator('[name="body"]').fill('旧窗口草稿');
    await page.locator('[data-entry-id="'+confirmedId+'"] [data-action="personal-edit"]').click();await field('body').fill('更新后的正确偏好');await save();
    await second.locator('#modal button[type=submit]').click();await second.locator('#reload-conflict').waitFor();assert.equal(await second.locator('[name=body]').inputValue(),'旧窗口草稿');assert.equal((await state()).data.personal.entries.find(e=>e.id===confirmedId).body,'更新后的正确偏好');
    second.once('dialog',d=>d.accept());await second.close({runBeforeUnload:false});
    await go('journal');await act('journal-edit').click();await field('work').fill('断网时的每日记录草稿');await page.route('**/api/state',route=>route.request().method()==='PUT'?route.abort():route.continue());await page.locator('#modal button[type=submit]').click();await page.locator('#form-error').filter({hasText:'无法连接'}).waitFor();assert.equal(await field('work').inputValue(),'断网时的每日记录草稿');assert.equal((await state()).data.personal.journals[0].work,'核对了参数。\n保留第二行');await page.unroute('**/api/state');page.once('dialog',d=>d.accept());await act('close').last().click();
  });
  await check('service restart and delete preserve old workspace and remove deleted personal content from current master',async()=>{
    const port=server.address().port;await stop();await start(port);await go('profile');assert.equal(await page.locator('[data-entry-id]').count(),2);
    await page.locator('[data-entry-id="'+pendingId+'"] [data-action="personal-delete"]').click();await act('personal-delete-confirm').click();await page.locator('#modal').waitFor({state:'hidden'});
    const current=(await state()).data;assert.deepEqual(current.tasks,seedData.tasks);assert.deepEqual(current.notes.slice(0,seedData.notes.length),seedData.notes);assert.equal(current.personal.journals[0].id,journalId);assert.equal(current.personal.entries.some(e=>e.id===pendingId),false);
    const archive=await(await fetch(base+'/api/personal-document')).json();assert.ok(!archive.markdown.includes('待核对的介绍'));assert.ok(archive.markdown.includes('我的介绍'),'original material must remain');
  });
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(`Personal archive E2E complete: ${passed} groups passed; isolated data only.`);
} finally {
  if(browser)await browser.close();if(server.listening)await stop();assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});
}

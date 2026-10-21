import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-document-drop-'));
const cloud=process.env.WORK_HUB_DROP_CLOUD==='1';
let server,browser,count=0,serial=0;
try {
  server=await createWorkHubServer({dataDir:path.join(dir,'data'),workspaceRoot:dir,automaticArchives:false,...(cloud?{publicDir:path.resolve('dist-cloud')}:{})});
  const first=await server.workspace.getState(),data={version:1,tasks:[],links:[],notes:[],records:[],activity:[],settings:{name:'拖放测试'}};
  await server.workspace.putState({revision:first.revision,data});
  const remote=new Map([['workspace.json',{sha:'fixture-0',bytes:Buffer.from(JSON.stringify({revision:'fixture-0',data}))}]]);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/';
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(cloud)await context.route('https://api.github.com/**',async route=>{
    const request=route.request(),url=new URL(request.url()),marker='/contents/',offset=url.pathname.indexOf(marker),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,PUT,OPTIONS'};
    const respond=(status,body)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
    if(request.method()==='OPTIONS')return respond(204,{});
    assert.equal(request.headers().authorization,'Bearer drop-test-only');
    if(offset<0)return respond(200,{private:true,archived:false,default_branch:'master'});
    const name=decodeURIComponent(url.pathname.slice(offset+marker.length)),prior=remote.get(name);
    if(request.method()==='PUT'){
      const body=request.postDataJSON();if(body.sha!==prior?.sha)return respond(409,{});
      const next={sha:'fixture-'+ ++serial,bytes:Buffer.from(body.content,'base64')};remote.set(name,next);return respond(200,{content:{sha:next.sha}});
    }
    return prior?respond(200,{type:'file',sha:prior.sha,encoding:'base64',content:prior.bytes.toString('base64')}):respond(404,{});
  });
  const state=async()=>cloud?JSON.parse(remote.get('workspace.json').bytes.toString()).data:(await server.workspace.getState()).data;
  const check=async(name,run)=>{await run();count++;console.log('PASS '+name);};
  const action=name=>page.locator(`[data-action="${name}"]`);
  const modal=page.locator('#modal');
  const drop=async(selector,files)=>page.locator(selector).evaluate((element,files)=>{
    const dt=new DataTransfer();for(const file of files)dt.items.add(new File([new Uint8Array(file.bytes)],file.name,{type:file.type||'text/plain'}));
    element.dispatchEvent(new DragEvent('dragenter',{bubbles:true,cancelable:true,dataTransfer:dt}));
    const over=new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt});element.dispatchEvent(over);
    const event=new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt});element.dispatchEvent(event);return {prevented:event.defaultPrevented,over:over.defaultPrevented};
  },files);
  const file=(name,text,type='text/markdown')=>({name,type,bytes:[...Buffer.from(text)]});
  const ready=()=>page.waitForFunction(()=>!document.querySelector('[data-action="confirm-documents"]')?.disabled&&!!document.querySelector('#document-upload-preview .document-row'));
  await page.goto(base+'#notes',{waitUntil:'networkidle'});
  if(cloud){await page.getByLabel('GitHub 访问密钥',{exact:true}).fill('drop-test-only');await page.getByRole('button',{name:'连接私有资料',exact:true}).click();}
  await page.waitForFunction(()=>document.querySelector('#workspace-name')?.textContent==='拖放测试');
  await check('text drags are not intercepted',async()=>{
    assert.equal(await page.locator('#content').evaluate(el=>{const dt=new DataTransfer();dt.setData('text/plain','selected text');const e=new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt});el.dispatchEvent(e);return e.defaultPrevented;}),false);assert.equal(await modal.evaluate(el=>el.open),false);
  });
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lD8AAAAASUVORK5CYII=','base64');
  const files=[file('记录.md','# 拖入的记录\n\n保留正文。'),file('说明.txt','文本原文','text/plain'),file('资料.pdf','%PDF-1.4\nfixture','application/pdf'),{name:'图片.png',type:'image/png',bytes:[...png]}];
  await check('drop multiple document types on the knowledge page, preview without saving, then preserve original bytes',async()=>{
    assert.deepEqual(await drop('#content',files),{prevented:true,over:true});await ready();assert.equal(await page.locator('#document-upload-preview .document-row').count(),4);assert.equal((await state()).notes.length,0);
    await action('confirm-documents').click();await modal.waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelectorAll('.note-card').length===4);
    if(cloud)await page.waitForFunction(()=>document.querySelector('#background-sync')?.hidden===true);
    const saved=(await state()).notes;assert.equal(saved.length,4);assert.equal(saved.find(n=>n.title==='拖入的记录').body,'# 拖入的记录\n\n保留正文。');
    for(const input of files.slice(1)){const note=saved.find(n=>n.sourceName===input.name);assert.ok(note.attachment);const bytes=cloud?remote.get('files/'+note.attachment.id+'.bin').bytes:await fs.readFile(path.join(dir,'data','files',note.attachment.id+'.bin'));assert.deepEqual(bytes,Buffer.from(input.bytes));}
  });
  await check('drop into the upload dialog, replace the preview with a new selection, and cancel without saving',async()=>{
    await action('upload-documents').click();await drop('.upload-zone',[file('first.md','# 第一次')]);await ready();assert.equal(await page.locator('[data-document-index="0"]').inputValue(),'第一次');
    await drop('.upload-zone',[file('second.md','# 第二次')]);await ready();await page.waitForFunction(()=>document.querySelector('[data-document-index="0"]')?.value==='第二次');
    await action('close').last().click();assert.equal((await state()).notes.length,4);
  });
  await check('file chooser and size validation remain available',async()=>{
    await action('upload-documents').click();await page.locator('#document-files').setInputFiles({name:'选择文件.md',mimeType:'text/markdown',buffer:Buffer.from('# 保留按钮')});await ready();assert.equal(await page.locator('[data-document-index="0"]').inputValue(),'保留按钮');
    await drop('.upload-zone',[{name:'large.md',type:'text/markdown',bytes:new Array(2*1024*1024+1).fill(65)}]);await page.waitForFunction(()=>document.querySelector('#form-error')?.textContent.includes('2 MB'));assert.equal(await action('confirm-documents').isDisabled(),true);await action('close').last().click();
  });
  await check('file drops outside knowledge upload cannot replace the page or overwrite an editor',async()=>{
    await page.locator('[data-action="new"][data-collection="notes"]').click();await page.locator('#document-body').fill('未保存草稿');
    assert.equal((await drop('#document-body',[file('blocked.md','# 不应导入')])).prevented,true);assert.equal(await page.locator('#document-body').inputValue(),'未保存草稿');
    page.once('dialog',d=>d.accept());await action('close').last().click();await page.evaluate(()=>location.hash='tasks');await page.waitForFunction(()=>document.body.dataset.page==='tasks');
    assert.equal((await drop('#content',[file('blocked.md','# 不应导入')])).prevented,true);assert.equal(await modal.evaluate(el=>el.open),false);assert.equal((await state()).notes.length,4);
  });
  assert.deepEqual(errors,[]);console.log(`Document drop E2E: ${count} groups, ${cloud?'mocked cloud':'isolated disk'}, no real user data.`);
}finally{
  if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});
}

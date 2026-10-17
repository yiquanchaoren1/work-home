import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';
import {seedData} from '../public/seed.js';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-performance-'));
let server,browser,passed=0,serial=0,latency=0,failWrites=false;
const files=new Map(),calls=[],measurements=[],inFlight=new Set(),at='2026-10-17T00:00:00Z';
const install=(name,value)=>files.set(name,{bytes:Buffer.from(typeof value==='string'?value:JSON.stringify(value)),sha:'sha-'+(++serial)});
const data=structuredClone(seedData);
data.settings={...data.settings,design:'experimental',theme:'light'};
data.notes=[{id:'fast-note',title:'响应速度测试文档',format:'markdown',body:'# 会话中的文档\n\n这是隔离的测试正文。',category:'其他',tags:[],pinned:false,taskId:'',createdAt:at,updatedAt:at}];
for(let i=0;i<5;i++){
  const bytes=Buffer.from('fixture file'),meta={id:crypto.randomUUID(),name:'fixture-'+i+'.txt',type:'text/plain',size:bytes.length};
  data.notes.push({id:'file-note-'+i,title:'隔离附件'+i,format:'text',body:'',category:'其他',tags:[],pinned:false,taskId:'',createdAt:at,updatedAt:at,attachment:meta});
  install('files/'+meta.id+'.json',{...meta,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});files.set('files/'+meta.id+'.bin',{bytes,sha:'sha-'+(++serial)});
}
install('workspace.json',{revision:'initial',data});
for(let day=1;day<=10;day++)install('codex-worklogs/2026-10-'+String(day).padStart(2,'0')+'.md','# 每日摘要\n\n- 隔离的已核实工作。');
install('codex-worklogs/我的个人档案.md','# 会话中的档案\n\n- 明确的示例偏好。');
const state=()=>JSON.parse(files.get('workspace.json').bytes).data;
const settle=page=>page.waitForFunction(()=>!document.body.dataset.saving);
async function quiet(){let stable=0,previous=-1;for(let i=0;i<400;i++){if(!inFlight.size&&calls.length===previous)stable++;else stable=0;previous=calls.length;if(stable>=3)return;await new Promise(r=>setTimeout(r,100));}throw new Error('Mock network did not settle.');}
try{
  let base=process.env.WORK_HUB_PERF_URL;
  if(!base){
    server=await createWorkHubServer({dataDir:path.join(dir,'data'),publicDir:path.resolve('dist-cloud')});
    const handle=server.listeners('request')[0];server.removeAllListeners('request');
    server.on('request',(req,res)=>{if(!req.url.startsWith('/work-home/')){res.writeHead(404);res.end();return;}req.url=req.url.slice('/work-home'.length);handle(req,res);});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port+'/work-home/';
  }
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  await context.route('https://api.github.com/**',async route=>{
    const req=route.request(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'accept,authorization,content-type,x-github-api-version','access-control-allow-methods':'GET,PUT,OPTIONS'};
    const fulfill=async(status,value)=>{try{return await route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(value)});}finally{inFlight.delete(req);}};
    if(req.method()==='OPTIONS')return fulfill(204,{});
    inFlight.add(req);
    assert.equal(req.headers().authorization,'Bearer test-only-token');
    const url=new URL(req.url()),marker='/contents/',index=url.pathname.indexOf(marker);
    const name=index<0?'repo-meta':url.pathname.slice(index+marker.length).split('/').map(decodeURIComponent).join('/');
    calls.push({page:req.frame().page(),name,method:req.method()});
    if(latency)await new Promise(r=>setTimeout(r,latency));
    if(index<0)return fulfill(200,{private:true,archived:false});
    if(req.method()==='PUT'){
      if(failWrites)return fulfill(500,{});
      const body=req.postDataJSON(),old=files.get(name);if(old?.sha!==body.sha)return fulfill(409,{});
      install(name,Buffer.from(body.content,'base64').toString('utf8'));return fulfill(200,{content:{sha:files.get(name).sha}});
    }
    const item=files.get(name);
    if(item)return fulfill(200,{type:'file',sha:item.sha,encoding:'base64',content:item.bytes.toString('base64')});
    const children=[...files.keys()].filter(p=>p.startsWith(name+'/')&&!p.slice(name.length+1).includes('/'));
    return children.length?fulfill(200,children.map(p=>({name:p.slice(name.length+1),type:'file',sha:files.get(p).sha}))):fulfill(404,{});
  });
  const check=async(name,operation)=>{await operation();passed++;console.log('PASS '+name);};
  await page.goto(base,{waitUntil:'networkidle'});
  await page.getByLabel('GitHub 访问密钥',{exact:true}).fill('test-only-token');
  await page.getByRole('button',{name:'连接私有资料',exact:true}).click();
  await page.locator('.gallery-cover').waitFor();await quiet();

  await check('theme paints before delayed persistence, remains marked pending, and uses only three requests',async()=>{
    latency=350;const offset=calls.length,start=Date.now();
    await page.locator('.topbar [data-action="theme-toggle"]').click();
    await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
    const paint=Date.now()-start;
    assert.equal(state().settings.theme,'light');assert.equal(await page.locator('body').getAttribute('data-saving'),'true');
    assert.equal(await page.locator('#theme-picker-button').isEnabled(),true);
    await page.locator('#navigation a[href="#notes"]').click();await page.getByRole('heading',{name:'知识库',exact:true}).waitFor();
    await settle(page);assert.equal(state().settings.theme,'dark');
    // Background archive refresh is deliberately independent of the save's critical path.
    const operation=calls.slice(offset).filter(c=>c.page===page&&!c.name.startsWith('codex-worklogs'));assert.equal(operation.length,3,JSON.stringify(operation.map(c=>({name:c.name,method:c.method}))));assert.equal(operation.filter(c=>c.name.startsWith('files/')).length,0);
    measurements.push({operation:'theme-save',perRequestMs:latency,paintMs:paint,totalMs:Date.now()-start,requests:operation.length});
  });

  await check('failed background theme saves retain an explicit draft without claiming cloud success',async()=>{
    const before=Buffer.from(files.get('workspace.json').bytes);failWrites=true;
    await page.locator('#theme-picker-button').click();await page.locator('#modal [data-design-id="gallery"]').click();
    await page.waitForFunction(()=>document.documentElement.dataset.design==='gallery');
    assert.equal(await page.locator('body').getAttribute('data-saving'),'true');
    await page.locator('#background-sync.is-error').getByText(/GitHub 操作失败/).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-design'),'gallery');
    assert.deepEqual(files.get('workspace.json').bytes,before);failWrites=false;
    page.once('dialog',dialog=>dialog.accept());await page.locator('#background-sync [data-sync-action="discard"]').click();await settle(page);
    assert.equal(await page.locator('html').getAttribute('data-design'),'experimental');
  });

  await check('text reader paints shared content before GitHub replies and never loads unrelated archives',async()=>{
    latency=1000;const start=Date.now(),popup=page.waitForEvent('popup');
    await page.locator('a[href="./document.html?id=fast-note"]').first().click();const reader=await popup;
    await reader.locator('.markdown-body h1').waitFor();const paint=Date.now()-start;
    assert.match(await reader.locator('.reader-storage-warning').textContent(),/正在核对/);
    await reader.waitForFunction(()=>!document.querySelector('.reader-storage-warning'));
    const readerCalls=calls.filter(c=>c.page===reader);assert.equal(readerCalls.length,2);assert.equal(readerCalls.filter(c=>c.name.startsWith('codex-worklogs')).length,0);
    measurements.push({operation:'shared-text-reader',perRequestMs:latency,paintMs:paint,verifiedMs:Date.now()-start,requests:readerCalls.length});
    await reader.close();await quiet();
  });

  await check('archive reader paints a shared preview and refreshes only the requested source',async()=>{
    latency=0;await page.evaluate(()=>location.hash='archives');await quiet();
    install('codex-worklogs/我的个人档案.md','# 远端修订的档案\n\n- 新的已核实内容。');latency=1000;
    const start=Date.now(),popup=page.waitForEvent('popup');await page.locator('a[href="./daily-archive.html?archive=profile"]').first().click();const reader=await popup;
    await reader.locator('.markdown-body h1').waitFor();const paint=Date.now()-start;
    assert.match(await reader.locator('.reader-refresh-warning').textContent(),/正在核对/);
    await reader.locator('.markdown-body h1').filter({hasText:'远端修订的档案'}).waitFor();
    const readerCalls=calls.filter(c=>c.page===reader);assert.equal(readerCalls.length,3);
    assert.deepEqual(readerCalls.map(c=>c.name),['repo-meta','workspace.json','codex-worklogs/我的个人档案.md']);
    measurements.push({operation:'shared-archive-reader',perRequestMs:latency,paintMs:paint,verifiedMs:Date.now()-start,requests:readerCalls.length});
    await reader.close();latency=0;await quiet();
  });

  await check('task status updates during a save; concurrent edits retain a local draft and never overwrite',async()=>{
    await page.evaluate(()=>location.hash='tasks');const id=state().tasks[0].id;
    latency=350;const offset=calls.length,start=Date.now();
    await page.locator(`[data-task-status="${id}"]`).first().selectOption('进行中');
    await page.waitForFunction(()=>document.body.dataset.saving==='true');assert.notEqual(state().tasks[0].status,'进行中');
    assert.equal(await page.locator(`[data-task-status="${id}"]`).first().inputValue(),'进行中');
    await settle(page);assert.equal(state().tasks[0].status,'进行中');
    measurements.push({operation:'task-save',perRequestMs:latency,totalMs:Date.now()-start,requests:calls.slice(offset).filter(c=>c.page===page).length});
    await page.locator(`[data-action="task-peek"][data-id="${id}"]`).first().click();
    await page.locator(`#modal [data-action="edit"][data-collection="tasks"][data-id="${id}"]`).click();
    await page.locator('#editor-form [name="title"]').fill('需要保留的未保存修改');
    const other=JSON.parse(files.get('workspace.json').bytes);other.revision='other-device';other.data.settings.name='其他设备保存的名称';install('workspace.json',other);
    await page.locator('button[form="editor-form"]').click();await page.locator('#modal').waitFor({state:'hidden'});await page.locator('#background-sync').getByText(/其他设备已更新/).waitFor();
    assert.ok(await page.locator('#content').getByText('需要保留的未保存修改',{exact:true}).count());
    assert.equal(state().settings.name,'其他设备保存的名称');assert.notEqual(state().tasks[0].title,'需要保留的未保存修改');
    assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.deepEqual(await context.cookies(),[]);assert.deepEqual(errors,[]);
    await page.screenshot({path:'artifacts/performance-conflict.png'});
  });
  await fs.writeFile('artifacts/performance-verification.json',JSON.stringify({source:process.env.WORK_HUB_PERF_URL?'live frontend with mocked GitHub':'local cloud build with mocked GitHub',passed,measurements,errors},null,2));
  console.log(JSON.stringify({passed,measurements}));
}finally{
  if(browser)await browser.close();
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});
}

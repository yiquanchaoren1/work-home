import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';
import {seedData} from '../public/seed.js';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-background-'));
let server,browser,serial=0,passed=0,hold=false,fail=false,loseAck=false,failReads=false,accepted=0;
const files=new Map(),gates=[],measurements=[],calls=[];
const install=(name,value)=>files.set(name,{bytes:Buffer.from(typeof value==='string'?value:JSON.stringify(value)),sha:'s'+(++serial)});
const initial=structuredClone(seedData),at='2026-10-17T00:00:00Z';
initial.settings={...initial.settings,design:'experimental',theme:'light'};
initial.notes=[{id:'original-note',title:'原文档',body:'# 原始正文\n\n不会被其他事项修改。',format:'markdown',category:'其他',tags:[],pinned:false,taskId:'',createdAt:at,updatedAt:at}];
install('workspace.json',{revision:'initial',data:initial});
const state=()=>JSON.parse(files.get('workspace.json').bytes).data;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const until=async(test)=>{for(let i=0;i<200;i++){if(test())return;await sleep(50);}throw Error('Timed out waiting for mock upload.');};
const release=()=>{hold=false;for(const resolve of gates.splice(0))resolve();};
try{
  let base=process.env.WORK_HUB_SYNC_URL;
  if(!base){
    server=await createWorkHubServer({dataDir:path.join(dir,'data'),publicDir:path.resolve('dist-cloud')});
    const handle=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(req,res)=>{if(!req.url.startsWith('/work-home/')){res.writeHead(404);res.end();return;}req.url=req.url.slice('/work-home'.length);handle(req,res);});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port+'/work-home/';
  }
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  await context.route('https://api.github.com/**',async route=>{
    const req=route.request(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'accept,authorization,content-type,x-github-api-version','access-control-allow-methods':'GET,PUT,OPTIONS'};
    const respond=(status,body)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
    if(req.method()==='OPTIONS')return respond(204,{});
    assert.equal(req.headers().authorization,'Bearer test-only-token');
    const url=new URL(req.url()),marker='/contents/',index=url.pathname.indexOf(marker),name=index<0?'repo-meta':decodeURIComponent(url.pathname.slice(index+marker.length));
    calls.push({page:req.frame().page(),method:req.method(),name});
    if(failReads&&req.method()==='GET')return route.abort();
    if(index<0)return respond(200,{private:true,archived:false});
    if(req.method()==='PUT'){
      if(hold)await new Promise(resolve=>gates.push(resolve));
      if(fail)return respond(500,{});
      const body=req.postDataJSON(),old=files.get(name);if(body.sha!==old?.sha)return respond(409,{});
      install(name,Buffer.from(body.content,'base64').toString('utf8'));accepted++;
      if(loseAck){loseAck=false;return route.abort();}
      return respond(200,{content:{sha:files.get(name).sha}});
    }
    const item=files.get(name);if(!item)return respond(404,{});
    return respond(200,{type:'file',sha:item.sha,encoding:'base64',content:item.bytes.toString('base64')});
  });
  const check=async(name,operation)=>{await operation();passed++;console.log('PASS '+name);};
  const idle=()=>page.waitForFunction(()=>!document.body.dataset.saving);
  const go=async route=>{await page.evaluate(value=>location.hash=value,route);await page.waitForFunction(value=>document.body.dataset.page===value.split('/')[0],route);};
  const edit=async(id,title)=>{
    await go('tasks');await page.locator(`[data-action="task-peek"][data-id="${id}"]`).first().click();await page.locator('#modal [data-action="edit"]').click();
    await page.locator('#editor-form [name="title"]').fill(title);
  };
  await page.goto(base,{waitUntil:'networkidle'});await page.getByLabel('GitHub 访问密钥',{exact:true}).fill('test-only-token');await page.getByRole('button',{name:'连接私有资料',exact:true}).click();await page.locator('.gallery-cover').waitFor();
  const firstId=state().tasks[0].id,secondId=state().tasks[1].id,originalNotes=structuredClone(state().notes);

  await check('task editor closes before upload and later edits survive acknowledgement of an older snapshot',async()=>{
    hold=true;await edit(firstId,'第一项即时修改');const start=Date.now();
    await page.locator('button[form="editor-form"]').click();await page.locator('#modal').waitFor({state:'hidden'});const closeMs=Date.now()-start;
    assert.notEqual(state().tasks.find(t=>t.id===firstId).title,'第一项即时修改');await until(()=>gates.length===1);
    await page.locator(`[data-task-status="${secondId}"]`).selectOption('进行中');
    await edit(firstId,'第二稿仍可编辑');await page.locator('#editor-form [name="nextStep"]').fill('继续推进，不等待远端');await page.locator('button[form="editor-form"]').click();await page.locator('#modal').waitFor({state:'hidden'});
    await page.locator('#theme-picker-button').click();await page.locator('#modal [data-design-id="gallery"]').click();await page.locator('#modal').waitFor({state:'hidden'});
    await page.locator('#background-sync').getByText(/4 项更改/).waitFor();
    const queued=4,before=accepted;gates.shift()();await until(()=>gates.length===1&&accepted===before+1);
    assert.ok(await page.locator('#content').getByText('第二稿仍可编辑',{exact:true}).count());assert.equal(await page.locator('html').getAttribute('data-design'),'gallery');
    release();await idle();
    assert.equal(state().tasks.find(t=>t.id===firstId).title,'第二稿仍可编辑');assert.equal(state().tasks.find(t=>t.id===firstId).nextStep,'继续推进，不等待远端');assert.equal(state().tasks.find(t=>t.id===secondId).status,'进行中');assert.equal(state().settings.design,'gallery');assert.deepEqual(state().notes,originalNotes);
    assert.equal(accepted-before,2);measurements.push({operation:'four edits during a held upload',editorClosedMs:closeMs,queued,uploads:2});
  });

  await check('failed uploads retain an editable draft, protect page close, download it, and retry the latest version',async()=>{
    fail=true;await edit(firstId,'失败后仍保留的修改');await page.locator('button[form="editor-form"]').click();await page.locator('#modal').waitFor({state:'hidden'});await page.locator('#background-sync.is-error').waitFor();
    const before=accepted;await page.locator(`[data-task-status="${firstId}"]`).selectOption('已完成');await page.locator('#background-sync').getByText(/2 项更改/).waitFor();assert.equal(accepted,before);
    const download=page.waitForEvent('download');await page.locator('#background-sync [data-sync-action="draft"]').click();const draft=JSON.parse(await fs.readFile(await (await download).path(),'utf8'));
    assert.equal(draft.tasks.find(t=>t.id===firstId).title,'失败后仍保留的修改');assert.equal(draft.tasks.find(t=>t.id===firstId).status,'已完成');assert.ok(draft.pendingSync.items.length>=2);
    assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});dispatchEvent(e);return e.defaultPrevented;}),true);
    fail=false;await page.locator('#background-sync [data-sync-action="retry"]').click();await idle();assert.equal(state().tasks.find(t=>t.id===firstId).status,'已完成');assert.equal(state().tasks.find(t=>t.id===firstId).title,'失败后仍保留的修改');
  });

  await check('lost PUT response is reconciled before retrying instead of adding a duplicate cloud commit',async()=>{
    const before=accepted;loseAck=true;await edit(firstId,'回应丢失但已上传');await page.locator('button[form="editor-form"]').click();await page.locator('#background-sync.is-error').waitFor();assert.equal(accepted,before+1);
    await page.locator('#background-sync [data-sync-action="retry"]').click();await idle();assert.equal(accepted,before+1);assert.equal(state().tasks.find(t=>t.id===firstId).title,'回应丢失但已上传');
  });

  await check('a device conflict pauses all pending work, and cancellation or failed reload cannot discard it',async()=>{
    const other=JSON.parse(files.get('workspace.json').bytes);other.revision='external-revision';other.data.settings.name='其他设备的新名称';install('workspace.json',other);const before=accepted;
    await edit(firstId,'冲突中保留的本地标题');await page.locator('button[form="editor-form"]').click();await page.locator('#background-sync').getByText(/其他设备已更新/).waitFor();assert.equal(accepted,before);assert.equal(state().settings.name,'其他设备的新名称');
    await page.locator('#background-sync [data-sync-action="retry"]').click();await page.locator('#background-sync').getByText(/未覆盖云端/).waitFor();assert.equal(accepted,before);
    page.once('dialog',d=>d.dismiss());await page.locator('#background-sync [data-sync-action="discard"]').click();assert.ok(await page.locator('#content').getByText('冲突中保留的本地标题',{exact:true}).count());
    failReads=true;page.once('dialog',d=>d.accept());await page.locator('#background-sync [data-sync-action="discard"]').click();await page.getByText(/无法连接 GitHub/).last().waitFor();assert.ok(await page.locator('#content').getByText('冲突中保留的本地标题',{exact:true}).count());
    failReads=false;page.once('dialog',d=>d.accept());await page.locator('#background-sync [data-sync-action="discard"]').click();await idle();assert.equal(accepted,before);assert.equal(await page.locator('#workspace-name').textContent(),'其他设备的新名称');assert.equal(await page.locator('#content').getByText('冲突中保留的本地标题',{exact:true}).count(),0);
  });

  await check('new Markdown can be read and edited again before upload without regressing to the older cloud body',async()=>{
    hold=true;await go('notes');await page.locator('[data-action="new"][data-collection="notes"]').first().click();await page.locator('#editor-form [name="title"]').fill('尚未上传的新文档');await page.locator('#document-body').fill('# 第一稿未上传\n\n当前页面的正文。');await page.locator('button[form="editor-form"]').click();await page.locator('#modal').waitFor({state:'hidden'});await until(()=>gates.length===1);
    const link=page.locator('a').filter({hasText:'尚未上传的新文档'}).first(),url=await link.getAttribute('href'),id=new URL(url,base).searchParams.get('id');
    const popup=page.waitForEvent('popup');await link.click();const reader=await popup;await reader.locator('.markdown-body h1').filter({hasText:'第一稿未上传'}).waitFor();await reader.locator('.reader-storage-warning').filter({hasText:'待同步内容'}).waitFor();assert.equal(calls.filter(c=>c.page===reader).length,0);
    await page.evaluate(id=>location.hash='notes/edit/'+id,id);await page.locator('#document-body').fill('# 第二稿仍在本地\n\n更新后的正文。');await page.locator('button[form="editor-form"]').click();await page.locator('#modal').waitFor({state:'hidden'});
    await reader.bringToFront();await reader.locator('.markdown-body h1').filter({hasText:'第二稿仍在本地'}).waitFor();
    gates.shift()();await until(()=>gates.length===1);assert.match(state().notes.find(n=>n.id===id).body,/第一稿/);assert.equal(await reader.locator('.markdown-body h1').textContent(),'第二稿仍在本地');
    release();await idle();await reader.waitForFunction(()=>!document.querySelector('.reader-storage-warning'));assert.equal(await reader.locator('.markdown-body h1').textContent(),'第二稿仍在本地');assert.match(state().notes.find(n=>n.id===id).body,/第二稿/);await reader.close();
  });

  await check('pending status and retry controls fit phone layouts and all four existing themes',async()=>{
    hold=true;await go('tasks');await page.locator(`[data-task-status="${firstId}"]`).selectOption('等待反馈');await until(()=>gates.length===1);
    for(const design of ['paper','experimental','gallery','porcelain']){
      await page.setViewportSize({width:390,height:844});await page.locator('#theme-picker-button').click();await page.locator(`#modal [data-design-id="${design}"]`).click();await page.locator('#modal').waitFor({state:'hidden'});
      for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,design+' '+width);}
    }
    await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('.toast[data-pending-feedback]').count()<=1);await page.screenshot({path:'artifacts/background-sync-mobile.png'});release();await idle();
  });

  await check('signout and reconnecting another repository cannot erase or relocate queued changes',async()=>{
    hold=true;await page.setViewportSize({width:1440,height:1000});await edit(firstId,'退出前保留的第一稿');await page.locator('button[form="editor-form"]').click();await until(()=>gates.length===1);await page.locator(`[data-task-status="${firstId}"]`).selectOption('暂缓');
    await go('settings');await page.getByRole('button',{name:'退出并清除此设备',exact:true}).click();await page.getByText(/还有未同步修改，请先同步成功/).waitFor();assert.equal(await page.locator('.cloud-login').count(),0);
    await page.evaluate(()=>{const channel=new BroadcastChannel('work-hub-signout:/work-home/');channel.postMessage({type:'signout'});setTimeout(()=>channel.close(),100);});await page.locator('#background-sync').getByText(/连接已退出/).waitFor();release();await until(()=>!gates.length);await sleep(300);
    assert.equal(await page.locator('.cloud-login').count(),0);await page.locator('#background-sync').getByText(/1 项更改/).waitFor();
    const before=accepted;await page.locator('#background-sync [data-sync-action="retry"]').click();await page.locator('.cloud-login[open]').waitFor();await page.getByLabel('资料仓库',{exact:true}).fill('example/another-private-repo');await page.getByLabel('GitHub 访问密钥',{exact:true}).fill('test-only-token');await page.getByRole('button',{name:'连接私有资料',exact:true}).click();await page.locator('.cloud-login').waitFor({state:'detached'});await page.locator('#background-sync').getByText(/未向其他仓库上传/).waitFor();assert.equal(accepted,before);
    assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.deepEqual(await context.cookies(),[]);assert.deepEqual(errors,[]);
    await page.screenshot({path:'artifacts/background-sync-retained-draft.png'});
  });
  await fs.writeFile('artifacts/background-sync-verification.json',JSON.stringify({source:process.env.WORK_HUB_SYNC_URL?'live frontend with mocked GitHub':'local cloud build with mocked GitHub',passed,measurements,errors,acceptedFixtureUploads:accepted},null,2));
  console.log(JSON.stringify({passed,measurements,acceptedFixtureUploads:accepted}));
}finally{release();if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});}

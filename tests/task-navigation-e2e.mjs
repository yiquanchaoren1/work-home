import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-task-navigation-'));
const cloud=Boolean(process.env.WORK_HUB_NAV_CLOUD||process.env.WORK_HUB_NAV_URL);
let server,browser,passed=0,serial=0;
try {
  server=await createWorkHubServer({dataDir:path.join(dir,'data'),...(cloud?{publicDir:path.resolve('dist-cloud')}:{})});
  const first=await server.workspace.getState(),data=structuredClone(first.data),at='2026-10-19T01:00:00Z';
  data.tasks=[['pending-a','保留 待开始 A','待开始'],['pending-b','另一个事项','待开始'],['progress-a','保留 进行中 A','进行中'],['progress-b','保留 进行中 B','进行中'],['done','其他 已完成','已完成']].map(([id,title,status])=>({id,title,status,type:'开发',summary:'事项说明',nextStep:'继续完成工作',tags:[],linkIds:[],pinned:false,createdAt:at,updatedAt:at}));
  data.notes=[];data.records=[];
  data.links=[{id:'nav-link',title:'测试资料',url:'https://example.com/reference',category:'技术文档',description:'独立的资料筛选',tags:[],taskId:'',pinned:false,createdAt:at,updatedAt:at}];
  await server.workspace.putState({revision:first.revision,data});
  const files=new Map([['workspace.json',{sha:'fixture-0',content:JSON.stringify({revision:'fixture-0',data})}]]);
  if(cloud){const handle=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(req,res)=>{if(!req.url.startsWith('/work-home/')){res.writeHead(404);res.end();return;}req.url=req.url.slice('/work-home'.length);handle(req,res);});}
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=process.env.WORK_HUB_NAV_URL||'http://127.0.0.1:'+server.address().port+(cloud?'/work-home/':'/');
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  if(cloud)await context.route('https://api.github.com/**',async route=>{
    const request=route.request(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'accept,authorization,content-type,x-github-api-version','access-control-allow-methods':'GET,PUT,OPTIONS'};
    const respond=(status,body)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
    if(request.method()==='OPTIONS')return respond(204,{});
    assert.equal(request.headers().authorization,'Bearer navigation-test-only');
    const url=new URL(request.url()),marker='/contents/',offset=url.pathname.indexOf(marker);
    if(offset<0)return respond(200,{private:true,archived:false,default_branch:'master'});
    const name=decodeURIComponent(url.pathname.slice(offset+marker.length)),file=files.get(name);
    if(request.method()==='PUT'){
      const body=request.postDataJSON();if(body.sha!==file?.sha)return respond(409,{});
      files.set(name,{sha:'fixture-'+ ++serial,content:Buffer.from(body.content,'base64').toString('utf8')});
      return respond(200,{content:{sha:files.get(name).sha}});
    }
    return file?respond(200,{type:'file',sha:file.sha,encoding:'base64',content:Buffer.from(file.content).toString('base64')}):respond(404,{});
  });
  const state=async()=>cloud?JSON.parse(files.get('workspace.json').content).data:(await server.workspace.getState()).data;
  const check=async(name,operation)=>{await operation();passed++;console.log('PASS '+name);};
  const idle=()=>page.waitForFunction(()=>!document.body.dataset.saving);
  const tasks=()=>page.waitForFunction(()=>document.body.dataset.page==='tasks');
  const expectList=async(status,ids)=>{
    await tasks();assert.equal(await page.locator('.filter-chip.active').getAttribute('data-value'),status);
    assert.equal(await page.locator('#list-search').inputValue(),'保留');
    assert.deepEqual(await page.locator('#sortable-tasks > .task-card').evaluateAll(cards=>cards.map(card=>card.dataset.taskId)),ids);
  };
  const open=async id=>{await page.locator(`[data-task-id="${id}"] .task-title`).click();await page.waitForFunction(()=>document.body.dataset.page==='detail');};
  const editor=async()=>{await page.locator('#content [data-action="edit"][data-collection="tasks"]').click();await page.locator('#editor-form').waitFor();};
  const back=async()=>{await page.getByRole('link',{name:'返回列表',exact:true}).click();await tasks();};
  await page.goto(base+'#tasks',{waitUntil:'networkidle'});
  if(cloud){await page.getByLabel('GitHub 访问密钥',{exact:true}).fill('navigation-test-only');await page.getByRole('button',{name:'连接私有资料',exact:true}).click();}
  await tasks();await page.locator('.filter-chip[data-value="待开始"]').click();await page.locator('#list-search').fill('保留');
  await check('saving from full details restores the pending filter and search',async()=>{
    await open('pending-a');await editor();await page.locator('#editor-form [name="title"]').fill('保留 待开始 A 已编辑');
    await page.locator('button[form="editor-form"]').click();await page.locator('#modal').waitFor({state:'hidden'});await back();
    await expectList('待开始',['pending-a']);await idle();assert.equal((await state()).tasks.find(task=>task.id==='pending-a').title,'保留 待开始 A 已编辑');
  });
  await check('browser back and forward plus cancelling an edit preserve the in-progress view',async()=>{
    await page.locator('.filter-chip[data-value="进行中"]').click();await open('progress-a');await page.goBack();await expectList('进行中',['progress-a','progress-b']);
    await page.goForward();await page.waitForFunction(()=>document.body.dataset.page==='detail');await editor();await page.locator('#modal [data-action="close"]').first().click();
    await back();await expectList('进行中',['progress-a','progress-b']);
  });
  await check('side-view editing stays on the selected list without a route change',async()=>{
    await page.locator('[data-action="task-peek"][data-id="progress-a"]').click();await page.locator('#modal [data-action="edit"]').click();
    await page.locator('#editor-form [name="nextStep"]').fill('侧览编辑后继续');await page.locator('button[form="editor-form"]').click();await page.locator('#modal').waitFor({state:'hidden'});
    await expectList('进行中',['progress-a','progress-b']);await idle();
  });
  await check('changing status keeps the source filter and only shows tasks that still match',async()=>{
    await open('progress-a');await editor();await page.locator('#editor-form [name="status"]').selectOption('等待反馈');
    await page.locator('button[form="editor-form"]').click();await page.locator('#modal').waitFor({state:'hidden'});await back();await expectList('进行中',['progress-b']);await idle();
    assert.equal((await state()).tasks.find(task=>task.id==='progress-a').status,'等待反馈');
  });
  await check('filters from the link library do not replace the saved task filter or search',async()=>{
    await page.locator('#navigation a[href="#links"]').click();await page.locator('.filter-chip[data-value="技术文档"]').click();await page.locator('#list-search').fill('资料');
    await page.locator('#navigation a[href="#tasks"]').click();await expectList('进行中',['progress-b']);
  });
  await check('phone return and deletion preserve the selected empty view',async()=>{
    await page.setViewportSize({width:390,height:844});await open('progress-b');await back();await expectList('进行中',['progress-b']);await open('progress-b');
    await page.locator('#content [data-action="delete"]').click();await page.locator('#modal [data-action="confirm-delete"]').click();await page.locator('#modal').waitFor({state:'hidden'});
    await expectList('进行中',[]);assert.equal(await page.locator('#sortable-tasks .empty-state').count(),1);await idle();
    assert.equal((await state()).tasks.some(task=>task.id==='progress-b'),false);assert.deepEqual((await state()).links,data.links);assert.deepEqual(errors,[]);
  });
  await page.screenshot({path:`artifacts/task-navigation-${cloud?'cloud':'disk'}.png`,fullPage:true});
  console.log(`Task navigation E2E complete: ${passed} groups, ${cloud?'mocked cloud':'isolated disk'}, no real private data.`);
} finally {
  if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});
}

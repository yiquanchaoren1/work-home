import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';
import {dayKey} from '../public/personal.js';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-gallery-'));
let server,browser,passed=0;
try {
  server=await createWorkHubServer({dataDir:path.join(dir,'data')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port,initial=await server.workspace.getState(),data=structuredClone(initial.data),sourceTasks=structuredClone(initial.data.tasks);
  for(const key of ['tasks','links','notes','activity','dailyArchives','archiveDocuments'])data[key]=[];
  await server.workspace.putState({revision:initial.revision,data});
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let navigation=0;
  const go=async(route='dashboard')=>{await page.goto(base+'/?gallery-check='+ ++navigation+'#'+route,{waitUntil:'networkidle'});await page.locator('#content h1').waitFor();};
  const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
  await check('an empty workspace shows honest empty states and zero counts',async()=>{
    await go();assert.deepEqual(await page.locator('[data-count-key]').allTextContents(),['0','0','0','0']);
    assert.equal(await page.locator('.gallery-focus [data-task-id],.gallery-books .note-card').count(),0);
    await page.getByText('案头暂时没有待推进事项',{exact:true}).waitFor();
    assert.equal(await page.locator('#navigation a[href="#activity"] .nav-count').count(),0);
  });
  const current=await server.workspace.getState(),at=new Date().toISOString(),yesterday=dayKey(new Date(Date.now()-86400000));
  data.tasks=sourceTasks.slice(0,2).map((task,i)=>({...task,title:i?'已经完成的测试事项':'梳理算子实现与组件边界',status:i?'已完成':'进行中',nextStep:'整理源码结论与下一步',linkIds:[]}));
  data.notes=[{id:'gallery-note',title:'组件设计的阅读笔记',category:'源码学习',format:'markdown',body:'# 组件设计\n\n把关键结论留在书页中。\n\n```cpp\nint value = 1;\n```',tags:[],pinned:false,taskId:'',createdAt:at,updatedAt:at}];
  data.dailyArchives=[yesterday,dayKey()].map(date=>({date,title:date+' 工作摘要',body:'# 工作摘要\n\n- 已整理重要工作与下一步。',createdAt:at,updatedAt:at}));
  await server.workspace.putState({revision:current.revision,data});
  const saved=structuredClone((await server.workspace.getState()).data);
  await check('the gallery uses real work and only completed-day summaries',async()=>{
    await go();assert.deepEqual(await page.locator('[data-count-key]').allTextContents(),['1','0','1','1']);
    assert.equal(await page.locator('.gallery-focus [data-task-id]').count(),1);
    assert.match(await page.locator('.gallery-continue').innerText(),/梳理算子实现/);
    assert.match(await page.locator('.gallery-journal h2').innerText(),new RegExp(yesterday));
    assert.equal(await page.locator('.experimental-collage .cut-paper').count(),1);
    assert.equal(await page.locator('.gallery-cover').evaluate(el=>getComputedStyle(el,'::after').display),'none');
    assert.equal(await page.locator('.gallery-focus .task-card').evaluate(el=>getComputedStyle(el).borderRadius),'0px');
  });
  await check('artwork, book spines and content remain separated at phone, tablet and desktop widths',async()=>{
    for(const width of [320,390,768,1024,1440]) {
      await page.setViewportSize({width,height:1050});await go();
      await page.waitForFunction(()=>{const el=document.querySelector('.main-shell'),sidebar=document.querySelector('.sidebar');return innerWidth<=760||el.getBoundingClientRect().left>=sidebar.getBoundingClientRect().right-1;});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await page.locator('.gallery-cover').evaluate(el=>{const a=el.querySelector('.gallery-art').getBoundingClientRect(),b=el.getBoundingClientRect();return a.top>=b.top-1&&a.bottom<=b.bottom+1&&a.left>=b.left-1&&a.right<=b.right+1;}),true);
      assert.equal(await page.locator('.gallery-books .note-card').evaluate(el=>{const s=getComputedStyle(el,'::before'),r=el.getBoundingClientRect(),h=el.querySelector('h3').getBoundingClientRect();return h.left>=r.left+parseFloat(s.width)+10||h.top>=r.top+parseFloat(s.height)+5;}),true);
      if(width===390||width===1440)await page.screenshot({path:`artifacts/gallery-production-${width}.png`,fullPage:width===390});
    }
  });
  await check('dark controls and fresh readers share the experimental studio theme',async()=>{
    await page.getByRole('button',{name:'切换到深色主题',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
    assert.equal(await page.locator('.gallery-home-actions .button.primary').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(216, 255, 62)');
    await page.screenshot({path:'artifacts/gallery-production-dark.png'});
    const reader=await browser.newPage({viewport:{width:390,height:844}});
    await reader.goto(base+'/document.html?id=gallery-note',{waitUntil:'networkidle'});await reader.locator('.markdown-body h1').waitFor();
    assert.equal(await reader.locator('html').getAttribute('data-design'),'experimental');assert.equal(await reader.locator('html').getAttribute('data-theme'),'dark');
    assert.equal(await reader.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await reader.screenshot({path:'artifacts/gallery-production-reader.png',fullPage:true});await reader.close();
  });
  await check('the shared preview and reduced motion still work without changing work content',async()=>{
    await page.goto(base+'/art-direction/index.html',{waitUntil:'networkidle'});assert.equal(await page.locator('.porcelain-vessel').count(),1);
    await page.emulateMedia({reducedMotion:'reduce'});await go();assert.equal(await page.locator('.gallery-art').evaluate(el=>getComputedStyle(el).transform),'none');
    const after=(await server.workspace.getState()).data;delete after.settings.theme;delete saved.settings.theme;
    assert.deepEqual(after,saved);assert.deepEqual(errors,[]);
  });
  console.log(`Gallery E2E complete: ${passed} groups passed; isolated fixtures only.`);
}finally {
  if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});
}

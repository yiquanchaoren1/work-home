import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'stylekit-ui-'));
const out=path.resolve('artifacts/organic-landing-20261022/regression-atelier');await fs.mkdir(out,{recursive:true});
let server,browser;
try{
 server=await createWorkHubServer({dataDir:path.join(dir,'data'),workspaceRoot:dir,automaticArchives:false});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const initial=await server.workspace.getState(),data=structuredClone(initial.data);
 data.tasks=data.tasks.slice(0,3).map((t,i)=>({...t,title:['理解框架，从一个真实算子开始','为下一次交付，留下清晰的验证','把零散的发现整理成自己的知识'][i],summary:'读懂实现，确认边界。让每一个决定，都有可回看的依据。',nextStep:'梳理关键路径与下一步',status:i===1?'待开始':'进行中'}));
 const at='2026-10-21T09:00:00.000Z';
 data.notes=Array.from({length:3},(_,i)=>({id:'atelier-note-'+i,title:['框架阅读笔记','一次实现的设计取舍','工作中值得留下的发现'][i],body:'# 认识、理解与创造\n\n从真实问题出发，把零散的发现连接起来。',format:'markdown',pinned:false,taskId:'',category:'工作笔记',tags:['学习'],createdAt:at,updatedAt:at}));
 data.dailyArchives=[{date:'2026-10-21',title:'2026-10-21 工作摘要',body:'# 工作摘要\n\n- 明确实现边界，整理下一步工作。',createdAt:at,updatedAt:at}];
 data.settings.design='experimental';data.settings.theme='dark';
 await server.workspace.putState({revision:initial.revision,data});
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(base+'/#dashboard');await page.locator('.atelier-cover,.organic-landing').first().waitFor();
 let checks=0;
 for(const design of ['paper','experimental','gallery','porcelain'])for(const mode of ['light','dark'])for(const width of [1440,1024,768,390]){
  await page.setViewportSize({width,height:1050});
  const current=await server.workspace.getState(),next=structuredClone(current.data);next.settings.design=design;next.settings.theme=mode;await server.workspace.putState({revision:current.revision,data:next});await page.goto(base+'/?layout='+design+'-'+mode+'-'+width+'#dashboard');await page.waitForFunction(({design,mode})=>document.documentElement.dataset.design===design&&document.documentElement.dataset.theme===mode&&document.querySelector('[data-count-key=tasks]')?.textContent==='3',{design,mode});
  // Allow existing style and card transitions to settle after viewport changes.
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${design}/${mode}/${width} overflow`);
  const hero=await page.locator('.atelier-cover,.organic-landing').first().boundingBox();assert.ok(hero.width>250);
  await page.locator('.atelier-hero-actions [data-action="new"][data-collection="tasks"],.organic-entry-actions a[href="#tasks"]').first().scrollIntoViewIfNeeded();
  if(width===1440){await page.screenshot({path:path.join(out,design+'-'+mode+'-desktop.png'),fullPage:true});if(design==='experimental'&&mode==='dark')await page.screenshot({path:path.join(out,'preview.png')});}
  if(width===390&&design==='experimental'&&mode==='dark')await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
  checks++;
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/#tasks');
 await page.locator('.page-header [data-action="new"][data-collection="tasks"]').click();await page.locator('#editor-form').waitFor();
 await page.locator('#editor-form [name="title"]').fill('新工作室交互验证');await page.locator('button[form="editor-form"][type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);
 assert.ok((await server.workspace.getState()).data.tasks.some(t=>t.title==='新工作室交互验证'));
 await page.goto(base+'/#tasks');await page.locator('#sortable-tasks .task-card').first().waitFor();
 assert.equal(await page.locator('#sortable-tasks').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),3);
 const select=page.locator('[data-task-status]').first();await select.selectOption('已完成');await page.waitForFunction(()=>!document.body.dataset.saving);
 await page.getByRole('button',{name:'进行中',exact:true}).click();const title=await page.locator('.task-title').first().textContent();await page.locator('.task-title').first().click();await page.getByRole('link',{name:'返回列表',exact:true}).click();
 await page.locator('.filter-chip.active').waitFor();assert.equal(await page.locator('.filter-chip.active').textContent(),'进行中');
 await page.goto(base+'/#settings');await page.getByRole('button',{name:'使用 C 安静画廊主题',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.design==='gallery');await page.waitForFunction(()=>!document.body.dataset.saving);
 await page.goto(base+'/#notes');await page.locator('.note-grid .note-card').first().waitFor();
 assert.equal(await page.locator('#navigation a[href="https://yiquanchaoren1.github.io/"]').count(),1);
 assert.deepEqual(errors,[]);console.log(`PASS ${checks} theme/mode/width combinations; create/status/filter return/theme selection/document list/old blog; isolated data only.`);
 if(process.argv.includes('--serve')){console.log('PREVIEW '+base);await new Promise(resolve=>process.once('SIGINT',resolve));}
}finally{
 if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 if(path.dirname(dir)!==path.resolve(os.tmpdir()))throw Error('Unexpected temp path');await fs.rm(dir,{recursive:true,force:true});
}


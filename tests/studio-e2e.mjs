import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-studio-'));
let server,browser,passed=0;
try {
  server=await createWorkHubServer({dataDir:path.join(dir,'data')});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port,initial=await server.workspace.getState(),data=structuredClone(initial.data),at='2026-10-17T02:00:00.000Z';
  data.tasks=data.tasks.slice(0,3).map((task,index)=>({...task,title:['算子适配与参数验证','读懂框架，连接每一层','性能回归与下一步优化'][index],status:index===1?'待开始':'进行中',summary:'从真实源码理解实现，保留关键结论和可核对的验证。',nextStep:'整理今天的发现，推进一个明确的小目标。',linkIds:[]}));
  data.notes=[{id:'studio-note',title:'把一次理解，留给下一次出发',format:'markdown',body:'# 每次前进，都算数\n\n重要的知识与下一步，保存在自己的工作间。',category:'源码学习',tags:['源码','学习'],pinned:false,taskId:'',createdAt:at,updatedAt:at}];
  data.dailyArchives=['2026-10-16','2026-10-15','2026-09-30'].map(date=>({date,title:date+' 工作摘要',body:'# '+date+' 工作摘要\n\n- 完成关键参数核对，明确下一步实现方向。\n- 保留验证范围，让工作成果有迹可循。',createdAt:at,updatedAt:at}));
  data.archiveDocuments=['profile','history'].map(id=>({id,title:id==='profile'?'我的个人档案':'历史工作总结',body:'# 测试档案\n\n已确认的背景、目标与重要工作。',createdAt:at,updatedAt:at}));
  data.activity=[{id:'studio-activity',text:'整理了一次新的源码理解',at}];
  await server.workspace.putState({revision:initial.revision,data});
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',req=>{if(!req.url().startsWith(base)&&!req.url().startsWith('blob:')&&!req.url().startsWith('data:'))external.push(req.url());});
  let navigation=0;page.setDefaultTimeout(10000);
  const state=()=>server.workspace.getState(),go=async route=>{await page.goto(base+'/?studio-test='+ ++navigation+'#'+route,{waitUntil:'networkidle'});await page.locator('#content h1').waitFor();};
  const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
  await check('dashboard and navigation are read-only and render actual workspace counts',async()=>{
    const before=await state();await go('dashboard');assert.equal(await page.locator('.studio-stats .stat-card').count(),4);assert.equal(await page.locator('[data-count-key="archives"]').textContent(),'3');assert.deepEqual((await state()).data,before.data);
    await page.screenshot({path:'artifacts/studio-desktop-light.png'});
  });
  await check('task side view persists status, supports undo inside the dialog and restores keyboard focus',async()=>{
    const id=data.tasks[0].id;await page.locator(`[data-action="task-peek"][data-id="${id}"]`).click();await page.locator('#modal.task-drawer[open]').waitFor();
    await page.getByLabel('快速查看中的事项状态',{exact:true}).selectOption('已完成');await page.locator('#modal .inline-feedback').waitFor();assert.equal((await state()).data.tasks.find(task=>task.id===id).status,'已完成');
    await page.locator('#modal [data-action="undo-work-change"]').click();await page.waitForFunction(()=>document.querySelector('[aria-label="快速查看中的事项状态"]').value==='进行中');assert.equal((await state()).data.tasks.find(task=>task.id===id).status,'进行中');
    await page.screenshot({path:'artifacts/studio-task-drawer.png'});await page.keyboard.press('Escape');await page.locator('#modal').waitFor({state:'hidden'});await page.waitForFunction(id=>document.activeElement?.dataset.action==='task-peek'&&document.activeElement.dataset.id===id,id);
  });
  await check('filtered keyboard sorting and undo preserve hidden work items and document data',async()=>{
    await go('tasks');await page.locator('.filter-chip[data-value="进行中"]').click();const before=await state(),ids=before.data.tasks.map(task=>task.id);
    await page.locator('[data-task-drag]').first().focus();await page.keyboard.press('ArrowDown');await page.getByText('事项顺序已保存到本机',{exact:false}).waitFor();assert.deepEqual((await state()).data.tasks.map(task=>task.id),[ids[2],ids[1],ids[0]]);
    await page.locator('[data-action="undo-work-change"]').last().click();assert.deepEqual((await state()).data.tasks,before.data.tasks);assert.deepEqual((await state()).data.notes,before.data.notes);
  });
  await check('stale undo cannot overwrite a newer work change',async()=>{
    await go('tasks');const id=data.tasks[0].id;await page.locator(`#content [data-task-status="${id}"]`).selectOption('暂缓');await page.locator('[data-action="undo-work-change"]').waitFor();
    await page.locator(`[data-action="pin"][data-id="${data.tasks[1].id}"]`).click();await page.getByText('已更新置顶',{exact:true}).waitFor();const before=await state();await page.locator('[data-action="undo-work-change"]').click();await page.getByText('内容已有后续变化，无法撤销旧操作。',{exact:true}).waitFor();assert.deepEqual((await state()).data,before.data);
  });
  await check('failed status writes retain committed state and never offer a successful undo',async()=>{
    await go('tasks');const id=data.tasks[0].id,before=await state();await page.route('**/api/state',route=>route.request().method()==='PUT'?route.abort():route.continue());
    await page.locator(`#content [data-task-status="${id}"]`).selectOption('已完成');await page.getByText(/无法连接本机服务/).waitFor();assert.deepEqual((await state()).data,before.data);assert.equal(await page.locator('[data-action="undo-work-change"]').count(),0);assert.equal(await page.locator(`#content [data-task-status="${id}"]`).inputValue(),'暂缓');await page.unroute('**/api/state');
  });
  await check('concurrent device changes reject stale undo and show recovery inside the side view',async()=>{
    await go('tasks');const id=data.tasks[0].id;await page.locator(`[data-action="task-peek"][data-id="${id}"]`).click();await page.getByLabel('快速查看中的事项状态',{exact:true}).selectOption('进行中');await page.locator('#modal .inline-feedback').waitFor();
    const concurrent=await state();concurrent.data.settings.name='其他设备刚更新的名称';await server.workspace.putState({revision:concurrent.revision,data:concurrent.data});
    await page.locator('#modal [data-action="undo-work-change"]').click();await page.locator('#modal #reload-conflict').waitFor();assert.deepEqual((await state()).data,concurrent.data);await page.locator('#modal #reload-conflict').click();await page.locator('#modal').waitFor({state:'hidden'});await page.getByText('已载入本机最新数据',{exact:true}).waitFor();assert.equal((await state()).data.settings.name,'其他设备刚更新的名称');
  });
  await check('archive month navigation, filtering and independent reading retain all archives',async()=>{
    await go('archives');assert.equal(await page.locator('.archive-month').count(),2);assert.equal(await page.locator('[data-daily-archive]').count(),3);await page.locator('[data-month="2026-09"]').click();
    const popup=page.waitForEvent('popup');await page.locator('[data-daily-archive="2026-09-30"] a').click();const reader=await popup;await reader.getByRole('heading',{name:'2026-09-30 工作摘要',exact:true}).waitFor();await reader.close();
    await page.locator('#archive-filter-form [name="search"]').fill('does-not-exist');await page.locator('#archive-filter-form button[type="submit"]').click();assert.equal(await page.locator('[data-daily-archive]').count(),0);await page.locator('[data-action="codex-filter-clear"]').click();assert.equal(await page.locator('[data-daily-archive]').count(),3);await page.screenshot({path:'artifacts/studio-archives-desktop.png',fullPage:true});
  });
  await check('phone navigation, quick creation and all principal routes fit 320, 390 and 430 pixel screens',async()=>{
    const before=await state();for(const width of [320,390,430]){await page.setViewportSize({width,height:844});for(const route of ['dashboard','tasks','links','notes','archives','settings']){await go(route);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width} ${route}`);}}
    await page.setViewportSize({width:390,height:844});await go('dashboard');assert.equal(await page.locator('#mobile-navigation a').count(),4);await page.locator('#mobile-navigation a[href="#notes"]').click();await page.locator('.resource-tabs').getByRole('link',{name:'链接库',exact:true}).click();assert.equal(await page.locator('#mobile-navigation a[aria-current="page"]').getAttribute('href'),'#notes');
    await page.getByRole('button',{name:'快速新建事项',exact:true}).click();await page.locator('#editor-form[data-collection="tasks"]').waitFor();assert.equal(await page.locator('#mobile-navigation').evaluate(el=>getComputedStyle(el).pointerEvents),'none');await page.getByRole('button',{name:'关闭',exact:true}).click();assert.deepEqual((await state()).data,before.data);
    await go('dashboard');await page.screenshot({path:'artifacts/studio-mobile-light.png',fullPage:true});await go('archives');await page.screenshot({path:'artifacts/studio-archives-mobile.png',fullPage:true});
  });
  await check('dark theme and reduced motion retain work data, with no external assets or script errors',async()=>{
    await go('dashboard');const before=await state();await page.getByRole('button',{name:'切换到深色主题',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await page.waitForFunction(()=>!document.body.dataset.saving);await page.screenshot({path:'artifacts/studio-mobile-dark.png',fullPage:true});await page.setViewportSize({width:1440,height:1050});await page.screenshot({path:'artifacts/studio-desktop-dark.png'});
    await page.emulateMedia({reducedMotion:'reduce'});await go('dashboard');assert.equal(await page.locator('.gallery-art').evaluate(el=>getComputedStyle(el).transform),'none');assert.equal(await page.locator('.experimental-collage .cut-paper').count(),1);const after=(await state()).data;if(before.data.settings.theme===undefined)delete after.settings.theme;else after.settings.theme=before.data.settings.theme;assert.deepEqual(after,before.data);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  });
  console.log(`Studio E2E complete: ${passed} groups passed; isolated fixtures only.`);
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});}

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-cards-'));
let server,browser;
try {
  server=await createWorkHubServer({dataDir:path.join(dir,'data')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const first=await server.workspace.getState(),data=structuredClone(first.data);
  data.notes=[];data.records=[];
  data.tasks=Array.from({length:6},(_,index)=>({...data.tasks[0],id:'layout-'+index,
    title:index===0?'用一个较长的工作事项标题检查卡片中的换行与快捷操作':'工作事项 '+(index+1),
    summary:'记录工作目标、关键结论与后续安排。',nextStep:'整理实现与验证结果。',
    status:'进行中',pinned:false,tags:['实现','参数验证','源码学习'],linkIds:[]}));
  await server.workspace.putState({revision:first.revision,data});
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  await page.emulateMedia({reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/#tasks',{waitUntil:'networkidle'});
  await page.locator('#sortable-tasks > .task-card').first().waitFor();
  let combinations=0;
  for(const design of ['paper','experimental','gallery','porcelain']) {
    for(const theme of ['light','dark']) {
      await page.evaluate(({design,theme})=>{
        document.documentElement.dataset.design=design;document.documentElement.dataset.theme=theme;
      },{design,theme});
      for(const width of [320,390,768,1024,1440]) {
        await page.setViewportSize({width,height:1000});
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const result=await page.locator('#sortable-tasks').evaluate(grid=>{
          const cards=[...grid.children].map(card=>card.getBoundingClientRect());
          return {columns:cards.filter(card=>Math.abs(card.top-cards[0].top)<2).length,
            overflow:document.documentElement.scrollWidth>innerWidth,
            contained:[...grid.querySelectorAll('.task-card')].every(card=>{
              const outer=card.getBoundingClientRect();
              return [...card.querySelectorAll('.task-title,.task-status-select,.task-card-actions')].every(el=>{
                const inner=el.getBoundingClientRect();return inner.left>=outer.left&&inner.right<=outer.right+1;
              });
            })};
        });
        const label=design+' '+theme+' '+width;
        assert.equal(result.columns,width>1200?3:width>900?2:1,label+' card columns');
        assert.equal(result.overflow,false,label+' page overflow');
        assert.equal(result.contained,true,label+' card controls fit');combinations++;
      }
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-task-status="layout-0"]').selectOption('已完成');
  await page.waitForFunction(()=>!document.body.dataset.saving);
  assert.equal((await server.workspace.getState()).data.tasks[0].status,'已完成');
  const handle=page.locator('[data-task-drag="layout-0"]');
  await handle.focus();await page.keyboard.press('ArrowDown');
  await page.waitForFunction(()=>document.querySelector('#sortable-tasks > .task-card').dataset.taskId==='layout-1');
  assert.equal((await server.workspace.getState()).data.tasks[1].id,'layout-0');
  const start=await page.locator('[data-task-drag="layout-1"]').boundingBox();
  const target=await page.locator('[data-task-id="layout-2"]').boundingBox();
  await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();
  await page.mouse.move(target.x+target.width/2,target.y+target.height/2);await page.mouse.up();
  await page.waitForFunction(()=>document.querySelectorAll('#sortable-tasks > .task-card')[2].dataset.taskId==='layout-1');
  await page.waitForFunction(()=>!document.body.dataset.saving);
  assert.equal((await server.workspace.getState()).data.tasks[2].id,'layout-1');
  await page.evaluate(()=>{document.documentElement.dataset.design='experimental';document.documentElement.dataset.theme='light';});
  await page.locator('[data-task-drag="layout-0"]').blur();
  await page.screenshot({path:'artifacts/task-cards-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:'artifacts/task-cards-mobile.png',fullPage:true});
  await page.locator('.filter-chip[data-value="待开始"]').click();
  assert.equal(await page.locator('#sortable-tasks .task-card').count(),0);
  assert.equal(await page.locator('#sortable-tasks .empty-state').count(),1);
  assert.deepEqual(errors,[]);
  console.log(`Task cards E2E passed: ${combinations} theme/mode/width combinations, status, keyboard/pointer sorting and empty state; isolated data only.`);
} finally {
  if(browser)await browser.close();
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});
}

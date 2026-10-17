import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-ui-flow-'));
let server,browser,passed=0;
try {
  server=await createWorkHubServer({dataDir:path.join(dir,'data')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port,first=await server.workspace.getState(),data=structuredClone(first.data),stamp='2026-10-17T01:00:00.000Z';
  data.tasks[0].status='进行中';data.tasks[0].nextStep='完成下一项验证';
  data.notes.push({id:'ui-document',title:'主题阅读检查',category:'其他',format:'markdown',body:'# 阅读检查\n\n内容保持可读。\n\n```cpp\nfloat value = 1;\n```\n',tags:[],pinned:false,taskId:'',createdAt:stamp,updatedAt:stamp});
  data.archiveDocuments=[{id:'history',title:'历史工作总结',body:'# 历史工作总结\n\n工作积累。\n',createdAt:stamp,updatedAt:stamp},{id:'profile',title:'我的个人档案',body:'# 我的个人档案\n\n明确的协作偏好。\n',createdAt:stamp,updatedAt:stamp}];
  await server.workspace.putState({revision:first.revision,data});
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',req=>{if(!req.url().startsWith(base)&&!req.url().startsWith('blob:'))external.push(req.url());});
  const state=()=>server.workspace.getState();
  const go=async route=>{await page.goto(base+'/#'+route,{waitUntil:'networkidle'});await page.locator('#content h1').waitFor();};
  const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
  await check('sidebar collapse retains all destinations and page state without writing work data',async()=>{
    const before=await state();await go('dashboard');await page.getByRole('button',{name:'收起侧栏',exact:true}).click();await page.waitForFunction(()=>document.body.classList.contains('sidebar-collapsed'));assert.equal(await page.locator('#navigation a').count(),6);await page.locator('#navigation a[href="#tasks"]').click();await page.getByRole('heading',{name:'工作事项',exact:true}).waitFor();assert.equal(await page.locator('#sortable-tasks [data-task-id]').count(),3);assert.equal(await page.locator('body.sidebar-collapsed').count(),1);await page.getByRole('button',{name:'展开侧栏',exact:true}).click();assert.deepEqual((await state()).data,before.data);
  });
  await check('theme saves on disk, opens in fresh contexts and reader pages; failed writes keep the committed theme',async()=>{
    await page.getByRole('button',{name:'切换到深色主题',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');assert.equal((await state()).data.settings.theme,'dark');
    await page.route('**/api/state',r=>r.request().method()==='PUT'?r.abort():r.continue());await page.getByRole('button',{name:'切换到浅色主题',exact:true}).click();await page.getByText(/无法连接本机服务/).waitFor();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert.equal((await state()).data.settings.theme,'dark');await page.unroute('**/api/state');
    const fresh=await browser.newContext(),reader=await fresh.newPage();await reader.goto(base+'/document.html?id=ui-document',{waitUntil:'networkidle'});await reader.locator('.markdown-body h1').waitFor();assert.equal(await reader.locator('html').getAttribute('data-theme'),'dark');await reader.goto(base+'/daily-archive.html?archive=profile',{waitUntil:'networkidle'});await reader.locator('.markdown-body h1').waitFor();assert.equal(await reader.locator('html').getAttribute('data-theme'),'dark');await fresh.close();
  });
  await check('command palette supports shortcuts, filtered results, keyboard selection and quick actions',async()=>{
    await go('dashboard');await page.keyboard.press('Control+k');await page.locator('#global-search').waitFor();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.locator('#editor-form[data-collection="notes"]').waitFor();assert.equal(await page.locator('#modal.command-modal').count(),0);await page.keyboard.press('Escape');await page.locator('#modal').waitFor({state:'hidden'});
    await page.keyboard.press('/');await page.locator('#global-search').fill(data.tasks[0].title);await page.keyboard.press('Enter');await page.waitForURL('**/#detail/'+data.tasks[0].id);await page.getByRole('heading',{name:data.tasks[0].title,exact:true}).waitFor();
    await page.keyboard.press('Control+k');await page.locator('#global-search').fill('not-a-real-query-1729');assert.equal(await page.locator('.search-result').count(),0);await page.keyboard.press('Enter');assert.equal(await page.locator('#modal[open]').count(),1);await page.keyboard.press('Escape');await page.locator('#modal').waitFor({state:'hidden'});
  });
  await check('mobile navigation, dark/light layouts and important routes stay within the viewport',async()=>{
    for(const width of [390,768,1024]) {
      await page.setViewportSize({width,height:900});
      for(const route of ['dashboard','tasks','links','notes','archives','settings']){await go(route);await page.waitForFunction(()=>!document.querySelector('body.menu-open'));await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth,{},{timeout:3000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width} ${route}`);}
    }
    await page.setViewportSize({width:390,height:844});await go('dashboard');await page.getByRole('button',{name:'打开导航',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().left>=-1);await page.locator('#navigation a[href="#archives"]').click();await page.getByRole('heading',{name:'工作档案',exact:true}).waitFor();assert.equal(await page.locator('body.menu-open').count(),0);
  });
  await check('reduced-motion disables decorative movement and all original work data survives view interactions',async()=>{
    await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await go('dashboard');assert.equal(await page.locator('.gallery-art').evaluate(el=>getComputedStyle(el).transform),'none');assert.equal(await page.locator('.experimental-collage .cut-paper').count(),1);const current=(await state()).data;const withoutTheme=structuredClone(current);delete withoutTheme.settings.theme;assert.deepEqual(withoutTheme,data);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  });
  console.log(`UI refresh E2E complete: ${passed} groups passed; isolated data only.`);
} finally {
  if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});
}

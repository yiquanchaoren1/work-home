import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-themes-'));
let server,browser,passed=0;
try {
  server=await createWorkHubServer({dataDir:path.join(dir,'data')});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const first=await server.workspace.getState(),data=structuredClone(first.data),at=new Date().toISOString();
  data.notes=[{id:'theme-reading',title:'跨主题阅读',format:'markdown',body:'# 主题阅读\n\n工作内容保持不变。',category:'其他',tags:[],pinned:false,taskId:'',createdAt:at,updatedAt:at}];
  data.archiveDocuments=[{id:'profile',title:'我的个人档案',body:'# 测试档案\n\n已确认的偏好。',createdAt:at,updatedAt:at}];
  data.settings.design='experimental';data.settings.theme='dark';await server.workspace.putState({revision:first.revision,data});
  const original=structuredClone(data);delete original.settings;
  const base='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
  const go=async route=>{await page.evaluate(r=>location.hash=r,route);await page.waitForFunction(r=>document.body.dataset.page===r,route);};
  const mode=async target=>{if(await page.locator('html').getAttribute('data-theme')!==target){await page.locator('.topbar [data-action="theme-toggle"]').click();await page.waitForFunction(m=>document.documentElement.dataset.theme===m,target);}};
  const pick=async design=>{await page.locator('#theme-picker-button').click();await page.locator('#modal.appearance-modal[open]').waitFor();await page.locator(`#modal [data-design-id="${design}"]`).click();await page.locator('#modal').waitFor({state:'hidden'});await page.waitForFunction(d=>document.documentElement.dataset.design===d,design);};
  const lightness=()=>page.evaluate(()=>{const n=getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g).slice(0,3).map(Number);return n.reduce((a,b)=>a+b,0)/765;});
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('.gallery-cover').waitFor();
  await check('light and dark visibly change the experimental background, and survive reload',async()=>{
    assert.ok(await lightness()<.15);await mode('light');assert.ok(await lightness()>.8);await page.reload({waitUntil:'networkidle'});await page.locator('.gallery-cover').waitFor();assert.ok(await lightness()>.8);assert.equal((await server.workspace.getState()).data.settings.theme,'light');
  });
  await check('the picker changes all four compositions and persists the actual preset',async()=>{
    for(const design of ['paper','experimental','gallery','porcelain']) {
      await pick(design);assert.equal((await server.workspace.getState()).data.settings.design,design);
      assert.equal(await page.locator(design==='porcelain'?'.porcelain-vessel':'.experimental-collage .cut-paper').count(),1);
      assert.equal(await page.locator('.experimental-masthead').count(),design==='experimental'?1:0);
      await page.reload({waitUntil:'networkidle'});await page.locator('.gallery-cover').waitFor();assert.equal(await page.locator('html').getAttribute('data-design'),design);
      await page.screenshot({path:`artifacts/theme-${design}-desktop.png`});
    }
  });
  await check('all eight design/mode combinations fit every major route at five widths',async()=>{
    for(const design of ['paper','experimental','gallery','porcelain']) {
      await page.setViewportSize({width:1440,height:1000});await go('dashboard');await pick(design);
      for(const target of ['light','dark']) {
        await mode(target);assert.ok(target==='light'?await lightness()>.8:await lightness()<.2,design+' '+target);
        for(const width of [320,390,768,1024,1440]) {
          await page.setViewportSize({width,height:844});
          for(const route of ['dashboard','tasks','notes','archives','settings']) {await go(route);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${design} ${target} ${width} ${route}`);}
        }
        await page.setViewportSize({width:390,height:844});await go('dashboard');await page.screenshot({path:`artifacts/theme-${design}-${target}-mobile.png`,fullPage:true});
      }
    }
  });
  await check('fresh document and archive readers follow each stored design and brightness',async()=>{
    for(const design of ['paper','experimental','gallery','porcelain']) {
      await page.setViewportSize({width:390,height:844});await pick(design);await mode('dark');
      const fresh=await browser.newContext({viewport:{width:390,height:844}}),reader=await fresh.newPage();
      for(const url of ['/document.html?id=theme-reading','/daily-archive.html?archive=profile']) {
        await reader.goto(base+url,{waitUntil:'networkidle'});await reader.locator('.markdown-body h1').waitFor();
        assert.equal(await reader.locator('html').getAttribute('data-design'),design);assert.equal(await reader.locator('html').getAttribute('data-theme'),'dark');assert.equal(await reader.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      }
      await fresh.close();
    }
  });
  await check('failed saves keep the old design and a visible retryable picker; stale writers never overwrite other changes',async()=>{
    await page.setViewportSize({width:1440,height:1000});const before=await server.workspace.getState(),old=before.data.settings.design;
    await page.route('**/api/state',r=>r.request().method()==='PUT'?r.abort():r.continue());await page.locator('#theme-picker-button').click();await page.locator('#modal [data-design-id="paper"]').click();await page.locator('#modal').getByText(/无法连接本机服务/).waitFor();assert.equal(await page.locator('html').getAttribute('data-design'),old);assert.deepEqual((await server.workspace.getState()).data,before.data);await page.unroute('**/api/state');
    const other=await server.workspace.getState();other.data.settings.name='其他窗口的工作台';await server.workspace.putState(other);await page.locator('#modal [data-design-id="gallery"]').click();await page.locator('#modal').getByText(/其他页面已更新|其他窗口更新/).waitFor();assert.equal((await server.workspace.getState()).data.settings.name,'其他窗口的工作台');assert.equal((await server.workspace.getState()).data.settings.design,old);await page.keyboard.press('Escape');
  });
  await check('theme selection leaves work collections untouched, and reduced motion and the settings shortcuts still work',async()=>{
    await page.reload({waitUntil:'networkidle'});await go('settings');assert.equal(await page.locator('.theme-settings .theme-choice').count(),4);await page.locator('.theme-settings [data-design-id="paper"]').click();await page.waitForFunction(()=>document.documentElement.dataset.design==='paper');
    await page.emulateMedia({reducedMotion:'reduce'});await go('dashboard');assert.equal(await page.locator('.gallery-art').evaluate(el=>getComputedStyle(el).transform),'none');
    const final=structuredClone((await server.workspace.getState()).data);delete final.settings;assert.deepEqual(final,original);assert.deepEqual(errors,[]);
  });
  console.log(`Themes E2E complete: ${passed} groups passed; isolated fixtures only.`);
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});}

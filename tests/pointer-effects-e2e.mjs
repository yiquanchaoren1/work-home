import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-pointer-'));
let server,browser,passed=0;
try {
  server=await createWorkHubServer({dataDir:path.join(dir,'data')});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port,before=await server.workspace.getState();
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],external=[];let writes=0;
  page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.method()==='PUT')writes++;if(!request.url().startsWith(base)&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))external.push(request.url());});
  await page.addInitScript(()=>{const original=window.requestAnimationFrame;window.__requestedFrames=0;window.requestAnimationFrame=callback=>{window.__requestedFrames++;return original.call(window,callback);};});
  const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
  const go=async route=>{await page.goto(base+'/#'+route,{waitUntil:'networkidle'});await page.locator('#content h1').waitFor();};
  await check('fine mouse motion creates a non-interactive follower while preserving native hit targets',async()=>{
    await go('dashboard');await page.mouse.move(900,110);await page.locator('.pointer-ring.is-visible').waitFor();
    assert.equal(await page.locator('.pointer-ring').getAttribute('aria-hidden'),'true');assert.equal(await page.locator('.pointer-aura').getAttribute('aria-hidden'),'true');
    assert.equal(await page.locator('.pointer-ring').evaluate(el=>getComputedStyle(el).pointerEvents),'none');assert.equal(await page.locator('.pointer-aura').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    assert.notEqual(await page.evaluate(()=>getComputedStyle(document.body).cursor),'none');assert.equal(await page.evaluate(()=>document.elementFromPoint(900,110).closest('.pointer-ring,.pointer-aura')===null),true);
  });
  await check('cards receive a single following rim, and hover does not block real clicks or save work data',async()=>{
    const card=page.locator('.stat-card').first();await card.hover({position:{x:25,y:25}});await page.waitForFunction(()=>document.querySelector('.stat-card').classList.contains('spot-lit'));
    assert.equal(await card.locator(':scope > .pointer-rim').count(),1);await card.hover({position:{x:45,y:35}});assert.equal(await card.locator(':scope > .pointer-rim').count(),1);assert.ok(parseFloat(await card.evaluate(el=>el.style.getPropertyValue('--spot-x')))>0);
    await page.getByRole('button',{name:'搜索全部内容',exact:true}).click();await page.locator('#global-search').waitFor();await page.mouse.move(1100,400);assert.equal(await page.locator('.pointer-ring.is-visible').count(),0);await page.keyboard.press('Escape');await page.locator('#modal').waitFor({state:'hidden'});assert.equal(writes,0);
  });
  await check('hero movement is bounded and pointer effects stop after the mouse settles',async()=>{
    // Start this motion measurement without native dialog focus/scroll restoration in flight.
    await page.reload({waitUntil:'networkidle'});await page.locator('.studio-hero').waitFor();
    const box=await page.locator('.studio-hero').boundingBox();await page.mouse.move(box.x+box.width*.85,box.y+box.height*.4,{steps:6});await page.waitForFunction(()=>parseFloat(document.querySelector('.studio-hero').style.getPropertyValue('--hero-parallax-x'))>0);
    assert.ok(parseFloat(await page.locator('.studio-hero').evaluate(el=>el.style.getPropertyValue('--hero-parallax-x')))<=10);await page.screenshot({path:'artifacts/pointer-desktop.png'});
    await page.waitForTimeout(1300);const count=await page.evaluate(()=>window.__requestedFrames);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__requestedFrames),count,'stationary mouse must not keep a frame loop alive');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.locator('.pointer-ring.is-visible').count(),0);assert.equal(await page.locator('.studio-hero').evaluate(el=>el.style.getPropertyValue('--hero-parallax-x')),'');
  });
  await check('following the viewport edges cannot enlarge or scroll the page',async()=>{
    const before=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,x:scrollX,y:scrollY}));await page.mouse.move(1438,998,{steps:4});await page.waitForTimeout(500);const after=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,x:scrollX,y:scrollY}));assert.deepEqual(after,before);
  });
  await check('reduced motion hides all pointer decoration and can be enabled again',async()=>{
    await page.mouse.move(950,400);await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>[...document.querySelectorAll('.pointer-ring,.pointer-aura,.pointer-rim')].every(el=>getComputedStyle(el).display==='none'));
    await page.mouse.move(1000,450);assert.equal(await page.locator('.pointer-ring.is-visible').count(),0);assert.equal(await page.locator('.hero-visual').evaluate(el=>getComputedStyle(el).transform),'none');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.mouse.move(1010,460);await page.locator('.pointer-ring.is-visible').waitFor();
  });
  await check('scroll, route changes and task dragging clear decoration without taking over the pointer',async()=>{
    await page.evaluate(()=>window.dispatchEvent(new Event('scroll')));assert.equal(await page.locator('.pointer-ring.is-visible').count(),0);await page.mouse.move(1100,500);await page.evaluate(()=>location.hash='tasks');await page.getByRole('heading',{name:'工作事项',exact:true}).waitFor();assert.equal(await page.locator('.pointer-ring.is-visible').count(),0);
    const handle=page.locator('[data-task-drag]').first(),box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();assert.equal(await page.locator('.pointer-ring.is-visible').count(),0);await page.mouse.up();assert.equal(writes,0);
  });
  await check('touch screens never create cursor decoration and original data remains unchanged',async()=>{
    const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),phone=await touch.newPage();await phone.goto(base+'/#dashboard',{waitUntil:'networkidle'});await phone.mouse.move(200,350);await phone.touchscreen.tap(200,120);assert.equal(await phone.locator('.pointer-ring,.pointer-aura').count(),0);assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await touch.close();
    assert.deepEqual((await server.workspace.getState()).data,before.data);assert.equal(writes,0);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  });
  console.log(`Pointer effects E2E complete: ${passed} groups passed; isolated data only.`);
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});}

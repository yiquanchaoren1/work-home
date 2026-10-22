import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'organic-entrance-'));
const out=path.resolve('artifacts/organic-landing-20261022');await fs.mkdir(out,{recursive:true});
let browser,server;
try{
 server=await createWorkHubServer({dataDir:path.join(dir,'data'),workspaceRoot:dir,automaticArchives:false});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`,first=await server.workspace.getState(),data=structuredClone(first.data);
 data.settings.design='experimental';data.settings.theme='light';
 data.tasks=data.tasks.slice(0,3).map((t,i)=>({...t,title:['理解实现的边界','推进今天的工作','整理新的发现'][i],status:'进行中'}));
 await server.workspace.putState({revision:first.revision,data});
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 let combinations=0;
 for(const theme of ['light','dark'])for(const [width,height] of [[1860,1000],[1440,1000],[1024,768],[768,1024],[390,844],[360,740]]){
  const state=await server.workspace.getState(),next=structuredClone(state.data);next.settings.theme=theme;await server.workspace.putState({revision:state.revision,data:next});
  await page.setViewportSize({width,height});await page.goto(base+'/?layout='+theme+'-'+width+'#dashboard');await page.locator('.organic-landing h1').waitFor();await page.waitForFunction(({theme})=>document.documentElement.dataset.theme===theme&&document.querySelector('[data-count-key=tasks]')?.textContent.trim()==='3',{theme},{timeout:5000});
  assert.equal(await page.locator('.sidebar').isVisible(),false);assert.equal(await page.locator('.topbar').isVisible(),false);
  assert.equal(await page.locator('h1').count(),1);
  const title=await page.locator('.organic-landing h1').boundingBox(),intro=await page.locator('.organic-landing').boundingBox(),stats=await page.locator('.gallery-ledger').boundingBox();
  assert.ok(Math.abs(title.x+title.width/2-width/2)<3,'title not centered');
  assert.ok(title.height>140,'title too small');assert.ok(stats.y>=height-110,'dashboard cards crowd first screen');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width} page overflow`);
  assert.ok(intro.width===width);assert.equal(await page.locator('.organic-entry-actions .button').count(),2);
  const buttons=await page.locator('.organic-entry-actions').boundingBox();assert.ok(buttons.y+buttons.height<height+45,'CTA not on first screen');
  if(width===1860&&theme==='light')await page.screenshot({path:path.join(out,'preview.png')});
  if(width===390&&theme==='light')await page.screenshot({path:path.join(out,'mobile.png')});
  combinations++;
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('.organic-entry-actions a[href="#tasks"]').click();await page.locator('#sortable-tasks').waitFor();
 assert.ok(await page.locator('.sidebar').isVisible());assert.equal(await page.locator('#sortable-tasks').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),3);
 await page.locator('.brand').click();await page.locator('.organic-landing').waitFor();
 await page.locator('.organic-entry-actions a[href="#notes"]').click();await page.locator('.note-grid').waitFor();assert.ok(await page.locator('.sidebar').isVisible());
 await page.goto(base+'/#dashboard');await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark'&&document.querySelector('[data-count-key=tasks]')?.textContent==='3');await page.locator('.organic-landing-tools [data-action="theme-picker"]').click();await page.locator('#modal[open]').waitFor();
 await page.getByRole('button',{name:'使用 C 安静画廊主题',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.design==='gallery',{},{timeout:5000}).catch(async e=>{console.log('THEME DIAGNOSTIC '+JSON.stringify({toasts:await page.locator('.toast').allTextContents(),design:await page.locator('html').getAttribute('data-design'),errors}));throw e;});assert.equal(await page.locator('.organic-landing').count(),0);assert.ok(await page.locator('.sidebar').isVisible());
 await page.locator('#theme-picker-button').click();await page.getByRole('button',{name:'使用 B 自然有机风主题',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.design==='experimental');await page.waitForFunction(()=>!document.querySelector('#modal').open);
 assert.equal(await page.evaluate(()=>document.activeElement?.matches('.organic-landing-tools [data-action="theme-picker"]')),true);assert.ok(await page.locator('.organic-landing').isVisible());assert.equal(await page.locator('.sidebar').isVisible(),false);
 assert.equal(await page.locator('.organic-entry-links a[href="https://yiquanchaoren1.github.io/"]').getAttribute('target'),'_blank');
 await page.locator('.organic-landing-tools [data-action="theme-toggle"]').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 assert.deepEqual(errors,[]);console.log(`PASS ${combinations} first-screen layouts: centered title, whitespace, cards below fold, CTAs; task/document routes, sidebar return, theme round trip, dark toggle and old blog.`);
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});}

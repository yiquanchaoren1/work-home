import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { createWorkHubServer } from '../backend.mjs';
import { seedData } from '../public/seed.js';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-cloud-'));
let server,browser,passed=0,counter=0,isPrivate=true;
const files=new Map(),at=new Date().toISOString();
const install=(name,bytes)=>files.set(name,{bytes:Buffer.from(bytes),sha:'sha-'+(++counter)});
const data=structuredClone(seedData);data.tasks[0].status='进行中';
data.notes=[{id:'private-note',title:'Private cloud note',body:'# Cloud note\n\nPrivate content.',format:'markdown',category:'其他',tags:[],pinned:false,taskId:'',createdAt:at,updatedAt:at}];
install('workspace.json',JSON.stringify({revision:'first',data}));
const state=()=>JSON.parse(files.get('workspace.json').bytes.toString()).data;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/h00AAAAASUVORK5CYII=','base64');
function pdfBytes(){const paint='q\n0.9 0.1 0.1 rg\n10 10 180 80 re f\nQ\n',objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(paint)} >>\nstream\n${paint}endstream`],offsets=[];let value='%PDF-1.4\n';objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(value));value+=`${i+1} 0 obj\n${o}\nendobj\n`;});const start=Buffer.byteLength(value);return Buffer.from(value+`xref\n0 5\n0000000000 65535 f \n${offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`);}
try {
  server=await createWorkHubServer({dataDir:path.join(dir,'data'),publicDir:path.resolve('dist-cloud')});
  const handle=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(req,res)=>{if(!req.url.startsWith('/work-hub/')){res.writeHead(404);res.end();return;}req.url=req.url.slice('/work-hub'.length);handle(req,res);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/work-hub/';
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
  await context.route('https://api.github.com/**',async route=>{
    const req=route.request(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'accept,authorization,content-type,x-github-api-version','access-control-allow-methods':'GET,PUT,OPTIONS'};
    const fulfill=(status,body)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
    if(req.method()==='OPTIONS')return fulfill(204,{});
    if(req.headers().authorization!=='Bearer test-only-token')return fulfill(401,{});
    const url=new URL(req.url()),marker='/contents/',i=url.pathname.indexOf(marker);
    if(i<0)return fulfill(200,{private:isPrivate,archived:false});
    const name=url.pathname.slice(i+marker.length).split('/').map(decodeURIComponent).join('/');
    if(req.method()==='PUT') {const body=req.postDataJSON(),old=files.get(name);if(old?.sha!==body.sha)return fulfill(409,{});install(name,Buffer.from(body.content,'base64'));return fulfill(old?200:201,{content:{sha:files.get(name).sha}});}
    const item=files.get(name);if(!item)return fulfill(404,{});
    return fulfill(200,{type:'file',sha:item.sha,encoding:'base64',content:item.bytes.toString('base64')});
  });
  const check=async(name,operation)=>{await operation();console.log('PASS '+name);passed++;};
  await check('Pages under a repository subpath require login and refuse public data stores',async()=>{
    await page.goto(base,{waitUntil:'networkidle'});await page.locator('.cloud-login[open]').waitFor();assert.equal(await page.getByText('Private cloud note',{exact:true}).count(),0);
    await page.getByLabel('GitHub 访问密钥',{exact:true}).fill('wrong-token');await page.getByRole('button',{name:'连接私有资料',exact:true}).click();await page.locator('.cloud-login [role="alert"]').filter({hasText:'失效'}).waitFor();
    isPrivate=false;await page.getByLabel('GitHub 访问密钥',{exact:true}).fill('test-only-token');await page.getByRole('button',{name:'连接私有资料',exact:true}).click();await page.locator('.cloud-login [role="alert"]').filter({hasText:'必须是私有仓库'}).waitFor();
    isPrivate=true;await page.getByRole('button',{name:'连接私有资料',exact:true}).click();await page.locator('.cloud-login').waitFor({state:'detached'});await page.locator('#content h1').waitFor();
    assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.equal(await context.cookies().then(c=>c.length),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  });
  await check('mobile edits save privately and new document tabs inherit only an in-memory session',async()=>{
    await page.locator('.topbar [data-action="theme-toggle"]').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');assert.equal(state().settings.theme,'dark');
    await page.evaluate(()=>location.hash='notes');await page.getByRole('heading',{name:'知识库',exact:true}).waitFor();
    const popup=page.waitForEvent('popup');await page.locator('a[href="./document.html?id=private-note"]').first().click();const reader=await popup;await reader.locator('.markdown-body h1').waitFor();assert.equal(await reader.locator('.markdown-body h1').textContent(),'Cloud note');assert.equal(await reader.locator('.cloud-login').count(),0);assert.equal(await reader.locator('html').getAttribute('data-theme'),'dark');assert.ok(reader.url().startsWith(base+'document.html'));
    await reader.locator('#document-edit').click();await reader.locator('#document-body').fill('# Updated from mobile\n\nSaved to private GitHub.');await reader.locator('button[form="editor-form"]').click();await reader.locator('#modal').waitFor({state:'hidden'});assert.match(state().notes[0].body,/Updated from mobile/);await reader.close();
  });
  await check('cloud PDF and image attachments open in separate readers and download original bytes',async()=>{
    await page.evaluate(()=>location.hash='settings');await page.locator('[data-action="reload-data"]').click();await page.getByText(/已载入云端最新数据|当前已是最新数据/).waitFor();
    await page.evaluate(()=>location.hash='notes');await page.locator('[data-action="upload-documents"]').click();
    const pdf=pdfBytes();await page.locator('#document-files').setInputFiles([{name:'sample.pdf',mimeType:'application/pdf',buffer:pdf},{name:'sample.png',mimeType:'image/png',buffer:png}]);await page.waitForFunction(()=>!document.querySelector('[data-action="confirm-documents"]').disabled);await page.locator('[data-action="confirm-documents"]').click();await page.locator('#modal').waitFor({state:'hidden'});
    for(const [name,selector,expected] of [['sample.pdf','.pdf-canvas[data-rendered="true"]',pdf],['sample.png','.reader-image',png]]) {
      const note=state().notes.find(n=>n.sourceName===name);assert.ok(note);
      const popup=page.waitForEvent('popup');await page.locator(`a[href="./document.html?id=${note.id}"]`).first().click();const reader=await popup;await reader.locator(selector).waitFor();
      if(name.endsWith('.png'))await reader.waitForFunction(()=>document.querySelector('.reader-image').naturalWidth===1);
      const event=reader.waitForEvent('download');await reader.locator('#document-download').click();const download=await event;assert.deepEqual(await fs.readFile(await download.path()),expected);await reader.close();
    }
  });
  await check('reloading drops credentials and no source, browser storage or URLs contain the session secret',async()=>{
    assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.deepEqual(await context.cookies(),[]);assert.ok(!page.url().includes('test-only-token'));
    assert.ok(!(await page.content()).includes('test-only-token'));
    await page.reload({waitUntil:'networkidle'});await page.locator('.cloud-login[open]').waitFor();assert.equal(await page.getByLabel('GitHub 访问密钥',{exact:true}).inputValue(),'');assert.deepEqual(errors,[]);
  });
  console.log(`Cloud E2E complete: ${passed} groups passed; mocked GitHub and isolated data only.`);
} finally {if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});}

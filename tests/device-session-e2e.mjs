import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';
import {seedData} from '../public/seed.js';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-device-'));
let server,context,blockedContext,passed=0,mode='valid',validToken='test-device-token',writes=0;
const data=structuredClone(seedData),stamp=new Date().toISOString();
data.notes=[{id:'device-note',title:'Device login document',body:'# Device login document\n\nPrivate document remains in GitHub.',format:'markdown',category:'其他',tags:[],pinned:false,taskId:'',createdAt:stamp,updatedAt:stamp}];
const payload=JSON.stringify({revision:'unchanged-device-fixture',data});
const record=page=>page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('work-hub-device-session:/work-home/',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{return await new Promise((resolve,reject)=>{const r=db.transaction('connection').objectStore('connection').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}
});
try {
  server=await createWorkHubServer({dataDir:path.join(dir,'data'),publicDir:path.resolve('dist-cloud')});
  const handler=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(req,res)=>{if(!req.url.startsWith('/work-home/')){res.writeHead(404);res.end();return;}req.url=req.url.slice('/work-home'.length);handler(req,res);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/work-home/';
  const setup=async ctx=>{
    await ctx.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));
    await ctx.route('https://api.github.com/**',async route=>{
      const request=route.request(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'accept,authorization,content-type,x-github-api-version','access-control-allow-methods':'GET,PUT,OPTIONS'};
      const fulfill=(status,body)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
      if(request.method()==='OPTIONS')return fulfill(204,{});
      if(mode==='offline')return route.abort();
      if(mode==='limited')return fulfill(429,{});
      if(mode==='missing')return fulfill(404,{});
      if(mode==='revoked'||request.headers().authorization!=='Bearer '+validToken)return fulfill(401,{});
      if(request.method()!=='GET'){writes++;return fulfill(500,{});}
      if(!request.url().includes('/contents/'))return fulfill(200,{private:true,archived:false,default_branch:'master'});
      if(request.url().includes('/contents/workspace.json'))return fulfill(200,{type:'file',encoding:'base64',sha:'unchanged',content:Buffer.from(mode==='damaged-data'?'invalid-json':payload).toString('base64')});
      return fulfill(404,{});
    });
  };
  const launch=async profile=>{const ctx=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:390,height:844}});await setup(ctx);return ctx;};
  context=await launch(path.join(dir,'profile'));let page=await context.newPage();
  const login=async({remember=true,token=validToken}={})=>{await page.getByLabel('GitHub 访问密钥',{exact:true}).fill(token);await page.getByRole('checkbox',{name:/记住此设备/}).setChecked(remember);await page.getByRole('button',{name:'连接私有资料',exact:true}).click();await page.locator('.cloud-login').waitFor({state:'detached'});await page.locator('#content h1').waitFor();};
  const check=async(name,operation)=>{await operation();passed++;console.log('PASS '+name);};
  await check('installed apps offer device remembrance but invalid credentials are never saved',async()=>{
    await page.goto(base,{waitUntil:'networkidle'});await page.locator('.cloud-login[open]').waitFor();assert.equal(await page.getByRole('checkbox',{name:/记住此设备/}).isChecked(),true);
    await page.getByLabel('GitHub 访问密钥',{exact:true}).fill('not-valid');await page.getByRole('button',{name:'连接私有资料',exact:true}).click();await page.locator('.form-error').filter({hasText:'失效'}).waitFor();assert.equal(await record(page),undefined);
    await page.screenshot({path:'artifacts/device-login-390.png',fullPage:true});
  });
  await check('only encrypted credentials and a non-extractable key are saved; refresh connects automatically',async()=>{
    await login();
    const stored=await page.evaluate(async()=>{
      const db=await new Promise(resolve=>{const r=indexedDB.open('work-hub-device-session:/work-home/');r.onsuccess=()=>resolve(r.result);});
      try {const value=await new Promise(resolve=>{const r=db.transaction('connection').objectStore('connection').get('current');r.onsuccess=()=>resolve(r.result);});
        let exportable=true;try{await crypto.subtle.exportKey('raw',value.key);}catch{exportable=false;}
        return {stores:[...db.objectStoreNames],fields:Object.keys(value).sort(),extractable:value.key.extractable,exportable,decoded:new TextDecoder().decode(value.ciphertext)};
      }finally{db.close();}
    });
    assert.deepEqual(stored.stores,['connection']);assert.deepEqual(stored.fields,['ciphertext','iv','key','version']);assert.equal(stored.extractable,false);assert.equal(stored.exportable,false);assert.ok(!stored.decoded.includes(validToken));assert.ok(!stored.decoded.includes('Device login document'));
    await page.reload({waitUntil:'networkidle'});await page.locator('#content h1').waitFor();assert.equal(await page.locator('.cloud-login').count(),0);
    assert.deepEqual(await page.evaluate(async()=>({local:localStorage.length,session:sessionStorage.length,cache:await caches.keys()})),{local:0,session:0,cache:[]});
  });
  await check('the saved connection survives a full browser process restart and independent reader tabs',async()=>{
    await context.close();context=await launch(path.join(dir,'profile'));page=await context.newPage();await page.goto(base,{waitUntil:'networkidle'});await page.locator('#content h1').waitFor();assert.equal(await page.locator('.cloud-login').count(),0);
    const reader=await context.newPage();await reader.goto(base+'document.html?id=device-note',{waitUntil:'networkidle'});await reader.locator('.markdown-body h1').waitFor();assert.equal(await reader.locator('.cloud-login').count(),0);await reader.close();
  });
  await check('network, rate-limit, inaccessible repositories and damaged data retain the saved key for retry',async()=>{
    for(const failure of ['offline','limited','missing','damaged-data']){
      mode=failure;await page.reload({waitUntil:'networkidle'});await page.locator('.cloud-login[open]').waitFor();await page.getByRole('button',{name:'重试自动连接',exact:true}).waitFor();assert.ok(await record(page));assert.equal(await page.getByLabel('GitHub 访问密钥',{exact:true}).inputValue(),'');
      mode='valid';await page.getByRole('button',{name:'重试自动连接',exact:true}).click();await page.locator('#content h1').waitFor();assert.equal(await page.locator('.cloud-login').count(),0);
    }
  });
  await check('revoked keys are cleared and replacement keys can be remembered',async()=>{
    mode='revoked';await page.reload({waitUntil:'networkidle'});await page.locator('.form-error').filter({hasText:'保存的密钥已失效'}).waitFor();assert.equal(await record(page),undefined);
    mode='valid';validToken='replacement-test-device-token';await login();await page.reload({waitUntil:'networkidle'});await page.locator('#content h1').waitFor();assert.equal(await page.locator('.cloud-login').count(),0);
  });
  await check('corrupted ciphertext is discarded and session-only mode still requires login after refresh',async()=>{
    await page.evaluate(async()=>{
      const db=await new Promise(resolve=>{const r=indexedDB.open('work-hub-device-session:/work-home/');r.onsuccess=()=>resolve(r.result);});
      try {await new Promise((resolve,reject)=>{const tx=db.transaction('connection','readwrite'),store=tx.objectStore('connection'),r=store.get('current');r.onsuccess=()=>{const value=r.result;const bytes=new Uint8Array(value.ciphertext);bytes[0]^=1;store.put(value,'current');};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}
    });
    await page.reload({waitUntil:'networkidle'});await page.locator('.cloud-login[open]').waitFor();assert.equal(await record(page),undefined);await login({remember:false});assert.equal(await record(page),undefined);
    await page.reload({waitUntil:'networkidle'});await page.locator('.cloud-login[open]').waitFor();assert.equal(await page.getByLabel('GitHub 访问密钥',{exact:true}).inputValue(),'');await login({remember:false});
  });
  await check('settings can remember the existing connection, and signout clears it in every open app tab',async()=>{
    await page.evaluate(()=>location.hash='settings');await page.getByRole('button',{name:'记住此设备',exact:true}).click();await page.getByText('已记住此设备，下次打开会自动连接。',{exact:true}).waitFor();assert.ok(await record(page));
    await page.screenshot({path:'artifacts/device-settings-390.png',fullPage:true});
    const reader=await context.newPage();await reader.goto(base+'document.html?id=device-note',{waitUntil:'networkidle'});await reader.locator('.markdown-body h1').waitFor();
    await page.getByRole('button',{name:'退出并清除此设备',exact:true}).click();await page.locator('.cloud-login[open]').waitFor();await reader.locator('.cloud-login[open]').waitFor();assert.equal(await record(page),undefined);
    assert.equal(await page.getByLabel('GitHub 访问密钥',{exact:true}).inputValue(),'');assert.equal(writes,0);await reader.close();
  });
  await check('blocked device storage fails visibly and allows an explicit session-only connection',async()=>{
    blockedContext=await launch(path.join(dir,'blocked-profile'));await blockedContext.addInitScript(()=>{indexedDB.open=()=>{throw new DOMException('Storage blocked','SecurityError');};});
    const blocked=await blockedContext.newPage();await blocked.goto(base,{waitUntil:'networkidle'});await blocked.getByLabel('GitHub 访问密钥',{exact:true}).fill(validToken);await blocked.getByRole('button',{name:'连接私有资料',exact:true}).click();await blocked.locator('.form-error').filter({hasText:'此设备无法保存登录信息'}).waitFor();
    await blocked.getByRole('checkbox',{name:/记住此设备/}).uncheck();await blocked.getByRole('button',{name:'连接私有资料',exact:true}).click();await blocked.locator('#content h1').waitFor();assert.equal(await blocked.locator('.cloud-login').count(),0);
  });
  console.log(`Device session E2E complete: ${passed} groups passed; isolated profiles and mocked GitHub only; no real user credentials used.`);
}finally{
  if(blockedContext)await blockedContext.close();if(context)await context.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});
}

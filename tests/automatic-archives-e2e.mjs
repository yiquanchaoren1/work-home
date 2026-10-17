import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';
import {seedData} from '../public/seed.js';
import {dayKey} from '../public/personal.js';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-auto-archives-'));
let server,browser,passed=0,counter=0,writes=0,sourceFailure=false;
const today=dayKey(),yesterday=new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10),at=new Date().toISOString();
const files=new Map(),install=(name,body)=>files.set(name,{bytes:Buffer.from(body),sha:'sha-'+(++counter)});
const data=structuredClone(seedData);
data.notes=[{id:'retained-note',title:'保留的工作文档',body:'原有工作文档内容',category:'其他',format:'markdown',tags:[],pinned:false,taskId:'',createdAt:at,updatedAt:at}];
data.records=[{id:'retired-record',title:'旧验证记录独特检索词',kind:'源码核对',result:'通过',environment:'',version:'',command:'',log:'',body:'原有证据保留在备份',taskId:'',createdAt:at,updatedAt:at}];
data.dailyArchives=[{date:today,title:'已有当天记录',body:'保留旧记录，不提前作为完成日显示。',createdAt:at,updatedAt:at}];
install('workspace.json',JSON.stringify({revision:'auto-source-baseline',data}));const original=Buffer.from(files.get('workspace.json').bytes);
install('codex-worklogs/'+yesterday+'.md','# '+yesterday+' 工作摘要\n\n- 已结束日期的工作会自动出现。');
install('codex-worklogs/'+today+'.md','# '+today+' 工作摘要\n\n- 当天仍在整理，不提前展示。');
install('codex-worklogs/我的个人档案.md','# 我的个人档案\n\n- 测试用稳定偏好。');
install('codex-worklogs/历史工作总结.md','# 历史工作总结\n\n- 测试用既有重要工作。');
try {
  server=await createWorkHubServer({dataDir:path.join(dir,'data'),publicDir:path.resolve('dist-cloud')});
  const handle=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(req,res)=>{if(!req.url.startsWith('/work-home/')){res.writeHead(404);res.end();return;}req.url=req.url.slice('/work-home'.length);handle(req,res);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/work-home/';
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('https://api.github.com/**',async route=>{
    const req=route.request(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'accept,authorization,content-type,x-github-api-version','access-control-allow-methods':'GET,PUT,OPTIONS'};
    const fulfill=(status,body)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
    if(req.method()==='OPTIONS')return fulfill(204,{});
    if(req.headers().authorization!=='Bearer test-only-auto-archives')return fulfill(401,{});
    if(req.method()!=='GET'){writes++;return fulfill(500,{});}
    const url=new URL(req.url()),marker='/contents/',i=url.pathname.indexOf(marker);
    if(i<0)return fulfill(200,{private:true,archived:false,default_branch:'master'});
    const name=url.pathname.slice(i+marker.length).split('/').map(decodeURIComponent).join('/');
    if(sourceFailure&&name.startsWith('codex-worklogs'))return fulfill(403,{});
    const item=files.get(name);
    if(!item){const children=[...files.keys()].filter(p=>p.startsWith(name+'/'));return children.length?fulfill(200,children.map(p=>({type:'file',name:p.slice(name.length+1),sha:files.get(p).sha}))):fulfill(404,{});}
    return fulfill(200,{type:'file',sha:item.sha,encoding:'base64',content:item.bytes.toString('base64')});
  });
  const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
  await check('phone opening archives reads completed dates automatically with no sync button and no data writes',async()=>{
    await page.goto(base+'#archives',{waitUntil:'networkidle'});await page.getByLabel('GitHub 访问密钥',{exact:true}).fill('test-only-auto-archives');await page.getByRole('button',{name:'连接私有资料',exact:true}).click();
    await page.locator('[data-daily-archive="'+yesterday+'"]').waitFor();assert.equal(await page.locator('[data-daily-archive]').count(),1);assert.equal(await page.locator('[data-daily-archive="'+today+'"]').count(),0);
    assert.equal(await page.locator('[data-action="codex-sync"],#codex-since').count(),0);assert.equal(await page.locator('#navigation a[href="#records"]').count(),0);assert.equal(await page.locator('[data-archive-document]').count(),2);
    assert.equal(writes,0);assert.deepEqual(files.get('workspace.json').bytes,original);await page.screenshot({path:'artifacts/archives-auto-mobile.png',fullPage:true});
  });
  await check('returning to the app picks up a changed day and independent readers and backups include it',async()=>{
    install('codex-worklogs/'+yesterday+'.md','# '+yesterday+' 工作摘要\n\n- 前一天归档已自动更新。');
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByText('前一天归档已自动更新。',{exact:true}).waitFor();assert.equal(await page.locator('[data-daily-archive]').count(),1);
    const popup=page.waitForEvent('popup');await page.getByRole('link',{name:'查看摘要 ↗',exact:true}).click();const reader=await popup;await reader.getByText('前一天归档已自动更新。',{exact:true}).waitFor();await reader.close();
    const backup=await page.evaluate(async()=>{const {readBackup}=await import('./local-api.js');const result=await readBackup();return {daily:result.dailyArchives,records:result.records,notes:result.notes};});
    assert.match(backup.daily.find(item=>item.date===yesterday).body,/自动更新/);assert.deepEqual(backup.records,data.records);assert.deepEqual(backup.notes,data.notes);assert.equal(writes,0);
  });
  await check('source failures retain the last visible summary and recover on resume; removed record routes stay hidden',async()=>{
    sourceFailure=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByText('部分档案暂未更新',{exact:true}).waitFor();await page.getByText('前一天归档已自动更新。',{exact:true}).waitFor();
    sourceFailure=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.archive-auto-state').getByText('自动更新',{exact:true}).waitFor();
    await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'artifacts/archives-auto-desktop.png',fullPage:true});
    await page.evaluate(()=>location.hash='records');await page.getByRole('heading',{name:'今天，从这里开始。',exact:true}).waitFor();assert.equal(await page.locator('a[href="#records"],[data-collection="records"]').count(),0);assert.equal(await page.locator('.stat-card[href="#archives"]').count(),1);
    await page.getByRole('button',{name:'搜索全部内容',exact:true}).click();await page.locator('#global-search').fill('旧验证记录独特检索词');assert.equal(await page.locator('.search-result').count(),0);await page.keyboard.press('Escape');
    for(const width of [320,390]){await page.setViewportSize({width,height:844});await page.evaluate(()=>location.hash='archives');await page.getByRole('heading',{name:'工作档案',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
    assert.deepEqual(files.get('workspace.json').bytes,original);assert.equal(writes,0);assert.deepEqual(errors,[]);
  });
  console.log(`Automatic archive E2E complete: ${passed} groups passed; isolated data and mocked GitHub only.`);
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});}

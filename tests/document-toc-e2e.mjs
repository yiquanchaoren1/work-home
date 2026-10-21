import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-toc-')),cloud=process.env.WORK_HUB_TOC_CLOUD==='1';
let server,browser,passed=0;
try{
  server=await createWorkHubServer({dataDir:path.join(dir,'data'),workspaceRoot:dir,automaticArchives:false,...(cloud?{publicDir:path.resolve('dist-cloud')}:{})});
  const stamp='2026-10-21T09:20:00Z',paragraph=('这一段保留正文，用来核对长文滚动与目录定位。\n\n').repeat(18);
  const body=['# 开始',paragraph,'## 重复标题',paragraph,'## 重复标题',paragraph,'### **加粗** 与 [链接](https://example.com)',paragraph,'#### <img src=x onerror="window.__tocInjected=true">',paragraph,'##### 第五级',paragraph,'###### 第六级',paragraph,'Setext 标题\n-----------',paragraph,'```md\n# 代码块里的标题不进入目录\n```'].join('\n\n');
  const note=(id,format,text)=>({id,title:id,category:'源码学习',body:text,format,tags:[],taskId:'',pinned:false,createdAt:stamp,updatedAt:stamp});
  const data={version:1,tasks:[],links:[],notes:[note('toc-md','markdown',body),note('no-headings','markdown','普通正文，保持原布局。'),note('plain-note','text','# 文本不作为Markdown目录')],records:[],activity:[],settings:{name:'目录测试',design:'experimental',theme:'dark'}};
  const first=await server.workspace.getState();await server.workspace.putState({revision:first.revision,data});
  let remote={revision:'fixture-0',data:structuredClone(data)};
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port+'/';
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(cloud)await context.route('https://api.github.com/**',async route=>{
    const req=route.request(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,OPTIONS'};
    const respond=(status,body)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
    if(req.method()==='OPTIONS')return respond(204,{});assert.equal(req.headers().authorization,'Bearer toc-test-only');
    const url=new URL(req.url());if(!url.pathname.includes('/contents/'))return respond(200,{private:true,archived:false,default_branch:'master'});
    if(url.pathname.endsWith('/workspace.json'))return respond(200,{type:'file',sha:remote.revision,encoding:'base64',content:Buffer.from(JSON.stringify(remote)).toString('base64')});
    return respond(404,{});
  });
  const open=async(id,hash='')=>{
    await page.goto(base+'document.html?id='+id+hash,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelector('.reader-content')||document.querySelector('input[name="token"]'));
    if(cloud&&await page.getByLabel('GitHub 访问密钥',{exact:true}).isVisible()){await page.getByLabel('GitHub 访问密钥',{exact:true}).fill('toc-test-only');await page.getByRole('button',{name:'连接私有资料',exact:true}).click();}
    await page.locator('.reader-content').waitFor();
  };
  const check=async(name,run)=>{await run();passed++;console.log('PASS '+name);};
  const active=id=>page.waitForFunction(id=>document.querySelector('.reader-toc-link[aria-current]')?.dataset.heading===id,id);
  const visibleHeading=async id=>{const box=await page.locator('#'+id).boundingBox();const bar=await page.locator('.reader-topbar').evaluate(el=>({bottom:el.getBoundingClientRect().bottom,sticky:getComputedStyle(el).position==='sticky'}));assert.ok(box.y>=(bar.sticky?bar.bottom:0)-1&&box.y<600,JSON.stringify({box,bar}));};
  await open('toc-md');
  await check('all heading levels, repeated and Chinese labels have unique anchors; code and raw HTML cannot inject navigation',async()=>{
    assert.equal(await page.locator('.reader-toc-link').count(),8);const headings=await page.locator('.reader-content h1,.reader-content h2,.reader-content h3,.reader-content h4,.reader-content h5,.reader-content h6').evaluateAll(nodes=>nodes.map(h=>({id:h.id,text:h.textContent})));
    assert.equal(new Set(headings.map(h=>h.id)).size,8);assert.equal(headings[1].text,headings[2].text);assert.equal(await page.locator('.reader-toc a a,.reader-toc img,.reader-toc script').count(),0);assert.equal(await page.evaluate(()=>window.__tocInjected),undefined);assert.equal(await page.locator('.reader-toc').evaluate(el=>el.open),true);
  });
  await check('clicking duplicate headings and keyboard activation jump below the sticky toolbar',async()=>{
    await page.locator('.reader-toc-link').nth(2).click();await active('md-heading-3');await visibleHeading('md-heading-3');assert.match(page.url(),/#md-heading-3$/);
    await page.locator('.reader-toc-link').nth(1).focus();await page.keyboard.press('Enter');await active('md-heading-2');await visibleHeading('md-heading-2');assert.equal(await page.evaluate(()=>document.activeElement.id),'md-heading-2');
  });
  await check('scrolling updates the current chapter and loading a direct anchor restores the target',async()=>{
    await page.locator('#md-heading-6').evaluate(el=>el.scrollIntoView({block:'start'}));await active('md-heading-6');
    await open('toc-md','#md-heading-4');await active('md-heading-4');await visibleHeading('md-heading-4');
  });
  await check('four themes in both modes fit desktop and phone; phone directory collapses after a jump',async()=>{
    for(const width of [1440,768,390])for(const design of ['experimental','paper','gallery','porcelain'])for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:1000});await page.evaluate(({design,theme})=>{document.documentElement.dataset.design=design;document.documentElement.dataset.theme=theme;},{design,theme});
      await page.waitForTimeout(25);const size=await page.evaluate(()=>({width:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(size.doc<=size.width+1&&size.body<=size.width+1,JSON.stringify({design,theme,size}));
    }
    await open('toc-md');assert.equal(await page.locator('.reader-toc').evaluate(el=>el.open),false);await page.locator('.reader-toc-summary').click();await page.locator('.reader-toc-link').nth(3).click();assert.equal(await page.locator('.reader-toc').evaluate(el=>el.open),false);await active('md-heading-4');await visibleHeading('md-heading-4');
  });
  await check('notes without headings and plain text preserve the original reader without an empty sidebar',async()=>{
    for(const id of ['no-headings','plain-note']){await open(id);assert.equal(await page.locator('.reader-toc').count(),0);assert.equal(await page.locator('.reader-with-toc').count(),0);}
  });
  await check('refresh after editing rebuilds one directory and retains exact Markdown downloads',async()=>{
    await page.setViewportSize({width:1440,height:1000});await open('toc-md');
    const next=structuredClone(data);next.notes[0].body+='\n\n## 新章节\n\n核对更新。';
    if(cloud)remote={revision:'fixture-1',data:next};else{const latest=await server.workspace.getState();await server.workspace.putState({revision:latest.revision,data:next});}
    // The existing cloud reader may reuse an authenticated snapshot for 1.5 seconds.
    if(cloud)await page.waitForTimeout(1600);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.querySelectorAll('.reader-toc-link').length===9);assert.equal(await page.locator('.reader-toc').count(),1);
    const pending=page.waitForEvent('download');await page.locator('#document-download').click();const download=await pending;assert.equal(await fs.readFile(await download.path(),'utf8'),next.notes[0].body);
    await fs.mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/document-toc-'+(cloud?'cloud':'disk')+'.png'});
  });
  assert.deepEqual(errors,[]);console.log(`Document TOC E2E: ${passed} groups, ${cloud?'mocked cloud':'isolated disk'}, no private user data.`);
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});}

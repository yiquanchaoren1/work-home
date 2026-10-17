import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-install-'));
let server,local,browser,passed=0;
try {
  server=await createWorkHubServer({dataDir:path.join(dir,'cloud'),publicDir:path.resolve('dist-cloud')});
  const handler=server.listeners('request')[0];server.removeAllListeners('request');
  server.on('request',(req,res)=>{if(!req.url.startsWith('/work-home/')){res.writeHead(404);res.end();return;}req.url=req.url.slice('/work-home'.length);handler(req,res);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port+'/work-home/';
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],github=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',req=>{if(req.url().startsWith('https://api.github.com/'))github.push(req.url());});
  const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
  const open=async()=>{await page.locator('.cloud-install-entry').click();await page.locator('#install-app-dialog[open]').waitFor();};
  await check('the actual manifest and icon URLs load under the Pages subpath',async()=>{
    await page.goto(base,{waitUntil:'networkidle'});await page.locator('.cloud-login[open]').waitFor();
    const cdp=await context.newCDPSession(page);await cdp.send('Page.enable');
    const manifest=await cdp.send('Page.getAppManifest');assert.equal(manifest.url,base+'manifest.webmanifest');assert.deepEqual(manifest.errors,[]);
    const config=JSON.parse(manifest.data);assert.equal(new URL(config.start_url,manifest.url).href,base);
    for(const item of config.icons){const response=await context.request.get(new URL(item.src,manifest.url).href);assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/^image\/png/);}
    const response=await context.request.get(manifest.url);assert.match(response.headers()['content-type'],/manifest\+json/);
    await cdp.detach();
    // Chrome blocks installation in the isolated/incognito test context. Also
    // inspect a fresh regular profile so real app criteria are checked directly.
    const normal=await chromium.launchPersistentContext(path.join(dir,'browser-profile'),{channel:'chrome',headless:true});
    try {
      const normalPage=await normal.newPage();await normalPage.goto(base,{waitUntil:'networkidle'});
      const session=await normal.newCDPSession(normalPage);await session.send('Page.enable');
      const result=await session.send('Page.getInstallabilityErrors');console.log('Chromium regular-profile installability: '+JSON.stringify(result.installabilityErrors));assert.deepEqual(result.installabilityErrors,[]);
    }finally{await normal.close();}
  });
  await check('installation help works before login without submitting or clearing the credential field',async()=>{
    await page.getByLabel('GitHub 访问密钥',{exact:true}).fill('test-only-not-submitted');
    await open();await page.getByRole('button',{name:'iPhone / iPad',exact:true}).click();assert.equal(await page.locator('[data-install-steps="ios"]').isVisible(),true);
    await page.getByRole('button',{name:'安卓手机',exact:true}).click();assert.equal(await page.locator('[data-install-steps="android"]').isVisible(),true);
    await page.screenshot({path:'artifacts/install-mobile-390.png',fullPage:true});
    await page.keyboard.press('Escape');assert.equal(await page.locator('#install-app-dialog').isVisible(),false);assert.equal(await page.locator('.cloud-login').isVisible(),true);
    assert.equal(await page.getByLabel('GitHub 访问密钥',{exact:true}).inputValue(),'test-only-not-submitted');assert.deepEqual(github,[]);
    await page.getByLabel('GitHub 访问密钥',{exact:true}).fill('');
  });
  await check('the native install prompt preserves its click gesture, handles cancellation and can retry after a new event',async()=>{
    const prompt=async outcome=>page.evaluate(outcome=>{
      const event=new Event('beforeinstallprompt',{cancelable:true});
      event.prompt=async()=>{window.promptCalls=(window.promptCalls||0)+1;window.promptHadGesture=navigator.userActivation.isActive;};
      event.userChoice=Promise.resolve({outcome,platform:'web'});window.dispatchEvent(event);
    },outcome);
    await prompt('dismissed');await open();await page.locator('[data-native-install]').click();await page.getByText('暂未安装。你仍可按浏览器菜单步骤添加到桌面。',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.promptCalls),1);assert.equal(await page.evaluate(()=>window.promptHadGesture),true);assert.equal(await page.locator('[data-native-install]').isVisible(),false);
    await prompt('accepted');await page.locator('[data-native-install]').click();await page.getByText('已确认安装，等待浏览器完成。完成后可从桌面打开。',{exact:true}).waitFor();
    await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));await page.getByText('已安装。下次可以从桌面打开工作间。',{exact:true}).waitFor();assert.equal(await page.locator('[data-native-install]').isVisible(),false);
    await page.getByRole('button',{name:'关闭安装说明',exact:true}).click();
  });
  await check('phone and landscape layouts fit, and installation does not persist private data or register caches',async()=>{
    for(const [width,height] of [[320,700],[390,844],[844,390]]){
      await page.setViewportSize({width,height});await open();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await page.locator('#install-app-dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false);await page.getByRole('button',{name:'关闭安装说明',exact:true}).click();
    }
    assert.deepEqual(await page.evaluate(async()=>({local:localStorage.length,session:sessionStorage.length,cache:await caches.keys(),workers:(await navigator.serviceWorker.getRegistrations()).length})),{local:0,session:0,cache:[],workers:0});
    assert.deepEqual(await context.cookies(),[]);assert.deepEqual(github,[]);assert.deepEqual(errors,[]);
  });
  await check('iPhone selects Safari steps and recognises an existing standalone window',async()=>{
    const ios=await browser.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
    await ios.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));const phone=await ios.newPage();await phone.goto(base,{waitUntil:'networkidle'});await phone.locator('.cloud-install-entry').click();
    assert.equal(await phone.locator('[data-install-platform="ios"]').getAttribute('aria-pressed'),'true');await phone.getByText('当前已在 App 窗口中打开，可以直接使用。',{exact:true}).waitFor();await ios.close();
  });
  await check('the local settings and top bar expose installation without changing existing work data',async()=>{
    local=await createWorkHubServer({dataDir:path.join(dir,'local')});await new Promise(r=>local.listen(0,'127.0.0.1',r));const before=await local.workspace.getState();
    const localPage=await context.newPage();await localPage.goto('http://127.0.0.1:'+local.address().port+'/#settings',{waitUntil:'networkidle'});await localPage.locator('.install-panel [data-install-app]').click();await localPage.locator('#install-app-dialog[open]').waitFor();await localPage.keyboard.press('Escape');
    for(const width of [320,390,844]){await localPage.setViewportSize({width,height:844});assert.equal(await localPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await localPage.locator('.topbar [data-install-app]').click();await localPage.locator('#install-app-dialog[open]').waitFor();await localPage.keyboard.press('Escape');}
    await localPage.locator('.topbar [data-install-app]').click();assert.deepEqual(await local.workspace.getState(),before);
    await localPage.setViewportSize({width:1440,height:1000});await localPage.screenshot({path:'artifacts/install-desktop.png',fullPage:true});await localPage.close();
  });
  console.log(`Install E2E complete: ${passed} groups passed; native choices simulated, physical phone installation needs the user.`);
} finally {
  if(browser)await browser.close();for(const service of [server,local])if(service){service.closeAllConnections();await new Promise(r=>service.close(r));}
  assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});
}

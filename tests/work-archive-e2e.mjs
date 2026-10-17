import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createWorkHubServer} from '../backend.mjs';
import {linksForTask} from '../public/task-links.js';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-archive-flow-')),sessions=path.join(dir,'sessions'),workspace=path.join(dir,'workspace');
await fs.mkdir(sessions,{recursive:true});await fs.mkdir(workspace,{recursive:true});
const at='2026-10-16T08:00:00.000Z',file=path.join(sessions,'thread.jsonl');
const worklogs=path.join(workspace,'docs','codex_worklogs'),dailyFile=path.join(worklogs,'2026-10-16.md');await fs.mkdir(worklogs,{recursive:true});await fs.writeFile(dailyFile,'# 2026-10-16 工作摘要\n\n- 完成源码核对，未运行性能测试。\n');
const msg=(role,text)=>JSON.stringify({timestamp:at,type:'response_item',payload:{type:'message',role,...(role==='assistant'?{phase:'final_answer'}:{}),content:[{type:role==='user'?'input_text':'output_text',text}]}})+'\n';
await fs.writeFile(file,JSON.stringify({type:'session_meta',payload:{id:'test-session',cwd:workspace,thread_source:'user'}})+'\n'+msg('user','我的当天工作')+msg('assistant','完成源码核对，未运行性能测试'));
let server,browser,passed=0;
try {
  server=await createWorkHubServer({dataDir:path.join(dir,'data'),codexRoots:[sessions],workspaceRoot:workspace,automaticArchives:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port,first=await server.workspace.getState(),initial=structuredClone(first.data);
  const [a,b]=initial.tasks;for(const task of initial.tasks)task.status='待开始';
  initial.links=[{id:'shared',title:'共同研发资料',url:'https://example.com/shared',category:'参考资料',description:'',tags:[],pinned:false,taskId:b.id,createdAt:at,updatedAt:at},{id:'other',title:'测试环境入口',url:'https://example.com/env',category:'环境工具',description:'',tags:[],pinned:false,taskId:'',createdAt:at,updatedAt:at}];
  await server.workspace.putState({data:initial,revision:first.revision});
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const go=async hash=>{const target=base+'/#'+hash;if(page.url()===target)await page.reload({waitUntil:'networkidle'});else await page.goto(target,{waitUntil:'networkidle'});await page.locator('#content h1').waitFor();};
  const act=name=>page.locator('[data-action="'+name+'"]');
  const state=()=>server.workspace.getState();
  const view=async()=>(await fetch(base+'/api/state')).json();
  const save=async()=>{await page.locator('#modal button[type=submit]').click();await page.locator('#modal').waitFor({state:'hidden'});};
  const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
  await check('status shortcut saves without changing order; filtered cards update and failed save reverts',async()=>{
    await go('tasks');const select=page.locator('[data-task-status="'+a.id+'"]');await select.selectOption('进行中');await page.waitForFunction(async id=>(await(await fetch('/api/state')).json()).data.tasks.find(t=>t.id===id).status==='进行中',a.id);assert.deepEqual((await state()).data.tasks.map(t=>t.id),initial.tasks.map(t=>t.id));
    await page.locator('[data-action=filter][data-value="进行中"]').click();assert.equal(await page.locator('#sortable-tasks [data-task-id]').count(),1);await select.selectOption('等待反馈');await page.waitForFunction(()=>!document.querySelector('#sortable-tasks [data-task-id]'));
    await page.locator('[data-action=filter][data-value=""]').click();await page.route('**/api/state',r=>r.request().method()==='PUT'?r.abort():r.continue());await select.selectOption('已完成');await page.waitForFunction(id=>document.querySelector('[data-task-status="'+id+'"]').value==='等待反馈',a.id);assert.equal((await state()).data.tasks.find(t=>t.id===a.id).status,'等待反馈');await page.unroute('**/api/state');
  });
  await check('existing links can be selected, shared, searched and removed without stealing another task association',async()=>{
    await page.locator('[data-action=task-links][data-id="'+a.id+'"]').click();await page.locator('#modal input[value=shared]').check();await page.locator('#task-link-search').fill('不存在');assert.equal(await page.locator('[data-link-choice]:visible').count(),0);await page.locator('#task-link-search').fill('');await page.locator('#modal input[value=other]').check();await save();
    let current=(await state()).data;assert.equal(current.links.find(l=>l.id==='shared').taskId,b.id);assert.equal(linksForTask(current,a.id).length,2);assert.equal(linksForTask(current,b.id).length,1);assert.equal(current.links.length,2);
    await go('detail/'+a.id);assert.equal(await page.locator('.link-card').count(),2);await act('task-links').click();await page.locator('#modal input[value=other]').uncheck();await save();current=(await state()).data;assert.equal(linksForTask(current,a.id).length,1);assert.equal(current.links.length,2);
    await go('tasks');await page.locator('[data-action=new][data-collection=tasks]').click();await page.locator('#modal [name=title]').fill('新建并关联');await page.locator('#modal input[value=other]').check();await save();const added=(await state()).data.tasks.find(t=>t.title==='新建并关联');assert.deepEqual(added.linkIds,['other']);
  });
  await check('daily summaries stay outside the knowledge library, update one date/file and open in a separate reader',async()=>{
    await go('archives');assert.equal(await page.locator('#navigation a[href="#archives"]').count(),1);for(const removed of ['profile','journal','portable'])assert.equal(await page.locator('#navigation a[href="#'+removed+'"]').count(),0);
    const notes=structuredClone((await state()).data.notes);assert.equal(await act('codex-sync').count(),0);assert.equal(await page.locator('#codex-since').count(),0);await page.locator('[data-daily-archive]').waitFor();let current=await view();let summary=current.data.dailyArchives[0];assert.ok(!summary.body.includes('我的当天工作'));assert.ok(summary.body.includes('未运行性能测试'));assert.deepEqual(current.data.notes,notes);assert.deepEqual(await fs.readdir(current.codexDir),['2026-10-16.md']);
    const revision=current.revision;await go('archives');assert.equal((await state()).revision,revision);
    await fs.writeFile(dailyFile,'# 2026-10-16 工作摘要\n\n- 合并当天的重要结果，性能待验证。\n');await fs.appendFile(file,msg('assistant','不应复制的原始输出'));await go('archives');await page.getByText('合并当天的重要结果，性能待验证。',{exact:true}).waitFor();current=await view();assert.equal(current.data.dailyArchives.length,1);assert.deepEqual(current.data.notes,notes);assert.deepEqual(await fs.readdir(current.codexDir),['2026-10-16.md']);
    const [reader]=await Promise.all([page.waitForEvent('popup'),page.getByRole('link',{name:'查看摘要 ↗',exact:true}).click()]);await reader.waitForLoadState('networkidle');assert.ok((await reader.locator('#reader').innerText()).includes('合并当天的重要结果'));assert.ok(!(await reader.locator('#reader').innerText()).includes('不应复制的原始输出'));const [download]=await Promise.all([reader.waitForEvent('download'),reader.getByRole('button',{name:'下载 Markdown'}).click()]);assert.equal(download.suggestedFilename(),'2026-10-16.md');assert.equal(await fs.readFile(await download.path(),'utf8'),current.data.dailyArchives[0].body);await reader.close();
    await page.locator('#archive-filter-form [name=search]').fill('合并当天');await page.locator('#archive-filter-form button[type=submit]').click();assert.equal(await page.locator('[data-daily-archive]').count(),1);
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  });
  await check('historical summary and detailed personal profile are independent files, searchable and downloadable outside the knowledge library',async()=>{
    await fs.writeFile(path.join(worklogs,'历史工作总结.md'),'# 历史工作总结\n\n- 算子与性能研究的重要工作。\n');await fs.writeFile(path.join(worklogs,'我的个人档案.md'),'# 我的个人档案\n\n## 本人明确陈述\n\n- 研究生阶段做过 DCU 上的 CFD。\n\n## 待确认\n\n- 长期职业方向。\n');
    const notes=structuredClone((await state()).data.notes);await go('archives');await page.locator('[data-archive-document=profile]').waitFor();assert.equal(await page.locator('[data-archive-document]').count(),2);assert.deepEqual((await state()).data.notes,notes);
    await page.getByText('归档什么时候更新？',{exact:true}).click();assert.ok((await page.locator('.archive-how').innerText()).includes('北京时间 00:00'));
    const [profile]=await Promise.all([page.waitForEvent('popup'),page.getByRole('link',{name:'查看个人档案 ↗',exact:true}).click()]);await profile.waitForLoadState('networkidle');assert.ok((await profile.locator('#reader').innerText()).includes('DCU'));assert.equal(await profile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const [download]=await Promise.all([profile.waitForEvent('download'),profile.getByRole('button',{name:'下载 Markdown'}).click()]);assert.equal(download.suggestedFilename(),'我的个人档案.md');assert.equal(await fs.readFile(await download.path(),'utf8'),(await view()).data.archiveDocuments.find(d=>d.id==='profile').body);await profile.close();
    await go('archives/profile');await page.locator('[data-archive-document=profile]').waitFor();await go('archives');await page.getByRole('button',{name:'搜索全部内容'}).click();await page.locator('#global-search').fill('CFD');await page.getByRole('link',{name:/我的个人档案/}).waitFor();await act('close').last().click();
  });
  assert.deepEqual(errors,[]);console.log(`Work archive E2E complete: ${passed} groups passed; all data isolated.`);
} finally {
  if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});
}

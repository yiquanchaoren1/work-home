import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { seedData } from '../public/seed.js';
import { validateBackup,mergeData } from '../public/store.js';
import { buildPersonalDocument,dayKey } from '../public/personal.js';
import { createWorkHubServer } from '../backend.mjs';
const clone=x=>structuredClone(x),at='2026-10-16T08:00:00.000Z';
const entry=(id,extra={})=>({id,title:'我的偏好',kind:'preference',status:'confirmed',body:'先说明结论。\n保留原始换行。',sourceNoteId:'',sourceLabel:'本人填写',sourceQuote:'',createdAt:at,updatedAt:at,history:[],...extra});
const journal=(id,extra={})=>({id,title:'今天的工作',date:'2026-10-16',taskIds:['ref-source'],work:'核对源码',conclusion:'尚未运行验证',problems:'待补充环境',learning:'区分事实与推断',nextStep:'补充小输入',createdAt:at,updatedAt:at,history:[],...extra});
function sample(){return {...clone(seedData),personal:{entries:[entry('pref')],journals:[journal('day')]}};}
test('personal schema is optional for legacy data, preserves history and rejects invalid dates, types and global ID collisions',()=>{
  assert.deepEqual(validateBackup(seedData),seedData);
  const input=sample();input.personal.entries[0].history=[{at,text:'旧偏好'}];assert.deepEqual(validateBackup(input),input);
  for(const mutate of [x=>x.personal.entries[0].status='guessed',x=>x.personal.entries[0].body=null,x=>x.personal.journals[0].date='2026-02-30',x=>x.personal.entries[0].id=x.tasks[0].id,x=>x.personal.journals[0].taskIds='not-array']){
    const invalid=clone(input);mutate(invalid);assert.throws(()=>validateBackup(invalid));
  }
  assert.equal(dayKey(new Date('2026-10-15T16:30:00Z')),'2026-10-16');
});
test('complete document contains full history, notes and source IDs; compact excludes pending and inactive preferences',()=>{
  const input=sample();input.personal.entries.push(entry('pending',{status:'pending',body:'独有待确认内容'}),entry('inactive',{status:'inactive',body:'独有过时内容'}));
  input.personal.entries[0].history=[{at,text:'独有旧修订'}];input.notes[0].body='# 原文\n```text\n未处理的原文\n```\n';
  const full=buildPersonalDocument(input),compact=buildPersonalDocument(input,{compact:true,request:'帮我写日报'});
  for(const text of ['独有待确认内容','独有过时内容','独有旧修订',input.notes[0].body,'核对源码','ref-source'])assert.ok(full.includes(text),text);
  for(const text of ['独有待确认内容','独有过时内容','独有旧修订'])assert.ok(!compact.includes(text),text);
  assert.ok(compact.includes('先说明结论'));assert.ok(compact.includes('帮我写日报'));assert.match(full,/````text/);
  assert.equal(buildPersonalDocument(input),full,'export must be stable between saves');
});
test('merging preserves personal conflicts as pending copies and remaps task and note sources idempotently',()=>{
  const current=sample(),incoming=sample();incoming.personal.entries[0].body='新备份里的偏好';
  const merged=mergeData(current,incoming);assert.equal(merged.personal.entries.length,2);assert.equal(merged.personal.entries[1].status,'pending');assert.equal(merged.personal.entries[0].body,current.personal.entries[0].body);
  assert.deepEqual(mergeData(merged,incoming),merged);
  const other=clone(seedData);other.notes[0].id='ref-source';other.tasks=other.tasks.filter(t=>t.id!=='ref-source');for(const n of other.notes)if(n.taskId==='ref-source')n.taskId='';
  const relocated=mergeData(other,sample());assert.equal(relocated.personal.journals[0].taskIds[0],'tasks:ref-source');
});
async function fixture(t){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-personal-'));let server,origin;
  const start=async()=>{server=await createWorkHubServer({dataDir:dir});await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;};
  const stop=async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));};await start();
  t.after(async()=>{await stop();assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});});
  return {dir,get server(){return server;},async restart(){await stop();await start();},async request(route,method='GET',data){return fetch(origin+route,{method,headers:method==='GET'?{}:{Origin:origin,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});},async state(){return (await this.request('/api/state')).json();}};
}
test('personal archive survives service restart and complete restore, with exact Markdown generated from authoritative state',async t=>{
  const f=await fixture(t),initial=await f.state(),input=sample();
  let response=await f.request('/api/state','PUT',{data:input,revision:initial.revision});assert.equal(response.status,200);
  const saved=await response.json();assert.deepEqual(saved.data,input);assert.ok(saved.features.includes('personal-archive-v1'));
  assert.equal(await fs.readFile(saved.masterPath,'utf8'),buildPersonalDocument(input));
  await f.restart();assert.deepEqual((await f.state()).data,input);
  const backup=await(await f.request('/api/backup')).json();assert.deepEqual(backup.personal,input.personal);
  const destination=await fixture(t),fresh=await destination.state();response=await destination.request('/api/restore','POST',{data:backup,files:backup.files,mode:'replace',revision:fresh.revision});assert.equal(response.status,200);
  const restored=await response.json();assert.deepEqual(restored.data,input);assert.equal(await fs.readFile(restored.masterPath,'utf8'),buildPersonalDocument(input));
  response=await f.request('/api/state','PUT',{data:seedData,revision:initial.revision});assert.equal(response.status,409);assert.deepEqual((await f.state()).data,input);
  const latest=await f.state(),legacyTab=clone(latest.data);delete legacyTab.personal;legacyTab.settings.name='旧标签页保存';
  response=await f.request('/api/state','PUT',{data:legacyTab,revision:latest.revision});assert.equal(response.status,200);assert.deepEqual((await response.json()).data.personal,input.personal,'legacy tabs must not erase newly saved archives');
});
test('external master edits are preserved before regeneration; derived-document failures warn without dropping saved data',async t=>{
  const f=await fixture(t),initial=await f.state();await fs.writeFile(initial.masterPath,'Typora 站外修改');
  let current=await f.state();assert.match(current.warning,/站外编辑/);const files=await fs.readdir(path.join(f.dir,'backups'));const saved=files.find(x=>x.startsWith('external-personal-'));assert.ok(saved);assert.equal(await fs.readFile(path.join(f.dir,'backups',saved),'utf8'),'Typora 站外修改');
  await fs.rm(path.join(f.dir,'personal'),{recursive:true,force:true});await fs.writeFile(path.join(f.dir,'personal'),'阻止目录创建');
  const response=await f.request('/api/state','PUT',{data:sample(),revision:current.revision});assert.equal(response.status,200);current=await response.json();assert.match(current.warning,/主档案文档未更新/);assert.deepEqual(current.data,sample());
  await fs.unlink(path.join(f.dir,'personal'));current=await f.state();assert.equal(await fs.readFile(current.masterPath,'utf8'),buildPersonalDocument(current.data));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {collectDailySummaries,applyDailySummaries,applyArchiveDocuments} from '../codex-archive.mjs';
import {seedData} from '../public/seed.js';
import {validateBackup,mergeData} from '../public/store.js';
import {buildPersonalDocument} from '../public/personal.js';
import {createWorkHubServer,FileWorkspace} from '../backend.mjs';

const at='2026-10-16T08:00:00.000Z',hash=s=>createHash('sha256').update(s).digest('hex');
const summary=(date='2026-10-16',body='已核对源码；性能尚未测试。')=>({date,title:date+' 工作摘要',body,createdAt:at,updatedAt:at});
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-daily-'));const workspace=path.join(root,'workspace'),worklogs=path.join(workspace,'docs','codex_worklogs');await fs.mkdir(worklogs,{recursive:true});t.after(async()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));await fs.rm(root,{recursive:true,force:true});});return {root,workspace,worklogs};}

test('collects one prepared summary per date and never reads conversation logs or arbitrary documents',async t=>{
  const f=await fixture(t);
  await fs.writeFile(path.join(f.worklogs,'2026-10-16.md'),'# 工作摘要\n\n- 核对源码，尚未构建。\n');
  await fs.writeFile(path.join(f.worklogs,'2026-10-17.md'),'# 工作摘要\n\n- 次日完成回归。\n');
  await fs.writeFile(path.join(f.worklogs,'会话-2026-10-16.md'),'不应导入的输入输出');
  await fs.writeFile(path.join(f.worklogs,'2026-02-30.md'),'无效日期');
  await fs.mkdir(path.join(f.worklogs,'nested'));await fs.writeFile(path.join(f.worklogs,'nested','2026-10-16.md'),'不拆为第二份');
  await fs.writeFile(path.join(f.root,'transcript.jsonl'),'原始提问和答复');
  const result=await collectDailySummaries({workspaceRoot:f.workspace});assert.equal(result.documents.length,2);assert.deepEqual(result.warnings,[]);assert.ok(!JSON.stringify(result).includes('输入输出'));
  const limited=await collectDailySummaries({workspaceRoot:f.workspace,since:'2026-10-17'});assert.equal(limited.documents.length,1);
  await assert.rejects(collectDailySummaries({workspaceRoot:f.workspace,since:'2026-02-30'}),/日期无效/);
});

test('skips transcript-shaped and overlong sources with a visible warning instead of copying or silently truncating them',async t=>{
  const f=await fixture(t);
  await fs.writeFile(path.join(f.worklogs,'2026-10-16.md'),'# 记录\n\n## 对话原文\n\nuser: 完整输入');
  await fs.writeFile(path.join(f.worklogs,'2026-10-17.md'),'过'.repeat(6001));
  const result=await collectDailySummaries({workspaceRoot:f.workspace});assert.equal(result.documents.length,0);assert.equal(result.warnings.length,2);
});

test('collects only the named history/profile documents; updates each in place without altering original notes or daily records',async t=>{
  const f=await fixture(t);
  await fs.writeFile(path.join(f.worklogs,'历史工作总结.md'),'# 历史工作总结\n\n汇总重要成果。\n');
  await fs.writeFile(path.join(f.worklogs,'我的个人档案.md'),'# 我的个人档案\n\n本人陈述：从事 CFD。待确认：长期方向。\n');
  const collected=await collectDailySummaries({workspaceRoot:f.workspace,since:'2026-10-17'});assert.equal(collected.documents.length,0);assert.deepEqual(collected.archiveDocuments.map(d=>d.id),['history','profile']);
  const data=structuredClone(seedData),before=structuredClone(data);
  assert.equal(applyArchiveDocuments(data,collected.archiveDocuments,at).added,2);assert.equal(applyArchiveDocuments(data,collected.archiveDocuments,at).unchanged,2);assert.equal(data.notes.length,before.notes.length);assert.equal(data.dailyArchives,undefined);
  assert.equal(applyArchiveDocuments(data,[{...collected.archiveDocuments[1],body:'修订后的个人档案'}],at).updated,1);assert.equal(data.archiveDocuments.length,2);assert.deepEqual(validateBackup(data),data);
  assert.ok(buildPersonalDocument(data).includes('修订后的个人档案'));assert.ok(!buildPersonalDocument(data,{compact:true}).includes('修订后的个人档案'));
  const merged=mergeData(data,{...before,archiveDocuments:collected.archiveDocuments.map(doc=>({...doc,createdAt:at,updatedAt:at}))});assert.deepEqual(merged.archiveDocuments,data.archiveDocuments);
  assert.throws(()=>validateBackup({...data,archiveDocuments:[data.archiveDocuments[0],data.archiveDocuments[0]]}),/重复/);
  assert.throws(()=>validateBackup({...data,archiveDocuments:[{...data.archiveDocuments[0],id:'..'}]}),/类型无效/);
});

test('archive documents persist to named files, survive restart/restore and are protected when omitted by old clients',async t=>{
  const f=await fixture(t),dir=path.join(f.root,'data'),workspace=new FileWorkspace(dir,{workspaceRoot:f.workspace});await workspace.init();
  await fs.writeFile(path.join(f.worklogs,'历史工作总结.md'),'# 历史工作总结\n\n重要成果。\n');
  await fs.writeFile(path.join(f.worklogs,'我的个人档案.md'),'# 我的个人档案\n\n研究生阶段做过 DCU 上的 CFD。\n');
  const initial=await workspace.getState(),saved=await workspace.syncCodex({revision:initial.revision});assert.equal(saved.codexSync.archiveDocuments.added,2);assert.deepEqual(saved.data.notes,initial.data.notes);
  assert.deepEqual((await fs.readdir(saved.archiveDir)).sort(),['历史工作总结.md','我的个人档案.md'].sort());
  const again=await workspace.syncCodex({revision:saved.revision});assert.equal(again.revision,saved.revision);assert.equal(again.codexSync.archiveDocuments.unchanged,2);
  const legacy=structuredClone(saved.data);delete legacy.archiveDocuments;const protectedState=await workspace.putState({revision:saved.revision,data:legacy});assert.deepEqual(protectedState.data.archiveDocuments,saved.data.archiveDocuments);
  const restart=new FileWorkspace(dir,{workspaceRoot:f.workspace});assert.deepEqual((await restart.getState()).data.archiveDocuments,saved.data.archiveDocuments);
  const backup=await workspace.backupData(protectedState.data),fresh=new FileWorkspace(path.join(f.root,'restored'),{workspaceRoot:f.workspace});await fresh.init();const empty=await fresh.getState();const restored=await fresh.restore({revision:empty.revision,data:backup,files:backup.files||[],mode:'replace'});assert.deepEqual(restored.data.archiveDocuments,saved.data.archiveDocuments);assert.equal(await fs.readFile(path.join(restored.archiveDir,'我的个人档案.md'),'utf8'),saved.data.archiveDocuments.find(d=>d.id==='profile').body);
});

test('updates the same daily item without adding knowledge notes; schema, merge and AI export retain daily summaries',()=>{
  const data=structuredClone(seedData),notes=structuredClone(data.notes),doc=summary();
  assert.equal(applyDailySummaries(data,[doc],at).added,1);assert.equal(applyDailySummaries(data,[doc],at).unchanged,1);
  assert.equal(applyDailySummaries(data,[{...doc,body:'当日合并后的简要重要结果'}],at).updated,1);
  assert.equal(data.dailyArchives.length,1);assert.deepEqual(data.notes,notes);assert.deepEqual(validateBackup(data),data);
  for(const compact of [false,true])assert.ok(buildPersonalDocument(data,{compact}).includes('当日合并后的简要重要结果'));
  assert.throws(()=>validateBackup({...data,dailyArchives:[summary(),summary()]}),/重复/);
  const incoming={...structuredClone(seedData),dailyArchives:[summary(),summary('2026-10-17')]};
  const merged=mergeData(data,incoming);assert.equal(merged.dailyArchives.length,2);assert.equal(merged.dailyArchives[0].body,'当日合并后的简要重要结果');assert.deepEqual(mergeData(merged,incoming),merged);
});

test('sync API persists one file per day, checks revisions, preserves legacy-client omissions, backups and restart',async t=>{
  const f=await fixture(t),file=path.join(f.worklogs,'2026-10-16.md');await fs.writeFile(file,'# 工作摘要\n\n- 已核对源码。\n');
  const server=await createWorkHubServer({dataDir:path.join(f.root,'data'),workspaceRoot:f.workspace});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
  const origin='http://127.0.0.1:'+server.address().port;
  const send=(route,revision,data,method='POST')=>fetch(origin+route,{method,headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({revision,...data})});
  const initial=await server.workspace.getState();let response=await send('/api/codex/sync',initial.revision);assert.equal(response.status,200);const saved=await response.json();
  assert.equal(saved.codexSync.added,1);assert.deepEqual(saved.data.notes,initial.data.notes);assert.deepEqual(saved.data.tasks,initial.data.tasks);assert.deepEqual(await fs.readdir(saved.codexDir),['2026-10-16.md']);
  response=await send('/api/codex/sync',saved.revision);const second=await response.json();assert.equal(second.codexSync.unchanged,1);assert.equal(second.revision,saved.revision);
  await fs.writeFile(file,'# 工作摘要\n\n- 合并当天后续重要结果。\n');response=await send('/api/codex/sync',initial.revision);assert.equal(response.status,409);
  response=await send('/api/codex/sync',saved.revision);const updated=await response.json();assert.equal(updated.codexSync.updated,1);assert.equal(updated.data.dailyArchives.length,1);assert.deepEqual(await fs.readdir(updated.codexDir),['2026-10-16.md']);
  const legacy=structuredClone(updated.data);delete legacy.dailyArchives;response=await send('/api/state',updated.revision,{data:legacy},'PUT');assert.equal(response.status,200);const protectedState=await response.json();assert.deepEqual(protectedState.data.dailyArchives,updated.data.dailyArchives);
  assert.ok((await fs.readdir(path.join(f.root,'data','backups'))).some(f=>f.startsWith('before-daily-sync')));
  const copy=new FileWorkspace(path.join(f.root,'data'),{workspaceRoot:f.workspace});assert.deepEqual((await copy.getState()).data,protectedState.data);
  const backup=await copy.backupData(protectedState.data);assert.deepEqual(backup.dailyArchives,updated.data.dailyArchives);
  await fs.unlink(path.join(updated.codexDir,'2026-10-16.md'));response=await send('/api/codex/sync',protectedState.revision);assert.equal(response.status,200);assert.ok((await fs.readFile(path.join(updated.codexDir,'2026-10-16.md'),'utf8')).includes('合并当天'));
});

test('explicit cleanup deletes only legacy imported notes and generated copies, preserving original data and a recovery backup',async t=>{
  const f=await fixture(t),dir=path.join(f.root,'data'),workspace=new FileWorkspace(dir,{workspaceRoot:f.workspace});await workspace.init();
  const initial=await workspace.getState(),original=structuredClone(initial.data),note={...original.notes[0],id:'codex:old',body:'旧输入输出',format:'markdown',codex:{source:'session',sourceId:'session:old',date:'2026-10-16',bodyHash:hash('旧输入输出'),titleHash:hash(original.notes[0].title),sourceUpdatedAt:at,syncedAt:at}};
  const changed=structuredClone(original);changed.notes.push(note);changed.dailyArchives=[summary()];
  const saved=await workspace.putState({revision:initial.revision,data:changed});
  const legacy=path.join(dir,'codex','2026-10-16');await fs.mkdir(legacy,{recursive:true});const oldFile=path.join(legacy,'会话-'+hash(note.id).slice(0,12)+'.md');await fs.writeFile(oldFile,note.body);await fs.writeFile(path.join(legacy,'用户保留的文档.md'),'keep');
  await assert.rejects(workspace.clearLegacyCodexImports(initial.revision),e=>e.status===409);assert.equal((await workspace.getState()).data.notes.length,original.notes.length+1);
  const cleaned=await workspace.clearLegacyCodexImports(saved.revision);assert.equal(cleaned.removed,1);assert.deepEqual(cleaned.data,{...original,dailyArchives:[summary()]});
  await assert.rejects(fs.access(oldFile));await assert.rejects(fs.access(path.join(dir,'documents',hash(note.id)+'.md')));assert.equal(await fs.readFile(path.join(legacy,'用户保留的文档.md'),'utf8'),'keep');
  const backups=(await fs.readdir(path.join(dir,'backups'))).filter(f=>f.startsWith('before-remove-codex-imports'));assert.equal(backups.length,1);assert.ok(JSON.parse(await fs.readFile(path.join(dir,'backups',backups[0]),'utf8')).notes.some(n=>n.id===note.id));
  const previous=JSON.parse(await fs.readFile(workspace.previousPath,'utf8'));assert.deepEqual(previous.data,cleaned.data);assert.equal((await workspace.clearLegacyCodexImports(cleaned.revision)).removed,0);
});

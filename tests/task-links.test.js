import test from 'node:test';
import assert from 'node:assert/strict';
import {seedData} from '../public/seed.js';
import {linksForTask,setTaskLinks,removeTaskLink} from '../public/task-links.js';
import {validateBackup,mergeData} from '../public/store.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {FileWorkspace} from '../backend.mjs';
const at='2026-10-16T08:00:00.000Z';
const link=(id,url,taskId='')=>({id,url,taskId,title:id,category:'其他',description:'',tags:[],pinned:false,createdAt:at,updatedAt:at});
test('task picker shares legacy links without stealing associations; deselect and delete retain independent records',()=>{
  const d=structuredClone(seedData),[a,b]=d.tasks;d.links=[link('shared','https://example.com/shared',a.id),link('other','https://example.com/other')];
  setTaskLinks(d,b.id,['shared','other']);assert.equal(d.links[0].taskId,a.id);assert.equal(linksForTask(d,a.id).length,1);assert.equal(linksForTask(d,b.id).length,2);
  setTaskLinks(d,a.id,[]);assert.equal(d.links[0].taskId,'');assert.equal(linksForTask(d,b.id).length,2);assert.equal(d.links.length,2);
  removeTaskLink(d,'shared');d.links=d.links.filter(l=>l.id!=='shared');assert.equal(linksForTask(d,b.id).length,1);assert.deepEqual(validateBackup(d),d);
  assert.throws(()=>setTaskLinks(d,b.id,['missing']));
});
test('link references survive schema and backup merge after URL deduplication and ID remapping',()=>{
  const current=structuredClone(seedData),incoming=structuredClone(seedData);current.links=[link('current','https://example.com/shared')];incoming.tasks[0].id='new-task';for(const n of incoming.notes)if(n.taskId==='ref-source')n.taskId='new-task';incoming.links=[link('imported','https://example.com/shared')];incoming.tasks[0].linkIds=['imported'];
  const merged=mergeData(current,incoming);assert.deepEqual(merged.tasks.find(t=>t.id==='new-task').linkIds,['current']);assert.equal(merged.links.length,1);const bad=structuredClone(incoming);bad.tasks[0].linkIds=['missing'];assert.throws(()=>validateBackup(bad));assert.deepEqual(validateBackup(seedData),seedData);
});
test('legacy saves retain selected links and complete backup restores shared associations to a fresh directory',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-task-links-'));t.after(async()=>{assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});});
  const workspace=new FileWorkspace(path.join(dir,'source'));await workspace.init();let current=await workspace.getState();const data=current.data;data.links=[link('shared','https://example.com/shared',data.tasks[0].id)];setTaskLinks(data,data.tasks[1].id,['shared']);current=await workspace.putState({data,revision:current.revision});
  const legacy=structuredClone(current.data);for(const task of legacy.tasks)delete task.linkIds;current=await workspace.putState({data:legacy,revision:current.revision});assert.deepEqual(current.data.tasks[1].linkIds,['shared']);
  const backup=await workspace.exportBackup(),destination=new FileWorkspace(path.join(dir,'restored'));await destination.init();const first=await destination.getState();const restored=await destination.restore({data:backup,files:backup.files,mode:'replace',revision:first.revision});assert.deepEqual(restored.data,current.data);
  const deleting=structuredClone(current.data);deleting.links=[];for(const task of deleting.tasks)delete task.linkIds;current=await workspace.putState({data:deleting,revision:current.revision});assert.deepEqual(current.data.tasks[1].linkIds,[]);
});

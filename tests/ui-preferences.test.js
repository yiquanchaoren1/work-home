import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {FileWorkspace} from '../backend.mjs';
import {validateBackup,mergeData} from '../public/store.js';
import {seedData} from '../public/seed.js';

test('theme remains optional for legacy data and survives validation, merge and full restore',async t=>{
  assert.deepEqual(validateBackup(seedData),seedData);
  const dark=structuredClone(seedData);dark.settings.theme='dark';assert.deepEqual(validateBackup(dark),dark);
  assert.equal(mergeData(dark,seedData).settings.theme,'dark');
  assert.throws(()=>validateBackup({...dark,settings:{...dark.settings,theme:'invalid'}}),/settings.theme/);
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-theme-'));
  t.after(async()=>{assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});});
  const workspace=new FileWorkspace(path.join(dir,'source'));await workspace.init();const first=await workspace.getState();
  const state=await workspace.putState({revision:first.revision,data:dark});
  const legacy=structuredClone(state.data);delete legacy.settings.theme;legacy.settings.name='旧窗口修改名称';
  const protectedState=await workspace.putState({revision:state.revision,data:legacy});assert.equal(protectedState.data.settings.theme,'dark');assert.equal(protectedState.data.settings.name,legacy.settings.name);
  assert.equal((await new FileWorkspace(path.join(dir,'source')).getState()).data.settings.theme,'dark');
  const backup=await workspace.backupData(protectedState.data),target=new FileWorkspace(path.join(dir,'restored'));await target.init();const empty=await target.getState();
  const restored=await target.restore({revision:empty.revision,data:backup,files:backup.files||[],mode:'replace'});assert.deepEqual(restored.data,protectedState.data);
});

test('all four visual designs survive disk restart, old-client omissions and a full backup restore',async t=>{
  for(const design of ['paper','experimental','gallery','porcelain']) {
    const sample=structuredClone(seedData);sample.settings.design=design;sample.settings.theme='light';
    assert.deepEqual(validateBackup(sample),sample);assert.equal(mergeData(sample,seedData).settings.design,design);
  }
  for(const design of ['unknown','',null,42])assert.throws(()=>validateBackup({...seedData,settings:{...seedData.settings,design}}),/settings.design/);
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'work-hub-design-'));
  t.after(async()=>{assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});});
  const workspace=new FileWorkspace(path.join(dir,'source'));await workspace.init();const before=await workspace.getState(),data=structuredClone(before.data);
  data.settings.design='porcelain';data.settings.theme='dark';const saved=await workspace.putState({revision:before.revision,data});
  const oldClient=structuredClone(saved.data);delete oldClient.settings.design;oldClient.settings.name='只修改名称';
  const retained=await workspace.putState({revision:saved.revision,data:oldClient});assert.equal(retained.data.settings.design,'porcelain');
  assert.deepEqual(retained.data.tasks,before.data.tasks);assert.deepEqual(retained.data.notes,before.data.notes);
  const restarted=await new FileWorkspace(path.join(dir,'source')).getState();assert.equal(restarted.data.settings.design,'porcelain');
  const target=new FileWorkspace(path.join(dir,'restored'));await target.init();const empty=await target.getState(),backup=await workspace.backupData(retained.data);
  const restored=await target.restore({revision:empty.revision,data:backup,files:backup.files||[],mode:'replace'});assert.deepEqual(restored.data,retained.data);
});

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

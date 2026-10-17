import test from 'node:test';
import assert from 'node:assert/strict';
import { GithubWorkspace, encodeBytes, decodeBytes } from '../public/github-workspace.js';
import { seedData } from '../public/seed.js';

export function fakeGithub(initial = structuredClone(seedData)) {
  const files = new Map(), calls = []; let counter = 0, isPrivate = true, broken = false,archivesBroken=false;
  const install = (name, value) => files.set(name,{bytes:typeof value === 'string'?new TextEncoder().encode(value):value,sha:'sha-'+(++counter)});
  install('workspace.json',JSON.stringify({revision:'first',data:initial}));
  const fetchImpl = async (address,options) => {
    calls.push({address,method:options.method});
    assert.equal(new URL(address).origin,'https://api.github.com');
    assert.equal(options.headers.Authorization,'Bearer test-only-token');
    if(broken)throw Error('offline');
    const url = new URL(address),marker='/contents/',index=url.pathname.indexOf(marker);
    if(index<0)return Response.json({private:isPrivate,archived:false});
    const name=url.pathname.slice(index+marker.length).split('/').map(decodeURIComponent).join('/');
    if(archivesBroken&&name.startsWith('codex-worklogs'))return Response.json({},{status:403});
    if(options.method==='PUT'){
      const body=JSON.parse(options.body),old=files.get(name);
      if(old?.sha!==body.sha)return Response.json({message:'conflict'},{status:409});
      install(name,decodeBytes(body.content));return Response.json({content:{sha:files.get(name).sha}},{status:old?200:201});
    }
    const item=files.get(name);
    if(!item){const children=[...files.keys()].filter(p=>p.startsWith(name+'/')&&!p.slice(name.length+1).includes('/'));if(children.length)return Response.json(children.map(p=>({type:'file',name:p.slice(name.length+1),sha:files.get(p).sha})));return Response.json({},{status:404});}
    if(options.headers.Accept==='application/vnd.github.raw+json')return new Response(item.bytes);
    return Response.json({type:'file',sha:item.sha,encoding:'base64',content:encodeBytes(item.bytes)});
  };
  const make=(options={})=>new GithubWorkspace({owner:'example',repo:'private-data',token:'test-only-token',fetchImpl,...options});
  return {files,calls,install,make,fetchImpl,publicRepo:()=>{isPrivate=false;},offline:()=>{broken=true;},archiveFailure:()=>{archivesBroken=true;}};
}

test('GitHub mode rejects public data repositories and keeps working data behind authentication',async()=>{
  const fake=fakeGithub();fake.publicRepo();await assert.rejects(fake.make().connect(),/必须是私有仓库/);
  assert.equal(fake.calls.length,1);assert.equal(fake.calls[0].address,'https://api.github.com/repos/example/private-data');
  assert.throws(()=>new GithubWorkspace({owner:'example',repo:'../bad',token:'test-only-token'}));
});
test('GitHub saves preserve all data and reject stale writers and failed requests',async()=>{
  const fake=fakeGithub(),a=await fake.make().connect(),b=await fake.make().connect();
  const first=await a.state(),stale=await b.state();first.data.settings.theme='dark';
  const saved=await a.save(first.data,first.revision);assert.deepEqual(saved.data,first.data);
  await assert.rejects(b.save(stale.data,stale.revision),error=>error.status===409);
  assert.equal((await a.state()).data.settings.theme,'dark');
  const before=fake.files.get('workspace.json').sha;fake.offline();
  await assert.rejects(a.save(saved.data,saved.revision),/无法连接 GitHub/);assert.equal(fake.files.get('workspace.json').sha,before);
});

test('cloud appearance survives reopen and omitted settings without bypassing conflicts',async()=>{
  const fake=fakeGithub(),workspace=await fake.make().connect(),first=await workspace.state(),data=structuredClone(first.data);
  data.settings.design='gallery';data.settings.theme='light';const saved=await workspace.save(data,first.revision);
  const reopened=await fake.make().connect();assert.deepEqual((await reopened.state()).data.settings,saved.data.settings);
  const legacy=structuredClone(saved.data);delete legacy.settings.design;delete legacy.settings.theme;legacy.settings.name='名称变化';
  const retained=await workspace.save(legacy,saved.revision);assert.equal(retained.data.settings.design,'gallery');assert.equal(retained.data.settings.theme,'light');assert.deepEqual(retained.data.tasks,first.data.tasks);
  await assert.rejects(reopened.save(saved.data,saved.revision),error=>error.status===409);
  const restored=await fake.make().connect();assert.deepEqual((await restored.state()).data,retained.data);
});
test('private binary upload, integrity checks and full restore preserve original bytes',async()=>{
  const fake=fakeGithub(),workspace=await fake.make().connect(),bytes=new TextEncoder().encode('Chinese text 中文\r\n  preserve spaces  ');
  const meta=await workspace.upload(new File([bytes],'original.txt',{type:'text/plain'}));
  assert.deepEqual(await workspace.attachment(meta),bytes);
  const current=await workspace.state(),at=new Date().toISOString();
  current.data.notes.push({id:'uploaded-note',title:'Original',body:'',category:'其他',taskId:'',tags:[],pinned:false,attachment:meta,createdAt:at,updatedAt:at});
  await workspace.save(current.data,current.revision);const backup=await workspace.backup();assert.equal(backup.files.length,1);
  const target=fakeGithub(),other=await target.make().connect();await other.restore(backup,'replace',(await other.state()).revision);
  assert.deepEqual((await other.state()).data,(await workspace.state()).data);assert.deepEqual(await other.attachment(meta),bytes);
  const before=target.files.size,bad=structuredClone(backup);bad.files[0].size++;
  await assert.rejects(other.restore(bad,'replace',(await other.state()).revision),/大小或类型/);assert.equal(target.files.size,before);
  target.install(`files/${meta.id}.bin`,new Uint8Array([1]));await assert.rejects(other.attachment(meta),/校验失败/);
});
test('cloud summaries keep one document per day and stay outside the knowledge library',async()=>{
  const fake=fakeGithub(),workspace=await fake.make().connect(),before=await workspace.state();
  fake.install('codex-worklogs/2026-10-17.md','# 2026-10-17 工作摘要\n\n- 完成云端适配。');
  fake.install('codex-worklogs/我的个人档案.md','# 我的个人档案\n\n明确的偏好。');
  const result=await workspace.sync(before.revision);assert.equal(result.data.dailyArchives.length,1);assert.equal(result.data.archiveDocuments.length,1);assert.deepEqual(result.data.notes,before.data.notes);
  const twice=await workspace.sync(result.revision);assert.equal(twice.revision,result.revision);
  fake.install('codex-worklogs/2026-10-17.md','# 2026-10-17 工作摘要\n\n- 通过云端验证。');
  const updated=await workspace.sync(twice.revision);assert.equal(updated.data.dailyArchives.length,1);assert.match(updated.data.dailyArchives[0].body,/通过云端验证/);
});

test('automatic archives cross Shanghai midnight correctly without writing any workspace data',async()=>{
  const fake=fakeGithub(),workspace=await fake.make().connect(),before=await workspace.state();
  fake.install('codex-worklogs/2026-10-16.md','# 昨日\n\n- 已完成的工作。');
  fake.install('codex-worklogs/2026-10-17.md','# 当日\n\n- 当天合并记录。');
  fake.install('codex-worklogs/2026-10-18.md','# 明日\n\n- 不应提前显示。');
  fake.install('codex-worklogs/我的个人档案.md','# 我的个人档案\n\n- 稳定偏好。');
  const bytes=structuredClone(fake.files.get('workspace.json').bytes);
  const first=await workspace.readWithArchives({now:new Date('2026-10-17T15:59:59Z')});
  assert.deepEqual(first.data.dailyArchives.map(x=>x.date),['2026-10-16']);assert.equal(first.data.archiveDocuments.length,1);assert.equal(first.revision,before.revision);
  const after=await workspace.readWithArchives({now:new Date('2026-10-17T16:00:00Z')});
  assert.deepEqual(after.data.dailyArchives.map(x=>x.date),['2026-10-16','2026-10-17']);assert.equal(after.archiveSync.cutoff,'2026-10-18');
  assert.deepEqual(after.data.notes,before.data.notes);assert.deepEqual(after.data.records,before.data.records);assert.deepEqual(fake.files.get('workspace.json').bytes,bytes);assert.equal(fake.calls.filter(c=>c.method==='PUT').length,0);
});

test('automatic archives reuse unchanged source SHAs, read changed days, and keep good data when a source is invalid',async()=>{
  const fake=fakeGithub(),workspace=await fake.make().connect(),now=new Date('2026-10-18T02:00:00Z');
  fake.install('codex-worklogs/2026-10-17.md','# 重要工作\n\n- 第一版。');
  const first=await workspace.readWithArchives({now});
  const reads=()=>fake.calls.filter(c=>new URL(c.address).pathname.endsWith('/codex-worklogs/2026-10-17.md')).length;
  assert.equal(reads(),1);await workspace.readWithArchives({now});assert.equal(reads(),1);
  fake.install('codex-worklogs/2026-10-17.md','# 重要工作\n\n- 修订版。');
  const updated=await workspace.readWithArchives({now});assert.match(updated.data.dailyArchives[0].body,/修订版/);assert.equal(reads(),2);assert.equal(updated.data.dailyArchives.length,1);
  fake.install('codex-worklogs/2026-10-16.md','用户：不应导入的原始会话');
  const partial=await workspace.readWithArchives({now});assert.equal(partial.data.dailyArchives.length,1);assert.equal(partial.archiveSync.warnings.length,1);
  assert.equal(fake.calls.filter(c=>c.method==='PUT').length,0);assert.equal(first.revision,updated.revision);
});

test('automatic archive source failure does not block the workbench or erase persisted archives',async()=>{
  const initial=structuredClone(seedData);initial.dailyArchives=[{date:'2026-10-16',title:'已保存摘要',body:'已有重要工作。',createdAt:'2026-10-16T00:00:00Z',updatedAt:'2026-10-16T00:00:00Z'}];
  const fake=fakeGithub(initial),workspace=await fake.make().connect();fake.archiveFailure();
  const result=await workspace.readWithArchives({now:new Date('2026-10-18T02:00:00Z')});
  assert.deepEqual(result.data,initial);assert.equal(result.archiveSync.warnings.length,1);assert.equal(result.archiveSync.automatic,true);
});

test('immediate session reads reuse an independent snapshot but saves still recheck privacy and revisions',async()=>{
  const fake=fakeGithub(),workspace=fake.make(),first=await workspace.state();
  assert.equal(fake.calls.length,2);
  const reused=await workspace.state({reuse:true});reused.data.settings.name='unsaved mutation';
  assert.equal(fake.calls.length,2);assert.equal((await workspace.state({reuse:true})).data.settings.name,first.data.settings.name);
  fake.publicRepo();await assert.rejects(workspace.save(first.data,first.revision),/必须是私有/);
  assert.equal(fake.calls.filter(c=>c.method==='PUT').length,0);
});

test('ordinary saves use three requests independent of unchanged attachment count',async()=>{
  const initial=structuredClone(seedData),at='2026-10-17T00:00:00Z';
  for(let i=0;i<8;i++)initial.notes.push({id:'unchanged-note-'+i,title:'附件'+i,format:'text',body:'',category:'其他',tags:[],pinned:false,taskId:'',createdAt:at,updatedAt:at,attachment:{id:crypto.randomUUID(),name:'file'+i+'.txt',type:'text/plain',size:8}});
  const fake=fakeGithub(initial),workspace=fake.make(),first=await workspace.state();fake.calls.length=0;
  first.data.settings.theme='dark';const saved=await workspace.save(first.data,first.revision);
  assert.equal(fake.calls.length,3);assert.equal(fake.calls.filter(c=>c.address.includes('/files/')).length,0);
  assert.deepEqual(saved.data.notes,initial.notes);assert.equal(saved.data.settings.theme,'dark');
});

test('new attachment checks run with bounded parallelism and mismatches still prevent writes',async()=>{
  const fake=fakeGithub(),at='2026-10-17T00:00:00Z';let active=0,maximum=0;
  const workspace=fake.make({fetchImpl:async(url,options)=>{
    if(url.includes('/files/')){active++;maximum=Math.max(maximum,active);await new Promise(r=>setTimeout(r,10));active--;}
    return fake.fetchImpl(url,options);
  }}),first=await workspace.state();
  for(let i=0;i<9;i++){
    const meta={id:crypto.randomUUID(),name:'new'+i+'.txt',type:'text/plain',size:8};fake.install('files/'+meta.id+'.json',JSON.stringify(meta));
    first.data.notes.push({id:'new-note-'+i,title:'新附件'+i,format:'text',body:'',category:'其他',tags:[],pinned:false,taskId:'',createdAt:at,updatedAt:at,attachment:meta});
  }
  const saved=await workspace.save(first.data,first.revision);assert.equal(maximum,4);
  saved.data.notes.find(n=>n.attachment).attachment.name='wrong.txt';const before=fake.calls.filter(c=>c.method==='PUT').length;
  await assert.rejects(workspace.save(saved.data,saved.revision),/附件信息不一致/);
  assert.equal(fake.calls.filter(c=>c.method==='PUT').length,before);
});

test('one archive reader only requests its source while full archive loading is bounded and ordered',async()=>{
  const fake=fakeGithub();let active=0,maximum=0;
  for(let day=1;day<=10;day++){const date='2026-10-'+String(day).padStart(2,'0');fake.install('codex-worklogs/'+date+'.md','# '+date+'\n\n- 已核实结果。');}
  const workspace=fake.make({fetchImpl:async(url,options)=>{
    if(url.includes('/codex-worklogs/')){active++;maximum=Math.max(maximum,active);await new Promise(r=>setTimeout(r,10));active--;}
    return fake.fetchImpl(url,options);
  }});
  await workspace.state();fake.calls.length=0;
  const one=await workspace.readArchive({date:'2026-10-03'});assert.equal(fake.calls.length,1);assert.equal(one.data.dailyArchives.length,1);
  assert.ok(fake.calls[0].address.includes('/codex-worklogs/2026-10-03.md'));
  const full=await workspace.readWithArchives({now:new Date('2026-10-18T02:00:00Z')});assert.equal(full.data.dailyArchives.length,10);assert.equal(maximum,4);
  assert.deepEqual(full.data.dailyArchives.map(n=>n.date),Array.from({length:10},(_,i)=>'2026-10-'+String(i+1).padStart(2,'0')));
});

test('a remote change between read and PUT still loses no data with the optimized save path',async()=>{
  const fake=fakeGithub();let race=false;
  const workspace=fake.make({fetchImpl:async(url,options)=>{
    if(race&&options.method==='PUT'){race=false;fake.install('workspace.json',JSON.stringify({revision:'someone-else',data:{...seedData,settings:{...seedData.settings,name:'other device'}}}));}
    return fake.fetchImpl(url,options);
  }}),first=await workspace.state();race=true;first.data.settings.theme='dark';
  await assert.rejects(workspace.save(first.data,first.revision),e=>e.status===409);
  assert.equal((await workspace.state()).data.settings.name,'other device');
});

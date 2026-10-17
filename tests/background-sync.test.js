import test from 'node:test';
import assert from 'node:assert/strict';
import {BackgroundSync} from '../public/background-sync.js';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const initial=()=>({revision:'r0',data:{title:'old',status:'todo',settings:{theme:'light'}}});

test('local commits return immediately and batch the latest queued view with acknowledged revisions',async()=>{
  const first=deferred(),second=deferred(),writes=[];
  const queue=new BackgroundSync({delay:0,write:async(data,revision)=>{writes.push({data,revision});return writes.length===1?first.promise:second.promise;}});
  queue.initialize(initial());assert.equal(queue.enqueue({...initial().data,title:'one'}).queued,true);
  await wait(5);assert.equal(writes.length,1);assert.equal(writes[0].revision,'r0');
  queue.enqueue({...queue.state.data,status:'doing'});queue.enqueue({...queue.state.data,title:'three'});
  assert.equal(queue.pending,3);assert.equal(queue.state.data.title,'three');
  first.resolve({revision:'r1',data:writes[0].data});await wait(5);
  assert.equal(writes.length,2);assert.equal(writes[1].revision,'r1');assert.equal(writes[1].data.title,'three');assert.equal(writes[1].data.status,'doing');
  assert.equal(queue.pending,2);const flushed=queue.flush();second.resolve({revision:'r2',data:writes[1].data});await flushed;
  assert.equal(queue.pending,0);assert.equal(queue.state.revision,'r2');assert.equal(queue.state.data.title,'three');
});

test('network failures keep all local edits, pause writes, and retry the latest view without dropping later edits',async()=>{
  let fail=true,count=0,remote=initial();const seen=[];
  const queue=new BackgroundSync({delay:0,read:async()=>remote,write:async(data,revision)=>{seen.push(revision);count++;if(fail)throw Object.assign(Error('offline'),{status:503});return remote={revision:'r1',data};}});
  queue.initialize(remote);queue.enqueue({...remote.data,title:'draft'});await wait(5);
  assert.equal(queue.error.message,'offline');queue.enqueue({...queue.state.data,status:'done'});await wait(5);
  assert.equal(count,1);assert.equal(queue.pending,2);assert.equal(queue.draft().title,'draft');await assert.rejects(queue.flush(),/offline/);
  fail=false;await queue.retry();await queue.flush();assert.deepEqual(seen,['r0','r0']);assert.equal(remote.data.status,'done');assert.equal(queue.pending,0);
});

test('lost upload acknowledgement is reconciled without a duplicate write, including subsequent queued work',async()=>{
  let remote=initial(),count=0;
  const queue=new BackgroundSync({delay:0,read:async()=>remote,write:async data=>{remote={revision:'r'+(++count),data};if(count===1)throw Object.assign(Error('lost response'),{status:503});return remote;}});
  queue.initialize(remote);queue.enqueue({...remote.data,title:'first'});await wait(5);
  queue.enqueue({...queue.state.data,status:'done'});await queue.retry();await queue.flush();
  assert.equal(count,2);assert.equal(queue.pending,0);assert.equal(remote.data.title,'first');assert.equal(remote.data.status,'done');
  const single=new BackgroundSync({delay:0,read:async()=>remote,write:async data=>{remote={revision:'r3',data};count++;throw Error('lost');}});
  single.initialize(remote);single.enqueue({...remote.data,title:'only'});await wait(5);const before=count;await single.retry();assert.equal(single.pending,0);assert.equal(count,before);
});

test('a conflicting remote version never gets overwritten and drafts survive unsuccessful reloads',async()=>{
  let remote=initial(),failRead=false,writes=0;
  const queue=new BackgroundSync({delay:0,read:async()=>{if(failRead)throw Error('read failed');return remote;},write:async()=>{writes++;throw Object.assign(Error('conflict'),{status:409});}});
  queue.initialize(remote);queue.enqueue({...remote.data,title:'my draft'});await wait(5);
  remote={revision:'other',data:{...remote.data,title:'someone else'}};await queue.retry();
  assert.equal(queue.error.status,409);assert.equal(writes,1);assert.equal(queue.state.data.title,'my draft');assert.equal(remote.data.title,'someone else');
  failRead=true;await assert.rejects(queue.discardAndReload(),/read failed/);assert.equal(queue.pending,1);assert.equal(queue.state.data.title,'my draft');
  failRead=false;await queue.discardAndReload();assert.equal(queue.pending,0);assert.equal(queue.state.data.title,'someone else');
});

test('acknowledging a write cannot erase an explicit session pause or permit reload over pending work',async()=>{
  const response=deferred();let count=0;
  const queue=new BackgroundSync({delay:0,write:async()=>{count++;return response.promise;}});
  queue.initialize(initial());queue.enqueue({...initial().data,title:'one'});await wait(5);queue.enqueue({...queue.state.data,status:'two'});
  queue.pause();response.resolve({revision:'r1',data:{...initial().data,title:'one'}});await wait(5);
  assert.equal(count,1);assert.equal(queue.pending,1);assert.equal(queue.error.status,401);assert.throws(()=>queue.initialize(initial()),/待同步修改/);
});

test('a paused final upload that has actually completed leaves no unreachable pending error',async()=>{
  const response=deferred(),queue=new BackgroundSync({delay:0,write:async()=>response.promise});
  queue.initialize(initial());queue.enqueue({...initial().data,title:'last'});await wait(5);queue.pause();
  response.resolve({revision:'r1',data:{...initial().data,title:'last'}});await wait(5);
  assert.equal(queue.pending,0);assert.equal(queue.error,undefined);assert.equal((await queue.flush()).revision,'r1');
});

test('reconnection to a different repository cannot move pending data there even if its clone matches',async()=>{
  const base={...initial(),dataDir:'private/original'},remote={revision:'r1',data:{...base.data,title:'draft'},dataDir:'private/other'};let writes=0;
  const queue=new BackgroundSync({delay:0,read:async()=>remote,write:async()=>{writes++;throw Error('offline');}});
  queue.initialize(base);queue.enqueue(remote.data);await wait(5);await queue.retry();
  assert.equal(queue.pending,1);assert.equal(queue.error.status,409);assert.match(queue.error.message,/其他仓库/);assert.equal(writes,1);
  await queue.discardAndReload();assert.equal(queue.pending,0);assert.equal(queue.state.metadata.dataDir,'private/other');assert.equal(writes,1);
});

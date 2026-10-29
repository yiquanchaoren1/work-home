import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileWorkspace as merge} from '../public/workspace-merge.js';
const copy=value=>structuredClone(value);
const base=()=>({tasks:[{id:'a',title:'A',summary:'old',updatedAt:'2026-10-28T00:00:00Z'},{id:'b',title:'B',summary:'other'}],notes:[{id:'n',body:'old doc'}],settings:{theme:'light'},activity:[]});

test('independent entities, remote completion metadata and settings survive three-way merge',()=>{
  const b=base(),l=copy(b),r=copy(b);l.tasks[0].title='Local';l.tasks[0].updatedAt='2026-10-29T01:00:00Z';
  r.tasks[0].completedAt='2026-10-28T02:00:00Z';r.tasks[1].summary='Remote';r.notes[0].body='Remote doc';r.settings.theme='dark';
  const m=merge(b,l,r);assert.equal(m.tasks[0].title,'Local');assert.equal(m.tasks[0].completedAt,r.tasks[0].completedAt);assert.equal(m.tasks[1].summary,'Remote');assert.equal(m.notes[0].body,'Remote doc');assert.equal(m.settings.theme,'dark');assert.equal(b.tasks[0].title,'A');assert.equal(l.tasks[1].summary,'other');
});
test('independent fields use latest modification clock without choosing competing text',()=>{
  const b=base(),l=copy(b),r=copy(b);l.tasks[0].title='Local';r.tasks[0].summary='Remote';l.tasks[0].updatedAt='2026-10-29T09:00:00Z';r.tasks[0].updatedAt='2026-10-29T16:00:00+08:00';
  const m=merge(b,l,r);assert.equal(m.tasks[0].title,'Local');assert.equal(m.tasks[0].summary,'Remote');assert.equal(m.tasks[0].updatedAt,l.tasks[0].updatedAt);
  r.tasks[0].title='Different';assert.throws(()=>merge(b,l,r),{status:409});
});
test('new records on both sides are retained; duplicate IDs with different contents conflict',()=>{
  const b=base(),l=copy(b),r=copy(b);l.tasks.push({id:'new-local',title:'L'});r.tasks.unshift({id:'new-remote',title:'R'});assert.deepEqual(merge(b,l,r).tasks.map(t=>t.id),['new-remote','a','b','new-local']);
  r.tasks.push({id:'new-local',summary:'R'});assert.throws(()=>merge(b,l,r),{status:409});
});
test('delete unchanged records safely but refuse delete versus concurrent edit',()=>{
  const b=base(),l=copy(b),r=copy(b);l.tasks.shift();r.tasks[1].title='Changed B';assert.deepEqual(merge(b,l,r).tasks.map(t=>t.id),['b']);
  r.tasks[0].summary='Changed A';assert.throws(()=>merge(b,l,r),{status:409});assert.equal(l.tasks.length,1);
});
test('manual reordering coexists with content changes but competing reorders stop',()=>{
  const b=base();b.tasks.push({id:'c',title:'C'});const l=copy(b),r=copy(b);l.tasks.reverse();r.tasks[0].title='Remote';assert.deepEqual(merge(b,l,r).tasks.map(t=>t.id),['c','b','a']);
  r.tasks=[r.tasks[1],r.tasks[0],r.tasks[2]];assert.throws(()=>merge(b,l,r),{status:409});
});
test('tags, links and document bodies are atomic; no arbitrary paragraph or array winner',()=>{
  const b=base();b.tasks[0].tags=['base'];const l=copy(b),r=copy(b);l.tasks[0].tags.push('local');r.tasks[0].tags.push('remote');assert.throws(()=>merge(b,l,r),{status:409});
  delete l.tasks[0].tags;delete r.tasks[0].tags;l.notes[0].body='Local paragraph';r.notes[0].body='Remote paragraph';assert.throws(()=>merge(b,l,r),{status:409});
});
test('archive dates and personal IDs preserve independent additions with no mutation',()=>{
  const b=base();b.dailyArchives=[];b.personal={entries:[],journals:[]};const l=copy(b),r=copy(b);l.personal.entries.push({id:'l',body:'Local'});r.personal.entries.push({id:'r',body:'Remote'});l.dailyArchives.push({date:'2026-10-27',body:'L'});r.dailyArchives.push({date:'2026-10-28',body:'R'});
  const m=merge(b,l,r);assert.equal(m.personal.entries.length,2);assert.equal(m.dailyArchives.length,2);assert.equal(b.personal.entries.length,0);
});
test('competing completion timestamps and creation clocks never select a winner',()=>{
  for(const field of ['completedAt','createdAt']){const b=base(),l=copy(b),r=copy(b);l.tasks[0][field]='2026-10-28T01:00:00Z';r.tasks[0][field]='2026-10-28T02:00:00Z';assert.throws(()=>merge(b,l,r),{status:409});}
});

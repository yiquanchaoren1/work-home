import assert from 'node:assert/strict';
import test from 'node:test';
import {reorderTasks,replaceTask,visibleTasks} from './src/hub/model.ts';
const tasks=[{id:'a',title:'学习源码',status:'进行中',summary:'Host',tags:['框架']},{id:'hidden',title:'隐藏事项',status:'已完成',summary:'',tags:[]},{id:'b',title:'测试',status:'进行中',summary:'功能',tags:['QEMU']}];
test('filter and query intersect without changing source order',()=>{assert.deepEqual(visibleTasks(tasks,'进行中','qemu').map(t=>t.id),['b']);assert.equal(visibleTasks(tasks,'已完成','源码').length,0);assert.equal(tasks[0].id,'a')});
test('filtered reorder preserves hidden tasks and source objects',()=>{const result=reorderTasks(tasks,['a','b'],'b','a');assert.deepEqual(result.map(t=>t.id),['b','hidden','a']);assert.equal(result[0],tasks[2]);assert.equal(result[1],tasks[1]);assert.equal(tasks[0].id,'a')});
test('invalid drag destination is a no-op',()=>{assert.equal(reorderTasks(tasks,['a','b'],'b','missing'),tasks);assert.equal(reorderTasks(tasks,['a','b'],'a','a'),tasks)});
test('task update preserves opaque workspace and task fields',()=>{const data={tasks,notes:[{id:'note'}],personal:{entries:[{id:'profile'}]},settings:{theme:'dark'}};const result=replaceTask(data,{...tasks[0],title:'新标题',linkIds:['link']});assert.equal(result.personal,data.personal);assert.equal(result.notes,data.notes);assert.deepEqual(result.tasks[0].linkIds,['link']);assert.equal(tasks[0].title,'学习源码')});
test('new task appends once without replacing existing tasks',()=>{const data={tasks};const added=replaceTask(data,{...tasks[0],id:'new'});assert.equal(added.tasks.length,4);assert.equal(replaceTask(added,{...tasks[0],id:'new',title:'改名'}).tasks.length,4)});

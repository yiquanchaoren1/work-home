import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, validateBackup, saveData, loadData, mergeData } from '../public/store.js';

const stamp = '2026-10-15T09:00:00.000Z';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lD8AAAAASUVORK5CYII=';
const workspace = () => ({ version: 1, tasks: [], links: [], notes: [], records: [], activity: [], settings: { name: '文档测试' } });
const note = (id = 'document') => ({ id, title: '中文文档', category: '源码学习', body: `  \n# 中文\n\n![图](${png})\n\n  `, tags: ['文档'], pinned: false, taskId: '', createdAt: stamp, updatedAt: stamp });
const storage = () => {
  let raw = null;
  return { getItem(key) { assert.equal(key, STORAGE_KEY); return raw; }, setItem(key, value) { assert.equal(key, STORAGE_KEY); raw = value; } };
};

test('legacy notes retain their original schema without optional document fields', () => {
  const data = workspace();
  data.notes.push(note());
  const valid = validateBackup(data);
  assert.deepEqual(valid, data);
  assert.equal(Object.hasOwn(valid.notes[0], 'format'), false);
  assert.equal(Object.hasOwn(valid.notes[0], 'sourceName'), false);
  const memory = storage();
  saveData(valid, memory);
  assert.deepEqual(loadData(memory), data);
});

test('optional Markdown format and source filename survive save/load and JSON restore exactly', () => {
  const data = workspace();
  data.notes.push({ ...note(), format: 'markdown', sourceName: '中文 原稿.md' }, { ...note('plain'), format: 'text' });
  const memory = storage();
  const clean = saveData(data, memory);
  assert.deepEqual(clean, data);
  assert.deepEqual(loadData(memory), data);
  const backup = JSON.parse(JSON.stringify(loadData(memory)));
  const destination = storage();
  saveData(validateBackup(backup), destination);
  assert.deepEqual(loadData(destination), data);
  assert.ok(loadData(destination).notes[0].body.includes(png));
});

test('unsupported formats and non-string source names are rejected before storage changes', () => {
  const memory = storage();
  const original = workspace();
  original.notes.push(note('legacy'));
  saveData(original, memory);
  for (const bad of [{ format: 'html' }, { format: '' }, { format: null }, { format: true }, { sourceName: null }, { sourceName: 9 }]) {
    const data = workspace();
    data.notes.push({ ...note(), ...bad });
    assert.throws(() => saveData(data, memory), /format|sourceName/);
    assert.deepEqual(loadData(memory), original);
  }
});

test('merge preserves imported document metadata, image bytes and original existing conflicts', () => {
  const current = workspace();
  current.notes.push({ ...note('same'), body: '现有内容', format: 'text', sourceName: '旧稿.md' });
  const incoming = workspace();
  incoming.notes.push({ ...note('same'), format: 'markdown', sourceName: '替换稿.md' }, { ...note('new'), format: 'markdown', sourceName: '带图.md' }, note('legacy'));
  const result = mergeData(current, incoming);
  assert.deepEqual(result.notes[0], current.notes[0]);
  assert.deepEqual(result.notes[1], incoming.notes[1]);
  assert.deepEqual(result.notes[2], incoming.notes[2]);
  assert.deepEqual(mergeData(result, incoming), result);
  const memory = storage();
  saveData(result, memory);
  assert.deepEqual(loadData(memory), result);
});

test('file attachment metadata survives validation, save/load and merge without changing legacy notes', () => {
  const data = workspace();
  const attachment = { id: '4102c726-fcb2-4d76-a14b-337d4508161b', name: '中文 原文件.pdf', type: 'application/pdf', size: 1234 };
  data.notes.push({ ...note('attached'), format: 'text', sourceName: attachment.name, attachment });
  const memory = storage();
  assert.deepEqual(saveData(data, memory), data);
  assert.deepEqual(loadData(memory), data);
  const merged = mergeData(workspace(), JSON.parse(JSON.stringify(data)));
  assert.deepEqual(merged.notes[0].attachment, attachment);
  merged.notes[0].attachment.name = '修改后的元数据.pdf';
  assert.equal(data.notes[0].attachment.name, '中文 原文件.pdf');
});

test('invalid attachment identifiers, paths, MIME types and sizes are rejected before saving', () => {
  const valid = { id: '4102c726-fcb2-4d76-a14b-337d4508161b', name: '原文件.pdf', type: 'application/pdf', size: 1234 };
  const memory = storage();
  const existing = workspace();
  saveData(existing, memory);
  for (const attachment of [
    null, { ...valid, id: '../workspace.json' }, { ...valid, name: '../file.pdf' },
    { ...valid, name: 'folder\\file.pdf' }, { ...valid, name: 'bad\nname.pdf' },
    { ...valid, type: 'text/html; arbitrary' }, { ...valid, size: -1 },
    { ...valid, size: 1.5 }, { ...valid, size: 50 * 1024 * 1024 + 1 },
  ]) {
    const data = workspace(); data.notes.push({ ...note(), attachment });
    assert.throws(() => saveData(data, memory), /attachment/);
    assert.deepEqual(loadData(memory), existing);
  }
});

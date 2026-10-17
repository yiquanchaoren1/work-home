import test from 'node:test';
import assert from 'node:assert/strict';
import { seedData } from '../public/seed.js';
import { STORAGE_KEY, createId, normalizeUrl, loadData, saveData, parseLinks, validateBackup, mergeData } from '../public/store.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const now = '2026-10-15T08:00:00.000Z';
const empty = () => ({ version: 1, tasks: [], links: [], notes: [], records: [], activity: [], settings: { name: '测试工作台' } });
const task = (id, title = '真实事项') => ({ id, title, type: '开发', status: '进行中', summary: '', nextStep: '', tags: [], pinned: false, createdAt: now, updatedAt: now });
const link = (id, url, taskId = '') => ({ id, title: '链接', url, category: '未分类', description: '', taskId, tags: [], pinned: false, createdAt: now, updatedAt: now });
const note = (id, taskId = '') => ({ id, title: '笔记', category: '源码学习', body: '正文', taskId, tags: ['测试'], pinned: false, createdAt: now, updatedAt: now });
const record = (id, taskId = '') => ({ id, title: '功能验证', kind: 'QEMU 功能', result: '通过', environment: '测试环境', version: '版本', command: '命令', log: '日志', body: '详情', taskId, createdAt: now, updatedAt: now });
const memoryStorage = (initial = null) => {
  let raw = initial;
  return {
    getItem: (key) => { assert.equal(key, STORAGE_KEY); return raw; },
    setItem: (key, value) => { assert.equal(key, STORAGE_KEY); raw = value; },
    get value() { return raw; },
  };
};

test('reference seed is valid, archived, useful and independent on each empty load', () => {
  assert.equal(validateBackup(seedData).notes.length, 6);
  assert.ok(seedData.tasks.every((item) => item.status === '资料归档' && item.title.startsWith('参考主题')));
  assert.equal(seedData.links.length, 0);
  const storage = memoryStorage();
  const first = loadData(storage);
  first.notes[0].body = 'changed';
  first.tasks[0].tags.push('mutation');
  assert.notEqual(loadData(storage).notes[0].body, 'changed');
  assert.ok(!seedData.tasks[0].tags.includes('mutation'));
  assert.equal(storage.value, null);
});

test('save/load round trip persists all entity types and normalizes URLs', () => {
  const data = empty();
  data.tasks.push(task('t1'));
  data.links.push(link('l1', 'HTTPS://EXAMPLE.com:443/', 't1'));
  data.notes.push(note('n1', 't1'));
  data.records.push(record('r1', 't1'));
  data.activity.push({ id: 'a1', text: '导入完成', at: now });
  const storage = memoryStorage();
  const saved = saveData(data, storage);
  assert.equal(saved.links[0].url, 'https://example.com');
  assert.deepEqual(loadData(storage), saved);
  assert.equal(data.links[0].url, 'HTTPS://EXAMPLE.com:443/');
});

test('bad JSON and incompatible stored data are never silently reset', () => {
  for (const raw of ['', '{broken', '{"version":2}', '{"version":1}']) {
    const storage = memoryStorage(raw);
    assert.throws(() => loadData(storage), /未覆盖原数据/);
    assert.equal(storage.value, raw);
  }
});

test('storage permission and quota errors are actionable, without fake success', () => {
  assert.throws(() => loadData({ getItem() { throw new Error('denied'); } }), /读取工作台数据失败.*denied/);
  assert.throws(() => saveData(empty(), { setItem() { throw new Error('quota'); } }), /保存失败.*quota/);
  assert.throws(() => loadData({}), /读取工作台数据失败/);
  const storage = memoryStorage('original');
  assert.throws(() => saveData({ version: 2 }, storage), /版本/);
  assert.equal(storage.value, 'original');
});

test('storage helpers never implicitly access browser localStorage', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let reads = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { reads++; throw new Error('implicit browser storage access'); } });
  try {
    assert.throws(() => loadData());
    assert.throws(() => saveData(empty()));
    assert.equal(reads, 0, 'an explicit storage adapter is required; browser state must remain untouched');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('normalization preserves meaningful paths, query strings and fragments', () => {
  assert.equal(normalizeUrl(' HTTPS://EXAMPLE.COM:443/ '), 'https://example.com');
  assert.equal(normalizeUrl('http://example.com:80/?q=1#section'), 'http://example.com?q=1#section');
  assert.equal(normalizeUrl('https://example.com/path/'), 'https://example.com/path/');
  assert.notEqual(normalizeUrl('https://example.com/#one'), normalizeUrl('https://example.com/#two'));
  assert.notEqual(normalizeUrl('https://example.com/?q=1'), normalizeUrl('https://example.com/?q=2'));
});

test('unsafe and invalid URLs are rejected, including credentials and controls', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///private', 'ftp://host/path', '', 'not a URL', 'https://u:p@example.com/', 'https://exam\nple.com']) {
    assert.throws(() => normalizeUrl(url), /链接|地址/);
  }
});

test('text imports URL-only, title + URL, trailing title, and Markdown links', () => {
  const parsed = parseLinks('https://one.example/\n代码评审 https://two.example/review\nhttps://three.example/page | 需求说明\n[复杂路径](https://four.example/path_(v1)#part)\n- [资料](<https://five.example/doc>)\n');
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.links.length, 5);
  assert.equal(parsed.links[0].title, 'one.example');
  assert.equal(parsed.links[1].title, '代码评审');
  assert.equal(parsed.links[2].title, '需求说明');
  assert.equal(parsed.links[3].url, 'https://four.example/path_(v1)#part');
  assert.equal(parsed.links[4].url, 'https://five.example/doc');
});

test('text import reports line errors while keeping valid rows, without deduplication', () => {
  const parsed = parseLinks('\nhttps://example.com\njavascript:alert(1)\nhttps://example.com/\n不是链接');
  assert.equal(parsed.links.length, 2);
  assert.deepEqual(parsed.errors.map((item) => item.line), [3, 5]);
  assert.equal(parsed.links[0].url, parsed.links[1].url);
});

test('bookmarks HTML imports entities without running or keeping markup', () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p><DT><H3>研发</H3><DL>
<DT><A HREF="https://example.com/search?q=one&amp;page=2">研发 &amp; 资料</A>
<DT><a href='https://two.example/'><b>标题</b>&#x4e2d;&#25991;</a>
<DT><A HREF="javascript:alert(1)">危险</A>
</DL></DL>`;
  const result = parseLinks(html, 'html');
  assert.equal(result.links.length, 2);
  assert.equal(result.links[0].url, 'https://example.com/search?q=one&page=2');
  assert.equal(result.links[0].title, '研发 & 资料');
  assert.equal(result.links[1].title, '标题中文');
  assert.equal(result.errors[0].line, 5);
  assert.equal(parseLinks(html).links.length, 2);
  assert.equal(parseLinks('<html>empty</html>', 'html').errors.length, 1);
});

test('CSV supports BOM, quoted commas, multiline descriptions, escaped quotes, and Chinese headers', () => {
  const result = parseLinks('\ufefftitle,url,category,description\r\n"标题,一",https://one.example/,文档,"第一行\n第二行"\r\n标题二,https://two.example/path,评审,"他说""好"""', 'csv');
  assert.deepEqual(result.errors, []);
  assert.equal(result.links.length, 2);
  assert.equal(result.links[0].title, '标题,一');
  assert.equal(result.links[0].description, '第一行\n第二行');
  assert.equal(result.links[1].description, '他说"好"');
  const chinese = parseLinks('标题,网址,分类,备注\n测试,https://example.com,学习,备注', 'csv');
  assert.equal(chinese.links[0].category, '学习');
});

test('CSV rejects unsafe URLs, malformed quotes, wrong columns, and missing URL headers', () => {
  assert.equal(parseLinks('title,description\n标题,正文', 'csv').errors.length, 1);
  const result = parseLinks('title,url\n危险,javascript:alert(1)\n合法,https://good.example\n缺列\n"未闭合,https://broken.example', 'csv');
  assert.equal(result.links.length, 1);
  assert.deepEqual(result.errors.map((item) => item.line).sort(), [2, 4, 5]);
  const malformed = parseLinks('title,url\n"标题"junk,https://bad.example\n合法,https://good.example', 'csv');
  assert.equal(malformed.links.length, 1);
  assert.equal(malformed.errors[0].line, 2);
});

test('empty input is valid and unsupported formats report an error', () => {
  assert.deepEqual(parseLinks(''), { links: [], errors: [] });
  assert.deepEqual(parseLinks('', 'csv'), { links: [], errors: [] });
  assert.equal(parseLinks('abc', 'other').errors.length, 1);
  assert.equal(parseLinks(null).errors.length, 1);
});

test('backup validation requires complete typed schema, valid timestamps and unique IDs', () => {
  for (const mutate of [
    (data) => { delete data.records; },
    (data) => { data.version = 2; },
    (data) => { data.settings.name = ''; },
    (data) => { data.tasks[0].title = ' '; },
    (data) => { data.tasks[0].tags = 'not array'; },
    (data) => { data.tasks[0].tags = [12]; },
    (data) => { data.tasks[0].pinned = 'yes'; },
    (data) => { delete data.tasks[0].nextStep; },
    (data) => { data.tasks[0].createdAt = 'yesterday'; },
    (data) => { data.notes.push(note(data.tasks[0].id)); },
    (data) => { data.links.push(link('l1', 'javascript:alert(1)')); },
    (data) => { data.activity.push({ id: 'a1', text: '事件', at: '' }); },
  ]) {
    const data = empty();
    data.tasks.push(task('t1'));
    mutate(data);
    assert.throws(() => validateBackup(data));
  }
});

test('backup validation checks all task references and returns independent plain data', () => {
  const data = empty();
  data.tasks.push(task('t1'));
  data.links.push(link('l1', 'https://example.com', null));
  data.notes.push(note('n1', 't1'));
  data.records.push(record('r1', 't1'));
  data.notes[0].extra = '<script>not retained</script>';
  const validated = validateBackup(data);
  assert.equal(validated.links[0].taskId, '');
  assert.ok(!('extra' in validated.notes[0]));
  validated.notes[0].tags.push('new');
  assert.ok(!data.notes[0].tags.includes('new'));
  for (const key of ['links', 'notes', 'records']) {
    const invalid = clone(data);
    invalid[key][0].taskId = 'missing';
    assert.throws(() => validateBackup(invalid), /不存在的事项/);
  }
});

test('merge keeps existing content, imports new data, and deduplicates normalized URLs', () => {
  const current = empty();
  current.tasks.push(task('t1', '现有标题'));
  current.links.push(link('l1', 'https://EXAMPLE.com:443/', 't1'));
  current.notes.push(note('n1', 't1'));
  const incoming = empty();
  incoming.settings.name = '另一个工作台';
  incoming.tasks.push(task('t1', '不能覆盖'), task('t2', '新增事项'));
  incoming.links.push(link('l2', 'https://example.com/', 't2'), link('l3', 'https://example.com/#details', 't2'));
  incoming.notes.push({ ...note('n1', 't1'), body: '不能覆盖' }, note('n2', 't2'));
  incoming.records.push(record('r1', 't2'));
  incoming.activity.push({ id: 'a1', text: '新增记录', at: now });
  const snapshot = clone(current);
  const merged = mergeData(current, incoming);
  assert.equal(merged.tasks.length, 2);
  assert.equal(merged.tasks[0].title, '现有标题');
  assert.equal(merged.links.length, 2);
  assert.equal(merged.links[0].taskId, 't1');
  assert.equal(merged.notes[0].body, '正文');
  assert.equal(merged.notes[1].taskId, 't2');
  assert.equal(merged.records[0].taskId, 't2');
  assert.equal(merged.activity.length, 1);
  assert.equal(merged.settings.name, current.settings.name);
  assert.deepEqual(current, snapshot);
  assert.deepEqual(mergeData(merged, incoming), merged);
});

test('merge remaps cross-type ID collisions while preserving every imported task reference', () => {
  const current = empty();
  current.notes.push(note('collision'));
  current.tasks.push(task('current-task'));
  const incoming = empty();
  incoming.tasks.push(task('collision'));
  incoming.links.push(link('current-task', 'https://import.example', 'collision'));
  incoming.notes.push(note('import-note', 'collision'));
  incoming.records.push(record('import-record', 'collision'));
  const merged = mergeData(current, incoming);
  const importedTask = merged.tasks.find((item) => item.id !== 'current-task');
  assert.ok(importedTask);
  assert.notEqual(importedTask.id, 'collision');
  assert.notEqual(merged.links[0].id, 'current-task');
  assert.equal(merged.links[0].taskId, importedTask.id);
  assert.equal(merged.notes[1].taskId, importedTask.id);
  assert.equal(merged.records[0].taskId, importedTask.id);
  assert.doesNotThrow(() => validateBackup(merged));
  assert.deepEqual(mergeData(merged, incoming), merged);
});

test('merge rejects invalid incoming data before changing the current object', () => {
  const current = clone(seedData);
  const snapshot = clone(current);
  const incoming = empty();
  incoming.links.push(link('l1', 'https://example.com', 'missing'));
  assert.throws(() => mergeData(current, incoming), /不存在的事项/);
  assert.deepEqual(current, snapshot);
});

test('generated IDs are nonempty and distinct in a batch', () => {
  const ids = new Set(Array.from({ length: 200 }, createId));
  assert.equal(ids.size, 200);
  assert.ok([...ids].every((id) => typeof id === 'string' && id.length > 10));
});

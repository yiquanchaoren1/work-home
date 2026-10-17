import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { Readable } from 'node:stream';
import { randomUUID, createHash } from 'node:crypto';
import { createWorkHubServer, MAX_FILE_BYTES } from '../backend.mjs';
import { seedData } from '../public/seed.js';

const copy = value => JSON.parse(JSON.stringify(value));
const now = '2026-10-15T08:00:00.000Z';
const note = (id, body = '正文', extra = {}) => ({ id, title: `文档 ${id}`, category: '其他', body, taskId: '', tags: [], pinned: false, createdAt: now, updatedAt: now, ...extra });
const pdf = Buffer.from('%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF');
async function launch(dataDir) {
  const server = await createWorkHubServer({ dataDir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { server, origin, async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
async function fixture(t) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'work-hub-backend-'));
  let runtime = await launch(dataDir);
  const f = {
    dataDir,
    get server() { return runtime.server; }, get origin() { return runtime.origin; },
    async restart() { await runtime.close(); runtime = await launch(dataDir); },
    async request(route, method = 'GET', value, headers = {}) {
      const opts = { method, headers: { ...(method === 'GET' || method === 'HEAD' ? {} : { Origin: runtime.origin }), ...headers } };
      if (value !== undefined) { opts.body = JSON.stringify(value); opts.headers['Content-Type'] = 'application/json'; }
      return fetch(runtime.origin + route, opts);
    },
    async state() { const response = await f.request('/api/state'); assert.equal(response.status, 200, await response.clone().text()); return response.json(); },
    async upload(bytes, name = '测试.pdf') {
      const response = await fetch(runtime.origin + '/api/files', { method: 'POST', headers: { Origin: runtime.origin, 'X-File-Name': encodeURIComponent(name) }, body: bytes });
      assert.equal(response.status, 201, await response.clone().text()); return response.json();
    },
  };
  t.after(async () => {
    await runtime.close();
    assert.equal(path.dirname(path.resolve(dataDir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dataDir).startsWith('work-hub-backend-'));
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  return f;
}
async function rawRequest(origin, route, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(origin);
    const req = http.request({ hostname: '127.0.0.1', port: url.port, path: route, method: options.method || 'GET', headers: { Host: url.host, ...options.headers } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject); req.end(options.body);
  });
}

test('first GET persists seed; PUT writes authoritative JSON and readable document copies across restart', async t => {
  const f = await fixture(t), initial = await f.state();
  assert.deepEqual(initial.data, seedData);
  assert.equal(initial.dataDir, f.dataDir);
  const data = copy(initial.data); data.notes.push(note('new/md', '# 测试\n\n**内容**', { format: 'markdown' })); data.notes.push(note('new/text', '普通文本'));
  data.settings.name = '本地文件工作台';
  const response = await f.request('/api/state', 'PUT', { data, revision: initial.revision });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const saved = await response.json(); assert.notEqual(saved.revision, initial.revision);
  const disk = JSON.parse(await fs.readFile(path.join(f.dataDir, 'workspace.json'), 'utf8'));
  assert.deepEqual(disk.data, saved.data);
  const name = createHash('sha256').update('new/md').digest('hex') + '.md';
  assert.equal(await fs.readFile(path.join(f.dataDir, 'documents', name), 'utf8'), '# 测试\n\n**内容**');
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(f.dataDir, 'workspace.previous.json'), 'utf8')).data, initial.data);
  await f.restart(); const restarted = await f.state(); assert.equal(restarted.revision, saved.revision); assert.deepEqual(restarted.data, saved.data);
});

test('CAS allows exactly one concurrent writer and rejects invalid state without altering the file', async t => {
  const f = await fixture(t), initial = await f.state();
  const responses = await Promise.all(['A', 'B'].map(name => { const data = copy(initial.data); data.settings.name = name; return f.request('/api/state', 'PUT', { data, revision: initial.revision }); }));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const saved = await f.state();
  const invalid = copy(saved.data); invalid.notes[0].title = '';
  assert.equal((await f.request('/api/state', 'PUT', { data: invalid, revision: saved.revision })).status, 400);
  assert.deepEqual(await f.state(), saved);
});

test('file lock also protects revision checks across two server instances sharing the same directory', async t => {
  const f = await fixture(t), initial = await f.state(), other = await launch(f.dataDir);
  t.after(() => other.close());
  const a = copy(initial.data), b = copy(initial.data); a.settings.name = 'first'; b.settings.name = 'second';
  const results = await Promise.all([
    f.request('/api/state', 'PUT', { data: a, revision: initial.revision }),
    fetch(other.origin + '/api/state', { method: 'PUT', headers: { Origin: other.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: b, revision: initial.revision }) }),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
});

test('Host, mutation Origin, JSON MIME, filenames and traversal boundaries are enforced', async t => {
  const f = await fixture(t), initial = await f.state();
  for (const [asset, type] of [['/vendor/pdfjs/pdf.mjs', 'text/javascript; charset=utf-8'], ['/vendor/pdfjs/wasm/openjpeg.wasm', 'application/wasm'], ['/vendor/pdfjs/standard_fonts/LiberationSans-Regular.ttf', 'font/ttf']]) {
    const response = await f.request(asset, 'HEAD'); assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), type);
  }
  const alien = await rawRequest(f.origin, '/api/state', { headers: { Host: 'attacker.example' } });
  assert.equal(alien.status, 403); assert.equal(alien.headers['cache-control'], 'no-store');
  for (const origin of [undefined, 'null', 'https://evil.example', 'http://localhost:123']) {
    const response = await rawRequest(f.origin, '/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify({ data: initial.data, revision: initial.revision }) });
    assert.equal(response.status, 403);
  }
  assert.equal((await rawRequest(f.origin, '/api/state', { method: 'PUT', headers: { Origin: f.origin }, body: '{}' })).status, 415);
  assert.equal((await f.request('/api/files/..%2Fworkspace.json')).status, 400);
  assert.equal((await rawRequest(f.origin, '/%2e%2e%2fbackend.mjs')).status, 403);
  assert.equal((await f.request('/data/workspace.json')).status, 404);
  for (const filename of ['../escape.txt', 'C:\\escape.txt', 'bad\nname.txt']) {
    const response = await fetch(f.origin + '/api/files', { method: 'POST', headers: { Origin: f.origin, 'X-File-Name': encodeURIComponent(filename) }, body: 'no' });
    assert.equal(response.status, 400);
  }
  assert.deepEqual(await f.state(), initial);
});

test('binary attachments retain exact bytes, support PDF inline/HEAD/ranges and force other formats to download', async t => {
  const f = await fixture(t), meta = await f.upload(pdf);
  assert.equal(meta.type, 'application/pdf'); assert.equal(meta.size, pdf.length);
  let response = await f.request(`/api/files/${meta.id}`);
  assert.equal(response.status, 200); assert.match(response.headers.get('content-disposition'), /^inline;/); assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf);
  response = await f.request(`/api/files/${meta.id}`, 'HEAD'); assert.equal(response.headers.get('content-length'), String(pdf.length)); assert.equal(await response.text(), '');
  response = await f.request(`/api/files/${meta.id}`, 'GET', undefined, { Range: 'bytes=0-4' }); assert.equal(response.status, 206); assert.equal(await response.text(), '%PDF-'); assert.equal(response.headers.get('content-range'), `bytes 0-4/${pdf.length}`);
  response = await f.request(`/api/files/${meta.id}`, 'GET', undefined, { Range: 'bytes=-5' }); assert.equal(await response.text(), '%%EOF');
  assert.equal((await f.request(`/api/files/${meta.id}`, 'GET', undefined, { Range: 'bytes=999999-' })).status, 416);
  assert.match((await f.request(`/api/files/${meta.id}?download=1`, 'HEAD')).headers.get('content-disposition'), /^attachment;/);
  const html = await f.upload(Buffer.from('<script>alert(1)</script>'), 'fake.html');
  response = await f.request(`/api/files/${html.id}`); assert.match(response.headers.get('content-disposition'), /^attachment;/); assert.equal(response.headers.get('content-type'), 'application/octet-stream'); assert.match(response.headers.get('content-security-policy'), /sandbox/);
});

test('attachment endpoint enforces the real 50 MiB maximum for declared and chunked bodies', async t => {
  const f = await fixture(t);
  assert.equal(MAX_FILE_BYTES, 50 * 1024 * 1024);
  const declared = await rawRequest(f.origin, '/api/files', { method: 'POST', headers: { Origin: f.origin, 'X-File-Name': 'large.bin', 'Content-Length': String(MAX_FILE_BYTES + 1) } });
  assert.equal(declared.status, 413);
  const stream = Readable.from((async function* () { const chunk = Buffer.alloc(1024 * 1024, 1); for (let i = 0; i < 50; i++) yield chunk; yield Buffer.from([1]); })());
  const chunked = await fetch(f.origin + '/api/files', { method: 'POST', headers: { Origin: f.origin, 'X-File-Name': 'chunked.bin' }, body: stream, duplex: 'half' });
  assert.equal(chunked.status, 413);
  assert.deepEqual(await fs.readdir(path.join(f.dataDir, 'files')), []);
});

test('complete backup restores referenced files and notes in a fresh directory, including merge/replace and old JSON', async t => {
  const source = await fixture(t), target = await fixture(t), initial = await source.state();
  const meta = await source.upload(pdf); await source.upload(Buffer.from('orphan'), 'unused.txt');
  const data = copy(initial.data); data.notes.push(note('pdf-note', '', { attachment: meta }));
  assert.equal((await source.request('/api/state', 'PUT', { data, revision: initial.revision })).status, 200);
  const backupResponse = await source.request('/api/backup'), backup = await backupResponse.json();
  assert.match(backupResponse.headers.get('content-disposition'), /^attachment;/); assert.equal(backup.files.length, 1); assert.equal(backup.files[0].base64, pdf.toString('base64'));
  let current = await target.state();
  let response = await target.request('/api/restore', 'POST', { data: backup, files: backup.files, mode: 'merge', revision: current.revision });
  assert.equal(response.status, 200, await response.clone().text()); current = await response.json();
  assert.ok(current.data.notes.some(n => n.id === 'pdf-note')); assert.deepEqual(Buffer.from(await (await target.request(`/api/files/${meta.id}`)).arrayBuffer()), pdf);
  const replaced = copy(backup); replaced.settings.name = '替换恢复';
  response = await target.request('/api/restore', 'POST', { data: replaced, files: backup.files, mode: 'replace', revision: current.revision }); assert.equal(response.status, 200); current = await response.json(); assert.equal(current.data.settings.name, '替换恢复');
  const recoveryNames = (await fs.readdir(path.join(target.dataDir, 'backups'))).filter(name => name.startsWith('before-restore-'));
  assert.ok(recoveryNames.length >= 2);
  const recoveries = await Promise.all(recoveryNames.map(name => fs.readFile(path.join(target.dataDir, 'backups', name), 'utf8').then(JSON.parse)));
  const fullRecovery = recoveries.find(value => value.notes.some(n => n.id === 'pdf-note'));
  assert.equal(fullRecovery.version, 1); assert.equal(fullRecovery.files[0].base64, pdf.toString('base64'));
  const recoveryTarget = await fixture(t), fresh = await recoveryTarget.state();
  const recoverResponse = await recoveryTarget.request('/api/restore', 'POST', { data: fullRecovery, files: fullRecovery.files, mode: 'replace', revision: fresh.revision });
  assert.equal(recoverResponse.status, 200); assert.ok((await recoverResponse.json()).data.notes.some(n => n.id === 'pdf-note'));
  response = await target.request('/api/restore', 'POST', { data: seedData, mode: 'replace', revision: current.revision }); assert.equal(response.status, 200); assert.deepEqual((await response.json()).data, seedData);
});

test('invalid attachment restores leave state untouched and UUID collisions preserve old bytes', async t => {
  const f = await fixture(t), initial = await f.state(), meta = await f.upload(pdf);
  const data = copy(initial.data); data.notes.push(note('pdf', '', { attachment: meta }));
  const saved = await (await f.request('/api/state', 'PUT', { data, revision: initial.revision })).json();
  const bad = { ...meta, base64: 'not base64' };
  assert.equal((await f.request('/api/restore', 'POST', { data, files: [bad], mode: 'replace', revision: saved.revision })).status, 400);
  assert.deepEqual(await f.state(), saved);
  const missingData = copy(data); missingData.notes.at(-1).attachment.id = randomUUID();
  assert.equal((await f.request('/api/restore', 'POST', { data: missingData, mode: 'replace', revision: saved.revision })).status, 400);
  const different = Buffer.from(pdf.toString().replace('/Catalog', '/Pages  '));
  const response = await f.request('/api/restore', 'POST', { data, files: [{ ...meta, base64: different.toString('base64') }], mode: 'replace', revision: saved.revision });
  assert.equal(response.status, 200, await response.clone().text());
  const after = await response.json(), newId = after.data.notes.find(n => n.id === 'pdf').attachment.id;
  assert.notEqual(newId, meta.id); assert.deepEqual(Buffer.from(await (await f.request(`/api/files/${meta.id}`)).arrayBuffer()), pdf); assert.deepEqual(Buffer.from(await (await f.request(`/api/files/${newId}`)).arrayBuffer()), different);
  await fs.unlink(path.join(f.dataDir, 'files', `${meta.id}.json`));
  const restored = await f.request('/api/restore', 'POST', { data, files: [{ ...meta, base64: pdf.toString('base64') }], mode: 'replace', revision: after.revision });
  assert.equal(restored.status, 200, await restored.clone().text());
  const repairedId = (await restored.json()).data.notes.find(n => n.id === 'pdf').attachment.id;
  assert.notEqual(repairedId, meta.id); assert.deepEqual(await fs.readFile(path.join(f.dataDir, 'files', `${meta.id}.bin`)), pdf);
  assert.deepEqual(Buffer.from(await (await f.request(`/api/files/${repairedId}`)).arrayBuffer()), pdf);
});

test('initial migration respects deleted seed entries and name; later conflicting bodies are preserved idempotently', async t => {
  const f = await fixture(t); await f.state();
  const legacy = copy(seedData); legacy.notes = [note('legacy', '浏览器原正文')]; legacy.tasks = []; legacy.settings.name = '旧浏览器工作台';
  let response = await f.request('/api/migrate', 'POST', { data: legacy }); assert.equal(response.status, 200); let migrated = await response.json(); assert.deepEqual(migrated.data, legacy);
  response = await f.request('/api/migrate', 'POST', { data: legacy }); assert.equal((await response.json()).revision, migrated.revision);
  const changed = copy(migrated.data); changed.notes[0].body = '本地新正文';
  response = await f.request('/api/state', 'PUT', { data: changed, revision: migrated.revision }); assert.equal(response.status, 200);
  response = await f.request('/api/migrate', 'POST', { data: legacy }); migrated = await response.json(); assert.equal(migrated.data.notes.length, 2); assert.ok(migrated.data.notes.some(n => n.body === '本地新正文')); assert.ok(migrated.data.notes.some(n => n.body === '浏览器原正文'));
  response = await f.request('/api/migrate', 'POST', { data: legacy }); assert.deepEqual((await response.json()).data, migrated.data);
  const raw = (await fs.readdir(path.join(f.dataDir, 'backups'))).filter(name => name.startsWith('migration-original-')); assert.equal(raw.length, 1); assert.deepEqual(JSON.parse(await fs.readFile(path.join(f.dataDir, 'backups', raw[0]), 'utf8')), legacy);
});

test('corrupt primary restores previous with an explicit warning and preserves the corrupt source', async t => {
  const f = await fixture(t), initial = await f.state();
  const data = copy(initial.data); data.settings.name = '新的名称';
  assert.equal((await f.request('/api/state', 'PUT', { data, revision: initial.revision })).status, 200);
  await fs.writeFile(path.join(f.dataDir, 'workspace.json'), '{corrupt'); await f.restart();
  const recovered = await f.state(); assert.deepEqual(recovered.data, initial.data); assert.match(recovered.warning, /已恢复上一版本/);
  const backup = (await fs.readdir(path.join(f.dataDir, 'backups'))).find(name => name.startsWith('recovery-corrupt-'));
  assert.equal(await fs.readFile(path.join(f.dataDir, 'backups', backup), 'utf8'), '{corrupt');
  await fs.writeFile(path.join(f.dataDir, 'workspace.json'), '{bad-current'); await fs.writeFile(path.join(f.dataDir, 'workspace.previous.json'), '{bad-previous');
  assert.equal((await f.request('/api/state')).status, 500); assert.equal(await fs.readFile(path.join(f.dataDir, 'workspace.json'), 'utf8'), '{bad-current');
});

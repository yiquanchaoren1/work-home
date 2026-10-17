import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { STORAGE_KEY, validateBackup } from '../public/store.js';

// Never use WORK_HUB_URL, port 4317 or the user's data directory. Every run owns
// a temporary directory, child server and isolated browser profiles.
const project = fileURLToPath(new URL('..', import.meta.url));
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'work-hub-local-files-e2e-'));
const dataDir = path.join(temporary, 'data');
const servers = new Set();
let server, base, browser, context, page, passed = 0;
const pageErrors = [];
const stamp = '2026-10-15T10:00:00.000Z';
const legacyNote = { id: 'legacy-document', title: '迁移文档', category: '源码学习', body: '# 来自浏览器\n\n保留正文。\n', format: 'markdown', sourceName: '旧稿.md', tags: ['迁移'], taskId: '', pinned: false, createdAt: stamp, updatedAt: stamp };
const legacy = { version: 1, tasks: [], links: [], notes: [legacyNote], records: [], activity: [], settings: { name: '磁盘工作台' } };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lD8AAAAASUVORK5CYII=', 'base64');
const markdown = '  \n# 本机 Markdown\n\n| 项目 | 结果 |\n| --- | --- |\n| 磁盘 | 已保存 |\n\n<script>window.__unsafeDocument = true</script>\n\n  ';
const textBytes = Buffer.from('中文原始文本\r\n  保留空白  \r\n', 'utf8');
function pdfBytes() {
  const paint = 'q\n0.9 0.1 0.1 rg\n10 10 180 80 re f\nQ\n';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Contents 4 0 R >>', `<< /Length ${Buffer.byteLength(paint)} >>\nstream\n${paint}endstream`];
  let value = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(value)); value += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(value);
  value += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(value);
}
const pdf = pdfBytes();
const file = (name, buffer, mimeType) => ({ name, buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer), mimeType });
async function startServer(directory, port = 0) {
  const processHandle = spawn(process.execPath, ['server.mjs'], { cwd: project, env: { ...process.env, WORK_HUB_DATA_DIR: directory, PORT: String(port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  servers.add(processHandle);
  let output = '';
  const address = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Temporary server did not start: ${output}`)), 15000);
    const consume = chunk => { output += chunk.toString(); const match = /Work Hub: http:\/\/localhost:(\d+)/.exec(output); if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); } };
    processHandle.stdout.on('data', consume); processHandle.stderr.on('data', chunk => { output += chunk.toString(); });
    processHandle.once('error', error => { clearTimeout(timeout); reject(error); });
    processHandle.once('exit', code => { clearTimeout(timeout); reject(new Error(`Temporary server exited ${code}: ${output}`)); });
  });
  assert.notEqual(new URL(address).port, '4317');
  return { process: processHandle, base: address };
}
async function stopServer(handle) {
  if (handle.exitCode !== null || handle.signalCode !== null) { servers.delete(handle); return; }
  const exited = once(handle, 'exit'); handle.kill(); await exited; servers.delete(handle);
}
async function json(address = base) { const response = await fetch(`${address}/api/state`); assert.equal(response.status, 200); return response.json(); }
async function check(name, operation) { await operation(); passed++; console.log(`PASS ${name}`); }
const modal = target => target.locator('#modal');
const field = (name, target = page) => modal(target).locator(`[name="${name}"]`);
const action = (name, target = page) => target.locator(`[data-action="${name}"]`);
async function ready(target = page) { await target.waitForFunction(() => document.querySelector('#workspace-name')?.textContent === '磁盘工作台'); }
async function navigate(hash, target = page) { await target.evaluate(value => { location.hash = value; }, hash); await target.locator('#content h1').waitFor(); }
async function save(target = page) { await modal(target).locator('button[type="submit"]').click(); await modal(target).waitFor({ state: 'hidden' }); }
async function close(target = page, discard = false) { if (discard) target.once('dialog', dialog => dialog.accept()); await action('close', modal(target)).last().click(); await modal(target).waitFor({ state: 'hidden' }); }
async function edit(id, target = page) { await target.goto(`${base}/#notes/edit/${encodeURIComponent(id)}`, { waitUntil: 'networkidle' }); await modal(target).waitFor({ state: 'visible' }); await field('body', target).waitFor(); }
async function download(target, trigger) { const pending = target.waitForEvent('download'); await trigger(); const item = await pending; return { name: item.suggestedFilename(), bytes: await fs.readFile(await item.path()) }; }
async function openNote(id, target = page, owner = context) {
  await navigate('notes', target);
  const anchor = target.locator(`a.note-card[href$="/document.html?id=${encodeURIComponent(id)}"]`);
  assert.equal(await anchor.getAttribute('target'), '_blank');
  const pending = owner.waitForEvent('page'); await anchor.click(); const reader = await pending;
  await reader.locator('.reader-title').waitFor(); return reader;
}

try {
  server = await startServer(dataDir); base = server.base;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  context.on('page', current => current.on('pageerror', error => pageErrors.push(error.message)));
  page = await context.newPage(); page.setDefaultTimeout(10000);
  await page.goto(base, { waitUntil: 'networkidle' });

  await check('failed migration preserves the old browser key; retry durably migrates then removes it', async () => {
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: STORAGE_KEY, data: legacy });
    await page.route('**/api/migrate', route => route.abort('failed'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('旧数据迁移提示', { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY), legacy);
    await page.unroute('**/api/migrate');
    await action('retry-connect').click(); await ready();
    await page.waitForFunction(key => localStorage.getItem(key) === null, STORAGE_KEY);
    const stored = await json();
    assert.equal(path.resolve(stored.dataDir), path.resolve(dataDir));
    assert.deepEqual(stored.data, legacy, 'migration must not resurrect deleted seed content or reset the name');
    const disk = JSON.parse(await fs.readFile(path.join(dataDir, 'workspace.json'), 'utf8'));
    assert.deepEqual(disk.data, legacy);
  });

  await check('a fresh browser profile reads disk data; clearing browser storage does not erase it', async () => {
    const other = await browser.newContext(); const fresh = await other.newPage();
    await fresh.goto(`${base}/#notes`, { waitUntil: 'networkidle' }); await ready(fresh);
    assert.equal(await fresh.locator('a.note-card').count(), 1);
    assert.equal(await fresh.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
    await fresh.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await fresh.reload({ waitUntil: 'networkidle' }); await ready(fresh);
    assert.match(await fresh.locator('a.note-card').textContent(), /迁移文档/);
    await other.close();
  });

  let taskId, linkId, recordId;
  await check('task, link and verification CRUD persists through the real API', async () => {
    await navigate('tasks'); await page.locator('[data-action="new"][data-collection="tasks"]').click();
    await field('title').fill('磁盘研发事项'); await field('summary').fill('核对磁盘持久化'); await field('nextStep').fill('记录验证结果'); await save();
    taskId = (await json()).data.tasks.find(item => item.title === '磁盘研发事项').id;
    await page.getByRole('link', { name: '磁盘研发事项', exact: true }).click();
    await page.locator('[data-action="new"][data-collection="links"]').click();
    await field('title').fill('研发资料'); await field('url').fill('https://example.com/review'); await save();
    linkId = (await json()).data.links.find(item => item.title === '研发资料').id;
    await page.locator('[data-action="new"][data-collection="records"]').click();
    await field('title').fill('本机验证'); await field('body').fill('当前快照功能验证'); await field('result').selectOption('通过'); await save();
    recordId = (await json()).data.records.find(item => item.title === '本机验证').id;
    await page.locator('[data-action="edit"][data-collection="tasks"]').click();
    await field('summary').fill('修改也已落盘'); await save();
    await page.locator('[data-action="edit"][data-collection="links"]').click(); await field('description').fill('修改后的用途'); await save();
    await page.locator(`[data-action="view"][data-collection="records"][data-id="${recordId}"]`).click();
    await action('edit', modal(page)).click(); await field('body').fill('修改后的证据'); await save();
    const current = (await json()).data;
    assert.equal(current.tasks.find(item => item.id === taskId).summary, '修改也已落盘');
    assert.equal(current.links.find(item => item.id === linkId).description, '修改后的用途');
    assert.equal(current.records.find(item => item.id === recordId).body, '修改后的证据');
    assert.equal(current.links.find(item => item.id === linkId).taskId, taskId);
  });

  await check('task handles reorder by pointer and keyboard, and keep disk order after reload', async () => {
    await navigate('tasks');
    await page.locator('[data-action="new"][data-collection="tasks"]').click();
    await field('title').fill('第二个排序事项'); await save();
    const cards=page.locator('#sortable-tasks [data-task-id]');
    assert.equal(await cards.count(),2);
    const secondId=(await json()).data.tasks[0].id;
    assert.deepEqual((await json()).data.tasks.map(task=>task.id),[secondId,taskId]);
    const handle=page.locator(`[data-task-drag="${secondId}"]`);
    const start=await handle.boundingBox(),end=await cards.nth(1).boundingBox();
    await page.mouse.move(start.x+start.width/2,start.y+start.height/2);
    await page.mouse.down();
    await page.mouse.move(end.x+end.width/2,end.y+end.height/2,{steps:8});
    await page.mouse.up();
    await page.waitForFunction(id=>document.querySelector('#sortable-tasks [data-task-id]')?.dataset.taskId!==id,secondId);
    await page.waitForFunction(async id=>(await (await fetch('/api/state')).json()).data.tasks[0].id!==id,secondId);
    assert.deepEqual((await json()).data.tasks.map(task=>task.id),[taskId,secondId]);
    await page.reload({waitUntil:'networkidle'}); await ready();
    assert.deepEqual(await cards.evaluateAll(nodes=>nodes.map(node=>node.dataset.taskId)),[taskId,secondId]);
    await page.locator(`[data-task-drag="${secondId}"]`).focus();
    await page.keyboard.press('ArrowUp');
    await page.waitForFunction(id=>document.querySelector('#sortable-tasks [data-task-id]')?.dataset.taskId===id,secondId);
    await page.waitForFunction(async id=>(await (await fetch('/api/state')).json()).data.tasks[0].id===id,secondId);
    assert.deepEqual((await json()).data.tasks.map(task=>task.id),[secondId,taskId]);
  });

  let imported;
  await check('MD, PDF, TXT and PNG uploads open in new tabs and preserve original download bytes', async () => {
    await navigate('notes'); await action('upload-documents').click();
    await page.locator('#document-files').setInputFiles([file('原稿.md', markdown, 'text/markdown'), file('说明.pdf', pdf, 'application/pdf'), file('原文.txt', textBytes, 'text/plain'), file('示意图.png', png, 'image/png')]);
    await page.waitForFunction(() => !document.querySelector('[data-action="confirm-documents"]').disabled);
    await field('document-task').selectOption(taskId);
    await action('confirm-documents', modal(page)).click(); await modal(page).waitFor({ state: 'hidden' });
    imported = (await json()).data.notes.filter(note => note.id !== legacyNote.id);
    assert.equal(imported.length, 4);
    for (const [name, expected, selector] of [['原稿.md', Buffer.from(markdown), '.markdown-body table'], ['说明.pdf', pdf, '.pdf-canvas[data-rendered="true"]'], ['原文.txt', textBytes, '.reader-text'], ['示意图.png', png, '.reader-image']]) {
      const note = imported.find(item => item.sourceName === name); assert.ok(note); assert.equal(note.taskId, taskId);
      const reader = await openNote(note.id);
      await reader.locator(selector).waitFor();
      if (name.endsWith('.md')) { assert.equal(note.attachment, undefined); assert.equal(await reader.evaluate(() => window.__unsafeDocument), undefined); }
      if (name.endsWith('.txt')) assert.equal(await reader.locator('.reader-text').textContent(), textBytes.toString());
      if (name.endsWith('.png')) await reader.waitForFunction(() => document.querySelector('.reader-image').naturalWidth === 1);
      if (name.endsWith('.pdf')) {
        assert.equal(await reader.locator('.pdf-canvas').getAttribute('data-page'), '1');
        assert.equal(await reader.getByRole('spinbutton', { name: '页码', exact: true }).inputValue(), '1');
        const painted = await reader.locator('.pdf-canvas').evaluate(canvas => {
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          let red = 0; for (let index = 0; index < pixels.length; index += 4) if (pixels[index] > 150 && pixels[index + 1] < 100 && pixels[index + 2] < 100 && pixels[index + 3] > 0) red++;
          return red;
        });
        assert.ok(painted > 100, 'PDF.js must paint the actual red rectangle, not merely expose a download button');
      }
      const result = await download(reader, () => reader.locator('#document-download').click());
      assert.deepEqual(result.bytes, expected, `${name} download bytes`);
      if (note.attachment) { assert.equal(result.name, name); const bytes = await fs.readFile(path.join(dataDir, 'files', `${note.attachment.id}.bin`)); assert.deepEqual(bytes, expected); }
      await reader.close();
    }
  });

  const editedBody = '  \n# 编辑后的本机文档\n\n保留首尾空格。  \n\n  ';
  let markdownId;
  await check('new-tab edit route saves exact Markdown text and downloads the updated source', async () => {
    markdownId = imported.find(item => item.sourceName === '原稿.md').id;
    const reader = await openNote(markdownId);
    await reader.locator('#document-edit').click();
    await modal(reader).waitFor({ state: 'visible' });
    await field('body', reader).fill(editedBody); await field('body', reader).press('Control+s');
    await modal(reader).waitFor({ state: 'hidden' });
    assert.equal((await json()).data.notes.find(item => item.id === markdownId).body, editedBody);
    const mirrors = await Promise.all((await fs.readdir(path.join(dataDir, 'documents'))).map(name => fs.readFile(path.join(dataDir, 'documents', name), 'utf8')));
    assert.ok(mirrors.includes(editedBody), 'editable Markdown should also exist as a local document file');
    await reader.close();
    await page.reload({ waitUntil: 'networkidle' }); await ready();
    const updated = await openNote(markdownId);
    assert.equal(await updated.locator('.markdown-body h1').textContent(), '编辑后的本机文档');
    assert.deepEqual((await download(updated, () => updated.locator('#document-download').click())).bytes, Buffer.from(editedBody));
    await updated.close();
  });

  await check('two-tab stale save returns conflict and preserves both committed data and the unsaved draft', async () => {
    const other = await context.newPage(); await edit(markdownId, page); await edit(markdownId, other);
    await field('body', page).fill('# A页已保存\n'); await save(page);
    await field('body', other).fill('# B页未保存草稿\n');
    const response = other.waitForResponse(result => result.url() === `${base}/api/state` && result.request().method() === 'PUT');
    await modal(other).locator('button[type="submit"]').click(); assert.equal((await response).status(), 409);
    await other.waitForFunction(() => document.querySelector('#form-error').textContent.includes('其他页面'));
    assert.equal(await modal(other).isVisible(), true); assert.equal(await field('body', other).inputValue(), '# B页未保存草稿\n');
    assert.equal((await json()).data.notes.find(item => item.id === markdownId).body, '# A页已保存\n');
    assert.equal(await other.locator('.toast:not(.error)').filter({ hasText: '已保存' }).count(), 0);
    await close(other, true); await other.close();
  });

  await check('failed disk save keeps the editor, original disk state and draft without a success message', async () => {
    await edit(markdownId); const before = await json();
    await page.waitForFunction(() => ![...document.querySelectorAll('.toast:not(.error)')].some(element => element.textContent.includes('已保存')));
    await field('body').fill('# 保存失败时的草稿\n');
    await page.route('**/api/state', route => route.request().method() === 'PUT' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'E2E模拟磁盘写入失败' }) }) : route.continue());
    await modal(page).locator('button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector('#form-error').textContent.includes('模拟磁盘写入失败'));
    assert.equal(await modal(page).isVisible(), true); assert.equal(await field('body').inputValue(), '# 保存失败时的草稿\n');
    assert.deepEqual(await json(), before);
    assert.equal(await page.locator('.toast:not(.error)').filter({ hasText: '已保存' }).count(), 0);
    await page.unroute('**/api/state'); await save();
    assert.equal((await json()).data.notes.find(item => item.id === markdownId).body, '# 保存失败时的草稿\n');
  });

  await check('browser reset and actual server process restart preserve disk data and attachments', async () => {
    const before = (await json()).data;
    await context.close(); context = null;
    const port = Number(new URL(base).port); await stopServer(server.process);
    server = await startServer(dataDir, port); assert.equal(server.base, base);
    assert.deepEqual((await json()).data, before);
    context = await browser.newContext({ acceptDownloads: true }); page = await context.newPage();
    await page.goto(`${base}/#notes`, { waitUntil: 'networkidle' }); await ready();
    assert.equal(await page.evaluate(() => localStorage.length), 0);
    assert.equal(await page.locator('a.note-card').count(), before.notes.length);
    const picture = imported.find(note => note.sourceName === '示意图.png');
    assert.deepEqual(Buffer.from(await (await fetch(`${base}/api/files/${picture.attachment.id}`)).arrayBuffer()), png);
  });

  await check('complete backup restores documents and attachment bytes into a different empty disk directory', async () => {
    await navigate('settings'); const backup = await download(page, () => action('export').click());
    const parsed = JSON.parse(backup.bytes.toString()); const expected = (await json()).data;
    assert.deepEqual(validateBackup(parsed), expected); assert.equal(parsed.files.length, 3);
    const restoredServer = await startServer(path.join(temporary, 'restore-data'));
    const restoredContext = await browser.newContext({ acceptDownloads: true }); const target = await restoredContext.newPage();
    await target.goto(`${restoredServer.base}/#settings`, { waitUntil: 'networkidle' });
    await target.locator('#backup-file').setInputFiles(file('完整备份.json', backup.bytes, 'application/json'));
    await action('replace-backup', target).click(); await action('confirm-replace', modal(target)).click();
    await modal(target).waitFor({ state: 'hidden' });
    assert.deepEqual((await json(restoredServer.base)).data, expected);
    for (const note of imported.filter(item => item.attachment)) {
      const response = await fetch(`${restoredServer.base}/api/files/${note.attachment.id}`); assert.equal(response.status, 200);
      const expectedBytes = note.sourceName.endsWith('.pdf') ? pdf : note.sourceName.endsWith('.txt') ? textBytes : png;
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), expectedBytes);
    }
    await restoredContext.close(); await stopServer(restoredServer.process);
  });

  await check('deleting a task retains its related documents and unlinking/deleting other records works', async () => {
    await navigate(`detail/${taskId}`);
    await page.locator('[data-action="delete"][data-collection="tasks"]').click(); await action('confirm-delete', modal(page)).click(); await modal(page).waitFor({ state: 'hidden' });
    let current = (await json()).data;
    assert.equal(current.tasks.some(item => item.id === taskId), false);
    assert.ok(current.notes.every(item => !item.taskId));
    assert.equal(current.links.find(item => item.id === linkId).taskId, '');
    assert.equal(current.records.find(item => item.id === recordId).taskId, '');
    await navigate('links'); await page.locator(`[data-action="edit"][data-id="${linkId}"]`).click(); await action('delete', modal(page)).click(); await action('confirm-delete', modal(page)).click(); await modal(page).waitFor({ state: 'hidden' });
    await navigate('records'); await page.locator(`[data-action="view"][data-id="${recordId}"]`).click(); await action('edit', modal(page)).click(); await action('delete', modal(page)).click(); await action('confirm-delete', modal(page)).click(); await modal(page).waitFor({ state: 'hidden' });
    current = (await json()).data; assert.equal(current.links.length, 0); assert.equal(current.records.length, 0); assert.equal(current.notes.length, 5);
  });

  assert.deepEqual(pageErrors, [], `Unexpected browser errors: ${pageErrors.join('; ')}`);
  console.log(`Local files E2E complete: ${passed} checks passed; all services and data were isolated under ${temporary}.`);
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  for (const handle of servers) await stopServer(handle);
  // Only the directory created by mkdtemp above is eligible for cleanup.
  if (path.dirname(temporary) !== path.resolve(os.tmpdir()) || !path.basename(temporary).startsWith('work-hub-local-files-e2e-')) throw new Error('Unsafe temporary cleanup target');
  await fs.rm(temporary, { recursive: true, force: true });
}

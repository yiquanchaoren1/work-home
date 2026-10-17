import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { renderMarkdown, markdownExcerpt, documentTitle, embedLocalImages } from '../public/markdown.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://workspace.test/' });
globalThis.window = dom.window;
after(() => { dom.window.close(); delete globalThis.window; });
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const image = (name, path = name, dataUrl = png) => ({ name, path, dataUrl });
const fragment = source => JSDOM.fragment(renderMarkdown(source));

test('GFM renders semantic headings, formatting, lists, tables, quotes, tasks and code', () => {
  const source = '# 一级\n\n## 二级\n\n**粗体** *斜体* ~~删除~~ `inline()`\n\n> 引用\n\n1. 顺序\n2. 列表\n\n- [x] 完成\n- [ ] 待办\n\n| 名称 | 值 |\n| :--- | ---: |\n| 算子 | 42 |\n\n```cpp\nint value = 1 < 2;\n```';
  const result = fragment(source);
  assert.equal(result.querySelector('h1').textContent, '一级');
  assert.equal(result.querySelector('h2').textContent, '二级');
  for (const tag of ['strong', 'em', 'del', 'blockquote', 'ol', 'ul', 'table', 'pre']) assert.ok(result.querySelector(tag), tag);
  assert.equal(result.querySelectorAll('input[type="checkbox"][disabled]').length, 2);
  assert.equal(result.querySelectorAll('input[checked]').length, 1);
  assert.equal(result.querySelector('pre code').textContent.trim(), 'int value = 1 < 2;');
  assert.equal(result.querySelector('pre code').className, 'language-cpp');
});

test('raw block and inline HTML appear as literal text without executing or creating elements', () => {
  const raw = '<script>window.pwned = true</script>\n\n<img src=x onerror="window.pwned=true">\n\ninline <strong onclick="bad()">HTML</strong>\n\n<iframe src="https://evil.test"></iframe>';
  const result = fragment(raw);
  assert.equal(result.querySelectorAll('script,img,strong,iframe').length, 0);
  assert.match(result.textContent, /<script>window\.pwned/);
  assert.match(result.textContent, /<img src=x/);
  assert.match(result.textContent, /<strong onclick=/);
  assert.equal(dom.window.pwned, undefined);
});

test('script protocols, encoded protocols and local links never create actionable anchors', () => {
  const source = '[bad](javascript:alert(1))\n\n[encoded](java&#x73;cript:alert(1))\n\n[data](data:text/html,evil)\n\n[local](/api/delete)\n\n[file](file:///C:/private.txt)\n\n[network](//evil.test/path)';
  const result = fragment(source);
  assert.equal(result.querySelectorAll('a[href]').length, 0);
  assert.ok(result.querySelectorAll('.md-disabled-link').length >= 5);
});

test('external links are normalized and always have noopener noreferrer and a new tab target', () => {
  const result = fragment('[资料](HTTPS://EXAMPLE.COM:443/path?q=1&lang=zh "文档")');
  const link = result.querySelector('a');
  assert.equal(link.getAttribute('href'), 'https://example.com/path?q=1&lang=zh');
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(link.title, '文档');
});

test('only explicit http/https or supported base64 raster images create image elements', () => {
  const source = `![远端](https://images.example.com/a.png)\n\n![内嵌](${png})\n\n![jpeg](data:image/jpeg;base64,/9j/AA==)\n\n![webp](data:image/webp;base64,UklGRg==)\n\n![gif](${gif})`;
  const result = fragment(source);
  assert.equal(result.querySelectorAll('img').length, 5);
  assert.equal(result.querySelector('img').getAttribute('referrerpolicy'), 'no-referrer');
  assert.ok([...result.querySelectorAll('img')].every(item => item.getAttribute('loading') === 'lazy'));
});

test('relative, root, Windows and unsupported image URLs render placeholders with no resource request source', () => {
  const source = '![relative](assets/x.png)\n\n![root](/api/private)\n\n![windows](C:\\Users\\x.png)\n\n![file](file:///C:/x.png)\n\n![svg](data:image/svg+xml;base64,PHN2Zy8+)\n\n![script](javascript:alert(1))\n\n![network](//example.com/x.png)';
  const result = fragment(source);
  assert.equal(result.querySelectorAll('img,[src]').length, 0);
  assert.equal(result.querySelectorAll('.md-image-placeholder').length, 7);
  assert.match(result.textContent, /需导入图片/);
});

test('image alt text and titles cannot inject attributes or active markup', () => {
  const result = fragment('![<img src=x onerror=bad()>](https://safe.test/a.png "&quot; onerror=bad()")');
  const pictures = result.querySelectorAll('img');
  assert.equal(pictures.length, 1);
  assert.equal(pictures[0].hasAttribute('onerror'), false);
  assert.match(pictures[0].alt, /<img/);
  assert.match(pictures[0].title, /onerror/);
});

test('malicious HTML, SVG, MathML and clobbering payloads remain text', () => {
  const payloads = [
    '<svg><g onload=alert(1)></g></svg>',
    '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=1 onerror=alert(1)>">',
    '<form id=location><input name=href></form>',
    '<style>@import "https://evil.test/x";</style>',
    '<a href="javascript:alert(1)" target="_self">click</a>',
  ];
  for (const payload of payloads) {
    const result = fragment(payload);
    assert.equal(result.querySelectorAll('svg,math,form,input,style,a,img,[onload],[onerror]').length, 0);
    assert.ok(result.textContent.includes('<'));
  }
});

test('mermaid and math remain text/code without invoking renderers or scripts', () => {
  const result = fragment('```mermaid\ngraph LR; A-->B\n```\n\n$$x^2$$');
  assert.equal(result.querySelector('code').className, 'language-mermaid');
  assert.match(result.textContent, /\$\$x\^2\$\$/);
  assert.equal(result.querySelectorAll('script,svg,iframe').length, 0);
});

test('front matter is preserved on import but excluded from rendering and excerpts', () => {
  const source = '---\ntypora-root-url: "C:/docs"\nother: <script>bad()</script>\n---\n# 正文\n\n内容';
  assert.equal(documentTitle(source, 'fallback.md'), '正文');
  assert.equal(markdownExcerpt(source), '正文 内容');
  assert.doesNotMatch(renderMarkdown(source), /typora-root-url|other:|script/);
  assert.equal(embedLocalImages(source, []).body, source);
});

test('document title uses a semantic H1, including Setext, then the file basename', () => {
  assert.equal(documentTitle('```md\n# 示例\n```\n\n# 真正的 **标题** &amp; 内容', 'fallback.md'), '真正的 标题 & 内容');
  assert.equal(documentTitle('Setext 标题\n==========\n', 'fallback.md'), 'Setext 标题');
  assert.equal(documentTitle('## 只有二级', 'C:\\docs\\学习.MARKDOWN'), '学习');
  assert.equal(documentTitle('', 'folder/my.note.md'), 'my.note');
  assert.equal(documentTitle('', ''), '未命名笔记');
});

test('excerpt strips Markdown structure, keeps readable content and limits Unicode length', () => {
  assert.equal(markdownExcerpt('# **标题**\n\n[资料](https://example.com) ![图示](x.png) `code`'), '标题 资料 图示 code');
  assert.equal(markdownExcerpt('abcdef', 4), 'abc…');
  assert.equal(markdownExcerpt('😀😀😀😀', 3), '😀😀…');
  assert.equal(markdownExcerpt('abcdef', 0), '');
  assert.equal(markdownExcerpt(null), '');
  assert.ok(!markdownExcerpt(`![图片](${png})`).includes('base64'));
});

test('local images embed data in the Markdown body while HTTP images remain unchanged', () => {
  const source = '# 文档\n\n![流程](./assets/flow.png "流程图")\n\n![远端](https://images.test/online.png)';
  const result = embedLocalImages(source, [image('flow.png', 'assets/flow.png')]);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.embedded, ['./assets/flow.png']);
  assert.ok(result.body.includes(`![流程](${png} "流程图")`));
  assert.ok(result.body.includes('![远端](https://images.test/online.png)'));
  assert.equal(fragment(result.body).querySelectorAll('img').length, 2);
});

test('URL-encoded paths, Typora %u escapes, Unicode, Windows separators and file URLs resolve', () => {
  const cases = [
    ['![图](images/流程%20图.png)', image('流程 图.png', 'images/流程 图.png')],
    ['![图](images/%E6%B5%81%E7%A8%8B.png)', image('流程.png', 'images/流程.png')],
    ['![图](images/%u6D41%u7A0B.png)', image('流程.png', 'images/流程.png')],
    ['![图](.\\images\\flow.png)', image('flow.png', 'images/flow.png')],
    ['![图](C:\\docs\\assets\\flow.png)', image('flow.png', 'assets/flow.png')],
    ['![图](file:///C:/docs/assets/flow.png)', image('flow.png', 'assets/flow.png')],
    ['![图](images/name%231.png)', image('name#1.png', 'images/name#1.png')],
    ['![图](images/name%2520.png)', image('name%20.png', 'images/name%20.png')],
  ];
  for (const [source, file] of cases) {
    const result = embedLocalImages(source, [file]);
    assert.equal(result.embedded.length, 1, source);
    assert.deepEqual(result.missing, [], source);
    assert.ok(result.body.includes(png));
  }
});

test('Typora root metadata resolves root-relative paths against the selected folder', () => {
  const source = '---\ntypora-root-url: C:/website\n---\n# 说明\n\n![图](/blog/img/flow.png)';
  const result = embedLocalImages(source, [image('flow.png', 'C:/website/blog/img/flow.png'), image('flow.png', 'other/flow.png', gif)]);
  assert.deepEqual(result.missing, []);
  assert.equal(result.embedded.length, 1);
  assert.ok(result.body.startsWith('---\ntypora-root-url: C:/website\n---\n'));
  assert.ok(result.body.includes(png));
});

test('missing files and ambiguous same-name files remain intact and are listed once', () => {
  const source = '![第一](flow.png)\n\n![第二](flow.png)\n\n![缺图](missing.jpg)';
  const result = embedLocalImages(source, [image('flow.png', 'a/flow.png'), image('flow.png', 'b/flow.png', gif)]);
  assert.equal(result.body, source);
  assert.deepEqual(result.missing, ['flow.png', 'missing.jpg']);
  assert.deepEqual(result.embedded, []);
  assert.equal(fragment(result.body).querySelectorAll('.md-image-placeholder').length, 3);
});

test('a specific image path wins over duplicate basenames', () => {
  const result = embedLocalImages('![图](a/flow.png)', [image('flow.png', 'folder/a/flow.png'), image('flow.png', 'folder/b/flow.png', gif)]);
  assert.ok(result.body.includes(png));
  assert.ok(!result.body.includes(gif));
});

test('ordinary links, fenced code, inline code, indented code and escaped examples are unchanged', () => {
  const syntax = '![图](images/a.png)';
  const prefix = `[普通链接](images/a.png)\n\n\`示例 ${syntax}\`\n\n\`\`\`markdown\n${syntax}\n\`\`\`\n\n    ${syntax}\n\n\\${syntax}\n\n`;
  const result = embedLocalImages(prefix + syntax, [image('a.png', 'images/a.png')]);
  assert.ok(result.body.startsWith(prefix));
  assert.equal(result.body.split(png).length - 1, 1);
  assert.deepEqual(result.embedded, ['images/a.png']);
});

test('image examples inside HTML blocks remain raw text and are not embedded', () => {
  const source = '<div>\n![图](a.png)\n</div>\n\n![图](a.png)';
  const result = embedLocalImages(source, [image('a.png')]);
  assert.ok(result.body.startsWith('<div>\n![图](a.png)\n</div>'));
  assert.equal(result.body.split(png).length - 1, 1);
});

test('images nested in lists, quotes, tables and links embed without destroying surrounding Markdown', () => {
  const source = '- **![图](a.png)**\n\n> ![图](a.png)\n>\n> 后续\n\n| 图 | 名称 |\n| --- | --- |\n| ![图](a.png) | 表格 |\n\n[![图](a.png)](https://example.com)';
  const result = embedLocalImages(source, [image('a.png')]);
  assert.equal(result.body.split(png).length - 1, 4);
  const output = fragment(result.body);
  assert.equal(output.querySelectorAll('img').length, 4);
  assert.ok(output.querySelector('ul strong img'));
  assert.ok(output.querySelector('blockquote img'));
  assert.ok(output.querySelector('table img'));
  assert.ok(output.querySelector('a img'));
});

test('reference-style images can embed while shared link references and definitions are preserved', () => {
  const source = '![图][asset]\n\n[普通链接][asset]\n\n[asset]: assets/a.png "标题"\n';
  const result = embedLocalImages(source, [image('a.png', 'assets/a.png')]);
  assert.ok(result.body.startsWith(`![图](${png} "标题")`));
  assert.ok(result.body.includes('[普通链接][asset]'));
  assert.ok(result.body.includes('[asset]: assets/a.png "标题"'));
});

test('unsupported data types cannot be embedded and repeated embedding is idempotent', () => {
  const unsafe = embedLocalImages('![图](a.svg)', [image('a.svg', 'a.svg', 'data:image/svg+xml;base64,PHN2Zy8+')]);
  assert.deepEqual(unsafe.embedded, []);
  assert.deepEqual(unsafe.missing, ['a.svg']);
  const first = embedLocalImages('![图](a.png)', [image('a.png')]);
  const second = embedLocalImages(first.body, [image('a.png')]);
  assert.equal(second.body, first.body);
  assert.deepEqual(second.embedded, []);
  assert.deepEqual(second.missing, []);
});

test('embedded bytes survive a plain JSON backup round trip with no asset storage', () => {
  const embedded = embedLocalImages('![图](a.png)', [image('a.png')]);
  const restored = JSON.parse(JSON.stringify({ body: embedded.body }));
  const result = fragment(restored.body);
  assert.equal(result.querySelector('img').getAttribute('src'), png);
});

test('offline vendor files match pinned package bytes and include licenses', async () => {
  for (const [vendor, packageFile] of [
    ['marked.esm.js', 'marked/lib/marked.esm.js'],
    ['purify.esm.js', 'dompurify/dist/purify.es.mjs'],
  ]) {
    const [actual, expected] = await Promise.all([
      readFile(new URL(`../public/vendor/${vendor}`, import.meta.url)),
      readFile(new URL(`../node_modules/${packageFile}`, import.meta.url)),
    ]);
    assert.deepEqual(actual, expected);
  }
  for (const filename of ['marked.LICENSE', 'dompurify.LICENSE', 'dompurify.LICENSE-MPL']) assert.ok((await readFile(new URL(`../public/vendor/${filename}`, import.meta.url), 'utf8')).length > 100);
});

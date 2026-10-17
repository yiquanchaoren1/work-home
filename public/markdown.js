import { Marked } from './vendor/marked.esm.js';
import createDOMPurify from './vendor/purify.esm.js';

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const rasterData = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z\d+/]+={0,2}$/i;

function inputText(source) {
  return typeof source === 'string' ? source.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n') : '';
}

function documentParts(source) {
  const text = inputText(source);
  const match = /^---[ \t]*\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/.exec(text);
  if (!match) return { prefix: '', content: text, root: '' };
  // Front matter is metadata, never executable configuration. Read only Typora's image root.
  const root = /^typora-root-url\s*:\s*(.*?)\s*$/m.exec(match[1])?.[1] || '';
  return { prefix: match[0], content: text.slice(match[0].length), root: root.replace(/^(['"])([\s\S]*)\1$/, '$2') };
}

function httpUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007f]/.test(value)) return '';
  try {
    const url = new URL(value);
    return url.username || url.password ? '' : url.href;
  } catch { return ''; }
}

function imageUrl(value) {
  return rasterData.test(value || '') ? value : httpUrl(value);
}

function plainInline(tokens = []) {
  return tokens.map(token => {
    if (token.type === 'br') return ' ';
    if (token.type === 'checkbox') return token.checked ? '[x] ' : '[ ] ';
    if (token.tokens) return plainInline(token.tokens);
    return token.text || '';
  }).join('');
}

const engine = new Marked({
  gfm: true,
  breaks: false,
  async: false,
  renderer: {
    html(token) {
      const literal = escapeHtml(token.text);
      return token.block ? `<pre class="md-raw-html">${literal}</pre>\n` : literal;
    },
    link(token) {
      const label = this.parser.parseInline(token.tokens);
      const href = httpUrl(token.href);
      if (!href) return `<span class="md-disabled-link" title="仅支持 http / https 外部链接">${label}</span>`;
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"${token.title ? ` title="${escapeHtml(token.title)}"` : ''}>${label}</a>`;
    },
    image(token) {
      const src = imageUrl(token.href);
      const alt = plainInline(token.tokens) || token.text || '';
      if (!src) {
        const label = (alt || token.href || '未命名图片').slice(0, 160);
        return `<span class="md-image-placeholder" role="img" aria-label="需导入图片" title="${escapeHtml(token.href)}">需导入图片：${escapeHtml(label)}</span>`;
      }
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"${token.title ? ` title="${escapeHtml(token.title)}"` : ''}>`;
    },
  },
});

let purifier, purifierWindow;
function getPurifier() {
  const browserWindow = globalThis.window;
  if (!browserWindow?.document) throw new Error('Markdown 预览需要浏览器 DOM 环境');
  if (!purifier || purifierWindow !== browserWindow) {
    purifierWindow = browserWindow;
    purifier = createDOMPurify(browserWindow);
    purifier.addHook('uponSanitizeAttribute', (node, attribute) => {
      if (attribute.attrName === 'src' && (node.tagName !== 'IMG' || !imageUrl(attribute.attrValue))) attribute.keepAttr = false;
      if (attribute.attrName === 'href' && !httpUrl(attribute.attrValue)) attribute.keepAttr = false;
    });
  }
  return purifier;
}

/** Render GFM to a sanitized HTML string. Raw HTML remains readable text. */
export function renderMarkdown(source) {
  const html = engine.parse(documentParts(source).content);
  return getPurifier().sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'span', 'img', 'pre', 'code', 'ul', 'ol', 'li', 'blockquote', 'strong', 'em', 'del', 'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'class', 'type', 'checked', 'disabled', 'start', 'align', 'loading', 'decoding', 'referrerpolicy', 'role', 'aria-label'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_TRUSTED_TYPE: false,
  });
}

function tokenText(token) {
  if (token.type === 'def') return '';
  if (token.type === 'list') return token.items.map(item => item.tokens.map(tokenText).join(' ')).join(' ');
  if (token.type === 'table') return [token.header, ...token.rows].map(row => row.map(cell => plainInline(cell.tokens)).join(' ')).join(' ');
  if (token.type === 'blockquote') return token.tokens.map(tokenText).join(' ');
  if (token.tokens) return plainInline(token.tokens);
  return token.text || '';
}

function decodeText(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()];
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\ufffd';
  });
}

/** Plain text for cards/search; no DOM or external resource loading is needed. */
export function markdownExcerpt(source, maxLength = 105) {
  const limit = Number.isFinite(maxLength) ? Math.max(0, Math.floor(maxLength)) : 105;
  const text = decodeText(engine.lexer(documentParts(source).content).map(tokenText).join(' ')).replace(/\s+/g, ' ').trim();
  const characters = Array.from(text);
  return characters.length > limit ? characters.slice(0, Math.max(0, limit - 1)).join('') + (limit ? '…' : '') : text;
}

/** Prefer the first semantic H1, excluding code examples and front matter. */
export function documentTitle(source, filename = '') {
  let title = '';
  engine.walkTokens(engine.lexer(documentParts(source).content), token => {
    if (!title && token.type === 'heading' && token.depth === 1) title = decodeText(plainInline(token.tokens)).trim();
  });
  const basename = String(filename).replace(/\\/g, '/').split('/').pop().replace(/\.(?:md|markdown|mdown)$/i, '').trim();
  return title || basename || '未命名笔记';
}

function decodePath(value) {
  // Older Typora versions can emit %uXXXX in addition to regular percent encoding.
  const unicode = value.replace(/%u([\da-f]{4})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
  try { return decodeURIComponent(unicode); } catch { return unicode; }
}

function normalizePath(value, fromUrl = false) {
  const raw = String(value);
  const decoded = fromUrl ? decodePath(raw.split(/[?#]/, 1)[0]) : raw;
  const path = decoded.replace(/\\/g, '/').replace(/^file:\/\/(?:localhost)?\/?/i, '');
  const segments = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..' && segments.length && segments.at(-1) !== '..') segments.pop();
    else segments.push(part);
  }
  return segments.join('/').toLocaleLowerCase('en-US');
}

function localDestination(href) {
  if (/^[a-z]:[\\/]/i.test(href) || /^file:\/\//i.test(href)) return true;
  return !/^(?:\/\/|[a-z][a-z\d+.-]*:)/i.test(href);
}

function resolveImage(href, root, images) {
  const target = normalizePath(href, true);
  const targets = [target];
  if (root && /^[\\/]/.test(href) && !/^\/\//.test(href)) targets.unshift(normalizePath(`${root}/${target}`));
  const basename = target.split('/').pop();
  const ranked = images.filter(image => rasterData.test(image?.dataUrl || '')).map(image => {
    const path = normalizePath(image.path || image.name || '');
    const name = normalizePath(image.name || '').split('/').pop();
    let score = 0;
    for (const candidate of targets) {
      const count = Math.min(path.split('/').length, candidate.split('/').length);
      if (path && path === candidate) score = Math.max(score, 1000 + count);
      else if (path.includes('/') && candidate.includes('/') && (path.endsWith(`/${candidate}`) || candidate.endsWith(`/${path}`))) score = Math.max(score, 500 + count);
    }
    if (!score && basename && name === basename) score = 100;
    return { image, score };
  }).filter(item => item.score).sort((a, b) => b.score - a.score);
  // Two files with the same best match are ambiguous: don't silently pick the wrong image.
  return ranked.length && (!ranked[1] || ranked[0].score > ranked[1].score) ? ranked[0].image : null;
}

function markdownImage(token, dataUrl) {
  const alt = (plainInline(token.tokens) || token.text || '').replace(/([\\\[\]])/g, '\\$1').replace(/\n/g, ' ');
  const title = token.title ? ` "${token.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"` : '';
  return `![${alt}](${dataUrl}${title})`;
}

/**
 * Embed only real Markdown image tokens, preserving ordinary links and code.
 * A second Marked lexing pass identifies candidate occurrences in their actual
 * context; identical ![](...) examples inside code/escaped text remain untouched.
 * The result stores all image bytes in Markdown, so existing JSON backups suffice.
 */
export function embedLocalImages(source, images = [], onEmbed) {
  const parts = documentParts(source);
  const definitions = new Map();
  engine.walkTokens(engine.lexer(parts.content), token => {
    if (token.type === 'image' && !imageUrl(token.href)) definitions.set(token.raw, token);
  });
  if (!definitions.size) return { body: parts.prefix + parts.content, missing: [], embedded: [] };

  const occurrences = [];
  for (const [raw, token] of definitions) {
    if (!raw) continue;
    let start = parts.content.indexOf(raw);
    while (start >= 0) {
      occurrences.push({ start, end: start + raw.length, token });
      start = parts.content.indexOf(raw, start + raw.length);
    }
  }
  occurrences.sort((a, b) => a.start - b.start || b.end - a.end);
  const candidates = [];
  for (const occurrence of occurrences) {
    if (!candidates.length || occurrence.start >= candidates.at(-1).end) candidates.push(occurrence);
  }
  const marker = `workhub-image-probe-${Math.random().toString(36).slice(2)}-`;
  let probe = '', cursor = 0;
  candidates.forEach((item, index) => {
    probe += parts.content.slice(cursor, item.start) + `![${marker}${index}](https://workhub.invalid/${marker}${index})`;
    cursor = item.end;
  });
  probe += parts.content.slice(cursor);
  const active = new Set();
  engine.walkTokens(engine.lexer(probe), token => {
    if (token.type === 'image' && token.text.startsWith(marker) && token.href === `https://workhub.invalid/${token.text}`) {
      const index = Number(token.text.slice(marker.length));
      if (Number.isInteger(index)) active.add(index);
    }
  });

  let body = '', previous = 0;
  const missing = new Set(), embedded = new Set();
  candidates.forEach((item, index) => {
    body += parts.content.slice(previous, item.start);
    let replacement = parts.content.slice(item.start, item.end);
    if (active.has(index)) {
      const image = localDestination(item.token.href) ? resolveImage(item.token.href, parts.root, Array.isArray(images) ? images : []) : null;
      if (image) {
        replacement = markdownImage(item.token, image.dataUrl);
        embedded.add(item.token.href);
        if (typeof onEmbed === 'function') onEmbed(image, item.token.href);
      } else missing.add(item.token.href);
    }
    body += replacement;
    previous = item.end;
  });
  body += parts.content.slice(previous);
  return { body: parts.prefix + body, missing: [...missing], embedded: [...embedded] };
}

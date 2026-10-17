const localAsset = path => new URL(`./vendor/pdfjs/${path}`, import.meta.url).href;
const zoomSteps = [.25, .5, .75, 1, 1.25, 1.5, 2, 3, 4];

/** Mount a local PDF canvas reader. Call the returned function before removing its host. */
export function mountPdf(host, { url, title = 'PDF 文档' }) {
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const events = new AbortController();
  const listen = (node, event, callback) => node.addEventListener(event, callback, { signal: events.signal });
  const button = (label, text = label) => {
    const node = make('button', 'pdf-button', text);
    node.type = 'button'; node.title = label; node.setAttribute('aria-label', label);
    return node;
  };
  const shell = make('section', 'pdf-viewer');
  shell.setAttribute('aria-label', `${title} PDF 阅读器`);
  const toolbar = make('div', 'pdf-toolbar');
  toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', 'PDF 阅读操作');
  const pages = make('div', 'pdf-control-group');
  const previous = button('上一页', '‹'), next = button('下一页', '›');
  const pageInput = make('input', 'pdf-page-input');
  pageInput.type = 'number'; pageInput.min = '1'; pageInput.value = '1'; pageInput.inputMode = 'numeric';
  pageInput.setAttribute('aria-label', '页码');
  const count = make('span', 'pdf-page-count', '/ — 页');
  pages.append(previous, pageInput, count, next);
  const zoomGroup = make('div', 'pdf-control-group pdf-zoom-group');
  const smaller = button('缩小', '−'), larger = button('放大', '+');
  const zoomSelect = make('select', 'pdf-zoom-select'); zoomSelect.setAttribute('aria-label', '缩放比例');
  for (const [value, label] of [['fit', '适合宽度'], ...zoomSteps.map(step => [String(step), `${step * 100}%`])]) {
    const option = make('option', '', label); option.value = value; zoomSelect.append(option);
  }
  zoomGroup.append(smaller, zoomSelect, larger); toolbar.append(pages, zoomGroup);
  const status = make('p', 'pdf-load-status', '正在读取本机 PDF……');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const passwordForm = make('form', 'pdf-password-form'); passwordForm.hidden = true;
  const passwordLabel = make('label', 'pdf-password-label', '此 PDF 需要密码，请在本机解锁。');
  const passwordInput = make('input', 'pdf-password-input'); passwordInput.type = 'password';
  passwordInput.autocomplete = 'off'; passwordInput.required = true; passwordInput.setAttribute('aria-label', 'PDF 密码');
  passwordLabel.append(passwordInput);
  const unlock = button('解锁文档'); unlock.type = 'submit';
  const cancelPassword = button('取消解锁'); passwordForm.append(passwordLabel, unlock, cancelPassword);
  const stage = make('div', 'pdf-stage'); stage.hidden = true; stage.tabIndex = 0;
  stage.setAttribute('aria-label', 'PDF 页面，可在此区域滚动');
  const canvas = make('canvas', 'pdf-canvas'); canvas.setAttribute('role', 'img'); stage.append(canvas);
  const footer = make('div', 'pdf-viewer-footer');
  const tip = make('span', 'pdf-local-tip', '文件仅在本机读取和绘制。');
  const retry = button('重新读取'); retry.hidden = true;
  const download = make('a', 'pdf-download', '下载原文件'); download.setAttribute('download', '');
  footer.append(tip, retry, download); shell.append(toolbar, status, passwordForm, stage, footer);
  host.replaceChildren(shell);

  let disposed = false, sourceTicket = 0, renderTicket = 0, loadingTask, pdf, rendering;
  let pageNumber = 1, mode = 'fit', currentScale = 1, passwordCallback, resizeTimer, lastWidth = 0;
  let resource;
  try {
    resource = new URL(url, location.href);
    if (resource.origin !== location.origin || !['http:', 'https:', 'blob:'].includes(resource.protocol)) throw new Error();
    const downloadUrl = new URL(resource); if(resource.protocol!=='blob:')downloadUrl.searchParams.set('download', '1');
    download.href = downloadUrl.href;
  } catch { download.hidden = true; }

  function controls() {
    const ready = Boolean(pdf) && !disposed;
    previous.disabled = !ready || pageNumber <= 1;
    next.disabled = !ready || pageNumber >= (pdf?.numPages || 1);
    pageInput.disabled = !ready; zoomSelect.disabled = !ready;
    smaller.disabled = !ready || currentScale <= zoomSteps[0];
    larger.disabled = !ready || currentScale >= zoomSteps.at(-1);
    pageInput.value = String(pageNumber); pageInput.max = String(pdf?.numPages || 1);
    count.textContent = `/ ${pdf?.numPages || '—'} 页`;
  }
  function message(text, error = false) {
    status.textContent = text; status.classList.toggle('error', error);
    retry.hidden = !error; shell.classList.toggle('has-error', error);
  }
  function fail(text) {
    if (disposed) return;
    passwordForm.hidden = true; passwordInput.value = ''; passwordCallback = null;
    message(text, true); controls();
  }
  async function draw(resetScroll = false) {
    if (!pdf || disposed) return;
    const ticket = ++renderTicket;
    const previousRender = rendering; rendering = null;
    previousRender?.cancel();
    if (previousRender) await previousRender.promise.catch(() => {});
    if (disposed || ticket !== renderTicket) return;
    const requestedPage = pageNumber, document = pdf;
    controls(); message(`正在绘制第 ${requestedPage} 页……`);
    try {
      const page = await document.getPage(requestedPage);
      if (disposed || ticket !== renderTicket || document !== pdf) return;
      stage.hidden = false;
      const base = page.getViewport({ scale: 1 });
      const style = getComputedStyle(stage);
      const available = Math.max(120, stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
      const scale = mode === 'fit' ? Math.max(.05, available / base.width) : Number(mode);
      const viewport = page.getViewport({ scale });
      const oldScale = currentScale, oldTop = stage.scrollTop;
      currentScale = scale;
      // Bound canvas memory without changing the user's selected display size.
      const pixelScale = Math.min(devicePixelRatio || 1, 2, Math.sqrt(16000000 / (viewport.width * viewport.height)));
      canvas.width = Math.max(1, Math.floor(viewport.width * pixelScale));
      canvas.height = Math.max(1, Math.floor(viewport.height * pixelScale));
      canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
      canvas.setAttribute('aria-label', `${title}，第 ${requestedPage} 页，共 ${document.numPages} 页`);
      canvas.dataset.page = String(requestedPage); canvas.removeAttribute('data-rendered');
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Canvas unavailable');
      rendering = page.render({ canvasContext: context, viewport, transform: pixelScale === 1 ? null : [pixelScale, 0, 0, pixelScale, 0, 0], background: '#ffffff' });
      await rendering.promise;
      if (disposed || ticket !== renderTicket) return;
      rendering = null; canvas.dataset.rendered = 'true';
      stage.scrollTop = resetScroll ? 0 : oldTop * (scale / oldScale);
      if (resetScroll) stage.scrollLeft = 0;
      message(`第 ${requestedPage} / ${document.numPages} 页 · ${Math.round(scale * 100)}%${mode === 'fit' ? ' · 适合宽度' : ''}`);
      controls();
    } catch (error) {
      if (disposed || ticket !== renderTicket || error?.name === 'RenderingCancelledException') return;
      fail('这一页暂时无法绘制。可以重新读取，或下载原文件查看。');
    }
  }
  async function start() {
    const ticket = ++sourceTicket; ++renderTicket;
    rendering?.cancel(); rendering = null;
    const oldTask = loadingTask; loadingTask = undefined; pdf = undefined;
    passwordCallback = null; passwordInput.value = ''; passwordForm.hidden = true;
    stage.hidden = true; pageNumber = 1; controls(); message('正在读取本机 PDF……');
    if (oldTask) await oldTask.destroy().catch(() => {});
    if (disposed || ticket !== sourceTicket) return;
    if (!resource) return fail('PDF 地址无效。请从本机知识库重新打开文档。');
    try {
      const pdfjs = await import('./vendor/pdfjs/pdf.mjs');
      if (disposed || ticket !== sourceTicket) return;
      pdfjs.GlobalWorkerOptions.workerSrc = localAsset('pdf.worker.mjs');
      loadingTask = pdfjs.getDocument({
        url: resource.href, isEvalSupported: false, enableXfa: false, useSystemFonts: false,
        cMapUrl: localAsset('cmaps/'), cMapPacked: true,
        standardFontDataUrl: localAsset('standard_fonts/'), wasmUrl: localAsset('wasm/'),
      });
      loadingTask.onProgress = ({ loaded, total }) => {
        if (disposed || ticket !== sourceTicket || !passwordForm.hidden || pdf) return;
        message(total > 0 ? `正在读取本机 PDF……${Math.min(100, Math.round(loaded / total * 100))}%` : '正在读取本机 PDF……');
      };
      loadingTask.onPassword = (updatePassword, reason) => {
        if (disposed || ticket !== sourceTicket) return;
        passwordCallback = updatePassword; passwordForm.hidden = false;
        message(reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD ? '密码不正确，请重试。密码不会保存。' : '此文档已加密。密码只用于本次本机解锁，不会保存。');
        passwordInput.focus();
      };
      const result = await loadingTask.promise;
      if (disposed || ticket !== sourceTicket) { await result.destroy(); return; }
      pdf = result; passwordCallback = null; passwordForm.hidden = true; passwordInput.value = '';
      await draw(true);
    } catch (error) {
      if (disposed || ticket !== sourceTicket) return;
      const label = error?.name === 'InvalidPDFException' ? '文件不是有效的 PDF，或内容已损坏。'
        : error?.name === 'MissingPDFException' || error?.status === 404 ? 'PDF 文件未找到，请确认本机文件仍然存在。'
          : 'PDF 暂时无法读取，请确认本机服务正在运行。';
      fail(`${label} 可重试或下载原文件查看。`);
    }
  }
  function jump(value) {
    if (!pdf) return;
    const target = Math.min(pdf.numPages, Math.max(1, Math.trunc(Number(value)) || 1));
    if (target === pageNumber) { controls(); return; }
    pageNumber = target; void draw(true);
  }
  function setZoom(value) { mode = value; zoomSelect.value = value; void draw(false); }
  listen(previous, 'click', () => jump(pageNumber - 1));
  listen(next, 'click', () => jump(pageNumber + 1));
  listen(pageInput, 'change', () => jump(pageInput.value));
  listen(pageInput, 'keydown', event => { if (event.key === 'Enter') { event.preventDefault(); jump(pageInput.value); } });
  listen(zoomSelect, 'change', () => setZoom(zoomSelect.value));
  listen(smaller, 'click', () => setZoom(String([...zoomSteps].reverse().find(step => step < currentScale - .01) || zoomSteps[0])));
  listen(larger, 'click', () => setZoom(String(zoomSteps.find(step => step > currentScale + .01) || zoomSteps.at(-1))));
  listen(retry, 'click', () => { void start(); });
  listen(passwordForm, 'submit', event => {
    event.preventDefault();
    if (!passwordCallback || !passwordInput.value) return;
    const value = passwordInput.value, unlockDocument = passwordCallback;
    passwordInput.value = ''; passwordCallback = null; passwordForm.hidden = true;
    message('正在解锁本机 PDF……'); unlockDocument(value);
  });
  listen(cancelPassword, 'click', () => {
    ++sourceTicket; passwordCallback = null; passwordInput.value = '';
    loadingTask?.destroy().catch(() => {}); loadingTask = undefined;
    fail('文档尚未解锁。可以重新读取并输入密码，或下载原文件。');
  });
  const observer = new ResizeObserver(() => {
    const width = host.clientWidth;
    if (disposed || Math.abs(width - lastWidth) < 2) return;
    lastWidth = width; clearTimeout(resizeTimer);
    if (pdf && mode === 'fit') resizeTimer = setTimeout(() => { void draw(false); }, 100);
  });
  observer.observe(host); controls(); void start();
  return () => {
    if (disposed) return;
    disposed = true; ++sourceTicket; ++renderTicket; clearTimeout(resizeTimer); observer.disconnect(); events.abort();
    passwordCallback = null; passwordInput.value = ''; rendering?.cancel();
    loadingTask?.destroy().catch(() => {}); pdf = undefined;
  };
}

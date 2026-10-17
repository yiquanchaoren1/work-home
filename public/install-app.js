// Installation only: no service worker or work data cache.
let deferredPrompt = null;
let installedThisSession = false;
let installing = false;
const displayMode = window.matchMedia('(display-mode: standalone)');
const standalone = () => displayMode.matches || navigator.standalone === true;
const installed = () => installedThisSession || standalone();
const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const embeddedBrowser = /MicroMessenger|FBAN|FBAV|Instagram|DingTalk/.test(navigator.userAgent);
const preferredPlatform = appleMobile ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'desktop';
const icon = new URL('./icons/app-192.png',import.meta.url).href;

export function installAppPanel() {
  return `<section class="panel install-panel"><img src="${icon}" alt="" width="54" height="54"><div><div class="eyebrow">ALWAYS WITH YOU</div><h2>把Bing‘ House放进口袋</h2><p class="hint">添加桌面图标，以独立窗口打开。同一份资料，随时继续。</p></div><button class="button secondary" type="button" data-install-app aria-haspopup="dialog">安装到手机</button></section>`;
}

function updateDialog(message = '') {
  const dialog = document.querySelector('#install-app-dialog');
  if (!dialog) return;
  const alreadyInstalled = installed();
  dialog.querySelector('[data-native-install]').hidden = alreadyInstalled || !deferredPrompt;
  dialog.querySelector('[data-native-install]').disabled = installing;
  dialog.querySelector('[data-install-status]').textContent = message || (standalone() ? '当前已在 App 窗口中打开，可以直接使用。' : alreadyInstalled ? '已安装。下次可以从桌面打开Bing‘ House。' : embeddedBrowser ? '请先用系统浏览器打开Bing‘ House，再按下面步骤添加到桌面。' : deferredPrompt ? '当前浏览器已准备好安装，点击下方按钮确认。' : '按下面的浏览器步骤添加。若没有安装选项，请使用 Safari、Chrome 或 Edge。');
}

function choosePlatform(platform) {
  const dialog = document.querySelector('#install-app-dialog');
  if (!dialog) return;
  for (const button of dialog.querySelectorAll('[data-install-platform]')) button.setAttribute('aria-pressed',String(button.dataset.installPlatform === platform));
  for (const steps of dialog.querySelectorAll('[data-install-steps]')) steps.hidden = steps.dataset.installSteps !== platform;
}

function openInstallGuide() {
  let dialog = document.querySelector('#install-app-dialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'install-app-dialog';
    dialog.className = 'modal install-dialog';
    dialog.setAttribute('aria-labelledby','install-app-title');
    dialog.innerHTML = `<div class="install-cover"><button class="icon-button install-close" type="button" data-close-install aria-label="关闭安装说明">×</button><img src="${icon}" alt="Bing‘ House图标" width="72" height="72"><div class="eyebrow">YOUR WORK, WITH YOU</div><h2 id="install-app-title">Bing‘ House，随身打开</h2><p>桌面一点，就回到你的工作空间。</p><div class="install-features"><span>专属图标</span><span>独立窗口</span><span>资料同步</span></div></div><div class="install-body"><p class="install-status" data-install-status role="status"></p><button class="button primary native-install" type="button" data-native-install hidden>安装Bing‘ House</button><div class="install-platform-tabs" role="group" aria-label="选择安装设备"><button type="button" data-install-platform="android">安卓手机</button><button type="button" data-install-platform="ios">iPhone / iPad</button><button type="button" data-install-platform="desktop">电脑</button></div><ol class="install-steps" data-install-steps="android"><li>在 <strong>Chrome 或 Edge</strong> 中打开Bing‘ House。</li><li>点浏览器菜单 <strong>⋮</strong>，选择<strong>安装应用</strong>或<strong>添加到主屏幕</strong>，按提示确认。</li><li>回到手机桌面，点<strong>Bing‘ House</strong>图标打开。</li></ol><ol class="install-steps" data-install-steps="ios" hidden><li>在 <strong>Safari</strong> 中打开Bing‘ House。</li><li>点<strong>分享</strong>（方框向上箭头），选择<strong>添加到主屏幕</strong>。</li><li>如有<strong>作为网页 App 打开</strong>选项，请开启，再点<strong>添加</strong>。</li></ol><ol class="install-steps" data-install-steps="desktop" hidden><li>在 <strong>Chrome 或 Edge</strong> 中打开Bing‘ House。</li><li>点地址栏的安装图标，或从浏览器菜单选择<strong>安装Bing‘ House</strong> / <strong>将此站点作为应用安装</strong>。</li><li>按提示确认，之后从桌面或开始菜单打开。</li></ol><div class="install-note"><strong>你的资料仍在原来的位置</strong><p>安装不会复制或清空资料。云端版继续使用私有仓库，需要联网；重新打开或刷新后可能需要再次输入访问密钥。</p></div></div>`;
    dialog.querySelector('.install-note p').textContent='安装不会复制或清空资料。云端版仍需联网。首次连接时勾选“记住此设备”，之后打开可自动连接；密钥到期或被撤销后需更新。';
    document.body.append(dialog);
  }
  choosePlatform(preferredPlatform);
  updateDialog();
  if (!dialog.open) dialog.showModal();
}

window.addEventListener('beforeinstallprompt',event => {
  event.preventDefault();
  deferredPrompt = event;
  updateDialog();
});
window.addEventListener('appinstalled',() => {
  installedThisSession = true;
  deferredPrompt = null;
  updateDialog('已安装。下次可以从桌面打开Bing‘ House。');
});
displayMode.addEventListener?.('change',() => updateDialog());

document.addEventListener('click',async event => {
  const target = event.target.closest?.('button');
  if (!target) return;
  if (target.matches('[data-install-app]')) { openInstallGuide(); return; }
  if (target.matches('[data-close-install]')) { document.querySelector('#install-app-dialog')?.close(); return; }
  if (target.matches('[data-install-platform]')) { choosePlatform(target.dataset.installPlatform); return; }
  if (!target.matches('[data-native-install]') || !deferredPrompt || installing) return;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  installing = true;
  try {
    // Keep the native prompt in the user click gesture, before any await.
    await prompt.prompt();
    const choice = await prompt.userChoice;
    updateDialog(choice.outcome === 'accepted' ? '已确认安装，等待浏览器完成。完成后可从桌面打开。' : '暂未安装。你仍可按浏览器菜单步骤添加到桌面。');
  } catch {
    updateDialog('浏览器未能打开安装提示，请按下面的菜单步骤添加到桌面。');
  } finally {
    installing = false;
    updateDialog(document.querySelector('[data-install-status]')?.textContent);
  }
});

const topbar = document.querySelector('.topbar-actions');
if (topbar) {
  const button = document.createElement('button');
  button.className = 'icon-button install-app-entry';
  button.type = 'button';
  button.dataset.installApp = '';
  button.setAttribute('aria-label','安装到手机');
  button.setAttribute('aria-haspopup','dialog');
  button.title = '安装到手机';
  button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M9 5.5h6M10 18.5h4M12 8v7m-3-3 3 3 3-3"/></svg>';
  topbar.insertBefore(button,topbar.querySelector('.theme-toggle'));
}

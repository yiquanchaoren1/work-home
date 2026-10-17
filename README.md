# 工作间 · 云端版

个人工作事项、链接、文档和工作档案。保留原生绿色界面、拖动排序、快速状态、明暗主题、Markdown 编辑及独立文档阅读。

## 部署与资料

本仓库存放网站源码，GitHub Actions 构建后发布到 GitHub Pages。工作数据不放在这个公开仓库，运行时由用户授权访问独立的 **私有资料仓库**。

首次连接填写“用户名/资料仓库”和仅授权该仓库的 GitHub fine-grained personal access token，Contents 权限为 Read and write。勾选“记住此设备，下次自动连接”后，刷新、关闭并重新打开 App 时会自动验证并连接同一个私有仓库。安装后的 App 默认勾选；普通浏览器默认仅本次连接，也可自行选择记住。

只保存加密的连接凭据：设备端使用 AES-GCM 和不可导出的 CryptoKey，在按站点路径区分的 IndexedDB 中保存密文与加密密钥。不保存工作内容，不把明文密钥放入源码、URL、Cookie、localStorage、sessionStorage、备份或资料仓库。设备加密不等于系统钥匙串，不能防止同源恶意脚本或已被控制的浏览器使用这些凭据。

在“数据与设置 → 此设备自动连接”可记住当前连接，或“退出并清除此设备”。退出会清除此设备凭据，并通知已打开的同站工作间页面重新登录；不撤销 GitHub 密钥、不删除云端资料。其他设备分别管理。

断网或限流保留已保存的凭据，可点“重试自动连接”；密钥到期、被撤销或访问权限失效时，重新填写。清理网站数据、卸载 App 或浏览器清理设备存储后也可能需要再次连接。不勾选记住时仍为仅本次连接。浏览器不支持设备存储时会明确提示，可取消勾选后使用。

资料仓库保存 `workspace.json`、`files/` 附件及 `codex-worklogs/` 摘要来源。电脑和手机使用同一份云端数据，电脑关机后仍可访问；GitHub 不可达或密钥失效时不能读取或保存，页面会保留未保存的编辑。

多设备保存会检查版本，拒绝覆盖其他设备的新版本。完整备份包含原附件。删除资料会从当前版本移除，已有 Git 提交历史仍保留。

每日摘要由 Codex 提炼后上传到资料仓库 `codex-worklogs/YYYY-MM-DD.md`；同日更新同一文件。网页“同步每日摘要”读取这些文件，不读取本机原始会话。

## 安装到手机

打开工作间后，点击顶部手机图标、登录页的“安装到手机”，或“数据与设置 → 把工作间放进口袋”，查看安装步骤。支持原生安装提示的浏览器会显示“安装工作间”按钮。

- 安卓：使用 Chrome 或 Edge 打开，在浏览器菜单选择“安装应用”或“添加到主屏幕”，按提示确认。
- iPhone / iPad：使用 Safari 打开，点“分享 → 添加到主屏幕”；如果有“作为网页 App 打开”选项，保持开启。
- 电脑：Chrome / Edge 地址栏或菜单选择安装。

支持的浏览器安装后通过桌面图标以独立窗口运行，无需应用商店。安装与手机系统菜单需要本人确认；微信等内置浏览器请先切换到系统浏览器。

安装版与网页版使用同一个私有资料仓库，需要联网。不增加 Service Worker 或离线资料缓存；可按上述方式记住此设备，避免反复输入密钥。Web App Manifest、桌面图标等公开界面资源由浏览器管理，不包含个人资料。安装不会迁移、清空或改写工作数据。

参考：[Chrome 安装条件](https://web.dev/articles/install-criteria)、[Apple 主屏幕网页 App 指引](https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios)。

## 开发

```sh
npm ci
node prepare-vendor.mjs
npm test
node build-cloud.mjs
```

`dist-cloud/` 仅含静态界面、空的初始数据和浏览器运行库，不包含本机工作数据。仓库 Actions 使用 `.github/workflows/pages.yml` 发布。

源项目的本地文件版本仍可运行 `npm start`，其数据保存在电脑磁盘。云端与本地版本分别保存，不会自动相互覆盖；需要时使用完整备份迁移。

视觉方向参考 [shadcn/ui](https://github.com/shadcn-ui/ui)、[Magic UI](https://github.com/magicuidesign/magicui) 和 [shadcn-ui-sidebar](https://github.com/salimi-my/shadcn-ui-sidebar)，以原生 CSS / JavaScript 实现。

# Bing‘ House · 工作空间

当前 Pages 首页使用 `web/` 中基于 ShadcnStore 的 React/Vite 工作台；旧版仍在 `/classic/`，原磁盘服务源码继续保留。

- 新版入口：https://yiquanchaoren1.github.io/work-home/
- 旧版入口：https://yiquanchaoren1.github.io/work-home/classic/
- 生产构建：根目录与web分别 `npm ci --ignore-scripts`，再运行 `node build-pages.mjs`。
- 测试：根目录 `npm test`（原98项），build-pages另跑web的10项模型/schema检查；`tests/shadcn-cloud-e2e.mjs`需本机Playwright/Chrome，使用模拟私有仓库。
- 云端工作资料仍保存在用户私有仓库。构建只发布客户端与空种子，绝不复制本机data或连接凭据。
- 新旧界面共用原设备登录范围；选择“记住此设备”仅加密保存连接信息。独立阅读页从授权的父窗口只获得选中文档。
- 首页打开、返回前台及前台每5分钟自动读取已归档摘要；有待保存修改/上传时跳过刷新，防止覆盖草稿。
- 手机继续使用同一网址及原主屏幕App入口。可在新版页头查看安装说明，无工作内容离线缓存。
- 兼容字段：事项dueDate/priority、settings.ui的浅深色配色与侧栏设置；共享校验器和旧版保存均保留它们。版本冲突继续拒绝覆盖。

上游MIT许可与来源见 `web/LICENSE.md`、`web/UPSTREAM.md`。`web/public/legacy`及第三方运行资产由构建生成，不是独立的资料副本。

---

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

工作中，Codex 按工作区规则持续合并当天的本机摘要。已配置的 Codex 自动任务每天北京时间（Asia/Shanghai）00:00 整理刚结束的前一天，并上传到私有资料仓库 `codex-worklogs/YYYY-MM-DD.md`；例如10月18日00:00归档10月17日，同日更新同一文件。也会检查漏传/修订的已结束日期摘要，以及有变化的个人档案和历史总结，未变化不重复提交。

零点整理需要电脑和 Codex 能运行。设备未运行或上传失败时，文件保留在本机，后续任务执行时补传；无法保证关机期间按时生成新摘要。源文件上传后，手机查看不需要电脑开机。

网页已移除手动同步按钮：打开、返回 App、进入工作档案及前台每60秒会自动检查。只显示已结束日期的每日摘要；个人档案与历史总结自动更新。读取源文件不会自动写入或覆盖 `workspace.json`；摘要源文件本身就是持久存档，完整备份和迁移导出会包含读取到的档案。来源暂时不可达时保留已有数据和当前会话中已读取的摘要，并显示重试状态；工作事项仍可使用。不会上传或读取原始会话。

“环境与验证”模块及其导航、首页卡片、事项入口和搜索结果已移除。旧记录仍保留在数据及完整备份中，避免丢失已有资料。

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

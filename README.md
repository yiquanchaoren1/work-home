# 工作间 · 云端版

个人工作事项、链接、文档和工作档案。保留原生绿色界面、拖动排序、快速状态、明暗主题、Markdown 编辑及独立文档阅读。

## 部署与资料

本仓库存放网站源码，GitHub Actions 构建后发布到 GitHub Pages。工作数据不放在这个公开仓库，运行时由用户授权访问独立的 **私有资料仓库**。

登录页面填写“用户名/资料仓库”和仅授权该仓库的 GitHub fine-grained personal access token，Contents 权限为 Read and write。访问密钥只用于当前会话，不存入网页源码、URL、Cookie、localStorage 或 IndexedDB。刷新主页或关闭全部页面后需要重新连接；由已连接主页打开的文档阅读页可在内存中接续会话。

资料仓库保存 `workspace.json`、`files/` 附件及 `codex-worklogs/` 摘要来源。电脑和手机使用同一份云端数据，电脑关机后仍可访问；GitHub 不可达或密钥失效时不能读取或保存，页面会保留未保存的编辑。

多设备保存会检查版本，拒绝覆盖其他设备的新版本。完整备份包含原附件。删除资料会从当前版本移除，已有 Git 提交历史仍保留。

每日摘要由 Codex 提炼后上传到资料仓库 `codex-worklogs/YYYY-MM-DD.md`；同日更新同一文件。网页“同步每日摘要”读取这些文件，不读取本机原始会话。

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

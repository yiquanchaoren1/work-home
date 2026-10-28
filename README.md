# Bing‘ House · 工作空间

Pages 使用 `web/` 中基于 ShadcnStore 的工作台。当前只发布新界面，不再生成旧版 `/classic/` 或旧版根页面。

- 正式入口：https://yiquanchaoren1.github.io/work-home/
- 构建：根目录与web分别 `npm ci --ignore-scripts`，再运行 `node build-pages.mjs`。完整输出在dist-cloud；每次重建替换整个发布产物。
- 测试：根目录 `npm test`（数据与存储98项），构建另跑web的21项检查；本机Playwright/Chrome运行 `node tests/shadcn-cloud-e2e.mjs`及`node tests/task-times-e2e.mjs`。
- 工作资料仍保存在既定私有仓库，源资料与附件不参与公开构建。只有勾选记住设备时加密保存连接凭据；原根设备范围及manifest标识保留。
- 工作事项支持卡片右上角、表格操作列、编辑窗口中的删除；确认后仅移除事项并解除关联，文档、附件、链接和工作记录保留。
- 事项首次保存自动生成创建与修改时间；内容或状态修改更新修改时间，无变化保存不刷新时间。切换已完成记录完成时间，归档保留，重新开始清除当前完成时间；旧事项缺失的历史完成时间显示未记录，不推测补齐。卡片、表格与编辑窗口均显示北京时间，精确到秒。
- 事项名称、当前进展和下一步支持 Enter / Shift+Enter 换行，按纯文本保留下划线；单行元数据框的 Shift+Enter 不再误提交。
- 手机继续使用原地址/桌面App，页头提供安装说明。打开/返回前台及前台每5分钟自动读取已归档摘要；编辑/上传时避免覆盖当前草稿。
- `public/` 中保留共享数据格式、私有库适配器和原磁盘工具源码，生产构建只提取必要共享模块到legacy目录；该目录不包含旧界面的HTML/CSS。
- 旧UI源码可从Git历史恢复，不删除任何本机工作资料、个人档案或附件。新增dueDate/priority/settings.ui继续保留。

上游MIT许可与来源见 `web/LICENSE.md`、`web/UPSTREAM.md`。生成资产和依赖不提交到源码仓库。

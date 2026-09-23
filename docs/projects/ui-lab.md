# UI 实验室

状态：2026-09-16 完成 3 组 10 个冻结版本，2026-09-17 完成 Apple Design 外壳与本地验收；尚未部署。清理前实施记录见 [`../archive/2026-09-22/ui-lab_清理前.md`](../archive/2026-09-22/ui-lab_清理前.md)，详细 Apple 核对见 [`../archive/2026-09-22/ui-lab-apple-review.md`](../archive/2026-09-22/ui-lab-apple-review.md)。

Read when：修改 UI 实验室外壳、版本选择、iframe 预览、冻结规则或验收。

Do not read when：修改被展示作品的正式版本、其他主站页面或后端。

Source of truth：本文档负责 UI 实验室当前边界；冻结源文件和 seal 以 `archives/ui-lab` 为准，发布产物以 `apps/main/public/projects/ui-lab` 为准。

## 边界

- 主站一级作品，不属于行业 Demo 集。
- 路由为 `/works/ui-lab`、`/works/ui-lab/[experiment]`、`/works/ui-lab/[experiment]/[variant]`。
- 外壳位于 `apps/main`，不新增 App、API、依赖、环境变量或持久化。
- 冻结源码保存在 `archives/ui-lab`，发布产物和预览位于 `apps/main/public/projects/ui-lab`。归档源文件只复制，不覆盖；新版本使用新目录。

## 当前体验

- 三组实验共十版：城市通五版、工作台三版、岛见两版。模型标签来自用户确认，不推断未知的具体模型版本。
- 首页使用共享页头、实体作品卡和大幅截图；对照页支持版本组合、左右交换、视口切换、比例同步或独立滚动；体验页提供完整 iframe 流程。
- 1024px 起双截图，以下使用 A/B；URL 保存左右组合并对非法、重复或冲突选择恢复安全默认。
- iframe 只允许脚本；CSP 禁止连接、外部资源和表单提交。就绪消息只接受当前 iframe，超时提供恢复。
- 页面支持键盘、明确焦点、减少动态、减少透明度和高对比度。外壳运动可中断，冻结版本本身保持历史原貌。

## 冻结与验收

构建只消费归档源码，主站 build 不重新生成快照。冻结后使用 seal 哈希拒绝覆盖。发布前验证：受保护文件哈希、全部公开路由、版本组合、前进后退、资源失败恢复、320px 至桌面视口、200% 文字和 iframe 键盘退出。

当前本地单元、浏览器、lint、typecheck 和 build 已通过；这不代表跨浏览器认证或线上发布。

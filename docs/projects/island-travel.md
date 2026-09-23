# 岛见与行业 Demo 集

状态：2026-09-16 山林版多页流程本地完成，尚未部署。清理前视觉过程和逐次验收见 [`../archive/2026-09-22/island-travel_清理前.md`](../archive/2026-09-22/island-travel_清理前.md)。

Read when：修改岛见页面流程、意图理解契约、模拟交易、限流或发布验收。

Do not read when：修改行业 Demo 集的其他作品、主站公共外壳或静眠森。

Source of truth：本文档负责岛见当前行为与发布边界；接口以 Pydantic Schema 为准，前端状态机和限流实现以代码与测试为准。

## 路由与范围

- 行业 Demo 集：`/works/demos`
- 岛见首页：`/works/demos/island-travel`
- 完整流程：`/plan`、`/confirm`、`/orders`、`/orders/[id]`

岛见属于 `apps/main`，复用实验服务，不新增 App、部署单元或业务数据库。视觉采用已确认的炭绿、香槟和山林旅行礼宾方向；行业合集保持自己的既有视觉。

## 行为与接口

- 使用真实海南城市名；品牌、班次、价格、余票、乘客、支付和车票均为虚构演示。
- 页面状态保存在岛见布局的浏览器内存；内部导航和前进后退保留当前流程，刷新清空。没有 localStorage、sessionStorage 或业务数据库。
- 默认真实 AI 只负责自然语言意图理解。班次、金额、库存、FAQ、订单和支付状态由确定性演示代码生成。
- `POST /api/experiments/island-travel/chat` 代理 `POST /works/island-travel/chat`；输入包含 message、conditions 和最多 16 条 history，输出包含 mode、intent、conditions、reply、faq、selection。
- Pydantic 是权威契约，前端 Zod 校验。乘客表单不发送给模型，自由文本中的长数字拒绝发送。
- 缺项按出发地、目的地、日期补问；日期按上海时区解释。新行程重置当前对话和选择，但保留本页订单；刷新清空全部。
- 创建订单必须明确确认。支付失败可重试原订单；支付未知只能查单；出票异常只重试出票，不重复支付。

## 限流与公开边界

真实模型调用由主站使用 Upstash-compatible Redis REST 原子滑动窗口限流：每个可信客户端 IP 每 600 秒 10 次。只存环境隔离的 HMAC IP 摘要、随机请求编号和时间戳，600 秒过期；不存聊天或乘客信息。

生产只信任部署平台覆写的客户端 IP 头。缺少 `ISLAND_RATE_REDIS_URL`、`ISLAND_RATE_REDIS_TOKEN`、`ISLAND_RATE_SALT` 或计数失败时返回 503，关闭真实调用；仅非生产 localhost 可使用内存计数。

## 发布前验收

当前本地单元、浏览器、主站构建、实验服务测试和少量真实模型链路已经通过，但不等于公网限流完成。发布前必须：

1. 配置真实 Redis REST 资源并验证跨实例第 11 次请求返回 429、10 分钟后恢复。
2. 先部署实验服务，再验证主站 Preview 的凭据、HTTPS、真实模型、超时和失败恢复。
3. 复核真实手机、公开素材和全部订单异常路径后再发布 Production。

资料入口：[`资料_行业AI产品实验室`](../../../../01_资料库/资料_行业AI产品实验室/README.md)。

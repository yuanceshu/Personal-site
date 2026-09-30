# 琴台票务 · 武汉演出票务

状态：已迁入主站行业 Demo 集，演出、票档、订单与经营数据均为虚构演示数据。

Read when：修改琴台票务的票务引擎、库存与锁座、候补回流、运营待审批、Agent 代理、页面流程或发布验收。

Do not read when：修改其他行业 Demo、主站公共外壳或实验服务的非琴台模块。

Source of truth：本文负责作品边界与验收；数据、Schema、引擎、组件和接口以当前代码为准。

## 路由与边界

- 行业 Demo 集：`/works/demos`
- 顾客侧：`/works/demos/qintai-ticketing`、`/shows`、`/shows/[id]`、`/wallet`、`/waitlist`
- 运营侧：`/works/demos/qintai-ticketing/merchant`、`/events`、`/holds`
- 主站 API：`/api/experiments/qintai-ticketing/chat`、`/merchant`、`/status`
- 实验服务：`/works/qintai-ticketing/chat`、`/merchant`、`/status`

琴台属于 `apps/main`，不建立独立 App、Vercel Project、数据库、账号、支付或真实票务系统对接。会话、锁座、台账和聊天历史仅保存在浏览器 localStorage。

## 体验与能力

- 顾客可以检索演出、查看票档余量与费用拆分、锁座（8 分钟倒计时）、管理票夹、售罄时加入候补并处理回流票。
- 顾客侧助手以右侧常驻栏显示，持续读取当前页面的票档、费用与规则；运营侧助手仍以可收起抽屉显示。
- 运营侧可以查看排期与 pacing 进度、改价、释放库存和建立活动；所有改动先生成待审批提案，再在待审批列表应用。

确定性引擎常量：`HOLD_TTL_S=480`、`OFFER_CLAIM_WINDOW_S=600`、`MAX_TICKETS_PER_EVENT=8`、`BARCODE_ROTATION_S=60`、`max_items_per_change=25`、`max_price_delta_pct=20`、`max_promotion_discount_pct=50`、`max_restock_quantity=500`、`max_campaign_budget=10000`。

## Agent 处理

模型只读取当次界面投影、只产出待确认草案。锁座、改价、补货和活动等写操作均由浏览器确定性执行，执行前按实时余量与护栏复校。实验服务不可用、超时、限流或返回结构不合法时，页面降级为确定性回答。

实时 Agent 复用 `EXPERIMENT_AGENT_URL` 与 `EXPERIMENT_AGENT_TOKEN`。公开环境还需要独立的 `QINTAI_RATE_REDIS_URL`、`QINTAI_RATE_REDIS_TOKEN` 和 `QINTAI_RATE_SALT`；缺少限流配置时不开放实时模型调用，确定性 Demo 仍完整可用。

浏览器测试必须使用 `localhost`。Next.js 16 dev server 对 `127.0.0.1` 的静态 chunk 请求会因跨源保护返回 403，页面会停在载入态；运行琴台浏览器测试时使用 `QINTAI_TEST_URL=http://localhost:3100`。

## 验收

```bash
cd apps/main
npm run lint
npm run test:content
npm run test:qintai
QINTAI_TEST_URL=http://localhost:3100 npm run test:qintai:browser

cd ../../services/experiment-agents
uv run pytest -q tests/test_qintai_ticketing.py
uv lock --check
```

核心流程覆盖：检索、锁座与刷新恢复；售罄票档候补；运营改价先暂存、应用后写穿；待审批刷新恢复；合集入口与窄屏布局。发布前另行确认 Vercel 环境变量、实验服务凭据、Redis 限流和 SSE Function 行为。

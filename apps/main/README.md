# Main App

个人作品站主应用，承载现实身份首页、Project 000、AI 工作台及行业 Demo 集。静眠森已迁移到相邻的 `apps/jingmiansen` 独立 App，角色服务位于 `services/jingmiansen-agents`。岛见已本地验证，尚未部署。

## 路由

```text
/                   主站首页
/works/project-000  Project 000
/works/ai-solution-lab  AI 场景诊断工作台
/works/demos  行业 Demo 集
/works/demos/island-travel  岛见智能出行
/works/demos/linquan  林泉智能伴游
/works/demos/qintai-ticketing  琴台票务 · 武汉演出票务
/works/demos/finance-assistant  云川财务智能体
/works/demos/medical-ai  明川医院 AI 就医助手
/works/ui-lab  UI 实验室（3组10版）
/works/ui-lab/[experiment]  双版本截图对照
/works/ui-lab/[experiment]/[variant]  单版本冻结交互查看器
/works/ai-life-comics  小麦子的生活漫画
```

主站通过 `JINGMIANSEN_SITE_URL` 提供静眠森单向外链，并把历史 `/works/jingmiansen/*` 地址永久 308 到独立站。链接设置 `referrerPolicy="no-referrer"`；主站不再包含静眠森页面、素材、聊天 API 或 Host 判断代理。

## 本地开发

```bash
cp .env.example .env.local
npm install
npm run dev
```

`.env.local`：

```dotenv
JINGMIANSEN_SITE_URL=http://localhost:3001
```

## 质量检查

```bash
npm run lint
npx next typegen
npm run typecheck
npm run build
```

架构和跨应用关系见仓库根目录 `docs/00_架构说明.md`。

## UI 实验室

2026-09-16完成本地验收，未部署。新增页面仅使用Apple Design；历史版本独立冻结，不随正式组件更新，不调用真实AI/交易、不需要环境变量。`npm run test:ui-lab` 检查清单与封存哈希；`npm run test:ui-lab:browser` 在本地3000端口运行交互验收（可用 `UI_LAB_TEST_URL` 指定其他地址）。主站构建不重新生成快照。来源、已知限制及全部验收见[实施记录](../../docs/projects/ui-lab.md)。

## 岛见

真实 AI 通过 `/api/experiments/island-travel/chat` 访问实验服务，配置沿用 `.env.example` 的 `EXPERIMENT_AGENT_URL` 与 `EXPERIMENT_AGENT_TOKEN`。本地无模型可主动切换演示模式；没有静默兜底。订单仅在当前页面内，不保存个人资料。

`npm run test:travel` 验证业务、契约和代理；`npm run test:travel:browser` 需要 localhost:3000 与本机 Chrome。生产限流使用 `.env.example` 中三个 `ISLAND_RATE_*` 服务端变量；生产构建在本地运行也不会绕过缺配置检查。开发模式 localhost 才使用本进程计数。详细边界见[岛见实现记录](../../docs/projects/island-travel.md)。

## 食智助手

四条 `/works/demos/restaurant-ai` 页面由主站承载；实时 Agent 经 `/api/experiments/restaurant-ai/chat` 转发到实验服务的 `/works/restaurant-ai/chat`。本地沿用 `EXPERIMENT_AGENT_URL` 和 `EXPERIMENT_AGENT_TOKEN`，实验服务沿用 `LLM_*` MiniMax 配置。页面可查看明确标注的预置样例。公网实时调用要求主站配置独立的 `RESTAURANT_RATE_REDIS_URL`、`RESTAURANT_RATE_REDIS_TOKEN` 和 `RESTAURANT_RATE_SALT`；缺少配置时关闭实时调用。全部门店、经营与财务数据都是虚构演示内容。

## 林泉

`/works/demos/linquan` 是主站行业 Demo 集中的景区智能伴游作品。路线、景点、活动、服务点、自然任务和模拟业务 Tool 在主站服务端确定性执行；可选的实时 Agent 只解释已执行结果，经 `/api/experiments/linquan/chat` 代理到实验服务，未配置或失败时继续使用规则回答。VisitorContext 与聊天历史仅保存在浏览器 localStorage，不使用 GPS、账号、数据库或真实景区系统。

实时 Agent 复用 `EXPERIMENT_AGENT_URL` 与 `EXPERIMENT_AGENT_TOKEN`。公开环境还需要独立的 `LINQUAN_RATE_REDIS_URL`、`LINQUAN_RATE_REDIS_TOKEN` 和 `LINQUAN_RATE_SALT`；缺少限流配置时不开放实时模型调用，规则 Demo 仍可用。详细行为与验收边界见[林泉实现记录](../../docs/projects/linquan.md)。

## 云川财务智能体

`/works/demos/finance-assistant` 直接承载原财务助手 Demo 的经营总览、智能分析、渠道对账和异常监测工作台。原有 TypeScript Finance Tool、Schema、虚构数据与结果卡片迁移到 `lib/works/finance-assistant`；页面保留原工作台 UI/UX。对话经 `/api/experiments/finance-assistant/chat` 代理到实验服务的 Agno Agent，Agent 只能调用六个确定性 Finance Tool，金额和对账关系由主站服务端计算。Tool 内部接口需要服务间 Token，浏览器不会获得凭据；未配置实验服务时，静态总览与对账页面仍可用。Vercel 公开环境还需要 `FINANCE_RATE_REDIS_URL`、`FINANCE_RATE_REDIS_TOKEN` 和 `FINANCE_RATE_SALT`，缺少配置时关闭实时模型调用。

## 明川医院 AI 就医助手

`/works/demos/medical-ai` 复用独立 Demo 已验证的就医旅程、Visit Context、业务 Tool、Medical/Hospital Knowledge、Safety Rules、Triage 和报告解释。状态保存在浏览器 localStorage，并在每次请求中恢复和返回，不依赖 Vercel 实例内存。确定性业务逻辑留在主站；回答润色经 `/api/experiments/medical-ai/chat` 转发到实验服务的 `/works/medical-ai/chat`，共用 `LLM_*` MiniMax 配置。

公网实时调用要求独立的 `MEDICAL_RATE_REDIS_URL`、`MEDICAL_RATE_REDIS_TOKEN` 和 `MEDICAL_RATE_SALT`；缺少配置时仍可体验规则 Demo。所有医院、患者、号源、费用、路线、检查和报告数据均为虚构演示内容。详细边界见[医疗 Demo 实现记录](../../docs/projects/medical-ai.md)。

## 琴台票务

`/works/demos/qintai-ticketing` 是主站行业 Demo 集中的武汉演出票务作品，分顾客购票侧与运营工作台两侧。库存、锁座、候补、改价、补货与活动护栏都在浏览器上用确定性 TypeScript 引擎执行；待审批提案同样只在浏览器内暂存与应用。可选的实时 Agent 只读当次界面投影、只产出待确认草案，经 `/api/experiments/qintai-ticketing/chat`（顾客侧）与 `/api/experiments/qintai-ticketing/merchant`（运营侧）代理到实验服务，未配置或失败时继续使用确定性回答。会话、锁座与聊天历史仅保存在浏览器 localStorage，不使用账号、数据库或真实票务系统。

实时 Agent 复用 `EXPERIMENT_AGENT_URL` 与 `EXPERIMENT_AGENT_TOKEN`。公开环境还需要独立的 `QINTAI_RATE_REDIS_URL`、`QINTAI_RATE_REDIS_TOKEN` 和 `QINTAI_RATE_SALT`；缺少限流配置时不开放实时模型调用，确定性 Demo 仍可用。演出、票档、订单与经营数据均为虚构演示内容。详细行为与验收边界见[琴台票务实现记录](../../docs/projects/qintai-ticketing.md)。

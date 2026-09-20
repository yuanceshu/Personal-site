# Main App

个人作品站主应用，承载现实身份首页、Project 000、AI 工作台及行业 Demo 集。静眠森已迁移到相邻的 `apps/jingmiansen` 独立 App，角色服务位于 `services/jingmiansen-agents`。岛见已本地验证，尚未部署。

## 路由

```text
/                   主站首页
/works/project-000  Project 000
/works/ai-solution-lab  AI 场景诊断工作台
/works/demos  行业 Demo 集
/works/demos/island-travel  岛见智能出行
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

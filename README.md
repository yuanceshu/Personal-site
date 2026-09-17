# 袁策书的个人产品实验室

个人作品站代码仓库，采用单仓库、多应用和多 Vercel Project。主站、静眠森 Web 与静眠森角色服务拥有独立运行和部署边界。

## 部署单元

```text
apps/main                    # 个人主站与 Project 000
apps/jingmiansen             # 静眠森独立 Next.js App
services/jingmiansen-agents  # 静眠森 Agno AgentOS / FastAPI
services/experiment-agents   # 工作台与岛见共用 FastAPI 服务
```

| 单元 | Vercel Root Directory | 当前状态 |
|---|---|---|
| 主站 | `apps/main` | Production 已部署（以 2026-09-08 操作记录为准）；入口和旧址仍需在主站域名上复核 |
| 静眠森 Web | `apps/jingmiansen` | Production 已部署并绑定 `shinminforest.work`；Preview Agent 链路待补齐 |
| 静眠森 Agent | `services/jingmiansen-agents` | Production 已部署；健康检查和鉴权已核验，Cron/WAF/Preview 待验收 |
| AI 场景诊断实验服务 | `services/experiment-agents` | Production 已部署；健康检查、鉴权、主站联动和真实链路已核验 |

静眠森在内容上仍是个人作品体系中的二级创作世界，但技术上已经独立。主站只提供单向入口和旧路径 308；静眠森不提供返回主站的链接。这个边界降低普通访客反向发现主站的概率，但不是匿名或访问控制保证。

## 本地启动

行业 AI 产品实验室与其他实验工具的目录和共用实验服务规则见[实验作品组织与接入规划](docs/06_实验作品组织与接入规划.md)。工作台已完成首版 Production 部署；具体配置与验收以[部署操作记录](docs/部署记录/AI场景诊断工作台部署与上线操作记录_2026-09-14.md)为准。

主站及内容页面静态优先，动态工具可继续使用 Next.js；已有合适的 Vite H5 可保持独立前端。实验后端按作品组织显式模型流程、可选 Agno 和确定性业务逻辑，存储与部署按恢复、一致性和运行特征选择。海汽原工程未迁入；公开版「岛见」已按体验范围重新实现，尚未部署。

先启动角色服务：

```bash
cd services/jingmiansen-agents
cp .env.example .env
# 在 .env 中填写 MINIMAX_API_KEY；本地默认使用 SQLite
uv sync --dev
uv run python -m jingmiansen_agents.app
```

再分别启动两个 Web App：

```bash
cd apps/jingmiansen
npm install
npm run dev  # http://localhost:3001

cd ../main
npm install
npm run dev  # http://localhost:3000
```

本地环境变量入口：

- `apps/main/.env.local`：参考 `apps/main/.env.example`，配置 `JINGMIANSEN_SITE_URL`；
- `apps/jingmiansen/.env.local`：参考 `apps/jingmiansen/.env.example`，配置 Agent 地址和共享 Token；
- `services/jingmiansen-agents/.env`：参考服务目录 `.env.example`，保存 MiniMax Key、数据库和服务端 Secret。

`.env` 与 `.env.local` 均不提交。Vercel 中继续使用本地现有 `MINIMAX_API_KEY` 的同一值，但只录入 Agent Project 的加密环境变量。

## 检查命令

```bash
cd apps/main
npm run lint
npx next typegen
npm run typecheck
npm run build

cd ../jingmiansen
npm run lint
npm run typecheck
npm run build

cd ../../services/jingmiansen-agents
uv run pytest
uv lock --check
```

## 文档入口

- [UI 实验室](docs/projects/ui-lab.md)：主站一级作品，3组10个冻结交互版本；2026-09-16本地验收完成，未部署，归档无需后端；
- `docs/00_架构说明.md`：应用边界、路由、数据流、部署与环境变量；
- `docs/01_开发路线图.md`：当前发布阶段、验收条件与域名后续；
- `docs/02_代码决策记录.md`：仓库级技术决定及其历史；
- `docs/06_实验作品组织与接入规划.md`：实验室层级、未来目录、跨实验作品共用 Agent 服务及按需预留规则；
- `docs/部署记录/静眠森部署与上线操作记录_2026-09-08.md`：Production 上线事实、线上核验结果和未完成项；
- `apps/jingmiansen/README.md`：独立站职责、短路由和检查方式；
- `services/jingmiansen-agents/README.md`：AgentOS 本地与 Vercel 运行说明；
- `../../01_资料库/资料_静眠森/`：静眠森内容、人物、语言与安全规范。

当前不建设博客、CMS、全站数据库、账号体系、跨设备同步、长期角色记忆或通用 AI 网关。

## AI 场景诊断工作台（首版本地可运行）

新增同级工具路由 `/works/ai-solution-lab`，前端仍在 apps/main。三个示例可以离线体验；自定义需求通过实验服务调用真实模型。计划与验收见 [实现文档](docs/projects/ai-solution-lab.md)，启动及环境变量见 [实验服务说明](services/experiment-agents/README.md)，部署过程见[部署操作记录](docs/部署记录/AI场景诊断工作台部署与上线操作记录_2026-09-14.md)。

## 2026-09-09｜工作台后端路径确认

本工具首版采用 FastAPI/Pydantic 与显式模型客户端，暂不使用 Agno。实验服务保存提示词、校验、修复和规则兜底；Next.js 负责请求边界及代理。此决定替代本工具早先 Agno 计划，其他实验作品仍可按需使用 Agno。契约来源及阶段验收见工作台实现计划。

## 行业 Demo 集与岛见（2026-09-14 本地交付）

主站入口 `/works/demos`，首个子作品 `/works/demos/island-travel`。真实 AI 理解行程；班次、乘客、订单及支付由浏览器确定性模拟，刷新清空，支持主动进入无模型演示模式。没有新增 App、依赖或业务数据库。

本地同时启动主站与[实验服务](services/experiment-agents/README.md)。验证运行 `npm run test:travel`、`npm run test:travel:browser`。公网默认需要主站配置 `ISLAND_RATE_REDIS_URL`、`ISLAND_RATE_REDIS_TOKEN`、`ISLAND_RATE_SALT`，缺配置关闭真实调用；资源配置与公网第11次429仍待部署验收。范围和结果见[岛见实现记录](docs/projects/island-travel.md)。

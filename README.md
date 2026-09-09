# 袁策书的个人产品实验室

个人作品站代码仓库，采用单仓库、多应用和多 Vercel Project。主站、静眠森 Web 与静眠森角色服务拥有独立运行和部署边界。

## 部署单元

```text
apps/main                    # 个人主站与 Project 000
apps/jingmiansen             # 静眠森独立 Next.js App
services/jingmiansen-agents  # 静眠森 Agno AgentOS / FastAPI
```

| 单元 | Vercel Root Directory | 当前状态 |
|---|---|---|
| 主站 | `apps/main` | Production 已部署（以 2026-09-08 操作记录为准）；入口和旧址仍需在主站域名上复核 |
| 静眠森 Web | `apps/jingmiansen` | Production 已部署并绑定 `shinminforest.work`；Preview Agent 链路待补齐 |
| 静眠森 Agent | `services/jingmiansen-agents` | Production 已部署；健康检查和鉴权已核验，Cron/WAF/Preview 待验收 |

静眠森在内容上仍是个人作品体系中的二级创作世界，但技术上已经独立。主站只提供单向入口和旧路径 308；静眠森不提供返回主站的链接。这个边界降低普通访客反向发现主站的概率，但不是匿名或访问控制保证。

## 本地启动

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

- `docs/00_架构说明.md`：应用边界、路由、数据流、部署与环境变量；
- `docs/01_开发路线图.md`：当前发布阶段、验收条件与域名后续；
- `docs/02_代码决策记录.md`：仓库级技术决定及其历史；
- `docs/部署记录/静眠森部署与上线操作记录_2026-09-08.md`：Production 上线事实、线上核验结果和未完成项；
- `apps/jingmiansen/README.md`：独立站职责、短路由和检查方式；
- `services/jingmiansen-agents/README.md`：AgentOS 本地与 Vercel 运行说明；
- `../../01_资料库/资料_静眠森/`：静眠森内容、人物、语言与安全规范。

当前不建设博客、CMS、全站数据库、账号体系、跨设备同步、长期角色记忆或通用 AI 网关。

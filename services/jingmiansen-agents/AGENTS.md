# 静眠森角色智能体服务规则

## 适用范围

本文件适用于 `services/jingmiansen-agents/` 下的 Python 与 Agno AgentOS 服务。该服务是静眠森专属的运行时，不是主站通用 AI 网关，也不负责 Project 000、主站身份或其他作品的问答。

网页请求必须经过 `apps/jingmiansen` 的 `/api/jingmiansen/chat` 转发。浏览器不得直接调用 AgentOS 或 MiniMax；生产环境由共享 Bearer Secret 保护 AgentOS 原生接口，只开放最小 `/healthz` 与单独使用 `CRON_SECRET` 的清理入口。

## 修改前必读

涉及角色、提示词、资料装载、会话、隐私或安全时，先阅读：

- [`静眠森资料包 README`](../../../../01_资料库/资料_静眠森/README.md)；
- [`灵眠语言、行为与使用规范`](../../../../01_资料库/资料_静眠森/01_项目文档/04_灵眠语言行为与使用规范_v1.1.md)；
- [`静眠森角色智能体产品与安全规范`](../../../../01_资料库/资料_静眠森/01_项目文档/09_静眠森角色智能体产品与安全规范_v1.0.md)；
- [`代码架构说明`](../../docs/00_架构说明.md) 与 [`代码决策记录`](../../docs/02_代码决策记录.md)。

运行时只能使用已经核对且允许公开的静眠森资料。不得把主站身份、朋友身份、私密档案、原始截图、未发布原稿、完整核心设定或其他未审核内容复制到提示词、数据库或服务日志中。

## 运行与检查

需要 Python 3.12 和 `uv`。本地运行前复制 `.env.example` 为 `.env`，再填写必要配置：

```bash
uv sync --dev
cp .env.example .env
uv run pytest
uv run python -m jingmiansen_agents.app
```

依赖锁定检查：

```bash
uv lock --check
```

服务默认监听 `127.0.0.1:7777`，公开健康检查为 `/healthz` 且只返回状态。没有 `MINIMAX_API_KEY` 时不注册角色，自由对话会显示服务不可用，静态页面和普通作品导航仍应保持可用；Vercel 环境缺少 Key、Postgres 或 Secret 时必须拒绝启动。

## 密钥与数据边界

- MiniMax Key 只填写在本目录的 `.env`：`MINIMAX_API_KEY=...`；不得写入源码、Markdown、截图、Git 或客户端 bundle；
- `JINGMIANSEN_AGENT_URL` 和 `JINGMIANSEN_AGENT_TOKEN` 属于静眠森 Next.js App 的服务端配置，不要把它们写入客户端代码；
- 本地 `data/jingmiansen.db` 与生产 Neon Postgres 只保存有限会话历史，用于当前会话的多轮上下文，不作为角色长期记忆；30 天未活动会话必须清理，SQLite 文件必须保持 Git 忽略；
- 不在服务中新增全站数据库、CMS、通用 AI 网关或账号系统；如果确有新的持久化需求，先记录范围、用途和清理策略。

## Agent 配置边界

当前维护灵眠、菲莉卡与真理奈三个 Agent。除非有新的明确需求并完成资料与安全评审，否则不再添加角色，也不添加工具、知识库、Team、Agentic Memory、追踪或外部动作能力。真理奈只谈雨夜啡庭日常、咖啡、星辉魔法和当前生活，不展开背叛、审判、牢狱或创伤经历。角色遇到未确认内容时必须承认空白或拒答，不得通过暗示、谜语、编码或编造事实绕过边界。

修改提示词或 Agent 配置后，应同步检查静眠森安全规范、静眠森资料库决策记录和代码仓库决策记录；涉及网页行为、API 参数或环境变量时，还要同步检查 `apps/jingmiansen` 与 `docs/00_架构说明.md`。

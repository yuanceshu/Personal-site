# 行业 Demo 集 Vercel 与 Redis 配置及上线操作记录

> 本记录保存 2026-09-30 对景区、财务、医疗、票务四个行业 Demo 的 GitHub、Vercel、实验 Agent 与 Redis 配置过程和线上验收结果。真实 Secret、Token、API Key、数据库连接串、Redis Token 和限流 Salt 不写入 Git 或本文件。

## 1. 当前结论

四个 Demo 已纳入 `personal-site` 主仓库，并通过同一套主站与实验服务上线：

- 主站：<https://www.lingmian.work>
- 实验服务：<https://personal-site-experiment-agents.vercel.app>
- 主站 Vercel Project：`main`
- 实验服务 Vercel Project：`personal-site-experiment-agents`
- 主站 Root Directory：`apps/main`
- 实验服务 Root Directory：`services/experiment-agents`

四个 Demo 没有分别创建四个 Vercel Project。它们共享主站、实验 Agent 和模型配置；每个 Demo 在主站 API 层保留独立的限流 Salt 和 Redis key 前缀。

已完成线上验收：

- 四个 Demo 页面和 Demo 集入口返回 `200`；
- 实验服务 `/healthz` 返回 `200` 和 `{"status":"ok"}`；
- 票务状态接口返回 `{"live":true}`；
- 票务真实聊天请求返回 `200`、`text/event-stream`，最终事件为 `mode: "live"`；
- 主站服务端能够使用 Redis REST 限流后，再调用实验 Agent。

## 2. 代码与 Git 状态

仓库：`yuanceshu/Personal-site`

本次相关提交：

```text
055089e feat: add finance scenic medical and ticketing demos
df4ad00 fix: use shared Vercel Redis for demo limits
ae17b69 fix: use Upstash REST variables for demo limits
```

代码部署使用的最新提交为 `ae17b69`；本记录随后由提交 `6db9961` 写入。

本次没有提交工作区中原有的其他页面和测试改动。当前未纳入本记录提交的文件包括：

```text
apps/main/app/page.tsx
apps/main/components/works/demos/finance-assistant/finance-workspace.tsx
apps/main/tests/home/navigation.spec.ts
```

## 3. 部署拓扑

```text
浏览器
  ↓
apps/main 的 Next.js 服务端 API
  ↓
Redis REST 限流检查
  ↓ EXPERIMENT_AGENT_TOKEN
services/experiment-agents 的 FastAPI 服务
  ↓ LLM_API_KEY
MiniMax OpenAI-compatible API
```

职责边界：

- 浏览器不获得 Agent Token、模型 Key、Redis Token 或上游地址；
- 主站确定性逻辑、输入校验、业务 Tool 和 Demo 状态仍留在 `apps/main`；
- 实验服务负责结构化证据的模型解释和受限 Agent 调用；
- Redis 只保存带 Salt 的 IP 摘要计数和短期过期窗口，不保存订单、患者、财务数据或聊天正文；
- 四个 Demo 的会话、订单和演示数据仍按各自实现保存在浏览器或请求投影中，不使用业务数据库。

## 4. GitHub 与 Vercel 配置

### 4.1 实验服务 Project

从 GitHub 仓库连接 `services/experiment-agents`：

- Project：`personal-site-experiment-agents`
- Root Directory：`services/experiment-agents`
- 生产分支：`main`
- 入口：根目录 `app.py`
- 区域：`sin1`
- Function `maxDuration`：75 秒
- 不设置自定义 Build Command、Output Directory 或自定义域名

环境变量名称：

```text
EXPERIMENT_AGENT_TOKEN
LLM_BASE_URL
LLM_API_KEY
LLM_MODEL
LLM_TIMEOUT_SECONDS
```

`LLM_API_KEY` 只存在实验服务 Project；主站不保存模型 Key。

### 4.2 主站 Project

已有 `main` Project 继续使用：

- Root Directory：`apps/main`
- 生产域名：`www.lingmian.work`
- 主站服务端配置实验服务稳定 URL 和同一环境的 `EXPERIMENT_AGENT_TOKEN`

主站已有的实验服务变量：

```text
EXPERIMENT_AGENT_URL
EXPERIMENT_AGENT_TOKEN
```

新增的共享 Redis 变量由 Vercel Storage 集成注入：

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

以上变量配置在 Production 和 Preview。真实值只保存在 Vercel 加密环境变量中。

### 4.3 环境范围

每次新增或修改 Vercel 环境变量后，都要重新部署对应环境；只修改变量而不重新部署，旧 Deployment 不会读取新值。

## 5. Redis 资源配置

### 5.1 资源

通过 Vercel Marketplace 创建 Upstash Redis：

- 资源名称：`upstash-kv-copper-ribbon`
- 区域：Singapore（`sin1`）
- 方案：Free
- 月度命令额度：500,000
- 连接项目：`main`
- 连接环境：Production、Preview
- 未启用付费 Production Pack 或自动升级

Redis 只承担公网限流计数，不替代静眠森使用的 Neon PostgreSQL，也不承担任何业务持久化。

### 5.2 四个 Demo 的限流 Salt

每个 Salt 都配置在主站的 Production 和 Preview，名称如下：

```text
LINQUAN_RATE_SALT
FINANCE_RATE_SALT
MEDICAL_RATE_SALT
QINTAI_RATE_SALT
```

Salt 的真实值不写入 Git、部署记录、日志或客户端资源。

四个限流模块分别使用独立的 key 前缀：

```text
linquan
finance-assistant
medical-ai
qintai-ticketing
```

琴台票务还按顾客侧和运营侧分开计数，避免两个界面互相消耗额度。

## 6. 代码适配

四个主站限流模块都支持两种变量来源：

```text
<DEMO>_RATE_REDIS_URL / <DEMO>_RATE_REDIS_TOKEN
        ↓ 未设置时回退
KV_REST_API_URL / KV_REST_API_TOKEN
```

本次线上使用的是 Vercel Storage 注入的通用 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN`，再配合每个 Demo 自己的 Salt。

代码中使用的是 Redis REST HTTP 地址。原生 `REDIS_URL`（`redis://` 或 `rediss://`）不能直接传给 `fetch`，因此线上限流使用 `KV_REST_API_URL`。

相关实现：

- [林泉限流](/Users/csyuan/Documents/MyProducts/02_项目代码/personal-site/apps/main/lib/works/linquan/rate-limit.ts)
- [财务限流](/Users/csyuan/Documents/MyProducts/02_项目代码/personal-site/apps/main/lib/works/finance-assistant/rate-limit.ts)
- [医疗限流](/Users/csyuan/Documents/MyProducts/02_项目代码/personal-site/apps/main/lib/works/medical-ai/rate-limit.ts)
- [票务限流](/Users/csyuan/Documents/MyProducts/02_项目代码/personal-site/apps/main/lib/works/qintai-ticketing/rate-limit.ts)

本地开发时，非 Vercel 的 localhost 请求使用进程内计数；生产或 Preview 缺少 Redis、Salt、合法 IP 或 REST 地址时，实时模型请求会被拒绝，不会静默绕过限流。

## 7. 实际操作顺序

1. 确认四个 Demo 已经属于 `personal-site`，不使用 `/Users/csyuan/Documents/Codex/` 下的旧目录。
2. 运行四个 Demo 的自检、主站 lint、类型检查和生产构建。
3. 将 Demo 代码提交并推送 GitHub `main`。
4. 让 `main` 和 `personal-site-experiment-agents` 根据同一提交自动创建 Vercel Deployment。
5. 先检查 Agent `/healthz`，再检查主站 Demo 页面和服务端代理。
6. 创建 Upstash Redis，并连接到 `main` 的 Production 与 Preview。
7. 配置四个 Demo 的限流 Salt。
8. 修改限流代码，使其能读取 Vercel Storage 的 REST 变量。
9. 重新提交并推送代码，等待两个 Vercel Project 自动重新部署。
10. 检查 Redis 限流、票务 `live` 状态、真实 SSE 和四个 Demo 页面。

## 8. 检查结果

本地检查结果：

```text
npm run lint                         通过
npm run typecheck                    通过
npm run test:finance-assistant      2/2 通过
npm run test:medical-ai             57/57 通过
npm run test:qintai                 28/28 通过
npm run test:linquan                18/18 通过
npm run build                       通过，生成 57 个静态页面/路由
git diff --check                    通过
```

线上检查结果：

- 主站 Demo 集入口和四个 Demo 路径返回 `200`；
- `https://personal-site-experiment-agents.vercel.app/healthz` 返回 `200`；
- `/api/experiments/qintai-ticketing/status` 返回 `{"live":true}`；
- 票务聊天接口返回 `Content-Type: text/event-stream; charset=utf-8`；
- 票务最终事件的 `mode` 为 `live`，说明 Redis REST 限流、主站代理、实验服务和 MiniMax 配置已经连通。

## 9. 与 AI 工作台部署的差异

本次仍复用 AI 工作台的 GitHub、Vercel 和服务端代理流程，差异集中在主站 API 前增加了 Redis 限流层。

| 项目 | AI 工作台 | 本次四个行业 Demo |
|---|---|---|
| Vercel Project | `main` + `personal-site-experiment-agents` | 继续使用同两个 Project |
| Agent 服务 | `services/experiment-agents` | 继续使用同一实验服务，按作品路由分发 |
| 模型配置 | `LLM_*`，Key 只在 Agent Project | 复用同一套 `LLM_*` |
| 主站配置 | `EXPERIMENT_AGENT_URL`、`EXPERIMENT_AGENT_TOKEN` | 复用同一套变量 |
| 公网限流 | 当时没有分布式限流 | 四个 Demo 各自使用 Redis REST 限流和 Salt |
| 数据库 | 没有 | 没有业务数据库 |
| Cron | 没有 | 没有新增 Cron |
| 外部资源 | MiniMax API | MiniMax API + Upstash Redis |
| 缺配置时行为 | Agent 配置缺失时服务不可用 | 实时 Agent 缺 Redis/Salt 时关闭或返回 503，确定性 Demo 继续可用 |

AI 工作台的原始部署记录：[AI 场景诊断工作台部署与上线操作记录_2026-09-14.md](/Users/csyuan/Documents/MyProducts/02_项目代码/personal-site/docs/部署记录/AI场景诊断工作台部署与上线操作记录_2026-09-14.md)。该记录明确说明当时没有数据库、Cron 或公网分布式限流，因此本次 Redis 配置不能直接省略。

## 10. 与静眠森的边界

静眠森使用独立的 Web App、独立 Agent Project、Neon PostgreSQL 和 Cron；本次四个 Demo 没有复制这些资源，也没有把静眠森的变量或凭据带入实验服务。

静眠森部署记录：[静眠森部署与上线操作记录_2026-09-08.md](/Users/csyuan/Documents/MyProducts/02_项目代码/personal-site/docs/部署记录/静眠森部署与上线操作记录_2026-09-08.md)。

## 11. Secret 与配置边界

- `.env`、`.env.local` 已加入对应 workspace 的 ignore 规则；
- 记录只保存变量名、用途、环境范围和验证结果，不保存变量值；
- MiniMax Key 只配置在实验服务 Project；
- Agent Token 只在主站和实验服务之间共享；
- Redis Token 只由 Vercel Storage 注入主站服务端；
- 浏览器、公开 HTML、客户端资源和 Git 历史不包含上述 Secret；
- 旧 Demo 目录只作为参考来源，本次没有在其中修改、部署或初始化项目。

## 12. 后续复用顺序

新增同类 Demo 时，优先沿用以下顺序：

1. 把 Demo 放入 `apps/main/app/works/demos/<demo-id>`，并在主站 API 层明确服务端边界；
2. 复用 `EXPERIMENT_AGENT_URL`、`EXPERIMENT_AGENT_TOKEN` 和实验服务 `LLM_*`；
3. 为公网实时入口增加独立的限流 key 前缀和 Salt；
4. 优先使用现有 Vercel Storage 的 REST 变量，不为每个 Demo 单独创建 Redis；
5. 重新部署后依次验证 `/healthz`、页面、缺配置行为、状态接口和至少一条真实服务链路；
6. 将实际操作、部署 ID、验证结果和已知问题追加到 `docs/部署记录/` 的对应记录中，不把 Secret 写入文档。

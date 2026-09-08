# 静眠森角色智能体

静眠森专属的 Agno AgentOS / FastAPI 服务。它通过 MiniMax OpenAI-compatible API 驱动灵眠、菲莉卡与真理奈，只接收静眠森 Web 的服务端请求，不是浏览器公开 API 或全站 AI 网关。

## 本地运行

需要 Python 3.12 和 `uv`：

```bash
uv sync --dev
cp .env.example .env
# 填写 MINIMAX_API_KEY
uv run pytest
uv run python -m jingmiansen_agents.app
```

未设置 `DATABASE_URL` 时使用 `data/jingmiansen.db`。本地可以不设置共享 Token；如果设置，静眠森 Web 的 `.env.local` 必须使用同一值。

## Vercel

Vercel Project 的 Root Directory 设为 `services/jingmiansen-agents`。根 `app.py` 是 Python entrypoint，`vercel.json` 固定 Singapore 区域、60 秒 Function 上限和每日清理 Cron。

必须配置：

```dotenv
MINIMAX_API_KEY=与本地现有 Key 相同的值
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
MINIMAX_MODEL=M2-her
DATABASE_URL=Neon pooled connection string
JINGMIANSEN_AGENT_TOKEN=随机共享Secret
CRON_SECRET=随机CronSecret
```

Production 和 Preview 分别使用 Neon 的生产分支与预览分支。Vercel 环境缺少 Key、Postgres 或两个 Secret 时服务会拒绝启动。

可选模型约束：

```dotenv
MINIMAX_MAX_COMPLETION_TOKENS=1000
MINIMAX_REQUEST_TIMEOUT=45
MINIMAX_MAX_RETRIES=1
```

## API 与安全

- `GET /healthz`：公开，只返回 `{"status":"ok"}`；
- `POST /agents/{agentId}/runs`：AgentOS 原生流式接口，要求 `JINGMIANSEN_AGENT_TOKEN`；
- `DELETE /internal/sessions`：由 Web 的“新对话”调用，要求同一 Agent Token，并校验角色、访客与 session；
- `GET /internal/cleanup`：只接受 Vercel 以 Bearer 形式发送的 `CRON_SECRET`，删除 30 天未活动会话；
- 其他 AgentOS 原生接口、OpenAPI 与文档同样受 Agent Token 保护。

服务不记录消息正文、完整匿名 ID、Key 或数据库连接串。三个 Agent 只把最近 8 次运行加入上下文，不启用工具、知识库、Team、Agentic Memory 或追踪。

## 检查

```bash
uv run pytest
uv lock --check
```

测试覆盖角色范围、提示词边界、生产配置、Bearer 鉴权、Postgres 选择、会话删除和过期清理。

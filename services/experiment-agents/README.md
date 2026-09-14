# 实验作品服务

当前仅实现 AI 场景诊断工作台，使用 FastAPI/Pydantic 和显式模型调用。没有 Agno、数据库、账号或任务队列。完整计划和验收以 [工作台实现文档](../../docs/projects/ai-solution-lab.md) 为准。

## 本地启动

需要 Python 3.12、uv，以及主站现有 Node 环境。从本目录执行：

```bash
uv sync --dev
# 仅首次创建；已有 .env 时不要覆盖
cp .env.example .env
# 在本地编辑 .env 后启动
uv run uvicorn experiment_agents.app:app --host 127.0.0.1 --port 8002 --no-access-log
```

| 配置 | 用途 |
|---|---|
| `EXPERIMENT_AGENT_TOKEN` | 本服务独立随机凭据，与主站同名变量一致 |
| `LLM_BASE_URL` | OpenAI-compatible API 基础地址，通常包括供应商要求的 `/v1` |
| `LLM_API_KEY` | 供应商密钥，只保存在本服务 |
| `LLM_MODEL` | 供应商实际支持的模型名称 |
| `LLM_TIMEOUT_SECONDS` | 单次模型调用超时，默认 30 秒，范围 1–45 秒 |

在 `apps/main/.env.local` 添加 `EXPERIMENT_AGENT_URL=http://127.0.0.1:8002` 和同一 `EXPERIMENT_AGENT_TOKEN`，然后重启主站。不要改动其他作品现有环境变量，不复制静眠森凭据。

当前本机已配置 MiniMax-M3 用于真实联调；没有配置模型时，自定义需求返回服务不可用。三个前端预设案例无需启动本服务即可体验；预设案例修改正文或理解字段后走真实接口，不能当作实时模型效果。

## Vercel Preview

Vercel Project 的 Root Directory 设为 `services/experiment-agents`。根 `app.py` 是 FastAPI 入口，`vercel.json` 固定 Singapore 区域和 75 秒 Function 上限；本服务没有数据库、Cron 或自定义域名。

首次只为 `feat/ai-solution-lab` 配置 Preview，不向 Production 注入变量：

```text
EXPERIMENT_AGENT_TOKEN=与主站 Preview 完全一致的独立凭据
LLM_BASE_URL=https://api.minimaxi.com/v1
LLM_API_KEY=服务端模型密钥
LLM_MODEL=MiniMax-M3
LLM_TIMEOUT_SECONDS=45
```

实验服务 Preview 部署完成后，在 Root Directory 为 `apps/main` 的主站 Project 中为同一分支配置：

```text
EXPERIMENT_AGENT_URL=实验服务的稳定 Preview URL
EXPERIMENT_AGENT_TOKEN=与实验服务 Preview 完全一致的凭据
```

环境变量新增或修改后必须重新部署对应 Preview 才会生效。浏览器不得获得上述 Token 或模型密钥；主站只通过服务端 API 代理调用实验服务。当前公开 Preview 没有分布式限流，URL 泄露可能产生真实模型费用，不代表已具备 Production 公网发布条件。

## 接口与职责

- `GET /healthz`：公开、仅返回状态。
- `POST /works/ai-solution-lab/generate`：Bearer 凭据必需，请求最多 32 KiB。
- 无公开 OpenAPI、管理或任意模型执行接口。
- `analyze` 输入 `{stage,input}`，输出需求 `Brief`。
- `diagnose` 输入 `{stage,brief,selectedCapabilities}`，输出 `Diagnosis`；非空能力选择必须严格保留。
- `plan` 输入 `{stage,brief,diagnosis}`，输出 `Prototype`。
- 正常响应 `{stage,mode:"live",data}`；仅规划阶段允许 `mode:"fallback"`，其依据必须是有效诊断。

权威结构在 `src/experiment_agents/works/ai_solution_lab/schemas.py`；提示词、阶段调用和修复在 `workflow.py`；模板区域、能力映射及数据引用等业务检查在 `domain.py`。浏览器和 Next.js 不提交提示词或输出 Schema。

客户端每阶段独立调用。模型输出最多 4,500 tokens，SDK 内建重试关闭，并请求 JSON object 模式；兼容 MiniMax 的 `<think>` 包装后再校验。诊断提示会限定当前场景允许的能力 ID。只有结构或业务校验错误可修复一次。网络失败不再盲目重试；理解和诊断失败报错，规划失败可标注规则草稿。用户断开连接时取消执行，不继续修复或兜底。模型原文、用户需求和凭据不写入日志。

## 预算与上线边界

当前是**本地验证预算**，不是已验证的生产参数：单次调用最多 45 秒（流程外层另加 1 秒保护）；Python 阶段上限 65 秒；Next.js 代理 70 秒；Next.js `maxDuration=75`。结构或语义错误仍最多修复一次，但整条阶段预算优先于第二次尝试。一次完整生成共三个阶段，阶段间等待用户确认不计入服务执行。调整其中一项时应同步检查整个链路。

本地已配置真实供应商，但样本仍不足以推断稳定的生产速度、成本或质量。上线前需逐阶段记录耗时、修复次数、兜底率、业务一致性与方案质量，验证部署平台支持执行时限并配置调用限额、HTTPS 和 Preview/Production 独立凭据。本地服务没有分布式限流，不能据此宣称已经具备公网发布条件。

## 验证

```bash
uv run pytest -q
uv lock --check
# 在 apps/main 执行
npm run test:lab
npm run test:lab:browser  # 先在 localhost:3000 启动主站；使用本机 Chrome
```

两端读取 `tests/fixtures/contracts.json` 的同一批正反例；后端还验证模型成功、非法 JSON、语义不一致、一次修复、修复失败、超时、断连、主动取消、鉴权和缺配置。SDK 测试通过 HTTP transport 替身检查真实客户端请求格式，不连接供应商。

需要复核生产构建下的本地 HTTP 链路时，可运行 `uv run python tests/stub_server.py`（仅绑定 127.0.0.1:8002），并在主站执行：

```bash
npm run build
EXPERIMENT_AGENT_URL=http://127.0.0.1:8002 EXPERIMENT_AGENT_TOKEN=local-test-only npm run start -- --port 3100
```

这个入口使用公开的测试凭据，只返回固定经营分析结果；仅用于验证浏览器 → Next.js → FastAPI → 模型替身，不用于质量评估或公开部署。普通本地预览使用 3000 端口，避免误把替身当真实服务。

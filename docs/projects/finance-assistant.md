# 云川财务智能体

`/works/demos/finance-assistant` 是行业 Demo 集中的财务经营工作台，迁移自独立的“财务助手 demo”。页面保留原工作台的经营总览、智能分析、渠道对账、异常监测和结果卡片交互。

## 行为边界

- `query_financial_data`、`compare_financial_periods`、`analyze_variance`、`detect_financial_anomalies`、`reconcile_transactions`、`generate_financial_report` 六个 Tool 继续使用确定性 Schema、虚构财务日数据和对账数据。
- Agent 由 `services/experiment-agents` 的 Agno 负责理解问题和编排 Tool。Tool 实际在主站服务端执行，模型不能修改金额、流水或状态。
- 主站只通过 `/api/experiments/finance-assistant/chat` 代理；服务间 Tool 接口带独立 Bearer 凭据，浏览器不接触模型密钥和内部接口。
- 预设的“上个月销售额 / 订单 / 退款率”问题走同一确定性 Tool 的快速路径，避免模型负载影响演示数字；其他开放问题交给 Agno。
- 所有数据均为虚构演示数据，不连接真实财务系统，不提交对账或业务操作。

## 验收入口

在主站执行 `npm run test:finance-assistant`、`npm run typecheck` 和 `npm run build`；服务执行 `uv run pytest -q` 与 `uv lock --check`。生产环境需要主站与实验服务共享 `EXPERIMENT_AGENT_TOKEN`，并配置已有的 `EXPERIMENT_AGENT_URL`、`LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`；主站 Vercel 还需 `FINANCE_RATE_REDIS_URL`、`FINANCE_RATE_REDIS_TOKEN`、`FINANCE_RATE_SALT`。

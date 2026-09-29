# 明川市中心医院 AI 就医助手

这是行业 Demo 集中的医疗就医旅程作品，入口为 `/works/demos/medical-ai`。医院、患者、号源、费用、路线、检查和报告均为虚构演示数据，不连接真实医疗系统。

## 行为边界

- 一个持续理解 Visit Context 的就医助手贯穿症状采集、导诊、挂号、到院、检查、排队和报告解释。
- Medical Knowledge、Hospital Knowledge、Safety Rules、Triage 和报告解释由主站确定性代码执行。
- Safety 命中后阻断普通挂号路径；报告解释保持只读，不输出确定性疾病诊断。
- 状态序列化到浏览器并随请求发送，服务端不依赖实例内存或数据库。

## Agent 与部署

主站通过 `/api/experiments/medical-ai/chat` 代理调用实验服务的 `/works/medical-ai/chat`。实验服务复用全站 `LLM_*` MiniMax 配置，只根据主站传来的结构化结果润色回答，不执行 Tool 或状态变更。模型不可用时主站继续使用确定性回答。

主站部署根目录为 `apps/main`，实验服务部署根目录为 `services/experiment-agents`。主站需要 `EXPERIMENT_AGENT_URL`、`EXPERIMENT_AGENT_TOKEN`；公开实时模型调用还需要 `MEDICAL_RATE_REDIS_URL`、`MEDICAL_RATE_REDIS_TOKEN` 和 `MEDICAL_RATE_SALT`。

## 验证

```bash
cd apps/main
npm run test:medical-ai
npm run build

cd services/experiment-agents
uv run pytest -q
uv lock --check
```

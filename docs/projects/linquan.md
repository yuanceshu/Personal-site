# 林泉 · 智能伴游

状态：已迁入主站行业 Demo 集，景区、活动和服务均为虚构演示数据。

Read when：修改林泉的景区 Tool、路线规划、VisitorContext、Agent 代理、页面流程或发布验收。

Do not read when：修改其他行业 Demo、主站公共外壳或实验服务的非林泉模块。

Source of truth：本文负责作品边界与验收；数据、Schema、Tool、组件和接口以当前代码为准。

## 路由与边界

- 行业 Demo 集：`/works/demos`
- 林泉首页：`/works/demos/linquan`
- 主站 API：`/api/experiments/linquan/chat`、`/api/experiments/linquan/tour`
- 实验服务：`/works/linquan/chat`

林泉属于 `apps/main`，不建立独立 App、Vercel Project、数据库、账号或地图/GPS 服务。VisitorContext 和聊天历史仅保存在浏览器 localStorage；刷新后仍可恢复本机游览状态。

## 体验与能力

- 游客可以查询景点、开放时间、交通、当前位置、厕所/休息/饮水/医疗等现场服务。
- 路线规划根据当前地点、同行人数、长者/儿童、体力、可用时间、兴趣和少台阶偏好确定性评分，包含停留、步行和返程。
- 当前位置可通过选择器或自然语言更新；路线、已到访地点和后续问答承接新位置。
- 活动查询、模拟报名、文创取货和人工求助保留独立 Tool 与明确的模拟结果。
- 自然探索任务、英文基础问答和浏览器 SpeechSynthesis 语音讲解继续可用。

## Agent 处理

主站先运行确定性 Agent 与 Tool，业务结果、路线和状态由 TypeScript 代码决定。配置 `EXPERIMENT_AGENT_URL` 与 `EXPERIMENT_AGENT_TOKEN` 后，主站将用户问题、上下文摘要和已执行 Tool 结果发送到实验服务的林泉模块，仅请求回答解释；模型不能执行 Tool、改变路线或声称未成功操作已完成。

实验服务不可用、超时、限流或返回结构不合法时，主站保留确定性回答并标记 fallback。公开环境的实时调用需要 `LINQUAN_RATE_REDIS_URL`、`LINQUAN_RATE_REDIS_TOKEN` 和 `LINQUAN_RATE_SALT`；规则 Demo 不依赖这些变量。

## 验收

```bash
cd apps/main
npm run lint
npm run typecheck
npm run test:linquan
npm run test:linquan:browser
npm run build

cd ../../services/experiment-agents
uv run pytest -q
uv lock --check
```

核心流程需要覆盖：设置同行者与游览条件并生成路线；更新当前位置后继续询问下一站和现场服务；查询活动并完成模拟报名；刷新后恢复本地状态；无实时 Agent 时继续使用规则回答。发布前使用 Stub 服务验证浏览器 → Next.js → FastAPI → 模型替身链路，并分别检查 Vercel Preview/Production 的凭据、限流和 Function 时限。

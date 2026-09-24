# 食智助手 · 餐饮 Agent Demo

状态：第二版本地实施；公开部署与验收另行确认。

Read when：修改食智助手的三类 Agent、演示资料、内容边界、视觉方向或验收。

Do not read when：修改其他行业 Demo、共享实验服务或主站公共页面。

Source of truth：本文档负责当前体验与公开边界；演示资料、接口和 Agent 行为以当前代码和测试为准。

## 边界

这是行业 Demo 集下的二级作品，前端路由位于 `apps/main/app/works/demos/restaurant-ai/`，不建立独立 App 或独立 Vercel Project。公开路径为 `/works/demos/restaurant-ai`。

第二版继续使用虚拟门店、菜单、制度、活动、经营与财务数据。真实模型仅通过主站代理访问 `services/experiment-agents` 中独立的餐饮模块；Agno 执行角色限定的工具调用，模型沿用实验服务的 MiniMax 配置。浏览器不获得模型密钥、Agent Token 或内部地址。不接数据库、真实 POS、会员、外卖、预订或财务系统。需求文档中的 PPT 不作为实施依据。

## 体验范围

- 顾客 Agent：查阅门店服务、演示菜单与明日演示桌位，准备预订草案；
- 运营 Agent：查阅制度与虚构经营快照、低库存提醒，准备运营调整草案；
- 财务 Agent：查阅规则与虚构账目，由程序计算平台对账差额，准备人工复核清单。

三类角色的资料、工具和提案权限相互隔离。答案展示实际工具进度、来源、数据卡片和追问；无依据时明确说明。操作只生成待确认提案，用户确认只更新当前页面的模拟状态，刷新清空，不执行真实业务写入。无实时服务时提供明确标注的预置样例，不静默伪装成真实 Agent。

## 视觉方向

本 Demo 的设计与实现只使用 `frontend-design` Skill，不使用其他 Skill。视觉方向为“暖色餐饮品牌 × 精密运营台”：首页清楚呈现三条任务链路，顾客端降低信息密度，运营和财务端突出证据、数据和待确认操作。沿用现有 Next.js/React/CSS，不依赖图片素材或新增 UI 依赖。

## 接口与发布边界

浏览器调用主站 `/api/experiments/restaurant-ai/chat`，主站通过 Bearer Token 访问实验服务 `/works/restaurant-ai/chat`。同一路径的 `GET` 只返回实时服务是否可用，由服务端受保护的 `/works/restaurant-ai/status` 判断；不可用时页面自动切换到明确标注的预置样例。`POST` 请求限制为角色、当前问题、最多八轮历史和本页已确认的演示草案 ID。服务只发送安全的工具进度标签与经校验的最终结果，不发送模型内部推理或原始工具参数。

主站代理限制输入大小和调用时长；本地开发使用进程内限流。Preview/Production 只有在配置独立 Redis REST 限流变量后才开放实时调用，限流失败时关闭实时调用。当前本地实施不代表公开服务已部署。

## 验收

```bash
cd apps/main
npm run lint
npm run typecheck
npm run build
cd ../../services/experiment-agents
uv run pytest -q
uv lock --check
```

Production 发布前需在 Vercel Preview 和 Production 分别验证四条路由、三条标准演示链路、来源展开、待确认操作、推荐追问和窄屏无横向溢出。

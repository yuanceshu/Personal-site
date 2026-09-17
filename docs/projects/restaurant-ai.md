# 食智助手 · 餐饮行业智能问答 Demo

状态：首版已接入主站，待 GitHub → Vercel Production 发布。

## 边界

这是行业 Demo 集下的二级作品，前端路由位于 `apps/main/app/works/demos/restaurant-ai/`，不建立独立 App 或独立 Vercel Project。公开路径为 `/works/demos/restaurant-ai`。

首版使用虚拟门店、制度、活动、财务规则和本地确定性检索，不接外部模型 API、数据库、POS、会员、外卖或财务系统。需求文档中的 PPT 不作为实施依据。

## 体验范围

- 顾客服务：门店信息、包间、停车、发票、会员、生日、儿童服务和预订；
- 运营助手：营销活动、差评、新品、采购、会员叠加和节假日准备；
- 财务助手：报销、发票、现金短款、日清日结、营业款、平台对账、成本和盘点。

每个场景支持快捷问题、检索等待状态、答案来源、原文抽屉、推荐追问、复制/反馈和未命中处理。

## 视觉方向

使用 `frontend-design` 建立“暖橙餐饮品牌 × 企业知识服务台”方向。首页强调三类使用角色，顾客端降低信息密度，运营和财务端增加知识库侧栏与规则信息密度。页面不依赖图片素材，不套用 Apple Design 视觉规范，也不新增 UI 依赖。

## 验收

```bash
cd apps/main
npm run lint
npm run typecheck
npm run build
```

Production 发布前需在 Vercel Preview 和 Production 分别验证四条路由、三条标准演示链路、来源抽屉、推荐追问和窄屏无横向溢出。

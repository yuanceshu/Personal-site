<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 静眠森 Web App 规则

## 作用域

本目录只承载静眠森网页和 `/api/jingmiansen/chat`；不承载主站、Project 000、现实身份信息或返回主站入口。静态浏览不得依赖角色服务可用。

## 按需读取

- 普通布局、样式或组件：只读相关源码和测试。
- 人物、故事、文案或角色交互：读取 `../../../../01_资料库/资料_静眠森/AGENTS.md` 后，只读它路由的直接来源。
- API、会话、隐私或服务安全：同时读取对应安全规范。
- 跨 App 路由、服务调用或部署拓扑：读取 `../../docs/00_架构说明.md`。

不得自行补写设定，也不得把原始 Word、未公开资料、现实姓名、主站域名、API Key、Agent URL 或 Secret 放进页面、客户端 bundle 或公开素材。浏览器只能通过本 App 的 Route Handler 访问角色服务。

## 检查

```bash
npm run lint
npm run typecheck
npm run build
```

涉及 Next.js API、路由、元数据或配置时，读取本目录 `node_modules/next/dist/docs/` 中直接相关的 Next 16 文档。

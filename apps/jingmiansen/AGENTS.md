<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 静眠森独立 App 规则

## 职责与路由

本目录只承载静眠森网页与 `/api/jingmiansen/chat`。正式页面路由固定为 `/`、`/xing-yue-xiang-hu`、`/witch-train`、`/rainy-night-cafe`；不要重新加入主站首页、Project 000、现实身份信息或返回主站入口。

## 内容与安全

修改人物、故事、文案或角色交互前，读取 `../../../../01_资料库/资料_静眠森/AGENTS.md` 及任务对应文档。不得自行补写设定，也不得把原始 Word、未公开资料、现实姓名、主站域名、API Key、Agent URL 或 Secret 放进页面、客户端 bundle 或公开素材。

浏览器只能通过本 App 的聊天 Route Handler 访问角色服务。角色范围固定为 `lingmian | felica | marina`；静态浏览不能依赖 Agent 服务可用。

## 检查

```bash
npm run lint
npm run typecheck
npm run build
```

涉及 Next.js API、路由、元数据或配置时，先读取本目录 `node_modules/next/dist/docs/` 的对应 Next 16 文档。

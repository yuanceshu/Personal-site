<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 主站局部路由

- 首页结构、Hero、Bento 或首页文案：读取 `../../docs/07_首页内容线与晨光首屏.md`。
- 某个作品页的行为或内容边界：只读取 `../../docs/projects/` 下对应规格。
- 共享页头、普通作品 UI、基础控件、动效或无障碍：读取 `../../docs/04_Apple设计与交互实施规范.md`。
- 内容分类、作品归属或 catalog metadata：读取 `../../docs/product/00_内容信息架构.md`。

未命中上述条件时，不读取其他作品规格、仓库架构、部署记录或 archive。具体实现以相关源码和测试为准。

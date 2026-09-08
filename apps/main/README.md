# Main App

个人作品站主应用，只承载现实身份首页与普通作品 Project 000。静眠森已迁移到相邻的 `apps/jingmiansen` 独立 App，角色服务位于 `services/jingmiansen-agents`。

## 路由

```text
/                   主站首页
/works/project-000  Project 000
```

主站通过 `JINGMIANSEN_SITE_URL` 提供静眠森单向外链，并把历史 `/works/jingmiansen/*` 地址永久 308 到独立站。链接设置 `referrerPolicy="no-referrer"`；主站不再包含静眠森页面、素材、聊天 API 或 Host 判断代理。

## 本地开发

```bash
cp .env.example .env.local
npm install
npm run dev
```

`.env.local`：

```dotenv
JINGMIANSEN_SITE_URL=http://localhost:3001
```

## 质量检查

```bash
npm run lint
npx next typegen
npm run typecheck
npm run build
```

架构和跨应用关系见仓库根目录 `docs/00_架构说明.md`。

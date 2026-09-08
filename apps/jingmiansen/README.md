# 静眠森 Web App

静眠森的独立 Next.js App。它承载森林入口、三条平级故事线与三名角色的实时自由对话，不承载主站首页、Project 000、现实身份元数据或返回主站入口。

## 正式路由

```text
/                    静眠森入口
/xing-yue-xiang-hu   星月相护
/witch-train         菲莉卡与魔女列车
/rainy-night-cafe    雨夜啡庭
/api/jingmiansen/chat 角色聊天代理
```

历史 `/works/jingmiansen/*` 地址在本 App 内也永久重定向到短路径。Production 允许收录并输出 canonical、robots 和 sitemap；Vercel Preview 为 `noindex`。

## 内容来源与身份边界

- 人物、世界、语言和安全规则来自 `../../../../01_资料库/资料_静眠森/`；
- 公开 App 只保存核对后的网页内容和压缩派生素材；
- 不加入现实姓名、主站域名、联系方式、主站导航或 Project 000 内容；
- 独立域名是普通访问路径上的发现边界，不是访问控制或绝对匿名。

## 本地开发

```bash
cp .env.example .env.local
npm install
npm run dev
```

默认访问 `http://localhost:3001`。实时对话需要先在 `services/jingmiansen-agents` 启动 AgentOS。

```dotenv
JINGMIANSEN_SITE_URL=http://localhost:3001
JINGMIANSEN_AGENT_URL=http://127.0.0.1:7777
JINGMIANSEN_AGENT_TOKEN=
```

本地服务未设置 Token 时两侧可留空；Vercel Preview 与 Production 必须使用相同的随机 `JINGMIANSEN_AGENT_TOKEN`。浏览器只调用本 App 的 API，不直接访问 AgentOS 或 MiniMax。

## 质量检查

```bash
npm run lint
npm run typecheck
npm run build
```

验收时还要检查四个短路由、SSE、刷新恢复、新对话、Preview noindex、Production canonical，以及公开 HTML/资源中不存在现实身份线索。

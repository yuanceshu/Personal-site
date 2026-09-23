# 袁策书的个人产品实验室

个人作品站代码仓库，采用单仓库、多应用和多个独立部署单元。当前状态见 [`docs/01_开发路线图.md`](docs/01_开发路线图.md)。

## 运行单元

```text
apps/main                    # 主站、普通作品与实验作品
apps/jingmiansen             # 静眠森独立 Next.js App
services/experiment-agents   # 工作台与行业实验 FastAPI 服务
services/jingmiansen-agents  # 静眠森专属角色服务
```

主站、静眠森 Web、静眠森角色服务和实验服务分别部署。静眠森在内容上属于个人作品体系，技术上保持独立域名、App 和角色服务；主站只保留入口和旧路径重定向。

## 本地启动

按任务只启动相关单元。环境变量参考各目录 `.env.example`；`.env` 与 `.env.local` 不提交。

```bash
cd apps/main
npm install
npm run dev

cd ../jingmiansen
npm install
npm run dev

cd ../../services/experiment-agents
uv sync --dev
uv run uvicorn experiment_agents.app:app --host 127.0.0.1 --port 8002 --no-access-log

cd ../jingmiansen-agents
uv sync --dev
uv run python -m jingmiansen_agents.app
```

主站默认 `http://localhost:3000`，静眠森默认 `http://localhost:3001`。服务端密钥、数据库和共享 Secret 只写入对应服务环境变量。

## 验证

```bash
cd apps/main
npm run lint
npx next typegen
npm run typecheck
npm run build

cd ../jingmiansen
npm run lint
npm run typecheck
npm run build

cd ../../services/experiment-agents
uv run pytest
uv lock --check

cd ../jingmiansen-agents
uv run pytest
uv lock --check
```

具体作品还应运行其 README 或当前规格列出的专项测试。

## 文档入口

代理协作规则见 [`AGENTS.md`](AGENTS.md)；按任务选择当前规格见 [`docs/README.md`](docs/README.md)。部署记录和 archive 只用于核对已发生事实或追溯历史，不参与普通任务的默认路由。

当前不建设博客、CMS、全站数据库、账号体系、跨设备同步、长期角色记忆或通用 AI 网关。

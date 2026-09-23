# Personal Site 仓库规则

本仓库是一个多应用、多部署单元的个人作品站 monorepo。上层 `../../AGENTS.md` 继续适用；本文件只补充仓库级规则。

## 运行单元

- `apps/main`：主站、普通作品和实验作品。
- `apps/jingmiansen`：静眠森独立 Web App。
- `services/experiment-agents`：工作台与行业实验服务。
- `services/jingmiansen-agents`：静眠森专属角色服务。

运行单元的当前拓扑见 `docs/00_架构说明.md`；不得从上述地图推导任务必须读取架构文档。

## 工作入口

1. 检查目标目录、当前差异和最近的 `AGENTS.md`。
2. 根据 `docs/README.md` 的触发条件，最多选择 1–2 份任务文档。
3. 直接检查相关源码、Schema、配置与测试；可执行实现优先于文档摘要。

未命中路由条件时，不读取整个 `docs/`、其他作品规格、部署记录或 archive。

## 仓库级不变量

- 主站、静眠森 Web、实验服务和静眠森角色服务保持各自的运行、密钥、数据和部署边界。
- 浏览器不得获得模型密钥、Agent Token、数据库凭据或任意上游地址。
- 不建立 CMS、账号系统、通用 AI 网关、共享业务数据库或大型设计系统，除非当前任务有已证实的需求。
- 事实、文案和公开素材需回溯对应资料包；不把模拟数据、本地验证或推测写成生产事实。

## 验证与文档

- 按变更所在 workspace 的 README、`package.json` 或 `pyproject.toml` 运行相关 lint、类型、测试、构建或锁文件检查。
- README 负责运行与入口；`docs/README.md` 负责路由；当前规格负责行为边界；部署记录和 archive 只作证据或追溯。
- 一个结论只维护一个 canonical location；router 只保留读取条件和链接。
- 除非用户明确要求或既有文档架构必须更新，不得为当前任务新建总结性 Markdown。

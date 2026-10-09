# Main App

个人作品站主应用，承载现实身份首页、Project 000、AI 工作台及行业 Demo 集。静眠森已迁移到相邻的 `apps/jingmiansen` 独立 App，角色服务位于 `services/jingmiansen-agents`。岛见已本地验证，尚未部署。

## AI 供暖服务 Demo（页面临时状态）

独立页面 `/works/demos/heating` 已按用户第四阶段要求加入既有 Demo 合集，并复用“返回 Demo 合集”组件。最新数据生命周期覆盖此前第一至四阶段的持久化设计：这是非生产用途的售前体验，刷新或重新打开即回到初始模拟数据。未修改其他 Demo 的存储、页面、导航或已有未提交改动。

### 聊天式 H5

蓝白色页面直接进入服务助手对话，首次发送后收起四条建议。手机和桌面使用同一最大720px对话结构；住户切换、异常模拟、重置和返回合集放入“演示设置”抽屉。仅支持文字输入，请求期间可以编辑下一条需求，不能并发发送。

可见对话与业务卡片绑定，最多60条消息，仅在本页内存保存；服务端snapshot校验最新业务，不覆盖可见办理过程。旧卡片保持当时结果且不能重复办理。缴费保留“确认账单，去付款”与“确认模拟支付”两次确认，第一步后由Agent准备下一步提案；材料清单同时列出两类材料，齐全判断仍由原Tool执行。

供暖SSE final新增可缺省的 `replyMode` 与 `focus:{houseIds,billIds,applicationIds,invoiceIds}`，Next按当前住户可信记录验证引用；卡片金额和状态读取校验后的snapshot，不使用模型文本值。初始query_records仅给Agent上下文，不全量展示。既有Agno服务需加载本次供暖协议与回复模板，模型配置保持原样；主站兼容旧字段缺省，本轮不部署服务。

助手透明PNG通过内置imagegen生成。提示词要点：棕色短发成年女性、蓝色服务外套、白色内搭、亲和简洁软3D插画、正面上半身、透明背景；无文字、耳麦、麦克风或装饰物。资产保存于 `public/projects/demos/heating/assistant.png`，在欢迎区和消息头像复用。

### 数据生命周期与适配层

首次打开页面，`POST /api/experiments/heating/session` 不携带状态包，服务端创建独立 A—F 模拟沙盒。后续调用由 H5 的组件 ref 持有不透明的 `demoState`，每次请求携带、接收并替换它，完整保留当前页面内的账单、订单、工单、审核事件、材料元数据、模拟发票和最近20条对话。对话查询及异常时“重新连接”只核对当前页，不清数据；浏览器刷新、关闭重开、离开后重进、BFCache 返回会初始化新数据。标签页、浏览器及访客分别独立，切换 A—F 只改变本页身份、清该身份的旧提案及对话，不删除本页其他住户的业务。

没有 Cookie 恢复、localStorage、sessionStorage、IndexedDB 或云端业务存储。供暖专用 Redis/SQLite 适配器、配置与跨部署持久化脚本已移除；其他作品的 Redis 限流等能力保留。没有新数据库、存储服务、依赖或文件上传凭据。过去的本地配置文件未被覆盖；其中旧 `HEATING_REDIS_*`、`HEATING_LOCAL_SQLITE_PATH`、`HEATING_STORAGE_NAMESPACE` 即使仍存在也不会被读取，可由用户手动移除。

`page-state.ts` 是轻量适配层：压缩模拟快照并用 AES-GCM 认证加密，客户端不能修改金额、审核结果或内部确认凭据。密钥仅在服务端；加密状态包只经 JSON/multipart 的业务字段传输，不塞入 URL、Cookie 或巨大的 HTTP Header。每次 API 在 AsyncLocalStorage 的请求作用域内创建一个独立 `RequestHeatingStore`，解包后通过原 `HeatingService`、Zod、状态机、确认绑定及幂等回执执行业务，再返回新的状态包。该 Store 只存在于本次请求，Vercel 不需要共享进程内存或本地文件；传入当前状态包时不会重新创建种子数据。

同一 Agno 对话的 Tool 调用依次传递更新后的状态包，Python 用请求内锁串行化工具，防止并行 Tool 的状态分支覆盖。状态包由代理侧持有，不加入模型提示词/历史或 Tool 业务证据；最终内部 SSE 返回状态包给主站，主站再次验证并完成对话。模型仍只负责意图、指代、追问、选择 Tool；原 TypeScript 引擎独自计算金额、校验材料、变更订单/工单和生成模拟票据。没有在 Python 或 H5 复制业务规则。

重要边界：这是单页面模拟，不是生产交易。业务幂等回执、确认摘要和状态机保留在认证状态包里；H5 串行处理操作并丢弃旧身份响应。同一页反复确认只展示一笔订单/发票。无数据库方案不提供恶意客户端重放旧状态包的全局撤销或跨请求分布式锁；多个外部客户端刻意复制状态包会各自形成模拟分支，不产生真实扣款、工单或共享访客数据。不能声称已具备生产支付的一致性、审计或账号授权。若未来接真实业务，应另行设计持久化与真实身份，当前不扩展。

### 运行与部署配置

复用现有 `services/experiment-agents`、Agno 和 MiniMax。主站已有 `EXPERIMENT_AGENT_URL`、`EXPERIMENT_AGENT_TOKEN` 即可使用；Token至少16字符时默认复用其派生的独立供暖加密 key，也可继续使用已有至少32字符的 `HEATING_SESSION_SECRET`。主站与实验服务的 Agent Token 必须一致，生产 URL 必须是稳定 HTTPS 地址。实验服务保留原 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`、`LLM_TIMEOUT_SECONDS`；密钥不进入浏览器或状态包。`HEATING_DEMO_ENABLED=0` 可以关闭供暖；未设置时启用，复制 `.env.example` 后需显式改为1。原主站其他生产变量保持不变。

从 `services/experiment-agents` 执行既有启动方式 `uv run uvicorn experiment_agents.app:app --host 127.0.0.1 --port 8002 --no-access-log`，再启动主站并打开 H5。不需要 Node SQLite 功能、不需要 Upstash，不创建资源或修改生产环境变量。

供暖 Tool 回调12秒、模型流程48秒、主站上游65秒、主站 Function90秒、H5等待95秒；对话租约100秒、内部签名委托120秒。需核对既有 Vercel 项目实际支持 Function 时限；Python原 Function75秒配置不变。SSE 发送实时处理进度与经过工具核实的最终结果，不逐字显示未核实的模型断言；网络或模型异常不会写隐藏的服务端业务，页面保留最后收到的有效状态并可继续查询/重试。

保护 Preview 如需跨服务调用，可在主站使用 `HEATING_AGENT_PROTECTION_BYPASS`（Agent项目的 automation bypass secret），以及主站平台提供的 `VERCEL_AUTOMATION_BYPASS_SECRET`（仅用于 Python→主站 Tool 回调）；都只走服务端 Header，不给 H5、模型或日志。公开 Production 不需要它们。Bearer与服务端签名委托继续校验。主站拒绝 Agent URL 中凭据/查询/片段，跨服务请求拒绝重定向。

### API 与确认

所有业务入口位于 `/api/experiments/heating`；前端使用同源 POST，不依赖 Cookie。请求除初次 session 外必须带最新 `demoState`，以及 `X-Heating-Demo:1`、当前 `X-Heating-Identity-Version` / `X-Heating-Generation`；JSON响应 `{result,demoState}`，业务结果仍以 `result` 为准。调用方在单页内顺序替换状态包，不持久化它。

| 接口 | 行为 |
| --- | --- |
| `POST session` `{}` | 初次初始化；带状态包与 `{userId:"B"}` 时切换本页住户；每次打开新页重新调用不带包的初始化 |
| `POST snapshot` `{demoState}` | 查询本页业务与对话，含待确认提案；支持业务中断后继续，浏览器刷新不会恢复 |
| `POST chat` `{message,requestId,demoState}` | Agno SSE status/final/error，final含新状态包、真实Tool cards和待确认proposal；不接受客户端actor/history |
| `POST confirm` `{proposalId,confirmed:true,demoState}` | 必须由用户明确点击；复核身份、摘要、材料、支付状态与幂等；模型说“确认”不能替代 |
| `POST action` / `POST confirmation` | 复用原确定性Tool、确认卡与业务契约，携带状态包，不直接相信浏览器金额/审核结论 |
| `POST tool` / `POST agent-action` | 服务端Token、签名身份、状态包与运行委托；Agent只查业务或准备提案，不能支付、提审、审批或重置 |
| `POST upload` multipart | `demoState`、applicationId、type、file；确认后临时校验文件，元数据进入当前页状态包，不保存原始字节/云文件 |
| `POST material` `{id,demoState}` | 身份验证后的固定模拟占位，不返回原始文件 |
| `POST restart` `{confirmed:true}` | 本页恢复初始场景，丢弃本页旧包，不影响其他页面、访客或Demo |
| `POST reset` | 原开发令牌控制保留，仅对随请求传入的供暖包操作；H5无需该令牌 |

材料只保存当前页的显示文件名、类型、大小、摘要与模拟提交记录。选文件仅用本地 blob预览，确认后才登记；图片内容不送模型，刷新后材料记录及预览全部清空。H5单文件上限4MiB，另给状态包/multipart留空间，总请求读入上限4.5MB；状态包压缩后最多256KB、解包最多4MiB，有认证与解压容量保护。

### 演示与验证

A待缴、B未绑定、C审核中、D补件、E已缴、F两房。B用虚构户号 `DEMO-H002`、姓名“演示住户B”、`DEMO-PHONE-B` 绑定。A正常费2125元，断暖演示费35%即743.75元，由Tool计算。正常缴费、断暖申请及支付互斥，重要建订单/模拟付款/提审分别确认。审核仍按服务端查询时的模拟时间推进（每级10秒），补件更新原工单；没有审核后台、真实文件审核或真实支付。

客户现场建议先A自然语言缴费并看发票，再切B绑定或F第二套房；刷新重新开始后，A办断暖并登记两类本地演示文件，提审后查审核、完成断暖缴费；D可直接展示退回与补件。需要重新开始时刷新页面，或打开“演示设置”，选择“恢复初始演示数据”并明确确认。不要在未完成业务时刷新。

```bash
npm run test:heating
npm run test:heating:browser
HEATING_LIVE_MODEL=1 npm run test:heating:live
HEATING_BROWSER_LIVE=1 npm run test:heating:browser
npm run lint
npm run typecheck
npm run build
```

浏览器测试在3216端口使用隔离源码与临时进程，保持用户现有开发服务不动；没有数据库文件。默认AI为测试替身，原TS Tool/API/确认与模拟审核真实执行；真实模式调用既有Agno/MiniMax配置。截图与测试日志位于忽略目录，不发布为客户端资源。批准部署后，可用 `HEATING_BROWSER_REMOTE=1 HEATING_VERIFY_ORIGIN=https://目标稳定域名 npm run test:heating:browser` 验证真实H5，目标需能直接访问；它只创建当前测试页模拟状态，不写云业务，但会调用模型。原跨部署持久化 prepare/resume 脚本已移除，验收改为同页连续业务及刷新重置。

2026-10-08本地验收：供暖专项27/27、主站TypeScript回归223/223、实验服务Python144/144、H5浏览器7/7（含独立浏览器、刷新、BFCache迟到响应、手机/桌面、材料与异常）；真实MiniMax/Agno/TS交互18轮及真实H5缴费1组通过。Lint为0错误（其他模块2项既有warning），Typecheck与生产Build通过。生产构建启动两个独立Next进程，在无供暖数据库配置下交替执行确认、支付、发票及新页初始化通过；该支付样本的压缩状态包约3.8KB，客户端构建未检出已配置的服务端密钥。真实Vercel线上尚未部署或验收；发布前须确认既有实验服务版本包含本次demoState传递协议，主站和Agent版本兼容。本轮未提交、推送、修改生产变量或部署服务，不混入其他未审核Demo改动。无数据库后不再提供Redis分布式限流；上线前可复用现有Vercel访问保护及供应商额度控制，不能把页面内幂等当成公网防滥用或总费用上限。不新增Redis仅用于限流，也不开通收费服务。

2026-10-09聊天重设计本地验收：供暖专项30/30、其他主站TypeScript回归196/196、实验服务Python147/147、最新H5 Mock浏览器8/8通过；真实MiniMax/Agno/TS业务闭环19轮及真实手机H5缴费、发票追问、刷新1/1通过。Lint零错误，其他模块仍有2项既有warning；Typecheck、生产Build与锁文件检查通过。四张390×844截图位于test-results/heating（mobile-home、payment-confirm、material-list、review-supplement）。真实调用曾间歇失败，复测通过；未取得可靠错误码，不能宣称已确认根因，失败页面未编造成功。Python增加了可信展示引用过滤，Next严格校验保持。验收仅在本地及真实模型服务调用中进行，未提交、推送或部署Vercel；发布时需同步主站与既有Agno的供暖展示协议。

## 路由

```text
/                   主站首页
/works/project-000  Project 000
/works/ai-solution-lab  AI 场景诊断工作台
/works/demos  行业 Demo 集
/works/demos/island-travel  岛见智能出行
/works/demos/linquan  林泉智能伴游
/works/demos/qintai-ticketing  琴台票务 · 武汉演出票务
/works/demos/finance-assistant  云川财务智能体
/works/demos/medical-ai  明川医院 AI 就医助手
/works/demos/heating  和煦供暖 AI 服务助手（已接入 Demo 合集）
/works/ui-lab  UI 实验室（8组19个桌面案例）
/works/ui-lab/[experiment]  双版本截图对照
/works/ui-lab/[experiment]/[variant]  单版本冻结交互查看器
/works/ai-life-comics  小麦子的生活漫画
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

## UI 实验室

2026-09-16完成本地验收，未部署。新增页面仅使用Apple Design；历史版本独立冻结，不随正式组件更新，不调用真实AI/交易、不需要环境变量。`npm run test:ui-lab` 检查清单与封存哈希；`npm run test:ui-lab:browser` 在本地3000端口运行交互验收（可用 `UI_LAB_TEST_URL` 指定其他地址）。主站构建不重新生成快照。来源、已知限制及全部验收见[实施记录](../../docs/projects/ui-lab.md)。

## 岛见

真实 AI 通过 `/api/experiments/island-travel/chat` 访问实验服务，配置沿用 `.env.example` 的 `EXPERIMENT_AGENT_URL` 与 `EXPERIMENT_AGENT_TOKEN`。本地无模型可主动切换演示模式；没有静默兜底。订单仅在当前页面内，不保存个人资料。

`npm run test:travel` 验证业务、契约和代理；`npm run test:travel:browser` 需要 localhost:3000 与本机 Chrome。生产限流使用 `.env.example` 中三个 `ISLAND_RATE_*` 服务端变量；生产构建在本地运行也不会绕过缺配置检查。开发模式 localhost 才使用本进程计数。详细边界见[岛见实现记录](../../docs/projects/island-travel.md)。

## 食智助手

四条 `/works/demos/restaurant-ai` 页面由主站承载；实时 Agent 经 `/api/experiments/restaurant-ai/chat` 转发到实验服务的 `/works/restaurant-ai/chat`。本地沿用 `EXPERIMENT_AGENT_URL` 和 `EXPERIMENT_AGENT_TOKEN`，实验服务沿用 `LLM_*` MiniMax 配置。页面可查看明确标注的预置样例。公网实时调用要求主站配置独立的 `RESTAURANT_RATE_REDIS_URL`、`RESTAURANT_RATE_REDIS_TOKEN` 和 `RESTAURANT_RATE_SALT`；缺少配置时关闭实时调用。全部门店、经营与财务数据都是虚构演示内容。

## 林泉

`/works/demos/linquan` 是主站行业 Demo 集中的景区智能伴游作品。路线、景点、活动、服务点、自然任务和模拟业务 Tool 在主站服务端确定性执行；可选的实时 Agent 只解释已执行结果，经 `/api/experiments/linquan/chat` 代理到实验服务，未配置或失败时继续使用规则回答。VisitorContext 与聊天历史仅保存在浏览器 localStorage，不使用 GPS、账号、数据库或真实景区系统。

实时 Agent 复用 `EXPERIMENT_AGENT_URL` 与 `EXPERIMENT_AGENT_TOKEN`。公开环境还需要独立的 `LINQUAN_RATE_REDIS_URL`、`LINQUAN_RATE_REDIS_TOKEN` 和 `LINQUAN_RATE_SALT`；缺少限流配置时不开放实时模型调用，规则 Demo 仍可用。详细行为与验收边界见[林泉实现记录](../../docs/projects/linquan.md)。

## 云川财务智能体

`/works/demos/finance-assistant` 直接承载原财务助手 Demo 的经营总览、智能分析、渠道对账和异常监测工作台。原有 TypeScript Finance Tool、Schema、虚构数据与结果卡片迁移到 `lib/works/finance-assistant`；页面保留原工作台 UI/UX。对话经 `/api/experiments/finance-assistant/chat` 代理到实验服务的 Agno Agent，Agent 只能调用六个确定性 Finance Tool，金额和对账关系由主站服务端计算。Tool 内部接口需要服务间 Token，浏览器不会获得凭据；未配置实验服务时，静态总览与对账页面仍可用。Vercel 公开环境还需要 `FINANCE_RATE_REDIS_URL`、`FINANCE_RATE_REDIS_TOKEN` 和 `FINANCE_RATE_SALT`，缺少配置时关闭实时模型调用。

## 明川医院 AI 就医助手

`/works/demos/medical-ai` 复用独立 Demo 已验证的就医旅程、Visit Context、业务 Tool、Medical/Hospital Knowledge、Safety Rules、Triage 和报告解释。状态保存在浏览器 localStorage，并在每次请求中恢复和返回，不依赖 Vercel 实例内存。确定性业务逻辑留在主站；回答润色经 `/api/experiments/medical-ai/chat` 转发到实验服务的 `/works/medical-ai/chat`，共用 `LLM_*` MiniMax 配置。

公网实时调用要求独立的 `MEDICAL_RATE_REDIS_URL`、`MEDICAL_RATE_REDIS_TOKEN` 和 `MEDICAL_RATE_SALT`；缺少配置时仍可体验规则 Demo。所有医院、患者、号源、费用、路线、检查和报告数据均为虚构演示内容。详细边界见[医疗 Demo 实现记录](../../docs/projects/medical-ai.md)。

## 琴台票务

`/works/demos/qintai-ticketing` 是主站行业 Demo 集中的武汉演出票务作品，分顾客购票侧与运营工作台两侧。库存、锁座、候补、改价、补货与活动护栏都在浏览器上用确定性 TypeScript 引擎执行；待审批提案同样只在浏览器内暂存与应用。可选的实时 Agent 只读当次界面投影、只产出待确认草案，经 `/api/experiments/qintai-ticketing/chat`（顾客侧）与 `/api/experiments/qintai-ticketing/merchant`（运营侧）代理到实验服务，未配置或失败时继续使用确定性回答。会话、锁座与聊天历史仅保存在浏览器 localStorage，不使用账号、数据库或真实票务系统。

实时 Agent 复用 `EXPERIMENT_AGENT_URL` 与 `EXPERIMENT_AGENT_TOKEN`。公开环境还需要独立的 `QINTAI_RATE_REDIS_URL`、`QINTAI_RATE_REDIS_TOKEN` 和 `QINTAI_RATE_SALT`；缺少限流配置时不开放实时模型调用，确定性 Demo 仍可用。演出、票档、订单与经营数据均为虚构演示内容。详细行为与验收边界见[琴台票务实现记录](../../docs/projects/qintai-ticketing.md)。

# 岛见与行业 Demo 集

状态：本地功能交付；2026-09-16 完成 UI UX Pro Max 山林版多页接入，尚未部署。历史 Frontend Design 版已在项目外归档。

## 依据与七项判断

遵循根 AGENTS、全站技术手册、长期定位、设计基线、04 交互实施规范与 06 实验作品规划；内容依据[资料说明](../../../../01_资料库/资料_行业AI产品实验室/02_子作品/岛见/作品说明.md)。2026-09-15 首轮视觉覆盖使用 `frontend-design`；当日最新决定仅岛见采用已认可的 `ui-ux-pro-max` 山林稿并补齐完整流程，合集保留旧设计。基础可用性、真实内容、安全和其他作品边界不变。下列七项为最初接入记录，最新改造见「UI UX Pro Max 山林版完整流程」章节。

1. 新增一级集合及其首个二级作品，既有课程、静眠森和工作台保留。
2. 主站 `app/works/demos`、作品专属 components/content/lib/styles；服务 `works/island_travel`。
3. 不拆 App，复用主站部署与实验服务，源 Vite 仅作参考。
4. 复用 React、Zod、Pydantic、OpenAI-compatible 客户端与测试依赖；不增加 npm/Python 依赖。
5. 浏览器保留确定性模拟交易；Next.js 校验、限流和代理；Python 只理解自然语言，密钥只在服务端。
6. 影响主站两入口、岛见及实验服务新接口；不改变其他作品数据与业务。
7. 独立 `feat/island-travel` 分支实施。

## 行为与接口

`/works/demos` 策展目录；`/works/demos/island-travel` 完整体验。真实城市、虚构班次、虚构乘客与模拟支付。刷新清空，不使用浏览器持久存储或业务数据库。纯前端状态机是用户确认的演示范围，不能迁作真实交易后端。

`POST /api/experiments/island-travel/chat` 代理到 `POST /works/island-travel/chat`，输入 message、conditions、最多16条 history；输出 mode=live、intent、conditions、reply、faq、selection。Pydantic 是权威，前端 Zod 校验。模型不能返回班次、金额、订单或支付状态；业务结果和 FAQ 由前端审核过的演示数据生成。乘客表单不发送给模型，自由文本中的长数字也拒绝发送。

AI 默认启用，错误保留输入并允许重试、取消或主动进入演示模式。缺项按出发地、目的地、日期顺序补问。日期按上海时区解释，模拟班次随查询日生成未来7天。支付失败允许原订单重试；支付未知只能查单；出票异常只重试出票，不重复支付；所有订单均可从列表回到处理流程。新行程只重置对话与当前选择，保留本页订单；刷新清空全部。

## 限流与配置

模型配置沿用实验服务。主站新增 `ISLAND_RATE_REDIS_URL`、`ISLAND_RATE_REDIS_TOKEN`、`ISLAND_RATE_SALT`：Upstash-compatible Redis REST 原子滑动窗口，每 IP 每600秒10次。仅存环境隔离的 HMAC IP 摘要、随机请求编号、时间戳，600秒过期，不存聊天或乘客信息。生产只信任 Vercel 覆写的客户端 IP 头，未配置/计数不可用时503关闭真实调用。仅非生产 localhost 开发用内存计数。此计数存储用于已确认的公网费用限制，不是业务数据库；上线需要配置资源并验收，不能声称本地测试等于公网限流完成。

依据：[Redis REST](https://upstash.com/docs/redis/features/restapi)、[Vercel 请求头](https://vercel.com/docs/headers/request-headers)。尚未创建外部资源或产生新服务订阅。

## 验收

2026-09-14 检查结果：

- `npm run test:travel`：9项通过，覆盖确认与幂等、库存/金额重算、异常状态转换、日期及输入边界、代理校验、限流协议和本地第11次429/窗口过期。
- `npm run test:travel:browser`：7项通过，覆盖四种支付结果及恢复、真实接口替身、拒绝模型票价幻觉、失败保留输入与显式模式切换、取消/旧响应隔离、订单列表/刷新清空、320px、键盘焦点和减少动态。
- 既有工作台：45项单测、10项浏览器测试通过；因首页新增同级卡片，只把旧测试的单一CSS定位改为指定工作台链接，不修改工作台业务。
- 主站 `lint`、`typecheck`、`build` 通过；两条页面静态预生成，聊天代理保持动态。
- 本地 `next start` 生产构建再次通过7项岛见浏览器测试；直接请求真实AI在未配限流资源时按预期503，页面与主动演示模式仍可用。这不是公网Redis实测。
- 实验服务 `uv run pytest -q`：70项通过（包括新增13项）；`uv lock --check` 通过。两条既有 Starlette/httpx/anyio 弃用警告保留，未为此升级无关依赖。
- 浏览器视觉检查：桌面首屏、班次/支付、集合页与320px确认页；首页在320、390、720、721、768、900、1024、1440px均无横向溢出，该巡检未捕获页面运行错误。
- 真实供应商共5次联调：三轮补问→两人明天上午→改成下午，经主站与Python接口分别约7.7/5.4/3.7秒；另两次由实际浏览器输入ISO日期、再说“选择第二班，两人”，正确打开第二班确认面板并保留两人。没有使用真实乘客资料，未写入原始响应或凭据。

测试输出及截图位于主站被忽略的 `test-results` 或本机临时目录，不作为公开素材。真实模型样本仅用于链路和关键多轮行为验证，不推断生产速度、成本或总体质量。

## 未完成的发布验收

1. 用户确认发布后，配置实际 Redis REST 计数资源及主站三个限流变量；目前只测协议替身和本地计数，未实测真实 Redis 脚本或公网多实例。
2. 先更新实验服务，再部署主站 Preview；核验同环境凭据、HTTPS、真实模型、超时、跨实例第11次429及10分钟恢复。工作台既有接口不受岛见限流保护。
3. 完成真实手机与公开素材复核后再发布 Production。首次接入未推送、部署、建立外部资源或改动外部原工程，当时使用 `feat/island-travel`；后续工作区状态见下方最新记录。

## 2026-09-16｜UI UX Pro Max 山林版完整流程

用户认可的独立稿为 `/Users/csyuan/.codex/tmp/island-uiux-fresh-Nz9a08`。本轮遵循 `ui-ux-pro-max`，延续炭绿、香槟、山林封面与旅行礼宾气质，不受更早的天空蓝、暖橙或 Frontend Design 页面约束。Skill 的产品设计检索用于确定克制、低密度与一致层级；其键盘、导航、响应式和对比度规则用于实施与验收。未照搬与此方向不符的玻璃效果，也未引入字体、动画或其他新依赖。

### 范围与路径

仅修改岛见，不重做行业合集、主站、AI 工作台或 UI 实验室。仍属于 `apps/main` 的一个作品，不新增 App、部署单元、服务、数据库或鉴权。

| 路由（相对 `/works/demos/island-travel`） | 页面职责 |
| --- | --- |
| `/` | 山林封面、直接查询表单、推荐班次、AI 规划入口 |
| `/plan` | 条件修改、班次选择、默认真实 AI 的对话规划 |
| `/confirm` | 核对行程、虚构乘客、明确勾选确认 |
| `/orders` | 本次会话订单与继续处理入口 |
| `/orders/[id]` | 模拟支付、结果、失败恢复与演示车票 |

新增作品布局和 `TravelProvider`；共用的 `TravelUI` 与步骤组件仅在岛见内部复用。状态保存在布局的浏览器内存：内部导航与前进/后退保留已查询条件、对话、选择及订单；刷新或离开后重新加载会清空，直达缺少状态的页面给出恢复入口。没有使用 localStorage、sessionStorage 或业务数据库。提交查询和离开对话页会取消旧 AI 请求，旧响应不能覆盖新行程。

首页查询直接使用已有确定性班次逻辑，不等待或调用模型。AI 契约、代理、限流、金额/库存计算、订单状态机和后端均未修改。创建订单必须明确确认；更改人数撤销确认；重复提交与返回同一确认页不会重复下单。支付未知只查单，出票异常只重试出票，支付失败沿用原订单。

样式限于 `.island-app`，文件为 `styles/projects/demos/island-travel.css` 和 `island-flow.css`。沿用已认可稿的 `rainforest.webp`（208,678 bytes），未重新生成图片；页面明确标注 AI 虚构景观。封面仅在首页出现，其余步骤使用统一页头、进度与清楚的主要操作。字体使用本地字体栈，无外部字体请求。

### 项目外旧版归档

绝对路径：`/Users/csyuan/Documents/Codex/作品设计归档/岛见-Frontend-Design-2026-09-15`。

- `source/`：替换前的主站完整源码环境，未从原项目复制 `.env`、凭据、依赖或构建缓存；归档副本随后独立安装依赖用于运行验证。
- `preview/`：完全本地化、无真实服务调用的旧版静态交互稿；只读复用已冻结的 UI 实验室旧版包，未修改其来源。
- `screenshots/`：1440px 与375px各6个流程状态，共12张；`verify.cjs` 检查静态流程、溢出、运行错误与外部请求。
- `README.md`：独立运行和按文件恢复说明；`source-sha256.json`：141个源码文件校验记录，交付前全部复核一致。

旧版源码独立启动后原7项浏览器测试通过；静态预览验证通过，无外部请求或页面错误。不要将静态预览当作正式业务源码，也不要用整份主站副本覆盖后续其他作品。

### 本轮验收

- 岛见9项单测、17项浏览器测试通过；同17项在本地 `next start` 生产构建再次通过。
- 覆盖首页无模型查询、AI 契约替身、多轮修改/选择、服务失败、取消/过期响应、敏感输入、明确确认/防重复、4种支付结果与恢复、列表、前进/后退、直达页和刷新清空。
- 320、375、768、1024、1440px全流程无横向溢出；812×375横屏通过。键盘切页焦点测试额外连续执行3轮通过，修正了延迟聚焦可能抢走按钮焦点的问题。
- 375px两倍文字、高对比度偏好与减少动态通过；8组实际纯色背景文字对比度至少4.5:1。桌面及手机各8个流程截图已生成并人工检查关键页面；这不替代真实手机或完整屏幕阅读器审计。
- AI 工作台45项单测、10项浏览器回归通过。主站 `lint`、`typecheck`、`build` 和 `git diff --check` 通过。
- 首页、规划、确认、订单列表静态预生成；动态订单URL服务端渲染后读取当前浏览器会话。没有新增运行依赖。

本轮 AI 联调用接口替身验证，未重新调用真实供应商或验证公网 Redis；历史供应商测试不等于本轮新联调。前述发布验收仍未完成。工作区当前为 `feat/ui-lab`，保留其他任务的未提交修改，未切换分支、提交、推送或部署。新截图保存在 `apps/main/test-results/island-new/`，不作为公开素材。

## 2026-09-15｜历史 Frontend Design 视觉

用户要求使用 `frontend-design` skill，从零设计，不把首轮页面作为参考，并撤销最初配色限制。本轮仅改变行业 Demo 集与岛见的视觉及必要交互反馈；保留模型契约、模拟数据、交易状态机和限流边界。不修改课程、静眠森或工作台的视觉。

设计方向：**岛屿旅行刊物 × 自助票务亭**。

- 色彩：暖纸 `#f6f4ec`、墨黑 `#22251e`、橘红 `#f15b35`。正文强调使用对比度更高的 `#b2381c`；橘红按钮采用黑字。成功/错误仍保持独立语义。
- 字体：标题用本地 Songti SC / Bodoni 72 / Didot 与衬线回退；操作和正文采用无衬线；票面时间及微标签采用等宽字体。不下载字体、不增加依赖。
- 布局：集合页改为大标题、全幅摄影展陈和项目索引；岛见由旅行封面、明确入口、三步进度、对话规划区和票夹组成。手机保持顺序阅读，选中班次时移至确认标题。
- 组件：方向星号、细分隔线、票夹撕口、虚线与不可扫描的装饰条码；金额、人数与确认按钮保持实用层级。真实AI默认、错误/取消/显式演示模式入口不隐藏。
- 动效：消息只做短距离淡入，封面轻微悬停放大，均服从减少动态偏好；没有背景粒子、玻璃层或额外动画依赖。

依 `frontend-design` 的自查要求，复核桌面、手机、键盘、焦点、等待/错误/禁用/支付恢复；修正窄屏下票夹伪元素的定位溢出。7项岛见浏览器测试与10项工作台浏览器回归通过；新断言包含三步进度与手机返回入口。320/390/600/768/850/900/1024/1440px的岛见初始和确认状态均无横向溢出；集合页同宽度无溢出。业务及接口未改变，沿用前述后端验证。

重设计后的主站54项单测、lint、类型检查与生产构建通过；页面仍静态生成。新图片正常解码，页面巡检未捕获运行错误。本轮未部署，前述公网限流资源与Preview验收仍待完成。

### 海岸创作图

使用内置 imagegen（非CLI）新生成图片，没有输入或引用旧页面。原始输出保留在本机生成目录，项目发布素材为 [coast-editorial.webp](../../apps/main/public/projects/demos/island-travel/coast-editorial.webp)，1536×1024，409,680 bytes；只做WebP压缩，Next Image负责响应式尺寸。图片说明和替代文本明确标注AI创作，不表示真实地理线路。

最终生成提示词：

> Use case: photorealistic-natural. Asset type: editorial travel website hero photograph, 1536x1024 landscape. Create an original photorealistic editorial image of a tropical island coastal road: an empty pale asphalt road curves gently from the bottom left toward a distant palm-covered headland, deep jade turquoise ocean on the right, cream surf on a narrow sandy shore, lush wind-bent coconut palms along the left edge. Elevated drone angle, but close enough to see road texture and soft palm shadows. Refined analog travel-magazine photography, subtle 35mm grain, warm late-afternoon sunlight, natural restrained color, crisp rich shadow details, calm sea. Strong graphic composition with an inviting curve and large uninterrupted ocean surface in upper right. No people, no vehicles, no road signs, no text, no logos, no watermark, no UI. This is a fictional island scene for a travel product, not an actual identifiable location. Not based on any previous conversation image. No illustration, no 3D render, no oversaturated postcard colors.

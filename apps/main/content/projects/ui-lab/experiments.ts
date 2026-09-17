import previews from "./previews.json";
import releases from "./releases.json";
import type { Preview, UiExperiment, UiVariant } from "./types";

const previewMap = previews as Record<string, { desktop: Preview; mobile: Preview }>;
const readyIds: string[] = releases;
const unknown = { value: "unknown" as const, note: "未记录" };
const comparisonNote = "这些历史版本的任务、反馈轮次、素材与功能范围没有完整受控记录。本页呈现设计选择，不将差异归因于单一模型或 Skill，也不作能力排名。";
const dimensions = ["视觉方向", "信息密度", "导航与流程组织", "组件语言", "字体与色彩", "动效倾向", "移动端策略", "主要优势", "主要代价", "适用场景"];
function variant(group: string, slug: string, skill: string | null, model: string, summary: string, interaction: string[], observations: string[], extra: Partial<UiVariant> = {}): UiVariant {
  const id = `${group}/${slug}`;
  const images = previewMap[id];
  return {
    id, slug, title: skill || "裸跑", model, modelVersion: null, reasoningEffort: null,
    skillMode: skill ? "skill" : "bare", skillName: skill, skillVersion: null,
    createdAt: null, frozenAt: "2026-09-15", promptSummary: summary, additionalConstraints: [],
    references: unknown, imageGeneration: unknown,
    sourceType: "frozen-static-snapshot", sourceEvidence: "用户确认模型与版本归属；本机实际源码已核对。原始 Prompt 未公开。",
    entryUrl: `/projects/ui-lab/experiments/${id}/index.html`,
    desktopPreview: images.desktop, mobilePreview: images.mobile,
    thumbnail: `/projects/ui-lab/previews/${id}/thumbnail.webp`,
    previewState: group === "dashboards" ? "初始总览 · 2026 年 / 全年；各版保留实际演示口径" : group === "ai-workbench" ? "经营分析结果 · 固定医院示例；功能与迭代条件不同" : "初始页面 · 未主动操作班次或弹窗；保留原版默认状态",
    viewportMode: "fluid", supportedViewports: ["1440px 桌面", "375px 手机原貌"],
    limitations: [
      ...(images.mobile.overflow ? ["原版在375px存在横向溢出，手机图只记录视口可见宽度；未修补布局。"] : []),
      ...(images.desktop.innerScroll || images.mobile.innerScroll ? ["页面含内部滚动区域；全页图不展开其折叠或滚动外内容，请进入体验查看。"] : []),
      "历史页面的字号、对比度与交互缺陷保留，不作为实验室外壳质量标准。",
    ],
    interactionSummary: interaction, assetDisclosure: "沿用原版本地素材与系统字体声明；素材生成过程未记录。全部业务数据为演示。",
    archiveChanges: ["复制必要文件，固定演示时间与随机序列", "添加离线隔离、冻结标识和就绪通知", "表单动作仅触发本地演示事件，不提交网络表单"],
    observations: Object.fromEntries(dimensions.map((name, i) => [name, observations[i]])),
    status: readyIds.includes(id) ? "ready" : "incomplete", ...extra,
  };
}
const dashBrief = "为城市通集团组织运营总览，呈现交通客流、消费与助老服务等演示指标，提供筛选与排行查看。";
const workBrief = "从业务需求出发，呈现理解、能力判断与可操作原型；各版覆盖的流程阶段不同。";
const travelBrief = "以虚构的岛见品牌组织海南出行，从出行意向到班次选择与行程确认。";
const dashInteractions = ["年度与月份筛选", "公交/地铁指标切换", "排行条目与详情", "图表提示"];
const dashboards = [
  variant("dashboards", "bare", null, "Luna", dashBrief, dashInteractions, ["深色数据大屏", "多区域密集同屏", "顶栏筛选，图表与排行分区", "发光边界、环图、柱图与排行行", "深蓝底，青色与紫色数据线", "图表指针提示与选中反馈", "保留原版窄屏布局，不重排数据", "关键领域可在同屏扫视", "细小文本和多区信息增加阅读负担", "熟悉指标的运营人员总览"], { viewportMode: "desktop-only" }),
  variant("dashboards", "dashboard", "Dashboard", "Luna", dashBrief, dashInteractions, ["后台管理台", "较高，采用卡片分组", "左侧常驻导航和顶部筛选", "侧栏、指标卡、图表面板", "墨绿深底与青绿强调", "按钮和数据选中反馈", "侧栏与主内容保留各自布局", "功能位置较固定，易于重复使用", "侧栏占据横向空间", "日常后台运营与指标巡检"]),
  variant("dashboards", "frontend-design", "Frontend Design", "Luna", dashBrief, dashInteractions, ["运营指挥舱", "高密度，多列分区", "顶部口径控制，主次图表并置", "细线网格、紧凑指标与排行", "深青背景、青绿与琥珀色", "悬停提示与轻微位移", "多列逐级收为单列", "指标区域具有鲜明分组", "手机页面更长，跨区比较需滚动", "展示型运营驾驶舱"]),
  variant("dashboards", "apple-design", "Apple Design", "Luna", dashBrief, dashInteractions, ["深灰运营面板", "卡片留白缓和密集数据", "全局筛选配合局部指标", "深灰圆角卡片与线性图表", "炭灰底，浅色数字与低饱和数据色", "轻量状态与悬停反馈", "沿用原有响应式规则", "区块边界和数字层级清楚", "细小图表标签仍需近距离阅读", "集中查看的日常运营面板"]),
  variant("dashboards", "ui-ux-pro-max", "UI UX Pro Max", "Luna", dashBrief, dashInteractions, ["深色运营监控", "高密度但强调区块层级", "全局条件与业务面板对应", "KPI、比例图、排行和详情", "深色背景与多类语义色", "筛选、选中及图表提示", "沿用原版断点和布局", "多种指标形式便于识别数据类型", "多色与多区块需要熟悉图例", "持续查看的运营状态面板"]),
];
// The source itself contains these display defects; do not silently repair history.
dashboards[0].limitations.push("原件在全年口径下部分交易指标显示0、排行出现NaN；原版与归档一致。筛选与排行交互可用，但不能据此作业务数据判断。");
const workbench = [
  variant("ai-workbench", "apple-design", "Apple Design", "Sol", workBrief, ["三个预设需求", "理解修正与条件调整", "能力选择与生成", "原型页面、筛选和示例操作", "上一版切换"], ["浅色产品工作台", "输入克制，结果逐层展开", "描述、确认、方案与原型三阶段", "表单、步骤、可操作原型", "系统字体、纸白与蓝色交互", "按压反馈、焦点移动与区域定位", "双区结果转为纵向阅读", "需求与原型可以来回调整", "固定示例不代表任意需求生成", "演示产品推导和迭代过程"], { archiveChanges: ["复制当前React、数据、纯逻辑、样式和身份素材", "Next图片/链接替换为本地静态适配", "真实诊断接口替换为既有确定性示例逻辑", "固定时间；添加离线边界、冻结标识与就绪通知"] }),
  variant("ai-workbench", "frontend-design", "Frontend Design", "Sol", workBrief, ["示例填入与反馈状态", "确认页场景选择", "三个结果页互相切换", "指标周期、查询、导购与营销示例交互"], ["编辑式方案档案", "文本与结果区并列，强调章节", "目录与五个流程页面独立跳转", "细线分区、编号、图表与表单", "暖浅底、深色正文与局部强调", "入口淡入、定位与模块提示", "桌面分区收为纵向长页", "三个业务方向可以独立浏览", "页面间不是完整数据驱动业务流", "讲解任务结构与结果形态"], { entryUrl: "/projects/ui-lab/experiments/ai-workbench/frontend-design/01-input.html" }),
  variant("ai-workbench", "ui-ux-pro-max", "UI UX Pro Max", "Sol", workBrief, ["深浅主题切换", "周期与分析区域切换", "查询示例与说明展开"], ["经营分析应用界面", "围绕单个结果集中组织", "直接进入医院经营分析结果", "分析卡、指标和局部操作", "浅色默认，可切深色", "主题与状态反馈", "分析区域随断点纵向排列", "快速进入分析结果", "没有原始输入和确认流程", "单一经营分析原型展示"]),
];
const island = [
  variant("island-travel", "frontend-design", "Frontend Design", "Astra 6", travelBrief, ["规则理解行程与补充条件", "查询班次和选择人数", "确认模拟订单", "模拟支付成功/失败/未知/出票异常", "订单查询与恢复"], ["旅行刊物与票务桌", "上方叙事，下方任务密集", "对话查询与旅程票夹协作", "大幅海岸图、班次卡与票券", "暖纸、墨黑与橘红", "焦点定位与局部状态反馈", "对话和票夹由并列转纵向", "查询到异常恢复形成完整模拟流程", "对话区域和订单区域需要往返关注", "演示带异常恢复的出行产品"], { imageGeneration: {value:"yes",note:"海岸创作图，非真实线路；项目设计记录可核验。"}, assetDisclosure:"海岸图为 AI 创作，品牌、班次、票价和订单均为演示。", archiveChanges:["复制当前React、领域逻辑、数据、CSS和图片", "固定规则演示，移除真实AI请求及模式选项", "本地图片与链接适配；固定演示日期与订单标识", "添加离线隔离、冻结标识与就绪通知"] }),
  variant("island-travel", "ui-ux-pro-max", "UI UX Pro Max", "Astra 6", travelBrief, ["目的地、时段与1–4位成人", "三班预设行程", "票价合计", "确认弹窗与完成反馈"], ["静谧旅行礼宾", "摄影与留白占比较大", "条件表单、班次清单与行程摘要", "全幅山林图、水平行程行", "炭绿、香槟色与衬线英文", "克制悬停、弹窗与完成反馈", "导航简化，班次和摘要纵向组织", "条件和费用直接可见", "预设行程不含对话、订单和支付状态机", "聚焦选班和确认的旅行概念展示"], { title:"UI UX Pro Max · Study 03", createdAt:"2026-09-15", references:{value:"no",note:"随稿说明记录：不读取或复用前版代码、截图、图片；沿用虚构品牌与出行命题。"}, imageGeneration:{value:"yes",note:"随稿说明记录独立生成山林图，无参考图。"}, assetDisclosure:"山林图为 AI 生成的虚构景观，非实地摄影；保留原版的本地字体回退声明。" }),
];
function experiment(id: string, number: string, title: string, subtitle: string, category: UiExperiment["category"], variants: UiVariant[], defaults: [string,string], featured: string[], briefSummary: string): UiExperiment {
  return {id:number,slug:id,title,subtitle,category,variants,description:subtitle,briefSummary,comparisonLevel:"showcase",comparisonNote,defaultVariantIds:defaults,featuredVariantIds:featured,coverImage:variants[0].thumbnail};
}
export const experimentArchive: UiExperiment[] = [
  experiment("dashboards","01","城市通数据驾驶舱","同一组运营指标，五种信息组织方式。","dashboard",dashboards,["bare","frontend-design"],["bare","frontend-design","apple-design"],dashBrief),
  experiment("ai-workbench","02","AI 场景工作台","从模糊需求，到可以讨论的产品草稿。","ai-workbench",workbench,["apple-design","frontend-design"],["apple-design","frontend-design","ui-ux-pro-max"],workBrief),
  experiment("island-travel","03","岛见智能出行","一句出发，或一次选择：两种行程体验。","travel",island,["frontend-design","ui-ux-pro-max"],["frontend-design","ui-ux-pro-max"],travelBrief),
];
export const experiments = experimentArchive.map(e=>({...e,variants:e.variants.filter(v=>v.status==="ready")})).filter(e=>e.variants.length>=2);
export function getExperiment(slug: string) { return experiments.find(e=>e.slug===slug); }
export function skillLabel(v: UiVariant) { return v.skillMode==="bare" ? "裸跑" : v.skillName ?? "未记录"; }
export function resolvePair(e: UiExperiment, left: string | null, right: string | null): [string,string] {
  return left!==right && e.variants.some(v=>v.slug===left) && e.variants.some(v=>v.slug===right) ? [left!,right!] : e.defaultVariantIds;
}
export function changePair(pair: [string,string], side: 0 | 1, value: string): [string,string] {
  if(value===pair[1-side]) return [pair[1],pair[0]];
  return side===0 ? [value,pair[1]] : [pair[0],value];
}
export function pairQuery(pair: [string,string]) { return new URLSearchParams({left:pair[0],right:pair[1]}).toString(); }
export function scrollRatio(top: number, total: number, visible: number) { return total>visible ? Math.max(0,Math.min(1,top/(total-visible))) : 0; }

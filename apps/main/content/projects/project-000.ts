export const projectFacts = [
  { label: "城市", value: "4 座" },
  { label: "学员", value: "339 名" },
  { label: "研发投入", value: "近 160 小时" },
  { label: "标准单场", value: "210 分钟" },
];

export const workScenes = [
  {
    title: "材料很多，汇报仍然没有重点",
    detail: "知道 AI 能总结，却不知道怎样让它围绕数据、变化和决策来组织答案。",
  },
  {
    title: "表格、文档和会议每天都在重复",
    detail: "工具听起来很新，但学员看不见它与自己今天工作的关系。",
  },
  {
    title: "听懂一个方法，不等于明天会用",
    detail: "如果课堂只有演示，理解会停在教室里，无法成为一次真实行动。",
  },
];

export const collaborators = [
  {
    name: "张蕴",
    role: "银商天工一线演示",
    contribution: "把内部工具放进真实业务操作，而不是功能清单。",
  },
  {
    name: "郭沁雅",
    role: "文字工作场景",
    contribution: "梳理日常文字任务，并写出《老赵的一天》脚本。",
  },
  {
    name: "陈捷",
    role: "Excel 与数据场景",
    contribution: "用一线数据处理任务说明 AI 如何辅助思考。",
  },
  {
    name: "袁策书",
    role: "组长与课程整合",
    contribution: "负责结构、课件、逐字稿、视频包装、互动、排练与四地交付。",
  },
];

export const courseTimeline = [
  {
    minutes: 10,
    label: "开场",
    detail: "建立共同问题：AI 为什么总给出正确却不可用的回答。",
    kind: "frame",
  },
  {
    minutes: 40,
    label: "内部工具",
    detail: "让学员先看见离自己最近的工作入口。",
    kind: "context",
  },
  {
    minutes: 85,
    label: "外部文字工具",
    detail: "35 分钟演示、5 分钟笔记与安全、25 分钟练习、10 分钟中场、10 分钟补充场景。",
    kind: "core",
  },
  {
    minutes: 25,
    label: "多模态工具",
    detail: "保留足够建立想象的内容，不追求工具数量。",
    kind: "context",
  },
  {
    minutes: 50,
    label: "练习、总结与展望",
    detail: "30 分钟小组任务、15 分钟互动总结、5 分钟资源与下一步。",
    kind: "action",
  },
] as const;

export const scopeDecisions = [
  {
    label: "先定义目标",
    title: "从讲完知识，改成明天用一次",
    reason: "课程面对的是工作中的普通员工，最重要的不是知道更多，而是看见一个可以马上开始的场景。",
  },
  {
    label: "重新组队",
    title: "把真实做过的人放进真实场景",
    reason: "有人更熟悉内部工具，有人更熟悉文字工作和数据处理；按优势分工，课程才不会只剩一个人的想象。",
  },
  {
    label: "主动删减",
    title: "把容易过时的内容先放下",
    reason: "工具更新太快，讲得越多越容易过时；文字类工作场景反而更接近日常，应该先保住。",
  },
  {
    label: "最后保护",
    title: "练习、互动与表达",
    reason: "三个半小时里，学员需要一次自己开口、自己动手、自己说出准备怎么用的机会。",
  },
] as const;

export const designCases = [
  {
    index: "01",
    title: "先让学员在《老赵的一天》里看见自己",
    description:
      "故事来自一线工作：手续费测算、材料汇总、会议和回复不断挤进同一天。课程先问“哪一幕像你”，再进入工具。",
  },
  {
    index: "02",
    title: "让一线老师进入课程，而不是由一个人讲完",
    description:
      "多位老师录制真实操作，统一剪辑、字幕与配乐。重点不是视频形式，而是由真正做过这件事的人讲场景。",
  },
  {
    index: "03",
    title: "按注意力曲线安排听、做与表达",
    description:
      "高认知负荷内容放在前半程；后半程逐步切换到跟做、小组任务和分享，用行动收束课程。",
  },
];

export const cities = [
  {
    city: "厦门",
    date: "2026.03.11",
    people: "111 人",
    image: "/projects/project-000/cities/xiamen.jpg",
    alt: "厦门站课程现场，学员在会场听课",
    release: "第一次真实发生",
    observation: "互动比预期更自发，课后仍有人继续讨论 AI 用法。",
    change: "下一场把时间节点收得更紧，也把逐字稿从书面表达改得更口语。",
  },
  {
    city: "河南",
    date: "2026.03.13",
    people: "86 人",
    image: "/projects/project-000/cities/henan.jpg",
    alt: "河南站课程现场，学员面向讲台就座",
    release: "3 小时压缩版",
    observation: "分享开始从“工具好玩”走向拆解自己的工作流程。",
    change: "在最低时长里保护完整体验，继续减少不必要的内容切换。",
  },
  {
    city: "山西",
    date: "2026.04.27",
    people: "54 人",
    image: "/projects/project-000/cities/shanxi.jpg",
    alt: "山西站课程现场，学员围坐参与互动",
    release: "加入感言卡",
    observation: "有学员现场下载语音输入工具并马上体验，安静的书面反馈也开始被看见。",
    change: "从第三场加入感言卡，让课堂气氛之外的感受也能留下来。",
  },
  {
    city: "广西",
    date: "2026.06.12",
    people: "88 人",
    image: "/projects/project-000/cities/guangxi.jpg",
    alt: "广西站课程现场，讲师在学员中进行互动",
    release: "第四次发生",
    observation: "演示出现巧思时，会场会同步发笑；讲授状态也终于更松弛。",
    change: "删掉热度消退的内容，让案例与点评继续贴近真实工作。",
  },
] as const;

export const reusableAssets = [
  "完整课件与逐字稿",
  "一线操作视频与统一包装",
  "小组任务、互动流程与点评框架",
  "加分卡、奖状与感言卡",
  "四场时间节点和复盘记录",
];

export const shortcomings = [
  "点评有时仍停在“很不错”的泛泛肯定，没有继续追问到方法。",
  "多个活动本质上仍以分享为主，互动形式还不够多样。",
  "现场引导依赖充分准备，临场追问与收束仍需要持续练习。",
  "下一轮需要先做更多一线场景研究，再决定新增什么内容。",
];

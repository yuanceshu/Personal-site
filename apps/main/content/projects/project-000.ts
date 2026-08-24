export const projectFacts = [
  { label: "城市", value: "4 座" },
  { label: "学员", value: "339 名" },
  { label: "研发投入", value: "近 160 小时" },
  { label: "标准单场", value: "210 分钟" },
];

export const workScenes = [
  {
    title: "材料一大堆，汇报还是没有重点",
    detail: "明知道 AI 会总结，却不知道怎么让它围着数据、变化和决策来组织答案。",
  },
  {
    title: "表格、文档和会议每天都在重复",
    detail: "工具听着挺新，可就是看不出它跟自己今天这摊活儿有什么关系。",
  },
  {
    title: "听懂一个方法，不等于明天会用",
    detail: "要是课堂只剩演示，理解就全留在教室里了，成不了一次真行动。",
  },
];

export const collaborators = [
  {
    name: "张蕴",
    role: "银商天工一线演示",
    contribution: "把内部工具放进真实的业务操作里，而不是只念功能清单。",
  },
  {
    name: "郭沁雅",
    role: "文字工作场景",
    contribution: "梳理日常文字任务，并写出《老赵的一天》脚本。",
  },
  {
    name: "陈捷",
    role: "Excel 与数据场景",
    contribution: "拿一线数据处理的任务，讲清楚 AI 怎么帮人思考。",
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
    detail: "先抛出一个大家都碰到过的问题：AI 为什么总给出正确却用不上的回答。",
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
    detail: "留够能让人建立想象的内容，不去拼工具数量。",
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
    reason: "这门课面对的是天天上班的普通人，最要紧的不是知道得更多，而是看见一个马上就能上手的场景。",
  },
  {
    label: "重新组队",
    title: "把真实做过的人放进真实场景",
    reason: "有人熟内部工具，有人熟文字活儿和数据处理；照着各自的长处分工，课才不会只剩我一个人的想象。",
  },
  {
    label: "主动删减",
    title: "把容易过时的内容先放下",
    reason: "工具更新太快，讲得越多越容易过时；倒是文字类的活儿更贴近日常，得先保住。",
  },
  {
    label: "最后保护",
    title: "练习、互动与表达",
    reason: "三个半小时里，得给学员留一次机会，让他自己开口、自己动手、自己说清楚准备怎么用。",
  },
] as const;

export const designCases = [
  {
    index: "01",
    title: "先让学员在《老赵的一天》里看见自己",
    description:
      "故事来自一线：手续费测算、材料汇总、开会、回消息，全挤在同一天。课里先问一句“哪一幕像你”，再进工具。",
  },
  {
    index: "02",
    title: "把一线老师请进课堂，而不是我一个人讲到底",
    description:
      "几位老师各自录下真实操作，再统一剪辑、配字幕、配乐。要紧的不是视频这种形式，是让真正干过这件事的人来讲场景。",
  },
  {
    index: "03",
    title: "按注意力曲线安排听、做与表达",
    description:
      "最费脑子的内容放前半程；后半程慢慢转到跟着做、小组任务和分享，用行动把课收住。",
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

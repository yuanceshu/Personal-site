import { getWork, type WorkCategory } from "@/content/projects/catalog";

export type HomeSection = {
  id: string;
  /** 完整板块名，用作可访问名称（aria-label） */
  label: string;
  /** 弱化的前缀标签，保留各板块实际命名，如 "AI +"、"AI ×"、"AI 与"、"AI" */
  prefix: string;
  /** 承担主要视觉重心的中文核心词，如 行业、实验、思记 */
  topic: string;
  /** 卡内文案，按用户原始文案逐行保留 */
  lines: readonly string[];
};

/** 首页板块顺序即锚点导航顺序：行业 → 实验 → 创造 → 授课 → 思记 */
export const homeSections: readonly HomeSection[] = [
  {
    id: "industry", label: "AI + 行业", prefix: "AI +", topic: "行业",
    lines: [
      "这里是行业 demo 合集。",
      "AI 给售前带来的一大幸事，是面对各行业客户，能快速构建 Demo。",
      "直观，促成签单。",
    ],
  },
  {
    id: "experiments", label: "AI × 实验", prefix: "AI ×", topic: "实验",
    lines: [
      "这里，有我做的 AI 产品小工具，",
      "和出于好奇而做的，关于模型和 Skill 的实验。",
    ],
  },
  {
    id: "creation", label: "AI & 创造", prefix: "AI &", topic: "创造",
    lines: [
      "一名 ACGer 的造梦欲有多大？",
      "这里，有我创造或遇到的角色，也许你可以和他聊聊那些平行世界里的事儿。",
      "或者，直接去读读他们的生平。",
      "你一定想不到，区区豆包的笔触，竟也能如此细腻、温暖。",
    ],
  },
  {
    id: "teaching", label: "AI 与授课", prefix: "AI 与", topic: "授课",
    lines: [
      "作为内训师，我会帮学员上手 AI。",
      "我享受把复杂内容拆解到小白可吃的过程。",
    ],
  },
  {
    id: "thoughts", label: "AI 思记", prefix: "AI", topic: "思记",
    lines: [
      "所行，所思。",
      "不定期分享，朴素输出。",
    ],
  },
];

type Experiment = {
  workId: string;
  /** 卡片标题；缺省时使用作品目录中的标题 */
  title?: string;
  description: string;
  image: string;
  alt: string;
};

export const experiments: readonly Experiment[] = [
  {
    workId: "ai-solution-lab", title: "原型工作台",
    description: "将一句话的模糊需求，细化成可交互原型。",
    image: "/home/morning/workbench-preview.webp",
    alt: "AI 工作台的实际界面：从业务想法开始梳理需求",
  },
  {
    workId: "ui-lab", title: "UI 实验室",
    description: "不同模型和 Skill，会组合出怎样的页面？",
    image: "/home/morning/ui-lab-preview.webp",
    alt: "UI 实验室的实际界面：并排比较同一工作台的两种设计方法",
  },
  {
    workId: "ai-life-comics", title: "亲子漫画",
    description: "孩子生活里的点滴，编织成一格格漫画。",
    image: "/projects/ai-life-comics/nose/nose-magic.webp",
    alt: "小麦子的生活漫画：把洗鼻子画成一场彩虹冒险",
  },
];

export const homeWorkIds = {
  industry: "demos",
  teaching: "project-000",
  creation: "jingmiansen",
} as const satisfies Record<Exclude<WorkCategory, "experiment">, string>;

export function getHomeWork(id: string, category: WorkCategory) {
  const work = getWork(id);
  if (work.category !== category) {
    throw new Error(`Work ${id} is not in the ${category} category`);
  }
  return work;
}

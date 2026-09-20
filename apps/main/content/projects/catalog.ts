export type WorkCategory = "industry" | "teaching" | "experiment" | "creation";

export type WorkMeta = {
  id: string;
  title: string;
  category: WorkCategory;
  href: string;
  parentId?: string;
  linkType?: "internal" | "standalone-app";
};

/**
 * Content-level work metadata. This registry does not determine App or
 * service ownership; it only describes how works are presented together.
 */
export const works: readonly WorkMeta[] = [
  {
    id: "demos",
    title: "行业 Demo 集",
    category: "industry",
    href: "/works/demos",
  },
  {
    id: "island-travel",
    title: "岛见",
    category: "industry",
    href: "/works/demos/island-travel",
    parentId: "demos",
  },
  {
    id: "restaurant-ai",
    title: "食智助手",
    category: "industry",
    href: "/works/demos/restaurant-ai",
    parentId: "demos",
  },
  {
    id: "project-000",
    title: "Project 000",
    category: "teaching",
    href: "/works/project-000",
  },
  {
    id: "ai-solution-lab",
    title: "AI 工作台",
    category: "experiment",
    href: "/works/ai-solution-lab",
  },
  {
    id: "ui-lab",
    title: "UI 实验室",
    category: "experiment",
    href: "/works/ui-lab",
  },
  {
    id: "ai-life-comics",
    title: "小麦子的生活漫画",
    category: "experiment",
    href: "/works/ai-life-comics",
  },
  {
    id: "jingmiansen",
    title: "静眠森",
    category: "creation",
    href: "/works/jingmiansen",
    linkType: "standalone-app",
  },
];

const workById = new Map(works.map((work) => [work.id, work]));

export function getWork(id: string): WorkMeta {
  const work = workById.get(id);
  if (!work) throw new Error(`Unknown work metadata: ${id}`);
  return work;
}

export function getWorksByCategory(category: WorkCategory): readonly WorkMeta[] {
  return works.filter((work) => work.category === category);
}

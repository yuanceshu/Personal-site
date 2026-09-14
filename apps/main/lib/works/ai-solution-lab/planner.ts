import { capabilities } from "@/content/projects/ai-solution-lab/catalog";
import {
  prototypeSchema,
  type Brief,
  type Diagnosis,
  type PrototypeSpec,
  type ComponentSpec,
  type CapabilityId,
  type DataRef,
} from "./schema";

export function datasetFor(brief: Brief): DataRef {
  if (brief.scenario === "analytics")
    return {
      healthcare: "healthcare_metrics",
      retail: "retail_metrics",
      general: "generic_metrics",
    }[brief.industry] as DataRef;
  return brief.scenario === "retail" ? "retail_catalog" : "campaign_samples";
}
export function diagnoseExample(
  brief: Brief,
  selected: CapabilityId[] = [],
): Diagnosis {
  const ids = (Object.keys(capabilities) as CapabilityId[]).filter(
    (id) =>
      capabilities[id].scenario === brief.scenario &&
      (brief.aiPreference !== "none" || id !== "data_query") &&
      (!selected.length || selected.includes(id)),
  );
  return {
    summary: `围绕「${brief.users}」希望「${brief.goal}」的目标，先验证以下最小能力。`,
    capabilities: ids.map((id) => ({
      id,
      approach:
        brief.aiPreference !== "none" && capabilities[id].ai
          ? "hybrid"
          : "software",
      reason:
        brief.aiPreference !== "none" && capabilities[id].ai
          ? "语言理解与表达可提供辅助，但需要数据和人工判断支撑。"
          : "用明确规则实现，避免引入模型不确定性。",
      prerequisite: brief.conditions || "先确认数据与允许访问的范围。",
    })),
    risks: [
      "这是预设演示，业务效果尚未验证。",
      "实际落地前需确认数据口径、权限和审核责任。",
    ],
  };
}
const componentCapability: Record<ComponentSpec["type"], CapabilityId[]> = {
  Metrics: ["monitoring_dashboard"],
  Trend: ["monitoring_dashboard", "data_analysis"],
  Records: ["monitoring_dashboard", "data_analysis"],
  Insight: ["data_analysis", "recommendation", "content_generation"],
  Query: ["data_query"],
  Recommendations: ["recommendation", "guided_service"],
  BriefForm: ["content_generation"],
  Document: ["content_generation"],
};
export function validateDiagnosis(
  brief: Brief,
  diagnosis: Diagnosis,
  selected: CapabilityId[] = [],
) {
  const ids = diagnosis.capabilities.map((c) => c.id);
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    brief.scenario === "unsupported"
  )
    throw new Error("能力不可重复或为空");
  if (
    selected.length &&
    (new Set(selected).size !== selected.length ||
      ids.length !== selected.length ||
      selected.some((id) => !ids.includes(id)))
  )
    throw new Error("未按所选能力生成");
  for (const c of diagnosis.capabilities) {
    if (capabilities[c.id].scenario !== brief.scenario)
      throw new Error("能力与场景不匹配");
    if (brief.aiPreference === "none" && c.approach !== "software")
      throw new Error("用户已禁用AI");
    if (
      ["monitoring_dashboard", "guided_service"].includes(c.id) &&
      c.approach !== "software"
    )
      throw new Error("确定性能力不应交给AI");
    if (c.id === "data_query" && c.approach !== "hybrid")
      throw new Error("自然语言问数需要AI");
  }
  return diagnosis;
}
export function validatePrototype(
  brief: Brief,
  diagnosis: Diagnosis,
  value: unknown,
): PrototypeSpec {
  validateDiagnosis(brief, diagnosis);
  const spec = prototypeSchema.parse(value);
  const selected = new Map(diagnosis.capabilities.map((c) => [c.id, c]));
  const expected = {
    analytics: "analytics_workspace",
    retail: "guided_service",
    marketing: "ai_workspace",
    unsupported: "",
  }[brief.scenario];
  for (const p of spec.pages) {
    if (p.template !== expected) throw new Error("模板与场景不匹配");
    for (const c of p.sections.flatMap((s) => s.components)) {
      if (
        !selected.has(c.capability) ||
        !componentCapability[c.type].includes(c.capability)
      )
        throw new Error("原型与诊断不匹配");
      if (c.dataRef !== datasetFor(brief))
        throw new Error("数据引用与行业不匹配");
      if (
        ["Insight", "Query"].includes(c.type) &&
        selected.get(c.capability)?.approach !== "hybrid"
      )
        throw new Error("普通方案包含AI组件");
    }
  }
  const elements = spec.pages.flatMap((p) =>
    p.sections.flatMap((s) => s.components),
  );
  const types = elements.map((c) => c.type);
  if (
    brief.scenario === "marketing" &&
    (!types.includes("BriefForm") || !types.includes("Document"))
  )
    throw new Error("缺少营销输入或输出");
  if (brief.scenario === "retail" && !types.includes("Recommendations"))
    throw new Error("缺少导购流程");
  for (const id of selected.keys())
    if (!elements.some((c) => c.capability === id))
      throw new Error("能力缺少模块");
  return spec;
}
// Offline examples only. Live fallback is owned by the Python service.
export function buildPrototype(
  brief: Brief,
  diagnosis: Diagnosis,
): PrototypeSpec {
  validateDiagnosis(brief, diagnosis);
  const sections = new Map<
    PrototypeSpec["pages"][number]["sections"][number]["slot"],
    ComponentSpec[]
  >();
  const add = (
    slot: Parameters<typeof sections.set>[0],
    type: ComponentSpec["type"],
    title: string,
    capability: CapabilityId,
  ) => {
    const component = {
      id: `${capability.replaceAll("_", "-")}-${type.toLowerCase()}`,
      type,
      title,
      capability,
      dataRef: datasetFor(brief),
    };
    sections.set(slot, [...(sections.get(slot) ?? []), component]);
  };
  for (const c of diagnosis.capabilities) {
    if (c.id === "monitoring_dashboard") {
      add("overview", "Metrics", "关键指标", c.id);
      if (!diagnosis.capabilities.some((item) => item.id === "data_analysis"))
        add("main", "Trend", "指标趋势", c.id);
      add("main", "Records", "每日明细", c.id);
    } else if (c.id === "data_analysis") {
      add("main", "Trend", "变化观察", c.id);
      if (c.approach === "hybrid")
        add("assistance", "Insight", "异常观察与解释", c.id);
    } else if (c.id === "data_query")
      add("assistance", "Query", "问一问数据", c.id);
    else if (c.id === "recommendation" || c.id === "guided_service")
      add("main", "Recommendations", capabilities[c.id].name, c.id);
    else {
      add("input", "BriefForm", "活动输入", c.id);
      add("output", "Document", "方案草稿", c.id);
    }
  }
  return validatePrototype(brief, diagnosis, {
    appTitle: brief.title,
    pages: [
      {
        id: "overview",
        title: "产品草稿",
        template: {
          analytics: "analytics_workspace",
          retail: "guided_service",
          marketing: "ai_workspace",
        }[brief.scenario as "analytics" | "retail" | "marketing"],
        sections: [...sections].map(([slot, components]) => ({
          slot,
          components,
        })),
      },
    ],
  });
}

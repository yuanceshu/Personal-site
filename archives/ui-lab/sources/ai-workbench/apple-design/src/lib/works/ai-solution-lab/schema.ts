import { z } from "zod";

// Match Pydantic/JSON Schema character counts, including supplementary Unicode.
function boundedText(min: number, max: number, trim = false) {
  const schema = trim ? z.string().trim() : z.string();
  return schema.refine((value) => {
    const length = [...value].length;
    return length >= min && length <= max;
  }, `文字长度应为 ${min}–${max} 个字符`);
}
const text = boundedText(1, 600, true);
export const scenarioSchema = z.enum([
  "analytics",
  "retail",
  "marketing",
  "unsupported",
]);
export const capabilityIdSchema = z.enum([
  "monitoring_dashboard",
  "data_analysis",
  "data_query",
  "recommendation",
  "guided_service",
  "content_generation",
]);
export const briefSchema = z
  .object({
    scenario: scenarioSchema,
    industry: z.enum(["healthcare", "retail", "general"]),
    aiPreference: z.enum(["allowed", "none", "undecided"]),
    title: boundedText(1, 80, true),
    users: text,
    problem: text,
    goal: text,
    conditions: boundedText(0, 1200),
    assumptions: z.array(text).max(6),
    questions: z.array(text).max(2),
    clarifications: z
      .array(z.object({ question: text, answer: boundedText(0, 300) }).strict())
      .max(2),
    limitation: boundedText(0, 600),
  })
  .strict();
export const diagnosisSchema = z
  .object({
    summary: text,
    capabilities: z
      .array(
        z
          .object({
            id: capabilityIdSchema,
            approach: z.enum(["hybrid", "software"]),
            reason: text,
            prerequisite: text,
          })
          .strict(),
      )
      .min(1)
      .max(5),
    risks: z.array(text).min(1).max(5),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.capabilities.map((c) => c.id)).size ===
      value.capabilities.length,
    "能力不可重复",
  );

export const componentTypes = [
  "Metrics",
  "Trend",
  "Records",
  "Insight",
  "Query",
  "Recommendations",
  "BriefForm",
  "Document",
] as const;
export const componentSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,48}$/),
    type: z.enum(componentTypes),
    title: boundedText(1, 60, true),
    capability: capabilityIdSchema,
    dataRef: z.enum([
      "healthcare_metrics",
      "retail_metrics",
      "generic_metrics",
      "retail_catalog",
      "campaign_samples",
    ]),
  })
  .strict();
export const templateSlots = {
  analytics_workspace: {
    overview: ["Metrics"],
    main: ["Trend", "Records"],
    assistance: ["Insight", "Query"],
  },
  guided_service: { main: ["Recommendations"], assistance: ["Insight"] },
  ai_workspace: { input: ["BriefForm"], output: ["Document", "Insight"] },
} as const;
export const prototypeSchema = z
  .object({
    appTitle: boundedText(1, 80, true),
    pages: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z][a-z0-9-]{0,48}$/),
            title: boundedText(1, 60, true),
            template: z.enum([
              "analytics_workspace",
              "guided_service",
              "ai_workspace",
            ]),
            sections: z
              .array(
                z
                  .object({
                    slot: z.enum([
                      "overview",
                      "main",
                      "assistance",
                      "input",
                      "output",
                    ]),
                    components: z.array(componentSchema).min(1).max(8),
                  })
                  .strict(),
              )
              .min(1)
              .max(5),
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict()
  .superRefine((spec, ctx) => {
    const ids = new Set<string>();
    for (const page of spec.pages) {
      const slots = templateSlots[page.template] as Record<
        string,
        readonly string[]
      >;
      const usedSlots = new Set<string>();
      const elements = page.sections.flatMap((s) => s.components);
      if (elements.length > 8)
        ctx.addIssue({ code: "custom", message: "每页最多八个模块" });
      for (const item of [page, ...elements]) {
        if (ids.has(item.id))
          ctx.addIssue({ code: "custom", message: "ID 不可重复" });
        ids.add(item.id);
      }
      for (const section of page.sections) {
        if (usedSlots.has(section.slot))
          ctx.addIssue({ code: "custom", message: "区域不可重复" });
        usedSlots.add(section.slot);
        for (const c of section.components) {
          if (!slots[section.slot]?.includes(c.type))
            ctx.addIssue({ code: "custom", message: "组件不属于允许区域" });
        }
      }
    }
  });
export const requestSchema = z.discriminatedUnion("stage", [
  z
    .object({
      stage: z.literal("analyze"),
      input: boundedText(10, 3000, true),
    })
    .strict(),
  z
    .object({
      stage: z.literal("diagnose"),
      brief: briefSchema,
      selectedCapabilities: z.array(capabilityIdSchema).max(5),
    })
    .strict(),
  z
    .object({
      stage: z.literal("plan"),
      brief: briefSchema,
      diagnosis: diagnosisSchema,
    })
    .strict(),
]);
export type Brief = z.infer<typeof briefSchema>;
export type Diagnosis = z.infer<typeof diagnosisSchema>;
export type PrototypeSpec = z.infer<typeof prototypeSchema>;
export type ComponentSpec = z.infer<typeof componentSchema>;
export type CapabilityId = z.infer<typeof capabilityIdSchema>;
export type LabRequest = z.infer<typeof requestSchema>;

export const responseSchema = z.discriminatedUnion("stage", [
  z
    .object({
      stage: z.literal("analyze"),
      mode: z.literal("live"),
      data: briefSchema,
    })
    .strict(),
  z
    .object({
      stage: z.literal("diagnose"),
      mode: z.literal("live"),
      data: diagnosisSchema,
    })
    .strict(),
  z
    .object({
      stage: z.literal("plan"),
      mode: z.enum(["live", "fallback"]),
      data: prototypeSchema,
    })
    .strict(),
]);
export type DataRef = ComponentSpec["dataRef"];

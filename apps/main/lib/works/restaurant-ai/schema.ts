import { z } from "zod";

export const roleSchema = z.enum(["customer", "operations", "finance"]);

export const requestSchema = z.strictObject({
  role: roleSchema,
  message: z.string().trim().min(1).max(1200),
  history: z.array(z.strictObject({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1200) })).max(16),
  accepted: z.array(z.string().regex(/^(booking|campaign|review)-[a-f0-9]{10}$/)).max(12),
});

export const sourceSchema = z.strictObject({ id: z.string(), title: z.string(), category: z.string(), excerpt: z.string() });
export const cardSchema = z.strictObject({
  id: z.string(), title: z.string(), eyebrow: z.string(),
  items: z.array(z.strictObject({ label: z.string(), value: z.string() })),
});
export const proposalSchema = z.strictObject({ id: z.string(), title: z.string(), detail: z.string(), action_label: z.string() });
export const resultSchema = z.strictObject({
  mode: z.literal("live"), answer: z.string(), sources: z.array(sourceSchema), cards: z.array(cardSchema),
  proposal: proposalSchema.nullable(), followups: z.array(z.string()).max(3),
});

export type RestaurantRole = z.infer<typeof roleSchema>;
export type ChatRequest = z.infer<typeof requestSchema>;
export type ChatResult = z.infer<typeof resultSchema>;

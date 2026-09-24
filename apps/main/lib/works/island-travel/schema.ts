import { z } from "zod";

export function containsIdentity(value: string) {
  const withoutDates = value.replace(/(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/g, (date) => z.iso.date().safeParse(date).success ? "日期" : date);
  return /\d{7,}/.test(withoutDates.replace(/[\s+()（）-]/g, "")) || /家庭地址|家住|我家在|住在|小区|门牌号|号楼/.test(value);
}
const text = z.string().trim().min(1).max(1200).refine((v) => !containsIdentity(v));
const city = z.string().trim().min(1).max(30).refine((v) => !/\d{7,}|家庭地址|家住|我家在|住在|小区|门牌号|号楼/.test(v));
export const conditionsSchema = z.strictObject({
  origin: city.nullish(), destination: city.nullish(),
  date: z.iso.date().nullish(),
  time_preference: z.enum(["不限", "上午", "下午", "晚上"]).nullish(),
  quantity: z.number().int().min(1).max(5).nullish(),
});
export const messageSchema = z.strictObject({ role: z.enum(["user", "assistant"]), content: text });
export const requestSchema = z.strictObject({
  message: text, conditions: conditionsSchema.default({}), history: z.array(messageSchema).max(16).default([]),
});
export const interpretationSchema = z.strictObject({
  intent: z.enum(["search_trips", "clarify", "list_orders", "request_refund", "request_reschedule", "request_invoice", "request_product", "request_door_plan", "request_support", "request_reminder", "faq", "select_trip", "unsupported"]),
  conditions: conditionsSchema,
  reply: z.string().trim().max(400).default(""),
  faq: z.enum(["passenger", "luggage", "arrival", "payment"]).nullable().default(null),
  selection: z.number().int().min(1).max(6).nullable().default(null),
});
export const responseSchema = interpretationSchema.extend({ mode: z.literal("live") });
export type Conditions = z.infer<typeof conditionsSchema>;
export type ChatRequest = z.infer<typeof requestSchema>;
export type Interpretation = z.infer<typeof interpretationSchema>;
export type HistoryMessage = z.infer<typeof messageSchema>;

import { z } from "zod";

export const idSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const userIdSchema = z.enum(["A", "B", "C", "D", "E", "F"]);
export const yearSchema = z.literal("2026-2027");
const cents = z.number().int().nonnegative().max(100_000_000);
const timestamp = z.string().datetime();
export const billStatusSchema = z.enum(["unpaid", "payment_pending", "paid"]);
export const applicationStatusSchema = z.enum([
  "draft", "submitted", "review_level_1", "review_level_2", "needs_more_materials",
  "resubmitted", "approved", "fee_pending", "fee_paid",
]);
export const materialTypeSchema = z.enum(["ownership", "construction"]);
export const simulatedMaterialInputSchema = z.object({ applicationId: idSchema, type: materialTypeSchema, idempotencyKey: z.string().uuid() }).strict();
export const userSchema = z.object({ id: userIdSchema, name: z.string(), phone: z.string().regex(/^DEMO-PHONE-[A-F]$/), scenario: z.string() }).strict();
export const houseSchema = z.object({ id: idSchema, ownerId: userIdSchema, account: z.string().regex(/^DEMO-H\d{3}$/), address: z.string(), areaHundredths: z.number().int().positive() }).strict();
export const billSchema = z.object({ id: idSchema, userId: userIdSchema, houseId: idSchema, year: yearSchema, kind: z.enum(["heating", "disconnection"]), amountCents: cents, unitPriceCents: cents, status: billStatusSchema, applicationId: idSchema.optional() }).strict();
export const orderSchema = z.object({ id: idSchema, userId: userIdSchema, billId: idSchema, amountCents: cents, status: z.enum(["pending", "paid", "failed", "cancelled"]), createdAt: timestamp, settledAt: timestamp.optional() }).strict();
export const materialSchema = z.object({ id: idSchema, userId: userIdSchema, applicationId: idSchema, type: materialTypeSchema, fileName: z.string().min(1).max(160).default("历史演示材料（未记录文件名）"), mime: z.enum(["image/png", "image/jpeg", "application/pdf"]), size: z.number().int().positive().max(5 * 1024 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/), storageMode: z.literal("demo_placeholder"), uploadedAt: timestamp }).strict();
export const applicationSchema = z.object({ id: idSchema, userId: userIdSchema, houseId: idSchema, year: yearSchema, status: applicationStatusSchema, createdAt: timestamp, submittedAt: timestamp.optional(), nextReviewAt: timestamp.optional(), reviewScenario: z.enum(["approve", "supplement_once"]), returnedOnce: z.boolean(), requiredReplacements: z.array(materialTypeSchema), returnedMaterialIds: z.array(idSchema), feeBillId: idSchema.optional() }).strict();
export const eventSchema = z.object({ id: idSchema, userId: userIdSchema, entityId: idSchema, entityType: z.enum(["binding", "bill", "order", "application"]), from: z.string(), to: z.string(), reason: z.string(), at: timestamp }).strict();
export const invoiceSchema = z.object({ id: idSchema, userId: userIdSchema, orderId: idSchema, billId: idSchema, amountCents: cents, label: z.literal("模拟发票"), issuedAt: timestamp }).strict();
export const policySchema = z.object({ id: idSchema, year: yearSchema, label: z.string(), unitPriceCents: cents, disconnectionBasisPoints: z.number().int().min(0).max(10000), requiredMaterials: z.array(materialTypeSchema).min(1), reviewIntervalMs: z.number().int().min(1000), knowledge: z.array(z.object({ topic: z.string(), keywords: z.array(z.string()), answer: z.string() }).strict()) }).strict();

export const stateSchema = z.object({
  schemaVersion: z.literal(1), generation: z.string().uuid(), activeUserId: userIdSchema,
  identityVersion: z.number().int().nonnegative(), expiresAt: timestamp,
  users: z.array(userSchema), houses: z.array(houseSchema), bindings: z.array(z.object({ userId: userIdSchema, houseId: idSchema }).strict()),
  bills: z.array(billSchema), orders: z.array(orderSchema), materials: z.array(materialSchema), applications: z.array(applicationSchema), events: z.array(eventSchema), invoices: z.array(invoiceSchema), policy: policySchema,
  confirmations: z.array(z.object({ id: idSchema, fingerprint: z.string(), identityVersion: z.number().int(), expiresAt: timestamp }).strict()),
  receipts: z.array(z.object({ key: z.string(), fingerprint: z.string(), result: z.unknown() }).strict()),
}).strict();
export type HeatingState = z.infer<typeof stateSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type ApplicationStatus = Application["status"];
export type Bill = z.infer<typeof billSchema>;
export type MaterialType = z.infer<typeof materialTypeSchema>;
export type UserId = z.infer<typeof userIdSchema>;
export type Actor = { sandboxId: string; userId: UserId; identityVersion: number; generation: string };
const key = idSchema;
const confirmationId = idSchema.optional();
const target = { houseId: idSchema, year: yearSchema };
// Each external operation has a strict schema; callers cannot inject a user, amount or approval.
export const operationSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal("list_houses"), input: z.object({}).strict() }).strict(),
  z.object({ name: z.literal("query_records"), input: z.object({}).strict() }).strict(),
  z.object({ name: z.literal("query_bill"), input: z.object(target).strict() }).strict(),
  z.object({ name: z.literal("query_application"), input: z.object({ applicationId: idSchema }).strict() }).strict(),
  z.object({ name: z.literal("query_invoice"), input: z.object({ invoiceId: idSchema }).strict() }).strict(),
  z.object({ name: z.literal("query_policy"), input: z.object({ question: z.string().trim().min(1).max(500) }).strict() }).strict(),
  z.object({ name: z.literal("bind_house"), input: z.object({ account: z.string().regex(/^DEMO-H\d{3}$/), name: z.string().max(40), phone: z.string().regex(/^DEMO-PHONE-[A-F]$/), idempotencyKey: key, confirmationId }).strict() }).strict(),
  z.object({ name: z.literal("create_payment"), input: z.object({ billId: idSchema, idempotencyKey: key, confirmationId }).strict() }).strict(),
  z.object({ name: z.literal("simulate_payment"), input: z.object({ orderId: idSchema, outcome: z.enum(["success", "failure", "cancel"]), idempotencyKey: key, confirmationId }).strict() }).strict(),
  z.object({ name: z.literal("create_draft"), input: z.object({ ...target, idempotencyKey: key }).strict() }).strict(),
  z.object({ name: z.literal("submit_application"), input: z.object({ applicationId: idSchema, idempotencyKey: key, confirmationId }).strict() }).strict(),
  z.object({ name: z.literal("resubmit_application"), input: z.object({ applicationId: idSchema, idempotencyKey: key, confirmationId }).strict() }).strict(),
]);
export type Operation = z.infer<typeof operationSchema>;
/** Business API boundary: the Demo implementation can later be replaced by an enterprise adapter. */
export interface HeatingBusinessAdapter {
  execute(actor: Actor, operation: unknown): Promise<unknown>;
  createDisconnectionBill(actor: Actor, applicationId: unknown): Promise<Bill>;
  uploadMaterial(actor: Actor, applicationId: unknown, type: unknown, file: File): Promise<z.infer<typeof materialSchema>>;
  material(actor: Actor, materialId: unknown): Promise<z.infer<typeof materialSchema>>;
}
export const agentToolNames = ["list_houses", "query_records", "query_bill", "query_application", "query_invoice", "query_policy"] as const;
export const confirmationNames = ["bind_house", "create_payment", "simulate_payment", "submit_application", "resubmit_application"] as const;

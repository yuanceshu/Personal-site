import { z } from "zod";
import { applicationSchema, billSchema, eventSchema, houseSchema, invoiceSchema, materialSchema, orderSchema, userIdSchema, userSchema } from "./schema";

export const invoiceDetailSchema = invoiceSchema.extend({ notice: z.string() });
export const actorSchema = z.object({ sandboxId: z.string().uuid(), userId: userIdSchema, identityVersion: z.number().int(), generation: z.string().uuid() });
export const sessionSchema = z.object({ actor: actorSchema, identities: z.array(userSchema), profile: userSchema, demo: z.literal(true), expiresAt: z.string(), materialStorage: z.string(), demoState: z.string().min(1).max(256000) });
export const applicationViewSchema = applicationSchema.extend({ materials: z.array(materialSchema), events: z.array(eventSchema), nextStep: z.string() });
export const recordsSchema = z.object({ profile: userSchema, houses: z.array(houseSchema), bills: z.array(billSchema), orders: z.array(orderSchema), applications: z.array(applicationViewSchema), invoices: z.array(invoiceSchema), events: z.array(eventSchema), demo: z.literal(true) });
export const proposalViewSchema = z.object({ id: z.string().uuid(), operation: z.object({ name: z.enum(["bind_house", "create_payment", "simulate_payment", "create_draft", "submit_application", "resubmit_application", "create_disconnection_bill"]), input: z.record(z.string(), z.unknown()) }), summary: z.unknown(), expiresAt: z.number(), requiresExplicitConfirmation: z.literal(true), demo: z.literal(true) });
export const historySchema = z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(20);
export const snapshotSchema = z.object({ records: recordsSchema, conversation: z.object({ history: historySchema, proposal: proposalViewSchema.nullable(), busy: z.boolean() }), identityVersion: z.number().int(), generation: z.string().uuid() });
export const focusSchema = z.object({ houseIds: z.array(z.string()).max(8).default([]), billIds: z.array(z.string()).max(8).default([]), applicationIds: z.array(z.string()).max(8).default([]), invoiceIds: z.array(z.string()).max(8).default([]) });
export const finalSchema = z.object({ answer: z.string(), usedTools: z.array(z.string()), cards: z.array(z.object({ name: z.string(), input: z.record(z.string(), z.unknown()), result: z.unknown() })), replyMode: z.enum(["results", "choose_house", "binding_details", "materials", "clarify"]).default("results"), focus: focusSchema.default({ houseIds: [], billIds: [], applicationIds: [], invoiceIds: [] }), degraded: z.boolean(), proposal: proposalViewSchema.nullable(), identityVersion: z.number().int(), generation: z.string().uuid(), demo: z.literal(true), demoState: z.string().min(1).max(256000) });
export const confirmedSchema = z.object({ operation: z.string(), result: z.unknown(), demo: z.literal(true), identityVersion: z.number().int(), generation: z.string().uuid() });
export type Session = z.infer<typeof sessionSchema>;
export type Records = z.infer<typeof recordsSchema>;
export type ProposalView = z.infer<typeof proposalViewSchema>;
export type Message = z.infer<typeof historySchema>[number];
export type ApplicationView = z.infer<typeof applicationViewSchema>;
export const amount = (cents: number) => (cents / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const statusLabels: Record<string, string> = { unpaid: "待缴费", payment_pending: "等待支付", paid: "已缴费", pending: "等待支付", failed: "支付失败", cancelled: "已取消", draft: "待准备材料", submitted: "已提交", review_level_1: "一级审核中", review_level_2: "二级审核中", needs_more_materials: "需要补充材料", resubmitted: "已重新提交", approved: "审核通过 · 待缴费", fee_pending: "断暖费用待缴", fee_paid: "断暖已办结" };
export const operationLabels: Record<ProposalView["operation"]["name"], string> = { bind_house: "绑定这套房屋", create_payment: "确认账单，去付款", simulate_payment: "确认模拟支付", create_draft: "为这套房屋开始申请", submit_application: "确认提交断暖申请", resubmit_application: "确认补件后重新提审", create_disconnection_bill: "确认断暖费用" };

export class ClientError extends Error { constructor(public code: string) { super(code); } }
const errorLabels: Record<string, string> = { invalid_page_state: "本页演示状态无法验证，请刷新页面重新开始。", page_state_required: "请先初始化当前页面的演示数据。", demo_unavailable: "供暖演示服务尚未启用，请联系演示人员检查配置。", session_unconfigured: "演示会话尚未配置，请联系演示人员。", agent_unconfigured: "AI 服务尚未配置，请联系演示人员。", agent_unavailable: "AI 服务暂时无法连接，请稍后重试。", agent_failed: "AI 本轮未完成回应，请重试。", agent_invalid_response: "本轮结果未能核实，请重新询问助手。", identity_changed: "本页住户已变化，请重新读取当前业务状态。", conversation_busy: "另一轮对话正在处理，请稍候再试。", proposal_expired: "这项确认已失效，请重新说明您要办理的业务。", confirmation_expired: "确认已过期，请重新发起。", confirmation_changed: "业务资料已变化，请重新核对并发起确认。", session_expired: "演示会话已到期，请选择恢复演示场景。", session_required: "还没有演示会话。", invalid_session: "演示会话无法读取，请恢复演示场景。", invalid_upload: "请选择有效的 PNG、JPG 或 PDF 演示文件。", invalid_file_size: "请选择大小在 1 字节至 5MB 之间的演示文件。", invalid_file_type: "文件类型、扩展名或文件头不匹配，请选择有效的 PNG、JPG 或 PDF。", materials_locked: "当前工单已经提交，暂时不能更换材料。", replacement_required: "请补传新的文件内容，原退回材料不能直接重复提交。", invalid_file: "文件格式不符合要求，请选择 PNG、JPG 或 PDF。", input_too_large: "上传请求太大，请选择不超过 4MB 的演示文件。", rate_limited: "操作有些频繁，请稍候再试。", concurrent_retry: "业务正在更新，请刷新状态后重试。", materials_incomplete: "材料尚不完整，请查看工单材料提示。" };
export function errorLabel(error: unknown) { return error instanceof ClientError ? errorLabels[error.code] ?? "本次未能完成，请重试刚才的需求。" : "连接暂时中断，请重新连接或重试。"; }

/** Status is streamed; financial/business results only appear after validated final evidence. */
export async function consumeChat(response: Response, onStatus: (label: string) => void) {
  if (!response.ok) throw new ClientError((await response.json()).error ?? "agent_unavailable");
  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new ClientError("agent_invalid_response");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = "", bytes = 0, final: z.infer<typeof finalSchema> | undefined;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > 768000) throw new ClientError("agent_invalid_response");
      buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");
      let end: number;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const event = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const kind = event.match(/^event: (\w+)/m)?.[1];
        const data = JSON.parse(event.match(/^data: (.+)/m)?.[1] ?? "{}");
        if (kind === "status") onStatus(z.object({ label: z.string().max(120) }).parse(data).label);
        if (kind === "error") throw new ClientError(typeof data.error === "string" ? data.error : "agent_failed");
        if (kind === "final") { if (final) throw new ClientError("agent_invalid_response"); final = finalSchema.parse(data); }
      }
    }
    if (!final || buffer.trim()) throw new ClientError("agent_invalid_response");
    return final;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { HeatingError } from "../errors";
import { confirmationNames, idSchema, operationSchema, type Actor } from "../schema";
import type { HeatingService } from "../service";
import type { HeatingStore } from "../store";

export const extraOperationSchema = z.object({ name: z.literal("create_disconnection_bill"), input: z.object({ applicationId: idSchema }).strict() }).strict();
const writableNames = ["bind_house", "create_payment", "simulate_payment", "create_draft", "submit_application", "resubmit_application", "create_disconnection_bill"];
const proposalSchema = z.object({ id: z.string().uuid(), turnId: z.string().uuid(), operation: z.union([operationSchema, extraOperationSchema]), summary: z.unknown(), expiresAt: z.number(), result: z.unknown().optional() }).strict();
export type Proposal = z.infer<typeof proposalSchema>;
export function publicProposal(proposal?: Proposal) {
  if (!proposal) return null;
  const input = { ...proposal.operation.input } as Record<string, unknown>;
  delete input.confirmationId;
  return { id: proposal.id, operation: { name: proposal.operation.name, input }, summary: proposal.summary, expiresAt: proposal.expiresAt, requiresExplicitConfirmation: true, demo: true };
}
export const paymentSimulationSchema = z.object({ orderId: idSchema, outcome: z.enum(["success", "failure", "cancel"]) }).strict();
export type PaymentSimulation = z.infer<typeof paymentSimulationSchema>;
const messageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(12000) }).strict();
const conversationSchema = z.object({
  history: z.array(messageSchema).max(20), proposal: proposalSchema.optional(),
  lease: z.object({ id: z.string().uuid(), until: z.number(), paymentSimulation: paymentSimulationSchema.optional() }).strict().optional(),
  receipts: z.array(z.object({ id: z.string(), fingerprint: z.string(), result: z.unknown() }).strict()).max(20),
}).strict();
type Conversation = z.infer<typeof conversationSchema>;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");

/** A fenced conversation per identity version, carried inside the authenticated page capsule. */
export class HeatingConversation {
  private key: string;
  constructor(private store: HeatingStore, namespace: string, private actor: Actor, private expiresAt: string, private clock = Date.now) {
    this.key = `heating:${namespace}:chat:${actor.sandboxId}:${actor.generation}:${actor.identityVersion}`;
  }
  private async update<T>(run: (state: Conversation) => T) {
    for (let i = 0; i < 16; i++) {
      const raw = await this.store.read(this.key);
      const state = raw ? conversationSchema.parse(JSON.parse(raw)) : { history: [], receipts: [] } as Conversation;
      const result = run(state);
      const ttl = Math.ceil((Date.parse(this.expiresAt) - this.clock()) / 1000);
      if (ttl <= 0) throw new HeatingError("session_expired", 401);
      while (Buffer.byteLength(JSON.stringify(state)) > 1_000_000 && state.receipts.length > 1) state.receipts.shift();
      const next = JSON.stringify(conversationSchema.parse(state));
      if (Buffer.byteLength(next) > 1_000_000) throw new HeatingError("conversation_capacity", 413);
      if (await this.store.compareAndSwap(this.key, raw, next, ttl)) return result;
    }
    throw new HeatingError("concurrent_retry", 409);
  }
  private checkLease(state: Conversation, turnId: string) {
    if (state.lease?.id !== turnId || state.lease.until <= this.clock()) throw new HeatingError("conversation_changed", 409);
  }
  async begin(requestId: string, input: unknown, mode: "chat" | "confirm" = "chat", paymentSimulation?: PaymentSimulation) {
    const fingerprint = digest(input);
    return this.update(state => {
      const receipt = state.receipts.find(r => r.id === requestId);
      if (receipt) {
        if (receipt.fingerprint !== fingerprint) throw new HeatingError("idempotency_conflict", 409);
        return { cached: receipt.result, turnId: undefined, history: state.history, proposal: state.proposal };
      }
      if (state.lease && state.lease.until > this.clock()) throw new HeatingError("conversation_busy", 409);
      const turnId = randomUUID();
      state.lease = { id: turnId, until: this.clock() + 100_000, ...(paymentSimulation ? { paymentSimulation } : {}) };
      const proposal = state.proposal;
      if (mode === "chat") delete state.proposal;
      return { cached: undefined, turnId, history: state.history, proposal };
    });
  }
  async finish(turnId: string, requestId: string, input: unknown, result: unknown, messages: z.infer<typeof messageSchema>[] = []) {
    return this.update(state => {
      this.checkLease(state, turnId);
      state.history = [...state.history, ...messages].slice(-20);
      state.receipts = [...state.receipts, { id: requestId, fingerprint: digest(input), result }].slice(-20);
      delete state.lease;
      return result;
    });
  }
  async release(turnId: string) {
    return this.update(state => { if (state.lease?.id === turnId) delete state.lease; });
  }
  async pending(turnId: string) {
    return this.update(state => { this.checkLease(state, turnId); return state.proposal; });
  }
  async view() {
    return this.update(state => ({
      history: state.history.map(message => {
        if (message.role === "user") return message;
        try {
          const parsed = JSON.parse(message.content);
          if (typeof parsed.answer === "string") return { role: message.role, content: parsed.answer };
        } catch { /* Confirmation messages are deliberately rendered without internal JSON. */ }
        return { role: message.role, content: message.content.startsWith("用户已明确确认；") ? "已收到您的明确确认，业务操作已返回。最新状态请查看下方业务卡片。" : "上一条回复未能完整恢复，请查看最新业务记录并继续询问助手。" };
      }),
      proposal: state.proposal && state.proposal.result === undefined && state.proposal.expiresAt > this.clock() ? publicProposal(state.proposal) : null,
      busy: Boolean(state.lease && state.lease.until > this.clock()),
    }));
  }
  async propose(service: HeatingService, turnId: string, raw: unknown) {
    const request = z.object({ name: z.enum(writableNames as [string, ...string[]]), input: z.record(z.string(), z.unknown()) }).strict().parse(raw);
    if ("idempotencyKey" in request.input || "confirmationId" in request.input) throw new HeatingError("agent_confirmation_forbidden", 403);
    const operation = request.name === "create_disconnection_bill" ? extraOperationSchema.parse(request) : operationSchema.parse({ ...request, input: { ...request.input, idempotencyKey: `agent-${digest({ request, turnId })}` } });
    // Check the fence before making a confirmation; only one proposal per turn is accepted.
    const previous = await this.update(state => {
      this.checkLease(state, turnId);
      const selected = state.lease?.paymentSimulation;
      if (selected && (operation.name !== "simulate_payment" || operation.input.orderId !== selected.orderId || operation.input.outcome !== selected.outcome)) throw new HeatingError("payment_selection_mismatch", 409);
      return state.proposal;
    });
    if (previous && digest({ name: previous.operation.name, input: { ...previous.operation.input, confirmationId: undefined } }) === digest(operation) && previous.expiresAt > this.clock()) return publicProposal(previous);
    if (previous?.turnId === turnId) throw new HeatingError("one_action_per_turn", 409);
    let summary: unknown;
    let confirmedOperation = operation;
    if (operation.name === "create_disconnection_bill") {
      summary = await service.execute(this.actor, { name: "query_application", input: operation.input });
      if ((summary as { status: string }).status !== "approved" && (summary as { status: string }).status !== "fee_pending") throw new HeatingError("approval_required", 409);
    } else {
      summary = await service.preview(this.actor, operation);
      if ((confirmationNames as readonly string[]).includes(operation.name)) {
        const card = await service.prepareConfirmation(this.actor, operation);
        confirmedOperation = operationSchema.parse({ ...operation, input: { ...operation.input, confirmationId: card.confirmationId } });
        summary = card.summary;
      }
    }
    const proposal: Proposal = { id: randomUUID(), turnId, operation: confirmedOperation, summary, expiresAt: this.clock() + 5 * 60_000 };
    return this.update(state => {
      this.checkLease(state, turnId);
      if (state.proposal?.turnId === turnId) {
        const current = { name: state.proposal.operation.name, input: { ...state.proposal.operation.input, confirmationId: undefined } };
        if (digest(current) === digest(operation)) return publicProposal(state.proposal);
        throw new HeatingError("one_action_per_turn", 409);
      }
      state.proposal = proposal;
      return publicProposal(proposal);
    });
  }
  async confirm(service: HeatingService, turnId: string, proposalId: string) {
    const proposal = await this.pending(turnId);
    if (!proposal || proposal.id !== proposalId) throw new HeatingError("proposal_expired", 409);
    if (proposal.result !== undefined) return { operation: proposal.operation.name, result: proposal.result, demo: true };
    if (proposal.expiresAt <= this.clock()) throw new HeatingError("proposal_expired", 409);
    const operation = proposal.operation;
    const result = operation.name === "create_disconnection_bill" ? await service.createDisconnectionBill(this.actor, operation.input.applicationId) : await service.execute(this.actor, operation);
    await this.update(state => { this.checkLease(state, turnId); if (state.proposal?.id === proposalId) { state.proposal.result = result; state.proposal.expiresAt = 0; } });
    return { operation: operation.name, result, demo: true };
  }
}

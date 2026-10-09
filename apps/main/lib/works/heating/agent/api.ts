import { createHash } from "node:crypto";
import { z } from "zod";
import { agreementSchema, signAgreementInputSchema } from "../agreement";
import { boundary, browserContext, environment, jsonBody } from "../api";
import { HeatingError } from "../errors";
import { billSchema, idSchema, orderSchema } from "../schema";
import { delegateActor, equalSecret, namespace, readDelegation, requireBrowserWrite } from "../security";
import { HeatingConversation, paymentSimulationSchema, publicProposal } from "./conversation";
import { agentConnection } from "./connection";
import { encodePage, acceptPage } from "../page-state";

export const chatInputSchema = z.object({ message: z.string().trim().min(1).max(2000), requestId: z.string().uuid(), paymentSimulation: paymentSimulationSchema.optional() }).strict();
export const focusSchema = z.object({
  houseIds: z.array(idSchema).max(8).default([]), billIds: z.array(idSchema).max(8).default([]),
  applicationIds: z.array(idSchema).max(8).default([]), invoiceIds: z.array(idSchema).max(8).default([]),
}).strict();
export const agentResultSchema = z.object({
  answer: z.string().min(1).max(12000), usedTools: z.array(z.string().max(80)).max(12),
  cards: z.array(z.object({ name: z.string(), input: z.record(z.string(), z.unknown()), result: z.unknown() }).strict()).max(12),
  degraded: z.boolean(),
  replyMode: z.enum(["results", "choose_house", "binding_details", "materials", "clarify"]).default("results"),
  focus: focusSchema.default({ houseIds: [], billIds: [], applicationIds: [], invoiceIds: [] }),
}).strict();
/** Keep persisted history valid JSON even when tool snapshots exceed the message budget. */
export function historyContent(final: z.input<typeof agentResultSchema>, proposal: Parameters<typeof publicProposal>[0]) {
  const full = JSON.stringify({ answer: final.answer, cards: final.cards, replyMode: final.replyMode, focus: final.focus, proposal: publicProposal(proposal) });
  if (full.length <= 12000) return full;
  const brief = JSON.stringify({ answer: final.answer, usedTools: final.usedTools, proposal: limitedPending(proposal) });
  if (brief.length <= 12000) return brief;
  return JSON.stringify({ answer: `${final.answer.slice(0, 5500)}\n（较长回复已节选，最新状态请查看业务卡片。）`, usedTools: final.usedTools });
}

/** Display references never grant access: resolve every ID against fresh, actor-scoped TS records. */
export function validateFocus(focus: z.infer<typeof focusSchema>, records: unknown) {
  const list = z.array(z.object({ id: idSchema }).passthrough());
  const owned = z.object({ houses: list, bills: list, applications: list, invoices: list }).passthrough().parse(records);
  for (const [field, collection] of [["houseIds", "houses"], ["billIds", "bills"], ["applicationIds", "applications"], ["invoiceIds", "invoices"]] as const) {
    const ids = new Set(owned[collection].map(record => record.id));
    if (focus[field].some(id => !ids.has(id))) throw new HeatingError("agent_invalid_response", 502);
  }
  return focusSchema.parse(Object.fromEntries(Object.entries(focus).map(([key, ids]) => [key, [...new Set(ids)]])));
}

function sse(event: string, value: unknown) { return `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`; }
const streamHeaders = { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no", "X-Content-Type-Options": "nosniff" };
async function conversationContext(request: Request) {
  const { actor, service, store } = await browserContext(request);
  const session = await service.open(actor.sandboxId);
  return { actor, service, repository: new HeatingConversation(store, namespace(), actor, session.expiresAt) };
}

export function agentActionPOST(request: Request) {
  return boundary(request, async () => {
    if (!equalSecret(request.headers.get("authorization"), process.env.EXPERIMENT_AGENT_TOKEN ? `Bearer ${process.env.EXPERIMENT_AGENT_TOKEN}` : undefined)) throw new HeatingError("unauthorized", 401);
    const delegated = request.headers.get("x-heating-context");
    if (!delegated) throw new HeatingError("delegation_required", 401);
    const { actor, turnId } = readDelegation(delegated);
    if (!turnId) throw new HeatingError("turn_required", 403);
    const { service, store } = await environment();
    // Always validate the actor against current business state before touching a conversation.
    await service.execute(actor, { name: "query_records", input: {} });
    const session = await service.open(actor.sandboxId);
    const repository = new HeatingConversation(store, namespace(), actor, session.expiresAt);
    return Response.json({ result: await repository.propose(service, turnId, await jsonBody(request)) }, { headers: { "Cache-Control": "no-store" } });
  });
}

export function confirmPOST(request: Request) {
  return boundary(request, async () => {
    requireBrowserWrite(request);
    const input = z.object({ proposalId: z.string().uuid(), confirmed: z.literal(true) }).strict().parse(await jsonBody(request));
    const { actor, service, repository } = await conversationContext(request);
    await service.execute(actor, { name: "query_records", input: {} });
    const requestId = `confirm:${input.proposalId}`;
    const run = await repository.begin(requestId, input, "confirm");
    if (!run.turnId) { await service.execute(actor, { name: "query_records", input: {} }); return Response.json({ result: run.cached }, { headers: { "Cache-Control": "no-store" } }); }
    try {
      const confirmed = await repository.confirm(service, run.turnId, input.proposalId);
      const result = { ...confirmed, identityVersion: actor.identityVersion, generation: actor.generation };
      await repository.finish(run.turnId, requestId, input, result, [{ role: "assistant", content: `用户已明确确认；${result.operation} 的确定性业务操作已返回。当前状态以最新业务工具查询为准。` }]);
      await service.execute(actor, { name: "query_records", input: {} });
      return Response.json({ result }, { headers: { "Cache-Control": "no-store" } });
    } finally { await repository.release(run.turnId); }
  });
}

export function signAgreementPOST(request: Request) {
  return boundary(request, async () => {
    requireBrowserWrite(request);
    const input = signAgreementInputSchema.parse(await jsonBody(request));
    const { actor, service, repository } = await conversationContext(request);
    // Hash the bounded request for idempotency; strokes never enter history, receipts or state.
    const receiptInput = { proposalId: input.proposalId, version: input.version, signatureHash: createHash("sha256").update(JSON.stringify(input.signature)).digest("hex") };
    const requestId = `sign:${input.idempotencyKey}`;
    const run = await repository.begin(requestId, receiptInput, "confirm");
    try {
      const pending = run.turnId ? await repository.pending(run.turnId) : run.proposal;
      if (!pending || pending.id !== input.proposalId || pending.result !== undefined || pending.expiresAt <= Date.now() || pending.operation.name !== "create_payment") throw new HeatingError("proposal_expired", 409);
      if (!run.turnId) return Response.json({ result: run.cached }, { headers: { "Cache-Control": "no-store" } });
      const summary = z.object({ agreement: agreementSchema }).passthrough().parse(pending.summary);
      await service.preview(actor, pending.operation);
      const agreement = await service.signAgreement(actor, pending.operation.input.billId, input.version, summary.agreement.contentHash, input.signature);
      const result = { agreement, identityVersion: actor.identityVersion, generation: actor.generation, demo: true };
      await repository.finish(run.turnId, requestId, receiptInput, result, [{ role: "assistant", content: JSON.stringify({ answer: "本账单的演示协议已签署，尚未付款。请继续核对账单并确认。" }) }]);
      return Response.json({ result }, { headers: { "Cache-Control": "no-store" } });
    } finally { if (run.turnId) await repository.release(run.turnId); }
  });
}

function limitedHistory(history: { role: "user" | "assistant"; content: string }[]) {
  const result: typeof history = [];
  let bytes = 0;
  for (const item of [...history].reverse()) {
    const size = Buffer.byteLength(JSON.stringify(item));
    if (bytes + size > 20_000) break;
    result.unshift(item); bytes += size;
  }
  return result;
}
function limitedPending(proposal?: Parameters<typeof publicProposal>[0]) {
  const view = publicProposal(proposal);
  if (!view) return null;
  // Full business summary is already in the fresh tool snapshot; keep only the reference here.
  return { id: view.id, operation: view.operation, requiresExplicitConfirmation: true };
}

export function chatPOST(request: Request) {
  return boundary(request, async () => {
    const origin = requireBrowserWrite(request);
    const input = chatInputSchema.parse(await jsonBody(request));
    const { actor, service, repository } = await conversationContext(request);
    const connection = agentConnection(origin);
    const run = await repository.begin(input.requestId, input, "chat", input.paymentSimulation);
    if (!run.turnId) { await service.execute(actor, { name: "query_records", input: {} }); return new Response(sse("final", { ...run.cached as object, replayed: true, demoState: encodePage() }), { headers: streamHeaders }); }
    // Check fresh requests after receipt replay. Rejected requests return no updated
    // page capsule, so the browser retains its previous state and confirmation card.
    if (input.paymentSimulation) {
      const records = z.object({ orders: z.array(orderSchema), bills: z.array(billSchema) }).passthrough().parse(await service.execute(actor, { name: "query_records", input: {} }));
      const order = records.orders.find(order => order.id === input.paymentSimulation?.orderId);
      if (!order) throw new HeatingError("record_not_found", 404);
      if (order.status !== "pending" || !records.bills.some(bill => bill.id === order.billId && bill.status === "payment_pending")) throw new HeatingError("payment_not_pending", 409);
    }
    const turnId = run.turnId;
    const delegation = delegateActor(actor, Date.now(), turnId);
    let cancelled = false;
    const abort = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const emit = (event: string, value: unknown) => { if (!cancelled) controller.enqueue(encoder.encode(sse(event, value))); };
        try {
          emit("status", { label: "正在理解需求并核对业务记录" });
          const upstream = await fetch(connection.endpoint, {
            method: "POST", cache: "no-store", redirect: "error",
            headers: { ...connection.headers, "X-Heating-Context": delegation },
            body: JSON.stringify({ message: input.paymentSimulation ? `${input.message}\n本次明确选择的订单是 ${input.paymentSimulation.orderId}，模拟结果为 ${input.paymentSimulation.outcome}。只准备该订单该结果的 simulate_payment 确认提案，不创建订单、不替换结果。` : input.message, history: limitedHistory(run.history), pending: limitedPending(run.proposal), demoState: encodePage() }),
            signal: AbortSignal.any([request.signal, abort.signal, AbortSignal.timeout(65_000)]),
          });
          if (!upstream.ok || !upstream.body) throw new HeatingError("agent_unavailable", 502);
          // Forward only validated status/final events. Never stream raw model assertions.
          const reader = upstream.body.getReader();
          let buffer = "", total = 0, final: z.infer<typeof agentResultSchema> | undefined;
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              total += value.length;
              if (total > 768_000) throw new HeatingError("agent_invalid_response", 502);
              buffer += decoder.decode(value, { stream: true });
              let end: number;
              while ((end = buffer.indexOf("\n\n")) !== -1) {
                const event = buffer.slice(0, end); buffer = buffer.slice(end + 2);
                const kind = event.match(/^event: (\w+)/m)?.[1];
                const data = JSON.parse(event.match(/^data: (.+)/m)?.[1] ?? "{}");
                if (kind === "status") emit("status", z.object({ label: z.string().max(120) }).strict().parse(data));
                else if (kind === "final") { if (final) throw new HeatingError("agent_invalid_response", 502); const { demoState, ...evidence } = data; acceptPage(demoState); final = agentResultSchema.parse(evidence); }
                else if (kind === "error") throw new HeatingError("agent_failed", 502);
              }
              // Preserve validated evidence even if the upstream connection stalls after final.
              if (final) break;
            }
            if (buffer.trim() || !final) throw new HeatingError("agent_invalid_response", 502);
          } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
          const records = await service.execute(actor, { name: "query_records", input: {} });
          final.focus = validateFocus(final.focus, records);
          const proposal = await repository.pending(turnId);
          if (input.paymentSimulation && (!proposal || proposal.operation.name !== "simulate_payment" || proposal.operation.input.orderId !== input.paymentSimulation.orderId || proposal.operation.input.outcome !== input.paymentSimulation.outcome)) throw new HeatingError("agent_invalid_response", 502);
          const result = { ...final, proposal: publicProposal(proposal), demo: true, identityVersion: actor.identityVersion, generation: actor.generation };
          await repository.finish(turnId, input.requestId, input, result, [
            { role: "user", content: input.message },
            { role: "assistant", content: historyContent(final, proposal) },
          ]);
          await repository.release(turnId);
          emit("final", { ...result, demoState: encodePage() });
        } catch (error) {
          emit("error", { error: error instanceof HeatingError ? error.code : "agent_unavailable", retryable: true, message: "本次对话未完成，请查询当前业务状态后重试。模型无法自行支付或提交。" });
        } finally {
          await repository.release(turnId).catch(() => undefined);
          if (!cancelled) controller.close();
        }
      },
      cancel() { cancelled = true; abort.abort(); },
    });
    return new Response(stream, { headers: streamHeaders });
  });
}

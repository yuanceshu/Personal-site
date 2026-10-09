import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { agreementSchema, signatureSchema } from "@/lib/works/heating/agreement";
import { agentActionPOST } from "@/lib/works/heating/agent/api";
import { HeatingError } from "@/lib/works/heating/errors";
import { decodePage } from "@/lib/works/heating/page-state";
import { apiClient } from "./api-client";
import { demoSignature, fixture, draft, materials, confirm, records } from "./helpers";

process.env.HEATING_SESSION_SECRET = "agreement-test-page-secret-at-least-32";
process.env.EXPERIMENT_AGENT_TOKEN = "agreement-test-agent-token";
process.env.EXPERIMENT_AGENT_URL = "https://agent.example";
const code = (expected: string) => (error: unknown) => error instanceof HeatingError && error.code === expected;

test("协议签署：两类费用均有服务端门禁，内容绑定、笔迹校验、失败重试和住户隔离", async () => {
  const f = await fixture(), actor = f.session.actor;
  const operation = { name: "create_payment" as const, input: { billId: "bill-house-A", idempotencyKey: "unsigned" } };
  const card = await f.service.prepareConfirmation(actor, operation);
  const agreement = agreementSchema.parse((card.summary as { agreement: unknown }).agreement);
  assert.match(agreement.title, /供暖服务协议/);
  assert.equal(agreement.amountCents, 212500);
  await assert.rejects(f.service.execute(actor, { ...operation, input: { ...operation.input, confirmationId: card.confirmationId } }), code("agreement_required"));
  for (const signature of [[], [[[0.5,0.5],[0.5,0.5]]], [[[0,0],[2,0]]], Array(65).fill(demoSignature[0]), [Array(2049).fill([0.2,0.4])]]) assert.equal(signatureSchema.safeParse(signature).success, false);
  await assert.rejects(f.service.signAgreement(actor, agreement.billId, "old", agreement.contentHash, demoSignature), code("agreement_changed"));
  await assert.rejects(f.service.signAgreement(actor, "bill-house-F", agreement.version, agreement.contentHash, demoSignature), code("record_not_found"));
  const repeated = await Promise.all(Array.from({ length: 5 }, () => f.service.signAgreement(actor, agreement.billId, agreement.version, agreement.contentHash, demoSignature)));
  const signed = repeated[0];
  assert.equal(new Set(repeated.map(a => a.signedAt)).size, 1);
  assert.ok(signed.signedAt);
  assert.deepEqual(await f.service.signAgreement(actor, agreement.billId, agreement.version, agreement.contentHash, demoSignature), signed);
  assert.equal((await records(f.service, actor)).orders.length, 0);
  const order = await f.service.execute(actor, { ...operation, input: { ...operation.input, confirmationId: card.confirmationId } }) as { id: string };
  const key = Object.keys(f.store.entries())[0];
  const state = JSON.parse((await f.store.read(key))!); const saved = state.agreements;
  state.agreements = state.agreements.filter((a: { billId: string }) => a.billId !== agreement.billId);
  await f.store.compareAndSwap(key, await f.store.read(key), JSON.stringify(state), 60);
  const payment = { name: "simulate_payment" as const, input: { orderId: order.id, outcome: "failure" as const, idempotencyKey: "fail" } };
  const paymentCard = await f.service.prepareConfirmation(actor, payment);
  await assert.rejects(f.service.execute(actor, { ...payment, input: { ...payment.input, confirmationId: paymentCard.confirmationId } }), code("agreement_required"));
  state.agreements = saved; await f.store.compareAndSwap(key, await f.store.read(key), JSON.stringify(state), 60);
  await confirm(f.service, actor, payment);
  assert.equal((await records(f.service, actor)).bills[0].status, "unpaid");
  assert.equal((await records(f.service, actor)).invoices.length, 0);
  const app = await draft(f.service, actor); await materials(f.service, actor, app.id);
  await confirm(f.service, actor, { name: "submit_application", input: { applicationId: app.id, idempotencyKey: "submit" } });
  f.advance(30000); const bill = await f.service.createDisconnectionBill(actor, app.id);
  const disconnection = { name: "create_payment" as const, input: { billId: bill.id, idempotencyKey: "disconnection" } };
  const dcard = await f.service.prepareConfirmation(actor, disconnection);
  const dagreement = agreementSchema.parse((dcard.summary as { agreement: unknown }).agreement);
  assert.match(dagreement.title, /断暖/); assert.equal(dagreement.amountCents, 74375);
  await assert.rejects(f.service.execute(actor, { ...disconnection, input: { ...disconnection.input, confirmationId: dcard.confirmationId } }), code("agreement_required"));
  await f.service.signAgreement(actor, bill.id, dagreement.version, dagreement.contentHash, demoSignature);
  const dorder = await f.service.execute(actor, { ...disconnection, input: { ...disconnection.input, confirmationId: dcard.confirmationId } }) as { id: string };
  await confirm(f.service, actor, { name: "simulate_payment", input: { orderId: dorder.id, outcome: "success", idempotencyKey: "done" } });
  assert.equal((await records(f.service, actor)).applications[0].status, "fee_paid");
  assert.equal((await records(f.service, actor)).invoices.length, 1);
  const stored = JSON.stringify(f.store.entries()); assert.equal(stored.includes('"signature"'), false);
  const other = await f.service.open(); const otherView = await records(f.service, other.actor);
  assert.equal((otherView.agreements as { signedAt?: string }[]).some(a => a.signedAt), false);
});

test("签署API：可信提案、明确签署、重复及冲突、过期、跨身份、旧提案与状态包不含笔迹", async () => {
  const client = apiClient(); await client.call("session");
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const input = JSON.parse(String(options!.body)), h = new Headers(options!.headers);
    const response = await agentActionPOST(new Request("http://localhost/api/experiments/heating/agent-action", { method: "POST", headers: { "Content-Type": "application/json", authorization: h.get("authorization")!, "x-heating-context": h.get("x-heating-context")! }, body: JSON.stringify({ name: "create_payment", input: { billId: "bill-house-A" }, demoState: input.demoState }) }));
    const body = await response.json(); assert.equal(response.status, 200);
    return new Response(`event: final\ndata: ${JSON.stringify({ answer: "请先签署演示协议。", cards: [], usedTools: [], degraded: false, demoState: body.demoState })}\n\n`);
  };
  try {
    const proposal = (await client.chat("我要缴费")).final.proposal;
    const input = { proposalId: proposal.id, version: proposal.summary.agreement.version, signature: demoSignature, idempotencyKey: randomUUID() };
    assert.equal((await client.call("sign-agreement", { ...input, signature: [] })).status, 400);
    assert.equal((await client.call("sign-agreement", { ...input, billId: "bill-house-F" })).status, 400);
    assert.equal((await client.call("sign-agreement", { ...input, proposalId: randomUUID() })).status, 409);
    assert.equal((await client.call("sign-agreement", { ...input, version: "old" })).status, 409);
    assert.equal((await client.call("confirm", { proposalId: proposal.id, confirmed: true })).status, 403);
    const signed = await client.call("sign-agreement", input); assert.equal(signed.status, 200);
    assert.equal((await client.call("sign-agreement", input)).status, 200);
    assert.equal((await client.call("sign-agreement", { ...input, signature: [[[0.1,0.1],[0.6,0.7]]] })).status, 409);
    const text = JSON.stringify(decodePage(client.state!)); assert.equal(text.includes('\\"signature\\"'), false); assert.equal(text.includes(JSON.stringify(demoSignature)), false);
    assert.equal((await client.records()).orders.length, 0);
    assert.equal((await client.call("confirm", { proposalId: proposal.id, confirmed: true })).status, 200);
    assert.equal((await client.records()).orders.length, 1);
    assert.equal((await client.call("sign-agreement", { ...input, idempotencyKey: randomUUID() })).status, 409);
    await client.call("session", { userId: "F" }); assert.equal((await client.call("sign-agreement", input)).status, 409);
    // A separate new page never inherits A's signature.
    const fresh = apiClient(); await fresh.call("session"); assert.equal((await fresh.records()).agreements[0].signedAt, undefined);
    await client.call("session", { userId: "A" });
    const expired = (await client.chat("我要缴费")).final.proposal;
    const realNow = Date.now; Date.now = () => realNow() + 300001;
    try { assert.equal((await client.call("sign-agreement", { ...input, proposalId: expired.id, idempotencyKey: randomUUID() })).status, 409); }
    finally { Date.now = realNow; }
  } finally { globalThis.fetch = original; }
});

import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { HeatingConversation } from "@/lib/works/heating/agent/conversation";
import { HeatingError } from "@/lib/works/heating/errors";
import { fixture, materials, records, confirm, signBill } from "./helpers";

const code = (name: string) => (e: unknown) => e instanceof HeatingError && e.code === name;
test("提案复用业务校验，不写业务；独立确认改变状态，重复确认恢复回执", async () => {
  const f = await fixture();
  try {
    const a = f.session.actor;
    const chat = new HeatingConversation(f.store, "test", a, f.session.expiresAt, f.clock);
    const input = { message: "今年没人住，想断暖" };
    const id = randomUUID(), run = await chat.begin(id, input);
    const proposal = (await chat.propose(f.service, run.turnId!, { name: "create_draft", input: { houseId: "house-A", year: "2026-2027" } }))!;
    assert.equal((await records(f.service, a)).applications.length, 0);
    await assert.rejects(chat.propose(f.service, run.turnId!, { name: "create_payment", input: { billId: "bill-house-A" } }), code("one_action_per_turn"));
    await chat.finish(run.turnId!, id, input, { proposal });
    const confirmInput = { proposalId: proposal.id, confirmed: true }, cid = `confirm:${proposal.id}`;
    const crun = await chat.begin(cid, confirmInput, "confirm");
    const result = await chat.confirm(f.service, crun.turnId!, proposal.id);
    await chat.finish(crun.turnId!, cid, confirmInput, result);
    assert.equal((await records(f.service, a)).applications.length, 1);
    const retry = await chat.begin(cid, confirmInput, "confirm");
    assert.deepEqual(retry.cached, result);
    assert.equal(retry.turnId, undefined);
    const next = await chat.begin(randomUUID(), { message: "资料齐了帮我提交" });
    const app = (await records(f.service, a)).applications[0];
    await assert.rejects(chat.propose(f.service, next.turnId!, { name: "submit_application", input: { applicationId: app.id } }), code("materials_incomplete"));
    await materials(f.service, a, app.id);
    const submission = (await chat.propose(f.service, next.turnId!, { name: "submit_application", input: { applicationId: app.id } }))!;
    assert.equal((await records(f.service, a)).applications[0].status, "draft");
    await chat.release(next.turnId!);
    const submitRun = await chat.begin(randomUUID(), {}, "confirm");
    await chat.confirm(f.service, submitRun.turnId!, submission.id);
    assert.equal((await records(f.service, a)).applications[0].status, "submitted");
  } finally { f.close(); }
});

test("会话状态承接，多轮改意图撤销旧提案，并发和过期运行被隔离", async () => {
  const f = await fixture();
  try {
    const a = f.session.actor;
    const chat = new HeatingConversation(f.store, "test", a, f.session.expiresAt, f.clock);
    const second = new HeatingConversation(f.store, "test", a, f.session.expiresAt, f.clock);
    const id = randomUUID(), input = { message: "想交暖气费" };
    const run = await chat.begin(id, input);
    await assert.rejects(second.begin(randomUUID(), {}), code("conversation_busy"));
    const proposal = (await chat.propose(f.service, run.turnId!, { name: "create_payment", input: { billId: "bill-house-A" } }))!;
    await chat.finish(run.turnId!, id, input, { proposal }, [{ role: "user", content: input.message }]);
    assert.deepEqual((await second.begin(id, input)).cached, { proposal });
    await assert.rejects(second.begin(id, { message: "改成断暖" }), code("idempotency_conflict"));
    const followup = await second.begin(randomUUID(), { message: "先不缴费，咨询断暖政策" });
    assert.equal(followup.history[0].content, input.message);
    assert.equal((await second.pending(followup.turnId!)), undefined);
    await assert.rejects(second.confirm(f.service, followup.turnId!, proposal.id), code("proposal_expired"));
    f.advance(101000);
    const replacement = await chat.begin(randomUUID(), {});
    await assert.rejects(second.propose(f.service, followup.turnId!, { name: "create_payment", input: { billId: "bill-house-A" } }), code("conversation_changed"));
    await chat.release(replacement.turnId!);
    const b = (await f.service.switchIdentity(a, "B")).actor;
    const other = new HeatingConversation(f.store, "test", b, f.session.expiresAt, f.clock);
    const br = await other.begin(randomUUID(), {});
    assert.equal(br.history.length, 0);
    await assert.rejects(chat.propose(f.service, (await chat.begin(randomUUID(), {})).turnId!, { name: "create_payment", input: { billId: "bill-house-A" } }), code("identity_changed"));
  } finally { f.close(); }
});

test("代理提案不能注入身份、金额、确认或幂等凭据；越权和旧摘要失败", async () => {
  const f = await fixture();
  try {
    const chat = new HeatingConversation(f.store, "test", f.session.actor, f.session.expiresAt, f.clock);
    const run = await chat.begin(randomUUID(), {});
    for (const input of [{ billId: "bill-house-A", userId: "E" }, { billId: "bill-house-A", amountCents: 1 }, { billId: "bill-house-A", confirmationId: "fake" }, { billId: "bill-house-A", idempotencyKey: "model-key" }]) {
      await assert.rejects(chat.propose(f.service, run.turnId!, { name: "create_payment", input }));
    }
    await assert.rejects(chat.propose(f.service, run.turnId!, { name: "create_payment", input: { billId: "bill-house-E" } }), code("record_not_found"));
    const proposal = (await chat.propose(f.service, run.turnId!, { name: "create_payment", input: { billId: "bill-house-A" } }))!;
    await chat.release(run.turnId!);
    f.advance(300001);
    const cr = await chat.begin(randomUUID(), {}, "confirm");
    await assert.rejects(chat.confirm(f.service, cr.turnId!, proposal.id), code("proposal_expired"));
    assert.equal((await records(f.service, f.session.actor)).orders.length, 0);
  } finally { f.close(); }
});

test("失败支付后新一轮可创建新订单；同轮重复提案复用且不重复付款", async () => {
  const f = await fixture();
  try {
    const a = f.session.actor;
    const chat = new HeatingConversation(f.store, "test", a, f.session.expiresAt, f.clock);
    const action = { name: "create_payment", input: { billId: "bill-house-A" } };
    const first = await chat.begin(randomUUID(), {});
    const proposal = (await chat.propose(f.service, first.turnId!, action))!;
    assert.equal((await chat.propose(f.service, first.turnId!, action))!.id, proposal.id);
    await chat.release(first.turnId!);
    await signBill(f.service, a, "bill-house-A");
    const confirmed = await chat.begin(randomUUID(), {}, "confirm");
    await chat.confirm(f.service, confirmed.turnId!, proposal.id); await chat.release(confirmed.turnId!);
    const order = (await records(f.service, a)).orders[0];
    const payRun = await chat.begin(randomUUID(), {});
    const failure = (await chat.propose(f.service, payRun.turnId!, { name: "simulate_payment", input: { orderId: order.id, outcome: "failure" } }))!;
    await chat.release(payRun.turnId!);
    const failRun = await chat.begin(randomUUID(), {}, "confirm");
    await chat.confirm(f.service, failRun.turnId!, failure.id); await chat.release(failRun.turnId!);
    const retry = await chat.begin(randomUUID(), {});
    const next = (await chat.propose(f.service, retry.turnId!, action))!;
    await chat.release(retry.turnId!);
    const nextConfirm = await chat.begin(randomUUID(), {}, "confirm");
    await chat.confirm(f.service, nextConfirm.turnId!, next.id);
    const state = await records(f.service, a);
    assert.equal(state.orders.length, 2); assert.equal(state.orders[0].status, "failed"); assert.equal(state.orders[1].status, "pending"); assert.equal(state.invoices.length, 0);
  } finally { f.close(); }
});

test("并行模型工具调用也只能持久化一份提案，相同提案并发复用", async () => {
  const f = await fixture();
  try {
    const chat = new HeatingConversation(f.store, "test", f.session.actor, f.session.expiresAt, f.clock);
    const run = await chat.begin(randomUUID(), {});
    const op = { name: "create_payment", input: { billId: "bill-house-A" } };
    const same = await Promise.all([chat.propose(f.service, run.turnId!, op), chat.propose(f.service, run.turnId!, op)]);
    assert.equal(same[0]!.id, same[1]!.id);
    await chat.release(run.turnId!);
    const next = await chat.begin(randomUUID(), {});
    const different = await Promise.allSettled([chat.propose(f.service, next.turnId!, op), chat.propose(f.service, next.turnId!, { name: "create_draft", input: { houseId: "house-A", year: "2026-2027" } })]);
    assert.equal(different.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(different.filter(r => r.status === "rejected").length, 1);
    assert.equal((await records(f.service, f.session.actor)).orders.length, 0);
    assert.equal((await records(f.service, f.session.actor)).applications.length, 0);
  } finally { f.close(); }
});


test("指定支付失败的轮次禁止改为新订单、成功结果或其他订单，独立确认后才失败", async () => {
  const f = await fixture();
  try {
    const actor = f.session.actor;
    const order = await confirm(f.service, actor, { name: "create_payment", input: { billId: "bill-house-A", idempotencyKey: "selected-order" } }) as { id: string };
    const chat = new HeatingConversation(f.store, "test", actor, f.session.expiresAt, f.clock);
    const selected = { orderId: order.id, outcome: "failure" as const };
    const run = await chat.begin(randomUUID(), { paymentSimulation: selected }, "chat", selected);
    for (const operation of [
      { name: "create_payment", input: { billId: "bill-house-A" } },
      { name: "simulate_payment", input: { orderId: order.id, outcome: "success" } },
      { name: "simulate_payment", input: { orderId: "other-order", outcome: "failure" } },
    ]) await assert.rejects(chat.propose(f.service, run.turnId!, operation), code("payment_selection_mismatch"));
    const operation = { name: "simulate_payment", input: selected };
    const proposal = (await chat.propose(f.service, run.turnId!, operation))!;
    assert.equal((await chat.propose(f.service, run.turnId!, operation))!.id, proposal.id);
    assert.equal((await records(f.service, actor)).orders[0].status, "pending");
    await chat.release(run.turnId!);
    const confirmed = await chat.begin(randomUUID(), {}, "confirm");
    await chat.confirm(f.service, confirmed.turnId!, proposal.id);
    const result = await records(f.service, actor);
    assert.equal(result.orders.length, 1); assert.equal(result.orders[0].status, "failed");
    assert.equal(result.bills[0].status, "unpaid"); assert.equal(result.invoices.length, 0);
  } finally { f.close(); }
});

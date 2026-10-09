import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { toolPOST } from "@/lib/works/heating/api";
import { agentActionPOST, agentResultSchema, focusSchema, validateFocus } from "@/lib/works/heating/agent/api";
import { demoSignature } from "./helpers";
import { apiClient } from "./api-client";

process.env.HEATING_SESSION_SECRET = "agent-page-state-test-secret-at-least-32";
process.env.EXPERIMENT_AGENT_TOKEN = "test-agent-token";
process.env.EXPERIMENT_AGENT_URL = "https://agent.example";

test("无状态 Chat→Agno→连续 Tool→提案→明确确认→支付，历史承接、重放、模型失败", async () => {
  const originalFetch = globalThis.fetch;
  const client = apiClient(); await client.call("session");
  let mode = "late-order", calls = 0, lateReads = 0, seenHistory: { content: string }[] = [];
  globalThis.fetch = async (_url, options) => {
    calls++; assert.equal(options?.redirect, "error");
    const h = new Headers(options?.headers), input = JSON.parse(options!.body as string);
    seenHistory = input.history; assert.equal("userId" in input, false);
    let demoState = input.demoState;
    const invoke = async (name: string, args: object, proposal = false) => {
      const response = await (proposal ? agentActionPOST : toolPOST)(new Request("http://localhost/api/experiments/heating/tool", { method: "POST", headers: { authorization: h.get("authorization")!, "x-heating-context": h.get("x-heating-context")!, "content-type": "application/json" }, body: JSON.stringify({ name, input: args, demoState }) }));
      assert.equal(response.status, 200); const result = await response.json(); demoState = result.demoState; return result.result;
    };
    const records = await invoke("query_records", {});
    if (mode === "fail") throw Error("private model error");
    if (mode === "late-order") await invoke("create_payment", { billId: "bill-house-A" }, true);
    if (mode === "pay") await invoke("simulate_payment", { orderId: records.orders[0].id, outcome: "success" }, true);
    const events = `event: status\ndata: {"label":"核对中"}\n\nevent: final\ndata: ${JSON.stringify({ answer: "以工具结果为准，提案还需明确确认。", cards: [{ name: "query_records", input: {}, result: records }], usedTools: ["query_records"], degraded: mode === "degraded", demoState, ...(mode === "foreign-focus" ? { replyMode: "results", focus: { billIds: ["bill-house-E"] } } : ["focused-query", "degraded"].includes(mode) ? { replyMode: "results", focus: { billIds: ["bill-house-A"] } } : {}) })}\n\n`;
    if (mode === "late-order") return new Response(new ReadableStream({ pull(controller) {
      if (++lateReads === 1) controller.enqueue(new TextEncoder().encode(events));
      else controller.error(new Error("transport failed after verified final"));
    } }, { highWaterMark: 0 }));
    return new Response(events);
  };
  try {
    const id = randomUUID(); const order = (await client.chat("我想交今年的暖气费。", id)).final;
    assert.ok(order.proposal); assert.equal((await client.records()).orders.length, 0);
    assert.equal(lateReads, 1);
    assert.equal(JSON.stringify(order.cards).includes("demoState"), false);
    const count = calls; assert.equal((await client.chat("我想交今年的暖气费。", id)).final.replayed, true); assert.equal(calls, count);
    assert.equal((await client.call("confirm", { proposalId: order.proposal.id, confirmed: false })).status, 400);
    assert.equal((await client.call("confirm", { proposalId: order.proposal.id, confirmed: true })).status, 403);
    assert.equal((await client.call("sign-agreement", { proposalId: order.proposal.id, version: order.proposal.summary.agreement.version, signature: demoSignature, idempotencyKey: randomUUID() })).status, 200);
    const confirmed = await client.call("confirm", { proposalId: order.proposal.id, confirmed: true }); assert.equal(confirmed.status, 200);
    assert.equal((await client.call("confirm", { proposalId: order.proposal.id, confirmed: true })).status, 200);
    mode = "pay"; const payment = (await client.chat("继续刚才的模拟支付")).final; assert.ok(seenHistory.some(item => item.content.includes("暖气费")));
    assert.equal((await client.call("confirm", { proposalId: payment.proposal.id, confirmed: true })).status, 200);
    assert.equal((await client.call("confirm", { proposalId: payment.proposal.id, confirmed: true })).status, 200);
    assert.equal((await client.records()).invoices.length, 1);
    mode = "degraded"; const degradedId = randomUUID(); const degraded = (await client.chat("查询已付款账单但模型异常", degradedId)).final;
    assert.equal(degraded.degraded, true); assert.deepEqual(degraded.focus.billIds, ["bill-house-A"]);
    const beforeRetry = calls; assert.equal((await client.chat("查询已付款账单但模型异常", degradedId)).final.replayed, true); assert.equal(calls, beforeRetry);
    assert.equal((await client.records()).orders.length, 1); assert.equal((await client.records()).invoices.length, 1);
    assert.equal((await client.records()).bills[0].status, "paid");
    mode = "focused-query"; const focused = (await client.chat("查询刚才账单")).final;
    assert.deepEqual(focused.focus.billIds, ["bill-house-A"]);
    mode = "foreign-focus"; const foreign = await client.chat("不能展示其他住户账单");
    assert.equal(foreign.final, undefined); assert.match(JSON.stringify(foreign.events), /agent_invalid_response/);
    assert.equal((await client.records()).invoices.length, 1);
    mode = "fail"; const failed = await client.chat("查询发票"); assert.equal(failed.final, undefined); assert.equal(JSON.stringify(failed.events).includes("private model"), false);
    assert.equal((await client.records()).invoices.length, 1);
    await client.call("session", { userId: "B" }); mode = "query"; await client.chat("我还没有绑定房子。"); assert.equal(seenHistory.length, 0);
  } finally { globalThis.fetch = originalFetch; }
});


test("展示协议缺省兼容、引用边界及跨住户引用拒绝", () => {
  const parsed = agentResultSchema.parse({ answer: "只读核实结果", cards: [], usedTools: [], degraded: false });
  assert.equal(parsed.replyMode, "results");
  assert.deepEqual(parsed.focus, { houseIds: [], billIds: [], applicationIds: [], invoiceIds: [] });
  const owned = { houses: [{ id: "house-A" }], bills: [{ id: "bill-A" }], applications: [], invoices: [] };
  const duplicate = focusSchema.parse({ billIds: ["bill-A", "bill-A"] });
  assert.deepEqual(validateFocus(duplicate, owned).billIds, ["bill-A"]);
  for (const foreign of [{ houseIds: ["house-B"] }, { billIds: ["bill-B"] }, { applicationIds: ["application-B"] }, { invoiceIds: ["invoice-B"] }]) {
    assert.throws(() => validateFocus(focusSchema.parse(foreign), owned), /agent_invalid_response/);
  }
  assert.equal(focusSchema.safeParse({ billIds: Array(9).fill("bill-A") }).success, false);
  assert.equal(agentResultSchema.safeParse({ ...parsed, replyMode: "pay_success" }).success, false);
});


test("模拟支付目标由服务端校验，缺失、越权、已付款订单不能发给模型", async () => {
  const client = apiClient(); await client.call("session");
  const rawFetch = globalThis.fetch;
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error("unexpected model call"); };
  try {
    const request = (orderId: string) => client.call("chat", { message: "演示失败", requestId: randomUUID(), paymentSimulation: { orderId, outcome: "failure" } });
    assert.equal((await request("missing-order")).status, 404);
    const order = (await client.execute("create_payment", { billId: "bill-house-A" })).result;
    await client.call("session", { userId: "B" }); assert.equal((await request(order.id)).status, 404);
    await client.call("session", { userId: "A" });
    await client.execute("simulate_payment", { orderId: order.id, outcome: "success" });
    assert.equal((await request(order.id)).status, 409);
    assert.equal(calls, 0); assert.equal((await client.records()).orders.length, 1); assert.equal((await client.records()).invoices.length, 1);
  } finally { globalThis.fetch = rawFetch; }
});

import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { toolPOST } from "@/lib/works/heating/api";
import { agentActionPOST, agentResultSchema, focusSchema, validateFocus } from "@/lib/works/heating/agent/api";
import { apiClient } from "./api-client";

process.env.HEATING_SESSION_SECRET = "agent-page-state-test-secret-at-least-32";
process.env.EXPERIMENT_AGENT_TOKEN = "test-agent-token";
process.env.EXPERIMENT_AGENT_URL = "https://agent.example";

test("无状态 Chat→Agno→连续 Tool→提案→明确确认→支付，历史承接、重放、模型失败", async () => {
  const originalFetch = globalThis.fetch;
  const client = apiClient(); await client.call("session");
  let mode = "order", calls = 0, seenHistory: { content: string }[] = [];
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
    if (mode === "order") await invoke("create_payment", { billId: "bill-house-A" }, true);
    if (mode === "pay") await invoke("simulate_payment", { orderId: records.orders[0].id, outcome: "success" }, true);
    return new Response(`event: status\ndata: {"label":"核对中"}\n\nevent: final\ndata: ${JSON.stringify({ answer: "以工具结果为准，提案还需明确确认。", cards: [{ name: "query_records", input: {}, result: records }], usedTools: ["query_records"], degraded: false, demoState, ...(mode === "foreign-focus" ? { replyMode: "results", focus: { billIds: ["bill-house-E"] } } : mode === "focused-query" ? { replyMode: "results", focus: { billIds: ["bill-house-A"] } } : {}) })}\n\n`);
  };
  try {
    const id = randomUUID(); const order = (await client.chat("我想交今年的暖气费。", id)).final;
    assert.ok(order.proposal); assert.equal((await client.records()).orders.length, 0);
    assert.equal(JSON.stringify(order.cards).includes("demoState"), false);
    const count = calls; assert.equal((await client.chat("我想交今年的暖气费。", id)).final.replayed, true); assert.equal(calls, count);
    assert.equal((await client.call("confirm", { proposalId: order.proposal.id, confirmed: false })).status, 400);
    const confirmed = await client.call("confirm", { proposalId: order.proposal.id, confirmed: true }); assert.equal(confirmed.status, 200);
    assert.equal((await client.call("confirm", { proposalId: order.proposal.id, confirmed: true })).status, 200);
    mode = "pay"; const payment = (await client.chat("继续刚才的模拟支付")).final; assert.ok(seenHistory.some(item => item.content.includes("暖气费")));
    assert.equal((await client.call("confirm", { proposalId: payment.proposal.id, confirmed: true })).status, 200);
    assert.equal((await client.records()).invoices.length, 1);
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

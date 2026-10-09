import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { finalSchema, recordsSchema, proposalViewSchema } from "@/lib/works/heating/client-contract";
import { confirmedFocus, replyFocus } from "@/lib/works/heating/chat-view";
import { fixture, confirm } from "./helpers";

test("聊天展示排除初始化全量快照、用可信记录过滤模型引用，不读取伪造金额", async () => {
  const f = await fixture();
  const records = recordsSchema.parse(await f.service.execute(f.session.actor, { name: "query_records", input: {} }));
  const base = { answer: "已核实", cards: [{ name: "query_records", input: {}, result: records }], usedTools: ["query_records"], degraded: false, proposal: null, identityVersion: 0, generation: randomUUID(), demo: true, demoState: "opaque" };
  assert.deepEqual(replyFocus(finalSchema.parse(base), records), { houseIds: [], billIds: [], applicationIds: [], invoiceIds: [] });
  const focused = finalSchema.parse({ ...base, focus: { houseIds: ["house-B"], billIds: [records.bills[0].id, "bill-other-user"], applicationIds: [], invoiceIds: [] }, cards: [{ name: "query_bill", input: {}, result: { id: records.bills[0].id, amountCents: 1, status: "paid" } }] });
  assert.deepEqual(replyFocus(focused, records).billIds, [records.bills[0].id]);
  assert.deepEqual(replyFocus(focused, records).houseIds, []);
  assert.equal(records.bills[0].status, "unpaid"); assert.notEqual(records.bills[0].amountCents, 1);
});

test("确认付款展示对应账单，仍复用原引擎的订单与支付状态", async () => {
  const f = await fixture(), actor = f.session.actor;
  const before = recordsSchema.parse(await f.service.execute(actor, { name: "query_records", input: {} }));
  const order = await confirm(f.service, actor, { name: "create_payment", input: { billId: before.bills[0].id, idempotencyKey: "view-order" } }) as { id: string };
  await confirm(f.service, actor, { name: "simulate_payment", input: { orderId: order.id, outcome: "success", idempotencyKey: "view-pay" } });
  const after = recordsSchema.parse(await f.service.execute(actor, { name: "query_records", input: {} }));
  const proposal = proposalViewSchema.parse({ id: randomUUID(), operation: { name: "simulate_payment", input: { orderId: order.id } }, summary: {}, expiresAt: Date.now() + 1000, requiresExplicitConfirmation: true, demo: true });
  assert.deepEqual(confirmedFocus(before, after, proposal).billIds, [before.bills[0].id]);
  assert.equal(after.bills[0].status, "paid"); assert.equal(after.invoices.length, 1);
});

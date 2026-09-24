import assert from "node:assert/strict";
import test from "node:test";
import { changeOrder, createOrder, demoInterpret, quoteReschedule, resolvePaidReschedule, searchTrips, startPaidReschedule, submitRefund, quoteRefund } from "../../lib/works/island-travel/domain";
import { advanceSupport, containsContactIdentity, reminderTime, submitSupport } from "../../lib/works/island-travel/support";
import { responseSchema } from "../../lib/works/island-travel/schema";

const today = "2026-09-24";
function ticket() {
  const trip = searchTrips({ origin: "海口", destination: "三亚", date: "2026-09-25", quantity: 1 }, today)[0];
  return changeOrder(createOrder([], trip, 1, "ticket-key", true, today), "DJ-0001", "success");
}

test("support confirmation, identity rejection, idempotency and ordered progress", () => {
  const orders = ticket();
  const draft = { key: "confirmation-1", orderId: orders[0].id, kind: "human" as const, description: "需要模拟人工协助" };
  assert.throws(() => submitSupport([], orders, [], draft, false), /确认/);
  assert.throws(() => submitSupport([], orders, [], { ...draft, description: "手机 138 0000 0000" }, true), /手机号/);
  assert.throws(() => submitSupport([], orders, [], { ...draft, description: "证件号 11010119900101001X" }, true), /证件/);
  assert.throws(() => submitSupport([], orders, [], { ...draft, description: "我家在某某小区" }, true), /住址/);
  assert.throws(() => submitSupport([], orders, [], { ...draft, description: "a".repeat(501) }, true), /500/);
  assert.throws(() => submitSupport([], [], [], draft, true), /关联订单/);
  const submitted = submitSupport([], orders, [], draft, true);
  assert.equal(submitted[0].id, "DS-0001");
  assert.equal(submitSupport(submitted, orders, [], draft, true), submitted);
  assert.throws(() => advanceSupport(submitted, "DS-0001", "completed", true), /顺序/);
  assert.throws(() => advanceSupport(submitted, "DS-0001", "processing", false), /确认/);
  const processing = advanceSupport(submitted, "DS-0001", "processing", true);
  const completed = advanceSupport(processing, "DS-0001", "completed", true);
  assert.equal(completed[0].status, "completed");
  assert.equal(advanceSupport(completed, "DS-0001", "completed", true), completed);
  assert.equal(containsContactIdentity("2026-09-25 发车"), false);
});

test("reminder estimate follows rescheduled trip and refund remains a separate state", () => {
  const original = ticket();
  const firstTime = reminderTime(original[0]);
  const target = searchTrips({ origin: "海口", destination: "三亚", date: "2026-09-26", quantity: 1 }, today)[1];
  const quote = quoteReschedule(original, "DJ-0001", target, today);
  const changed = resolvePaidReschedule(startPaidReschedule(original, quote, true, today), "DJ-0001", "success", today).orders;
  assert.notEqual(reminderTime(changed[0]), firstTime);
  const refunded = submitRefund(changed, quoteRefund(changed[0]), "success", true);
  assert.equal(refunded[0].status, "refunded");
});

test("demo understands support and reminder as intents, never actions", () => {
  assert.equal(demoInterpret("我想投诉建议", {}, today).intent, "request_support");
  assert.equal(demoInterpret("帮我关闭出发提醒", {}, today).intent, "request_reminder");
  for (const intent of ["request_support", "request_reminder"]) {
    const payload = { mode: "live", intent, conditions: {}, reply: "", faq: null, selection: null };
    assert.equal(responseSchema.parse(payload).intent, intent);
    assert.equal(responseSchema.safeParse({ ...payload, ticketId: "DS-0001" }).success, false);
  }
});

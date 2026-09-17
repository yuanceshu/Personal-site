import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrder, changeOrder, demoInterpret, searchTrips, shanghaiToday, type Order } from "../../lib/works/island-travel/domain";
import { requestSchema, responseSchema } from "../../lib/works/island-travel/schema";

const today = "2026-09-14";
const conditions = { origin: "海口", destination: "三亚", date: "2026-09-15", quantity: 1 };
const trip = searchTrips(conditions, today)[0];
test("Shanghai midnight and expired schedule boundaries", () => {
  assert.equal(shanghaiToday(new Date("2026-09-14T16:01:00Z")), "2026-09-15");
  assert.equal(searchTrips({ ...conditions, date: "2026-09-13" }, today).length, 0);
  assert.equal(searchTrips({ ...conditions, date: "2026-09-21" }, today).length, 0);
  assert.ok(searchTrips({ ...conditions, date: "2026-09-20" }, today).length);
});
test("clarify, modify, remove time preference, ordinal and unsupported", () => {
  const first = demoInterpret("从海口出发，有什么车？", {}, today);
  assert.equal(first.intent, "clarify");
  const second = demoInterpret("三亚", first.conditions, today);
  assert.equal(second.conditions.destination, "三亚");
  const third = demoInterpret("明天上午", second.conditions, today);
  assert.equal(third.intent, "search_trips");
  const fourth = demoInterpret("改成下午", third.conditions, today);
  assert.equal(fourth.conditions.date, "2026-09-15");
  assert.ok(searchTrips(fourth.conditions, today).every((t) => t.depart >= "12:00" && t.depart < "18:00"));
  assert.equal(demoInterpret("不限", fourth.conditions, today).conditions.time_preference, "不限");
  assert.equal(demoInterpret("选择第二班", fourth.conditions, today).selection, 2);
  assert.equal(demoInterpret("6人", fourth.conditions, today).intent, "unsupported");
  assert.equal(demoInterpret("退款", fourth.conditions, today).intent, "unsupported");
  assert.equal(demoInterpret("你好", fourth.conditions, today).intent, "unsupported");
});
test("confirm, idempotency, new purchase key, inventory and recomputed price", () => {
  assert.throws(() => createOrder([], trip, 1, "one", false, today));
  const first = createOrder([], { ...trip, price: 1 }, 2, "one", true, today);
  assert.equal(first[0].amount, trip.price * 2);
  assert.equal(createOrder(first, trip, 2, "one", true, today), first);
  assert.equal(createOrder(first, trip, 2, "two", true, today).length, 2);
  const scarce = searchTrips(conditions, today)[1];
  assert.throws(() => createOrder([], scarce, 4, "x", true, today));
  const occupied = createOrder([], scarce, 3, "full", true, today);
  assert.throws(() => createOrder(occupied, scarce, 1, "next", true, today));
  assert.throws(() => createOrder([], trip, 0, "bad", true, today));
});
test("unknown requires lookup; ticket failure never pays twice; failure retries same order", () => {
  const orders = createOrder([], trip, 1, "one", true, today);
  const pending = changeOrder(orders, orders[0].id, "unknown");
  assert.throws(() => changeOrder(pending, pending[0].id, "success"));
  const recovered = changeOrder(pending, pending[0].id, "query");
  assert.equal(recovered[0].status, "ticketed");
  assert.equal(changeOrder(recovered, recovered[0].id, "query"), recovered);
  const failed = changeOrder(orders, orders[0].id, "failed");
  assert.equal(changeOrder(failed, failed[0].id, "success")[0].status, "ticketed");
  const ticket = changeOrder(orders, orders[0].id, "ticketing_failed");
  assert.throws(() => changeOrder(ticket, ticket[0].id, "failed"));
  assert.equal(changeOrder(ticket, ticket[0].id, "retry_ticket")[0].status, "ticketed");
  assert.equal(orders[0].status, "pending");
  assert.throws(() => changeOrder([] as Order[], "missing", "success"));
});
test("wire boundary rejects identity, transaction injection, invalid dates and long history", () => {
  assert.ok(requestSchema.safeParse({ message: "明天去三亚", conditions }).success);
  assert.ok(requestSchema.safeParse({ message: "2026-09-15从海口去三亚", conditions }).success);
  for (const message of ["我的手机号 138 0000 0000", "110101199001010000", "2026-09-15 手机138-0000-0000", " "]) assert.equal(requestSchema.safeParse({ message }).success, false);
  assert.equal(requestSchema.safeParse({ message: "去三亚", passenger: { name: "x" } }).success, false);
  assert.equal(requestSchema.safeParse({ message: "去三亚", history: Array(17).fill({ role: "user", content: "hi" }) }).success, false);
  assert.equal(requestSchema.safeParse({ message: "hi", conditions: { date: "2026-02-30" } }).success, false);
  assert.equal(responseSchema.safeParse({ intent: "search_trips", conditions, mode: "live", price: 1 }).success, false);
});

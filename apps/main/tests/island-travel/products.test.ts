import { test } from "node:test";
import assert from "node:assert/strict";
import { changeOrder, createOrder, demoInterpret, quoteReschedule, searchTrips, submitRefund, submitSimpleReschedule } from "../../lib/works/island-travel/domain";
import { buildDoorPlan, changeProductOrder, createProductOrder, matchProducts, productAmountCents, productOffers, productSourceWarning, type ProductOrder } from "../../lib/works/island-travel/products";
import { requestSchema, responseSchema } from "../../lib/works/island-travel/schema";

const today = "2026-09-14";
const date = "2026-09-15";
const trips = searchTrips({ origin: "海口", destination: "三亚", date, quantity: 2 }, today);
const offer = (id: string, orders: ProductOrder[] = []) => productOffers(date, orders, today).find(item => item.id === id)!;
test("three product pricing modes, capacity and seven-day window", () => {
  assert.equal(productAmountCents(offer("airport-haikou"), 3), 8400);
  assert.equal(productAmountCents(offer("sanya-bay"), 3), 10800);
  assert.equal(productAmountCents(offer("sanya-charter"), 4), 18800);
  assert.throws(() => createProductOrder([], [], { offer: offer("sanya-charter"), quantity: 5, key: "bad", sourceTicketId: null, confirmed: true }, today), /容量/);
  assert.equal(productOffers("2026-09-21", [], today).length, 0);
  assert.equal(matchProducts(productOffers(date, [], today), "三亚包车").length, 1);
});
test("product payment recovery, completion and idempotent creation", () => {
  const selection = { offer: offer("sanya-charter"), quantity: 4, key: "a", sourceTicketId: null, confirmed: true };
  const first = createProductOrder([], [], selection, today);
  assert.equal(first[0].id, "DP-0001");
  assert.equal(createProductOrder(first, [], selection, today), first);
  assert.throws(() => createProductOrder([], [], { ...selection, confirmed: false }, today), /核对/);
  const failed = changeProductOrder(first, "DP-0001", "failed");
  assert.equal(failed[0].status, "payment_failed");
  const unknown = changeProductOrder(failed, "DP-0001", "unknown");
  assert.throws(() => changeProductOrder(unknown, "DP-0001", "success"), /不能重复支付/);
  const ready = changeProductOrder(unknown, "DP-0001", "query");
  assert.equal(ready[0].status, "ready");
  assert.equal(changeProductOrder(ready, "DP-0001", "complete")[0].status, "completed");
  assert.throws(() => changeProductOrder(ready, "DP-0001", "query"), /不需要查单/);
  assert.throws(() => createProductOrder(first, [], { ...selection, key: "other" }, today), /余量不足/);
});
test("linked product survives ticket refund and reschedule with warning", () => {
  const ticket = changeOrder(createOrder([], trips[0], 2, "ticket", true, today), "DJ-0001", "success");
  const linked = createProductOrder([], ticket, { offer: offer("sanya-arrival"), quantity: 2, key: "linked", sourceTicketId: "DJ-0001", sourceTripId: ticket[0].trip.id, sourceFareVersion: ticket[0].fareVersion, confirmed: true }, today);
  assert.equal(linked[0].sourceTripId, trips[0].id);
  assert.equal(productSourceWarning(linked[0], ticket), null);
  const refund = submitRefund(ticket, { orderId: "DJ-0001", orderVersion: ticket[0].version, amountCents: 25600, feeCents: 2560, refundCents: 23040 }, "success", true);
  assert.match(productSourceWarning(linked[0], refund)!, /检查接驳/);
  assert.equal(linked[0].status, "pending");
  const target = searchTrips({ origin: "海口", destination: "三亚", date: "2026-09-16", quantity: 2 }, today)[0];
  const quote = quoteReschedule(ticket, "DJ-0001", target, today);
  const moved = submitSimpleReschedule(ticket, quote, "success", true, today);
  assert.match(productSourceWarning(linked[0], moved)!, /检查接驳/);
  assert.throws(() => createProductOrder([], moved, { offer: offer("sanya-arrival"), quantity: 2, key: "stale", sourceTicketId: "DJ-0001", sourceTripId: ticket[0].trip.id, sourceFareVersion: ticket[0].fareVersion, confirmed: true }, today), /已变化/);
  const lateTicket = changeOrder(createOrder([], trips.find(item => item.depart === "09:15")!, 2, "late-ticket", true, today), "DJ-0001", "success");
  assert.throws(() => createProductOrder([], lateTicket, { offer: offer("sanya-arrival"), quantity: 2, key: "late", sourceTicketId: "DJ-0001", sourceTripId: lateTicket[0].trip.id, sourceFareVersion: lateTicket[0].fareVersion, confirmed: true }, today), /换乘缓冲/);
});
test("door plans require fixed connections and sum separately booked legs", () => {
  const plan = buildDoorPlan(trips, [], "海口美兰机场", "三亚湾景区", 2, today)!;
  assert.deepEqual(plan.legs.map(leg => leg.key), ["first", "ticket", "last"]);
  assert.ok(plan.waits.every(wait => wait >= 30));
  assert.equal(plan.totalCents, plan.legs.reduce((sum, leg) => sum + leg.amountCents, 0));
  assert.equal(buildDoorPlan(trips.filter(trip => trip.depart === "13:30"), [], "海口美兰机场", "三亚湾景区", 2, today), null);
  assert.equal(buildDoorPlan(trips, [], "海口美兰机场", "不存在的景区", 2, today), null);
  assert.equal(buildDoorPlan(trips, [], "海口美兰机场", "三亚湾景区", 6, today), null);
  const soldOut: ProductOrder[] = [];
  for (const [id, count, quantity] of [["sanya-bay", 4, 4], ["sanya-arrival", 2, 5], ["sanya-bay-late", 4, 4], ["sanya-charter", 1, 4]] as const) {
    for (let index = 0; index < count; index++) soldOut.push({ id: `DP-${soldOut.length}`, key: `${id}-${index}`, offer: offer(id), quantity, amountCents: productAmountCents(offer(id), quantity), status: "ready", version: 1, sourceTicketId: null, sourceTripId: null, sourceFareVersion: null });
  }
  assert.equal(buildDoorPlan(trips, soldOut, "海口美兰机场", "三亚湾景区", 2, today), null);
});
test("both AI contracts identify local product and door-planning intents", () => {
  assert.equal(demoInterpret("明天三亚接驳 2人", {}, today).intent, "request_product");
  const door = demoInterpret("明天从海口到三亚门到门 2人", {}, today);
  assert.equal(door.intent, "request_door_plan");
  assert.deepEqual([door.conditions.origin, door.conditions.destination, door.conditions.date, door.conditions.quantity], ["海口", "三亚", date, 2]);
  const publicPoints = demoInterpret("明天从海口汽车站到三亚汽车站门到门 2人", {}, today);
  assert.deepEqual([publicPoints.conditions.origin, publicPoints.conditions.destination], ["海口汽车站", "三亚汽车站"]);
  assert.ok(searchTrips(publicPoints.conditions, today).length);
  assert.equal(responseSchema.parse({ intent: "request_product", conditions: {}, reply: "", faq: null, selection: null, mode: "live" }).intent, "request_product");
  assert.equal(requestSchema.safeParse({ message: "我家在某某小区", conditions: {}, history: [] }).success, false);
  assert.equal(requestSchema.safeParse({ message: "出发", conditions: { origin: "某某小区" }, history: [] }).success, false);
});

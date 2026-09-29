/**
 * 琴台票务的确定性业务规则。
 *
 * 这些用例移植自源 Demo 的 `examples/entertainment/api/tests/`（holds / waitlist / transfer /
 * disclosure / scarcity / merchant pacing / merchant backend），断言的是**规则**而不是实现：
 * 计时锁座、每场上限、整组出售、候补回流、转赠可撤回、费用逐项相加等于含税价、护栏与审批台账。
 * 数据取自 `buildDataset`，因此数值随本地化资料变化时，这里只跟着改预期而不是改规则。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildDataset, merchantFixtures } from "../../lib/works/qintai-ticketing/data";
import {
  MIN_QUANTITY_KEY,
  SELLING_FAST_FLOOR,
  TicketStorefront,
} from "../../lib/works/qintai-ticketing/engine/catalog";
import {
  ChangeNotApplicable,
  GuardrailViolation,
  TicketMerchant,
  type RawMerchantFixtures,
} from "../../lib/works/qintai-ticketing/engine/pacing";
import {
  BARCODE_ROTATION_S,
  HOLD_TTL_S,
  MAX_TICKETS_PER_EVENT,
  OFFER_CLAIM_WINDOW_S,
  TicketingError,
} from "../../lib/works/qintai-ticketing/engine/ticketing";
import { createEngine } from "../../lib/works/qintai-ticketing/session";
import type { SessionContext } from "../../lib/works/qintai-ticketing/types";

/** 冻结时钟：所有与时间有关的断言都必须能复现。 */
const NOW = Date.parse("2026-09-29T12:00:00Z");

const PIT = "AT-TIX-101-PIT"; // cap 350 / sold 344 / 余 6
const LOWER = "AT-TIX-101-LOW"; // cap 1200 / sold 815 / 余 385，与 PIT 同一场
const TERRACE = "AT-TIX-101-TER"; // 同一场，余 552
const ELSEWHERE = "AT-TIX-105-ORC"; // 另一场（AT-EVT-105）
const SOLD_OUT = "AT-TIX-103-PIT"; // 整场售罄
const PAIR = "AT-RSL-203"; // 观众转票，按 2 张一组

const MERCHANT_SESSION = { session_id: "merchant-demo", merchant_id: "qintai-wuhan", operator: "运营人员" };
const VIEWER: SessionContext = { session_id: "sess-1", user_id: "demo-user" };

function boot() {
  let clock = NOW;
  const dataset = buildDataset(NOW);
  const engine = createEngine({ dataset, snapshot: null, now: () => clock });
  const storefront = new TicketStorefront(dataset, engine);
  const merchant = new TicketMerchant(dataset, engine, {
    fixtures: merchantFixtures() as unknown as RawMerchantFixtures,
    search: (query, limit) => storefront.searchProducts(VIEWER, query).slice(0, limit),
  });
  return {
    dataset,
    engine,
    storefront,
    merchant,
    advance(seconds: number) {
      clock += seconds * 1000;
    },
  };
}

function capture(work: () => unknown): unknown {
  try {
    work();
  } catch (error) {
    return error;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 锁座：计时、上限、整组出售
// ---------------------------------------------------------------------------

test("加购生成一个带倒计时的锁座，并把座位从可售数里扣掉", () => {
  const { engine, storefront } = boot();
  assert.equal(engine.remaining(PIT), 6);

  storefront.addToCart(VIEWER, PIT, 2);
  const holds = engine.holdsForSession(VIEWER.session_id);
  assert.equal(holds.length, 1);
  assert.equal(holds[0].quantity, 2);
  assert.equal(holds[0].user_id, VIEWER.user_id);
  assert.equal(holds[0].expires_at - NOW, HOLD_TTL_S * 1000);
  assert.equal(engine.remaining(PIT), 4);

  const cart = storefront.getCart(VIEWER);
  assert.equal(cart.items.reduce((sum, item) => sum + item.quantity, 0), 2);
  assert.equal(cart.items[0].price, 1580);
});

test("锁座超时后回到模拟库存，购物车行同时消失", () => {
  const { engine, storefront, advance } = boot();
  storefront.addToCart(VIEWER, PIT, 2);
  assert.equal(engine.remaining(PIT), 4);

  advance(HOLD_TTL_S + 1);
  assert.deepEqual(storefront.getCart(VIEWER).items, []);
  assert.equal(engine.remaining(PIT), 6);
});

test("加量会重置倒计时", () => {
  const { engine, storefront, advance } = boot();
  storefront.addToCart(VIEWER, PIT, 1);
  advance(HOLD_TTL_S - 10);
  storefront.addToCart(VIEWER, PIT, 1);
  advance(HOLD_TTL_S - 5); // 按最初的计时早就该过期了

  const holds = engine.holdsForSession(VIEWER.session_id);
  assert.equal(holds.length, 1);
  assert.equal(holds[0].quantity, 2);
});

test("售罄票档只能候补，不能锁座", () => {
  const { storefront } = boot();
  const error = capture(() => storefront.addToCart(VIEWER, SOLD_OUT, 1));
  assert.ok(error instanceof TicketingError);
  assert.equal(error.kind, "sold_out");
  assert.match(error.message, /候补/);
});

test("锁座不能超过公开余量，也不会超出每场上限", () => {
  const { storefront } = boot();
  const over = capture(() => storefront.addToCart(VIEWER, PIT, 7));
  assert.ok(over instanceof TicketingError);
  assert.match(over.message, /仅剩 6 张/);

  const capped = capture(() => storefront.addToCart(VIEWER, PIT, MAX_TICKETS_PER_EVENT + 1));
  assert.ok(capped instanceof TicketingError);
  assert.equal(capped.kind, "hold_limit");
});

test("每场演出的上限跨票档累计，两条路径都拦得住", () => {
  const { engine, storefront } = boot();
  storefront.addToCart(VIEWER, LOWER, 5);
  storefront.addToCart(VIEWER, PIT, 3); // AT-EVT-101 已满 8 张

  const added = capture(() => storefront.addToCart(VIEWER, TERRACE, 1));
  assert.ok(added instanceof TicketingError);
  assert.equal(added.kind, "hold_limit");

  const grown = capture(() => storefront.updateCartItem(VIEWER, PIT, 4)); // 会变成 9 张
  assert.ok(grown instanceof TicketingError);
  assert.equal(grown.kind, "hold_limit");

  const holds = Object.fromEntries(
    engine.holdsForSession(VIEWER.session_id).map((hold) => [hold.product_id, hold.quantity]),
  );
  assert.deepEqual(holds, { [LOWER]: 5, [PIT]: 3 });
  const shrunk = storefront.updateCartItem(VIEWER, PIT, 2); // 缩小总是允许
  assert.equal(shrunk.items.reduce((sum, item) => sum + item.quantity, 0), 7);

  // 换一场演出不受影响。
  storefront.addToCart(VIEWER, ELSEWHERE, 2);
  assert.equal(engine.holdsForSession(VIEWER.session_id).length, 3);
});

test("观众转票按组出售，不能让买家拆开", () => {
  const { storefront } = boot();
  const split = capture(() => storefront.addToCart(VIEWER, PAIR, 1));
  assert.ok(split instanceof TicketingError);
  assert.equal(split.kind, "state");

  storefront.addToCart(VIEWER, PAIR, 2);
  const shrunk = capture(() => storefront.updateCartItem(VIEWER, PAIR, 1));
  assert.ok(shrunk instanceof TicketingError);
  assert.deepEqual(storefront.updateCartItem(VIEWER, PAIR, 0).items, []);
});

test("改量、移除与清空会话只动自己的锁座", () => {
  const { engine, storefront } = boot();
  const other: SessionContext = { session_id: "sess-2", user_id: "other-user" };

  const held = (session: SessionContext) =>
    storefront.getCart(session).items.reduce((sum, item) => sum + item.quantity, 0);

  storefront.addToCart(VIEWER, PIT, 2);
  storefront.addToCart(other, PIT, 1);
  assert.equal(engine.remaining(PIT), 3);

  storefront.updateCartItem(VIEWER, PIT, 1);
  assert.equal(held(VIEWER), 1);
  assert.equal(engine.remaining(PIT), 4);
  assert.deepEqual(storefront.removeFromCart(VIEWER, PIT).items, []);
  assert.equal(engine.remaining(PIT), 5);

  storefront.addToCart(VIEWER, PIT, 2);
  storefront.resetSession(VIEWER.session_id);
  assert.deepEqual(engine.holdsForSession(VIEWER.session_id), []);
  assert.equal(engine.holdsForSession(other.session_id).length, 1);
});

// ---------------------------------------------------------------------------
// 候补与回流
// ---------------------------------------------------------------------------

test("售罄票档可以候补，退票先给队列里排到的人", () => {
  const { engine, advance } = boot();
  assert.equal(engine.joinWaitlist(VIEWER.user_id, VIEWER.session_id, SOLD_OUT, 2), 1);
  const entries = engine.waitlistEntriesFor(VIEWER.user_id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].position, 1);

  // 退回的座位被还给队列，而不是直接回到公开库存。
  engine.recordReturn(SOLD_OUT, 2);
  assert.equal(engine.remaining(SOLD_OUT), 0);

  const offers = engine.offersFor(VIEWER.user_id);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].quantity, 2);
  assert.equal(offers[0].expires_at - NOW, OFFER_CLAIM_WINDOW_S * 1000);

  const hold = engine.claimOffer(offers[0].offer_id, VIEWER.user_id, VIEWER.session_id);
  assert.equal(hold.quantity, 2);
  assert.equal(hold.product_id, SOLD_OUT);
  assert.deepEqual(engine.offersFor(VIEWER.user_id), []);

  // 同一张回流单不能被领第二次。
  const again = capture(() => engine.claimOffer(offers[0].offer_id, VIEWER.user_id, VIEWER.session_id));
  assert.ok(again instanceof TicketingError);
  assert.equal(again.kind, "state");

  advance(1);
  assert.deepEqual(engine.offersFor(VIEWER.user_id), []);
});

test("回流单过期后顺延给队列中的下一位", () => {
  const { engine, advance } = boot();
  const second: SessionContext = { session_id: "sess-2", user_id: "second-user" };
  engine.joinWaitlist(VIEWER.user_id, VIEWER.session_id, SOLD_OUT, 2);
  engine.joinWaitlist(second.user_id, second.session_id, SOLD_OUT, 2);
  engine.recordReturn(SOLD_OUT, 2);

  const first = engine.offersFor(VIEWER.user_id)[0];
  assert.equal(first.quantity, 2);
  advance(OFFER_CLAIM_WINDOW_S + 1);
  engine.sweep();

  assert.deepEqual(engine.offersFor(VIEWER.user_id), []);
  const rolled = engine.offersFor(second.user_id);
  assert.equal(rolled.length, 1);
  assert.equal(rolled[0].quantity, 2);
  assert.ok(engine.collectNotifications().some((notice) => notice.user_id === VIEWER.user_id));
});

// ---------------------------------------------------------------------------
// 票夹、条码与转赠
// ---------------------------------------------------------------------------

test("电子票条码按固定周期轮换，且不泄漏票号", () => {
  const { engine, advance } = boot();
  const tickets = engine.ticketsFor(VIEWER.user_id);
  assert.ok(tickets.length > 0);

  const first = engine.barcode(tickets[0].ticket_id);
  assert.match(first, /^[0-9A-F]+$/);
  assert.ok(!first.includes(tickets[0].ticket_id));

  advance(BARCODE_ROTATION_S - 1);
  assert.equal(engine.barcode(tickets[0].ticket_id), first);
  advance(2);
  assert.notEqual(engine.barcode(tickets[0].ticket_id), first);
});

test("转赠可撤回，撤回后票回到原主", () => {
  const { engine } = boot();
  const ticket = engine.ticketsFor(VIEWER.user_id)[0];

  const transfer = engine.initiateTransfer(VIEWER.user_id, [ticket.ticket_id], "好友");
  assert.equal(transfer.status, "pending");
  assert.deepEqual(engine.pendingTransfersFor(VIEWER.user_id).map((row) => row.transfer_id), [
    transfer.transfer_id,
  ]);

  engine.cancelTransfer(VIEWER.user_id, transfer.transfer_id);
  assert.deepEqual(engine.pendingTransfersFor(VIEWER.user_id), []);
  assert.ok(engine.ticketsFor(VIEWER.user_id).some((row) => row.ticket_id === ticket.ticket_id));
});

test("不能转赠别人的票", () => {
  const { engine } = boot();
  const ticket = engine.ticketsFor(VIEWER.user_id)[0];
  const error = capture(() => engine.initiateTransfer("someone-else", [ticket.ticket_id], "好友"));
  assert.ok(error instanceof TicketingError);
  assert.equal(error.kind, "ownership");
});

// ---------------------------------------------------------------------------
// 目录、费用披露与真实稀缺
// ---------------------------------------------------------------------------

test("费用逐项相加等于含全部费用的价格", () => {
  const { storefront } = boot();
  const disclosure = storefront.getDisclosure(VIEWER, PIT);
  assert.ok(disclosure);

  const amount = (value: string) => Number(value.replace(/[^\d.]/g, ""));
  const parts = disclosure.rows
    .filter((row) => ["票面价", "服务费", "场馆费", "订单处理费"].includes(row.label))
    .map((row) => amount(row.value));
  assert.ok(parts.length >= 3);
  assert.equal(parts.reduce((sum, value) => sum + value, 0), amount(disclosure.rows[0].value));

  // 余量口径与引擎一致，且明确声明是模拟库存。
  assert.ok(disclosure.footnotes.some((note) => note.includes("模拟")));
});

test("余量标签由程序判定，且与阈值口径一致", () => {
  const { storefront, engine } = boot();
  const pit = storefront.withLiveState(storefront.products[PIT]);
  assert.ok(pit.attributes.tickets_remaining === String(engine.remaining(PIT)));
  assert.ok(
    pit.labels.some((label) => label.includes(String(engine.remaining(PIT)))),
    "还剩 6 张的票档应当带上售票较快的提示",
  );
  assert.ok(Math.max(SELLING_FAST_FLOOR, Math.floor(350 / 50)) === 12);
});

test("检索只返回本地化资料里的演出，中文别名能命中", () => {
  const { storefront } = boot();
  // 默认只取前 8 条，这里要看全量排名，所以显式放大上限。
  const ids = storefront
    .searchProducts(VIEWER, "如梦之梦", null, 40)
    .map((product) => product.product_id);
  assert.ok(ids.includes(PIT));
  assert.ok(ids.every((id) => id.startsWith("AT-")));

  const sold = storefront
    .searchProducts(VIEWER, "嗜血博士", null, 40)
    .map((product) => product.product_id);
  assert.deepEqual(sold.filter((id) => id.startsWith("AT-TIX-106-")).length, 3);

  // 张数过滤是硬过滤：余量不足的票档不出现。
  const pairs = storefront.searchProducts(
    VIEWER,
    "如梦之梦",
    { attributes: { [MIN_QUANTITY_KEY]: "4" } },
    40,
  );
  assert.ok(pairs.length > 0);
  assert.ok(pairs.every((product) => Number(product.attributes.tickets_remaining) >= 4));
});

// ---------------------------------------------------------------------------
// 运营侧：排期、告警、护栏与审批台账
// ---------------------------------------------------------------------------

test("运营台的场次清单与票档编号是两套编号", () => {
  const { merchant } = boot();
  assert.deepEqual(merchant.eventIds(), [
    "AT-EVT-101",
    "AT-EVT-102",
    "AT-EVT-103",
    "AT-EVT-104",
    "AT-EVT-105",
    "AT-EVT-106",
  ]);
  assert.ok(merchant.portfolioIds().every((id) => id.startsWith("AT-TIX-")));

  const rows = merchant.eventPacingRows(merchant.eventIds());
  assert.equal(rows.length, 6);
  const first = rows[0] as { event_id: string; tiers: Array<Record<string, unknown>> };
  assert.equal(first.event_id, "AT-EVT-101");
  assert.deepEqual(first.tiers.map((tier) => tier.product_id), [PIT, LOWER, TERRACE]);
  assert.equal(first.tiers[0].remaining, 6);
  assert.equal(first.tiers[0].pace_vs_baseline_pts, 25.7);

  // 拿票档编号换不到任何行——这正是界面必须传场次编号的原因。
  assert.deepEqual(merchant.eventPacingRows(merchant.portfolioIds()), []);
});

test("告警与订单问题来自程序判定", () => {
  const { merchant } = boot();
  const alerts = merchant.computeAlerts();
  assert.equal(alerts.filter((alert) => alert.kind === "low_stock").length, 2);
  assert.equal(alerts.filter((alert) => alert.kind === "slow_mover").length, 4);
  assert.ok(alerts.some((alert) => alert.listing_id === PIT && alert.stock === 6 && alert.threshold === 12));
  assert.equal(merchant.getOrderIssues().length, 6);
  assert.deepEqual(merchant.alertCounts(), {
    low_stock: 2,
    slow_movers: 4,
    order_issues: 6,
    pending_changes: 0,
  });
});

test("改价先暂存，应用后才写穿模拟库存", () => {
  const { merchant } = boot();
  assert.equal(merchant.getPricingContext(PIT)?.current_price, 1580);

  const change = merchant.stagePriceUpdate(MERCHANT_SESSION, [{ listing_id: PIT, new_price: 1700 }], "排期提前");
  assert.equal(change.status, "staged");
  assert.equal(change.kind, "price_update");
  assert.equal(merchant.getPendingChanges().length, 1);
  // 暂存不改价。
  assert.equal(merchant.getPricingContext(PIT)?.current_price, 1580);

  const applied = merchant.applyChange(MERCHANT_SESSION, change.change_id);
  assert.equal(applied.status, "applied");
  assert.equal(merchant.getPricingContext(PIT)?.current_price, 1700);
  assert.equal(merchant.getPendingChanges().length, 0);
  assert.equal(merchant.ledger.resolved().length, 1);
});

test("丢弃的提案不会写穿，也不能被应用第二次", () => {
  const { merchant } = boot();
  const change = merchant.stagePriceUpdate(MERCHANT_SESSION, [{ listing_id: PIT, new_price: 1700 }], "试一下");
  merchant.discardChange(MERCHANT_SESSION, change.change_id);

  assert.equal(merchant.getPendingChanges().length, 0);
  assert.equal(merchant.getPricingContext(PIT)?.current_price, 1580);
  const again = capture(() => merchant.applyChange(MERCHANT_SESSION, change.change_id));
  assert.ok(again instanceof ChangeNotApplicable);
});

test("改价幅度与活动折扣都受护栏约束", () => {
  const { merchant } = boot();
  const tooFar = capture(() =>
    merchant.stagePriceUpdate(MERCHANT_SESSION, [{ listing_id: PIT, new_price: 1912 }], "大幅提价"),
  );
  assert.ok(tooFar instanceof GuardrailViolation);
  assert.match(tooFar.violations.join(" "), /20/);

  const tooDeep = capture(() =>
    merchant.stagePromotion(MERCHANT_SESSION, {
      name: "双十一",
      listing_ids: [PIT],
      discount_pct: 60,
      starts: "2026-09-29",
      ends: "2026-10-16",
      nights: null,
    }),
  );
  assert.ok(tooDeep instanceof GuardrailViolation);

  const allowed = merchant.stagePromotion(MERCHANT_SESSION, {
    name: "会员日",
    listing_ids: [PIT],
    discount_pct: 30,
    starts: "2026-09-29",
    ends: "2026-10-16",
    nights: null,
  });
  assert.equal(allowed.kind, "promotion");
  const notes = [...allowed.guardrail_notes, ...allowed.items.map((item) => String(item.field))].join(" ");
  assert.match(notes, /price|价格|折扣/i);
});

test("补货的上限是「真正可释放的保留座位」，不是配置里的 500 张", () => {
  const { engine, merchant } = boot();
  const capacity = engine.capacity(PIT);

  // PIT 只有运营保留 8 + 制作保留 6 可以释放。
  const tooMany = capture(() =>
    merchant.stageInventoryAction(MERCHANT_SESSION, [{ listing_id: PIT, action: "restock", quantity: 50 }], "补货"),
  );
  assert.ok(tooMany instanceof GuardrailViolation);
  assert.match(tooMany.violations.join(" "), /可释放/);

  const change = merchant.stageInventoryAction(
    MERCHANT_SESSION,
    [{ listing_id: PIT, action: "restock", quantity: 14 }],
    "释放保留座位",
  );
  merchant.applyChange(MERCHANT_SESSION, change.change_id);
  assert.equal(engine.capacity(PIT), capacity + 14);
  assert.equal(engine.remaining(PIT), 20);
});

test("台账可以序列化再恢复，刷新后待审批提案不丢", () => {
  const { merchant } = boot();
  const change = merchant.stagePriceUpdate(MERCHANT_SESSION, [{ listing_id: PIT, new_price: 1700 }], "排期提前");
  const state = merchant.ledger.serialize();
  assert.equal(state.sequence, 1);
  assert.equal(state.changes.length, 1);

  const restored = new TicketMerchant(buildDataset(NOW), createEngine({ dataset: buildDataset(NOW), snapshot: null, now: () => NOW }), {
    fixtures: merchantFixtures() as unknown as RawMerchantFixtures,
  });
  assert.equal(restored.getPendingChanges().length, 0);
  restored.ledger.restore(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(
    restored.getPendingChanges().map((row) => row.change_id),
    [change.change_id],
  );
});

test("经营快照的口径与阈值来自同一套常量", () => {
  const { merchant } = boot();
  const snapshot = merchant.getBusinessSnapshot("last_30_days");
  assert.equal(snapshot.currency, "CNY");
  assert.equal(snapshot.orders, 1148);
  assert.ok(snapshot.sales > 0);
  assert.equal(snapshot.alerts.pending_changes, merchant.getPendingChanges().length);

  const today = merchant.todaySnapshot() as { upcoming: Array<Record<string, unknown>> } | null;
  assert.ok(today);
  assert.ok(today.upcoming.length > 0);
});

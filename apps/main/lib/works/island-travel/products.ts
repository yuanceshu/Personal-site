import { addDays, shanghaiToday, type Order, type PaymentResult, type Trip } from "./domain";

export type ProductKind = "shuttle" | "direct" | "charter";
export type ProductSeed = { id: string; kind: ProductKind; title: string; from: string; to: string; depart: string; minutes: number; priceCents: number; capacity: number; slots: number };
export type ProductOffer = ProductSeed & { date: string; arrive: string; available: number };
export type ProductStatus = "pending" | "payment_failed" | "payment_unknown" | "ready" | "completed";
export type ProductOrder = { id: string; key: string; offer: ProductOffer; quantity: number; amountCents: number; status: ProductStatus; version: number; sourceTicketId: string | null; sourceTripId: string | null; sourceFareVersion: number | null };
export type ProductSelection = { offer: ProductOffer; quantity: number; key: string; sourceTicketId: string | null; sourceTripId?: string; sourceFareVersion?: number; confirmed: boolean };
export const productKindLabels: Record<ProductKind, string> = { shuttle: "车站接驳", direct: "景区直通车", charter: "包车" };
export const productStatusLabels: Record<ProductStatus, string> = { pending: "待支付", payment_failed: "支付失败", payment_unknown: "支付确认中", ready: "服务待使用", completed: "演示已完成" };
export const productCatalog: ProductSeed[] = [
  { id: "airport-haikou", kind: "shuttle", title: "美兰机场 · 车站接驳", from: "海口美兰机场", to: "海口汽车站", depart: "06:00", minutes: 45, priceCents: 2800, capacity: 5, slots: 2 },
  { id: "haikou-airport", kind: "shuttle", title: "车站 · 美兰机场接驳", from: "海口汽车站", to: "海口美兰机场", depart: "18:00", minutes: 45, priceCents: 2800, capacity: 5, slots: 2 },
  { id: "sanya-bay", kind: "direct", title: "三亚湾景区直通车", from: "三亚汽车站", to: "三亚湾景区", depart: "12:00", minutes: 40, priceCents: 3600, capacity: 8, slots: 2 },
  { id: "sanya-arrival", kind: "shuttle", title: "三亚站 · 抵达接驳", from: "三亚汽车站", to: "三亚湾景区", depart: "11:45", minutes: 45, priceCents: 3200, capacity: 5, slots: 2 },
  { id: "sanya-bay-late", kind: "direct", title: "三亚湾景区直通车 · 下午", from: "三亚汽车站", to: "三亚湾景区", depart: "17:00", minutes: 40, priceCents: 3600, capacity: 8, slots: 2 },
  { id: "sanya-charter", kind: "charter", title: "三亚站 · 景区包车", from: "三亚汽车站", to: "三亚湾景区", depart: "12:00", minutes: 45, priceCents: 18800, capacity: 4, slots: 1 },
  { id: "haikou-charter", kind: "charter", title: "美兰机场 · 海口站包车", from: "海口美兰机场", to: "海口汽车站", depart: "06:00", minutes: 40, priceCents: 16800, capacity: 4, slots: 1 },
];

export function minutes(time: string) { return Number(time.slice(0, 2)) * 60 + Number(time.slice(3)); }
export function timeAt(value: number) { return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }
export function productOffers(date: string, orders: ProductOrder[], today = shanghaiToday()): ProductOffer[] {
  if (date < today || date > addDays(today, 6)) return [];
  return productCatalog.map(seed => {
    const occupied = orders.filter(order => order.offer.id === seed.id && order.offer.date === date).reduce((sum, order) => sum + (order.offer.kind === "charter" ? 1 : order.quantity), 0);
    return { ...seed, date, arrive: timeAt(minutes(seed.depart) + seed.minutes), available: seed.slots * (seed.kind === "charter" ? 1 : seed.capacity) - occupied };
  });
}
export function productAmountCents(offer: ProductOffer, quantity: number) { return offer.kind === "charter" ? offer.priceCents : offer.priceCents * quantity; }
export function matchProducts(offers: ProductOffer[], query: string) {
  const kind = /包车/.test(query) ? "charter" : /直通车/.test(query) ? "direct" : /接驳/.test(query) ? "shuttle" : null;
  const places = ["海口", "三亚", "美兰机场", "汽车站", "景区"].filter(place => query.includes(place));
  return offers.filter(offer => (!kind || offer.kind === kind) && places.every(place => `${offer.from} ${offer.to}`.includes(place)));
}
export function createProductOrder(orders: ProductOrder[], tickets: Order[], selection: ProductSelection, today = shanghaiToday()): ProductOrder[] {
  if (orders.some(order => order.key === selection.key)) return orders;
  if (!selection.confirmed) throw new Error("请先核对产品、人数及金额并确认。");
  const { offer, quantity } = selection;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5 || quantity > offer.capacity) throw new Error("乘坐人数超过本产品容量。");
  const current = productOffers(offer.date, orders, today).find(item => item.id === offer.id);
  if (!current || current.available < (current.kind === "charter" ? 1 : quantity)) throw new Error("该服务余量不足或日期已过，请重新选择。");
  if (current.priceCents !== offer.priceCents || current.depart !== offer.depart) throw new Error("价格或时间已变化，请重新核对。");
  const source = selection.sourceTicketId ? tickets.find(ticket => ticket.id === selection.sourceTicketId && ticket.status === "ticketed") : null;
  if (selection.sourceTicketId && !source) throw new Error("来源车票已变化，请从行程重新安排接驳。");
  if (source && (selection.sourceTripId !== source.trip.id || selection.sourceFareVersion !== source.fareVersion)) throw new Error("关联车票已变化，请重新核对接驳安排。");
  if (source?.reschedule) throw new Error("关联车票改签处理中，请先完成或取消改签再安排交通服务。");
  if (source) {
    const before = source.trip.origin + "汽车站" === offer.to && minutes(offer.arrive) + 30 <= minutes(source.trip.depart);
    const after = source.trip.destination + "汽车站" === offer.from && minutes(source.trip.arrive) + 30 <= minutes(offer.depart);
    if (source.trip.date !== offer.date || (!before && !after)) throw new Error("此产品与来源车票不满足 30 分钟换乘缓冲，请重新选择。");
  }
  return [...orders, { id: `DP-${String(orders.length + 1).padStart(4, "0")}`, key: selection.key, offer: current, quantity, amountCents: productAmountCents(current, quantity), status: "pending", version: 1, sourceTicketId: source?.id ?? null, sourceTripId: source?.trip.id ?? null, sourceFareVersion: source?.fareVersion ?? null }];
}
export function changeProductOrder(orders: ProductOrder[], id: string, action: Exclude<PaymentResult, "ticketing_failed"> | "query" | "complete"): ProductOrder[] {
  const order = orders.find(item => item.id === id);
  if (!order) throw new Error("没有找到这个演示产品订单。");
  let status: ProductStatus;
  if (action === "complete") { if (order.status !== "ready") throw new Error("只有待使用服务可模拟完成。"); status = "completed"; }
  else if (action === "query") { if (order.status !== "payment_unknown") throw new Error("当前订单不需要查单。"); status = "ready"; }
  else { if (order.status !== "pending" && order.status !== "payment_failed") throw new Error("请先处理当前支付状态，不能重复支付。"); status = ({ success: "ready", failed: "payment_failed", unknown: "payment_unknown" } as const)[action]; }
  return orders.map(item => item.id === id ? { ...item, status, version: item.version + 1 } : item);
}
export function productSourceWarning(order: ProductOrder, tickets: Order[]) {
  if (!order.sourceTicketId) return null;
  const source = tickets.find(ticket => ticket.id === order.sourceTicketId);
  if (source?.reschedule) return "关联车票改签处理中，请完成后重新检查接驳安排；产品订单不会自动更改。";
  return !source || source.status === "refunded" || source.trip.id !== order.sourceTripId || source.fareVersion !== order.sourceFareVersion
    ? "关联车票已退款或改签，请重新检查接驳时间与地点；产品订单不会自动退款或更改。" : null;
}

export type DoorLeg = { key: "first" | "ticket" | "last"; kind: "product" | "ticket"; title: string; from: string; to: string; depart: string; arrive: string; amountCents: number; offer?: ProductOffer; trip?: Trip };
export type DoorPlan = { id: string; date: string; quantity: number; legs: DoorLeg[]; totalCents: number; waits: number[] };
export function buildDoorPlan(trips: Trip[], products: ProductOrder[], from: string, to: string, quantity: number, today = shanghaiToday()): DoorPlan | null {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) return null;
  for (const trip of trips) {
    const offers = productOffers(trip.date, products, today).filter(offer => offer.available >= (offer.kind === "charter" ? 1 : quantity) && offer.capacity >= quantity);
    const first = from === `${trip.origin}汽车站` ? null : offers.find(offer => offer.from === from && offer.to === `${trip.origin}汽车站` && minutes(offer.arrive) + 30 <= minutes(trip.depart));
    const last = to === `${trip.destination}汽车站` ? null : offers.find(offer => offer.from === `${trip.destination}汽车站` && offer.to === to && minutes(trip.arrive) + 30 <= minutes(offer.depart));
    if ((from !== `${trip.origin}汽车站` && !first) || (to !== `${trip.destination}汽车站` && !last)) continue;
    const legs: DoorLeg[] = [
      ...(first ? [{ key: "first" as const, kind: "product" as const, title: productKindLabels[first.kind], from: first.from, to: first.to, depart: first.depart, arrive: first.arrive, amountCents: productAmountCents(first, quantity), offer: first }] : []),
      { key: "ticket", kind: "ticket", title: "城际客运", from: trip.origin + "汽车站", to: trip.destination + "汽车站", depart: trip.depart, arrive: trip.arrive, amountCents: trip.price * quantity * 100, trip } as DoorLeg,
      ...(last ? [{ key: "last" as const, kind: "product" as const, title: productKindLabels[last.kind], from: last.from, to: last.to, depart: last.depart, arrive: last.arrive, amountCents: productAmountCents(last, quantity), offer: last }] : []),
    ];
    return { id: `${trip.id}:${from}:${to}:${quantity}`, date: trip.date, quantity, legs, totalCents: legs.reduce((sum, leg) => sum + leg.amountCents, 0), waits: legs.slice(0, -1).map((leg, index) => minutes(legs[index + 1].depart) - minutes(leg.arrive)) };
  }
  return null;
}

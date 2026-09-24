import { cities, departures, routeSeeds } from "@/content/projects/demos/island-travel";
import type { Conditions, Interpretation } from "./schema";

export type Trip = { id: string; origin: string; destination: string; date: string; depart: string; arrive: string; minutes: number; price: number; seats: number };
export type OrderStatus = "pending" | "payment_failed" | "payment_unknown" | "ticketing_failed" | "ticketed" | "refunded";
export type PaymentResult = "success" | "failed" | "unknown" | "ticketing_failed";
export type JourneyStage = "upcoming" | "boarding" | "en_route" | "completed";
export type InvoiceTitle = "personal" | "company";
export type RescheduleQuote = { key: string; orderId: string; orderVersion: number; fromTripId: string; targetTripId: string; targetDate: string; oldAmountCents: number; newAmountCents: number; deltaCents: number };
export type RescheduleAttempt = { quote: RescheduleQuote; state: "pending" | "payment_failed" | "payment_unknown" };
export type OrderEvent =
  | { type: "reschedule"; key: string; from: Trip; to: Trip; deltaCents: number }
  | { type: "refund"; refundCents: number; feeCents: number }
  | { type: "invoice"; title: InvoiceTitle; amountCents: number; fareVersion: number };
export type Order = { id: string; key: string; trip: Trip; quantity: number; amount: number; initialAmountCents: number; status: OrderStatus; journeyStage: JourneyStage; version: number; fareVersion: number; reschedule: RescheduleAttempt | null; events: OrderEvent[] };
export type RefundQuote = { orderId: string; orderVersion: number; amountCents: number; feeCents: number; refundCents: number };
export const statusLabels: Record<OrderStatus, string> = { pending: "待支付", payment_failed: "支付失败", payment_unknown: "支付确认中", ticketing_failed: "已支付 · 出票异常", ticketed: "已出票", refunded: "已退款" };
export const journeyLabels: Record<JourneyStage, string> = { upcoming: "待出发", boarding: "演示检票中", en_route: "演示行程中", completed: "演示已到达" };

export function shanghaiToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function addDays(day: string, n: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}
export function dateLabel(day?: string | null) {
  return day ? `${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日` : "待定日期";
}
export function missingCondition(c: Conditions) {
  return !c.origin ? "出发地" : !c.destination ? "目的地" : !c.date ? "出发日期" : null;
}
export function normalizeCity(value: string) {
  return cities.find((city) => value.includes(city)) ?? value.trim();
}
export function searchTrips(c: Conditions, today = shanghaiToday(), orders: Order[] = []): Trip[] {
  if (missingCondition(c) || !c.date || c.date < today || c.date > addDays(today, 6)) return [];
  const route = routeSeeds.find((r) => r.origin === normalizeCity(c.origin!) && r.destination === normalizeCity(c.destination!));
  if (!route) return [];
  return departures.map((d) => {
    const id = `${route.origin}-${route.destination}-${c.date}-${d.time}`;
    const occupied = orders.filter((o) => o.trip.id === id && o.status !== "refunded").reduce((sum, o) => sum + o.quantity, 0);
    const start = Number(d.time.slice(0, 2)) * 60 + Number(d.time.slice(3));
    const end = start + route.duration;
    return { id, origin: route.origin, destination: route.destination, date: c.date!, depart: d.time, arrive: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`, minutes: route.duration, price: route.price + d.supplement, seats: d.seats - occupied };
  }).filter((t) => t.seats >= (c.quantity ?? 1) && (
    !c.time_preference || c.time_preference === "不限" ||
    (c.time_preference === "上午" && t.depart < "12:00") ||
    (c.time_preference === "下午" && t.depart >= "12:00" && t.depart < "18:00") ||
    (c.time_preference === "晚上" && t.depart >= "18:00")
  ));
}

export function createOrder(orders: Order[], trip: Trip, quantity: number, key: string, confirmed: boolean, today = shanghaiToday()): Order[] {
  if (orders.some((o) => o.key === key)) return orders;
  if (!confirmed) throw new Error("请先核对行程并勾选确认。");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) throw new Error("每个演示订单支持 1–5 位乘客。");
  const available = searchTrips({ origin: trip.origin, destination: trip.destination, date: trip.date, quantity }, today, orders).find((t) => t.id === trip.id);
  if (!available) throw new Error("该班次余票不足或日期已过，请重新查询。");
  const amount = available.price * quantity;
  return [...orders, { id: `DJ-${String(orders.length + 1).padStart(4, "0")}`, key, trip: { ...available }, quantity, amount, initialAmountCents: amount * 100, status: "pending", journeyStage: "upcoming", version: 1, fareVersion: 1, reschedule: null, events: [] }];
}
export function changeOrder(orders: Order[], id: string, action: PaymentResult | "query" | "retry_ticket"): Order[] {
  const order = orders.find((o) => o.id === id);
  if (!order) throw new Error("没有找到这个演示订单。");
  if (order.status === "ticketed") return orders;
  let status: OrderStatus;
  if (action === "query") {
    if (order.status !== "payment_unknown") throw new Error("当前订单不需要查询支付结果。");
    status = "ticketed";
  } else if (action === "retry_ticket") {
    if (order.status !== "ticketing_failed") throw new Error("当前订单不需要重试出票。");
    status = "ticketed";
  } else {
    if (!["pending", "payment_failed"].includes(order.status)) throw new Error("请先处理当前订单状态，不能重复支付。");
    status = { success: "ticketed", failed: "payment_failed", unknown: "payment_unknown", ticketing_failed: "ticketing_failed" }[action] as OrderStatus;
  }
  return orders.map((o) => o.id === id ? { ...o, status, version: o.version + 1 } : o);
}

export function advanceJourney(orders: Order[], id: string, next: JourneyStage): Order[] {
  const order = orders.find(o => o.id === id);
  if (!order || order.status !== "ticketed") throw new Error("只有已出票订单可以体验行程状态。");
  if (order.reschedule) throw new Error("改签处理中，请先完成改签支付或查单。");
  const stages: JourneyStage[] = ["upcoming", "boarding", "en_route", "completed"];
  if (stages.indexOf(next) !== stages.indexOf(order.journeyStage) + 1) throw new Error("请按检票、发车、到达的顺序体验。");
  return orders.map(o => o.id === id ? { ...o, journeyStage: next, version: o.version + 1 } : o);
}

export function quoteRefund(order: Order): RefundQuote {
  const reason = refundUnavailableReason(order);
  if (reason) throw new Error(reason);
  const amountCents = order.amount * 100;
  const feeCents = Math.round(amountCents / 10);
  return { orderId: order.id, orderVersion: order.version, amountCents, feeCents, refundCents: amountCents - feeCents };
}

export function submitRefund(orders: Order[], quote: RefundQuote, result: "success" | "failed", confirmed: boolean): Order[] {
  if (!confirmed) throw new Error("请先核对试算并确认演示退票。");
  const order = orders.find(o => o.id === quote.orderId);
  if (!order) throw new Error("没有找到这个演示订单。");
  if (order.status === "refunded") return orders;
  if (order.version !== quote.orderVersion) throw new Error("订单已有变化，旧试算已失效，请重新试算。");
  const current = quoteRefund(order);
  if (Object.keys(current).some(key => current[key as keyof RefundQuote] !== quote[key as keyof RefundQuote])) throw new Error("试算内容已变化，请重新试算。");
  if (result === "failed") return orders;
  return orders.map(o => o.id === order.id ? { ...o, status: "refunded" as const, version: o.version + 1, events: [...o.events, { type: "refund" as const, refundCents: quote.refundCents, feeCents: quote.feeCents }] } : o);
}

export function refundUnavailableReason(order: Order): string | null {
  if (order.reschedule) return "改签处理中，请先完成改签支付或查单。";
  if (order.status !== "ticketed" || order.journeyStage !== "upcoming") return "仅已出票且待出发的车票可体验退票。";
  return null;
}

export function rescheduleUnavailableReason(order: Order): string | null {
  if (order.reschedule) return "已有进行中的改签，请先完成支付或查单。";
  if (order.status !== "ticketed" || order.journeyStage !== "upcoming") return "仅已出票且待出发的车票可改签。";
  return null;
}

export function invoiceUnavailableReason(order: Order): string | null {
  if (order.reschedule) return "改签处理中，完成后再申请演示开票。";
  if (order.status !== "ticketed") return "仅已出票且未退款的订单可申请演示开票。";
  if (activeInvoice(order)) return "当前票价版本已有有效演示开票记录。";
  return null;
}

export function activeInvoice(order: Order) {
  if (order.status !== "ticketed") return null;
  return order.events.findLast((event): event is Extract<OrderEvent, { type: "invoice" }> => event.type === "invoice" && event.fareVersion === order.fareVersion) ?? null;
}

export function paymentLedger(order: Order) {
  const initialPaidCents = ["ticketing_failed", "ticketed", "refunded"].includes(order.status) ? order.initialAmountCents : 0;
  const paidCents = initialPaidCents + order.events.reduce((sum, event) => sum + (event.type === "reschedule" ? Math.max(0, event.deltaCents) : 0), 0);
  const returnedCents = order.events.reduce((sum, event) => sum + (event.type === "reschedule" ? Math.max(0, -event.deltaCents) : event.type === "refund" ? event.refundCents : 0), 0);
  return { paidCents, returnedCents, netCents: paidCents - returnedCents };
}

export function quoteReschedule(orders: Order[], id: string, target: Trip, today = shanghaiToday()): RescheduleQuote {
  const order = orders.find(o => o.id === id);
  if (!order) throw new Error("没有找到这个演示订单。");
  const reason = rescheduleUnavailableReason(order);
  if (reason) throw new Error(reason);
  if (target.origin !== order.trip.origin || target.destination !== order.trip.destination) throw new Error("改签只能选择相同路线的班次。");
  if (target.id === order.trip.id) throw new Error("不能改签到当前班次。");
  const available = searchTrips({ origin: order.trip.origin, destination: order.trip.destination, date: target.date, quantity: order.quantity }, today, orders).find(t => t.id === target.id);
  if (!available) throw new Error("目标班次余票不足或日期不可售，请重新选择。");
  const oldAmountCents = order.amount * 100;
  const newAmountCents = available.price * order.quantity * 100;
  return { key: `${id}:${order.version}:${target.id}`, orderId: id, orderVersion: order.version, fromTripId: order.trip.id, targetTripId: target.id, targetDate: target.date, oldAmountCents, newAmountCents, deltaCents: newAmountCents - oldAmountCents };
}

function recheckQuote(orders: Order[], quote: RescheduleQuote, today: string) {
  const order = orders.find(o => o.id === quote.orderId);
  if (!order) throw new Error("没有找到这个演示订单。");
  if (order.version !== quote.orderVersion) throw new Error("订单已有变化，旧改签报价已失效，请重新选择。");
  const current = quoteReschedule(orders, order.id, { ...order.trip, id: quote.targetTripId, date: quote.targetDate }, today);
  if (Object.keys(current).some(key => current[key as keyof RescheduleQuote] !== quote[key as keyof RescheduleQuote])) throw new Error("目标班次或差价已变化，请重新报价。");
  return order;
}

function finishReschedule(orders: Order[], order: Order, quote: RescheduleQuote, today: string): Order[] {
  if (order.status !== "ticketed" || order.journeyStage !== "upcoming" || order.trip.id !== quote.fromTripId) throw new Error("原行程已有变化，改签未完成。");
  const target = searchTrips({ origin: order.trip.origin, destination: order.trip.destination, date: quote.targetDate, quantity: order.quantity }, today, orders).find(t => t.id === quote.targetTripId);
  if (!target) throw new Error("目标班次余票不足，原票仍然有效。");
  if (target.price * order.quantity * 100 !== quote.newAmountCents || order.amount * 100 !== quote.oldAmountCents) throw new Error("改签差价已变化，原票仍然有效。");
  return orders.map(o => o.id === order.id ? { ...o, trip: target, amount: quote.newAmountCents / 100, version: o.version + 1, fareVersion: o.fareVersion + 1, reschedule: null, events: [...o.events, { type: "reschedule" as const, key: quote.key, from: o.trip, to: target, deltaCents: quote.deltaCents }] } : o);
}

export function submitSimpleReschedule(orders: Order[], quote: RescheduleQuote, result: "success" | "failed", confirmed: boolean, today = shanghaiToday()): Order[] {
  if (!confirmed) throw new Error("请先核对原行程、新行程与差价并确认。");
  if (orders.some(o => o.id === quote.orderId && o.events.some(event => event.type === "reschedule" && event.key === quote.key))) return orders;
  const order = recheckQuote(orders, quote, today);
  if (quote.deltaCents > 0) throw new Error("补差价需先进入模拟支付流程。");
  if (result === "failed") return orders;
  return finishReschedule(orders, order, quote, today);
}

export function startPaidReschedule(orders: Order[], quote: RescheduleQuote, confirmed: boolean, today = shanghaiToday()): Order[] {
  if (!confirmed) throw new Error("请先核对原行程、新行程与差价并确认。");
  const existing = orders.find(o => o.id === quote.orderId);
  if (existing?.reschedule?.quote.key === quote.key) return orders;
  const order = recheckQuote(orders, quote, today);
  if (quote.deltaCents <= 0) throw new Error("此改签无需补差价。");
  return orders.map(o => o.id === order.id ? { ...o, version: o.version + 1, reschedule: { quote, state: "pending" as const } } : o);
}

export type RescheduleAction = "success" | "failed" | "unknown" | "query" | "cancel";
export type RescheduleOutcome = "completed" | "payment_failed" | "payment_unknown" | "cancelled" | "inventory_unavailable" | "unchanged";
export function resolvePaidReschedule(orders: Order[], id: string, action: RescheduleAction, today = shanghaiToday()): { orders: Order[]; outcome: RescheduleOutcome } {
  const order = orders.find(o => o.id === id);
  if (!order) throw new Error("没有找到这个演示订单。");
  const attempt = order.reschedule;
  if (!attempt) return { orders, outcome: "unchanged" };
  if (action === "query") {
    if (attempt.state !== "payment_unknown") throw new Error("只有支付结果未知时才能主动查单。");
  } else if (attempt.state === "payment_unknown") throw new Error("支付结果未知，只能主动查单，不能取消或再次支付。");
  if (action === "cancel") return { orders: orders.map(o => o.id === id ? { ...o, version: o.version + 1, reschedule: null } : o), outcome: "cancelled" };
  if (action === "failed") return { orders: orders.map(o => o.id === id ? { ...o, version: o.version + 1, reschedule: { ...attempt, state: "payment_failed" as const } } : o), outcome: "payment_failed" };
  if (action === "unknown") return { orders: orders.map(o => o.id === id ? { ...o, version: o.version + 1, reschedule: { ...attempt, state: "payment_unknown" as const } } : o), outcome: "payment_unknown" };
  try {
    return { orders: finishReschedule(orders, order, attempt.quote, today), outcome: "completed" };
  } catch (error) {
    if (action !== "query" || !(error instanceof Error) || !error.message.includes("余票不足")) throw error;
    return { orders: orders.map(o => o.id === id ? { ...o, version: o.version + 1, reschedule: null } : o), outcome: "inventory_unavailable" };
  }
}

export function issueInvoice(orders: Order[], id: string, title: InvoiceTitle, confirmed: boolean): Order[] {
  if (!confirmed) throw new Error("请先确认演示抬头和当前订单金额。");
  if (title !== "personal" && title !== "company") throw new Error("请选择预设的演示抬头。");
  const order = orders.find(o => o.id === id);
  if (!order) throw new Error("没有找到这个演示订单。");
  if (order.reschedule) throw new Error("改签处理中，完成后再申请演示开票。");
  const existing = activeInvoice(order);
  if (existing) {
    if (existing.title === title) return orders;
    throw new Error("当前票价版本已有有效演示开票记录。");
  }
  const reason = invoiceUnavailableReason(order);
  if (reason) throw new Error(reason);
  return orders.map(o => o.id === id ? { ...o, version: o.version + 1, events: [...o.events, { type: "invoice" as const, title, amountCents: o.amount * 100, fareVersion: o.fareVersion }] } : o);
}

// Explicit local demonstration grammar, never represented as model output.
export function demoInterpret(message: string, previous: Conditions, today = shanghaiToday()): Interpretation {
  const conditions = { ...previous };
  const result: Interpretation = { intent: "search_trips", conditions, reply: "", faq: null, selection: null };
  if (/客服|人工协助|失物|丢东西|投诉|意见反馈|提(?:个|出)?建议|无障碍/.test(message)) return { ...result, intent: "request_support" };
  if (/提醒|通知我出发/.test(message)) return { ...result, intent: "request_reminder" };
  if (/退票|退款/.test(message)) return { ...result, intent: "request_refund" };
  if (/改签|换(?:个|一趟|班次|时间|日期)|换票/.test(message)) return { ...result, intent: "request_reschedule" };
  if (/开票|发票/.test(message)) return { ...result, intent: "request_invoice" };
  const serviceDate = message.match(/后天|明天|今天/)?.[0];
  if (serviceDate) conditions.date = addDays(today, { 今天: 0, 明天: 1, 后天: 2 }[serviceDate]!);
  const serviceRoute = message.match(/(?:从)?(海口|三亚|琼海|文昌|儋州)(?:市|汽车站|站)?(?:到|去)(海口|三亚|琼海|文昌|儋州)/);
  if (serviceRoute) { conditions.origin = serviceRoute[1]; conditions.destination = serviceRoute[2]; }
  if (/海口美兰机场/.test(message)) conditions.origin = "海口美兰机场";
  else if (/海口汽车站/.test(message)) conditions.origin = "海口汽车站";
  if (/三亚湾景区/.test(message)) conditions.destination = "三亚湾景区";
  else if (/三亚汽车站/.test(message)) conditions.destination = "三亚汽车站";
  const serviceCount = message.match(/([1-5一二三四五两])\s*(?:人|位)/)?.[1];
  if (serviceCount) conditions.quantity = serviceCount === "两" ? 2 : Number(serviceCount) || "一二三四五".indexOf(serviceCount) + 1;
  if (/门到门|组合方案|全程接驳/.test(message)) return { ...result, intent: "request_door_plan" };
  if (/接驳|直通车|包车|机场到车站|景区交通/.test(message)) return { ...result, intent: "request_product" };
  if (/酒店/.test(message)) return { ...result, intent: "unsupported" };
  if (/订单|买的票|出票了吗|支付成功了吗/.test(message)) return { ...result, intent: "list_orders" };
  const faq = /行李|托运/.test(message) ? "luggage" : /到站|检票/.test(message) ? "arrival" : /实名|证件|手机号|乘车人/.test(message) ? "passenger" : /支付|扣款/.test(message) ? "payment" : null;
  if (faq) return { ...result, intent: "faq", faq };
  const ordinal = message.match(/第([一二三四五六1-6])(?:班|个|趟)/);
  if (ordinal) return { ...result, intent: "select_trip", selection: Number(ordinal[1]) || "一二三四五六".indexOf(ordinal[1]) + 1 };
  const route = message.match(/(?:从)?(海口|三亚|琼海|文昌|儋州)(?:市|汽车站|站)?(?:到|去)(海口|三亚|琼海|文昌|儋州)/);
  let recognized = false;
  if (route) { conditions.origin = route[1]; conditions.destination = route[2]; recognized = true; }
  else {
    const from = message.match(/从(海口|三亚|琼海|文昌|儋州)/);
    const to = message.match(/(?:到|去|目的地.*?)(海口|三亚|琼海|文昌|儋州)/);
    const bare = cities.find((c) => message.trim() === c);
    if (from) { conditions.origin = from[1]; recognized = true; }
    if (to) { conditions.destination = to[1]; recognized = true; }
    if (bare) { if (!conditions.origin) conditions.origin = bare; else conditions.destination = bare; recognized = true; }
  }
  const relative = message.match(/后天|明天|今天/);
  const absolute = message.match(/\d{4}-\d{2}-\d{2}/);
  if (relative) { conditions.date = addDays(today, { 今天: 0, 明天: 1, 后天: 2 }[relative[0]]!); recognized = true; }
  if (absolute && !Number.isNaN(Date.parse(absolute[0])) && addDays(absolute[0], 0) === absolute[0]) { conditions.date = absolute[0]; recognized = true; }
  const preference = message.match(/不限|上午|下午|晚上/);
  if (preference) { conditions.time_preference = preference[0] as Conditions["time_preference"]; recognized = true; }
  const count = message.match(/([1-9一二三四五六七八九十两]+)\s*(?:人|位|张)/);
  if (count) {
    const quantity = count[1] === "两" ? 2 : Number(count[1]) || "一二三四五六七八九十".indexOf(count[1]) + 1;
    if (quantity < 1 || quantity > 5) return { ...result, intent: "unsupported" };
    conditions.quantity = quantity; recognized = true;
  }
  if (!recognized && !/查询|班次|有票/.test(message)) return { ...result, intent: "unsupported" };
  return { ...result, intent: missingCondition(conditions) ? "clarify" : "search_trips" };
}

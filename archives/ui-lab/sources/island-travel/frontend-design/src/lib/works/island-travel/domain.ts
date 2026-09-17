import { cities, departures, routeSeeds } from "@/content/projects/demos/island-travel";
import type { Conditions, Interpretation } from "./schema";

export type Trip = { id: string; origin: string; destination: string; date: string; depart: string; arrive: string; minutes: number; price: number; seats: number };
export type OrderStatus = "pending" | "payment_failed" | "payment_unknown" | "ticketing_failed" | "ticketed";
export type PaymentResult = "success" | "failed" | "unknown" | "ticketing_failed";
export type Order = { id: string; key: string; trip: Trip; quantity: number; amount: number; status: OrderStatus };
export const statusLabels: Record<OrderStatus, string> = { pending: "待支付", payment_failed: "支付失败", payment_unknown: "支付确认中", ticketing_failed: "已支付 · 出票异常", ticketed: "已出票" };

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
    const occupied = orders.filter((o) => o.trip.id === id).reduce((sum, o) => sum + o.quantity, 0);
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
  return [...orders, { id: `DJ-${String(orders.length + 1).padStart(4, "0")}`, key, trip: { ...available }, quantity, amount: available.price * quantity, status: "pending" }];
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
  return orders.map((o) => o.id === id ? { ...o, status } : o);
}

// Explicit local demonstration grammar, never represented as model output.
export function demoInterpret(message: string, previous: Conditions, today = shanghaiToday()): Interpretation {
  const conditions = { ...previous };
  const result: Interpretation = { intent: "search_trips", conditions, reply: "", faq: null, selection: null };
  if (/退票|退款|改签|酒店/.test(message)) return { ...result, intent: "unsupported" };
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

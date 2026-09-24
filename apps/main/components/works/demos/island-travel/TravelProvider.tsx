"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { faqAnswers } from "@/content/projects/demos/island-travel";
import { advanceJourney, changeOrder, createOrder, demoInterpret, invoiceUnavailableReason, issueInvoice, missingCondition, refundUnavailableReason, rescheduleUnavailableReason, resolvePaidReschedule, searchTrips, shanghaiToday, startPaidReschedule, submitRefund, submitSimpleReschedule, type InvoiceTitle, type JourneyStage, type Order, type PaymentResult, type RefundQuote, type RescheduleAction, type RescheduleQuote, type Trip } from "@/lib/works/island-travel/domain";
import { containsIdentity, responseSchema, type Conditions, type HistoryMessage, type Interpretation } from "@/lib/works/island-travel/schema";
import { buildDoorPlan, changeProductOrder, createProductOrder, matchProducts, productOffers, type DoorPlan, type ProductOrder, type ProductSelection, type ProductOffer } from "@/lib/works/island-travel/products";
import { advanceSupport, submitSupport, type SupportKind, type SupportStatus, type SupportTicket } from "@/lib/works/island-travel/support";

export const travelRoot = "/works/demos/island-travel";
type Message = { id: number; role: "user" | "assistant"; text: string; mode?: "live" | "demo"; link?: { href: string; label: string } };
type Selection = { trip: Trip; key: string; quantity: number; confirmed: boolean };
const welcome: Message = { id: 0, role: "assistant", text: "你好，我是岛见。告诉我想去哪座城市、哪天出发。我会帮你把这一程，安排得从容一点。" };
function subscribeDate(callback: () => void) {
  window.addEventListener("focus", callback);
  const timer = window.setInterval(callback, 60000);
  return () => { window.removeEventListener("focus", callback); window.clearInterval(timer); };
}

function useTravelState() {
  const router = useRouter();
  const pathname = usePathname();
  const today = useSyncExternalStore(subscribeDate, shanghaiToday, () => "");
  const [conditions, setConditions] = useState<Conditions>({});
  const [queried, setQueried] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const ordersRef = useRef<Order[]>([]);
  const [productOrders, setProductOrders] = useState<ProductOrder[]>([]);
  const productOrdersRef = useRef<ProductOrder[]>([]);
  const [productSelection, setProductSelection] = useState<ProductSelection | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [doorPlan, setDoorPlan] = useState<DoorPlan | null>(null);
  const [doorKeys, setDoorKeys] = useState<{ first?: string; ticket: string; last?: string } | null>(null);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const supportRef = useRef<SupportTicket[]>([]);
  const [reminders, setReminders] = useState<string[]>([]);
  const [chatContextId, setChatContextId] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "demo">("live");
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flowError, setFlowError] = useState("");
  const request = useRef<AbortController | null>(null);
  const messageId = useRef(1);
  const trips = queried && today ? searchTrips(conditions, today, orders) : [];

  const cancel = useCallback(() => {
    request.current?.abort(); request.current = null; setBusy(false);
  }, []);
  // A request belongs to the screen where it was made, never a later screen.
  useEffect(() => () => cancel(), [pathname, cancel]);

  function append(message: Omit<Message, "id">) {
    setMessages(current => [...current, { ...message, id: messageId.current++ }]);
  }
  function query(next: Conditions, navigate = true) {
    cancel(); setConditions(next); setQueried(true); setSelection(null); setError(""); setFlowError("");
    if (navigate) router.push(`${travelRoot}/plan`);
  }
  function selectTrip(trip: Trip, quantity = conditions.quantity ?? 1, navigate = true, key = crypto.randomUUID()) {
    cancel();
    setConditions({ origin: trip.origin, destination: trip.destination, date: trip.date, time_preference: conditions.time_preference ?? "不限", quantity });
    setQueried(true); setSelection({ trip, quantity, key, confirmed: false }); setFlowError("");
    if (navigate) router.push(`${travelRoot}/confirm`);
  }
  function changeQuantity(quantity: number) {
    setSelection(current => current && { ...current, quantity, confirmed: false }); setFlowError("");
  }
  function confirmSelection(confirmed: boolean) {
    setSelection(current => current && { ...current, confirmed });
  }
  function newJourney() {
    cancel(); setMessages([welcome]); setHistory([]); setConditions({}); setQueried(false);
    setSelection(null); setProductSelection(null); setProductQuery(""); setDoorPlan(null); setDoorKeys(null); setChatContextId(null); setInput(""); setError(""); setFlowError(""); router.push(`${travelRoot}/plan`);
  }
  function changeMode(next: "live" | "demo") { cancel(); setMode(next); setError(""); }

  function applyInterpretation(result: Interpretation, currentMode: "live" | "demo", message: string) {
    const c = result.conditions;
    let text: string;
    let link: Message["link"];
    const allIds = [...ordersRef.current.map(order => order.id), ...productOrdersRef.current.map(order => order.id)];
    const mentioned = [...new Set((message.match(/\b(?:DJ|DP)-\d{4}\b/gi) ?? []).map(id => id.toUpperCase()))];
    const targetId = mentioned.length === 1 && allIds.includes(mentioned[0]) ? mentioned[0] : mentioned.length ? null : chatContextId && allIds.includes(chatContextId) ? chatContextId : allIds.length === 1 ? allIds[0] : null;
    const target = ordersRef.current.find(order => order.id === targetId);
    if (result.intent === "list_orders") {
      text = allIds.length ? "你的演示订单都在这里，可以继续处理尚未完成的旅程。" : "还没有演示订单。先选择一趟班次，开始这一程。";
      link = { href: `${travelRoot}/orders`, label: "查看我的演示订单" };
    } else if (result.intent === "request_refund") {
      text = !allIds.length ? "还没有演示订单。请先选择班次并完成模拟出票。" : !targetId ? "请先从订单列表选择要退的车票，再查看演示退票试算。" : target && !refundUnavailableReason(target) ? "可以查看这张车票的退票试算；退款仍需在页面明确确认。" : "该订单暂不可退票，请查看订单详情。";
      link = target && !refundUnavailableReason(target) ? { href: `${travelRoot}/orders/${target.id}/refund`, label: "查看退票试算" } : { href: `${travelRoot}/orders`, label: "选择演示订单" };
    } else if (result.intent === "request_reschedule" || result.intent === "request_invoice") {
      const reschedule = result.intent === "request_reschedule";
      const eligible = target && !(reschedule ? rescheduleUnavailableReason(target) : invoiceUnavailableReason(target));
      text = !allIds.length ? "还没有演示订单。请先完成模拟出票。" : !targetId ? `请先选择要${reschedule ? "改签" : "开票"}的车票，消息不会执行操作。` : eligible ? `可以进入演示${reschedule ? "改签" : "开票"}页面核对信息，最终操作仍由你确认。` : `该订单暂不符合演示${reschedule ? "改签" : "开票"}条件，请查看详情。`;
      link = eligible ? { href: `${travelRoot}/orders/${target.id}/${reschedule ? "reschedule" : "invoice"}`, label: `查看演示${reschedule ? "改签" : "开票"}` } : { href: `${travelRoot}/orders`, label: "选择演示订单" };
    } else if (result.intent === "request_support") {
      text = !allIds.length ? "请先创建演示订单，再进入客服工单。" : targetId ? "可以在订单关联的客服页填写演示工单；发送消息不会提交工单，也不会接通真实客服。" : "请先选择需要协助的订单。发送消息不会提交工单。";
      link = { href: targetId ? `${travelRoot}/orders/${targetId}/support` : `${travelRoot}/orders`, label: targetId ? "填写演示客服工单" : "选择演示订单" };
    } else if (result.intent === "request_reminder") {
      text = !allIds.length ? "请先完成演示购票，再设置出发提醒。" : !targetId ? "请先选择要设置提醒的车票订单。" : target?.status === "ticketed" ? "可以在行程页开启或关闭会话内出发提醒；不会发送系统通知。" : target ? "这张车票目前不能开启提醒；请在订单详情查看出票或退款状态。" : "交通产品不提供车票出发提醒，请选择车票订单。";
      link = { href: target?.status === "ticketed" ? `${travelRoot}/journeys/${target.id}#departure-reminder` : target ? `${travelRoot}/orders/${target.id}` : `${travelRoot}/orders`, label: target?.status === "ticketed" ? "查看出发提醒" : target ? "查看车票订单" : "选择车票订单" };
    } else if (result.intent === "request_product") {
      setConditions(c);
      setProductQuery(message);
      const date = c.date && c.date >= shanghaiToday() ? c.date : shanghaiToday();
      const wanted = c.quantity ?? 1;
      const available = matchProducts(productOffers(date, productOrdersRef.current), message).filter(offer => offer.capacity >= wanted && offer.available >= (offer.kind === "charter" ? 1 : wanted));
      text = available.length ? `本地目录找到 ${available.length} 项可售演示交通服务。价格和余量以产品页为准，请自行核对并确认。` : "所选日期暂无可售演示交通服务，请调整到未来七天内的日期。";
      link = { href: `${travelRoot}/products`, label: "查看交通产品" };
    } else if (result.intent === "request_door_plan") {
      setConditions(c);
      if (!missingCondition(c)) setQueried(true);
      text = "可以从规划页选择预设公共地点，查看本地规则生成的门到门方案。各段分别确认下单，不会一键支付。";
      link = { href: `${travelRoot}/plan#door-plan`, label: "规划门到门方案" };
    } else if (result.intent === "faq") {
      text = result.faq ? faqAnswers[result.faq] : "可以问我演示乘车人、行李、到站或模拟支付。";
    } else if (result.intent === "select_trip") {
      const available = searchTrips(conditions, shanghaiToday(), ordersRef.current);
      const trip = result.selection ? available[result.selection - 1] : undefined;
      text = trip ? "已选好这趟班次。请核对行程与人数，再确认创建模拟订单。" : "请先查询班次，再告诉我选择第几班。";
      if (trip) selectTrip(trip, c.quantity ?? 1);
    } else if (result.intent === "unsupported") {
      text = "这里支持模拟购票、交通产品、门到门规划、车票售后、客服工单和出发提醒。酒店与真实支付暂不支持。";
    } else {
      setConditions(c); setSelection(null); setQueried(true);
      const missing = missingCondition(c);
      const available = searchTrips(c, shanghaiToday(), ordersRef.current);
      text = missing ? `还差一个信息：${missing === "出发地" ? "你从哪里出发？" : missing === "目的地" ? "你想去哪里？" : "你打算哪天出发？"}` : available.length ? `为你找到 ${available.length} 趟演示班次。选一个刚好的时间，我们再核对这一程。` : "没有符合条件的可售班次。试试未来7天内海口至三亚、琼海、文昌或儋州，也可以调整时段或人数。";
    }
    append({ role: "assistant", text, mode: currentMode, link });
    return text;
  }

  async function send(value = input) {
    const message = value.trim();
    if (!message || request.current) return;
    if (message.length > 1200 || containsIdentity(message)) {
      setError("请只描述公共地点与行程，不要发送真实住址、手机号或证件号码；每条消息最多1200字。"); return;
    }
    setInput(message); setError("");
    const controller = new AbortController(); request.current = controller; setBusy(true);
    const currentMode = mode;
    const serviceMessage = /客服|人工协助|失物|丢东西|投诉|意见反馈|提(?:个|出)?建议|无障碍/.test(message) ? "我需要客服工单帮助" : /提醒|通知我出发/.test(message) ? "我需要设置出发提醒" : null;
    const wireMessage = serviceMessage ?? message.replace(/\b(?:DJ|DP|DS)-\d{4}\b/gi, "当前订单");
    try {
      let result: Interpretation;
      if (currentMode === "demo") result = demoInterpret(wireMessage, conditions);
      else {
        const response = await fetch("/api/experiments/island-travel/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: wireMessage, conditions, history: history.slice(-16) }), signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "AI 暂时无法完成理解，请重试或切换演示模式。");
        result = responseSchema.parse(data);
      }
      if (request.current !== controller) return;
      append({ role: "user", text: message });
      const answer = applyInterpretation(result, currentMode, message);
      setHistory(current => [...current, { role: "user" as const, content: wireMessage }, { role: "assistant" as const, content: answer }].slice(-16));
      setInput("");
    } catch (failure) {
      if (request.current === controller && !controller.signal.aborted) setError(failure instanceof Error && failure.name !== "ZodError" ? failure.message : "AI 返回的内容暂时无法使用，请重试或切换演示模式。");
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }
  function confirmOrder() {
    if (!selection) return;
    try {
      const before = ordersRef.current;
      const next = createOrder(before, selection.trip, selection.quantity, selection.key, selection.confirmed);
      if (next !== before) setOrderIds(ids => [...ids, next.at(-1)!.id]);
      ordersRef.current = next; setOrders(next); setFlowError("");
      router.push(`${travelRoot}/orders/${next.find(o => o.key === selection.key)!.id}`);
    } catch (failure) { setFlowError((failure as Error).message); }
  }
  function transact(id: string, action: PaymentResult | "query" | "retry_ticket") {
    try {
      const next = changeOrder(ordersRef.current, id, action);
      ordersRef.current = next; setOrders(next); setFlowError("");
    } catch (failure) { setFlowError((failure as Error).message); }
  }
  function advance(id: string, stage: JourneyStage) {
    try {
      const next = advanceJourney(ordersRef.current, id, stage);
      ordersRef.current = next; setOrders(next); setFlowError("");
      if (stage === "boarding") setReminders(current => current.filter(item => item !== id));
    } catch (failure) { setFlowError((failure as Error).message); }
  }
  function refund(quote: RefundQuote, result: "success" | "failed", confirmed: boolean) {
    try {
      const next = submitRefund(ordersRef.current, quote, result, confirmed);
      ordersRef.current = next; setOrders(next); setFlowError("");
      if (next.find(order => order.id === quote.orderId)?.status === "refunded") setReminders(current => current.filter(id => id !== quote.orderId));
      return true;
    } catch (failure) { setFlowError((failure as Error).message); return false; }
  }
  function beginReschedule(quote: RescheduleQuote, confirmed: boolean) {
    try {
      const next = startPaidReschedule(ordersRef.current, quote, confirmed);
      ordersRef.current = next; setOrders(next); setFlowError(""); return true;
    } catch (failure) { setFlowError((failure as Error).message); return false; }
  }
  function simpleReschedule(quote: RescheduleQuote, result: "success" | "failed", confirmed: boolean) {
    try {
      const next = submitSimpleReschedule(ordersRef.current, quote, result, confirmed);
      ordersRef.current = next; setOrders(next); setFlowError(""); return true;
    } catch (failure) { setFlowError((failure as Error).message); return false; }
  }
  function resolveReschedule(id: string, action: RescheduleAction) {
    try {
      const result = resolvePaidReschedule(ordersRef.current, id, action);
      ordersRef.current = result.orders; setOrders(result.orders); setFlowError(""); return result.outcome;
    } catch (failure) { setFlowError((failure as Error).message); return null; }
  }
  function invoice(id: string, title: InvoiceTitle, confirmed: boolean) {
    try {
      const next = issueInvoice(ordersRef.current, id, title, confirmed);
      ordersRef.current = next; setOrders(next); setFlowError(""); return true;
    } catch (failure) { setFlowError((failure as Error).message); return false; }
  }
  function selectProduct(offer: ProductOffer, quantity = 1, sourceTicketId: string | null = null, key = crypto.randomUUID()) {
    const source = sourceTicketId ? ordersRef.current.find(order => order.id === sourceTicketId) : null;
    setProductSelection({ offer, quantity, sourceTicketId, sourceTripId: source?.trip.id, sourceFareVersion: source?.fareVersion, key, confirmed: false }); setFlowError(""); router.push(`${travelRoot}/products/confirm`);
  }
  function confirmProduct() {
    if (!productSelection) return;
    try {
      const before = productOrdersRef.current;
      const next = createProductOrder(before, ordersRef.current, productSelection);
      if (next !== before) setOrderIds(ids => [...ids, next.at(-1)!.id]);
      productOrdersRef.current = next; setProductOrders(next); setFlowError("");
      router.push(`${travelRoot}/orders/${next.find(order => order.key === productSelection.key)!.id}`);
    } catch (failure) { setFlowError((failure as Error).message); }
  }
  function transactProduct(id: string, action: "success" | "failed" | "unknown" | "query" | "complete") {
    try {
      const next = changeProductOrder(productOrdersRef.current, id, action);
      productOrdersRef.current = next; setProductOrders(next); setFlowError("");
    } catch (failure) { setFlowError((failure as Error).message); }
  }
  function planDoor(from: string, to: string) {
    const plan = buildDoorPlan(trips, productOrdersRef.current, from, to, conditions.quantity ?? 1);
    setDoorPlan(plan); setDoorKeys(plan ? { first: plan.legs.some(leg => leg.key === "first") ? crypto.randomUUID() : undefined, ticket: crypto.randomUUID(), last: plan.legs.some(leg => leg.key === "last") ? crypto.randomUUID() : undefined } : null);
    return plan;
  }
  function openConcierge(id: string) { setChatContextId(id); router.push(`${travelRoot}/plan#travel-concierge`); }
  function saveSupport(draft: { key: string; orderId: string; kind: SupportKind; description: string }, confirmed: boolean) {
    try { const next = submitSupport(supportRef.current, ordersRef.current, productOrdersRef.current, draft, confirmed); supportRef.current = next; setSupportTickets(next); setFlowError(""); return next.find(item => item.key === draft.key) ?? null; }
    catch (failure) { setFlowError((failure as Error).message); return null; }
  }
  function progressSupport(id: string, nextStatus: SupportStatus, confirmed: boolean) {
    try { const next = advanceSupport(supportRef.current, id, nextStatus, confirmed); supportRef.current = next; setSupportTickets(next); setFlowError(""); return true; }
    catch (failure) { setFlowError((failure as Error).message); return false; }
  }
  function setDepartureReminder(id: string, enabled: boolean) {
    const order = ordersRef.current.find(item => item.id === id);
    if (!order || order.status !== "ticketed" || order.journeyStage !== "upcoming") { setFlowError("仅已出票、待出发的车票可设置出发提醒。"); return; }
    setReminders(current => enabled ? current.includes(id) ? current : [...current, id] : current.filter(item => item !== id)); setFlowError("");
  }
  return { today, conditions, queried, trips, selection, orders, orderIds, productOrders, productSelection, productQuery, doorPlan, doorKeys, supportTickets, reminders, chatContextId, mode, messages, input, busy, error, flowError,
    setInput, cancel, query, selectTrip, changeQuantity, confirmSelection, newJourney, changeMode, send, confirmOrder, transact, advance, refund, beginReschedule, simpleReschedule, resolveReschedule, invoice, selectProduct, setProductSelection, setProductQuery, confirmProduct, transactProduct, planDoor, openConcierge, clearChatContext: () => setChatContextId(null), saveSupport, progressSupport, setDepartureReminder, clearFlowError: () => setFlowError("") };
}

const TravelContext = createContext<ReturnType<typeof useTravelState> | null>(null);
export function TravelProvider({ children }: { children: ReactNode }) {
  const state = useTravelState();
  return <TravelContext.Provider value={state}>{children}</TravelContext.Provider>;
}
export function useTravel() {
  const value = useContext(TravelContext);
  if (!value) throw new Error("Island views require TravelProvider");
  return value;
}

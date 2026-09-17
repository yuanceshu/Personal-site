"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { faqAnswers } from "@/content/projects/demos/island-travel";
import { changeOrder, createOrder, demoInterpret, missingCondition, searchTrips, shanghaiToday, type Order, type PaymentResult, type Trip } from "@/lib/works/island-travel/domain";
import { containsIdentity, responseSchema, type Conditions, type HistoryMessage, type Interpretation } from "@/lib/works/island-travel/schema";

export const travelRoot = "/works/demos/island-travel";
type Message = { id: number; role: "user" | "assistant"; text: string; mode?: "live" | "demo"; orders?: boolean };
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
  const ordersRef = useRef<Order[]>([]);
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
  function selectTrip(trip: Trip, quantity = conditions.quantity ?? 1, navigate = true) {
    cancel();
    setConditions({ origin: trip.origin, destination: trip.destination, date: trip.date, time_preference: conditions.time_preference ?? "不限", quantity });
    setQueried(true); setSelection({ trip, quantity, key: crypto.randomUUID(), confirmed: false }); setFlowError("");
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
    setSelection(null); setInput(""); setError(""); setFlowError(""); router.push(`${travelRoot}/plan`);
  }
  function changeMode(next: "live" | "demo") { cancel(); setMode(next); setError(""); }

  function applyInterpretation(result: Interpretation, currentMode: "live" | "demo") {
    const c = result.conditions;
    let text: string;
    let listOrders = false;
    if (result.intent === "list_orders") {
      text = ordersRef.current.length ? "你的演示订单都在这里，可以继续处理尚未完成的旅程。" : "还没有演示订单。先选择一趟班次，开始这一程。";
      listOrders = true;
    } else if (result.intent === "faq") {
      text = result.faq ? faqAnswers[result.faq] : "可以问我演示乘车人、行李、到站或模拟支付。";
    } else if (result.intent === "select_trip") {
      const available = searchTrips(conditions, shanghaiToday(), ordersRef.current);
      const trip = result.selection ? available[result.selection - 1] : undefined;
      text = trip ? "已选好这趟班次。请核对行程与人数，再确认创建模拟订单。" : "请先查询班次，再告诉我选择第几班。";
      if (trip) selectTrip(trip, c.quantity ?? 1);
    } else if (result.intent === "unsupported") {
      text = "这里支持海南部分城市之间的模拟班次查询、1–5人购票和订单查询。退改签、酒店与真实支付暂不支持。";
    } else {
      setConditions(c); setSelection(null); setQueried(true);
      const missing = missingCondition(c);
      const available = searchTrips(c, shanghaiToday(), ordersRef.current);
      text = missing ? `还差一个信息：${missing === "出发地" ? "你从哪里出发？" : missing === "目的地" ? "你想去哪里？" : "你打算哪天出发？"}` : available.length ? `为你找到 ${available.length} 趟演示班次。选一个刚好的时间，我们再核对这一程。` : "没有符合条件的可售班次。试试未来7天内海口至三亚、琼海、文昌或儋州，也可以调整时段或人数。";
    }
    append({ role: "assistant", text, mode: currentMode, orders: listOrders });
    return text;
  }

  async function send(value = input) {
    const message = value.trim();
    if (!message || request.current) return;
    if (message.length > 1200 || containsIdentity(message)) {
      setError("请只描述行程，不要发送真实手机号或证件号码；每条消息最多1200字。"); return;
    }
    setInput(message); setError("");
    const controller = new AbortController(); request.current = controller; setBusy(true);
    const currentMode = mode;
    try {
      let result: Interpretation;
      if (currentMode === "demo") result = demoInterpret(message, conditions);
      else {
        const response = await fetch("/api/experiments/island-travel/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, conditions, history: history.slice(-16) }), signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "AI 暂时无法完成理解，请重试或切换演示模式。");
        result = responseSchema.parse(data);
      }
      if (request.current !== controller) return;
      append({ role: "user", text: message });
      const answer = applyInterpretation(result, currentMode);
      setHistory(current => [...current, { role: "user" as const, content: message }, { role: "assistant" as const, content: answer }].slice(-16));
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
      const next = createOrder(ordersRef.current, selection.trip, selection.quantity, selection.key, selection.confirmed);
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
  return { today, conditions, queried, trips, selection, orders, mode, messages, input, busy, error, flowError,
    setInput, cancel, query, selectTrip, changeQuantity, confirmSelection, newJourney, changeMode, send, confirmOrder, transact };
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

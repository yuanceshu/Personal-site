"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { faqAnswers } from "@/content/projects/demos/island-travel";
import { changeOrder, createOrder, dateLabel, demoInterpret, missingCondition, searchTrips, statusLabels, type Order, type PaymentResult, type Trip } from "@/lib/works/island-travel/domain";
import { containsIdentity, responseSchema, type Conditions, type HistoryMessage, type Interpretation } from "@/lib/works/island-travel/schema";

type Message = { id: number; role: "user" | "assistant"; text: string; mode?: "live" | "demo"; trips?: Trip[]; orders?: boolean };
const welcome: Message = { id: 0, role: "assistant", text: "你好，我是岛见。告诉我从哪里出发、想去哪座城市，以及出发日期。我来帮你整理这一程。" };
const examples = ["明天上午从海口去三亚", "后天下午海口去琼海，2人", "从海口出发，有什么车？"];
const paymentChoices: { value: PaymentResult; title: string; subtitle: string; symbol: string }[] = [
  { value: "success", title: "支付成功", subtitle: "完成模拟出票", symbol: "↗" },
  { value: "unknown", title: "支付结果未知", subtitle: "通过主动查单恢复", symbol: "◷" },
  { value: "failed", title: "支付失败", subtitle: "保留订单，重新支付", symbol: "↻" },
  { value: "ticketing_failed", title: "支付成功，出票异常", subtitle: "重试出票，无需再付款", symbol: "!" },
];

function IslandMark() {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 3V37M3 20H37M8 8L32 32M8 32L32 8" stroke="currentColor" strokeWidth="5" /><circle cx="20" cy="20" r="6" fill="currentColor" /></svg>;
}

export function IslandTravel() {
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [conditions, setConditions] = useState<Conditions>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const ordersRef = useRef<Order[]>([]);
  const [selection, setSelection] = useState<{ trip: Trip; key: string } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [flowError, setFlowError] = useState("");
  const [resultNotice, setResultNotice] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const messageId = useRef(1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const deskTitleRef = useRef<HTMLHeadingElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const shouldScroll = useRef(true);
  const active = orders.find((o) => o.id === activeId);
  const latestTrips = [...messages].reverse().find((m) => m.trips)?.trips ?? [];

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    const list = messageListRef.current;
    if (list && shouldScroll.current) list.scrollTop = list.scrollHeight;
  }, [messages, busy]);

  function append(message: Omit<Message, "id">) {
    setMessages((current) => [...current, { ...message, id: messageId.current++ }]);
  }
  function focusDesk() {
    requestAnimationFrame(() => {
      deskTitleRef.current?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 850px)").matches) deskTitleRef.current?.scrollIntoView({ block: "start" });
    });
  }
  function selectTrip(trip: Trip, count = conditions.quantity ?? 1) {
    setSelection({ trip, key: `snapshot-${messageId.current++}` }); setQuantity(count);
    setConfirmed(false); setActiveId(null); setShowOrders(false); setFlowError(""); setResultNotice(""); focusDesk();
  }
  function openOrder(id: string) {
    setSelection(null); setActiveId(id); setShowOrders(false); setFlowError(""); setResultNotice(""); focusDesk();
  }
  function viewOrders() {
    setSelection(null); setActiveId(null); setShowOrders(true); setFlowError(""); focusDesk();
  }
  function cancel() {
    requestRef.current?.abort(); requestRef.current = null; setBusy(false);
  }
  function changeMode(next: "live" | "demo") {
    cancel(); setMode("demo"); setError(""); inputRef.current?.focus();
  }
  function newJourney() {
    cancel(); setMessages([welcome]); setHistory([]); setConditions({}); setInput(""); setError("");
    setSelection(null); setActiveId(null); setShowOrders(false); setFlowError(""); setResultNotice("");
    inputRef.current?.focus();
  }

  function applyInterpretation(result: Interpretation, currentMode: "live" | "demo") {
    let text = "";
    let trips: Trip[] | undefined;
    let listOrders = false;
    const c = result.conditions;
    setConditions(c);
    if (result.intent === "list_orders") {
      text = ordersRef.current.length ? "这一页里创建的订单都在这里。选择一张订单，可以继续处理。" : "你还没有演示订单。先选一趟班次，就可以体验购票了。";
      listOrders = true;
    } else if (result.intent === "faq") {
      text = result.faq ? faqAnswers[result.faq] : "可以问我演示乘车人、行李、到站或模拟支付。本演示不提供真实承运规则。";
    } else if (result.intent === "select_trip") {
      const trip = result.selection ? latestTrips[result.selection - 1] : undefined;
      text = trip ? "已选好这趟班次。请核对行程和人数，再确认创建演示订单。" : "先查询一次班次，再点卡片选择，或告诉我选择第几班。";
      if (trip) selectTrip(trip, c.quantity ?? 1);
    } else if (result.intent === "unsupported") {
      text = "这里支持海南部分城市之间的模拟班次查询、1–5人购票和订单查询。可以试试“明天上午从海口去三亚”；退改签和真实支付暂不支持。";
    } else {
      const missing = missingCondition(c);
      if (missing) text = `还差一个信息：${missing === "出发地" ? "你从哪里出发？" : missing === "目的地" ? "你想去哪里？" : "你打算哪天出发？"}`;
      else {
        trips = searchTrips(c, undefined, ordersRef.current);
        text = trips.length ? `为你找到 ${trips.length} 趟符合条件的演示班次。选好后，我们再核对乘车信息。` : "没有符合这些条件的可售演示班次。可试试未来7天内从海口去三亚、琼海、文昌或儋州，也可以换个时段或减少人数。";
      }
    }
    append({ role: "assistant", text, mode: currentMode, trips, orders: listOrders });
    return text;
  }

  async function send(value = input) {
    const message = value.trim();
    if (!message || requestRef.current) return;
    if (message.length > 1200 || containsIdentity(message)) {
      setError("请只描述行程，不要发送真实手机号或证件号码；每条消息最多 1200 字。"); return;
    }
    setInput(message); setError(""); shouldScroll.current = true;
    const controller = new AbortController(); requestRef.current = controller; setBusy(true);
    const currentMode = mode;
    try {
      const result: Interpretation = demoInterpret(message, conditions);
      if (requestRef.current !== controller) return;
      append({ role: "user", text: message });
      const answer = applyInterpretation(result, currentMode);
      setHistory((current) => [...current, { role: "user" as const, content: message }, { role: "assistant" as const, content: answer }].slice(-16));
      setInput("");
    } catch (failure) {
      if (requestRef.current === controller && !controller.signal.aborted) {
        setError(failure instanceof Error && !(failure.name === "ZodError") ? failure.message : "AI 返回的内容暂时无法使用，请重试或切换演示模式。");
      }
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setBusy(false); }
    }
  }

  function saveOrders(next: Order[]) { ordersRef.current = next; setOrders(next); }
  function confirmOrder() {
    if (!selection) return;
    try {
      const next = createOrder(ordersRef.current, selection.trip, quantity, selection.key, confirmed);
      saveOrders(next); setActiveId(next.find((o) => o.key === selection.key)!.id); setSelection(null); setFlowError(""); focusDesk();
    } catch (failure) { setFlowError((failure as Error).message); }
  }
  function transact(action: PaymentResult | "query" | "retry_ticket") {
    if (!activeId) return;
    try {
      saveOrders(changeOrder(ordersRef.current, activeId, action)); setFlowError("");
      setResultNotice(action === "query" ? "模拟查单已确认支付成功，出票完成。" : action === "retry_ticket" ? "模拟出票重试成功，没有再次支付。" : "");
      focusDesk();
    } catch (failure) { setFlowError((failure as Error).message); }
  }
  const deskTitle = showOrders ? "我的演示订单" : selection ? "核对这一程" : active ? statusLabels[active.status] : "下一站，由你决定。";
  const progress = active ? 3 : selection ? 2 : 1;

  return <div className="island-app">
    <header className="island-header">
      <a className="island-brand" href="#island-main" aria-label="岛见智能出行"><IslandMark /><span>岛见<small>DAOJIAN / ISLAND TRAVEL</small></span></a>
      <nav aria-label="岛见导航"><a href="#travel-planner">规划行程 <span>↘</span></a><button className="island-header-orders" onClick={viewOrders}>我的订单 <span>{orders.length.toString().padStart(2, "0")}</span></button></nav>
      <Link href="index.html" className="island-back" aria-label="重新开始冻结快照">冻结快照 <span>↻</span></Link>
    </header>
    <main id="island-main" className="island-main">
      <section className="island-intro">
        <div className="island-intro-copy"><p className="island-eyebrow"><span />把日常留在身后 / HAINAN</p><h1>去见一面。<br />也见<span>一座岛。</span></h1><div className="island-intro-bottom"><p>告诉岛见你想去哪儿。<br /><a href="#travel-planner">开始规划我的行程 ↘</a></p><span aria-hidden="true">A little further.</span></div></div>
        <figure className="island-cover"><Image src="assets/coast-editorial.webp" alt="海岸公路与椰林的 AI 创作场景，非真实线路照片" fill sizes="(max-width: 700px) 100vw, 48vw" preload /><figcaption><span>THE ISLAND IS CALLING.</span><small>海岸创作示意 / AI IMAGE</small></figcaption><span className="island-cover-stamp" aria-hidden="true">换个地方<br /><b>慢一点</b><i>↗</i></span></figure>
      </section>
      <div className="island-planner-heading" id="travel-planner"><div><span className="island-section-index">01 — PLAN YOUR ESCAPE</span><h2>下一程，从这里开始。</h2></div><ol aria-label="购票进度">{["聊聊计划", "核对行程", "模拟出票"].map((step, i) => <li key={step} aria-current={progress === i + 1 ? "step" : undefined}><span>0{i + 1}</span>{step}</li>)}</ol></div>
      <div className="island-workspace">
        <section className="island-chat" aria-label="出行对话">
          <div className="island-chat-top"><div className="island-assistant-mark"><IslandMark /></div><div><h2>和岛见聊聊</h2><span>{mode === "live" ? "真实 AI 理解 · 模拟行程" : "演示模式 · 规则理解，不调用 AI"}</span></div><button className="island-new" onClick={newJourney}>＋ 新行程</button></div>
          <div className="island-messages" ref={messageListRef} role="log" aria-label="聊天记录" aria-live="polite" onScroll={() => { const list = messageListRef.current; if (list) shouldScroll.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80; }}>
            {messages.map((message) => <article key={message.id} className={`island-message island-message--${message.role}`}><span className="island-message-label">{message.role === "user" ? "你" : "岛见"}{message.mode === "demo" && " · 演示"}</span><p>{message.text}</p>
              {message.trips?.map((trip, index) => <button className="island-trip" key={trip.id} onClick={() => selectTrip(trip)} aria-label={`选择第${index + 1}班 ${trip.depart} ${trip.origin}到${trip.destination}`}><div className="island-trip-top"><span>{dateLabel(trip.date)} · {trip.origin} → {trip.destination}</span><span>演示班次 {String(index + 1).padStart(2, "0")}</span></div><div className="island-trip-body"><div><b>{trip.depart}</b><small>出发</small></div><div className="island-trip-duration"><span>{Math.floor(trip.minutes / 60)}小时{trip.minutes % 60 || ""}{trip.minutes % 60 ? "分" : ""}</span><i /><small>城际客运</small></div><div><b>{trip.arrive}</b><small>到达</small></div><div className="island-trip-price"><b><small>¥</small>{trip.price}</b><small>余 {trip.seats} 席</small></div><span className="island-trip-arrow" aria-hidden="true">↗</span></div></button>)}
              {message.orders && orders.map((order) => <button className="island-order-row" key={order.id} onClick={() => openOrder(order.id)}><span>{order.trip.origin} → {order.trip.destination}<small>{order.id} · {dateLabel(order.trip.date)} {order.trip.depart}</small></span><span>{statusLabels[order.status]} ↗</span></button>)}
            </article>)}
            {messages.length === 1 && <div className="island-suggestions"><span>没想好？从这里出发。<small>TRY A LITTLE ADVENTURE</small></span>{examples.map((example, i) => <button key={example} disabled={busy} onClick={() => void send(example)}><small>0{i + 1}</small>{example}<span aria-hidden="true">↗</span></button>)}</div>}
            {busy && <div className="island-wait" role="status"><span />正在理解「{input}」<button onClick={cancel}>取消</button></div>}
          </div>
          <div className="island-composer-wrap">
            {Object.values(conditions).some(Boolean) && <div className="island-conditions" aria-label="已识别条件">{[conditions.origin, conditions.destination && `→ ${conditions.destination}`, conditions.date && dateLabel(conditions.date), conditions.time_preference, conditions.quantity && `${conditions.quantity}人`].filter(Boolean).map((v, i) => <span key={i}>{v}</span>)}</div>}
            {error && <div className="island-error" role="alert"><p>{error}</p><div><button onClick={() => void send()}>重试</button>{mode === "live" && <button onClick={() => changeMode("demo")}>切换演示模式</button>}</div></div>}
            <form className="island-composer" onSubmit={(e) => { e.preventDefault(); void send(); }}><label className="island-sr" htmlFor="travel-message">描述你的出行计划</label><textarea id="travel-message" ref={inputRef} value={input} maxLength={1200} rows={2} readOnly={busy} onChange={(e) => setInput(e.target.value)} placeholder="例如：明天上午从海口去三亚，2个人" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} /><button type="submit" disabled={busy || !input.trim()} aria-label="发送行程">↑</button></form>
            <div className="island-composer-footer"><label>当前模式<select aria-label="对话模式" value={mode} onChange={() => changeMode("demo")}><option value="demo">演示模式</option></select></label><span>无需提供真实个人信息</span></div>
          </div>
        </section>

        <aside className="island-desk" aria-labelledby="island-desk-title"><div className="island-desk-top"><span>岛见 / 旅程票夹</span><span>DEMO PASS</span></div><h2 id="island-desk-title" ref={deskTitleRef} tabIndex={-1}>{deskTitle}</h2>
          {!selection && !active && !showOrders && <>
            <p className="island-desk-lead">有了方向，出发就很简单。<br />选中班次后，在这里核对这一程。</p>
            <div className="island-empty-route"><div><small>FROM / 出发</small><b>{conditions.origin || "哪里出发"}</b></div><span aria-hidden="true">↗</span><div><small>TO / 抵达</small><b>{conditions.destination || "想去哪里"}</b></div></div>
            <div className="island-empty-date"><span>DEPARTURE DATE</span><b>{conditions.date ? dateLabel(conditions.date) : "等一个出发的日子"}</b></div>
            <div className="island-ticket-message"><IslandMark /><p>不必把每一步想好。<br /><em>先说说，你想去哪里。</em></p></div>
            <button className="island-outline island-full" onClick={viewOrders}>查看我的演示订单 ↗</button>
          </>}
          {showOrders && <div className="island-desk-orders">{orders.length ? orders.map((order) => <button key={order.id} className="island-order-row" onClick={() => openOrder(order.id)}><span>{order.trip.origin} → {order.trip.destination}<small>{order.id} · {order.quantity}人 · ¥{order.amount}</small></span><span>{statusLabels[order.status]} ↗</span></button>) : <p>还没有订单。选择一趟班次，开始你的第一段演示行程。</p>}</div>}
          {selection && <form onSubmit={(e) => { e.preventDefault(); confirmOrder(); }}><TripSummary trip={selection.trip} /><fieldset className="island-passengers"><legend>演示乘车人</legend><p>使用虚构乘客，无需填写真实资料。</p><label>乘车人数<select value={quantity} onChange={(e) => { setQuantity(Number(e.target.value)); setConfirmed(false); }} aria-label="乘车人数">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} 人</option>)}</select></label><div className="island-passenger-names">{Array.from({ length: quantity }, (_, i) => <span key={i}>旅客 {String.fromCharCode(65 + i)}<small>虚构身份 · ****</small></span>)}</div></fieldset><div className="island-total"><span>演示订单金额 <small>{quantity}人 × ¥{selection.trip.price}</small></span><b>¥{quantity * selection.trip.price}</b></div><label className="island-confirm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />已核对行程与人数，确认创建模拟订单</label><button className="island-primary island-full" disabled={!confirmed} type="submit">确认创建订单 <span>→</span></button><button type="button" className="island-text-button" onClick={() => setSelection(null)}>返回选班次</button></form>}
          {active && <><TripSummary trip={active.trip} /><div className="island-order-meta"><span>{active.id} · {active.quantity}位演示乘客</span><b>¥{active.amount}</b></div>
            {(active.status === "pending" || active.status === "payment_failed") && <>{active.status === "payment_failed" && <p className="island-status-note" role="status">此次模拟支付失败，订单已保留。选择下方结果重试，无需重新下单。</p>}<div className="island-payment-heading"><h3>选择一个支付场景</h3><p>这是模拟支付，所有选项都不会扣款。</p></div><div className="island-payments">{paymentChoices.map((choice) => <button key={choice.value} onClick={() => transact(choice.value)}><span className="island-payment-symbol">{choice.symbol}</span><span><b>{choice.title}</b><small>{choice.subtitle}</small></span><i>→</i></button>)}</div></>}
            {active.status === "payment_unknown" && <div className="island-result"><span className="island-result-symbol">◷</span><h3>先确认，不重复支付。</h3><p>模拟支付结果暂时未知。主动查单后，本演示将恢复为支付成功并完成出票。</p><button className="island-primary island-full" onClick={() => transact("query")}>主动查询支付结果 →</button></div>}
            {active.status === "ticketing_failed" && <div className="island-result"><span className="island-result-symbol">!</span><h3>已支付，等一张票。</h3><p>模拟出票暂未完成。你可以重试出票，已经支付的订单无需再付款。</p><button className="island-primary island-full" onClick={() => transact("retry_ticket")}>重试出票 →</button></div>}
            {active.status === "ticketed" && <div className="island-result island-result--success"><span className="island-result-symbol">✓</span><h3>这一程，安排好了。</h3><p role="status">{resultNotice || "模拟支付与出票已完成。这张演示车票不能用于真实乘车。"}</p><div className="island-ticket-stamp">岛见 · 演示车票<br /><small>DEMO TICKET / NOT VALID FOR TRAVEL</small></div><button className="island-primary island-full" onClick={() => { setActiveId(null); inputRef.current?.focus(); }}>继续查询班次 →</button></div>}
            <button className="island-text-button" onClick={viewOrders}>查看全部订单</button>
          </>}
          {flowError && <p className="island-error" role="alert">{flowError}</p>}
          <div className="island-barcode" aria-hidden="true" /><p className="island-desk-footnote">虚构班次 · 不可用于乘车<br />行程仅保留在当前页面，刷新后重新开始。</p>
        </aside>
      </div>
      <footer className="island-footer"><span>岛见 <i>See you somewhere.</i></span><details><summary>关于这个 Demo</summary><p>冻结交互快照，不代表当前正式产品。岛见为虚构产品，全部班次、价格、余票和交易为演示。海岸图片为 AI 创作。行程由固定规则理解，不调用真实 AI。刷新清空行程和订单，演示日期固定于归档基准。</p></details><Link href="index.html">重新开始冻结体验 ↻</Link></footer>
    </main>
  </div>;
}

function TripSummary({ trip }: { trip: Trip }) {
  return <div className="island-trip-summary"><span>{dateLabel(trip.date)} · 城际客运 · 演示</span><div><b>{trip.origin}</b><i>→</i><b>{trip.destination}</b></div><p>{trip.depart} 出发 <span>—</span> {trip.arrive} 到达</p></div>;
}

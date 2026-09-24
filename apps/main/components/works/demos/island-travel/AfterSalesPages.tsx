"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { activeInvoice, addDays, dateLabel, invoiceUnavailableReason, quoteReschedule, rescheduleUnavailableReason, searchTrips, type InvoiceTitle, type RescheduleAction, type RescheduleOutcome, type RescheduleQuote, type Trip } from "@/lib/works/island-travel/domain";
import { travelRoot, useTravel } from "./TravelProvider";
import { Arrow, EmptyState, StepHeading, TripSummary } from "./TravelUI";

const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
const titleLabels: Record<InvoiceTitle, string> = { personal: "演示个人抬头", company: "岛见演示公司" };

export function ReschedulePage({ id }: { id: string }) {
  const t = useTravel();
  const order = t.orders.find(o => o.id === id);
  const [date, setDate] = useState("");
  const [target, setTarget] = useState<Trip | null>(null);
  const [quote, setQuote] = useState<RescheduleQuote | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [simpleResult, setSimpleResult] = useState<"success" | "failed">("success");
  const [feedback, setFeedback] = useState("");
  const [completed, setCompleted] = useState(false);
  const [paymentReady, setPaymentReady] = useState(true);
  const paymentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (paymentTimer.current) clearTimeout(paymentTimer.current); }, []);
  const currentDate = order?.trip.date;
  const effectiveDate = date || (currentDate && t.today && currentDate >= t.today && currentDate <= addDays(t.today, 6) ? currentDate : t.today);
  const options = order && t.today ? searchTrips({ origin: order.trip.origin, destination: order.trip.destination, date: effectiveDate, quantity: order.quantity }, t.today, t.orders).filter(trip => trip.id !== order.trip.id) : [];
  const unavailable = order ? rescheduleUnavailableReason(order) : null;
  function resetChoice(nextDate: string) { setDate(nextDate); setTarget(null); setQuote(null); setConfirmed(false); setFeedback(""); t.clearFlowError(); }
  function handleAction(action: RescheduleAction) {
    if (!paymentReady) return;
    const outcome: RescheduleOutcome | null = t.resolveReschedule(id, action);
    if (!outcome) return;
    setCompleted(outcome === "completed");
    setFeedback(outcome === "completed" ? "" : { payment_failed: "此次补差价支付失败，原票有效；可重试同一改签。", payment_unknown: "支付结果未知，只能主动查单；原票暂时有效。", cancelled: "改签已取消，原票保持有效。", inventory_unavailable: "查单后确认目标余票不足，改签未完成，原票保持有效。", unchanged: "订单状态没有变化。" }[outcome]);
    if (outcome === "cancelled" || outcome === "inventory_unavailable") { setQuote(null); setTarget(null); setConfirmed(false); }
  }
  return <div className="container inner-content">
    <StepHeading eyebrow="DEMO RESCHEDULE" title="换一趟合适的班次。" description="仅同路线、同人数改签。原票在改签完成前保持有效；差价和支付均为模拟。" back={`/orders/${id}`} backLabel="返回订单" />
    {!order ? <EmptyState title="这张订单不在当前会话中。">刷新后订单与改签报价会清空。请从本次体验中的订单重新进入。</EmptyState> : <div className="checkout-grid"><section className="reschedule-panel" aria-label="演示改签">
      {completed ? <div className="journey-notice" role="status"><h2>改签已完成。</h2><p>订单、乘车凭证与行程现已指向新班次；原班次座位已释放。</p><Link className="text-link" href={`${travelRoot}/orders/${id}`}>查看更新后的订单 <Arrow /></Link></div> : order.reschedule ? <>
        <div className="panel-heading"><span className="overline">{order.id} / 改签进行中</span><h2>原票继续有效。</h2><p>目标班次：{dateLabel(order.reschedule.quote.targetDate)} · {order.reschedule.quote.targetTripId.split("-").at(-1)}；需补差价 {money(order.reschedule.quote.deltaCents)}。</p></div>
        {order.reschedule.state === "payment_unknown" ? <div className="journey-notice"><h3>支付结果未知，只能主动查单。</h3><p>此时无法取消、重新支付、退款或再次改签。查单将核对目标余票后给出最终结果。</p><button className="button gold" type="button" disabled={!paymentReady} onClick={() => handleAction("query")}>主动查询改签支付结果 <Arrow /></button></div> : <div className="reschedule-payment"><h3>{order.reschedule.state === "payment_failed" ? "补差价支付失败，可重试" : "选择补差价演示结果"}</h3><p>原班次与车票在成功前不会变化，所有选项都不会真实扣款。</p><div className="payment-choices"><button type="button" disabled={!paymentReady} onClick={() => handleAction("success")}>支付成功，完成改签 <Arrow /></button><button type="button" disabled={!paymentReady} onClick={() => handleAction("failed")}>支付失败，保留原票 <Arrow /></button><button type="button" disabled={!paymentReady} onClick={() => handleAction("unknown")}>支付结果未知，稍后查单 <Arrow /></button></div><button className="quiet-button" type="button" disabled={!paymentReady} onClick={() => handleAction("cancel")}>取消本次改签</button></div>}
      </> : unavailable ? <div className="journey-notice"><h2>当前无法发起改签。</h2><p>{unavailable}</p><Link className="text-link" href={`${travelRoot}/orders/${id}`}>返回订单 <Arrow /></Link></div> : <>
        <div className="panel-heading"><span className="overline">{order.id} / 当前车票</span><h2>{order.trip.origin} → {order.trip.destination}</h2><p>{dateLabel(order.trip.date)} · {order.trip.depart} 出发 · {order.quantity} 位演示乘客</p></div>
        <div className="reschedule-picker"><label htmlFor="reschedule-date">选择新日期</label><select id="reschedule-date" value={effectiveDate} onChange={event => resetChoice(event.target.value)}>{t.today ? Array.from({ length: 7 }, (_, index) => addDays(t.today, index)).map(day => <option key={day} value={day}>{dateLabel(day)} · {day}</option>) : <option value="">加载日期</option>}</select><p>选择同路线的其他可售班次；当前班次不会出现在下方。</p><div className="reschedule-options" role="group" aria-label="可改签班次">{options.map(trip => <button key={trip.id} type="button" className={target?.id === trip.id ? "is-selected" : ""} aria-pressed={target?.id === trip.id} onClick={() => { setTarget(trip); setQuote(null); setConfirmed(false); setFeedback(""); t.clearFlowError(); }}><strong>{trip.depart} → {trip.arrive}</strong><span>{dateLabel(trip.date)} · 单人 ¥{trip.price} · 余 {trip.seats} 席</span></button>)}</div>{!options.length && <p className="journey-notice">这个日期没有可改签的其他班次，试试另一日期。</p>}</div>
        {target && !quote && <button className="button gold" type="button" onClick={() => { try { setQuote(quoteReschedule(t.orders, id, target, t.today)); setFeedback(""); t.clearFlowError(); } catch (error) { setFeedback((error as Error).message); } }}>查看改签报价 <Arrow /></button>}
        {quote && <form className="reschedule-form" onSubmit={event => { event.preventDefault(); if (quote.deltaCents > 0) { if (t.beginReschedule(quote, confirmed)) { setPaymentReady(false); if (paymentTimer.current) clearTimeout(paymentTimer.current); paymentTimer.current = setTimeout(() => setPaymentReady(true), 450); setConfirmed(false); setFeedback(""); } } else if (t.simpleReschedule(quote, simpleResult, confirmed)) { setCompleted(simpleResult === "success"); setFeedback(simpleResult === "success" ? "" : "此次演示改签失败，原票和座位保持不变；可重新尝试。"); setConfirmed(false); } }}>
          <div className="refund-quote"><h3>改签报价</h3><dl><div><dt>原行程</dt><dd>{dateLabel(order.trip.date)} · {order.trip.depart}</dd></div><div><dt>新行程</dt><dd>{dateLabel(quote.targetDate)} · {target?.depart}</dd></div><div><dt>原订单金额</dt><dd>{money(quote.oldAmountCents)}</dd></div><div><dt>新订单金额</dt><dd>{money(quote.newAmountCents)}</dd></div><div className="refund-total"><dt>{quote.deltaCents > 0 ? "需补差价" : quote.deltaCents < 0 ? "应退差价" : "差价"}</dt><dd>{money(Math.abs(quote.deltaCents))}</dd></div></dl><p>演示改签手续费为 ¥0.00；金额按整数分计算，提交时会重新核验价格和余票。</p></div>
          {quote.deltaCents <= 0 && <fieldset className="refund-choice"><legend>选择演示结果</legend><label><input type="radio" name="reschedule-result" checked={simpleResult === "success"} onChange={() => setSimpleResult("success")} />改签成功</label><label><input type="radio" name="reschedule-result" checked={simpleResult === "failed"} onChange={() => setSimpleResult("failed")} />改签失败</label></fieldset>}
          <label className="confirm-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />已核对原行程、新行程与差价，确认提交演示改签</label><div className="refund-actions"><button className="button gold" type="submit" disabled={!confirmed}>确认{quote.deltaCents > 0 ? "进入补差价支付" : `演示改签${simpleResult === "success" ? "成功" : "失败"}`} <Arrow /></button><button className="quiet-button" type="button" onClick={() => { setQuote(null); setConfirmed(false); setFeedback(""); }}>返回选班次</button></div>
        </form>}
      </>}
      {feedback && <p className="journey-notice" role="status">{feedback}</p>}
      {t.flowError && <p className="travel-error" role="alert">{t.flowError}</p>}
    </section><TripSummary trip={order.trip} quantity={order.quantity} /></div>}
  </div>;
}

export function InvoicePage({ id }: { id: string }) {
  const t = useTravel();
  const order = t.orders.find(o => o.id === id);
  const [title, setTitle] = useState<InvoiceTitle>("personal");
  const [confirmed, setConfirmed] = useState(false);
  const record = order ? activeInvoice(order) : null;
  const reason = order ? invoiceUnavailableReason(order) : null;
  return <div className="container inner-content">
    <StepHeading eyebrow="DEMO INVOICE" title="为这一程，留一份记录。" description="仅生成页面内的演示开票记录，不是真实发票，也不提供文件下载。" back={`/orders/${id}`} backLabel="返回订单" />
    {!order ? <EmptyState title="这张订单不在当前会话中。">刷新后订单和演示开票记录都会清空。</EmptyState> : <div className="checkout-grid"><section className="invoice-panel" aria-label="演示开票">
      <div className="panel-heading"><span className="overline">{order.id}</span><h2>当前订单金额 ¥{order.amount.toFixed(2)}</h2><p>{order.trip.origin} → {order.trip.destination} · {dateLabel(order.trip.date)}</p></div>
      {record && record.type === "invoice" ? <div className="demo-invoice" role="status"><p className="overline">DEMO / 非真实发票</p><h3>演示开票记录已生成</h3><dl><div><dt>演示抬头</dt><dd>{titleLabels[record.title]}</dd></div><div><dt>记录金额</dt><dd>{money(record.amountCents)}</dd></div><div><dt>状态</dt><dd>有效 · 当前票价版本</dd></div></dl><p>同一票价版本只生成一份有效记录。退款或改签成功后将自动作废。</p><Link className="text-link" href={`${travelRoot}/orders/${id}`}>查看订单与操作历史 <Arrow /></Link></div> : reason ? <div className="journey-notice"><h3>当前无法开票。</h3><p>{reason}</p><Link className="text-link" href={`${travelRoot}/orders/${id}`}>返回订单 <Arrow /></Link></div> : <form onSubmit={event => { event.preventDefault(); if (t.invoice(id, title, confirmed)) setConfirmed(false); }}>
        <fieldset className="refund-choice"><legend>选择预设演示抬头</legend><label><input type="radio" name="invoice-title" checked={title === "personal"} onChange={() => { setTitle("personal"); setConfirmed(false); }} />演示个人抬头</label><label><input type="radio" name="invoice-title" checked={title === "company"} onChange={() => { setTitle("company"); setConfirmed(false); }} />岛见演示公司</label></fieldset>
        <p className="invoice-note">无需填写姓名、税号或联系方式。确认后生成本次会话内的演示记录。</p><label className="confirm-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />已核对演示抬头与当前订单金额，确认生成演示开票记录</label>{t.flowError && <p className="travel-error" role="alert">{t.flowError}</p>}<button className="button gold" type="submit" disabled={!confirmed}>确认生成演示开票记录 <Arrow /></button>
      </form>}
    </section><TripSummary trip={order.trip} quantity={order.quantity} /></div>}
  </div>;
}

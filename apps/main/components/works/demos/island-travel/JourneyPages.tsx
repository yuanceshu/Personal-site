"use client";

import Link from "next/link";
import { useState } from "react";
import { dateLabel, journeyLabels, quoteRefund, refundUnavailableReason, type JourneyStage, type RefundQuote } from "@/lib/works/island-travel/domain";
import { minutes, productOffers, productSourceWarning, type ProductOffer } from "@/lib/works/island-travel/products";
import { reminderTime } from "@/lib/works/island-travel/support";
import { travelRoot, useTravel } from "./TravelProvider";
import { Arrow, EmptyState, IslandMark, StepHeading, TripSummary } from "./TravelUI";

const stages: { key: JourneyStage; title: string }[] = [
  { key: "upcoming", title: "待出发" }, { key: "boarding", title: "检票" },
  { key: "en_route", title: "发车" }, { key: "completed", title: "到达" },
];

export function JourneysPage() {
  const { orders } = useTravel();
  const journeys = orders.filter(o => o.status === "ticketed" || o.status === "refunded");
  return <div className="container inner-content">
    <StepHeading eyebrow="YOUR JOURNEYS" title="旅途，从出票之后继续。" description="这里展示本次体验中已出票的行程。演示状态由你推进，不代表真实车辆运行。刷新后全部清空。" />
    <div className="orders-toolbar"><p>{String(journeys.length).padStart(2, "0")} 段演示行程</p><Link className="quiet-button" href={`${travelRoot}/orders`}>查看全部订单 <Arrow /></Link></div>
    {!journeys.length ? <EmptyState title="还没有可体验的行程。">完成模拟支付与出票后，行程会出现在这里。尚未出票的订单可在“我的订单”继续处理。</EmptyState> : <div className="orders-list">{[...journeys].reverse().map(order => <Link className="order-row" key={order.id} href={`${travelRoot}/journeys/${order.id}`}><div className="order-date"><strong>{order.trip.date.slice(8)}</strong><span>{order.trip.date.slice(0, 7).replace("-", " / ")}</span></div><div className="order-route"><span className="route-small">{order.id} / DEMO JOURNEY</span><h2>{order.trip.origin} <span>⟶</span> {order.trip.destination}</h2><p>{order.trip.depart} — {order.trip.arrive} · {order.quantity} 人</p></div><span className="status-badge">{order.status === "refunded" ? "已取消" : journeyLabels[order.journeyStage]}</span><Arrow /></Link>)}</div>}
  </div>;
}

export function JourneyPage({ id }: { id: string }) {
  const t = useTravel();
  const order = t.orders.find(o => o.id === id && (o.status === "ticketed" || o.status === "refunded"));
  const current = order ? stages.findIndex(stage => stage.key === order.journeyStage) : -1;
  const next = current >= 0 ? stages[current + 1] : undefined;
  const matching = order && t.today ? productOffers(order.trip.date, t.productOrders, t.today).filter(offer => offer.kind === "shuttle" && offer.from === `${order.trip.destination}汽车站` && minutes(offer.depart) >= minutes(order.trip.arrive) + 30 && offer.available >= order.quantity && !t.productOrders.some(product => product.sourceTicketId === order.id && product.offer.id === offer.id && product.offer.date === offer.date)) : [];
  const linked = order ? t.productOrders.filter(product => product.sourceTicketId === order.id) : [];
  return <div className="container inner-content">
    <StepHeading eyebrow="YOUR DEMO JOURNEY" title="这一程，慢慢展开。" description="乘车凭证与状态仅供体验，无法用于真实检票或乘车。" back="/journeys" backLabel="返回我的行程" />
    {!order ? <EmptyState title="这段行程不在当前体验中。">只有本次会话中已出票的订单会生成行程；刷新后体验数据会清空。</EmptyState> : <div className="checkout-grid">
      <section className="journey-panel" aria-label="演示行程详情">
        <div className="panel-heading"><span className="overline">{order.id} / {dateLabel(order.trip.date)}</span><h2>{order.trip.origin} → {order.trip.destination}</h2><p>{order.trip.depart} 出发 · {order.trip.arrive} 抵达 · {order.quantity} 位演示乘客</p></div>
        {order.status === "refunded" ? <div className="journey-notice" role="status"><h3>行程已取消，凭证已失效。</h3><p>演示退款完成后，这段行程保留为记录，不再可以检票。</p></div> : <div className="demo-credential" aria-label="岛见演示乘车凭证，不可乘车"><div className="credential-mark"><IslandMark /><span>DEMO / 不可乘车</span></div><div><p>岛见 · 演示乘车凭证</p><strong>{order.trip.origin} <span>—</span> {order.trip.destination}</strong><small>{dateLabel(order.trip.date)} · {order.trip.depart} · {order.quantity} 人</small></div><span className="credential-id">{order.id}</span></div>}
        <section className="journey-timeline" aria-labelledby="journey-timeline-title"><h3 id="journey-timeline-title">行程时间轴</h3><p>以下仅为手动演示状态，不与真实时钟或车辆数据同步。</p><ol>{stages.map((stage, index) => <li key={stage.key} className={order.status !== "refunded" && index <= current ? "is-reached" : ""}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{stage.title}</strong><small>{index === 0 ? `${order.trip.date} · ${order.trip.depart} 计划出发` : index === 1 ? "手动模拟检票" : index === 2 ? "手动模拟发车" : "手动模拟到达"}</small></div></li>)}</ol></section>
        <section id="departure-reminder" className="journey-actions" aria-labelledby="reminder-title"><h3 id="reminder-title">出发提醒</h3><p>仅保存本次页面会话的开关偏好，不会发送系统通知、短信或邮件。预计提醒时间为计划出发前 2 小时，按班次时间推算，并非真实定时服务。</p>{order.status === "refunded" ? <p className="journey-notice" role="status">车票已退款，出发提醒已撤销。</p> : order.journeyStage !== "upcoming" ? <p className="journey-notice">演示行程已开始，不能再设置出发提醒。</p> : <div className="reminder-controls"><p role="status">当前：{t.reminders.includes(id) ? "已开启" : "未开启"} · 预计 {reminderTime(order)}</p><button className="quiet-button" type="button" onClick={() => t.setDepartureReminder(id, !t.reminders.includes(id))}>{t.reminders.includes(id) ? "关闭出发提醒" : "开启出发提醒"} <Arrow /></button></div>}</section>
        {order.status === "ticketed" && <section className="journey-actions" aria-labelledby="journey-actions-title"><h3 id="journey-actions-title">体验行程状态</h3><p>每一步由你确认后推进，不能跳步或倒退。</p>{order.reschedule ? <p className="journey-notice" role="status">改签处理中。原票仍有效，请先在订单中完成改签支付或查单。</p> : next ? <button className="button gold" type="button" onClick={() => t.advance(order.id, next.key)}>确认模拟{next.title} <Arrow /></button> : <p className="journey-notice" role="status">演示行程已到达，体验结束。</p>}</section>}
        <section className="journey-actions"><h3>抵达后的交通</h3><p>按本次行程的到站地点与日期筛选。交通产品需单独核对、下单和模拟支付。</p>{linked.map(product => <p key={product.id} className="journey-notice">已关联 <Link className="text-link" href={`${travelRoot}/orders/${product.id}`}>{product.id} <Arrow /></Link>{productSourceWarning(product, t.orders) ? ` · ${productSourceWarning(product, t.orders)}` : ""}</p>)}{order.status === "ticketed" && !order.reschedule && matching.length ? matching.map((offer: ProductOffer) => <button key={offer.id} className="quiet-button" type="button" onClick={() => t.selectProduct(offer, order.quantity, order.id)}>安排抵达接驳 · {offer.title} <Arrow /></button>) : <Link className="text-link" href={`${travelRoot}/products`}>查看交通产品目录 <Arrow /></Link>}</section>
        {t.flowError && <p className="travel-error" role="alert">{t.flowError}</p>}
        <div className="journey-links"><Link className="text-link" href={`${travelRoot}/orders/${order.id}`}>查看对应订单 <Arrow /></Link><Link className="text-link" href={`${travelRoot}/orders/${order.id}/support`}>演示客服工单 <Arrow /></Link><button className="quiet-button" type="button" onClick={() => t.openConcierge(order.id)}>与岛见聊这张订单 <Arrow /></button>{order.status === "ticketed" && order.journeyStage === "upcoming" && !order.reschedule && <Link className="text-link" href={`${travelRoot}/orders/${order.id}/refund`}>查看退票试算 <Arrow /></Link>}</div>
      </section><TripSummary trip={order.trip} quantity={order.quantity} />
    </div>}
  </div>;
}

export function RefundPage({ id }: { id: string }) {
  const t = useTravel();
  const order = t.orders.find(o => o.id === id);
  const [quote, setQuote] = useState<RefundQuote | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<"success" | "failed">("success");
  const [failed, setFailed] = useState(false);
  const unavailable = order ? refundUnavailableReason(order) : null;
  const eligible = order && !unavailable;
  return <div className="container inner-content">
    <StepHeading eyebrow="DEMO REFUND" title="退票之前，先把细节看清。" description="仅已出票且待出发的车票可体验退票。以下金额和规则均为虚构演示。" back={`/orders/${id}`} backLabel="返回订单" />
    {!order ? <EmptyState title="这张订单不在当前会话中。">刷新后订单和退票试算都会清空。请从本次体验中的订单重新进入。</EmptyState> : <div className="checkout-grid"><section className="refund-panel" aria-label="演示退票">
      <div className="panel-heading"><span className="overline">{order.id}</span><h2>{order.trip.origin} → {order.trip.destination}</h2><p>{dateLabel(order.trip.date)} · {order.trip.depart} · {order.quantity} 位演示乘客</p></div>
      {order.status === "refunded" ? <div className="journey-notice" role="status"><h3>演示退票已完成。</h3><p>凭证失效，行程取消；对应座位已释放。重复提交不会再次退款。</p><Link className="text-link" href={`${travelRoot}/orders/${id}`}>返回订单 <Arrow /></Link></div> : !eligible ? <div className="journey-notice"><h3>当前订单不可退票。</h3><p>{unavailable}</p><Link className="text-link" href={`${travelRoot}/orders/${id}`}>返回订单 <Arrow /></Link></div> : <>
        {!quote ? <div className="refund-intro"><p>演示手续费按订单金额的 10% 计算。查看试算不会更改订单或释放余票。</p><button className="button gold" type="button" onClick={() => { setQuote(quoteRefund(order)); setFailed(false); t.clearFlowError(); }}>查看退票试算 <Arrow /></button></div> : <form onSubmit={event => { event.preventDefault(); if (t.refund(quote, result, confirmed)) { setFailed(result === "failed"); setConfirmed(false); } }}>
          <div className="refund-quote"><h3>退票试算</h3><dl><div><dt>原订单金额</dt><dd>¥{(quote.amountCents / 100).toFixed(2)}</dd></div><div><dt>演示手续费 · 10%</dt><dd>− ¥{(quote.feeCents / 100).toFixed(2)}</dd></div><div className="refund-total"><dt>预计可退</dt><dd>¥{(quote.refundCents / 100).toFixed(2)}</dd></div></dl><p>虚构演示规则，所有计算使用整数分；不会产生真实退款。</p></div>
          {failed && <p className="journey-notice" role="status">此次演示退票失败。原订单、凭证与行程均保留，可重新选择结果再试。</p>}
          <fieldset className="refund-choice"><legend>选择演示结果</legend><label><input type="radio" name="refund-result" value="success" checked={result === "success"} onChange={() => setResult("success")} />退票成功</label><label><input type="radio" name="refund-result" value="failed" checked={result === "failed"} onChange={() => setResult("failed")} />退票失败</label></fieldset>
          <label className="confirm-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />已核对试算，确认提交演示退票</label>
          {t.flowError && <p className="travel-error" role="alert">{t.flowError}</p>}
          <div className="refund-actions"><button className="button gold" type="submit" disabled={!confirmed}>确认演示{result === "success" ? "退票成功" : "退票失败"} <Arrow /></button><Link className="quiet-button" href={`${travelRoot}/orders/${id}`}>取消并返回订单</Link></div>
        </form>}
      </>}
    </section><TripSummary trip={order.trip} quantity={order.quantity} /></div>}
  </div>;
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { dateLabel, missingCondition, statusLabels, type PaymentResult } from "@/lib/works/island-travel/domain";
import { travelRoot, useTravel } from "./TravelProvider";
import { Arrow, EmptyState, IslandMark, QueryForm, StepHeading, TripList, TripSummary } from "./TravelUI";
import { OrderHistory, OrderServices } from "./OrderServices";
import { DoorPlanSection } from "./DoorPlan";
import { productKindLabels, productSourceWarning, productStatusLabels } from "@/lib/works/island-travel/products";

function Concierge() {
  const t = useTravel();
  const input = useRef<HTMLTextAreaElement>(null);
  return <section id="travel-concierge" className="concierge" aria-label="出行对话">
    <div className="concierge-header"><IslandMark /><div><p className="overline">AT YOUR SERVICE</p><h2>和岛见聊聊</h2></div><button className="quiet-button" onClick={() => { t.newJourney(); input.current?.focus(); }}>新行程</button></div>
    <p className="mode-caption">{t.mode === "live" ? "真实 AI 理解 · 模拟行程" : "演示模式 · 规则理解，不调用 AI"}</p>
    {t.chatContextId && <div className="chat-context" role="status">当前订单：{t.chatContextId} · 对话只提供页面入口，不会提交交易、工单或提醒。<button className="quiet-button" type="button" onClick={t.clearChatContext}>清除关联</button></div>}
    <div className="chat-log" role="log" aria-label="聊天记录" aria-live="polite">
      {t.messages.map(message => <article className={`chat-message chat-message--${message.role}`} key={message.id}><span>{message.role === "user" ? "你" : "岛见"}{message.mode === "demo" ? " · 演示" : ""}</span><p>{message.text}</p>{message.link && <Link className="text-link" href={message.link.href}>{message.link.label} <Arrow /></Link>}</article>)}
    </div>
    {t.messages.length === 1 && <div className="chat-suggestions">{["明天上午从海口去三亚", "改成下午，2人", "模拟支付怎么体验？"].map((example, i) => <button key={example} disabled={t.busy} onClick={() => void t.send(example)}><small>0{i + 1}</small>{example}<Arrow /></button>)}</div>}
    {t.busy && <div className="travel-wait" role="status"><span className="waiting-dot" />正在理解你的出行计划…<button className="quiet-button" onClick={t.cancel}>取消</button></div>}
    {t.error && <div className="travel-error" role="alert"><p>{t.error}</p><div><button className="quiet-button" onClick={() => void t.send()}>重试</button>{t.mode === "live" && <button className="quiet-button" onClick={() => { t.changeMode("demo"); input.current?.focus(); }}>切换演示模式</button>}</div></div>}
    <form className="chat-composer" onSubmit={e => { e.preventDefault(); void t.send(); }}><label htmlFor="travel-message">描述你的出行计划</label><div><textarea id="travel-message" ref={input} value={t.input} maxLength={1200} rows={3} readOnly={t.busy} onChange={e => t.setInput(e.target.value)} placeholder="例如：晚一点出发，改成下午，2个人" onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void t.send(); } }} /><button className="send-button" type="submit" disabled={t.busy || !t.input.trim()} aria-label="发送行程"><Arrow /></button></div></form>
    <div className="chat-footer"><label>对话模式<select aria-label="对话模式" value={t.mode} onChange={e => t.changeMode(e.target.value as "live" | "demo")}><option value="live">真实 AI</option><option value="demo">演示模式</option></select></label><p>无需提供真实姓名、手机号或证件信息。</p></div>
  </section>;
}

export function PlanningPage() {
  const t = useTravel();
  return <div className="container inner-content">
    <StepHeading eyebrow="01 / FIND YOUR WAY" title="出发的时间，由你决定。" description="选一趟合适的班次，也可以让岛见帮你调整计划。" step={1} back="" backLabel="返回岛见首页" />
    <QueryForm />
    <div className="planning-grid">
      <section className="departures" aria-labelledby="results-title"><div className="route-title"><div><span className="route-small">YOUR DEPARTURES</span><h2 id="results-title">{t.queried ? `${t.conditions.origin || "出发地"} → ${t.conditions.destination || "目的地"}` : "下一站，等你决定。"}</h2></div><p className="route-context">{dateLabel(t.conditions.date)}<br />{t.conditions.time_preference || "不限时段"} · {t.conditions.quantity ?? 1} 人</p></div>
        <p className="results-status" role="status">{t.queried ? `${t.trips.length} 趟可售演示班次` : "填写上方行程，或与右侧 AI 礼宾聊聊。"}</p>
        <TripList trips={t.trips} onSelect={trip => t.selectTrip(trip)} />
        {!t.trips.length && <div className="travel-empty compact"><IslandMark /><h3>{t.queried ? missingCondition(t.conditions) ? "还差一点出发的信息。" : "给计划，留一点调整的余地。" : "每一程，都从一个念头开始。"}</h3><p>{t.queried ? "请补全出发地、目的地和日期，或试试其他日期、时段与人数。" : "支持海口至三亚、琼海、文昌、儋州，以及三亚、琼海至海口。"}</p></div>}
        <div className="table-note"><span>虚构班次 · 余票按本次体验计算</span><span>单程 / 不可真实乘车</span></div>
        <div className="journey-reminder"><p className="overline">A LITTLE ROOM TO BREATHE</p><p>不必急着抵达。<br /><span>让路上的时间，也成为旅行的一部分。</span></p></div>
        <div className="travel-product-discovery"><div><span className="overline">BEYOND THE TICKET</span><h2>把车站之外，也纳入计划。</h2><p>探索车站接驳、景区直通车与包车。全部为虚构演示服务，分别确认与支付。</p></div><Link className="quiet-button" href={`${travelRoot}/products`} onClick={() => t.setProductQuery("")}>查看交通产品 <Arrow /></Link></div>
      </section><Concierge />
    </div>
    <DoorPlanSection />
  </div>;
}

export function ConfirmationPage() {
  const t = useTravel();
  const selection = t.selection;
  const existing = selection && t.orders.find(o => o.key === selection.key);
  return <div className="container inner-content">
    <StepHeading eyebrow="02 / MAKE IT YOURS" title="为下一程，留一个位置。" description="核对行程与同行人数，剩下的交给这段旅途。" step={2} />
    {!selection ? <EmptyState title="这段行程还没有选好。">刷新后临时选择会清空。请重新选择班次，再核对这一程。</EmptyState> : existing ? <div className="travel-empty"><IslandMark /><h2>这一程，已经留好位置。</h2><p>该选择已经创建订单，不必重复下单。</p><Link className="button gold" href={`${travelRoot}/orders/${existing.id}`}>查看已有订单 <Arrow /></Link></div> : <div className="checkout-grid">
      <form className="passenger-panel" onSubmit={e => { e.preventDefault(); t.confirmOrder(); }}>
        <div className="panel-heading"><span className="overline">YOUR TRAVEL COMPANIONS</span><h2>这一次，和谁一起？</h2><p>使用虚构乘车人，无需填写任何真实个人资料。</p></div>
        <label className="quantity-field">乘车人数<select aria-label="乘车人数" value={selection.quantity} onChange={e => t.changeQuantity(Number(e.target.value))}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} 位乘客</option>)}</select></label>
        <div className="passenger-list">{Array.from({ length: selection.quantity }, (_, i) => <div key={i}><span className="passenger-number">0{i + 1}</span><div><h3>旅客 {String.fromCharCode(65 + i)}</h3><p>系统提供的虚构身份</p></div><span className="status-badge">演示乘客</span></div>)}</div>
        <div className="confirmation-note"><h3>出发之前，请留意</h3><p>所有班次、票价与乘车人均为模拟。下一步可体验不同支付结果，不会扣款，也不会生成真实车票。</p><p>行程与订单仅保留在本次页面会话中，刷新后会清空。</p></div>
        <label className="confirm-check"><input type="checkbox" checked={selection.confirmed} onChange={e => t.confirmSelection(e.target.checked)} /><span>已核对行程与人数，确认创建模拟订单</span></label>
        {t.flowError && <p className="travel-error" role="alert">{t.flowError}</p>}
        <button type="submit" className="button gold full" disabled={!selection.confirmed}>确认创建订单 <Arrow /></button><Link className="text-link" href={`${travelRoot}/plan`}>返回选班次 <Arrow back /></Link>
      </form><TripSummary trip={selection.trip} quantity={selection.quantity}><p className="summary-caption">这不是终点，<br /><em>是下一段风景的开始。</em></p></TripSummary>
    </div>}
  </div>;
}

const paymentChoices: { value: PaymentResult; title: string; description: string }[] = [
  { value: "success", title: "支付成功", description: "完成模拟出票" },
  { value: "failed", title: "支付失败", description: "保留订单，重新支付" },
  { value: "unknown", title: "支付结果未知", description: "通过主动查单恢复" },
  { value: "ticketing_failed", title: "支付成功，出票异常", description: "重试出票，无需再付款" },
];

export function OrderPage({ id }: { id: string }) {
  const t = useTravel();
  const order = t.orders.find(o => o.id === id);
  const result = useRef<HTMLHeadingElement>(null);
  const previousStatus = useRef(order?.status);
  useEffect(() => {
    if (previousStatus.current !== order?.status) result.current?.focus({ preventScroll: false });
    previousStatus.current = order?.status;
  }, [order?.status]);
  return <div className="container inner-content">
    <StepHeading eyebrow="03 / YOUR JOURNEY AWAITS" title={order?.status === "ticketed" ? "下一段风景，等你启程。" : order?.status === "refunded" ? "这一程，已妥善收尾。" : "再一步，就可以出发。"} description="这是一段完整的模拟购票体验，不产生任何真实扣款。" step={3} back="/orders" backLabel="查看全部订单" />
    {!order ? <EmptyState title="这张订单不在当前会话中。">订单不会跨页面刷新或设备保存。你可以重新规划行程，或返回我的订单查看本次记录。</EmptyState> : <div className="checkout-grid">
      <section className="payment-panel" aria-label="模拟支付与出票"><div className="order-heading"><div><p className="overline">{order.id}</p><h2 ref={result} tabIndex={-1}>{statusLabels[order.status]}</h2></div><span className="status-badge">模拟交易</span></div>
        {(order.status === "pending" || order.status === "payment_failed") && <>
          {order.status === "payment_failed" && <div className="travel-error" role="status">此次模拟支付失败，订单已保留。可直接重试，无需重新下单。</div>}
          <h3 className="payment-title">选择一个支付场景</h3><p className="muted">不同的结果，都有明确的下一步。所有选项都不会扣款。</p>
          <div className="payment-choices">{paymentChoices.map((choice, i) => <button key={choice.value} onClick={() => t.transact(order.id, choice.value)}><span className="payment-index">0{i + 1}</span><span><b>{choice.title}</b><small>{choice.description}</small></span><Arrow /></button>)}</div>
        </>}
        {order.status === "payment_unknown" && <div className="order-result"><div className="result-symbol">?</div><h3>先确认，不重复支付。</h3><p>支付结果暂时未知。主动查单后，本演示将恢复为支付成功并完成出票。</p><button className="button gold" onClick={() => t.transact(order.id, "query")}>主动查询支付结果 <Arrow /></button></div>}
        {order.status === "ticketing_failed" && <div className="order-result"><div className="result-symbol">!</div><h3>已支付，等一张票。</h3><p>模拟出票暂未完成。重试出票即可，已经支付的订单无需再付款。</p><button className="button gold" onClick={() => t.transact(order.id, "retry_ticket")}>重试出票 <Arrow /></button></div>}
        {order.status === "ticketed" && <div className="order-result success"><div className="result-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg></div><h3>这一程，安排好了。</h3><p role="status">模拟支付与出票已完成，不会再次支付。<br />这张演示车票不能用于真实乘车。</p><div className="travel-ticket"><IslandMark /><p>岛见 · 演示车票<small>DEMO TICKET / NOT VALID FOR TRAVEL</small></p><span>{order.id}</span></div>{order.reschedule && <p className="journey-notice">改签处理中。原票保持有效，请从下方“订单服务”继续处理。</p>}<div className="order-next-actions"><Link className="button gold" href={`${travelRoot}/journeys/${order.id}`}>查看我的行程 <Arrow /></Link></div></div>}
        {order.status === "refunded" && <div className="order-result"><h3>演示退票已完成。</h3><p role="status">凭证失效、行程取消，对应座位已释放。不会发生真实退款。</p><Link className="button gold" href={`${travelRoot}/journeys/${order.id}`}>查看已取消行程 <Arrow /></Link></div>}
        {t.flowError && <p className="travel-error" role="alert">{t.flowError}</p>}
        <OrderServices order={order} />
        <div className="order-help-links"><Link className="text-link" href={`${travelRoot}/orders/${order.id}/support`}>演示客服工单 {t.supportTickets.filter(ticket => ticket.orderId === order.id).length ? `(${t.supportTickets.filter(ticket => ticket.orderId === order.id).length})` : ""} <Arrow /></Link><button className="quiet-button" type="button" onClick={() => t.openConcierge(order.id)}>与岛见聊这张订单 <Arrow /></button></div>
        {t.productOrders.filter(product => product.sourceTicketId === order.id).map(product => <div className="journey-notice" key={product.id}><p>关联交通服务：<Link className="text-link" href={`${travelRoot}/orders/${product.id}`}>{product.id} · {product.offer.title} <Arrow /></Link></p><p>{productSourceWarning(product, t.orders) ?? "车票与服务目前关联；产品单独结算，不随车票自动更改。"}</p></div>)}
        <OrderHistory order={order} />
        <div className="order-panel-bottom"><span>{order.quantity} 位演示乘客 · 仅本次会话有效</span><Link href={`${travelRoot}/orders`} className="text-link">查看全部订单 <Arrow /></Link></div>
      </section><TripSummary trip={order.trip} quantity={order.quantity}><p className="summary-caption">沿途的风景，<br /><em>值得慢一点。</em></p></TripSummary>
    </div>}
  </div>;
}

export function OrdersPage() {
  const { orders, orderIds, productOrders, newJourney } = useTravel();
  const [filter, setFilter] = useState<"all" | "tickets" | "products" | "after_sales">("all");
  const tickets = orders.map(order => ({ kind: "ticket" as const, order }));
  const products = productOrders.map(order => ({ kind: "product" as const, order }));
  const visible = (filter === "products" ? products : filter === "tickets" ? tickets : filter === "after_sales" ? tickets.filter(({ order }) => order.reschedule || order.events.some(event => event.type === "refund" || event.type === "reschedule")) : [...tickets, ...products]).sort((a, b) => orderIds.indexOf(a.order.id) - orderIds.indexOf(b.order.id));
  return <div className="container inner-content">
    <StepHeading eyebrow="YOUR JOURNEY COLLECTION" title="每一程，都在这里。" description="查看本次体验里的行程，继续还未完成的安排。刷新页面后，这些记录会清空。" back="/plan" />
    <div className="orders-toolbar"><p>{String(orders.length + productOrders.length).padStart(2, "0")} 笔演示订单</p><button className="quiet-button" onClick={newJourney}>规划新行程 <Arrow /></button></div>
    {!!(orders.length + productOrders.length) && <div className="orders-filters" role="group" aria-label="订单筛选"><button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>全部</button><button type="button" aria-pressed={filter === "tickets"} onClick={() => setFilter("tickets")}>车票</button><button type="button" aria-pressed={filter === "products"} onClick={() => setFilter("products")}>交通产品</button><button type="button" aria-pressed={filter === "after_sales"} onClick={() => setFilter("after_sales")}>售后</button></div>}
    {!orders.length && !productOrders.length ? <EmptyState title="还没有订单。">选择一趟班次或交通产品，开始第一段演示行程。无需提供真实个人资料。</EmptyState> : !visible.length ? <div className="travel-empty compact"><IslandMark /><h2>这个分类还没有订单。</h2><p>车票、交通产品与车票售后会分别显示在这里。</p></div> : <div className="orders-list">{[...visible].reverse().map(item => item.kind === "ticket" ? <Link className="order-row" key={item.order.id} href={`${travelRoot}/orders/${item.order.id}`}><div className="order-date"><strong>{item.order.trip.date.slice(8)}</strong><span>{item.order.trip.date.slice(0, 7).replace("-", " / ")}</span></div><div className="order-route"><span className="route-small">{item.order.id} / 车票</span><h2>{item.order.trip.origin} <span>⟶</span> {item.order.trip.destination}</h2><p>{item.order.trip.depart} — {item.order.trip.arrive} · {item.order.quantity} 人</p></div><span className={`status-badge status-${item.order.status}`}>{item.order.reschedule ? "改签处理中" : statusLabels[item.order.status]}</span><div className="order-price"><strong><small>¥</small>{item.order.amount}</strong><span>模拟合计</span></div><Arrow /></Link> : <Link className="order-row" key={item.order.id} href={`${travelRoot}/orders/${item.order.id}`}><div className="order-date"><strong>{item.order.offer.date.slice(8)}</strong><span>{item.order.offer.date.slice(0, 7).replace("-", " / ")}</span></div><div className="order-route"><span className="route-small">{item.order.id} / {productKindLabels[item.order.offer.kind]}</span><h2>{item.order.offer.from} <span>⟶</span> {item.order.offer.to}</h2><p>{item.order.offer.depart} — {item.order.offer.arrive} · {item.order.quantity} 人</p></div><span className="status-badge">{productStatusLabels[item.order.status]}</span><div className="order-price"><strong><small>¥</small>{(item.order.amountCents / 100).toFixed(2)}</strong><span>模拟合计</span></div><Arrow /></Link>)}</div>}
    <div className="orders-closing"><span>THE NEXT CHAPTER</span><p>下一次出发，<em>也从这里开始。</em></p><Link className="text-link" href={travelRoot}>回到山海之间 <Arrow /></Link></div>
  </div>;
}

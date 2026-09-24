"use client";

import Link from "next/link";
import { useState } from "react";
import { addDays, dateLabel } from "@/lib/works/island-travel/domain";
import { matchProducts, productAmountCents, productKindLabels, productOffers, productSourceWarning, productStatusLabels, type ProductOffer } from "@/lib/works/island-travel/products";
import { travelRoot, useTravel } from "./TravelProvider";
import { Arrow, EmptyState, StepHeading } from "./TravelUI";

const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
export function ProductCard({ offer, onSelect }: { offer: ProductOffer; onSelect: () => void }) {
  return <article className="product-card"><div><span className="overline">{productKindLabels[offer.kind]}</span><h3>{offer.title}</h3><p>{offer.from} → {offer.to}</p><p>{dateLabel(offer.date)} · {offer.depart}—{offer.arrive} · 约 {offer.minutes} 分钟</p></div><div className="product-card-side"><strong>{money(offer.priceCents)}</strong><small>{offer.kind === "charter" ? `每辆车 · 最多 ${offer.capacity} 人 · 余 ${offer.available} 辆` : `每人 · 最多 ${offer.capacity} 人 · 余 ${offer.available} 席`}</small><button className="quiet-button" type="button" disabled={offer.available < 1} onClick={onSelect}>核对并预订 <Arrow /></button></div></article>;
}
export function ProductsPage() {
  const t = useTravel();
  const [date, setDate] = useState("");
  const suggested = t.conditions.date;
  const effective = date || (suggested && suggested >= t.today && suggested <= addDays(t.today, 6) ? suggested : t.today);
  const requested = t.productQuery ? t.conditions.quantity ?? 1 : 1;
  const offers = t.today ? matchProducts(productOffers(effective, t.productOrders, t.today), t.productQuery).filter(offer => offer.capacity >= requested && offer.available >= (offer.kind === "charter" ? 1 : requested)) : [];
  return <div className="container inner-content"><StepHeading eyebrow="BEYOND THE STATION" title="抵达之后，也安排妥帖。" description="车站接驳、景区直通车与包车均为本地虚构产品；按每人或每辆车计价，不产生真实预订。" />
    <div className="product-date"><label htmlFor="product-date">服务日期</label><select id="product-date" value={effective} onChange={event => setDate(event.target.value)}>{t.today ? Array.from({ length: 7 }, (_, index) => addDays(t.today, index)).map(day => <option key={day} value={day}>{dateLabel(day)} · {day}</option>) : <option value="">加载日期</option>}</select></div>
    {t.productQuery && <p className="journey-notice">按“{t.productQuery}”筛选本地目录。<button className="quiet-button" type="button" onClick={() => t.setProductQuery("")}>显示全部产品</button></p>}
    <div className="product-list">{offers.map(offer => <ProductCard key={offer.id} offer={offer} onSelect={() => t.selectProduct(offer, requested)} />)}</div>
    {!offers.length && <div className="journey-notice">所选日期暂无可售服务，请选择未来七天内的演示日期。</div>}
    <p className="table-note">虚构地点、价格与容量 · 页面内模拟付款 · 产品售后本批暂不开放</p>
  </div>;
}
export function ProductConfirmationPage() {
  const t = useTravel();
  const selection = t.productSelection;
  const existing = selection && t.productOrders.find(order => order.key === selection.key);
  const current = selection && t.today ? productOffers(selection.offer.date, t.productOrders, t.today).find(offer => offer.id === selection.offer.id) : null;
  return <div className="container inner-content"><StepHeading eyebrow="CONFIRM YOUR SERVICE" title="把这一段接上。" description="核对日期、地点、计价单位与人数后，再明确创建模拟产品订单。" back="/products" backLabel="返回交通产品" />
    {!selection ? <EmptyState title="还没有选择交通产品。">刷新后选择会清空。请从交通产品目录重新进入。</EmptyState> : existing ? <div className="journey-notice"><h2>这一段已经预订。</h2><p>不能重复创建相同产品订单。</p><Link className="text-link" href={`${travelRoot}/orders/${existing.id}`}>查看已有订单 <Arrow /></Link></div> : <form className="product-confirm" onSubmit={event => { event.preventDefault(); t.confirmProduct(); }}>
      <span className="overline">{productKindLabels[selection.offer.kind]}</span><h2>{selection.offer.title}</h2><p>{selection.offer.from} → {selection.offer.to}</p><p>{dateLabel(selection.offer.date)} · {selection.offer.depart}—{selection.offer.arrive}</p>
      <label className="quantity-field">乘坐人数<select aria-label="产品乘坐人数" value={selection.quantity} onChange={event => t.setProductSelection({ ...selection, quantity: Number(event.target.value), confirmed: false })}>{Array.from({ length: Math.min(5, selection.offer.capacity) }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} 人</option>)}</select></label>
      <dl className="product-total"><div><dt>计价单位</dt><dd>{selection.offer.kind === "charter" ? "每辆车固定价" : "每人"}</dd></div><div><dt>模拟合计</dt><dd>{money(productAmountCents(selection.offer, selection.quantity))}</dd></div><div><dt>演示联系人</dt><dd>岛见演示旅客 · 无真实联系方式</dd></div></dl>
      {selection.sourceTicketId && <p className="journey-notice">来自车票 {selection.sourceTicketId}。车票退款或改签后，请自行检查本产品安排，不会自动更改或退款。</p>}
      {!current || current.available < (selection.offer.kind === "charter" ? 1 : selection.quantity) ? <p className="travel-error" role="alert">当前余量不足或日期不可售，请返回重新选择。</p> : null}
      <label className="confirm-check"><input type="checkbox" checked={selection.confirmed} onChange={event => t.setProductSelection({ ...selection, confirmed: event.target.checked })} />已核对产品、人数与金额，确认创建模拟订单</label>
      {t.flowError && <p className="travel-error" role="alert">{t.flowError}</p>}
      <button className="button gold" type="submit" disabled={!selection.confirmed || !current || current.available < (selection.offer.kind === "charter" ? 1 : selection.quantity)}>确认创建产品订单 <Arrow /></button>
    </form>}
  </div>;
}
export function ProductOrderPage({ id }: { id: string }) {
  const t = useTravel();
  const order = t.productOrders.find(item => item.id === id);
  const [completeConfirmed, setCompleteConfirmed] = useState(false);
  const warning = order ? productSourceWarning(order, t.orders) : null;
  return <div className="container inner-content"><StepHeading eyebrow="YOUR SERVICE" title="路上的安排，在这里。" description="产品支付与服务状态仅供演示，不出票、不开通车票售后，也不产生真实费用。" back="/orders" backLabel="查看全部订单" />
    {!order ? <EmptyState title="这张产品订单不在当前会话中。">刷新后全部演示订单都会清空。</EmptyState> : <section className="product-confirm"><div className="order-heading"><div><span className="overline">{order.id} / {productKindLabels[order.offer.kind]}</span><h2>{productStatusLabels[order.status]}</h2></div><span className="status-badge">演示服务</span></div>
      <h3>{order.offer.title}</h3><p>{order.offer.from} → {order.offer.to}</p><p>{dateLabel(order.offer.date)} · {order.offer.depart}—{order.offer.arrive} · {order.quantity} 人</p>
      <dl className="product-total"><div><dt>计价单位</dt><dd>{order.offer.kind === "charter" ? "每辆车" : "每人"}</dd></div><div><dt>订单金额</dt><dd>{money(order.amountCents)}</dd></div><div><dt>联系人</dt><dd>岛见演示旅客</dd></div></dl>
      {order.sourceTicketId && <p>关联车票：<Link className="text-link" href={`${travelRoot}/orders/${order.sourceTicketId}`}>{order.sourceTicketId} <Arrow /></Link></p>}
      {warning && <p className="journey-notice" role="status">{warning}</p>}
      {(order.status === "pending" || order.status === "payment_failed") && <><h3 className="payment-title">选择模拟支付结果</h3>{order.status === "payment_failed" && <p className="journey-notice" role="status">此次支付失败，原订单已保留，可重试。</p>}<div className="payment-choices"><button onClick={() => t.transactProduct(id, "success")}>支付成功 · 服务待使用 <Arrow /></button><button onClick={() => t.transactProduct(id, "failed")}>支付失败 · 保留订单 <Arrow /></button><button onClick={() => t.transactProduct(id, "unknown")}>支付结果未知 · 主动查单 <Arrow /></button></div></>}
      {order.status === "payment_unknown" && <div className="journey-notice" role="status"><h3>先查单，不重复支付。</h3><p>查单将恢复为服务待使用；此时不能重新支付。</p><button className="button gold" onClick={() => t.transactProduct(id, "query")}>主动查询支付结果 <Arrow /></button></div>}
      {order.status === "ready" && <section className="journey-actions"><h3>体验服务完成</h3><p>这只是手动演示状态，不代表真实车辆运行。</p><label className="confirm-check"><input type="checkbox" checked={completeConfirmed} onChange={event => setCompleteConfirmed(event.target.checked)} />确认模拟服务已完成</label><button className="button gold" disabled={!completeConfirmed} onClick={() => { t.transactProduct(id, "complete"); setCompleteConfirmed(false); }}>确认完成服务 <Arrow /></button></section>}
      {order.status === "completed" && <p className="journey-notice" role="status">演示服务已完成，重复操作不会再次推进。</p>}
      <div className="journey-notice"><h3>产品售后范围</h3><p>本批暂不开放产品退票、改签或开票。车票售后操作不适用于此订单。</p></div>
      <div className="order-help-links"><Link className="text-link" href={`${travelRoot}/orders/${id}/support`}>演示客服工单 <Arrow /></Link><button className="quiet-button" type="button" onClick={() => t.openConcierge(id)}>与岛见聊这张订单 <Arrow /></button></div>
      {t.flowError && <p className="travel-error" role="alert">{t.flowError}</p>}
    </section>}
  </div>;
}

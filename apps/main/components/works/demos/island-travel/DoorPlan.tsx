"use client";

import Link from "next/link";
import { useState } from "react";
import { productOffers, productSourceWarning } from "@/lib/works/island-travel/products";
import { travelRoot, useTravel } from "./TravelProvider";
import { Arrow } from "./TravelUI";

const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
export function DoorPlanSection() {
  const t = useTravel();
  const [fromChoice, setFromChoice] = useState<{ condition: string | null | undefined; value: string } | null>(null);
  const [toChoice, setToChoice] = useState<{ condition: string | null | undefined; value: string } | null>(null);
  const from = fromChoice && fromChoice.condition === t.conditions.origin ? fromChoice.value : t.conditions.origin === "海口汽车站" ? "海口汽车站" : "海口美兰机场";
  const to = toChoice && toChoice.condition === t.conditions.destination ? toChoice.value : t.conditions.destination === "三亚汽车站" ? "三亚汽车站" : "三亚湾景区";
  const [tried, setTried] = useState(false);
  const plan = t.doorPlan;
  const ticketKey = t.doorKeys?.ticket;
  const ticketOrder = t.orders.find(order => order.key === ticketKey);
  const ticketMatches = !!ticketOrder && ticketOrder.status !== "refunded" && !ticketOrder.reschedule && ticketOrder.trip.id === plan?.legs.find(leg => leg.key === "ticket")?.trip?.id && ticketOrder.quantity === plan.quantity;
  const ticketValid = ticketMatches && ticketOrder?.status === "ticketed";
  const ticketChanged = !!ticketOrder && !ticketMatches;
  const offers = plan ? productOffers(plan.date, t.productOrders, t.today) : [];
  const planStale = !!plan && (ticketChanged || plan.legs.some(leg => {
    if (!leg.offer) return false;
    const key = t.doorKeys?.[leg.key];
    const booked = t.productOrders.find(order => order.key === key);
    if (booked) return !!productSourceWarning(booked, t.orders) || booked.offer.id !== leg.offer?.id || booked.quantity !== plan.quantity;
    return (offers.find(offer => offer.id === leg.offer?.id)?.available ?? 0) < (leg.offer.kind === "charter" ? 1 : plan.quantity);
  }));
  const hasConnectionProducts = t.trips.some(trip => {
    const candidates = productOffers(trip.date, t.productOrders, t.today).filter(offer => offer.capacity >= (t.conditions.quantity ?? 1) && offer.available >= (offer.kind === "charter" ? 1 : t.conditions.quantity ?? 1));
    return (from === `${trip.origin}汽车站` || candidates.some(offer => offer.from === from && offer.to === `${trip.origin}汽车站`)) &&
      (to === `${trip.destination}汽车站` || candidates.some(offer => offer.from === `${trip.destination}汽车站` && offer.to === to));
  });
  return <section id="door-plan" className="door-plan" aria-labelledby="door-title"><div className="door-heading"><span className="overline">DOOR TO DOOR / LOCAL DEMO</span><h2 id="door-title">从一处抵达，到下一处风景。</h2><p>只使用预设公共地点和固定演示时长。每段至少预留 30 分钟换乘，路线由本地规则校验。</p></div>
    <div className="door-controls"><label>公共出发点<select value={from} onChange={event => setFromChoice({ condition: t.conditions.origin, value: event.target.value })}><option>海口美兰机场</option><option>海口汽车站</option></select></label><label>公共目的地<select value={to} onChange={event => setToChoice({ condition: t.conditions.destination, value: event.target.value })}><option>三亚湾景区</option><option>三亚汽车站</option></select></label><button className="button gold" type="button" disabled={!t.trips.length} onClick={() => { setTried(true); t.planDoor(from, to); }}>生成演示方案 <Arrow /></button></div>
    {!t.trips.length && <p className="journey-notice">先查询海口至三亚等未来七天的可售车票，再生成方案。</p>}
    {tried && !plan && t.trips.length > 0 && <p className="journey-notice" role="status">{hasConnectionProducts ? "有对应产品，但当前班次与产品时间不足 30 分钟换乘。" : "当前公共地点之间缺少可售衔接产品，或产品容量不足。"}请调整日期、时段、人数或公共地点；不会虚构路线。</p>}
    {plan && t.doorKeys && <div className="door-result"><div className="door-result-top"><h3>{plan.legs[0].from} → {plan.legs.at(-1)?.to}</h3><p>{planStale ? "原草稿估价" : "当前方案合计"} <strong>{money(plan.totalCents)}</strong><small>各订单分别结算 · 此处不是一键支付价</small></p></div>{planStale && <p className="journey-notice" role="status">关联订单或产品余量已变化，部分段需重新检查。原草稿合计不可直接用于下单，请重新生成方案。</p>}<ol className="door-legs">{plan.legs.map((leg, index) => {
      const key = t.doorKeys?.[leg.key];
      const productOrder = t.productOrders.find(order => order.key === key);
      const booked = leg.kind === "ticket" ? ticketOrder : productOrder;
      const soldOut = leg.offer && !productOrder && (offers.find(offer => offer.id === leg.offer?.id)?.available ?? 0) < (leg.offer.kind === "charter" ? 1 : plan.quantity);
      const changed = leg.kind === "ticket" ? ticketChanged : !!productOrder && (!!productSourceWarning(productOrder, t.orders) || productOrder.offer.id !== leg.offer?.id || productOrder.quantity !== plan.quantity);
      const status = changed || soldOut || (leg.kind === "product" && ticketChanged) ? "需重新检查" : booked ? "已预订" : "未预订";
      return <li key={leg.key}><div className="door-leg-main"><span className="overline">0{index + 1} / {leg.title}</span><h4>{leg.from} → {leg.to}</h4><p>{leg.depart}—{leg.arrive} · {money(leg.amountCents)}</p><span className="status-badge">{status}</span></div><div className="door-leg-action">{booked ? <Link className="text-link" href={`${travelRoot}/orders/${booked.id}`}>查看订单 <Arrow /></Link> : status === "需重新检查" ? <span>请重新生成方案</span> : leg.kind === "ticket" && leg.trip ? <button className="quiet-button" type="button" onClick={() => t.selectTrip(leg.trip!, plan.quantity, true, key)}>核对车票 <Arrow /></button> : !ticketValid ? <span>先完成车票模拟出票</span> : leg.offer ? <button className="quiet-button" type="button" onClick={() => t.selectProduct(leg.offer!, plan.quantity, ticketOrder!.id, key)}>核对产品 <Arrow /></button> : null}</div>{plan.waits[index] !== undefined && <p className="door-wait">换乘等待 {plan.waits[index]} 分钟 · 最低缓冲 30 分钟</p>}</li>;
    })}</ol><p className="table-note">方案仅为本次会话的规划草稿。已下单段不会重复创建；关联车票退款或改签后请重新核对，不会自动购买替代产品。</p></div>}
  </section>;
}

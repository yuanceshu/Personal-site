"use client";

import Link from "next/link";
import { dateLabel, invoiceUnavailableReason, paymentLedger, refundUnavailableReason, rescheduleUnavailableReason, type Order } from "@/lib/works/island-travel/domain";
import { travelRoot } from "./TravelProvider";
import { Arrow } from "./TravelUI";

const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

export function OrderServices({ order }: { order: Order }) {
  const services = [
    { title: "乘车凭证", href: `${travelRoot}/journeys/${order.id}`, action: "查看行程与凭证", reason: order.status === "ticketed" ? null : order.status === "refunded" ? "退款后凭证已失效。" : "完成模拟出票后可查看。" },
    { title: "退票", href: `${travelRoot}/orders/${order.id}/refund`, action: "查看退票试算", reason: refundUnavailableReason(order) },
    { title: "改签", href: `${travelRoot}/orders/${order.id}/reschedule`, action: order.reschedule ? "继续处理改签" : "选择新班次", reason: order.reschedule ? null : rescheduleUnavailableReason(order) },
    { title: "开票", href: `${travelRoot}/orders/${order.id}/invoice`, action: "查看演示开票", reason: invoiceUnavailableReason(order) === "当前票价版本已有有效演示开票记录。" ? null : invoiceUnavailableReason(order) },
  ];
  return <section className="order-services" aria-labelledby="order-services-title"><h3 id="order-services-title">订单服务</h3><p>本次体验中的凭证与售后操作，均在页面内完成。</p><ul>{services.map(service => <li key={service.title}><div><strong>{service.title}</strong>{service.reason && <small>{service.reason}</small>}</div>{service.reason ? <span className="service-unavailable">暂不可用</span> : <Link href={service.href}>{service.action} <Arrow /></Link>}</li>)}</ul></section>;
}

export function OrderHistory({ order }: { order: Order }) {
  const ledger = paymentLedger(order);
  return <section className="order-history" aria-labelledby="order-history-title"><h3 id="order-history-title">操作与金额记录</h3><p>所有金额均为演示，按整数分累计。{order.status === "payment_unknown" ? "初始支付结果待查单，暂不计入已确认支付。" : ""}</p><dl className="order-ledger"><div><dt>累计模拟支付</dt><dd>{money(ledger.paidCents)}</dd></div><div><dt>累计模拟退回</dt><dd>{money(ledger.returnedCents)}</dd></div><div><dt>当前净额</dt><dd>{money(ledger.netCents)}</dd></div></dl><ol><li><span>01</span><div><strong>创建演示订单</strong><p>{dateLabel(order.events.find(event => event.type === "reschedule")?.from.date ?? order.trip.date)} · 初始票价 {money(order.initialAmountCents)}</p></div></li>{order.events.map((event, index) => <li key={index}><span>{String(index + 2).padStart(2, "0")}</span><div>{event.type === "reschedule" ? <><strong>改签成功</strong><p>{dateLabel(event.from.date)} {event.from.depart} → {dateLabel(event.to.date)} {event.to.depart}；{event.deltaCents > 0 ? "补差" : event.deltaCents < 0 ? "退差" : "零差价"} {money(Math.abs(event.deltaCents))}</p></> : event.type === "refund" ? <><strong>退票成功</strong><p>演示手续费 {money(event.feeCents)}；模拟退回 {money(event.refundCents)}。凭证已失效。</p></> : <><strong>生成演示开票记录 · {event.fareVersion === order.fareVersion && order.status === "ticketed" ? "有效" : "已作废"}</strong><p>{event.title === "personal" ? "演示个人抬头" : "岛见演示公司"} · {money(event.amountCents)}</p></>}</div></li>)}</ol></section>;
}

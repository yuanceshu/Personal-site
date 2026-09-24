"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { containsContactIdentity, supportLabels, supportResults, supportStatusLabels, type SupportKind, type SupportTicket } from "@/lib/works/island-travel/support";
import { travelRoot, useTravel } from "./TravelProvider";
import { Arrow, EmptyState, StepHeading } from "./TravelUI";

export function SupportPage({ id }: { id: string }) {
  const t = useTravel();
  const order = t.orders.find(item => item.id === id) ?? t.productOrders.find(item => item.id === id);
  const related = t.supportTickets.filter(item => item.orderId === id);
  const [kind, setKind] = useState<SupportKind>("lost");
  const [description, setDescription] = useState("");
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);
  const key = useRef("");
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const createdHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (created) createdHeading.current?.focus(); else if (review) reviewHeading.current?.focus(); }, [created, review]);
  const summary = kind === "human" ? "这是模拟人工协助工单，不会接通真实客服。" : "不会联系真实客服，也不会产生真实处理服务。";
  const invalid = containsContactIdentity(description);
  function resetDraft() { key.current = ""; setKind("lost"); setDescription(""); setReview(false); setConfirmed(false); setCreated(null); t.clearFlowError(); }
  function ticketCard(ticket: SupportTicket) {
    const next = ticket.status === "submitted" ? "processing" : ticket.status === "processing" ? "completed" : null;
    return <li key={ticket.id} className="support-ticket"><div className="support-ticket-head"><strong>{ticket.id} · {supportLabels[ticket.kind]}</strong><span className="status-badge" role="status">{supportStatusLabels[ticket.status]}</span></div><p>{ticket.description}</p><p className="muted">{ticket.status === "submitted" ? "演示已登记，尚未开始模拟处理。" : ticket.status === "processing" ? "仅为页面内模拟处理进度，没有真实客服介入。" : supportResults[ticket.kind]}</p>{next && <><label className="confirm-check"><input type="checkbox" checked={progressId === ticket.id} onChange={event => setProgressId(event.target.checked ? ticket.id : null)} />确认{next === "processing" ? "模拟开始处理" : "模拟处理完成"}</label><button type="button" className="quiet-button" disabled={progressId !== ticket.id} onClick={() => { if (t.progressSupport(ticket.id, next, progressId === ticket.id)) setProgressId(null); }}>确认{next === "processing" ? "受理" : "完成"} <Arrow /></button></>}</li>;
  }
  return <div className="container inner-content"><StepHeading eyebrow="DEMO CONCIERGE SERVICE" title="把需要帮助的事，留在这里。" description="客服工单只在本次浏览器页面会话内模拟，不会发送模型或接通真实客服。刷新后清空。" back={`/orders/${id}`} backLabel="返回对应订单" />
    {!order ? <EmptyState title="关联订单不在当前会话中。">请从本次体验中的订单重新进入；刷新后演示记录会清空。</EmptyState> : <div className="support-layout"><section className="support-panel" aria-labelledby="support-form-title"><span className="overline">{id} / SERVICE REQUEST</span><h2 id="support-form-title">提交演示客服工单</h2><p className="muted">演示联系人：岛见演示旅客 · 无真实联系方式。最多 500 字；请勿填写手机号或证件号码。</p>
      {created ? <div className="journey-notice" role="status"><h3 ref={createdHeading} tabIndex={-1}>演示工单 {created} 已提交</h3><p>仅生成一张工单，重复确认不会重复创建。可以在右侧体验模拟处理进度。</p><button className="quiet-button" type="button" onClick={resetDraft}>新建另一张演示工单 <Arrow /></button></div> : !review ? <form onSubmit={event => { event.preventDefault(); if (!invalid && description.trim()) { setReview(true); setConfirmed(false); t.clearFlowError(); } }}><label className="support-field" htmlFor="support-kind">服务类别<select id="support-kind" value={kind} onChange={event => setKind(event.target.value as SupportKind)}>{(Object.keys(supportLabels) as SupportKind[]).map(item => <option key={item} value={item}>{supportLabels[item]}</option>)}</select></label><label className="support-field" htmlFor="support-description">情况描述<textarea id="support-description" value={description} maxLength={500} rows={6} aria-invalid={invalid} aria-describedby="support-help" onChange={event => setDescription(event.target.value)} placeholder="只写演示情况，不填写真实联系方式或证件信息" /></label><p id="support-help" className={invalid ? "travel-error" : "muted"}>{invalid ? "检测到手机号、证件号码或住址，请移除后继续。" : `${description.length} / 500 字 · 描述只留在浏览器，不发送模型。`}</p><p className="journey-notice">{summary}</p><button className="button gold" type="submit" disabled={!description.trim() || invalid}>核对工单内容 <Arrow /></button></form> : <div className="support-review"><h3 ref={reviewHeading} tabIndex={-1}>提交前，再核对一次</h3><dl><div><dt>关联订单</dt><dd>{id}</dd></div><div><dt>服务类别</dt><dd>{supportLabels[kind]}</dd></div><div><dt>演示联系人</dt><dd>岛见演示旅客</dd></div><div><dt>情况描述</dt><dd className="support-description">{description.trim()}</dd></div></dl><p className="journey-notice">{summary} 描述不会发送 AI。</p><label className="confirm-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />已核对工单类别和描述，确认提交模拟工单</label><div className="support-actions"><button className="button gold" type="button" disabled={!confirmed} onClick={() => { const ticket = t.saveSupport({ key: key.current || (key.current = crypto.randomUUID()), orderId: id, kind, description }, confirmed); if (ticket) setCreated(ticket.id); }}>确认提交演示工单 <Arrow /></button><button className="quiet-button" type="button" onClick={() => { setReview(false); setConfirmed(false); }}>返回修改</button></div></div>}
      {t.flowError && <p className="travel-error" role="alert">{t.flowError}</p>}</section><aside className="support-history" aria-label="本订单的演示客服工单"><h2>处理进度</h2><p className="muted">仅手动模拟，不代表真实客服响应或结果。</p>{related.length ? <ol>{[...related].reverse().map(ticketCard)}</ol> : <p className="journey-notice">暂无工单。核对提交后，进度会显示在这里。</p>}<Link className="text-link" href={`${travelRoot}/orders/${id}`}>返回订单 <Arrow back /></Link></aside></div>}
  </div>;
}

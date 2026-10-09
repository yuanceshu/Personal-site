"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { amount, operationLabels, statusLabels, type ApplicationView, type ProposalView, type Records } from "@/lib/works/heating/client-contract";
import Image from "next/image";
import type { Focus } from "@/lib/works/heating/chat-view";
import { billSchema, orderSchema, type MaterialType } from "@/lib/works/heating/schema";

export function HeatMark({ small = false }: { small?: boolean }) {
  return <span className={`heat-mark${small ? " small" : ""}`} aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M12 10c-5 5 5 7 0 12M24 6c-5 5 5 7 0 12M36 10c-5 5 5 7 0 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M8 30h32M8 38h32M14 27v14M24 27v14M34 27v14" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg></span>;
}
export function AssistantAvatar({ welcome = false }: { welcome?: boolean }) {
  return <span className={welcome ? "heat-avatar welcome" : "heat-avatar"}><Image src="/projects/demos/heating/assistant.png" width={welcome ? 140 : 40} height={welcome ? 140 : 40} alt={welcome ? "和煦供暖服务助手" : ""} priority={welcome}/></span>;
}
export function Badge({ status }: { status: string }) { return <span className={`heat-badge ${["paid", "fee_paid", "approved"].includes(status) ? "good" : status === "needs_more_materials" || status === "failed" ? "attention" : ""}`}>{statusLabels[status] ?? status}</span>; }

export function Modal({ title, children, close, drawer = false }: { title: string; children: ReactNode; close: () => void; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog className={`heat-dialog${drawer ? " heat-drawer" : ""}`} ref={ref} aria-labelledby="heat-dialog-title" onCancel={event => { event.preventDefault(); close(); }}><h2 id="heat-dialog-title">{title}</h2>{children}<button className="heat-button quiet" onClick={close}>关闭</button></dialog>;
}
export function ProposalCard({ proposal, records, busy, confirm, cancel, active = true, completed = false }: { proposal: ProposalView; records: Records | null; busy: boolean; confirm: () => void; cancel: () => void; active?: boolean; completed?: boolean }) {
  const { name, input } = proposal.operation;
  const summary = proposal.summary && typeof proposal.summary === "object" ? proposal.summary as Record<string, unknown> : {};
  const summaryBill = billSchema.safeParse(summary.bill).data;
  const summaryOrder = orderSchema.safeParse(summary.order).data;
  const bill = records?.bills.find(b => b.id === input.billId || b.id === summaryBill?.id || records.orders.some(o => o.id === input.orderId && o.billId === b.id));
  const app = records?.applications.find(a => a.id === input.applicationId);
  const house = records?.houses.find(h => h.id === bill?.houseId || h.id === app?.houseId || h.id === input.houseId);
  const cents = bill?.amountCents ?? summaryBill?.amountCents ?? summaryOrder?.amountCents;
  const compact = Boolean(bill && ["create_payment", "simulate_payment"].includes(name));
  const outcome = input.outcome === "success" ? "模拟支付成功" : input.outcome === "failure" ? "模拟支付失败" : "模拟取消支付";
  return <section className={`heat-proposal${compact ? " compact" : ""}`} aria-label="等待您确认"><div className="heat-eyebrow">{completed ? "您已确认" : active ? "请您核对" : "此前的办理步骤"}</div><h3>{compact ? name === "create_payment" ? "核对以上账单后继续" : "最后一步：确认模拟支付" : operationLabels[name]}</h3>{house && !compact && <p>{house.address}</p>}{name === "bind_house" && <p>供暖户号：{String(input.account)}<br/>姓名：{String(input.name)}<br/>演示电话：{String(input.phone)}</p>}{cents !== undefined && !compact && <p className="heat-confirm-amount">¥ {amount(cents)}</p>}{name === "simulate_payment" && input.outcome !== "success" && <p>{outcome}，不会扣取真实资金。</p>}{["submit_application", "resubmit_application"].includes(name) && <p>确认后提交材料登记记录，进入模拟审核。</p>}{name === "create_draft" && <p>先准备两类材料，核对齐全后再提交审核。</p>}{name === "create_disconnection_bill" && <p>审核已经通过，请核对本次断暖费用。</p>}<p className="heat-muted">{completed ? "确认已处理，请查看下方返回结果。" : active ? "仅用于演示，不会扣取真实资金。您确认后才会办理。" : "这项确认已失效，您可以重新告诉助手想办理什么。"}</p><div className="heat-actions"><button className="heat-button primary" disabled={busy || !active} onClick={confirm}>{busy ? "正在处理…" : (name === "simulate_payment" && input.outcome !== "success" ? `确认${outcome}` : operationLabels[name])}</button><button className="heat-button quiet" disabled={busy || !active} onClick={cancel}>暂不办理</button></div></section>;
}

export function ApplicationCard({ app, records, busy, send, submitMaterial }: { app: ApplicationView; records: Records; busy: boolean; send: (text: string) => void; submitMaterial: (id: string, type: MaterialType) => void }) {
  const house = records.houses.find(h => h.id === app.houseId);
  const editable = ["draft", "needs_more_materials"].includes(app.status);
  return <article className="heat-business-card" data-testid="application-card"><div className="heat-card-top"><h3>断暖申请</h3><Badge status={app.status}/></div><p>{house?.address}</p>{app.status === "needs_more_materials" && <p className="heat-callout">{app.events.filter(e => e.to === "needs_more_materials").at(-1)?.reason ?? "请查看需要补充的材料"}</p>}<p>{app.status === "draft" ? "请点击“模拟提交”登记以下两类演示材料，再交给助手核对。" : app.nextStep}</p><div className="heat-materials">{(["ownership", "construction"] as const).map(type => {
    const material = app.materials.filter(m => m.type === type && !app.returnedMaterialIds.includes(m.id)).at(-1);
    const replace = app.requiredReplacements.includes(type);
    return <div className={`heat-material${replace ? " needs-replacement" : ""}`} key={type}><div><strong>{type === "ownership" ? "产权证明或合同" : "断暖施工照片"}</strong><span className={material ? "heat-good-text" : "heat-warn-text"}>{material ? "已登记" : replace ? "请模拟提交补件" : "还需提供"}</span>{material && <span className="heat-file-name">{material.fileName}</span>}</div>{editable && <button className="heat-button quiet" disabled={busy || Boolean(material)} onClick={() => submitMaterial(app.id, type)}>模拟提交</button>}</div>;
  })}</div><p className="heat-storage-note">点击后自动登记预设演示材料，不需要选择或上传真实文件。材料齐全后仍需您确认提交申请。</p>{editable && <button className="heat-button primary full" disabled={busy} onClick={() => send(`请核对工单 ${app.id} 的材料，${app.status === "needs_more_materials" ? "我已补充材料，请重新提审" : "资料齐了，帮我提交"}。请先让我核对确认。`)}>{app.status === "needs_more_materials" ? "核对补件并重新提审" : "核对材料并提交"}</button>}{app.status === "approved" && <button className="heat-button primary full" disabled={busy} onClick={() => send(`工单 ${app.id} 审核通过了，我想缴纳对应断暖费用，请继续。`)}>继续办理断暖缴费</button>}<details className="heat-progress"><summary>查看办理记录</summary><p className="heat-id">演示工单 {app.id}</p><ol>{app.events.map(event => <li key={event.id}><strong>{statusLabels[event.to] ?? event.to}</strong><time>{new Date(event.at).toLocaleString("zh-CN", { hour12: false })}</time><p>{event.reason}</p></li>)}</ol><button className="heat-button quiet full" disabled={busy} onClick={() => send(`我刚才的断暖申请 ${app.id} 审核到哪一步了？`)}>向助手查询进度</button></details></article>;
}
export function BusinessCards({ records, focus, mode, busy, send, submitMaterial, invoice, hideBillActions = false }: { records: Records; focus: Focus; mode?: string; busy: boolean; send: (text: string) => void; submitMaterial: (id: string, type: MaterialType) => void; invoice: (id: string) => void; hideBillActions?: boolean }) {
  if (mode === "binding_details" && !records.houses.length) return <section className="heat-business-card heat-binding"><h3>用演示资料绑定房屋</h3><p>不用填写真实个人信息，我们已准备好一份虚构资料。</p><dl className="heat-facts"><dt>供暖户号</dt><dd>DEMO-H002</dd><dt>演示姓名</dt><dd>演示住户B</dd><dt>演示电话</dt><dd>DEMO-PHONE-B</dd></dl><button className="heat-button primary full" disabled={busy} onClick={() => send("我还没有绑定房子。供暖户号是 DEMO-H002，姓名是演示住户B，电话是 DEMO-PHONE-B，请帮我核对绑定。")}>使用演示资料绑定</button></section>;
  if (mode === "choose_house" && records.houses.length) return <section className="heat-business-card"><h3>您要办理哪套房屋？</h3><div className="heat-house-choices">{records.houses.map((house, index) => <button className="heat-button quiet" key={house.id} disabled={busy} onClick={() => send(`我选择第${index + 1}套房屋 ${house.address}（${house.id}），请承接刚才的需求继续办理。`)}><strong>第{index + 1}套</strong><span>{house.address}</span><span>{house.areaHundredths / 100}㎡</span></button>)}</div></section>;
  const bills = records.bills.filter(b => focus.billIds.includes(b.id));
  const apps = records.applications.filter(a => focus.applicationIds.includes(a.id));
  const houses = records.houses.filter(h => focus.houseIds.includes(h.id) && !bills.some(b => b.houseId === h.id) && !apps.some(a => a.houseId === h.id));
  return <div className="heat-business-list">{houses.map(h => <article className="heat-business-card" key={h.id}><h3>已绑定房屋</h3><p>{h.address}</p><span className="heat-muted">计费面积 {h.areaHundredths / 100}㎡</span></article>)}{bills.map(bill => {
    const house = records.houses.find(h => h.id === bill.houseId);
    const pending = records.orders.find(o => o.billId === bill.id && o.status === "pending");
    const receipt = records.invoices.find(i => i.billId === bill.id);
    const latestOrder = records.orders.filter(o => o.billId === bill.id).at(-1);
    const related = bill.kind === "heating" ? records.applications.find(a => a.houseId === bill.houseId && a.year === bill.year) : undefined;
    return <article className="heat-business-card" key={bill.id} data-testid="bill-card"><div className="heat-card-top"><h3>{bill.kind === "heating" ? "供暖费用" : "断暖费用"}</h3><Badge status={bill.status}/></div><p>{house?.address}</p><div className="heat-bill-fields"><span>{bill.year} 年度</span><span>计费面积 {house ? house.areaHundredths / 100 : "—"}㎡</span></div><p className="heat-money"><span>¥</span> {amount(bill.amountCents)}</p><span className="heat-muted">{bill.kind === "heating" ? "本年度供暖费用" : "断暖基础费用"} · 模拟账单</span>{latestOrder && <div className={`heat-payment-result ${latestOrder.status}`} role="status"><strong>{latestOrder.status === "paid" ? "模拟支付成功" : latestOrder.status === "failed" ? "模拟支付失败" : latestOrder.status === "cancelled" ? "模拟支付已取消" : "账单已确认，等待付款"}</strong><p>{latestOrder.status === "paid" ? "已缴清，可查看模拟电子发票。" : latestOrder.status === "failed" ? "本次未完成缴费，您可以继续办理。" : "不会扣取真实资金。"}</p></div>}{!hideBillActions && bill.status !== "paid" && <button className="heat-button primary full" disabled={busy} onClick={() => send(related ? `房屋 ${house?.address}（${bill.houseId}）已有断暖工单 ${related.id}，请核对应缴项目并引导我继续。` : pending ? `请将缴费订单 ${pending.id} 模拟支付成功，给我明确确认卡片。` : `我要缴纳房屋 ${house?.address}（${bill.houseId}）的${bill.kind === "heating" ? "正常供暖费" : "断暖费用"}，账单 ${bill.id}，请先核对并让我确认。`)}>{pending ? "继续付款" : "请助手办理缴费"}</button>}{receipt && <button className="heat-button quiet full" disabled={busy} onClick={() => invoice(receipt.id)}>查看模拟电子发票</button>}<details className="heat-progress"><summary>账单详情</summary><p className="heat-id">账单 {bill.id}{latestOrder && <><br/>支付记录 {latestOrder.id}</>}</p></details></article>;
  })}{apps.map(app => <ApplicationCard key={app.id} app={app} records={records} busy={busy} send={send} submitMaterial={submitMaterial}/>)}</div>;
}

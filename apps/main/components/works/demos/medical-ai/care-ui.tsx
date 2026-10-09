'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { ChatResponse } from '@/lib/works/medical-ai/src/schemas/chat';
import type { VisitContext } from '@/lib/works/medical-ai/src/domain/visit-context';
import type { SafetyResult } from '@/lib/works/medical-ai/src/safety/types';
import type { ExamOrder } from '@/lib/works/medical-ai/src/tools/mock-tools';
import type { RawCtReport } from '@/lib/works/medical-ai/src/report/types';
import { JOURNEY_GROUPS, STAGE_LABELS, STATUS_LABELS, money, presentResponse } from '@/lib/works/medical-ai/src/ui/presentation';

export function Icon({ name, size = 20 }: { name: 'spark' | 'arrow' | 'chat' | 'path' | 'cross' | 'file' | 'pin' | 'check' | 'close' | 'refresh' | 'alert' | 'send'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    spark: <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z" /><path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6Z" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    chat: <path d="M20 15a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3ZM8 8h8M8 12h5" />,
    path: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="19" r="2" /><path d="M8 5h8a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h8" /></>,
    cross: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" />,
    file: <path d="M14 3H5v18h14V8Zm0 0v5h5M8 12h8M8 16h6" />,
    pin: <><path d="M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3" /></>,
    alert: <><path d="m12 3 10 18H2Z" /><path d="M12 9v5m0 3v.01" /></>,
    send: <path d="m3 10 18-7-7 18-3-8Zm8 3 10-10" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) { return <span className={'badge ' + tone}>{children}</span>; }
export function AssistantMark() { return <span className="assistant-mark"><Icon name="spark" /></span>; }

export function Journey({ context }: { context: VisitContext }) {
  const index = JOURNEY_GROUPS.findIndex((group) => group.stages.includes(context.current_stage));
  return <section className="journey" id="journey" aria-label="就医旅程">
    <div className="section-heading"><h2>本次就医旅程</h2><span>{index + 1} / {JOURNEY_GROUPS.length}</span></div>
    <ol className="journey-steps">{JOURNEY_GROUPS.map((group, i) => <li key={group.label} className={i < index ? 'done' : i === index ? 'current' : ''} aria-current={i === index ? 'step' : undefined}>
      <span className="step-dot">{i < index || context.current_stage === 'FINISHED' ? <Icon name="check" size={14} /> : i + 1}</span><div><strong>{group.label}</strong>{i === index && <small>{STAGE_LABELS[context.current_stage]}</small>}</div>
    </li>)}</ol>
  </section>;
}

export function SafetyBanner({ safety, critical }: { safety: SafetyResult | null; critical?: boolean }) {
  if (safety?.action !== 'ESCALATE' && !critical) return null;
  return <section className="safety-banner" role="alert"><Icon name="alert" size={25} /><div>
    <strong>{critical ? '报告提示需要及时联系医生' : '请优先寻求现场医疗帮助'}</strong>
    {safety?.action === 'ESCALATE' && <p>{safety.message}</p>}
    {critical && <p>报告包含危急提示，请立即联系现场医护人员，由医生及时评估。</p>}
  </div></section>;
}

interface ResultProps {
  response: ChatResponse;
  current: VisitContext | null;
  blocked: boolean;
  onMessage: (message: string) => void;
}
function ResultCard({ title, children, tone = '' }: { title: string; children: ReactNode; tone?: string }) {
  return <section className={'result-card ' + tone}><div className="result-heading"><h3>{title}</h3><span>本轮查询结果</span></div>{children}</section>;
}
export function ResultCards({ response, current, blocked, onMessage }: ResultProps) {
  const data = presentResponse(response);
  return <div className="result-list">
    {data.department && response.debug.triage_status === 'READY' && ['SYMPTOM_CONSULTATION', 'TRIAGE_EXPLANATION'].includes(response.debug.intent) && <ResultCard title="就医方向建议" tone="recommendation"><div className="recommendation-title"><Icon name="cross" /><strong>{data.department.department_name}</strong></div><p>就医方向建议，具体诊断需由接诊医生评估。</p><button className="button secondary" disabled={blocked || current?.current_stage !== 'PRE_VISIT'} onClick={() => onMessage('帮我看看今天的号。')}>查看可预约医生与号源 <Icon name="arrow" size={16} /></button></ResultCard>}
    {data.doctors?.map((doctor) => <ResultCard key={doctor.doctor_id} title="医生与号源"><div className="doctor-profile"><span className="doctor-avatar"><Icon name="cross" size={24} /></span><div><strong>{doctor.name}</strong><p>{doctor.title} · {doctor.department}</p></div><Badge>演示医生</Badge></div>
      {data.slots ? <><p className="field-label">选择时间后，确认预约</p><div className="slot-list">{data.slots.filter(slot => slot.doctor_id === doctor.doctor_id).map(slot => <button key={slot.slot_id} disabled={blocked || current?.current_stage !== 'PRE_VISIT' || slot.status !== 'AVAILABLE'} onClick={() => onMessage('确认挂号 ' + doctor.name + ' ' + slot.appointment_time)}>{slot.appointment_time}<span>{slot.status === 'AVAILABLE' ? '可预约' : '已预约'}</span></button>)}</div>{!data.slots.some(slot => slot.doctor_id === doctor.doctor_id && slot.status === 'AVAILABLE') && <p>本次查询暂无可预约号源。</p>}</> : <button className="button secondary" disabled={blocked} onClick={() => onMessage(doctor.name + '今天还有号吗？')}>查询号源</button>}
    </ResultCard>)}
    {data.slots && !data.doctors?.length && <ResultCard title="号源查询"><p>本次可预约时间：{data.slots.filter(s => s.status === 'AVAILABLE').map(s => s.appointment_time).join('、') || '暂无'}。请在对话中确认医生与时间。</p></ResultCard>}
    {data.registration && <ResultCard title="预约成功" tone="success"><div className="receipt"><Icon name="check" /><strong>{data.registration.appointment_time}</strong><span>{data.registration.department_name} · {data.registration.doctor_name}</span></div><p>{data.registration.next_action}</p></ResultCard>}
    {data.route && <ResultCard title="院内路线"><div className="route-endpoints"><span>{data.route.start}</span><Icon name="arrow" size={16} /><strong>{data.route.destination}</strong></div><ol className="route-steps">{data.route.steps.map((step, i) => <li key={i}><span>{i + 1}</span>{step}</li>)}</ol><p className="fine-print">医院 Demo 路线 · 请以现场指引为准</p></ResultCard>}
    {data.payment && <ResultCard title="检查费用"><div className="payment-line"><strong>{data.payment.exam_type}</strong><b>{money(data.payment.price)}</b></div><Badge tone={data.payment.payment_status === 'PAID' ? 'positive' : 'amber'}>{STATUS_LABELS[data.payment.payment_status]}</Badge>{data.payment.payment_status === 'UNPAID' && current?.payment_status === 'UNPAID' && <button className="button primary" disabled={blocked} onClick={() => onMessage('立即缴费')}>确认缴费信息</button>}</ResultCard>}
    {data.paid && <ResultCard title="缴费成功" tone="success"><p><Icon name="check" size={16} /> {data.paid.visit_context.current_order} · 已缴费</p><p>{data.paid.visit_context.next_action}</p></ResultCard>}
    {data.queue && <ResultCard title="检查排队"><div className="queue-metrics"><div><span>你的号码</span><strong>{data.queue.queue_number}</strong></div><div><span>前方等候</span><strong>{data.queue.people_ahead}<small> 人</small></strong></div><div><span>预计等待</span><strong>{data.queue.estimated_wait_minutes}<small> 分钟</small></strong></div></div><p>当前叫号 {data.queue.current_number} · {data.queue.location}</p><p className="fine-print">本轮查询快照，实际叫号以现场为准。</p></ResultCard>}
    {data.report && !data.interpretation && <ReportCard report={data.report} onMessage={onMessage} blocked={blocked} />}
    {data.interpretation && <ResultCard title="AI 报告解读" tone="interpretation"><Badge>基于本次 {data.interpretation.structured_report.exam_name}</Badge><p className="interpretation-summary">{data.interpretation.interpretation.summary}</p><div className="finding-list">{data.interpretation.interpretation.key_findings.map((finding, i) => <div key={i}><strong>{finding.original}</strong><p>{finding.explanation}</p></div>)}</div><div className="uncertainty"><strong>需要结合临床判断</strong>{data.interpretation.interpretation.uncertainty.map((line, i) => <p key={i}>{line}</p>)}</div><div className="interpretation-next"><strong>接下来</strong>{data.interpretation.interpretation.next_steps.map((line, i) => <p key={i}>{line}</p>)}</div><button className="button secondary" disabled={blocked} onClick={() => onMessage('普外科怎么走？')}>查看回诊路线 <Icon name="arrow" size={16} /></button><details className="source-details"><summary>查看解读参考来源</summary>{data.interpretation.interpretation.sources.map(source => <p key={source.id}>{/^https?:\/\//.test(source.source_url) ? <a href={source.source_url} target="_blank" rel="noreferrer">{source.title} · {source.source}</a> : source.title}</p>)}</details></ResultCard>}
  </div>;
}

export function ReportCard({ report, onMessage, blocked }: { report: RawCtReport; onMessage: (message: string) => void; blocked: boolean }) {
  return <ResultCard title="检查报告"><div className="report-title"><Icon name="file" /><div><strong>{report.exam_name}</strong><p>{report.exam_date}</p></div><Badge tone="positive">已出报告</Badge></div><p className="field-label">影像学结论</p><p className="report-impression">{report.impression}</p><details className="source-details"><summary>查看报告原文</summary><p>检查方法：{report.technique}</p><p>临床病史：{report.clinical_history}</p><ul>{report.findings.map((finding, i) => <li key={i}>{finding}</li>)}</ul><p>{report.recommendation}</p><p className="fine-print">来源：{report.source}</p></details><button className="button secondary full" onClick={() => onMessage('帮我看看报告')} disabled={blocked}>帮我读懂这份报告 <Icon name="spark" size={16} /></button></ResultCard>;
}

export function VisitSummary({ context, order, report, busy, onMessage }: { context: VisitContext; order: ExamOrder | null; report: RawCtReport | null; busy: boolean; onMessage: (message: string) => void }) {
  return <section className="visit-summary" id="care-details"><div className="section-heading"><h2>就诊事项</h2><Icon name="file" size={17} /></div>
    {context.registration_status === 'COMPLETED' ? <div className="appointment-summary"><span className="field-label">已预约</span><div><strong>{context.appointment_time}</strong><span>{context.department_name}<br />{context.doctor_name}</span></div></div> : <p className="empty-copy">预约成功后，就诊安排会同步到这里。</p>}
    {order && <div className="exam-summary"><div className="section-heading"><h3>{order.exam_type}</h3><Badge tone={order.payment_status === 'PAID' ? 'positive' : 'amber'}>{STATUS_LABELS[order.payment_status]}</Badge></div><p>{order.location}</p><div className="payment-line"><span>{STATUS_LABELS[order.exam_status]}</span><strong>{money(order.price)}</strong></div>{context.current_stage === 'PAYMENT' && <button className="button primary full" disabled={busy} onClick={() => onMessage('立即缴费')}>确认缴费信息 <Icon name="arrow" size={16} /></button>}{['WAITING_EXAM', 'EXAMINING'].includes(context.current_stage) && <button className="button secondary full" disabled={busy} onClick={() => onMessage('前面还有多少人？')}>查看排队情况</button>}{order.report_status === 'PENDING' && <p className="pending-report"><Icon name="file" size={15} /> 报告尚未发布</p>}</div>}
    {report && <ReportCard report={report} onMessage={onMessage} blocked={busy} />}
  </section>;
}

export interface Confirmation { title: string; description: string; message?: string; stage?: string; details?: { label: string; value: string }[]; }
export function ConfirmationDialog({ value, busy, onClose, onConfirm }: { value: Confirmation | null; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (value) ref.current?.showModal(); else ref.current?.close(); }, [value]);
  return <dialog className="confirmation-dialog" ref={ref} aria-labelledby="confirmation-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    {value && <><div className="dialog-symbol"><Icon name="check" size={27} /></div><h2 id="confirmation-title">{value.title}</h2><p>{value.description}</p>{value.details && <dl className="confirmation-details">{value.details.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}{value.message && <blockquote>{value.message}</blockquote>}<p className="fine-print">演示环境 · 仅更新 Mock 业务状态，不产生真实预约或扣款。</p><div className="dialog-actions"><button className="button secondary" autoFocus disabled={busy} onClick={onClose}>暂不确认</button><button className="button primary" disabled={busy} onClick={onConfirm}>{busy ? '正在提交…' : '确认并继续'}</button></div></>}
  </dialog>;
}

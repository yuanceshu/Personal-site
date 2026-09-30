'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AssistantMark, ConfirmationDialog, Icon, Journey, ResultCards, SafetyBanner, VisitSummary, type Confirmation } from './care-ui';
import { DemoCollectionLink } from '@/components/works/demos/navigation/demo-collection-link';
import { DEMO_EVENTS, needsActionReview, startsNewEpisode, STAGE_LABELS } from '@/lib/works/medical-ai/src/ui/presentation';
import type { ChatResponse } from '@/lib/works/medical-ai/src/schemas/chat';
import { createInitialVisitContext, type VisitContext, type VisitStage } from '@/lib/works/medical-ai/src/domain/visit-context';
import type { RawCtReport } from '@/lib/works/medical-ai/src/report/types';
import type { ExamOrder } from '@/lib/works/medical-ai/src/tools/mock-tools';
import type { SafetyResult } from '@/lib/works/medical-ai/src/safety/types';
import type { MedicalClientState } from '@/lib/works/medical-ai/state';

type Patient = { patient_id: string; name: string; gender: string; age: number; is_demo_data?: true };
type MedicalApiResponse = ChatResponse & { state: MedicalClientState; agent_mode?: string };
const DEMO_PATIENT: Patient = { patient_id: 'demo001', name: '李女士', gender: '女', age: 36, is_demo_data: true };
const STATE_KEY = 'medical-ai-demo:state';
const SESSION_KEY = 'medical-ai-demo:session-id';

async function readJson<T>(path: string, body: unknown) {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? '请求失败');
  return payload;
}

export function MedicalDemo() {
  const [patient] = useState<Patient>(DEMO_PATIENT);
  const [state, setState] = useState<MedicalClientState | null>(null);
  const [context, setContext] = useState<VisitContext | null>(createInitialVisitContext());
  const [order, setOrder] = useState<ExamOrder | null>(null);
  const [report, setReport] = useState<RawCtReport | null>(null);
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: '你好，我是明川市中心医院 AI 就医助手。告诉我现在的情况，我会结合你的就医进度，陪你走完下一步。' },
  ]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [activeSafety, setActiveSafety] = useState<SafetyResult | null>(null);
  const [activeNav, setActiveNav] = useState('assistant');

  useEffect(() => {
    const id = window.localStorage.getItem(SESSION_KEY) ?? window.crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
    queueMicrotask(() => {
      setSessionId(id);
      try {
        const stored = JSON.parse(window.localStorage.getItem(STATE_KEY) ?? 'null') as MedicalClientState | null;
        if (stored) {
          setState(stored); setContext(stored.mock?.visitContext ?? null); setOrder(stored.mock?.examOrder ?? null);
        }
      } catch { window.localStorage.removeItem(STATE_KEY); }
      setInitializing(false);
    });
  }, []);

  const applyState = useCallback((next: MedicalClientState) => {
    setState(next); setContext(next.mock?.visitContext ?? null); setOrder(next.mock?.examOrder ?? null);
    window.localStorage.setItem(STATE_KEY, JSON.stringify(next));
  }, []);

  const executeMessage = useCallback(async (message: string) => {
    if (!message.trim() || loading) return;
    setLoading(true); setError('');
    setMessages(previous => [...previous, { role: 'user', text: message }]);
    try {
      const response = await readJson<MedicalApiResponse>('/api/experiments/medical-ai/chat', { message, patient_id: 'demo001', session_id: sessionId || 'demo001', state, history: messages.slice(-16).map(item => ({ role: item.role, content: item.text })) });
      setMessages(previous => [...previous, { role: 'assistant', text: response.message }]);
      setLastResponse(response); applyState(response.state);
      const reportCall = response.tool_calls.find(call => call.name === 'get_report' && call.result && typeof call.result === 'object' && 'report_id' in call.result);
      setReport(reportCall?.result as RawCtReport | undefined ?? null);
      if (response.debug.safety_check?.action === 'ESCALATE') setActiveSafety(response.debug.safety_check);
      else if (startsNewEpisode(message)) setActiveSafety(null);
    } catch (reason) {
      const messageText = reason instanceof Error ? reason.message : '未知错误';
      setError(messageText); setMessages(previous => [...previous, { role: 'assistant', text: '这次没有完成查询：' + messageText }]);
    } finally { setLoading(false); }
  }, [applyState, loading, messages, sessionId, state]);

  const messageDetails = (message: string): Confirmation => {
    const payment = /(缴费|支付|付款)/.test(message);
    return payment
      ? { title: '确认缴费', description: '这将调用现有 Demo 支付 Tool，更新腹部 CT 的缴费状态。', message, details: [{ label: '动作', value: '腹部 CT 检查缴费' }, { label: '结果', value: '状态更新为已缴费' }] }
      : { title: '确认挂号', description: '这将调用现有 Demo 挂号 Tool，锁定你选择的医生和号源。', message, details: [{ label: '动作', value: message }, { label: '结果', value: '生成本次就诊预约' }] };
  };
  const requestMessage = (message: string) => {
    if (needsActionReview(message)) {
      setPendingAction(() => () => executeMessage(message)); setConfirmation(messageDetails(message));
    } else void executeMessage(message);
  };
  const confirmPending = () => { const action = pendingAction; setPendingAction(null); setConfirmation(null); if (action) void action(); };

  const requestStage = (stage: VisitStage) => {
    if (!context) return;
    const event = DEMO_EVENTS[context.current_stage];
    if (!event || event.stage !== stage) return;
    setPendingAction(() => async () => {
      setLoading(true); setError('');
      try {
        const response = await readJson<{ state: MedicalClientState }>('/api/experiments/medical-ai/action', { action: 'update_visit_stage', stage, patient_id: 'demo001', session_id: sessionId || 'demo001', state });
        applyState(response.state);
      }
      catch (reason) { setError(reason instanceof Error ? reason.message : '状态更新失败'); }
      finally { setLoading(false); }
    });
    setConfirmation({ title: event.label, description: event.description, details: [{ label: '当前阶段', value: STAGE_LABELS[context.current_stage] }, { label: '更新后', value: STAGE_LABELS[stage] }] });
  };

  const submit = (event: FormEvent) => { event.preventDefault(); const text = input.trim(); if (!text) return; setInput(''); requestMessage(text); };
  const safety = lastResponse?.debug.safety_check as SafetyResult | null | undefined;
  const currentStage = context?.current_stage as VisitStage | undefined;
  const nextEvent = currentStage ? DEMO_EVENTS[currentStage] : undefined;
  const isFinished = context?.current_stage === 'FINISHED';
  const canShowCards = Boolean(lastResponse);

  const nav = useMemo(() => [
    { id: 'assistant', label: 'AI 就医助手', icon: 'spark' as const, href: '#assistant' },
    { id: 'journey', label: '我的就医旅程', icon: 'path' as const, href: '#journey' },
    { id: 'care', label: '就诊事项', icon: 'file' as const, href: '#care' },
  ], []);

  return <div className="medical-ai-demo"><div className="product-shell">
    <header className="mobile-header"><a className="brand" href="#assistant"><span className="brand-mark">明</span><span><strong>明川市中心医院</strong><small>AI 就医助手</small></span></a><DemoCollectionLink className="collection-back collection-back--mobile" /></header>
    <aside className="app-sidebar"><a className="brand" href="#assistant"><span className="brand-mark">明</span><span><strong>明川市中心医院</strong><small>AI 就医助手</small></span></a><div className="side-divider" />{patient && <div className="patient-chip"><span className="patient-avatar">{patient.name.slice(0, 1)}</span><span><small>当前患者</small><strong>{patient.name}</strong><em>{patient.gender} · {patient.age} 岁</em></span></div>}<nav className="side-nav">{nav.map(item => <a key={item.id} className={activeNav === item.id ? 'active' : ''} href={item.href} onClick={() => setActiveNav(item.id)}><Icon name={item.icon} size={17} />{item.label}</a>)}</nav><div className="sidebar-footer"><span className="secure-dot" />演示环境 · Mock 业务数据</div></aside>

    <main className="main-content">
      <div className="topline"><div><small>患者旅程 / PATIENT JOURNEY</small><h1>{patient ? '你好，' + patient.name : '你好'}</h1></div><div className="topline-actions"><DemoCollectionLink className="collection-back collection-back--desktop-content" /></div></div>
      {error && <div className="inline-error" role="status"><Icon name="alert" size={16} />{error}<button onClick={() => setError('')} aria-label="关闭提示"><Icon name="close" size={15} /></button></div>}
      <SafetyBanner safety={activeSafety ?? safety ?? null} critical={lastResponse?.debug.critical_flag ?? false} />

      <section className="hero" id="assistant"><div className="hero-copy"><div className="hero-kicker"><AssistantMark />持续理解你的就医状态</div><h2>把复杂的就医流程，<br /><em>交给一个懂你的助手。</em></h2><p>描述症状、询问路线或报告。我会陪你从诊前咨询，一直走到回诊完成。</p><div className="hero-prompts"><button onClick={() => requestMessage('我肚子疼，应该挂什么科？')} disabled={loading}>我肚子疼，应该挂什么科？</button><button onClick={() => requestMessage('张明远今天还有号吗？')} disabled={loading}>张明远今天还有号吗？</button></div></div><div className="hero-status"><small>当前就医阶段</small><div className="stage-number">{initializing ? '··' : context?.current_stage === 'FINISHED' ? '✓' : (context?.current_stage ? String(['PRE_VISIT', 'REGISTERED', 'ARRIVED', 'WAITING_DOCTOR', 'CONSULTING', 'PAYMENT', 'WAITING_EXAM', 'EXAMINING', 'WAITING_REPORT', 'RETURN_VISIT', 'FINISHED'].indexOf(context.current_stage) + 1).padStart(2, '0') : '01')}</div><strong>{context ? STAGE_LABELS[context.current_stage] : '正在读取状态'}</strong><p>{context?.next_action ?? '稍等，我正在读取本次就诊进度。'}</p><button className="link-button" onClick={() => requestMessage('然后呢？')} disabled={loading}>询问下一步 <Icon name="arrow" size={16} /></button></div></section>

      {context && <Journey context={context} />}

      <section className="workspace-grid"><section className="conversation-panel"><div className="panel-heading"><div className="assistant-heading"><AssistantMark /><div><h2>和 AI 就医助手对话</h2><p>你可以直接说出现在的情况</p></div></div><span className="online"><i />在线</span></div><div className="conversation-scroll" aria-live="polite">{messages.map((item, index) => <div className={'bubble-row ' + item.role} key={item.role + index}><span className="bubble-avatar">{item.role === 'assistant' ? '明' : (patient?.name.slice(0, 1) ?? '我')}</span><div className="bubble"><small>{item.role === 'assistant' ? 'AI 就医助手' : '你'}</small>{item.text.split('\n').map((line, i) => <p key={i}>{line || ' '}</p>)}</div></div>)}{loading && <div className="bubble-row assistant"><span className="bubble-avatar">明</span><div className="bubble typing"><i /><i /><i /></div></div>}</div><div className="suggestion-row">{(context?.report_status === 'READY' ? ['帮我看看报告', '普外科怎么走？'] : ['我现在应该去哪？', '当前就诊进度']).map(prompt => <button key={prompt} onClick={() => requestMessage(prompt)} disabled={loading}>{prompt}</button>)}</div><form className="composer" onSubmit={submit}><input value={input} onChange={event => setInput(event.target.value)} disabled={loading} placeholder="告诉我你的情况，或问问下一步…" aria-label="输入消息" /><button disabled={loading || !input.trim()} aria-label="发送"><Icon name="send" size={17} /></button></form><p className="disclaimer">AI 提供就医流程与健康信息辅助，不能替代医生诊断。紧急情况请联系现场医护人员。</p></section>

        <aside className="side-column"><section className="care-card"><div className="panel-heading"><div><small className="section-label">CURRENT VISIT</small><h2>本次就诊</h2></div><Icon name="path" size={18} /></div>{context ? <><div className="current-action"><small>下一步</small><strong>{context.next_action}</strong></div><div className="care-meta"><span>阶段</span><b>{STAGE_LABELS[context.current_stage]}</b></div>{context.registration_status === 'COMPLETED' && <div className="care-meta"><span>就诊安排</span><b>{context.appointment_time} · {context.doctor_name}</b></div>}</> : <p className="empty-copy">正在同步本次就诊状态…</p>}</section><VisitSummary context={context ?? { patient_id: 'demo001', visit_id: 'visit001', current_stage: 'PRE_VISIT', department_id: null, department_name: null, doctor_id: null, doctor_name: null, appointment_time: null, registration_status: 'NOT_REGISTERED', current_order: null, payment_status: null, exam_status: null, report_status: null, next_action: '正在读取状态' }} order={order} report={report} busy={loading} onMessage={requestMessage} /></aside>
      </section>

      {canShowCards && lastResponse && <section className="results-section" aria-live="polite"><div className="results-heading"><div><small>STRUCTURED RESULT</small><h2>这次对话的结果</h2></div><span>来自已连接的 Mock Tool</span></div><ResultCards response={lastResponse} current={context} blocked={loading} onMessage={requestMessage} /></section>}

      {nextEvent && !isFinished && <section className="demo-step"><div><small>演示推进</small><h2>{nextEvent.label}</h2><p>{nextEvent.description}</p></div><button className="button secondary" onClick={() => requestStage(nextEvent.stage)} disabled={loading}>确认推进 <Icon name="arrow" size={16} /></button></section>}
      <details className="developer-details"><summary>开发调试信息</summary>{lastResponse ? <pre>{JSON.stringify({ intent: lastResponse.debug.intent, route: lastResponse.debug.route, tool_calls: lastResponse.tool_calls, debug: lastResponse.debug }, null, 2)}</pre> : <p>发送消息后可查看本轮 Tool 证据。</p>}</details>
      <footer className="product-footer"><span>明川市中心医院 AI 就医助手</span><span>Demo 产品体验 · 所有业务数据来自 Mock 服务</span></footer>
    </main>
    <ConfirmationDialog value={confirmation} busy={loading} onClose={() => { if (!loading) { setConfirmation(null); setPendingAction(null); } }} onConfirm={confirmPending} />
  </div></div>;
}

export default MedicalDemo;

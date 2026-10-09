"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { DemoCollectionLink } from "@/components/works/demos/navigation/demo-collection-link";
import { amount, ClientError, confirmedSchema, consumeChat, errorLabel, invoiceDetailSchema, sessionSchema, snapshotSchema, type ProposalView, type Records, type Session } from "@/lib/works/heating/client-contract";
import type { PaymentSimulation } from "@/lib/works/heating/agent/conversation";
import { materialSchema, type MaterialType, type UserId } from "@/lib/works/heating/schema";
import { confirmedFocus, replyFocus, type ChatEntry } from "@/lib/works/heating/chat-view";
import { agreementSchema, type Agreement, type Signature } from "@/lib/works/heating/agreement";
import { AgreementCard, AgreementDialog } from "./agreement-ui";
import { AssistantAvatar, BusinessCards, HeatMark, Modal, ProposalCard } from "./business-ui";

const API = "/api/experiments/heating/";
const quick = [
  { label: "供暖缴费", prompt: "我想交暖气费" },
  { label: "申请断暖", prompt: "今年没人住，想断暖" },
  { label: "绑定房屋", prompt: "我想绑定房屋" },
  { label: "房屋与费用", prompt: "查房屋面积和供暖费" },
  { label: "申请进度", prompt: "查申请进度" },
  { label: "供暖政策", prompt: "问供暖政策" },
];

const apiHeaders = (session?: Session | null) => ({ "X-Heating-Demo": "1", ...(session ? { "X-Heating-Identity-Version": String(session.actor.identityVersion), "X-Heating-Generation": session.actor.generation } : {}) });
async function jsonRequest<T>(path: string, schema: z.ZodType<T>, session?: Session | null, body?: unknown) {
  const response = await fetch(API + path, { method: "POST", credentials: "omit", cache: "no-store", headers: { ...apiHeaders(session), "Content-Type": "application/json" }, body: JSON.stringify({ ...(body as object ?? {}), ...(session ? { demoState: session.demoState } : {}) }), signal: AbortSignal.timeout(15000) });
  const value = await response.json();
  if (!response.ok) throw new ClientError(value.error ?? "heating_unavailable");
  const demoState = z.string().min(1).max(256000).parse(value.demoState);
  const result = schema.parse(value.result?.actor ? { ...value.result, demoState } : value.result);
  if (session) session.demoState = demoState;
  return result;
}
function checkIdentity(value: { identityVersion: number; generation: string }, session: Session) {
  if (value.identityVersion !== session.actor.identityVersion || value.generation !== session.actor.generation) throw new ClientError("identity_changed");
}

export function HeatingDemo() {
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<Records | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [proposal, setProposal] = useState<ProposalView | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(true);
  const [serverBusy, setServerBusy] = useState(false);
  const [status, setStatus] = useState("正在初始化本页演示…");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryableReply, setRetryableReply] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [signingError, setSigningError] = useState("");
  const [signing, setSigning] = useState<{ agreement: Agreement; proposalId: string; mode: "read" | "sign" } | null>(null);
  const [invoice, setInvoice] = useState<z.infer<typeof invoiceDetailSchema> | null>(null);
  const [lastMessage, setLastMessage] = useState("");
  const lastPaymentSimulation = useRef<PaymentSimulation | undefined>(undefined);
  const sessionRef = useRef<Session | null>(null), lock = useRef(false), alive = useRef(true), abortRef = useRef<AbortController | null>(null);
  const lifecycle = useRef(0);
  const isCurrent = (current: Session) => alive.current && sessionRef.current === current;
  const timeline = useRef<HTMLDivElement>(null), follow = useRef(true);
  const bottom = useRef<HTMLDivElement>(null), textarea = useRef<HTMLTextAreaElement>(null);
  const disabled = busy || serverBusy || !session;
  const pendingOrders = records?.orders.filter(order => order.status === "pending") ?? [];
  const selectedOrder = pendingOrders.find(order => proposal?.operation.name === "simulate_payment" && proposal.operation.input.orderId === order.id) ?? (pendingOrders.length === 1 ? pendingOrders[0] : undefined);
  const selectedBill = records?.bills.find(bill => bill.id === selectedOrder?.billId);
  const selectedHouse = records?.houses.find(house => house.id === selectedBill?.houseId);

  function handleError(problem: unknown) {
    if (!alive.current) return;
    setError(errorLabel(problem));
    if (problem instanceof ClientError && ["identity_changed", "session_expired", "invalid_session"].includes(problem.code)) {
      sessionRef.current = null; setSession(null); setRecords(null); setMessages([]); setProposal(null); setInvoice(null); setSigning(null);
    }
  }
  async function snapshot(current: Session) {
    const epoch = lifecycle.current;
    const view = await jsonRequest("snapshot", snapshotSchema, current);
    checkIdentity(view, current);
    if (epoch !== lifecycle.current || !isCurrent(current)) return;
    setRecords(view.records); setProposal(view.conversation.proposal); setServerBusy(view.conversation.busy);
    // Business snapshots update evidence, never replace this page's visual transcript.
    return view;
  }
  async function initialize() {
    if (lock.current) return;
    const epoch = lifecycle.current;
    lock.current = true; setBusy(true); setError(""); setStatus("正在初始化本页演示…");
    try {
      const current = await jsonRequest("session", sessionSchema, null, {});
      if (!alive.current || epoch !== lifecycle.current) return;
      sessionRef.current = current; setSession(current);
      await snapshot(current);
      if (epoch !== lifecycle.current || !isCurrent(current)) return;

    } catch (problem) { if (epoch === lifecycle.current) handleError(problem); }
    finally { if (epoch === lifecycle.current) { lock.current = false; if (alive.current) setBusy(false); } }
  }
  useEffect(() => {
    alive.current = true;
    const hide = () => { lifecycle.current++; alive.current = false; abortRef.current?.abort(); };
    const show = (event: PageTransitionEvent) => {
      alive.current = true;
      if (!event.persisted) return;
      lifecycle.current++;
      lock.current = false; sessionRef.current = null;
      setSession(null); setRecords(null); setMessages([]); setProposal(null); setInvoice(null); setSigning(null); setInput(""); setServerBusy(false); setLastMessage(""); lastPaymentSimulation.current = undefined; setSettingsOpen(false); setRestartOpen(false); setNewMessages(false); setError(""); setNotice("");
      void initialize();
    };
    window.addEventListener("pagehide", hide); window.addEventListener("pageshow", show);
    queueMicrotask(() => { if (alive.current) void initialize(); });
    // This ref is a lifecycle counter; cleanup intentionally invalidates the latest epoch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { lifecycle.current++; alive.current = false; lock.current = false; abortRef.current?.abort(); window.removeEventListener("pagehide", hide); window.removeEventListener("pageshow", show); };
    // Each mount asks the server for fresh seed data; no cookies or browser storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (follow.current) bottom.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
    else if (messages.length) queueMicrotask(() => setNewMessages(true));
  }, [messages.length, proposal, busy]);
  useEffect(() => {
    const viewport = window.visualViewport;
    let frame = 0;
    const resize = () => {
      document.querySelector<HTMLElement>(".heat-app")?.style.setProperty("--heat-viewport", `${viewport?.height ?? window.innerHeight}px`);
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (follow.current && timeline.current?.querySelector(".heat-message")) bottom.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
      });
    };
    resize(); viewport?.addEventListener("resize", resize);
    return () => { window.cancelAnimationFrame(frame); viewport?.removeEventListener("resize", resize); };
  }, []);
  useEffect(() => {
    if (!proposal) return;
    const timer = window.setTimeout(() => {
      setProposal(current => current?.id === proposal.id ? null : current);
      setSigning(current => current?.proposalId === proposal.id ? null : current);
    }, Math.max(0, proposal.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [proposal]);
  const reviewing = records?.applications.some(a => Boolean(a.nextReviewAt));
  useEffect(() => {
    if (!reviewing && !serverBusy) return;
    const interval = window.setInterval(() => {
      const current = sessionRef.current;
      if (!current || lock.current || document.visibilityState !== "visible") return;
      const epoch = lifecycle.current;
      lock.current = true;
      void snapshot(current).catch(problem => { if (epoch === lifecycle.current) handleError(problem); }).finally(() => { if (epoch === lifecycle.current) lock.current = false; });
    }, 12000);
    return () => window.clearInterval(interval);
    // Poll callbacks read current refs; only review/busy changes should restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewing, serverBusy]);

  async function run(action: (current: Session) => Promise<void>, label: string, allowServerBusy = false) {
    const current = sessionRef.current;
    if (!current || lock.current || (serverBusy && !allowServerBusy)) return;
    const epoch = lifecycle.current;
    lock.current = true; setBusy(true); setError(""); setNotice(""); setRetryableReply(false); setStatus(label);
    try { await action(current); }
    catch (problem) {
      if (epoch !== lifecycle.current) return;
      handleError(problem);
      if (signing) setSigningError(errorLabel(problem));
      if (sessionRef.current === current) await snapshot(current).catch(problem => { if (epoch === lifecycle.current) handleError(problem); });
    } finally { if (epoch === lifecycle.current) { lock.current = false; if (alive.current) setBusy(false); } }
  }
  async function send(text: string, showUser = true, paymentSimulation?: PaymentSimulation) {
    if (!text.trim() || text.length > 2000) return;
    await run(async current => {
      setSigning(null); setLastMessage(text); lastPaymentSimulation.current = paymentSimulation; if (showUser) setInput(""); setProposal(null);
      follow.current = true;
      if (showUser) setMessages(previous => [...previous, { id: crypto.randomUUID(), role: "user", content: text }].slice(-60) as ChatEntry[]);
      const abort = new AbortController(); abortRef.current = abort;
      const response = await fetch(API + "chat", { method: "POST", credentials: "omit", cache: "no-store", headers: { ...apiHeaders(current), "Content-Type": "application/json" }, body: JSON.stringify({ message: text, requestId: crypto.randomUUID(), demoState: current.demoState, ...(paymentSimulation ? { paymentSimulation } : {}) }), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(95000)]) });
      const result = await consumeChat(response, label => { if (isCurrent(current)) setStatus(label); });
      checkIdentity(result, current);
      if (!alive.current || sessionRef.current !== current) return;
      current.demoState = result.demoState;
      const view = await snapshot(current);
      if (!view || !isCurrent(current)) return;
      setMessages(previous => [...previous, { id: crypto.randomUUID(), role: "assistant", content: result.answer, records: view.records, focus: replyFocus(result, view.records), mode: result.replyMode, proposal: result.proposal }].slice(-60) as ChatEntry[]); setProposal(result.proposal);
      if (result.degraded) setNotice("AI 本轮响应未完整完成，已保留工具核实的结果。可继续说明需求或重试。");
      setRetryableReply(result.degraded);
    }, "正在理解您的需求…");
  }
  async function confirm() {
    if (!proposal || disabled) return;
    const pending = proposal, before = records ?? undefined;
    let continuePayment: PaymentSimulation | undefined;
    await run(async current => {
      const result = await jsonRequest("confirm", confirmedSchema, current, { proposalId: pending.id, confirmed: true });
      checkIdentity(result, current);
      if (!isCurrent(current)) return;
      const view = await snapshot(current); if (!view || !isCurrent(current)) return;
      setProposal(null);
      setMessages(previous => [...previous.map(message => message.proposal?.id === pending.id ? { ...message, outcome: "confirmed" } : message), { id: crypto.randomUUID(), role: "assistant", content: pending.operation.name === "simulate_payment" ? "支付结果已返回，请查看下方状态。" : pending.operation.name === "create_draft" ? "申请已开始。下面两类材料都需要登记，点击“模拟提交”即可使用预设演示材料。" : "您确认的操作已完成，请查看办理结果。", records: view.records, focus: confirmedFocus(before, view.records, pending), mode: "results" }].slice(-60) as ChatEntry[]);
      if (pending.operation.name === "create_payment") {
        const order = view.records.orders.find(order => order.billId === pending.operation.input.billId && order.status === "pending");
        if (order) continuePayment = { orderId: order.id, outcome: "success" };
      }
    }, "正在办理您确认的操作…");
    // The explicit go-to-payment click authorizes preparing the next proposal, never executing payment.
    if (continuePayment && sessionRef.current) await send(`账单已确认，请准备订单 ${continuePayment.orderId} 的模拟支付成功办理，先让我确认。`, false, continuePayment);
  }
  async function signAgreement(signature: Signature, idempotencyKey: string) {
    if (!signing || proposal?.id !== signing.proposalId || disabled) return;
    const selected = signing; setSigningError("");
    await run(async current => {
      const result = await jsonRequest("sign-agreement", z.object({ agreement: agreementSchema, identityVersion: z.number().int(), generation: z.string().uuid(), demo: z.literal(true) }), current, { proposalId: selected.proposalId, version: selected.agreement.version, signature, idempotencyKey });
      checkIdentity(result, current);
      if (!isCurrent(current)) return;
      const view = await snapshot(current); if (!view || !isCurrent(current)) return;
      setSigning(null);
      setMessages(previous => [...previous, { id: crypto.randomUUID(), role: "assistant", content: `已完成《${result.agreement.title}》的演示签署，尚未付款。请核对账单，确认后继续模拟缴费。`, records: view.records, focus: { houseIds: [], billIds: [result.agreement.billId], applicationIds: [], invoiceIds: [] }, mode: "results", proposal: view.conversation.proposal }].slice(-60) as ChatEntry[]);
    }, "正在登记演示签署…");
  }
  async function simulateMaterial(applicationId: string, type: MaterialType) {
    await run(async current => {
      const result = await jsonRequest("simulate-material", materialSchema, current, { applicationId, type, idempotencyKey: crypto.randomUUID() });
      if (!isCurrent(current)) return;
      const view = await snapshot(current); if (!view || !isCurrent(current)) return;
      setMessages(previous => [...previous, { id: crypto.randomUUID(), role: "assistant", content: `已登记预设演示材料：${result.fileName}。没有选择、上传或保存真实文件。`, records: view.records, focus: { houseIds: [], billIds: [], applicationIds: [applicationId], invoiceIds: [] }, mode: "materials" }].slice(-60) as ChatEntry[]);
    }, "正在登记预设演示材料…");
  }
  async function switchUser(userId: UserId) {
    await run(async current => {
      const next = await jsonRequest("session", sessionSchema, current, { userId });
      if (!isCurrent(current)) return;
      sessionRef.current = next; setSession(next); setRecords(null); setMessages([]); setProposal(null); setInvoice(null); setSigning(null); setLastMessage(""); lastPaymentSimulation.current = undefined; setInput("");
      await snapshot(next); if (!isCurrent(next)) return;
      setSettingsOpen(false); setNotice(`已切换至${next.profile.name}。您可以直接说想办理什么。`);
    }, "正在切换演示住户…");
  }
  async function restart() {
    if (lock.current) return;
    const epoch = lifecycle.current;
    lock.current = true; setBusy(true); setRestartOpen(false); setError(""); setStatus("正在恢复初始演示场景…");
    try {
      const next = await jsonRequest("restart", sessionSchema, null, { confirmed: true });
      if (!alive.current || epoch !== lifecycle.current) return;
      sessionRef.current = next; setSession(next); setRecords(null); setMessages([]); setProposal(null); setInvoice(null); setSigning(null); setLastMessage(""); lastPaymentSimulation.current = undefined; setInput(""); setServerBusy(false); setLastMessage(""); lastPaymentSimulation.current = undefined; setSettingsOpen(false); setRestartOpen(false); setNewMessages(false); setError(""); setNotice("");
      await snapshot(next); if (!isCurrent(next)) return; setNotice("已恢复初始演示数据。您可以重新开始办理。");
    } catch (problem) { if (epoch === lifecycle.current) handleError(problem); }
    finally { if (epoch === lifecycle.current) { lock.current = false; if (alive.current) setBusy(false); } }
  }
  async function refresh() { if (!sessionRef.current) return initialize(); await run(async current => { await snapshot(current); }, "正在重新连接…", true); }
  async function viewInvoice(id: string) {
    await run(async current => { const result = await jsonRequest("action", invoiceDetailSchema, current, { name: "query_invoice", input: { invoiceId: id } }); if (isCurrent(current)) setInvoice(result); }, "正在读取模拟发票…");
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(input.trim()); }
  const latest = messages.at(-1)?.id;
  const jumpToNew = () => { follow.current = true; setNewMessages(false); bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
  return <main className="heat-app">
    <div className="heat-shell">
      <header className="heat-header"><div className="heat-brand"><HeatMark/><span><strong>和煦供暖</strong><span>服务助手</span></span></div><button className="heat-settings-trigger" onClick={() => setSettingsOpen(true)} aria-label="演示设置">演示设置 <span aria-hidden="true">⋯</span></button></header>
      <section className="heat-workspace" id="heat-chat" aria-label="供暖服务对话">
        <div className="heat-timeline" ref={timeline} onScroll={() => { const node = timeline.current; if (node) { follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 90; if (follow.current) setNewMessages(false); } }}>
          {!messages.length && <section className="heat-welcome">
            <div className="heat-welcome-intro"><AssistantAvatar welcome/><span className="heat-welcome-label">您好，我是和煦助手</span></div>
            <h1>供暖的事，<br/>说一声就好。</h1>
            <p>缴费、申请、查进度，为您一步步办理。</p>
            <div className="heat-shortcuts-label">常用服务</div>
            <div className="heat-shortcuts">{quick.map(({ label, prompt }) => <button key={prompt} disabled={disabled} onClick={() => void send(prompt)}>{label}<span aria-hidden="true">→</span></button>)}</div>
          </section>}
          {messages.map(message => {
            const active = message.id === latest;
            const evidence = active ? records ?? message.records : message.records;
            const agreement = message.proposal?.operation.name === "create_payment" ? evidence?.agreements.find(a => a.billId === message.proposal?.operation.input.billId) : undefined;
            const activeProposal = active && proposal?.id === message.proposal?.id && !message.outcome;
            return <article className={`heat-message ${message.role}`} key={message.id}>
              {message.role === "assistant" && <AssistantAvatar/>}
              <div className="heat-message-body"><span className="heat-message-name">{message.role === "assistant" ? "和煦助手" : "您"}</span><p className="heat-bubble">{message.content}</p>
                {evidence && message.focus && (active ? <BusinessCards records={evidence} focus={message.focus} mode={message.mode} busy={disabled} send={text => void send(text)} submitMaterial={(id, type) => void simulateMaterial(id, type)} invoice={id => void viewInvoice(id)} hideBillActions={Boolean(proposal)}/> : (message.mode === "choose_house" || message.mode === "binding_details" || Object.values(message.focus).some(ids => ids.length)) && <details className="heat-past-evidence"><summary>查看当时的业务信息</summary><BusinessCards records={evidence} focus={message.focus} mode={message.mode} busy send={text => void send(text)} submitMaterial={(id, type) => void simulateMaterial(id, type)} invoice={id => void viewInvoice(id)}/></details>)}
                {agreement && activeProposal && <AgreementCard agreement={agreement} active={Boolean(activeProposal)} busy={disabled} open={mode => { setSigningError(""); if (message.proposal) setSigning({ agreement, proposalId: message.proposal.id, mode }); }}/>}
                {message.proposal && (activeProposal ? agreement && !agreement.signedAt ? <p className="heat-notice">缴费前请先完成上方协议的演示签署。</p> : <ProposalCard proposal={message.proposal} records={evidence ?? null} busy={disabled} confirm={() => void confirm()} cancel={() => void send("这一步暂不办理，请取消当前待确认操作。")}/> : <details className="heat-past-evidence"><summary>{message.outcome === "confirmed" ? "已确认的办理步骤" : "已失效的确认"}</summary>{agreement && <AgreementCard agreement={agreement} active={false} busy={false} open={() => {}}/>}<ProposalCard proposal={message.proposal} records={evidence ?? null} busy={disabled} active={false} completed={message.outcome === "confirmed"} confirm={() => {}} cancel={() => {}}/></details>)}
              </div>
            </article>;
          })}
          {serverBusy && !busy && <p className="heat-notice" role="status">正在等待上一轮办理结果，请稍候。</p>}
          {busy && <div className="heat-wait" role="status"><span className="heat-spinner"/>{status}</div>}
          {error && <div className="heat-error" role="alert"><strong>这一步还未完成</strong><p>{error}</p><div className="heat-actions"><button className="heat-button quiet" disabled={busy} onClick={() => void refresh()}>重新连接</button>{lastMessage && session && <button className="heat-button quiet" disabled={disabled} onClick={() => void send(lastMessage, true, lastPaymentSimulation.current)}>重试刚才的需求</button>}{!session && <button className="heat-button quiet" disabled={busy} onClick={() => setRestartOpen(true)}>重新开始演示</button>}</div></div>}
          {notice && <div className="heat-notice" role="status"><p>{notice}</p>{retryableReply && lastMessage && <button className="heat-button quiet" disabled={disabled} onClick={() => void send(lastMessage, true, lastPaymentSimulation.current)}>重试刚才的需求</button>}</div>}
          <div ref={bottom}/>
        </div>
        {newMessages && <button className="heat-new-message" onClick={jumpToNew}>查看新消息 ↓</button>}
        <form className="heat-composer" onSubmit={submit}><label htmlFor="heat-input" className="heat-sr-only">说说您想办理什么</label><div><textarea ref={textarea} id="heat-input" placeholder="说说您想办理什么" value={input} maxLength={2000} rows={1} disabled={!session} onChange={event => { setInput(event.target.value); event.currentTarget.style.height = "49px"; event.currentTarget.style.height = `${Math.min(110, event.currentTarget.scrollHeight)}px`; }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!disabled) void send(input.trim()); } }}/><button className="heat-send" disabled={disabled || !input.trim()} type="submit">发送 <span aria-hidden="true">↑</span></button></div><p>售前演示 · 不会真实扣款 · 刷新即重置</p></form>
      </section>
    </div>
    {settingsOpen && <Modal drawer title="演示设置" close={() => setSettingsOpen(false)}><p className="heat-muted">模拟住户、房屋和材料，不填写真实个人资料。</p><label htmlFor="heat-user">切换演示住户</label><select id="heat-user" value={session?.actor.userId ?? ""} disabled={disabled} onChange={event => void switchUser(event.target.value as UserId)}><option value="" disabled>正在初始化</option>{(session?.identities ?? []).map(user => <option key={user.id} value={user.id}>{user.name} · {user.scenario}</option>)}</select><button className="heat-button quiet full" disabled={busy} onClick={() => { setSettingsOpen(false); setRestartOpen(true); }}>恢复初始演示数据</button><details><summary>模拟异常</summary><p className="heat-muted">{selectedOrder ? `本次将演示${selectedHouse?.address ?? "所选账单"}的支付结果（¥${amount(selectedOrder.amountCents)}），仍需在对话中确认。` : pendingOrders.length ? "存在多笔待支付订单，请先在对话中选择要付款的账单。" : "当前没有待支付订单。请先发起缴费并点击“确认账单，去付款”，再回来演示失败或取消。"}</p><button className="heat-button quiet full" disabled={disabled || !selectedOrder} onClick={() => { if (!selectedOrder) return; setSettingsOpen(false); void send(`请将待支付订单 ${selectedOrder.id} 模拟支付失败，请先让我确认。`, true, { orderId: selectedOrder.id, outcome: "failure" }); }}>演示支付失败</button><button className="heat-button quiet full" disabled={disabled || !selectedOrder} onClick={() => { if (!selectedOrder) return; setSettingsOpen(false); void send(`我要取消待支付订单 ${selectedOrder.id} 的模拟支付，请先让我确认。`, true, { orderId: selectedOrder.id, outcome: "cancel" }); }}>取消这次支付</button></details><details><summary>关于本次演示</summary><p>所有业务均为虚构模拟，不会扣款。材料仅登记元数据，不保存原文件，不发送给模型。</p><p>同一页面内保留业务状态，刷新、关闭或重新打开即恢复初始数据。不同页面独立运行。</p><p>审核按演示时间自动推进。需补件场景可再次模拟提交指定材料后继续提审。</p></details><DemoCollectionLink className="heat-back"/></Modal>}
    {restartOpen && <Modal title="恢复初始演示场景？" close={() => setRestartOpen(false)}><p>这会为您建立新的个人演示会话，回到初始的六种住户场景。</p><p>当前页面会离开旧会话。当前页面数据将被丢弃；其他页面、访客和 Demo 不受影响。</p><button className="heat-button primary full" disabled={busy} onClick={() => void restart()}>确认恢复初始场景</button></Modal>}
    {signing && <AgreementDialog agreement={signing.agreement} initialMode={signing.mode} error={signingError} busy={disabled} close={() => setSigning(null)} sign={(signature, key) => void signAgreement(signature, key)}/>}
    {invoice && <Modal title="模拟电子发票" close={() => setInvoice(null)}><div className="heat-invoice"><span>和煦供暖 · 演示票据</span><p className="heat-money"><span>¥</span> {amount(invoice.amountCents)}</p><dl><dt>票据编号</dt><dd>{invoice.id}</dd><dt>订单编号</dt><dd>{invoice.orderId}</dd><dt>账单编号</dt><dd>{invoice.billId}</dd><dt>出具时间</dt><dd>{new Date(invoice.issuedAt).toLocaleString("zh-CN", { hour12: false })}</dd></dl><p>{invoice.notice}</p></div></Modal>}
  </main>;
}

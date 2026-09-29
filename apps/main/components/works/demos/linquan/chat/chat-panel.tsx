"use client";

import { type FormEvent, type KeyboardEvent, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useVisitor } from "@/components/works/demos/linquan/shell/visitor-provider";
import { chatHistorySchema } from "@/lib/works/linquan/storage/session";
import { readLocalStorage, writeLocalStorage } from "@/lib/works/linquan/storage/local-storage";
import { scenicSpotMap } from "@/lib/works/linquan/data";
import { chatApiOutputSchema } from "@/lib/works/linquan/schemas/tool";
import type { ChatMessage } from "@/lib/works/linquan/types";
import { Icon } from "@/components/works/demos/linquan/ui/icons";

const HISTORY_KEY = "scenic-agent:chat-history";
const prompts = ["下一站去哪？", "最近的厕所在哪里？", "今天有什么活动？", "给我一个自然探索任务"];
const toolLabels: Record<string, string> = { plan_tour_route: "已计算游览路线", set_current_location: "已更新当前位置", get_service_info: "已查询附近服务", query_events: "已查询活动", register_event: "活动报名结果", pickup_creative: "文创取货结果", get_nature_task: "已匹配自然任务", get_scenic_info: "已查询景区资料", get_current_location: "已读取当前位置", advise_route: "已核对当前路线", request_staff_help: "人工求助结果" };
export type ChatHandle = { ask: (message: string) => void; showHistory: () => void };

export const ChatPanel = forwardRef<ChatHandle, { onPlan: () => void }>(function ChatPanel({ onPlan }, ref) {
  const { context, setContext, hydrated: visitorReady } = useVisitor();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const locationName = scenicSpotMap[context.currentSpotId]?.name ?? "景区内";

  useEffect(() => { setMessages(readLocalStorage(HISTORY_KEY, chatHistorySchema, [])); setHydrated(true); }, []);
  useEffect(() => { if (hydrated) writeLocalStorage(HISTORY_KEY, messages.slice(-100)); }, [messages, hydrated]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, sending]);
  useImperativeHandle(ref, () => ({ ask: (message) => { setHistoryOpen(false); void sendMessage(message); }, showHistory: () => setHistoryOpen(true) }));

  async function sendMessage(message = draft) {
    const value = message.trim();
    if (!value || sendingRef.current || !hydrated || !visitorReady) return;
    sendingRef.current = true;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: value, createdAt: new Date().toISOString() };
    setMessages((current) => [...current, userMessage]); setDraft(""); setSending(true);
    try {
      const response = await fetch("/api/experiments/linquan/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: value, context, history: messages.slice(-20).map(({ role, content }) => ({ role, content })) }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "暂时无法连接，请稍后重试。");
      const payload = chatApiOutputSchema.parse(json);
      if (payload.context) setContext(payload.context);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: payload.answer, createdAt: new Date().toISOString(), engine: payload.engine, tool: payload.tool, action: payload.action }]);
      if (context.profile.voiceGuideEnabled && "speechSynthesis" in window) { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(payload.answer.replaceAll("**", "")); utterance.lang = /^[\x00-\x7F]*$/.test(payload.answer) ? "en-US" : "zh-CN"; window.speechSynthesis.speak(utterance); }
    } catch (error) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: error instanceof Error ? error.message : "暂时无法连接景区助手，请稍后重试。", createdAt: new Date().toISOString() }]);
      setDraft(value);
    } finally { setSending(false); sendingRef.current = false; }
  }
  function onSubmit(event: FormEvent) { event.preventDefault(); void sendMessage(); }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendMessage(); } }

  return <div className="chat-panel">
    <header className="chat-header"><span className="assistant-avatar"><Icon name="spark" size={24} /></span><div><h2>林间向导<span className="ai-badge">AI</span></h2><p><span className="status-dot" />已承接你在{locationName}的游览状态</p></div><button className="icon-button" onClick={() => setHistoryOpen(!historyOpen)} aria-label={historyOpen ? "关闭历史记录" : "打开历史记录"}><Icon name={historyOpen ? "close" : "history"} /></button></header>
    {historyOpen ? <div className="history-panel"><div className="section-heading"><h3>一路聊过的事</h3><span>当前会话 · 本机保存</span></div>{!messages.length ? <div className="empty-history"><Icon name="history" size={32} /><p>还没有对话。<br />从一个关于林泉的问题开始吧。</p><button className="text-link" onClick={() => setHistoryOpen(false)}>问问向导<Icon name="arrow" /></button></div> : <div className="history-list">{messages.filter((message) => message.role === "user").map((message) => <button key={message.id} onClick={() => { setHistoryOpen(false); requestAnimationFrame(() => document.getElementById(message.id)?.scrollIntoView({ block: "center", behavior: "smooth" })); }}><Icon name="chat" size={17} /><span>{message.content}<small>{new Date(message.createdAt).toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small></span><Icon name="chevron" size={15} /></button>)}</div>}</div> : <>
      <div className="chat-scroll" ref={scrollRef} role="log" aria-live="polite" aria-label="与向导的对话">
        {!messages.length && <div className="chat-empty"><span className="welcome-symbol"><Icon name="leaf" size={36} /></span><span className="eyebrow">YOUR PERSONAL NATURE GUIDE</span><h3>山野之间，有问有答。</h3><p>我是你的林泉向导。想去哪里、需要什么，<br />或只是对路边的一片叶子好奇，都可以告诉我。</p><div className="chat-context-note"><Icon name="pin" size={16} />{locationName}<span>·</span>{context.profile.availableMinutes} 分钟可用</div><div className="quick-grid">{prompts.map((prompt) => <button key={prompt} disabled={!hydrated || !visitorReady} onClick={() => void sendMessage(prompt)}>{prompt}<Icon name="arrow" size={15} /></button>)}</div></div>}
        {messages.map((message) => <div className={`message ${message.role}`} id={message.id} key={message.id}>{message.role === "assistant" && <div className="message-avatar"><Icon name="spark" size={17} /></div>}<div className="message-body"><div className="bubble">{message.content.split(/(\*\*.*?\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part)}</div>{message.action && <span className="action-label"><Icon name="check" size={13} />{message.action.label}</span>}{message.tool === "plan_tour_route" && <button className="message-route-link text-link" onClick={onPlan}>打开路线手记<Icon name="arrow" size={14} /></button>}{message.engine && <div className="message-meta"><span>{message.engine.mode === "llm" ? "AI 向导" : message.engine.mode === "fallback" ? "模型暂不可用 · 规则回答" : "规则演示 · 未连接模型"}</span>{message.tool && <span title={message.tool}>{toolLabels[message.tool] ?? "已查询现场信息"}</span>}</div>}</div></div>)}
        {sending && <div className="message"><div className="message-avatar"><Icon name="spark" size={17} /></div><div className="thinking"><span /><span /><span /><small>正在查看你的游览信息</small></div></div>}
      </div>
      <form className="composer" onSubmit={onSubmit}>{messages.length > 0 && <div className="composer-shortcuts">{prompts.slice(0, 3).map((prompt) => <button key={prompt} type="button" disabled={sending} onClick={() => void sendMessage(prompt)}>{prompt}</button>)}</div>}<div className="composer-row"><label htmlFor="chat-input" className="sr-only">向景区向导提问</label><textarea id="chat-input" maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} placeholder="问问路线、风景，或告诉我你走到哪里了…" rows={2} /><button className="send-button" disabled={sending || !hydrated || !visitorReady || !draft.trim()} aria-label="发送消息"><Icon name="send" size={20} /></button></div><div className="composer-hint"><span>路线与服务会结合你的当前位置</span><span>中文 / English · Enter 发送</span></div></form>
    </>}
  </div>;
});

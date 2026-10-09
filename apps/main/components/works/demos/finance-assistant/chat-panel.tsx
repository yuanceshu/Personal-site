'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ChatResponse, ConversationMessage, FinanceConversationContext, ResultBlock } from '@/lib/works/finance-assistant/agent/types';
import ResultBlockView from './result-blocks';
import Icon from './ui/icons';
import { companyNames, date, metricNames } from './ui/display';

type DisplayMessage = ConversationMessage & { blocks?: ResultBlock[]; error?: string };
export type ChatHandle = { ask: (message: string) => void; focus: () => void; reset: () => void };
const messageKey = 'finance-agent-messages';
const contextKey = 'finance-agent-context';
const prompts = [
  { name: '查经营指标', text: '上个月集团销售额是多少？', icon: 'trend' as const, hint: '销售额、渠道占比与每日趋势' },
  { name: '解释变化原因', text: '为什么8月份销售下降了？', icon: 'spark' as const, hint: '同比环比与主要贡献因素' },
  { name: '检查渠道对账', text: '帮我看看上周银联渠道的对账情况。', icon: 'reconcile' as const, hint: '匹配结构、差异与订单追溯' },
  { name: '查看近期异常', text: '最近有什么值得关注的异常？', icon: 'alert' as const, hint: '销售下滑、渠道偏离与退款率' },
];

function readMessages(value: unknown): DisplayMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is DisplayMessage => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string').slice(-20).map(item => ({ ...item, blocks: Array.isArray(item.blocks) ? item.blocks.filter(block => block && typeof block.type === 'string') : [] }));
}

const ChatPanel = forwardRef<ChatHandle>(function ChatPanel(_, ref) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [context, setContext] = useState<FinanceConversationContext>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const followLatest = useRef(true);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedMessages = localStorage.getItem(messageKey);
        const savedContext = localStorage.getItem(contextKey);
        if (savedMessages) setMessages(readMessages(JSON.parse(savedMessages)));
        if (savedContext) { const parsed = JSON.parse(savedContext); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) setContext(parsed); }
      } catch { /* Invalid or unavailable storage starts a new session. */ }
      setRestored(true);
    }, 0);
    return () => { window.clearTimeout(timer); abort.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(messageKey, JSON.stringify(messages.slice(-20))); localStorage.setItem(contextKey, JSON.stringify(context)); } catch { /* The current React session still works if storage is unavailable. */ }
  }, [messages, context, restored]);

  useEffect(() => { if (followLatest.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [messages, loading]);

  async function send(value = input) {
    const message = value.trim();
    if (!message || busy.current || !restored) return;
    busy.current = true;
    followLatest.current = true;
    setInput('');
    const nextMessages: DisplayMessage[] = [...messages, { role: 'user', content: message }];
    setMessages(nextMessages);
    setLoading(true);
    const controller = new AbortController();
    abort.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetch('/api/experiments/finance-assistant/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ message, conversationHistory: messages.filter(item => !item.error).slice(-20).map(({ role, content }) => ({ role, content })), financeContext: context }),
      });
      const payload = await response.json() as ChatResponse & { error?: { message?: string; code?: string } };
      if (!response.ok) throw new Error(payload.error?.code === 'AGENT_NOT_CONFIGURED' ? '对话服务尚未配置。经营概览、对账与异常数据仍可查看；配置服务端模型后即可开始对话。' : payload.error?.message ?? '服务暂时不可用，请稍后重试。');
      setMessages([...nextMessages, { role: 'assistant', content: payload.answer, blocks: payload.blocks }]);
      setContext(payload.context);
    } catch (error) {
      setMessages([...nextMessages, { role: 'assistant', content: '', error: controller.signal.aborted ? '本次查询超时，请稍后重试或缩小查询范围。' : error instanceof Error ? error.message : '请求失败，请稍后重试。' }]);
    } finally {
      window.clearTimeout(timeout); busy.current = false; setLoading(false); abort.current = null;

    }
  }

  useImperativeHandle(ref, () => ({ ask: message => { void send(message); }, focus: () => textarea.current?.focus(), reset: () => { if (!loading) { setMessages([]); setContext({}); setInput(''); textarea.current?.focus(); } } }));
  const contextTags = [context.lastMetric && metricNames[context.lastMetric], context.lastCompanyId && companyNames[context.lastCompanyId], context.lastChannel, context.lastCategory, context.lastTimeRange?.start && `${date(context.lastTimeRange.start)} — ${date(context.lastTimeRange.end ?? '')}`, context.lastTimeRange?.preset === 'previous_month' && '上个月', context.lastTimeRange?.preset === 'previous_week' && '上周'].filter(Boolean);

  return <section className="chat-panel" aria-label="财务智能分析对话">
    <div className="chat-heading"><div className="assistant-identity"><span className="assistant-mark"><Icon name="spark" /></span><div><h2>云川财务智能体</h2><p>把复杂的数据问题，变成清楚的答案</p></div></div><button className="quiet-button" onClick={() => { if (!loading) { setMessages([]); setContext({}); setInput(''); textarea.current?.focus(); } }} disabled={loading || !messages.length}><Icon name="plus" />新会话</button></div>
    {!!contextTags.length && <div className="context-strip"><span>当前追问上下文</span>{contextTags.map(tag => <b key={String(tag)}>{tag}</b>)}</div>}
    <div className="messages" ref={scroll} onScroll={event => { const el = event.currentTarget; followLatest.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64; }} aria-live="polite" aria-busy={loading}>
      {!messages.length && <div className="chat-empty"><h3>从一个好问题开始。</h3><p>查指标、追变化、展开差异，也可以直接输入问题。</p><div className="prompt-grid">{prompts.map(prompt => <button key={prompt.name} onClick={() => void send(prompt.text)} disabled={!restored || loading}><Icon name={prompt.icon} /><div><b>{prompt.name}</b><small>{prompt.hint}</small></div><Icon name="arrow" /></button>)}</div></div>}
      {messages.map((item, index) => <article className={`message ${item.role}`} key={`${item.role}-${index}`}><div className="message-meta"><span className={`message-avatar ${item.role}`}><Icon name={item.role === 'user' ? 'company' : 'spark'} /></span><b>{item.role === 'user' ? '你' : '财务智能体'}</b>{item.role === 'assistant' && !item.error && !!item.blocks?.length && <span className="fact-label"><Icon name="check" />已查询数据</span>}</div>{item.error ? <div className="error-message"><Icon name="alert" /><div><p>{item.error}</p><button className="text-button" disabled={loading} onClick={() => void send(messages[index - 1]?.content ?? '')}>重新尝试</button></div></div> : <p className="message-copy">{item.content}</p>}{item.blocks?.map((block, blockIndex) => <ResultBlockView block={block} key={`${block.type}-${blockIndex}`} />)}</article>)}
      {loading && <article className="message assistant loading-message"><div className="message-meta"><span className="message-avatar assistant"><Icon name="spark" /></span><b>财务智能体</b></div><div className="loading-line"><i /><i /><i /><span>正在查询与分析数据…</span></div></article>}
    </div>
    {messages.length > 0 && !loading && <div className="follow-up-prompts">{['跟上月相比呢？', '主要原因是什么？', '把金额不一致的展开。'].filter(prompt => context.lastIntent?.includes('reconcil') ? prompt.includes('金额') : !prompt.includes('金额')).map(prompt => <button key={prompt} onClick={() => void send(prompt)}>{prompt}<Icon name="arrow" /></button>)}</div>}
    <form className="composer" onSubmit={event => { event.preventDefault(); void send(); }}><label className="sr-only" htmlFor="finance-question">你的财务问题</label><div className="composer-input"><textarea id="finance-question" ref={textarea} value={input} maxLength={2000} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} placeholder="例如：为什么 8 月销售额下降了？" rows={2} disabled={loading || !restored} /><div className="composer-bottom"><span><Icon name="spark" />经营 · 对账 · 异常 · 报告</span><button className="send-button" type="submit" disabled={loading || !input.trim() || !restored} aria-label="发送问题"><Icon name="send" /></button></div></div></form><div className="chat-footnote"><span>Enter 发送 · Shift + Enter 换行</span><span>会话仅保存在此设备</span></div>
  </section>;
});

export default ChatPanel;

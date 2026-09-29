"use client";

/**
 * 两个角色共用的对话面板。它只做三件事：把投影交给 Agent、把流式状态显示出来、把确认动作
 * 交回确定性代码。所有数字与写入都不经过模型。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQintai, type ChatEntry, type ProposalOutcome } from "@/components/works/demos/qintai-ticketing/provider";
import type { ChatResult, Role } from "@/lib/works/qintai-ticketing/schema";

const CALM: Record<Role, { title: string; subtitle: string; placeholder: string; prompts: string[] }> = {
  customer: {
    title: "琴台助手",
    subtitle: "只依据本页确定的数据回答 · 不代你锁座、不代你下单",
    placeholder: "问问演出、票档、费用或购票规则…",
    prompts: [
      "我想买两张《如梦之梦》的票，帮我比较琴台大剧院的票档",
      "《如梦之梦》有票档显示售罄，我还有什么办法？",
      "帮我看看《津声楚韵》的票价包含哪些费用",
      "武汉琴台音乐厅最近有哪些演出？",
    ],
  },
  merchant: {
    title: "运营助手",
    subtitle: "读取排期、告警与待审批提案 · 草案需你确认后才执行",
    placeholder: "问问售出进度、告警，或让我准备一份改价草案…",
    prompts: [
      "哪些场次明显低于同类基线？",
      "《时光的折痕》 balcony 还有多少余量，要不要做活动？",
      "现在有哪些待审批的提案？",
      "帮我把 AT-TIX-105-BAL 的价格下调 10% 准备一份草案",
    ],
  },
};

function Cards({ result }: { result: ChatResult }) {
  if (result.cards.length === 0) return null;
  return (
    <div className="q-cards">
      {result.cards.map((card) => (
        <div className="q-card" key={card.id}>
          <small>{card.eyebrow}</small>
          <h4>{card.title}</h4>
          <dl>
            {card.items.map((row) => (
              <div key={`${row.label}-${row.value}`}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

function Proposal({
  entry,
  outcome,
  onConfirm,
}: {
  entry: ChatEntry;
  outcome: ProposalOutcome | undefined;
  onConfirm: (proposal: NonNullable<ChatResult["proposal"]>) => void;
}) {
  const proposal = entry.result?.proposal;
  if (!proposal) return null;
  const done = outcome?.ok === true;
  return (
    <div className={`q-proposal${done ? " is-done" : ""}`}>
      <div>
        <small>AWAITING YOUR DECISION / 演示动作</small>
        <h4>{proposal.title}</h4>
        <p>{proposal.detail}</p>
        {outcome ? (
          <p className={outcome.ok ? "q-proposal-note" : "q-proposal-note is-blocked"} role="status">
            {outcome.message}
            {outcome.href ? " 已为你打开下一步的入口。" : ""}
          </p>
        ) : null}
      </div>
      <div className="q-proposal-side">
        <button type="button" disabled={done} onClick={() => onConfirm(proposal)}>
          {done ? "已执行 ✓" : proposal.action_label}
        </button>
        {outcome?.href ? <Link href={outcome.href}>前往处理 ↗</Link> : null}
      </div>
    </div>
  );
}

export function ChatDrawer({
  role,
  open,
  onClose,
  notices,
}: {
  role: Role;
  open: boolean;
  onClose: () => void;
  /** 页面注入的额外提示，例如「先在演出详情页选中票档，助手的比较才有依据」。 */
  notices?: string[];
}) {
  const { chat, ask, live, runProposal, session } = useQintai();
  const state = chat[role];
  const config = CALM[role];
  const [input, setInput] = useState("");
  const [outcomes, setOutcomes] = useState<Record<string, ProposalOutcome>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const entries = state.entries;

  useEffect(() => {
    if (!open || entries.length === 0) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, open]);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      // 探测尚未结束时先不发送；探测结果为 false 时仍允许发送，
      // askQintaiAgent 会把 503、超时和异常降级为确定性回答。
      if (!text || state.pending || live === null) return;
      setInput("");
      ask(role, text);
    },
    [ask, live, role, state.pending],
  );

  const status = useMemo(() => {
    if (live === null) return { label: "◌ 正在探测实时 Agent", tone: "muted" as const };
    if (live) return { label: "● 实时 Agent 已连接", tone: "ok" as const };
    return { label: "○ 实时 Agent 未配置 · 助手会退化为确定性回答", tone: "warn" as const };
  }, [live]);

  return (
    <aside className={`q-chat${open ? " is-open" : ""}`} aria-hidden={!open} aria-label={`${config.title}·演示对话`}>
      <header className="q-chat-head">
        <div>
          <span className="q-chat-mark" aria-hidden>琴</span>
          <span>
            <h2>{config.title}</h2>
            <p>{config.subtitle}</p>
          </span>
        </div>
        <button type="button" className="q-icon-button" onClick={onClose} aria-label="收起对话">✕</button>
      </header>
      <p className={`q-chat-status q-chat-status--${status.tone}`} role="status">{status.label}</p>
      {notices && notices.length > 0 ? (
        <ul className="q-chat-notices">
          {notices.map((notice) => <li key={notice}>{notice}</li>)}
        </ul>
      ) : null}
      <div className="q-chat-scroll" ref={scrollRef} aria-live="polite">
        {entries.length === 0 ? (
          <div className="q-chat-empty">
            <p className="q-overline">A GOOD PLACE TO START</p>
            <h3>{role === "customer" ? "先问一句，看看这场演出值不值。" : "先看数字，再决定动作。"}</h3>
            <p>
              {role === "customer"
                ? "助手只会引用当前页面上已经确定的票档、费用与规则；锁座和付款仍然由你按下按钮。"
                : "助手只读当前页面的排期、告警与待审批提案；改价、补货、活动都要你确认后才会写入台账。"}
            </p>
            <div className="q-chat-prompts">
              {config.prompts.map((prompt, index) => (
                <button key={prompt} type="button" onClick={() => send(prompt)} disabled={state.pending || live === null}>
                  <span>0{index + 1}</span>
                  {prompt}
                  <b>↗</b>
                </button>
              ))}
            </div>
          </div>
        ) : (
          entries.map((entry) => (
            <article className={`q-turn q-turn--${entry.role}`} key={entry.id}>
              <header className="q-turn-head">
                <span>{entry.role === "user" ? "你" : config.title}</span>
                {entry.mode === "fallback" ? <em>确定性回答{entry.reason ? ` · ${entry.reason}` : ""}</em> : null}
              </header>
              {entry.status === "loading" ? (
                <div className="q-turn-loading">
                  <span className="q-loader" aria-hidden />
                  {state.status ?? "正在理解任务…"}
                  {entry.steps.length > 0 ? (
                    <ol>
                      {entry.steps.map((step) => <li key={step}>{step}</li>)}
                    </ol>
                  ) : null}
                </div>
              ) : (
                <p className={entry.status === "error" ? "q-turn-error" : ""}>{entry.text}</p>
              )}
              {entry.result ? (
                <div className="q-turn-result">
                  {entry.steps.length > 0 ? (
                    <div className="q-steps">
                      {[...new Set(entry.steps)].map((step) => <span key={step}>✓ {step}</span>)}
                    </div>
                  ) : null}
                  <Cards result={entry.result} />
                  <Proposal
                    entry={entry}
                    outcome={entry.result.proposal ? outcomes[entry.result.proposal.id] : undefined}
                    onConfirm={(proposal) => {
                      const outcome = runProposal(proposal);
                      setOutcomes((previous) => ({ ...previous, [proposal.id]: outcome }));
                    }}
                  />
                  <details className="q-sources">
                    <summary>查看依据 <span>{entry.result.sources.length} 项资料 ↗</span></summary>
                    {entry.result.sources.length > 0 ? (
                      entry.result.sources.map((source) => (
                        <div className="q-source" key={source.id}>
                          <small>{source.category}</small>
                          <h5>{source.title}</h5>
                          <p>{source.excerpt}</p>
                        </div>
                      ))
                    ) : (
                      <p>本次没有引用额外资料。</p>
                    )}
                  </details>
                  {entry.result.followups.length > 0 ? (
                    <div className="q-followups">
                      {entry.result.followups.map((followup) => (
                        <button key={followup} type="button" onClick={() => send(followup)} disabled={state.pending || live === null}>
                          {followup} ↗
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
      <form
        className="q-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <label htmlFor={`q-chat-input-${role}`}>{role === "customer" ? "继续问" : "给运营助手下指令"}</label>
        <div>
          <textarea
            id={`q-chat-input-${role}`}
            rows={2}
            maxLength={1200}
            value={input}
            placeholder={live === false ? "实时 Agent 未配置，可先浏览页面数据" : config.placeholder}
            disabled={live === null}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send(input);
              }
            }}
          />
          <button type="submit" disabled={state.pending || live === null || !input.trim()}>发送 ↗</button>
        </div>
        <small>
          会话历史与票务状态只保存在这台浏览器（当前会话 {session.session_id.slice(0, 12)}…）。所有库存、金额与
          演出均为本地模拟数据。
        </small>
      </form>
    </aside>
  );
}

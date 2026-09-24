"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { resultSchema, type ChatResult, type RestaurantRole } from "@/lib/works/restaurant-ai/schema";

type DemoModule = RestaurantRole | "home";
type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  result?: ChatResult;
  steps?: string[];
  status?: "loading" | "done" | "error";
  sample?: boolean;
};

const paths: Record<RestaurantRole, string> = {
  customer: "/works/demos/restaurant-ai/customer-service",
  operations: "/works/demos/restaurant-ai/operations",
  finance: "/works/demos/restaurant-ai/finance",
};

const roles = {
  customer: {
    number: "01", kicker: "给顾客 · CUSTOMER", title: "智能门店顾问", short: "从口味与人数出发，组合菜品、核对桌位、准备预订草案。",
    heading: "今晚想怎么吃？", description: "说出人数、口味或用餐场景。Agent 会查阅演示菜单与桌位，再给出可以确认的方案。",
    prompts: ["两位想吃不辣的菜，明晚还有桌位吗？帮我准备预订草案", "滨江店可以停车吗？", "过生日可以布置吗？"],
    samplePrompt: "两位想吃清淡的菜，帮我准备明晚预订草案",
  },
  operations: {
    number: "02", kicker: "给运营 · OPERATIONS", title: "门店运营 Agent", short: "读取经营快照和制度，识别问题，准备待经理确认的动作。",
    heading: "把经营信号变成行动。", description: "让 Agent 核对演示数据与制度，提出可追溯的运营建议。所有调整先停在确认环节。",
    prompts: ["看看今天经营与库存，给出活动调整草案", "临时采购 800 元需要谁审批？", "国庆活动能和会员折扣叠加吗？"],
    samplePrompt: "看看经营与库存，给出活动调整草案",
  },
  finance: {
    number: "03", kicker: "给财务 · FINANCE", title: "财务核对 Agent", short: "拆解平台与收银差额，展示数字来源，生成复核清单。",
    heading: "每一笔差额，都有去处。", description: "由程序计算演示账目，Agent 解释可能的核对路径；清单需人工确认。",
    prompts: ["核对外卖平台与收银差额，生成复核清单", "现金短款 180 元需要上报吗？", "发票抬头开错了怎么报销？"],
    samplePrompt: "核对外卖平台与收银差额，生成复核清单",
  },
} as const;

const samples: Record<RestaurantRole, ChatResult> = {
  customer: {
    mode: "live", answer: "我参考了演示菜单和明日桌位：两位清淡用餐可以考虑清蒸鲈鱼、菌菇鸡汤。明日 18:30 有一个演示档期，已为你准备预订草案。这里不会向真实门店提交。",
    sources: [{ id: "menu", title: "悦味滨江店演示菜单", category: "演示菜单", excerpt: "清蒸鲈鱼 88 元、菌菇鸡汤 48 元；均为虚构菜品与价格。" }, { id: "slots", title: "悦味滨江店演示排期", category: "演示桌位", excerpt: "明日 18:30 档期仅为虚构样例，不代表实时可订。" }],
    cards: [{ id: "menu", title: "两人用餐参考", eyebrow: "演示菜单", items: [{ label: "清蒸鲈鱼", value: "¥88 · 清淡" }, { label: "菌菇鸡汤", value: "¥48 · 清淡" }] }, { id: "slots", title: "可选档期", eyebrow: "演示排期", items: [{ label: "明日 18:30", value: "2 人" }] }],
    proposal: { id: "booking-0000000000", title: "预订草案", detail: "悦味滨江店 · 明日 18:30 · 2 人；确认仅保存于当前页面。", action_label: "确认演示草案" },
    followups: ["停车可以免费多久？", "生日可以布置吗？"],
  },
  operations: {
    mode: "live", answer: "演示快照显示鲜鲈鱼和菌菇拼盘均低于警戒量。建议先复核补货与门店供应，再调整相关活动露出；我已准备一份待经理确认的草案，未发布活动。",
    sources: [{ id: "operations-snapshot", title: "滨江店演示经营快照", category: "演示数据", excerpt: "虚构营业日：销售额 18,640 元、订单 126 笔；鲜鲈鱼余 3 份，菌菇拼盘余 5 份。" }],
    cards: [{ id: "operations", title: "经营与备货", eyebrow: "虚构营业日快照", items: [{ label: "销售额", value: "¥18,640" }, { label: "订单", value: "126 笔" }, { label: "鲜鲈鱼", value: "余 3 / 警戒 8" }, { label: "菌菇拼盘", value: "余 5 / 警戒 10" }] }],
    proposal: { id: "campaign-0000000000", title: "运营调整草案", detail: "先核查低库存菜品补货，再复核相关活动露出；不会发布真实活动。", action_label: "确认演示草案" },
    followups: ["临时采购需要谁审批？", "国庆活动规则是什么？"],
  },
  finance: {
    mode: "live", answer: "演示账目中，POS 应收 12,730 元；平台结算、退款与服务费合计 12,680 元，程序计算出待查差额 50 元。请按对账 SOP 逐笔核对跨日订单及其他扣款，复核清单已准备但未提交。",
    sources: [{ id: "finance-ledger", title: "滨江店演示对账明细", category: "演示数据", excerpt: "POS 12,730 元，平台结算 12,438 元，退款 80 元，平台服务费 162 元。" }, { id: "reconcile", title: "第三方外卖平台对账 SOP", category: "平台对账", excerpt: "先核结算周期，再查优惠承担、退款、取消、服务费、配送费及跨日订单。" }],
    cards: [{ id: "finance", title: "平台对账拆解", eyebrow: "虚构账目 · 程序计算", items: [{ label: "POS 应收", value: "¥12,730" }, { label: "平台结算", value: "¥12,438" }, { label: "退款 + 服务费", value: "¥242" }, { label: "待查差额", value: "¥50" }] }],
    proposal: { id: "review-0000000000", title: "财务复核清单", detail: "复核结算周期、跨日订单和其他扣款；不会提交财务系统。", action_label: "确认演示清单" },
    followups: ["现金短款怎么处理？", "报销需要哪些材料？"],
  },
};

function sampleMessages(role: RestaurantRole): Message[] {
  return [
    { id: crypto.randomUUID(), role: "user", text: roles[role].samplePrompt, sample: true },
    { id: crypto.randomUUID(), role: "assistant", text: samples[role].answer, result: samples[role], steps: ["样例：读取虚构业务资料", "样例：形成待确认草案"], status: "done", sample: true },
  ];
}

function Header({ active }: { active?: RestaurantRole }) {
  return <header className="r-header">
    <Link href="/works/demos" className="r-back">← 行业 Demo 集</Link>
    <Link href="/works/demos/restaurant-ai" className="r-brand"><span className="r-brand-mark">食</span><span>食智助手<small>YUEWEI · AGENT STUDIO</small></span></Link>
    <span className="r-header-note">虚构餐饮集团 · 产品演示</span>
    {active && <Link href="/works/demos/restaurant-ai" className="r-top-home">场景总览 ↗</Link>}
  </header>;
}

function Home() {
  return <main className="r-app r-home">
    <Header />
    <section className="r-hero">
      <div className="r-hero-copy"><p className="r-eyebrow">FOOD INTELLIGENCE / 2026</p><h1>让餐饮服务<br /><em>继续往前走。</em></h1><p className="r-hero-lede">从一次用餐安排，到门店运营和财务复核。三个 Agent 读取资料、分析情况、提出行动，并在需要你决定的地方停下来。</p><div className="r-hero-cta"><Link href={paths.customer}>进入顾客场景 <span>↗</span></Link><span>03 个角色 · 03 条演示链路</span></div></div>
      <div className="r-hero-art" aria-hidden="true"><div className="r-art-top"><span>YUEWEI / 悦味</span><span>WORKFLOW 01—03</span></div><div className="r-art-orbit"><span className="r-art-center">食</span><span className="r-art-node node-one">顾客<br />想法</span><span className="r-art-node node-two">门店<br />信号</span><span className="r-art-node node-three">财务<br />线索</span></div><div className="r-art-bottom"><span>理解需求</span><span>查阅依据</span><span>等待确认</span></div></div>
    </section>
    <section className="r-scenarios"><div className="r-section-heading"><p className="r-eyebrow">CHOOSE A WORKFLOW</p><h2>同一家餐厅，三种具体的问题。</h2><p>从单句问答走向可以看见过程的任务体验。</p></div><div className="r-card-grid">{(Object.keys(roles) as RestaurantRole[]).map(role => <Link key={role} href={paths[role]} className={`r-scenario r-${role}`}><div className="r-scenario-top"><span>{roles[role].number} / 03</span><span className="r-scenario-arrow">↗</span></div><span className="r-scenario-kicker">{roles[role].kicker}</span><h3>{roles[role].title}</h3><p>{roles[role].short}</p><div className="r-scenario-bottom"><span>{roles[role].samplePrompt}</span><b>开始体验</b></div></Link>)}</div></section>
    <footer className="r-disclaimer">所有门店、菜单、制度、经营及财务数据均为虚构演示内容。草案不会提交到真实系统。</footer>
  </main>;
}

export function RestaurantDemo({ module }: { module: DemoModule }) {
  if (module === "home") return <Home />;
  return <Workspace role={module} />;
}

function Workspace({ role }: { role: RestaurantRole }) {
  const config = roles[role];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveAvailable, setLiveAvailable] = useState<boolean | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const abort = useRef<AbortController | null>(null);
  const scroll = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messages.length > 0) scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" });
  }, [messages]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    let current = true;
    fetch("/api/experiments/restaurant-ai/chat", { cache: "no-store" })
      .then(async response => response.ok && (await response.json()).live === true)
      .catch(() => false)
      .then(live => {
        if (!current) return;
        setLiveAvailable(live);
        if (!live) {
          setNotice("实时 Agent 当前不可用。以下为明确标注的预置样例，不是实时生成结果。");
          setMessages(sampleMessages(role));
        }
      });
    return () => { current = false; };
  }, [role]);

  const showSample = () => {
    setNotice("当前展示的是预置样例，不是实时 Agent 结果。");
    setMessages(sampleMessages(role));
    setAccepted([]);
  };

  const send = async (raw = input) => {
    const question = raw.trim();
    if (!question || busy || liveAvailable !== true) return;
    const assistantId = crypto.randomUUID();
    const history = messages.filter(item => !item.sample && item.status !== "loading" && item.status !== "error").slice(-16).map(item => ({ role: item.role, content: item.text.slice(0, 1200) }));
    setInput(""); setNotice(""); setBusy(true);
    setMessages(previous => [...previous, { id: crypto.randomUUID(), role: "user", text: question }, { id: assistantId, role: "assistant", text: "", steps: [], status: "loading" }]);
    const controller = new AbortController(); abort.current = controller;
    let finished = false;
    try {
      const response = await fetch("/api/experiments/restaurant-ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, message: question, history, accepted }), signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Agent 暂时无法响应。");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const consume = (block: string) => {
        const event = block.split("\n").find(line => line.startsWith("event: "))?.slice(7);
        const data = block.split("\n").find(line => line.startsWith("data: "))?.slice(6);
        if (!event || !data) return;
        const value: unknown = JSON.parse(data);
        if (event === "status" && value && typeof value === "object" && "label" in value && typeof value.label === "string")
          setMessages(previous => previous.map(item => item.id === assistantId ? { ...item, steps: [...new Set([...(item.steps ?? []), value.label as string])] } : item));
        if (event === "final") {
          const result = resultSchema.parse(value);
          finished = true;
          setMessages(previous => previous.map(item => item.id === assistantId ? { ...item, text: result.answer, result, status: "done" } : item));
        }
        if (event === "error") throw new Error("Agent 暂时无法完成这项任务，请稍后重试。");
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) consume(block);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consume(buffer);
      if (!finished) throw new Error("结果未完整返回，请重试。");
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "Agent 暂时无法响应。";
      setMessages(previous => previous.map(item => item.id === assistantId ? { ...item, text: message, status: "error" } : item));
    } finally { setBusy(false); abort.current = null; }
  };

  return <main className={`r-app r-workspace r-${role}`}>
    <Header active={role} />
    <div className="r-work-layout">
      <aside className="r-rail" aria-label="角色与演示信息"><div className="r-rail-label">WORKSPACES <span>01—03</span></div><nav className="r-role-nav" aria-label="切换角色">{(Object.keys(roles) as RestaurantRole[]).map(item => <Link key={item} href={paths[item]} aria-current={item === role ? "page" : undefined}><span>{roles[item].number}</span>{roles[item].title}<b>↗</b></Link>)}</nav><div className="r-rail-bottom"><span className="r-status-dot" />虚构业务环境<p>Agent 查询的是隔离的演示资料。任何草案都需要你确认，且不会提交到真实门店。</p><small>本页已确认演示草案：{accepted.length}</small></div></aside>
      <section className="r-main-panel"><div className="r-intro"><p className="r-eyebrow">{config.kicker} / AGENT WORKSPACE</p><h1>{config.heading}</h1><p>{config.description}</p><div className="r-work-meta"><span><i />资料可追溯</span><span><i />操作待确认</span><span><i />会话仅在当前页面</span></div></div>
        <div className="r-conversation"><div className="r-conversation-top"><span>当前任务</span><div><span className="r-live-badge">{liveAvailable === true ? "● 实时 Agent" : liveAvailable === false ? "○ 样例模式" : "◌ 检查服务"}</span><button type="button" onClick={showSample} disabled={busy}>查看样例回放 ↗</button></div></div>
          {notice && <p className="r-sample-notice" role="status">{notice}</p>}
          <div className="r-chat-scroll" ref={scroll} aria-live="polite">{messages.length === 0 ? <div className="r-empty"><span className="r-empty-mark">{config.number}</span><p className="r-eyebrow">A GOOD PLACE TO START</p><h2>给我一个具体问题。<br />我们从资料开始。</h2><p>试试下面的任务示例，看看 Agent 如何查资料、组织结果与准备下一步。</p><div className="r-prompt-list">{config.prompts.map((prompt, index) => <button key={prompt} type="button" onClick={() => send(prompt)} disabled={busy || liveAvailable !== true}><span>0{index + 1}</span>{prompt}<b>↗</b></button>)}</div></div> : messages.map(item => <div key={item.id} className={`r-message r-message-${item.role}`}><div className="r-message-head"><span>{item.role === "user" ? "你" : "食智 Agent"}</span>{item.sample && <small>预置样例</small>}</div>{item.status === "loading" ? <div className="r-processing"><span className="r-loader" />{item.steps?.length ? "正在整理查阅结果…" : "正在理解任务…"}{item.steps && <ol>{item.steps.map(step => <li key={step}>{step}</li>)}</ol>}</div> : <p className={item.status === "error" ? "r-error-text" : ""}>{item.text}</p>}
              {item.result && <div className="r-result"><div className="r-steps">{item.steps?.map(step => <span key={step}>✓ {step}</span>)}</div>{item.result.cards.length > 0 && <div className="r-result-cards">{item.result.cards.map(card => <div className="r-data-card" key={card.id}><small>{card.eyebrow}</small><h3>{card.title}</h3><dl>{card.items.map(row => <div key={`${row.label}-${row.value}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></div>)}</div>}
                {item.result.proposal && <div className="r-proposal"><div><small>AWAITING YOUR DECISION / 演示操作</small><h3>{item.result.proposal.title}</h3><p>{item.result.proposal.detail}</p></div><button type="button" disabled={accepted.includes(item.result.proposal.id)} onClick={() => setAccepted(previous => [...previous, item.result!.proposal!.id])}>{accepted.includes(item.result.proposal.id) ? "已在本页确认 ✓" : item.result.proposal.action_label}</button></div>}
                <details className="r-sources"><summary>查看依据 <span>{item.result.sources.length} 项资料 ↗</span></summary>{item.result.sources.length ? item.result.sources.map(source => <div className="r-source" key={source.id}><small>{source.category}</small><h4>{source.title}</h4><p>{source.excerpt}</p></div>) : <p>当前演示资料不足，未引用来源。</p>}</details>
                {item.result.followups.length > 0 && <div className="r-followups">{item.result.followups.map(followup => <button key={followup} type="button" disabled={busy || liveAvailable !== true} onClick={() => send(followup)}>{followup} ↗</button>)}</div>}
              </div>}</div>)}</div>
          <form className="r-composer" onSubmit={event => { event.preventDefault(); send(); }}><label htmlFor="restaurant-question">继续对话</label><div><textarea id="restaurant-question" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} placeholder={liveAvailable === false ? "当前仅可浏览预置样例" : "描述任务或提出问题…"} disabled={liveAvailable !== true} rows={2} maxLength={1200} /><button type="submit" disabled={busy || liveAvailable !== true || !input.trim()}>发送 ↗</button></div><small>实时回答以虚构演示资料为依据；请勿输入真实顾客或财务信息。</small></form>
        </div>
      </section>
      <aside className="r-context"><div className="r-context-header"><small>CONTEXT / {config.number}</small><span>演示资料</span></div><div className="r-context-feature"><span>YUEWEI<br />悦味</span><p>一张桌位、一份库存、一笔差额，都需要能追到来源。</p></div><div className="r-context-section"><small>当前角色</small><h2>{config.title}</h2><p>{config.short}</p></div><div className="r-context-section"><small>工作方式</small><ol><li>理解任务</li><li>查阅对应资料与数据</li><li>形成答案与草案</li><li>等待你确认</li></ol></div><div className="r-context-footer">DEMO DATA ONLY<br />不连接真实业务系统</div></aside>
    </div>
  </main>;
}

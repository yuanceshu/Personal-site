"use client";

import { useRef, useState } from "react";
import { ChatPanel, type ChatHandle } from "@/components/works/demos/linquan/chat/chat-panel";
import { TourPanel } from "@/components/works/demos/linquan/tour/tour-panel";
import { ExplorePanel } from "@/components/works/demos/linquan/scenic/explore-panel";
import { ContextPanel } from "@/components/works/demos/linquan/shell/context-panel";
import { Icon, type IconName } from "@/components/works/demos/linquan/ui/icons";
import { DemoCollectionLink } from "@/components/works/demos/navigation/demo-collection-link";

type Mode = "explore" | "chat" | "tour";
const tabs: { mode: Mode; title: string; icon: IconName }[] = [
  { mode: "explore", title: "发现林泉", icon: "leaf" },
  { mode: "tour", title: "我的路线", icon: "route" },
  { mode: "chat", title: "问问向导", icon: "spark" },
];

export function AppShell({ initialMode = "explore" }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const chatRef = useRef<ChatHandle>(null);
  function ask(message: string) {
    setMode("chat");
    chatRef.current?.ask(message);
  }
  return <div className="app">
    <header className="topbar"><div className="topbar-inner">
      <button className="brand" onClick={() => setMode("explore")} aria-label="林泉首页"><span className="brand-mark"><Icon name="mountain" size={29} /></span><span className="brand-type">林泉<span>LINQUAN · 自然相伴</span></span></button>
      <nav className="main-nav" aria-label="主导航">{tabs.map((tab) => <button key={tab.mode} className={mode === tab.mode ? "active" : ""} aria-current={mode === tab.mode ? "page" : undefined} onClick={() => setMode(tab.mode)}><Icon name={tab.icon} size={18} />{tab.title}{tab.mode === "chat" && <span className="ai-badge">AI</span>}</button>)}</nav>
      <div className="header-actions"><DemoCollectionLink className="collection-back" /></div>
    </div></header>
    <main className="workspace">
      <div className="page-intro"><div><p className="eyebrow">A LITTLE CLOSER TO NATURE</p><h1>{mode === "explore" ? "走进林泉，慢一点也很好。" : mode === "tour" ? "好风景，按你的节奏来。" : "旅途中的小事，随时问我。"}</h1></div><span className="intro-note"><Icon name="leaf" size={16} /> 山野有趣，一路有伴</span></div>
      <div className={`workspace-grid mode-${mode}`}><div className="primary-column">
        {mode === "explore" && <ExplorePanel onPlan={() => setMode("tour")} onAsk={ask} />}
        {mode === "tour" && <TourPanel onAsk={ask} />}
        <section className="chat-container" hidden={mode !== "chat"}><ChatPanel ref={chatRef} onPlan={() => setMode("tour")} /></section>
      </div><ContextPanel onPlan={() => setMode("tour")} onAsk={ask} /></div>
      <footer className="site-footer"><span>林泉 · 在自然里，找到自己的节奏</span><span>虚构景区体验 · 位置由你更新 · 业务操作为模拟</span></footer>
    </main>
    <nav className="mobile-nav" aria-label="移动导航">{tabs.map((tab) => <button key={tab.mode} className={mode === tab.mode ? "active" : ""} aria-current={mode === tab.mode ? "page" : undefined} onClick={() => setMode(tab.mode)}><Icon name={tab.icon} />{tab.title}</button>)}</nav>
  </div>;
}

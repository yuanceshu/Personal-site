"use client";

/** 观众侧外壳：顶部导航 + 观众现场摘要 + 对话抽屉。 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChatDrawer } from "@/components/works/demos/qintai-ticketing/chat/chat-drawer";
import { DemoCollectionLink } from "@/components/works/demos/navigation/demo-collection-link";
import { useQintai } from "@/components/works/demos/qintai-ticketing/provider";
import { formatCountdown, useTicker } from "@/components/works/demos/qintai-ticketing/ui/parts";

const NAV = [
  { href: "/works/demos/qintai-ticketing", label: "首页", exact: true },
  { href: "/works/demos/qintai-ticketing/shows", label: "演出" },
  { href: "/works/demos/qintai-ticketing/wallet", label: "票夹" },
  { href: "/works/demos/qintai-ticketing/waitlist", label: "候补与回流" },
];

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const { storeName, storefront, session, resetSession, drawer, setDrawer } = useQintai();
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1000px)");
    const update = () => setCompact(query.matches);
    update(); query.addEventListener("change", update);
    const observer = new ResizeObserver(() => { if (header.current) shell.current?.style.setProperty("--q-topbar-height", `${header.current.offsetHeight}px`); });
    if (header.current) observer.observe(header.current);
    return () => { query.removeEventListener("change", update); observer.disconnect(); };
  }, []);
  const now = useTicker(1000);

  const cart = storefront.getCart(session);
  const held = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const holds = storefront.engine.holdsForSession(session.session_id);
  const soonest = holds.length > 0 ? Math.min(...holds.map((hold) => hold.expires_at)) : null;
  const seconds = soonest == null ? null : Math.max(0, Math.round((soonest - now) / 1000));
  const fan = storefront.getPreferences(session).display_name ?? "观众";

  return (
    <div className="q-app" ref={shell}>
      <header className="q-topbar" ref={header}>
        <div className="q-topbar-inner">
          <Link className="q-brand" href="/works/demos/qintai-ticketing">
            <span className="q-brand-mark" aria-hidden>琴</span>
            <span className="q-brand-type">{storeName}<small>QINTAI TICKETING · 武汉演出</small></span>
          </Link>
          <DemoCollectionLink className="q-back" />
          <nav className="q-nav" aria-label="主导航">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="q-topbar-side">
            {held > 0 && seconds != null ? (
              <span className={`q-hold-chip${seconds <= 60 ? " is-urgent" : ""}`} title="锁座倒计时结束前不会扣款；超时后座位会回到模拟库存">
                <b>{held}</b> 个锁定座位 · {formatCountdown(seconds)}
              </span>
            ) : (
              <span className="q-hold-chip is-idle">当前无锁定座位</span>
            )}
            <Link className="q-ghost-button" href="/works/demos/qintai-ticketing/merchant">
              运营工作台 ↗
            </Link>
            <button type="button" className="q-ghost-button q-chat-presence" aria-expanded={compact ? drawer.customer : undefined} onClick={() => { if (compact) setDrawer("customer", true); else document.getElementById("q-chat-input-customer")?.focus(); }}>
              琴台助手 <em>AI</em>
            </button>
            <span className="q-demo-badge">模拟数据 · 不收钱</span>
          </div>
        </div>
      </header>

      <div className="q-customer-layout">
        <main className="q-workspace">
          {children}
          <footer className="q-footer">
            <span>QINTAI TICKETING / 价格透明、库存诚实、先锁座再决定</span>
            <span>观众 {fan} · 演出、票价与场馆来自公开资料；库存、锁座、候补与费用拆分为本地模拟数据 · 不产生真实交易</span>
            <button
              type="button"
              className="q-text-button"
              onClick={() => {
                if (window.confirm("重新开始演示会清空这台浏览器上的锁座、候补、票夹、待审批台账与对话记录，确定继续？")) {
                  resetSession();
                }
              }}
            >
              重新开始演示
            </button>
          </footer>
        </main>

        <ChatDrawer role="customer" open={drawer.customer} onClose={() => setDrawer("customer", false)} alwaysVisible={!compact} />
      </div>
    </div>
  );
}

"use client";

/** 运营侧外壳：左侧工作区导航 + 今日待处理计数 + 对话抽屉。 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatDrawer } from "@/components/works/demos/qintai-ticketing/chat/chat-drawer";
import { OPERATOR_NAME, useQintai } from "@/components/works/demos/qintai-ticketing/provider";

const BASE = "/works/demos/qintai-ticketing/merchant";
const NAV = [
  { href: BASE, label: "总览", exact: true },
  { href: `${BASE}/events`, label: "演出与定价" },
  { href: `${BASE}/holds`, label: "库存与待审批" },
];

export function MerchantShell({ children }: { children: React.ReactNode }) {
  const { merchant, resetSession, drawer, setDrawer } = useQintai();
  const pathname = usePathname();
  const chatOpen = drawer.merchant;

  const alerts = merchant.alertCounts();
  const pending = merchant.getPendingChanges().length;
  const counts: Record<string, number | null> = {
    [BASE]: alerts.order_issues,
    [`${BASE}/events`]: alerts.low_stock + alerts.slow_movers,
    [`${BASE}/holds`]: pending,
  };

  return (
    <div className="q-app q-app--merchant">
      <header className="q-topbar">
        <div className="q-topbar-inner">
          <Link className="q-back" href="/works/demos">← <span>行业 Demo 集</span></Link>
          <span className="q-brand">
            <span className="q-brand-mark" aria-hidden>琴</span>
            <span className="q-brand-type">琴台票务<small>{merchant.promoterName}</small></span>
          </span>
          <span className="q-topbar-side">
            <button type="button" className="q-ghost-button" onClick={() => setDrawer("merchant", !chatOpen)} aria-expanded={chatOpen}>
              运营助手 <em>AI</em>
            </button>
            <span className="q-demo-badge">运营台 · 模拟数据</span>
          </span>
        </div>
      </header>

      <div className="q-merchant-layout">
        <aside className="q-rail" aria-label="运营工作区">
          <span className="q-rail-label">WORKSPACES <em>01—03</em></span>
          <nav className="q-rail-nav">
            {NAV.map((item, index) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const badge = counts[item.href] ?? 0;
              return (
                <Link key={item.href} href={item.href} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined}>
                  <span>0{index + 1}</span>
                  {item.label}
                  <b>{badge > 0 ? badge : "↗"}</b>
                </Link>
              );
            })}
          </nav>
          <div className="q-rail-bottom">
            <span className="q-status-dot" /> 演示业务环境
            <p>票档库存就是店面的实时可售数；改价、补货与活动都先生成待审批提案，应用时才写穿模拟库存。</p>
            <small>操作者：{OPERATOR_NAME} · 待审批 {pending} 项</small>
            <button
              type="button"
              className="q-text-button"
              onClick={() => {
                if (window.confirm("重新开始演示会清空锁座、候补、票夹、待审批台账与对话记录，确定继续？")) {
                  resetSession();
                }
              }}
            >
              重新开始演示
            </button>
          </div>
          <Link className="q-rail-link" href="/works/demos/qintai-ticketing">切换回观众侧 ↗</Link>
        </aside>

        <main className="q-main-panel">
          {children}
          <footer className="q-footer">
            <span>QINTAI TICKETING / 运营台</span>
            <span>经营数字、排期基线与订单问题均为本地生成的模拟数据；待审批台账只属于当前浏览器会话。</span>
          </footer>
        </main>
      </div>

      <ChatDrawer role="merchant" open={chatOpen} onClose={() => setDrawer("merchant", false)} />
      <button type="button" className={`q-chat-scrim${chatOpen ? " is-open" : ""}`} aria-label="收起对话" tabIndex={-1} onClick={() => setDrawer("merchant", false)} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cities } from "@/content/projects/demos/island-travel";
import { addDays, dateLabel, type Trip } from "@/lib/works/island-travel/domain";
import type { Conditions } from "@/lib/works/island-travel/schema";
import { travelRoot, useTravel } from "./TravelProvider";

export function IslandMark() {
  return <svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" /><path d="m9 28 10-15 7 10 4-5 6 10M9 32h27" /></svg>;
}
export function Arrow({ back = false }: { back?: boolean }) {
  return <svg className="travel-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={back ? { transform: "rotate(180deg)" } : undefined}><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function TravelShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const home = pathname === travelRoot;
  const { orders, productOrders, cancel, clearChatContext } = useTravel();
  const main = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    main.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [pathname]);
  return <div className={`island-app ${home ? "island-home" : "island-inner"}`} onClickCapture={event => {
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    const href = link?.getAttribute("href");
    if (href?.startsWith(travelRoot) && href !== pathname) cancel();
    if (href === travelRoot || href?.startsWith(`${travelRoot}/plan`)) clearChatContext();
  }}>
    <a className="skip" href="#island-main">跳至主要内容</a>
    <header className="site-header">
      <Link className="wordmark" href={travelRoot} aria-label="岛见首页"><IslandMark /><span>岛见<small>ISLAND CONCIERGE</small></span></Link>
      <nav aria-label="岛见导航"><Link href={`${travelRoot}/plan`} aria-current={pathname.endsWith("/plan") || pathname.includes("/products") ? "page" : undefined}>选择行程</Link><Link href={`${travelRoot}/journeys`} aria-current={pathname.includes("/journeys") ? "page" : undefined}>我的行程</Link><Link href={`${travelRoot}/orders`} aria-current={pathname.includes("/orders") ? "page" : undefined}>我的订单 <span className="nav-count">{String(orders.length + productOrders.length).padStart(2, "0")}</span></Link></nav>
      <Link className="collection-back" href="/works/demos" aria-label="返回行业 Demo 集">行业 Demo 集 <Arrow /></Link>
    </header>
    <main id="island-main" ref={main}>{children}</main>
    <footer className="container footer"><Link className="footer-brand" href={travelRoot}>岛见 <span>ISLAND CONCIERGE</span></Link><span>慢一点，世界会更近一点。</span><details><summary>关于这个 Demo</summary><p>岛见为虚构产品。城市名称真实，班次、票价、余票、乘车人、交易、乘车凭证及退票均为模拟。首页快查不调用模型；AI 仅理解需求，不决定金额与订单状态。无需填写真实住址或联系方式。真实 AI 每 IP 每10分钟最多10次。刷新清空全部体验数据。山林为 AI 生成的虚构景观，非实地摄影。</p></details></footer>
  </div>;
}
export function StepHeading({ eyebrow, title, description, step, back = "/plan", backLabel = "返回选择行程" }: { eyebrow: string; title: string; description: string; step?: number; back?: string; backLabel?: string }) {
  return <div className="step-heading">
    <div className="step-top"><Link className="back-link" href={`${travelRoot}${back}`}><Arrow back />{backLabel}</Link>{step && <ol className="travel-progress" aria-label="购票进度">{["选择行程", "核对行程", "模拟出票"].map((name, i) => <li key={name} aria-current={step === i + 1 ? "step" : undefined}><span>0{i + 1}</span>{name}</li>)}</ol>}</div>
    <p className="overline">{eyebrow}</p><h1 tabIndex={-1}>{title}</h1><p className="step-description">{description}</p>
  </div>;
}
export function QueryForm({ home = false }: { home?: boolean }) {
  const { conditions, today, query } = useTravel();
  // Remount only after an actual query/AI update, not on unrelated chat renders.
  return <QueryFields key={`${today}:${JSON.stringify(conditions)}`} conditions={conditions} today={today} onSubmit={query} home={home} />;
}
function QueryFields({ conditions, today, onSubmit, home }: { conditions: Conditions; today: string; onSubmit: (c: Conditions) => void; home: boolean }) {
  const [origin, setOrigin] = useState(conditions.origin ?? "海口");
  const [destination, setDestination] = useState(conditions.destination ?? "三亚");
  const [date, setDate] = useState(conditions.date ?? (today ? addDays(today, 1) : ""));
  const [period, setPeriod] = useState(conditions.time_preference ?? "上午");
  const [quantity, setQuantity] = useState(conditions.quantity ?? 1);
  const [error, setError] = useState("");
  return <section className={`search-shell ${home ? "container" : "search-shell--inner"}`} id="search" aria-labelledby="search-title">
    <div className="search-top"><h2 id="search-title">这一程，想去哪里？</h2><span>探索海南 · 单程出行</span></div>
    <form className="search-form" onSubmit={e => {
      e.preventDefault();
      if (origin === destination) { setError("出发地与目的地不能相同，请换一个目的地。"); return; }
      if (!today || !date || date < today || date > addDays(today, 6)) { setError("请选择从今天起未来7天内的出发日期。"); return; }
      setError(""); onSubmit({ origin, destination, date, time_preference: period, quantity });
    }}>
      <div className="field"><label htmlFor="travel-origin">出发地</label><select id="travel-origin" value={origin} onChange={e => setOrigin(e.target.value)}>{cities.map(city => <option key={city}>{city}</option>)}</select></div>
      <div className="field"><label htmlFor="travel-destination">目的地</label><select id="travel-destination" value={destination} aria-describedby={error ? "query-error" : undefined} aria-invalid={!!error && origin === destination} onChange={e => setDestination(e.target.value)}>{cities.map(city => <option key={city}>{city}</option>)}</select></div>
      <div className="field"><label htmlFor="travel-date">出发日期</label><select id="travel-date" value={date} onChange={e => setDate(e.target.value)} disabled={!today}>{today ? Array.from({ length: 7 }, (_, i) => { const day = addDays(today, i); return <option key={day} value={day}>{i === 0 ? "今天" : i === 1 ? "明天" : dateLabel(day)} · {day.slice(5).replace("-", "/")}</option>; }) : <option value="">加载日期</option>}</select></div>
      <div className="field"><label htmlFor="travel-period">时段</label><select id="travel-period" value={period} onChange={e => setPeriod(e.target.value as typeof period)}>{["不限", "上午", "下午", "晚上"].map(p => <option key={p}>{p}</option>)}</select></div>
      <div className="field"><label htmlFor="travel-guests">同行人数</label><select id="travel-guests" value={quantity} onChange={e => setQuantity(Number(e.target.value))}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} 位乘客</option>)}</select></div>
      <button className="button gold" type="submit" disabled={!today}>查找我的行程 <Arrow /></button>
    </form>
    {error && <p id="query-error" className="query-error" role="alert">{error}</p>}
    <p className="search-note">模拟班次即时查询 · 无需等待 AI · 不产生真实订单或扣款</p>
  </section>;
}
export function TripList({ trips, onSelect, selectedId }: { trips: Trip[]; onSelect: (trip: Trip) => void; selectedId?: string }) {
  return <div className="departure-options" aria-label="可售演示班次">{trips.map((trip, index) => <button type="button" key={trip.id} className={`departure-row ${selectedId === trip.id ? "departure-row--selected" : ""}`} aria-pressed={selectedId === undefined ? undefined : selectedId === trip.id} onClick={() => onSelect(trip)} aria-label={`选择第${index + 1}班 ${trip.depart} ${trip.origin}到${trip.destination}`}>
    <span className="radio-visual" aria-hidden="true">{selectedId === trip.id && <i />}</span><span className="row-number">0{index + 1}</span>
    <span className="time-block"><strong>{trip.depart}</strong><small>{trip.origin} · 出发</small></span>
    <span className="duration-block">{Math.floor(trip.minutes / 60)}h {trip.minutes % 60}m<span className="route-line" />城际客运</span>
    <span className="time-block"><strong>{trip.arrive}</strong><small>{trip.destination} · 抵达</small></span>
    <span className="price-block"><strong><small>¥</small>{trip.price}</strong><small>余 {trip.seats} 席</small></span>
  </button>)}</div>;
}
export function TripSummary({ trip, quantity, children }: { trip: Trip; quantity: number; children?: ReactNode }) {
  return <aside className="summary" aria-label="行程摘要"><div className="summary-top"><h2>你的下一程</h2><span>YOUR ITINERARY</span></div><p className="summary-date">{dateLabel(trip.date)} · 单程出行</p>
    <div className="station-line"><div><span className="station-dot" /><strong>{trip.origin}</strong><small>{trip.depart} · 出发</small></div><div><span className="station-dot end" /><strong>{trip.destination}</strong><small>{trip.arrive} · 抵达</small></div></div>
    <dl className="summary-details"><div><dt>路上时间</dt><dd>约 {Math.floor(trip.minutes / 60)} 小时 {trip.minutes % 60} 分</dd></div><div><dt>同行人数</dt><dd>{quantity} 位演示乘客</dd></div><div><dt>单人票价</dt><dd>¥{trip.price}</dd></div></dl>
    <div className="total-row" aria-live="polite" aria-atomic="true"><span>模拟合计</span><strong><small>¥</small>{trip.price * quantity}<em>.00</em></strong></div>{children}<p className="summary-disclaimer">只体验流程，不收取任何费用。</p>
  </aside>;
}
export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="travel-empty"><IslandMark /><h2>{title}</h2><p>{children}</p><Link className="button gold" href={`${travelRoot}/plan`}>重新规划行程 <Arrow /></Link></div>;
}

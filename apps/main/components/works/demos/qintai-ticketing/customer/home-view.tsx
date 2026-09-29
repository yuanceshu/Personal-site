"use client";

/** 观众侧首页：本周值得看、现场摘要、全部在售演出与最近的票。 */

import Link from "next/link";
import { useMemo } from "react";
import { useCustomerContext, useQintai } from "@/components/works/demos/qintai-ticketing/provider";
import {
  Empty,
  Pill,
  count,
  dateBlock,
  formatCountdown,
  money,
  useTicker,
} from "@/components/works/demos/qintai-ticketing/ui/parts";
import type { Product } from "@/lib/works/qintai-ticketing/types";

interface EventTile {
  key: string;
  name: string;
  date: string | undefined;
  venue: string | undefined;
  from: number;
  remaining: number;
  cheapest: Product | null;
  tiers: number;
}

/** 一个场次一张卡：最便宜的官方票档作为「起」，余量合计决定是否可候补。 */
function tilesOf(products: Product[]): EventTile[] {
  const byEvent = new Map<string, EventTile>();
  for (const product of products) {
    const attributes = product.attributes;
    if (product.category !== "tickets" || !attributes.event_name) continue;
    const key = `${attributes.event_name}|${attributes.event_date ?? ""}`;
    const tile =
      byEvent.get(key) ??
      {
        key,
        name: attributes.event_name,
        date: attributes.event_date,
        venue: attributes.venue,
        from: Number.POSITIVE_INFINITY,
        remaining: 0,
        cheapest: null,
        tiers: 0,
      };
    const remaining = Number(attributes.tickets_remaining ?? 0);
    tile.remaining += remaining;
    tile.tiers += 1;
    if (product.price < tile.from) {
      tile.from = product.price;
      tile.cheapest = product;
    }
    byEvent.set(key, tile);
  }
  return [...byEvent.values()].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}

export function CustomerHome() {
  const { storefront, session, askNow, revision } = useQintai();
  const now = useTicker(1000);

  const { official, tiles, wallet, waitlist, holds } = useMemo(() => {
    const official = Object.values(storefront.products)
      .filter((product) => product.category === "tickets")
      .map((product) => storefront.withLiveState(product));
    const wallet = storefront
      .getAccountContext(session)
      ?.wallet.upcoming_tickets ?? [];
    const waitlist = storefront.engine.waitlistEntriesFor(session.user_id);
    const holds = storefront.engine.holdsForSession(session.session_id);
    return { official, tiles: tilesOf(official), wallet, waitlist, holds };
    // revision 代表确定性状态被写过的次数，必须参与依赖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storefront, session, revision]);

  useCustomerContext("home", () => ({
    results: tiles
      .map((tile) => tile.cheapest)
      .filter((product): product is Product => product !== null)
      .slice(0, 12),
    // 首页的「最近一场」只是视觉推荐，不是用户当前选中的票档；否则 Agent 不可用时的
    // 确定性降级会把任何问题都误答成推荐场次。
    selected: null,
    disclosure: null,
    policies: storefront.searchPolicies(session, "锁座 候补 退票 转票").slice(0, 4),
  }));

  const featured = tiles[0];
  const held = holds.reduce((sum, hold) => sum + hold.quantity, 0);
  const soonest = holds.length > 0 ? Math.min(...holds.map((hold) => hold.expires_at)) : null;
  const fan = storefront.getPreferences(session).display_name ?? "观众";

  return (
    <div className="q-view q-view--home">
      <section className="q-hero">
        <div className="q-hero-copy">
          <p className="q-overline">武汉 · 现场指南 / {fan}</p>
          <h2>今晚，去看一场<br /><em>武汉的好戏。</em></h2>
          <p className="q-hero-lede">
            这里显示的都是含全部费用的价格。可以询问近期演出，也可以先把座位锁住再考虑——锁座
            8 分钟内不扣款。
            {held > 0 && soonest != null ? (
              <span className="q-hero-alert">
                {" "}已锁定 {held} 个座位，倒计时 {formatCountdown(Math.max(0, Math.round((soonest - now) / 1000)))}。
              </span>
            ) : null}
            {waitlist.length > 0 ? ` 你在候补队列中排第 ${waitlist[0].position} 位。` : ""}
          </p>
          <div className="q-hero-actions">
            <button
              type="button"
              className="q-primary-button"
              onClick={() => askNow("customer", "根据这些演出的时间和票价，帮我挑一场最值得看的，并说明理由。")}
            >
              帮我选一场 <span>↗</span>
            </button>
            <Link className="q-outline-button" href="/works/demos/qintai-ticketing/shows">浏览全部演出 <span>→</span></Link>
          </div>
          <p className="q-trust-line"><span>价格透明</span><i /> <span>库存诚实</span><i /> <span>先锁座再决定</span></p>
        </div>

        <div className="q-hero-feature">
          <div className="q-feature-top"><span>最近的一场</span><span className="q-feature-index">01 / {String(tiles.length).padStart(2, "0")}</span></div>
          {featured && featured.cheapest ? (
            <Link className="q-feature-body" href={`/works/demos/qintai-ticketing/shows/${featured.cheapest.product_id}`}>
              <span className="q-feature-date">
                {dateBlock(featured.date)?.mon} <b>{dateBlock(featured.date)?.day}</b>
              </span>
              <span className="q-feature-name">{featured.name}</span>
              <span className="q-feature-meta">
                {featured.venue} · {featured.remaining === 0 ? "已售罄，可加入候补" : "正在售票"}
              </span>
              <span className="q-feature-price">
                {money(featured.from, { whole: true })} <small>起 · 含全部费用</small>
              </span>
              <span className="q-feature-arrow">→</span>
            </Link>
          ) : (
            <Empty>正在载入武汉现场。</Empty>
          )}
          <span className="q-feature-mark" aria-hidden>W</span>
        </div>
      </section>

      <section className="q-section">
        <div className="q-section-heading">
          <div><p className="q-overline">正在发生</p><h2>武汉现场演出</h2></div>
          <span>全部为含费用总价</span>
        </div>
        <div className="q-event-grid">
          {tiles.map((tile, index) => (
            <Link
              className="q-event-card"
              key={tile.key}
              href={tile.cheapest ? `/works/demos/qintai-ticketing/shows/${tile.cheapest.product_id}` : "/works/demos/qintai-ticketing/shows"}
            >
              <span className="q-event-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="q-event-date">{dateBlock(tile.date)?.mon} <b>{dateBlock(tile.date)?.day}</b></span>
              <span className="q-event-title">{tile.name}</span>
              <span className="q-event-venue">{tile.venue}</span>
              <span className={`q-event-status${tile.remaining === 0 ? " is-out" : ""}`}>
                {tile.remaining === 0 ? "已售罄 · 可候补" : `余 ${count(tile.remaining)} 张 · ${tile.tiers} 个票档`}
              </span>
              <span className="q-event-price">{money(tile.from, { whole: true })}<small> 起</small></span>
              <span className="q-event-arrow">↗</span>
            </Link>
          ))}
        </div>
      </section>

      {wallet.length > 0 ? (
        <section className="q-section">
          <div className="q-section-heading">
            <div><p className="q-overline">你的现场</p><h2>票夹里最近的票</h2></div>
            <Link href="/works/demos/qintai-ticketing/wallet">查看全部票券 →</Link>
          </div>
          <div className="q-wallet-grid">
            {wallet.slice(0, 3).map((ticket) => (
              <div className="q-wallet-card" key={ticket.ticket_id}>
                <span className="q-wallet-date">
                  {dateBlock(ticket.date)?.mon} <b>{dateBlock(ticket.date)?.day}</b>
                </span>
                <span className="q-wallet-copy">
                  <strong>{ticket.event}</strong>
                  <small>{[ticket.tier, ticket.seat].filter(Boolean).join(" · ")}</small>
                </span>
                <Pill tone={ticket.status === "transfer_pending" ? "warn" : "ok"}>
                  {ticket.status === "transfer_pending" ? "转票处理中" : "已出票"}
                </Pill>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="q-section q-section--note">
        <div className="q-note">
          <span>DEMO / 武汉场景</span>
          <p>
            演出名称、场馆与公开票价来自公开资料；库存、锁座、候补、退票与费用拆分都是本地模拟数据，
            不代表实时票务库存，也不产生真实交易。
          </p>
        </div>
        <div className="q-note-stats">
          <div><strong>{official.length}</strong><span>官方票档</span></div>
          <div><strong>{tiles.length}</strong><span>场次</span></div>
          <div><strong>{formatCountdown(Math.round(8 * 60))}</strong><span>锁座时长（分:秒）</span></div>
          <div><strong>10:00</strong><span>回流领取窗</span></div>
        </div>
      </section>
    </div>
  );
}

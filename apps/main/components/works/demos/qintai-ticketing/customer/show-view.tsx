"use client";

/** 观众侧演出详情：票档对比、座位示意、逐项费用、限时锁座与候补。 */

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  explainOperation,
  useCustomerContext,
  useQintai,
} from "@/components/works/demos/qintai-ticketing/provider";
import {
  Empty,
  Pill,
  chineseDate,
  count,
  dateBlock,
  formatCountdown,
  money,
  useTicker,
} from "@/components/works/demos/qintai-ticketing/ui/parts";
import { SELLING_FAST_FLOOR } from "@/lib/works/qintai-ticketing/engine/catalog";
import { MAX_TICKETS_PER_EVENT } from "@/lib/works/qintai-ticketing/engine/ticketing";
import type { Venue } from "@/lib/works/qintai-ticketing/types";

const TIER_TONES = ["is-tier-1", "is-tier-2", "is-tier-3", "is-tier-4"];

function VenuePlan({ venue, activeTierCode, tiers }: { venue: Venue; activeTierCode: string | null; tiers: Array<{ product_id: string; tier_code: string; price: number }> }) {
  const ordered = [...tiers].sort((a, b) => b.price - a.price);
  const toneOf = new Map(ordered.map((tier, index) => [tier.tier_code, TIER_TONES[index % TIER_TONES.length]]));
  return (
    <div className="q-plan">
      <svg viewBox={`0 0 ${venue.viewbox.width} ${venue.viewbox.height}`} role="img" aria-label={`${venue.name} 座位示意`}>
        <rect className="q-plan-stage" x={venue.viewbox.width / 2 - 22} y={venue.viewbox.height - 8} width={44} height={6} rx={1} />
        <text className="q-plan-stage-label" x={venue.viewbox.width / 2} y={venue.viewbox.height - 0.6} textAnchor="middle">舞台</text>
        {venue.sections.map((section) => (
          <g key={section.section_id}>
            <rect
              className={`q-plan-section ${toneOf.get(section.tier_code ?? "") ?? ""}${activeTierCode === section.tier_code ? " is-active" : ""}`}
              x={section.x}
              y={section.y}
              width={section.w}
              height={section.h}
              rx={1.2}
            />
            <text className="q-plan-label" x={section.x + section.w / 2} y={section.y + section.h / 2 + 1.4} textAnchor="middle">
              {section.short_label ?? section.label}
            </text>
          </g>
        ))}
      </svg>
      <ul className="q-plan-legend">
        {ordered.map((tier) => (
          <li key={tier.product_id}>
            <i className={toneOf.get(tier.tier_code)} aria-hidden />
            {tier.tier_code} · {money(tier.price, { whole: true })}
          </li>
        ))}
      </ul>
      {venue.demo_note ? <p className="q-plan-note">{venue.demo_note}</p> : null}
    </div>
  );
}

export function CustomerShowDetail({ productId }: { productId: string }) {
  const { storefront, dataset, session, commit, askNow, revision } = useQintai();
  const now = useTicker(1000);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const product = storefront.getLiveProduct(productId);

  const peerTiers = useMemo(() => {
    if (!product) return [];
    const { event_name, event_date } = product.attributes;
    return Object.values(storefront.products)
      .filter(
        (candidate) =>
          candidate.attributes.event_name === event_name &&
          candidate.attributes.event_date === event_date,
      )
      .map((candidate) => storefront.withLiveState(candidate))
      .sort((a, b) => a.price - b.price);
    // revision 参与依赖：余量与价格都可能被写穿。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, storefront, revision]);

  const disclosure = useMemo(
    () => (product ? storefront.getDisclosure(session, product.product_id) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product, storefront, session, revision],
  );

  useCustomerContext("show", () => ({
    results: peerTiers,
    selected: product,
    disclosure,
    policies: storefront.searchPolicies(session, "锁座 候补 退票 转票 电子票").slice(0, 5),
  }));

  if (!product) {
    return (
      <div className="q-view">
        <Empty>
          没找到票档 {productId}。<Link href="/works/demos/qintai-ticketing/shows">返回演出列表 →</Link>
        </Empty>
      </div>
    );
  }

  const attributes = product.attributes;
  const remaining = storefront.engine.remaining(product.product_id);
  const capacity = storefront.engine.capacity(product.product_id);
  const sold = storefront.engine.sold(product.product_id);
  const soldOut = remaining === 0;
  const scarce = !soldOut && remaining <= Math.max(SELLING_FAST_FLOOR, Math.floor(capacity / 50));
  const isResale = product.category === "resale";
  const venue = dataset.venues[attributes.venue_id];
  const venueSections = peerTiers
    .map((tier) => ({ product_id: tier.product_id, tier_code: tier.attributes.tier_code, price: tier.price }))
    .filter((tier) => Boolean(tier.tier_code));
  const hold = storefront.engine
    .holdsForSession(session.session_id)
    .find((candidate) => candidate.product_id === product.product_id);
  const seconds = hold ? Math.max(0, Math.round((hold.expires_at - now) / 1000)) : null;
  const waitlist = storefront.engine
    .waitlistEntriesFor(session.user_id)
    .find((entry) => entry.entry.product_id === product.product_id);
  const block = dateBlock(attributes.event_date);
  const maxQuantity = Math.min(MAX_TICKETS_PER_EVENT, soldOut ? 0 : remaining);

  const guard = (work: () => void, okText: string) => {
    try {
      commit(work);
      setNotice({ ok: true, text: okText });
    } catch (error) {
      setNotice({ ok: false, text: explainOperation(error) });
    }
  };

  return (
    <div className="q-view q-view--detail">
      <nav className="q-breadcrumb">
        <Link href="/works/demos/qintai-ticketing">首页</Link>
        <span>/</span>
        <Link href="/works/demos/qintai-ticketing/shows">演出</Link>
        <span>/</span>
        <span>{attributes.event_name}</span>
      </nav>

      <header className="q-detail-head">
        <div className="q-detail-title">
          <p className="q-overline">{[attributes.venue, chineseDate(attributes.event_date), attributes.event_time].filter(Boolean).join(" · ")}</p>
          <h2>{attributes.event_name}</h2>
          <p className="q-detail-sub">
            {attributes.tier} · 票档编号 <span className="q-mono">{product.product_id}</span>
          </p>
          <p className="q-detail-badges">
            <Pill tone={soldOut ? "danger" : scarce ? "warn" : "ok"}>
              {soldOut ? "已售罄 · 可候补" : scarce ? `售票较快 · 余 ${count(remaining)}` : "正在售票"}
            </Pill>
            {isResale ? <Pill tone="accent">观众转票 · 可加价转让</Pill> : <Pill tone="muted">官方票档</Pill>}
            {attributes.admission === "general" ? <Pill tone="muted">站票区</Pill> : null}
          </p>
        </div>
        <div className="q-detail-date">
          <span>{block?.mon}</span>
          <b>{block?.day}</b>
          <small>{block?.dow}</small>
        </div>
      </header>

      <div className="q-detail-grid">
        <div className="q-detail-main">
          <section className="q-panel">
            <header className="q-panel-head">
              <div><h2>余量与锁座</h2><p>容量 {count(capacity)} · 已售 {count(sold)} · 余 {count(remaining)}</p></div>
              {hold && seconds != null ? (
                <div className="q-panel-action">
                  <span className={`q-hold-chip${seconds <= 60 ? " is-urgent" : ""}`}>
                    已锁 {hold.quantity} 张 · {formatCountdown(seconds)}
                  </span>
                </div>
              ) : null}
            </header>
            <div className="q-panel-body">
              {hold ? (
                <div className="q-hold-actions">
                  <label>
                    <span>调整锁定张数</span>
                    <input
                      type="number"
                      min={1}
                      max={MAX_TICKETS_PER_EVENT}
                      value={hold.quantity}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (!Number.isFinite(next) || next < 1) return;
                        guard(
                          () => storefront.updateCartItem(session, product.product_id, next),
                          `锁定张数已改为 ${next} 张。`,
                        );
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="q-outline-button"
                    onClick={() => guard(() => storefront.removeFromCart(session, product.product_id), "已释放这批座位，座位回到模拟库存。")}
                  >
                    释放锁座
                  </button>
                  <Link className="q-primary-button" href="/works/demos/qintai-ticketing/wallet">去票夹看倒计时 →</Link>
                </div>
              ) : soldOut ? (
                <div className="q-soldout">
                  <p>该票档当前已售罄。加入候补后，有人退票时座位会按 FIFO 顺序回流给你，并给你 10 分钟领取窗口。</p>
                  <div className="q-hold-actions">
                    <label>
                      <span>候补张数</span>
                      <input
                        type="number"
                        min={1}
                        max={MAX_TICKETS_PER_EVENT}
                        value={quantity}
                        onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                      />
                    </label>
                    <button
                      type="button"
                      className="q-primary-button"
                      onClick={() => {
                        try {
                          let position = 0;
                          commit(() => {
                            position = storefront.engine.joinWaitlist(
                              session.user_id,
                              session.session_id,
                              product.product_id,
                              Math.min(quantity, MAX_TICKETS_PER_EVENT),
                            );
                          });
                          setNotice({ ok: true, text: `已加入候补，当前排在第 ${position} 位。座位回流时会给你 10 分钟领取窗口。` });
                        } catch (error) {
                          setNotice({ ok: false, text: explainOperation(error) });
                        }
                      }}
                    >
                      加入候补
                    </button>
                    {waitlist ? <span className="q-inline-note">你已在队列中，位置 #{waitlist.position} × {waitlist.entry.quantity}</span> : null}
                  </div>
                </div>
              ) : (
                <div className="q-hold-actions">
                  <label>
                    <span>锁座张数（同一场次最多 {MAX_TICKETS_PER_EVENT} 张）</span>
                    <input
                      type="number"
                      min={1}
                      max={maxQuantity}
                      value={Math.min(quantity, Math.max(1, maxQuantity))}
                      onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                    />
                  </label>
                  <button
                    type="button"
                    className="q-primary-button"
                    onClick={() =>
                      guard(
                        () =>
                          storefront.addToCart(
                            session,
                            product.product_id,
                            Math.min(quantity, maxQuantity, MAX_TICKETS_PER_EVENT),
                          ),
                        `已锁座 ${Math.min(quantity, maxQuantity, MAX_TICKETS_PER_EVENT)} 张。锁座 8 分钟内不扣款，超时座位自动回到模拟库存。`,
                      )
                    }
                  >
                    锁座 · {money(product.price * Math.min(quantity, maxQuantity, MAX_TICKETS_PER_EVENT))}
                  </button>
                  <span className="q-inline-note">
                    还剩 {count(remaining)} 张；这一档剩余 {Math.max(0, Math.round((remaining / Math.max(1, capacity)) * 1000) / 10)}%
                  </span>
                </div>
              )}
              {notice ? (
                <p className={notice.ok ? "q-inline-ok" : "q-inline-error"} role="status">{notice.text}</p>
              ) : null}
            </div>
          </section>

          <section className="q-panel">
            <header className="q-panel-head">
              <div><h2>这一场的全部票档</h2><p>按含全部费用从低到高 · 点击切换比较</p></div>
              <div className="q-panel-action">
                <button type="button" className="q-ghost-button" onClick={() => askNow("customer", `请比较 ${attributes.event_name} ${chineseDate(attributes.event_date)} 这几个票档：${peerTiers.map((tier) => tier.product_id).join("、")}`)}>
                  让助手比价 <em>AI</em>
                </button>
              </div>
            </header>
            <div className="q-panel-body">
              <ul className="q-tier-list">
                {peerTiers.map((tier) => {
                  const tierRemaining = storefront.engine.remaining(tier.product_id);
                  const active = tier.product_id === product.product_id;
                  return (
                    <li key={tier.product_id} className={active ? "is-active" : ""}>
                      <Link href={`/works/demos/qintai-ticketing/shows/${tier.product_id}`}>
                        <span className="q-tier-name">
                          {tier.attributes.tier}
                          {tier.category === "resale" ? <em>转票</em> : null}
                        </span>
                        <span className="q-tier-remaining">
                          {tierRemaining === 0 ? "已售罄" : `余 ${count(tierRemaining)}`}
                        </span>
                        <strong>{money(tier.price)}</strong>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section className="q-panel">
            <header className="q-panel-head">
              <div><h2>{disclosure?.title ?? "价格和购票规则"}</h2><p>结算前一次性展示，之后不再加收费用</p></div>
            </header>
            <div className="q-panel-body">
              {disclosure ? (
                <>
                  <dl className="q-fee-list">
                    {disclosure.rows.map((row) => (
                      <div key={`${row.label}-${row.value}`} className="q-fee-row">
                        <dt>
                          {row.label}
                          {row.note ? <small>{row.note}</small> : null}
                        </dt>
                        <dd>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <ul className="q-fee-footnotes">
                    {disclosure.footnotes.map((note) => <li key={note}>{note}</li>)}
                  </ul>
                  <p className="q-fee-sources">
                    来源：{disclosure.sources.map((source) => <span className="q-mono" key={source}>{source}</span>)}
                  </p>
                </>
              ) : (
                <Empty>这一档没有可披露的费用行。</Empty>
              )}
            </div>
          </section>

          <section className="q-panel">
            <header className="q-panel-head"><div><h2>演出说明</h2><p>{product.short_description}</p></div></header>
            <div className="q-panel-body">
              <p className="q-long">{product.long_description}</p>
              <dl className="q-spec-list">
                {Object.entries(product.specs).map(([key, value]) => (
                  <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
                ))}
              </dl>
              {product.review_highlights.length > 0 ? (
                <ul className="q-review-list">
                  {product.review_highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
                </ul>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="q-detail-side">
          {venue ? (
            <section className="q-panel q-panel--well">
              <header className="q-panel-head"><div><h2>座位示意</h2><p>{venue.name} · Demo 示意图，不是实时选座</p></div></header>
              <div className="q-panel-body">
                <VenuePlan venue={venue} activeTierCode={attributes.tier_code ?? null} tiers={venueSections} />
              </div>
            </section>
          ) : null}
          <section className="q-panel q-panel--well">
            <header className="q-panel-head"><div><h2>购买前该知道的</h2><p>规则来自本演示的购票制度</p></div></header>
            <div className="q-panel-body">
              <ol className="q-rule-list">
                <li>锁座 8 分钟，超时后座位回到模拟库存；结算前不扣款。</li>
                <li>同一场演出每单最多 {MAX_TICKETS_PER_EVENT} 张。</li>
                <li>售罄票档可以候补，回流时按 FIFO 顺序给你 10 分钟领取窗口。</li>
                <li>已出票可以发起转赠，接收人确认前可以撤回。</li>
                <li>电子票使用旋转条码，每 60 秒刷新一次。</li>
              </ol>
              <button
                type="button"
                className="q-ghost-button q-ghost-button--full"
                onClick={() => askNow("customer", `${product.product_id} 的锁座、候补与退票规则分别是什么？`)}
              >
                让助手解释规则 <em>AI</em>
              </button>
            </div>
          </section>
        </aside>
      </div>

      <p className="q-disclaimer">
        该票档的余量、锁座与费用拆分都在本页面按确定性规则计算；助手只读取这些数字，不会替你锁座或下单。
      </p>
    </div>
  );
}

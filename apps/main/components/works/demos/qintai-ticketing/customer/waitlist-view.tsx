"use client";

/** 观众侧候补与回流：FIFO 位次、回流领取窗口与领取后转成锁座。 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { explainOperation, useCustomerContext, useQintai } from "@/components/works/demos/qintai-ticketing/provider";
import {
  Empty,
  Pill,
  chineseDate,
  count,
  formatCountdown,
  money,
  useTicker,
} from "@/components/works/demos/qintai-ticketing/ui/parts";

export function CustomerWaitlist() {
  const { storefront, session, commit, askNow, revision } = useQintai();
  const now = useTicker(1000);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const { entries, offers } = useMemo(() => {
    return {
      entries: storefront.engine.waitlistEntriesFor(session.user_id),
      offers: storefront.engine
        .offersFor(session.user_id)
        .filter((offer) => offer.status === "open"),
    };
    // revision 参与依赖：候补位次与回流单都会随引擎写入变化。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storefront, session, revision]);

  useCustomerContext("waitlist", () => ({
    results: [],
    selected: null,
    disclosure: null,
    policies: storefront.searchPolicies(session, "候补 回流 领取窗口 退票").slice(0, 5),
  }));

  const soldOut = useMemo(
    () =>
      Object.values(storefront.products)
        .filter((product) => storefront.engine.remaining(product.product_id) === 0)
        .map((product) => storefront.withLiveState(product)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storefront, revision],
  );

  const guard = (work: () => void, okText: string) => {
    try {
      commit(work);
      setNotice({ ok: true, text: okText });
    } catch (error) {
      setNotice({ ok: false, text: explainOperation(error) });
    }
  };

  return (
    <div className="q-view q-view--waitlist">
      <section className="q-section">
        <div className="q-section-heading">
          <div><p className="q-overline">回流票</p><h2>待领取窗口</h2></div>
          <span>座位回流到你时才开始倒计时，窗口 10 分钟</span>
        </div>
        {offers.length === 0 ? (
          <Empty>
            现在没有待领取的回流票。当有人退票、且队列轮到你时，这里会出现一个 10 分钟的领取窗口。
          </Empty>
        ) : (
          <ul className="q-offer-list">
            {offers.map((offer) => {
              const product = storefront.getLiveProduct(offer.product_id);
              const seconds = Math.max(0, Math.round((offer.expires_at - now) / 1000));
              return (
                <li key={offer.offer_id} className={seconds <= 120 ? "is-urgent" : ""}>
                  <span className="q-offer-ring" aria-hidden>
                    <svg viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" className="q-ring-track" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        className="q-ring-value"
                        strokeDasharray={`${Math.max(6, (seconds / 600) * 94.2)} 94.2`}
                      />
                    </svg>
                    <b>{formatCountdown(seconds)}</b>
                  </span>
                  <span className="q-offer-copy">
                    <strong>{product?.attributes.event_name ?? offer.product_id}</strong>
                    <small>
                      {[product?.attributes.tier, chineseDate(product?.attributes.event_date), `${count(offer.quantity)} 张`]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  <span className="q-offer-amount">{product ? money(product.price * offer.quantity) : "—"}</span>
                  <button
                    type="button"
                    className="q-primary-button"
                    onClick={() =>
                      guard(
                        () => storefront.engine.claimOffer(offer.offer_id, session.user_id, session.session_id),
                        "已领取。座位进入你的锁座倒计时，结算前不扣款。",
                      )
                    }
                  >
                    立即领取
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="q-section">
        <div className="q-section-heading">
          <div><p className="q-overline">候补队列</p><h2>你在排的队</h2></div>
          <span>同一票档按入队先后（FIFO）顺序前进</span>
        </div>
        {entries.length === 0 ? (
          <Empty>
            你还没有加入任何候补。售罄的票档在演出详情页可以加入候补；这里会显示位次，队列前进时无需操作。
          </Empty>
        ) : (
          <ul className="q-waitlist-list">
            {entries.map(({ entry, position }) => {
              const product = storefront.getLiveProduct(entry.product_id);
              return (
                <li key={`${entry.product_id}-${entry.joined_at}`}>
                  <span className="q-waitlist-ring" aria-hidden>
                    <svg viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" className="q-ring-track" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        className="q-ring-value"
                        strokeDasharray={`${Math.max(6, (1 / Math.max(1, position)) * 94.2)} 94.2`}
                      />
                    </svg>
                    <b>#{position}</b>
                  </span>
                  <span className="q-waitlist-copy">
                    <strong>{product?.attributes.event_name ?? entry.product_id}</strong>
                    <small>
                      {[product?.attributes.tier, product?.attributes.venue, `${count(entry.quantity)} 张`]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  {entry.simulated ? <Pill tone="muted">演示候补观众</Pill> : <Pill tone="accent">你</Pill>}
                  <span className="q-waitlist-hint">队列会自动前进；座位回流到你时页面顶部出现领取窗口。</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="q-section">
        <div className="q-section-heading">
          <div><p className="q-overline">已售罄</p><h2>可以加入候补的票档</h2></div>
          <span>余量为 0 的官方票档</span>
        </div>
        {soldOut.length === 0 ? (
          <Empty>当前没有售罄的官方票档。</Empty>
        ) : (
          <ul className="q-result-list q-result-list--compact">
            {soldOut.map((product) => (
              <li className="q-result" key={product.product_id}>
                <div className="q-result-main">
                  <h3>{product.attributes.event_name}</h3>
                  <p className="q-result-meta">
                    {[product.attributes.tier, product.attributes.venue, chineseDate(product.attributes.event_date)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="q-result-side">
                  <strong className="q-result-price">{money(product.price)}</strong>
                  <small>含全部费用</small>
                  <Link className="q-outline-button q-outline-button--small" href={`/works/demos/qintai-ticketing/shows/${product.product_id}`}>
                    去加入候补
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="q-ghost-button"
          onClick={() => askNow("customer", "候补和回流票是怎么运作的？我加入候补后要做什么？")}
        >
          让助手解释候补规则 <em>AI</em>
        </button>
      </section>

      {notice ? (
        <p className={notice.ok ? "q-inline-ok" : "q-inline-error"} role="status">{notice.text}</p>
      ) : null}

      <p className="q-disclaimer">
        队列前进、回流领取窗口与锁座倒计时都由页面上的确定性状态机执行；助手只负责解释规则，不会替你排队或领票。
      </p>
    </div>
  );
}

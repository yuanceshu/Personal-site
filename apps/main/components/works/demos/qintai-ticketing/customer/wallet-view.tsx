"use client";

/** 观众侧票夹：锁座倒计时、旋转条码电子票、转赠与订单。 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { explainOperation, useCustomerContext, useQintai } from "@/components/works/demos/qintai-ticketing/provider";
import {
  Empty,
  Pill,
  chineseDate,
  count,
  formatCountdown,
  hoursRemaining,
  money,
  useTicker,
} from "@/components/works/demos/qintai-ticketing/ui/parts";

/** 把条码串画成一段条纹；同一秒内稳定，条码本身每 60 秒换一次。 */
function Barcode({ code }: { code: string }) {
  const bars = useMemo(() => {
    const cells = code.replace(/[^0-9a-f]/gi, "").slice(0, 32).split("");
    return cells.map((cell, index) => {
      const value = Number.parseInt(cell, 16);
      return { index, width: 1 + (value % 3), dark: value % 2 === 0 };
    });
  }, [code]);
  return (
    <span className="q-barcode" aria-label={`电子票条码 ${code}`}>
      <span className="q-barcode-bars">
        {bars.map((bar) => (
          <i key={bar.index} style={{ width: `${bar.width}px` }} className={bar.dark ? "" : "is-gap"} />
        ))}
      </span>
      <span className="q-mono q-barcode-code">{code}</span>
    </span>
  );
}

export function CustomerWallet() {
  const { storefront, session, commit, askNow, revision } = useQintai();
  const now = useTicker(1000);
  const [recipient, setRecipient] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const { wallet, orders, transfers, holds, waitlist } = useMemo(() => {
    const account = storefront.getAccountContext(session);
    return {
      wallet: account?.wallet.upcoming_tickets ?? [],
      orders: storefront.getOrders(session, 4),
      transfers: storefront.engine.pendingTransfersFor(session.user_id),
      holds: storefront.engine.holdsForSession(session.session_id),
      waitlist: storefront.engine.waitlistEntriesFor(session.user_id),
    };
    // revision 参与依赖：锁座、转赠与票夹都会被写穿。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storefront, session, revision]);

  useCustomerContext("wallet", () => ({
    results: [],
    selected: null,
    disclosure: null,
    policies: storefront.searchPolicies(session, "转票 转赠 退票 电子票 条码").slice(0, 5),
  }));

  const groups = useMemo(() => {
    const byEvent = new Map<string, typeof wallet>();
    for (const ticket of wallet) {
      const key = `${ticket.event}|${ticket.date ?? ""}`;
      byEvent.set(key, [...(byEvent.get(key) ?? []), ticket]);
    }
    return [...byEvent.entries()];
  }, [wallet]);

  const guard = (work: () => void, okText: string) => {
    try {
      commit(work);
      setNotice({ ok: true, text: okText });
    } catch (error) {
      setNotice({ ok: false, text: explainOperation(error) });
    }
  };

  return (
    <div className="q-view q-view--wallet">
      <section className="q-section">
        <div className="q-section-heading">
          <div><p className="q-overline">本次观演</p><h2>锁座中 {count(holds.length)} 档</h2></div>
          <span>锁座 8 分钟内不扣款；超时后座位回到模拟库存</span>
        </div>
        {holds.length === 0 ? (
          <Empty>现在没有锁定的座位。<Link href="/works/demos/qintai-ticketing/shows">去找一场演出 →</Link></Empty>
        ) : (
          <ul className="q-hold-list">
            {holds.map((hold) => {
              const product = storefront.getLiveProduct(hold.product_id);
              const seconds = Math.max(0, Math.round((hold.expires_at - now) / 1000));
              return (
                <li key={hold.hold_id} className={seconds <= 60 ? "is-urgent" : ""}>
                  <span className="q-hold-time">{formatCountdown(seconds)}</span>
                  <span className="q-hold-copy">
                    <strong>{product?.attributes.event_name ?? hold.product_id}</strong>
                    <small>
                      {[product?.attributes.tier, product?.attributes.venue, chineseDate(product?.attributes.event_date)]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  <span className="q-hold-qty">× {hold.quantity}</span>
                  <span className="q-hold-amount">
                    {product ? money(product.price * hold.quantity) : "—"}
                  </span>
                  <span className="q-hold-actions">
                    <button
                      type="button"
                      className="q-text-button"
                      onClick={() => guard(() => storefront.removeFromCart(session, hold.product_id), "已释放这批座位。")}
                    >
                      释放
                    </button>
                    {product ? (
                      <Link className="q-text-button" href={`/works/demos/qintai-ticketing/shows/${product.product_id}`}>
                        改张数 ↗
                      </Link>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="q-section">
        <div className="q-section-heading">
          <div><p className="q-overline">我的票券</p><h2>票夹</h2></div>
          <span>{count(wallet.length)} 张票 · {count(groups.length)} 场演出{waitlist.length > 0 ? ` · 候补 ${count(waitlist.length)} 档` : ""}</span>
        </div>
        {groups.length === 0 ? (
          <Empty>票夹是空的。这个演示的票夹与订单都挂在观众 demo-user 上，锁座后再回来看看。</Empty>
        ) : (
          <div className="q-pass-groups">
            {groups.map(([key, passes]) => {
              const first = passes[0];
              return (
                <section className="q-panel" key={key}>
                  <header className="q-panel-head">
                    <div>
                      <h2>{first.event}</h2>
                      <p>{[chineseDate(first.date), `${count(passes.length)} 张票`].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="q-panel-action">
                      <button
                        type="button"
                        className="q-ghost-button"
                        onClick={() => askNow("customer", `我想转赠 ${first.event}（${chineseDate(first.date)}）的票，需要注意什么？`)}
                      >
                        问助手 <em>AI</em>
                      </button>
                    </div>
                  </header>
                  <div className="q-panel-body">
                    <div className="q-pass-grid">
                      {passes.map((pass) => {
                        const pending = pass.status === "transfer_pending";
                        return (
                          <article className={`q-pass${pending ? " is-pending" : ""}`} key={pass.ticket_id}>
                            <header>
                              <span className="q-mono">{pass.ticket_id}</span>
                              <Pill tone={pending ? "warn" : "ok"}>{pending ? "转票处理中" : "有效"}</Pill>
                            </header>
                            <p className="q-pass-tier">{pass.tier ?? "票档待定"}</p>
                            <p className="q-pass-seat">{pass.seat}</p>
                            <Barcode code={storefront.engine.barcode(pass.ticket_id)} />
                            <label className="q-pass-pick">
                              <input
                                type="checkbox"
                                checked={selected.includes(pass.ticket_id)}
                                disabled={pending}
                                onChange={(event) =>
                                  setSelected((previous) =>
                                    event.target.checked
                                      ? [...previous, pass.ticket_id]
                                      : previous.filter((id) => id !== pass.ticket_id),
                                  )
                                }
                              />
                              选入转赠
                            </label>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>

      <section className="q-section">
        <div className="q-section-heading">
          <div><p className="q-overline">转赠</p><h2>发起与撤回</h2></div>
          <span>接收人确认前可以随时撤回，票会回到你的票夹</span>
        </div>
        <div className="q-transfer-form">
          <label>
            <span>接收人（手机号或邮箱，仅记录在本地演示）</span>
            <input
              type="text"
              value={recipient}
              placeholder="例如 138****0000"
              onChange={(event) => setRecipient(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="q-primary-button"
            disabled={selected.length === 0 || recipient.trim().length === 0}
            onClick={() =>
              guard(() => {
                storefront.engine.initiateTransfer(session.user_id, selected, recipient.trim());
                setSelected([]);
                setRecipient("");
              }, "转赠已发起，票进入「处理中」状态。")
            }
          >
            对已选的 {selected.length} 张发起转赠
          </button>
        </div>
        {transfers.length > 0 ? (
          <ul className="q-transfer-list">
            {transfers.map((transfer) => (
              <li key={transfer.transfer_id}>
                <span className="q-mono">{transfer.transfer_id}</span>
                <span>{transfer.ticket_ids.join("、")}</span>
                <span>接收人 {transfer.recipient}</span>
                <Pill tone="warn">处理中</Pill>
                <button
                  type="button"
                  className="q-text-button"
                  onClick={() =>
                    guard(() => storefront.engine.cancelTransfer(session.user_id, transfer.transfer_id), "转赠已撤回。")
                  }
                >
                  撤回
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="q-section">
        <div className="q-section-heading">
          <div><p className="q-overline">订单</p><h2>最近订单</h2></div>
          <span>模拟订单，不会产生真实付款</span>
        </div>
        <ul className="q-order-list">
          {orders.map((order) => (
            <li key={order.order_id}>
              <span className="q-mono">{order.order_id}</span>
              <span className="q-order-items">
                {order.items.map((item) => `${item.title} × ${item.quantity}`).join("；")}
              </span>
              <span className="q-order-date">{chineseDate(order.placed_at)}</span>
              <Pill tone="ok">{order.status === "delivered" ? "已入票夹" : order.status}</Pill>
              <strong>{money(order.total)}</strong>
            </li>
          ))}
        </ul>
      </section>

      {notice ? (
        <p className={notice.ok ? "q-inline-ok" : "q-inline-error"} role="status">{notice.text}</p>
      ) : null}

      <p className="q-disclaimer">
        条码每 60 秒换一次，由票号与当前时间窗做哈希得到；转赠是可逆转的，撤回后票立刻回到票夹。
        这些规则都由页面上的确定性引擎执行，助手只做解释。当前最近一张锁座还有 {hoursRemaining(holds.length > 0 ? Math.round((Math.min(...holds.map((hold) => hold.expires_at)) - now) / 1000) : 0)}。
      </p>
    </div>
  );
}

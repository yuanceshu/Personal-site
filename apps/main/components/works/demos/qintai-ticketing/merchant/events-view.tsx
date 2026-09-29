"use client";

/** 运营台「演出与定价」：按场次看每个票档的实时进度，并把改价/补货/活动暂存成待审批提案。 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { explainOperation, useMerchantContext, useQintai } from "@/components/works/demos/qintai-ticketing/provider";
import {
  Empty,
  Panel,
  Pill,
  PacingCurve,
  ProgressBar,
  Sparkline,
  chineseDate,
  count,
  dayMonth,
  daysToEvent,
  money,
  pacePts,
  pct,
} from "@/components/works/demos/qintai-ticketing/ui/parts";
import { todayIso } from "@/lib/works/qintai-ticketing/engine/fixtures";

type DraftKind = "price" | "restock" | "promotion";

const UNDER_PACE_PTS = -15;
const ACTION_LABEL: Record<DraftKind, string> = { price: "改价", restock: "释放库存", promotion: "做活动" };

export function MerchantEvents() {
  const { merchant, merchantSession, commit, askNow, revision } = useQintai();
  const [open, setOpen] = useState<{ listingId: string; kind: DraftKind } | null>(null);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const rows = useMemo(
    () => merchant.eventPacingRows(merchant.eventIds()) as Array<Record<string, unknown>>,
    // revision 参与依赖：应用变更会改变容量与价格。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [merchant, revision],
  );

  useMerchantContext("events", () => ({
    limit: 16,
    pacingProductIds: merchant.portfolioIds(),
  }));

  const stage = (listingId: string, kind: DraftKind) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      setNotice({ ok: false, text: "请填写一个数字。" });
      return;
    }
    try {
      const change = commit(() => {
        if (kind === "price") {
          return merchant.stagePriceUpdate(merchantSession, [{ listing_id: listingId, new_price: parsed }], note || null);
        }
        if (kind === "restock") {
          return merchant.stageInventoryAction(
            merchantSession,
            [{ listing_id: listingId, action: "restock", quantity: Math.trunc(parsed) }],
            note || null,
          );
        }
        const pricing = merchant.getPricingContext(listingId);
        return merchant.stagePromotion(merchantSession, {
          name: note || `${listingId} 活动`,
          listing_ids: [listingId],
          discount_pct: parsed,
          starts: todayIso(Date.now()),
          ends: pricing?.event_date ?? todayIso(Date.now() + 7 * 86_400_000),
          nights: null,
        });
      });
      setNotice({ ok: true, text: `${ACTION_LABEL[kind]}已暂存为 ${change.change_id}，等待审批。` });
      setOpen(null);
      setValue("");
      setNote("");
    } catch (error) {
      setNotice({ ok: false, text: explainOperation(error) });
    }
  };

  const guardrails = merchant.guardrails;

  return (
    <div className="q-view q-view--events">
      <header className="q-page-intro q-page-intro--panel">
        <div>
          <p className="q-overline">EVENTS / 演出与定价</p>
          <h1>先看进度，再动手。</h1>
        </div>
        <p className="q-intro-note">
          单次改价上限 ±{guardrails.max_price_delta_pct}%、折扣上限 {guardrails.max_promotion_discount_pct}%、
          单次最多 {guardrails.max_items_per_change} 项、单次释放上限 {guardrails.max_restock_quantity} 张。
          任何一项都先变成待审批提案。
        </p>
      </header>

      {notice ? (
        <p className={notice.ok ? "q-inline-ok" : "q-inline-error"} role="status">
          {notice.text}
          {notice.ok ? <Link href="/works/demos/qintai-ticketing/merchant/holds"> 去待审批列表 →</Link> : null}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Empty>没有可运营的场次。</Empty>
      ) : (
        rows.map((event) => {
          const tiers = (event.tiers as Array<Record<string, unknown>>) ?? [];
          return (
            <Panel
              key={String(event.event_id)}
              title={String(event.event_name)}
              subtitle={[
                event.venue,
                chineseDate(String(event.event_date ?? "")),
                daysToEvent(Number(event.days_to_event ?? 0)),
                `开售 ${dayMonth(String(event.on_sale_date ?? ""))}`,
                `基线：${String(event.baseline_kind ?? "—")}`,
              ].join(" · ")}
              action={
                <button
                  type="button"
                  className="q-ghost-button"
                  onClick={() =>
                    askNow(
                      "merchant",
                      `${String(event.event_name)}（${String(event.event_date)}）目前各票档的售出进度如何？哪些明显落后基线，应该先处理哪一档？`,
                    )
                  }
                >
                  让助手分析这一场 <em>AI</em>
                </button>
              }
            >
              <ul className="q-tier-rows">
                {tiers.map((tier) => {
                  const listingId = String(tier.product_id);
                  const pace = tier.pace_vs_baseline_pts as number | null;
                  const behind = pace != null && pace <= UNDER_PACE_PTS;
                  const holds = (tier.holds as Record<string, number> | undefined) ?? {};
                  const releasable = Math.trunc(holds.promoter_hold ?? 0) + Math.trunc(holds.production_hold ?? 0);
                  const pricing = merchant.getPricingContext(listingId);
                  const weekly = (tier.weekly_sold_cum as Array<{ week_start: string; sold_cum: number }> | undefined) ?? [];
                  const isOpen = open?.listingId === listingId;
                  return (
                    <li key={listingId} className={isOpen ? "is-open" : ""}>
                      <div className="q-tier-row">
                        <div className="q-tier-row-head">
                          <div>
                            <strong>{String(tier.tier)}</strong>
                            <small className="q-mono">{listingId}</small>
                          </div>
                          <div className="q-tier-row-price">
                            <strong>{money(Number(tier.price), { whole: true })}</strong>
                            <small>含全部费用</small>
                          </div>
                          <div className="q-tier-row-numbers">
                            <span className="q-mono">
                              容量 {count(Number(tier.capacity ?? 0))} · 已售 {count(Number(tier.sold ?? 0))} · 余 {count(Number(tier.remaining ?? 0))}
                            </span>
                            <span className="q-mono">
                              候补 {count(Number(tier.waitlist_depth ?? 0))} 人 · 近 7 天 {count(Math.round(Number(tier.recent_weekly_sales ?? 0)))}
                            </span>
                          </div>
                          <Pill tone={pace == null ? "muted" : pace >= 0 ? "ok" : behind ? "danger" : "warn"}>
                            <span className="q-mono">{pacePts(pace)}</span>
                          </Pill>
                        </div>

                        <div className="q-tier-row-bars">
                          <div>
                            <ProgressBar value={Number(tier.sell_through_pct ?? 0)} baseline={Number(tier.baseline_pct ?? 0)} behind={behind} />
                            <small className="q-mono">
                              {pct(Number(tier.sell_through_pct ?? 0))} 已售 · 基线 {pct(Number(tier.baseline_pct ?? 0))}
                            </small>
                          </div>
                          <Sparkline points={weekly} />
                        </div>

                        <p className="q-tier-row-holds">
                          保留座位：运营 {count(Math.trunc(holds.promoter_hold ?? 0))} ·
                          制作 {count(Math.trunc(holds.production_hold ?? 0))} ·
                          赠票 {count(Math.trunc(holds.comps ?? 0))}（不可释放）·
                          作废 {count(Math.trunc(holds.kills ?? 0))}（不可释放） · 可释放 {count(releasable)} 张
                        </p>

                        <div className="q-tier-row-actions">
                          {(["price", "restock", "promotion"] as DraftKind[]).map((kind) => (
                            <button
                              key={kind}
                              type="button"
                              className={isOpen && open?.kind === kind ? "q-outline-button is-active" : "q-outline-button"}
                              onClick={() => {
                                setOpen(isOpen && open?.kind === kind ? null : { listingId, kind });
                                setNotice(null);
                                setValue("");
                                setNote("");
                              }}
                            >
                              {ACTION_LABEL[kind]}
                            </button>
                          ))}
                          <span className="q-tier-row-hint">
                            毛利 {pct(pricing?.margin_pct ?? null)} · 单次区间 {pricing?.min_price != null ? money(pricing.min_price, { whole: true }) : "—"}–{pricing?.max_price != null ? money(pricing.max_price, { whole: true }) : "—"}
                          </span>
                        </div>

                        {isOpen && open ? (
                          <div className="q-draft">
                            <label>
                              <span>
                                {open.kind === "price"
                                  ? `新的含全部费用（当前 ${money(Number(tier.price))}）`
                                  : open.kind === "restock"
                                    ? `释放张数（可释放 ${count(releasable)} 张）`
                                    : `折扣百分比（上限 ${guardrails.max_promotion_discount_pct}%）`}
                              </span>
                              <input
                                type="number"
                                min={open.kind === "restock" ? 1 : 0}
                                step={open.kind === "promotion" ? 5 : 10}
                                value={value}
                                onChange={(inputEvent) => setValue(inputEvent.target.value)}
                              />
                            </label>
                            <label>
                              <span>说明（会写进台账摘要）</span>
                              <input type="text" value={note} maxLength={120} onChange={(inputEvent) => setNote(inputEvent.target.value)} />
                            </label>
                            <div className="q-draft-actions">
                              <button type="button" className="q-primary-button q-primary-button--small" onClick={() => stage(listingId, open.kind)}>
                                暂存为待审批
                              </button>
                              <button type="button" className="q-text-button" onClick={() => setOpen(null)}>取消</button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="q-event-curve">
                {tiers.length > 0 ? (
                  <PacingCurve
                    points={((tiers[0].weekly_sold_cum as Array<{ week_start: string; sold_cum: number }>) ?? [])}
                    baselinePct={(tiers[0].weekly_baseline_pct as number[]) ?? null}
                    capacity={Number(tiers[0].capacity ?? 0)}
                    behind={Number(tiers[0].pace_vs_baseline_pts ?? 0) <= UNDER_PACE_PTS}
                  />
                ) : null}
                <p>
                  曲线为「{String(tiers[0]?.tier ?? "")}」这一档的累计售票占容量比例；虚线是同类场馆手册给出的同期基线。
                  补货只从运营与制作保留中释放，赠票与作废票继续不售；在售中暂停票档在琴台票务 Demo 里被拒绝。
                </p>
              </div>
            </Panel>
          );
        })
      )}

      <p className="q-disclaimer">
        票档库存就是店面的实时可售数：应用一项补货会立刻写穿容量，应用改价会立刻改变观众看到的价格。
        助手只能准备草案，写入永远发生在你按下「暂存」或「应用」之后。
      </p>
    </div>
  );
}

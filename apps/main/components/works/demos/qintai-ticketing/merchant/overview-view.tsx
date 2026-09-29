"use client";

/** 运营台总览：今天要处理的事、本周经营数据、接下来演出与最近变更。 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMerchantContext, useQintai } from "@/components/works/demos/qintai-ticketing/provider";
import {
  Empty,
  Panel,
  Pill,
  ProgressBar,
  StatTile,
  changePct,
  chinesePeriod,
  count,
  dayMonth,
  daysToEvent,
  money,
  pacePts,
  pct,
} from "@/components/works/demos/qintai-ticketing/ui/parts";
import type { InventoryAlert, OrderIssue } from "@/lib/works/qintai-ticketing/engine/pacing";

type Filter = "all" | "orders" | "scarce" | "pacing";
const ROW_CAP = 6;

const ISSUE_LABEL: Record<OrderIssue["kind"], string> = {
  delayed: "转票延迟",
  return_spike: "退票集中",
  buyer_message: "观众留言",
  damaged: "座椅维护",
};

export function MerchantOverview() {
  const { merchant, askNow, revision } = useQintai();
  const [filter, setFilter] = useState<Filter>("all");

  const { snapshot, alerts, issues, pacing, now } = useMemo(() => {
    const alerts = merchant.computeAlerts();
    const issues = merchant.getOrderIssues();
    const pacing = merchant.eventPacingRows(merchant.eventIds()) as Array<Record<string, unknown>>;
    return { snapshot: merchant.getBusinessSnapshot("last_30_days"), alerts, issues, pacing, now: new Date() };
    // revision 参与依赖：应用变更会改变容量与价格。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant, revision]);

  useMerchantContext("merchant", () => ({ pacingProductIds: merchant.portfolioIds() }));

  const pending = merchant.getPendingChanges();
  const scarce = alerts
    .filter((alert) => alert.kind === "low_stock")
    .sort((a, b) => a.stock - b.stock);
  const slow = alerts.filter((alert) => alert.kind === "slow_mover");
  const today = merchant.todaySnapshot() as { upcoming: Array<Record<string, unknown>> } | null;
  const upcoming = today?.upcoming ?? [];
  const recentChanges = merchant.ledger.resolved().slice(-5).reverse();

  const rows: Array<{ kind: "issue"; issue: OrderIssue } | { kind: "tier"; alert: InventoryAlert }> =
    filter === "orders"
      ? issues.map((issue) => ({ kind: "issue" as const, issue }))
      : filter === "scarce"
        ? scarce.map((alert) => ({ kind: "tier" as const, alert }))
        : filter === "pacing"
          ? slow.map((alert) => ({ kind: "tier" as const, alert }))
          : [
              // 落后基线最多的票档排在最前，它是票房今天最先要动的东西。
              ...slow.slice(0, 1).map((alert) => ({ kind: "tier" as const, alert })),
              ...issues.map((issue) => ({ kind: "issue" as const, issue })),
              ...scarce.map((alert) => ({ kind: "tier" as const, alert })),
              ...slow.slice(1).map((alert) => ({ kind: "tier" as const, alert })),
            ];

  const comparison = snapshot.compare_to ? chinesePeriod(snapshot.compare_to) : "上一区间";
  const direction = (snapshot.sales_change_pct ?? 0) >= 0 ? "上升" : "下降";
  const aovChange =
    snapshot.sales_change_pct != null && snapshot.orders_change_pct != null
      ? ((1 + snapshot.sales_change_pct / 100) / (1 + snapshot.orders_change_pct / 100) - 1) * 100
      : null;

  const filters: Array<{ id: Filter; label: string; value: number }> = [
    { id: "all", label: "全部", value: issues.length + scarce.length + slow.length },
    { id: "orders", label: "订单问题", value: issues.length },
    { id: "scarce", label: "库存紧张", value: scarce.length },
    { id: "pacing", label: "销售进度", value: slow.length },
  ];

  return (
    <div className="q-view q-view--merchant">
      <header className="q-page-intro q-page-intro--panel">
        <div>
          <p className="q-overline">OPERATIONS / 武汉演出运营台</p>
          <h1>今天要把哪三件事处理掉？</h1>
        </div>
        <p className="q-intro-note">
          {now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })} ·
          本周销售额{direction} {changePct(Math.abs(snapshot.sales_change_pct ?? 0)).replace("+", "")}，
          {issues.length + scarce.length > 0
            ? `${issues.length} 个订单问题与 ${scarce.length} 个库存提醒需要今天处理。`
            : "今天没有待处理事项。"}
        </p>
      </header>

      <section className="q-command">
        <div className="q-command-copy">
          <p className="q-overline">今日运营视角</p>
          <h2>把每场演出，变成一场可控的现场。</h2>
          <p>
            先看今天要处理的事，再决定库存、价格和沟通动作。票档库存就是店面的实时可售数，
            所有改动都先生成待审批提案。
          </p>
        </div>
        <div className="q-command-metrics">
          <div><strong>{count(upcoming.length)}</strong><span>接下来演出</span></div>
          <div><strong>{count(scarce.length)}</strong><span>库存提醒</span></div>
          <div><strong>{count(pending.length)}</strong><span>待审批改动</span></div>
        </div>
      </section>

      {pending.length > 0 ? (
        <section className="q-approvals">
          <div>
            <span className="q-approvals-count">{pending.length}</span>
            <div>
              <strong>{pending.length} 项改动等待审批</strong>
              <p>{pending.map((change) => change.summary).join("；")}</p>
            </div>
          </div>
          <Link className="q-primary-button q-primary-button--small" href="/works/demos/qintai-ticketing/merchant/holds">
            去审批
          </Link>
        </section>
      ) : null}

      <Panel
        title="近 30 天经营数据"
        subtitle={`${chinesePeriod(snapshot.period)} · 对比${comparison}`}
        action={
          <button
            type="button"
            className="q-ghost-button"
            onClick={() => askNow("merchant", `本期销售额 ${money(snapshot.sales, { whole: true })}、订单 ${count(snapshot.orders)} 笔、转化 ${pct(snapshot.conversion_rate)}%，请解释这组数字，并指出最该关注的票档。`)}
          >
            让助手解释 <em>AI</em>
          </button>
        }
      >
        <div className="q-stats">
          <StatTile label="销售额" value={money(snapshot.sales, { whole: true })} delta={snapshot.sales_change_pct}
            onClick={() => askNow("merchant", `销售额本期${direction} ${changePct(snapshot.sales_change_pct)}，对比${comparison}。为什么？`)} />
          <StatTile label="订单数" value={count(snapshot.orders)} delta={snapshot.orders_change_pct}
            onClick={() => askNow("merchant", `订单数本期变化 ${changePct(snapshot.orders_change_pct)}，对比${comparison}。为什么？`)} />
          <StatTile label="转化率" value={pct(snapshot.conversion_rate)} delta={snapshot.conversion_change_pct}
            onClick={() => askNow("merchant", `转化率 ${pct(snapshot.conversion_rate)}，变化 ${changePct(snapshot.conversion_change_pct)}，可能是什么原因？`)} />
          <StatTile label="平均订单金额" value={money(snapshot.average_order_value)} delta={aovChange}
            onClick={() => askNow("merchant", `平均订单金额 ${money(snapshot.average_order_value)}，变化 ${changePct(aovChange)}，说明了什么？`)} />
        </div>
      </Panel>

      {upcoming.length > 0 ? (
        <Panel title="接下来演出" action={<Link className="q-text-button" href="/works/demos/qintai-ticketing/merchant/events">查看全部演出 →</Link>}>
          <div className="q-nextup">
            {upcoming.map((show) => {
              const capacity = Number(show.capacity ?? 0);
              const sold = Number(show.sold ?? 0);
              return (
                <Link className="q-nextup-card" key={String(show.event_id)} href="/works/demos/qintai-ticketing/merchant/events">
                  <strong>{String(show.event_name)}</strong>
                  <small>
                    {[show.venue, dayMonth(String(show.event_date)), daysToEvent(Number(show.days_to_event))]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                  <ProgressBar value={capacity > 0 ? (sold / capacity) * 100 : 0} />
                  <span className="q-mono">
                    已售 {count(sold)}/{count(capacity)} · 剩余 {count(Number(show.remaining ?? 0))} 张
                    {Number(show.waitlist_depth ?? 0) > 0 ? ` · 候补 ${count(Number(show.waitlist_depth))} 人` : ""}
                  </span>
                </Link>
              );
            })}
          </div>
        </Panel>
      ) : null}

      <div className="q-two-column">
        <Panel
          title="今日待处理"
          subtitle="程序判定，不是模型推测"
          action={
            <div className="q-segmented" role="tablist" aria-label="筛选待处理事项">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  className={filter === item.id ? "is-active" : ""}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label} <b>{count(item.value)}</b>
                </button>
              ))}
            </div>
          }
        >
          {rows.length === 0 ? (
            <Empty>目前没有待处理事项。</Empty>
          ) : (
            <>
              <ul className="q-attention-list">
                {rows.slice(0, ROW_CAP).map((row) =>
                  row.kind === "issue" ? (
                    <li key={row.issue.issue_id}>
                      <span className="q-attention-icon" aria-hidden>!</span>
                      <span className="q-attention-copy">
                        <strong>{row.issue.summary}</strong>
                        <small>
                          {[ISSUE_LABEL[row.issue.kind], `订单 ${row.issue.order_id}`, row.issue.opened_at ? `${dayMonth(row.issue.opened_at)} 创建` : ""]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                        {row.issue.buyer_message_excerpt ? <p>{row.issue.buyer_message_excerpt}</p> : null}
                      </span>
                      <button
                        type="button"
                        className="q-text-button"
                        onClick={() =>
                          askNow(
                            "merchant",
                            `订单 ${row.issue.order_id} 的处理选项有哪些？背景：${row.issue.summary}。${row.issue.buyer_message_excerpt ?? ""}`,
                          )
                        }
                      >
                        {row.issue.kind === "buyer_message" ? "起草回复" : "询问助手"} ↗
                      </button>
                    </li>
                  ) : (
                    <li key={`${row.alert.kind}-${row.alert.listing_id}`}>
                      <span className={`q-attention-icon${row.alert.kind === "low_stock" ? " is-warn" : " is-danger"}`} aria-hidden>
                        {row.alert.kind === "low_stock" ? "▲" : "▼"}
                      </span>
                      <span className="q-attention-copy">
                        <strong>{row.alert.title}</strong>
                        <small>
                          <em className={row.alert.kind === "low_stock" ? "is-warn" : "is-danger"}>
                            {row.alert.kind === "low_stock" ? `即将售罄 · 余 ${count(row.alert.stock)} 张` : "低于同类基线"}
                          </em>
                          {row.alert.kind === "slow_mover" ? ` · 余 ${count(row.alert.stock)} 张` : ""}
                          {row.alert.sales_last_30d != null ? ` · 近 30 天售出 ${count(row.alert.sales_last_30d)} 张` : ""}
                          {row.alert.threshold != null ? ` · 警戒线 ${count(row.alert.threshold)}` : ""}
                          {` · ${row.alert.listing_id}`}
                        </small>
                      </span>
                      <button
                        type="button"
                        className="q-text-button"
                        onClick={() =>
                          askNow(
                            "merchant",
                            row.alert.kind === "low_stock"
                              ? `${row.alert.title}（${row.alert.listing_id}）接近售罄，可以释放哪些模拟保留库存？`
                              : `${row.alert.title}（${row.alert.listing_id}）低于同类演出销售进度，你建议怎么处理？`,
                          )
                        }
                      >
                        {row.alert.kind === "low_stock" ? "释放库存" : "询问助手"} ↗
                      </button>
                    </li>
                  ),
                )}
              </ul>
              {rows.length > ROW_CAP ? (
                <p className="q-overflow">还有 {count(rows.length - ROW_CAP)} 项，可在「演出与定价」里逐档查看。</p>
              ) : null}
            </>
          )}
        </Panel>

        <div className="q-side-stack">
          <Panel title="票档售出进度" subtitle="实际 vs 同类演出基线">
            <ul className="q-pace-list">
              {(pacing[0]?.tiers as Array<Record<string, unknown>> | undefined ?? [])
                .slice()
                .sort((a, b) => Number(a.pace_vs_baseline_pts ?? 0) - Number(b.pace_vs_baseline_pts ?? 0))
                .slice(0, 5)
                .map((tier) => (
                  <li key={String(tier.product_id)}>
                    <div className="q-pace-head">
                      <span>{String(tier.tier)}</span>
                      <Pill tone={Number(tier.pace_vs_baseline_pts ?? 0) >= 0 ? "ok" : Number(tier.pace_vs_baseline_pts ?? 0) <= -15 ? "danger" : "muted"}>
                        <span className="q-mono">{pacePts(Number(tier.pace_vs_baseline_pts ?? 0))}</span>
                      </Pill>
                    </div>
                    <ProgressBar
                      value={Number(tier.sell_through_pct ?? 0)}
                      baseline={Number(tier.baseline_pct ?? 0)}
                      behind={Number(tier.pace_vs_baseline_pts ?? 0) <= -15}
                    />
                    <small className="q-mono">
                      {pct(Number(tier.sell_through_pct ?? 0))} 已售 · 余 {count(Number(tier.remaining ?? 0))}
                    </small>
                  </li>
                ))}
              {pacing.length === 0 ? <Empty>还没有排期数据。</Empty> : null}
            </ul>
          </Panel>

          <Panel title="订单问题" subtitle={`${count(issues.length)} 项待跟进`}>
            {issues.length === 0 ? (
              <Empty>没有订单问题。</Empty>
            ) : (
              <ul className="q-record-list">
                {issues.slice(0, 5).map((issue) => (
                  <li key={issue.issue_id}>
                    <span className="q-mono">{issue.order_id}</span>
                    <span>{ISSUE_LABEL[issue.kind]}</span>
                    <small>{issue.opened_at ? dayMonth(issue.opened_at) : ""}</small>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="最近变更" subtitle={`台账共 ${count(merchant.ledger.resolved().length)} 条已处理记录`}>
            {recentChanges.length === 0 ? (
              <Empty>还没有已应用或已丢弃的变更。</Empty>
            ) : (
              <ul className="q-record-list">
                {recentChanges.map((change) => (
                  <li key={change.change_id}>
                    <span className="q-mono">{change.change_id}</span>
                    <span>{change.summary}</span>
                    <Pill tone={change.status === "applied" ? "ok" : "muted"}>
                      {change.status === "applied" ? "已应用" : "已丢弃"}
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <p className="q-disclaimer">
        经营数字由本地日行数据重排到「最近 30 天」区间并逐日回推；排期基线来自同类场馆手册。
        待审批台账只属于当前浏览器会话，票务状态（锁座、候补、票夹）会保留。
      </p>
    </div>
  );
}

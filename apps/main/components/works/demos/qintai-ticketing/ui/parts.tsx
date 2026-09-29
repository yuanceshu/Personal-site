"use client";

/** 琴台票务界面共用的小件与格式化：与主站其它 Demo 一致，纯手写作用域样式，不引第三方 UI 库。 */

import { useEffect, useState } from "react";

// --- 格式化 -----------------------------------------------------------------

export function money(value: number, options: { whole?: boolean; sign?: boolean } = {}): string {
  const digits = options.whole || Math.abs(value) >= 1000 ? 0 : 2;
  const text = `¥${Math.abs(value).toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
  if (!options.sign) return text;
  return `${value >= 0 ? "+" : "−"}${text}`;
}

export function count(value: number): string {
  return value.toLocaleString("zh-CN");
}

export function pct(value: number | null | undefined, digits = 1): string {
  return value == null ? "—" : `${value.toFixed(digits)}%`;
}

export function pacePts(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)} 点`;
}

export function changePct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const DAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export interface DateBlock {
  mon: string;
  day: string;
  dow: string;
}

/** 按 UTC 解析，避免观众时区把演出日期挪一天。 */
export function dateBlock(iso?: string | null): DateBlock | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.slice(0, 10));
  if (!match) return null;
  const [, year, month, day] = match;
  const utc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return { mon: MONTHS[Number(month) - 1] ?? month, day: String(Number(day)), dow: DAYS[utc.getUTCDay()] };
}

export function chineseDate(iso?: string | null): string {
  const block = dateBlock(iso);
  return block ? `${block.mon}${block.day}日 ${block.dow}` : "日期待定";
}

/** `2026-08-29/2026-09-27` → `8月29日 – 9月27日`。 */
export function chinesePeriod(period: string): string {
  const [start, end] = period.split("/");
  const from = dateBlock(start);
  const to = dateBlock(end);
  if (!from || !to) return period;
  return `${from.mon}${from.day}日 – ${to.mon}${to.day}日`;
}

export function dayMonth(iso?: string | null): string {
  const block = dateBlock(iso);
  return block ? `${block.mon}${block.day}日` : "—";
}

export function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

export function daysToEvent(days: number): string {
  if (days < 0) return `已结束 ${Math.abs(days)} 天`;
  if (days === 0) return "今天开演";
  if (days === 1) return "明天开演";
  return `${days} 天后开演`;
}

export function hoursRemaining(seconds: number): string {
  if (seconds <= 0) return "已过期";
  const hours = seconds / 3600;
  if (hours < 1) return `约 ${Math.max(1, Math.round(seconds / 60))} 分钟`;
  return `约 ${hours.toFixed(1)} 小时`;
}

// --- 时钟 -------------------------------------------------------------------

/** 每秒重绘一次的本地时钟，用来驱动锁座与领取窗口的倒计时。 */
export function useTicker(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

// --- 基础组件 ---------------------------------------------------------------

export function Pill({
  tone = "muted",
  children,
}: {
  tone?: "ok" | "warn" | "danger" | "muted" | "accent";
  children: React.ReactNode;
}) {
  return <span className={`q-pill q-pill--${tone}`}>{children}</span>;
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  tone,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  tone?: "plain" | "well";
}) {
  return (
    <section className={`q-panel${tone === "well" ? " q-panel--well" : ""}`}>
      <header className="q-panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action ? <div className="q-panel-action">{action}</div> : null}
      </header>
      <div className="q-panel-body">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="q-empty">{children}</p>;
}

/** 售出进度条：实心是实际，竖线是同类演出基线，落后 15 点以上转红。 */
export function ProgressBar({
  value,
  baseline,
  behind = false,
}: {
  value: number | null | undefined;
  baseline?: number | null;
  behind?: boolean;
}) {
  if (value == null) return null;
  const clamped = Math.max(0, Math.min(100, value));
  const mark = baseline == null ? null : Math.max(0, Math.min(100, baseline));
  return (
    <span
      className="q-bar"
      role="img"
      aria-label={`已售 ${clamped.toFixed(1)}%${mark == null ? "" : `，同类演出基线 ${mark.toFixed(1)}%`}`}
    >
      <i className={behind ? "q-bar-fill is-behind" : "q-bar-fill"} style={{ width: `${clamped}%` }} />
      {mark == null ? null : <b className="q-bar-mark" style={{ left: `${mark}%` }} />}
    </span>
  );
}

/** 每周累计售票折线，y 轴从 0 开始。 */
export function Sparkline({ points }: { points: Array<{ week_start: string; sold_cum: number }> }) {
  if (points.length < 2) return null;
  const width = 160;
  const height = 34;
  const max = Math.max(...points.map((point) => point.sold_cum)) || 1;
  const step = width / (points.length - 1);
  const coords = points.map((point, index) => {
    const x = index * step;
    const y = height - 3 - (point.sold_cum / max) * (height - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className="q-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img"
      aria-label={`每周累计售票，从 ${points[0].sold_cum} 张到 ${points[points.length - 1].sold_cum} 张`}>
      <polygon points={`0,${height} ${coords.join(" ")} ${width},${height}`} className="q-spark-area" />
      <polyline points={coords.join(" ")} className="q-spark-line" />
    </svg>
  );
}

/** 实际 vs 基线的双折线，两条都截断到较短的一侧。 */
export function PacingCurve({
  points,
  baselinePct,
  capacity,
  behind = false,
}: {
  points: Array<{ week_start: string; sold_cum: number }>;
  baselinePct?: number[] | null;
  capacity: number | null | undefined;
  behind?: boolean;
}) {
  const seats = capacity ?? 0;
  if (seats <= 0 || points.length < 2) return null;
  const raw = baselinePct ?? [];
  const usable = raw.length >= 2 && raw.every((value) => Number.isFinite(value));
  const weeks = usable ? Math.min(points.length, raw.length) : points.length;
  if (weeks < 2) return null;
  const actual = points
    .slice(0, weeks)
    .map((point) => Math.max(0, Math.min(100, (point.sold_cum / seats) * 100)));
  const baseline = usable ? raw.slice(0, weeks).map((value) => Math.max(0, Math.min(100, value))) : null;
  const width = 300;
  const height = 68;
  const pad = 3;
  const step = width / (weeks - 1);
  const yFor = (value: number) => pad + (1 - value / 100) * (height - pad * 2);
  const toCoords = (series: number[]) =>
    series.map((value, index) => `${(index * step).toFixed(1)},${yFor(value).toFixed(1)}`).join(" ");
  return (
    <div className="q-curve">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img"
        aria-label={`销售进度：实际已售 ${actual[actual.length - 1].toFixed(1)}%${
          baseline ? `，同类演出基线 ${baseline[baseline.length - 1].toFixed(1)}%` : ""
        }`}>
        {[25, 50, 75, 100].map((grid) => (
          <line key={grid} x1={0} x2={width} y1={yFor(grid)} y2={yFor(grid)} className="q-curve-grid" />
        ))}
        {baseline ? <polyline points={toCoords(baseline)} className="q-curve-base" /> : null}
        <polyline points={toCoords(actual)} className={behind ? "q-curve-actual is-behind" : "q-curve-actual"} />
      </svg>
      <div className="q-curve-legend">
        <span><i className={behind ? "is-behind" : ""} aria-hidden />实际</span>
        {baseline ? <span><i className="is-dashed" aria-hidden />基线</span> : null}
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  delta,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  delta?: number | null;
  hint?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="q-stat-label">{label}</span>
      <strong className="q-stat-value">{value}</strong>
      {delta == null ? null : (
        <span className={`q-stat-delta ${delta >= 0 ? "is-up" : "is-down"}`}>{changePct(delta)}</span>
      )}
      {hint ? <small className="q-stat-hint">{hint}</small> : null}
    </>
  );
  if (!onClick) return <div className="q-stat">{body}</div>;
  return (
    <button type="button" className="q-stat q-stat--ask" onClick={onClick} aria-label={`${label}：询问助手`}>
      {body}
    </button>
  );
}

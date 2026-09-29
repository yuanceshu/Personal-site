/**
 * 运营工作台后端（移植自 `examples/entertainment/api/mock_merchant.py` +
 * `event_pacing.py`，以及 `demo_common/merchant_fixtures.py` 与
 * `merchant_agent/changes.py` 中与本作品相关的部分）。
 *
 * 一个票档的库存就是引擎的实时可售数；补货会释放保留座位并作为真实容量生效；改价保持
 * 逐项费用不变、只移动票面价；在售中暂停票档会被拒绝；pacing 拿实时计数与同类演出的
 * 基线比较。
 *
 * 确定性边界：库存/余量/金额/改价限幅/审批/告警全部在这里的纯代码中执行，模型只能读取
 * 与**暂存提案**，任何写入都要操作者确认后才由这里落库（写进本会话的数据副本）。
 */

import type { Dataset } from "../data";
import { merchantFixtures } from "../data";
import type { Product, Venue } from "../types";
import {
  anchoredShift,
  daysBetweenIso,
  marginPct,
  metricWindow,
  shiftDay,
  todayIso,
  weeksSince,
  type DailyRows,
} from "./fixtures";import type { TicketingEngine } from "./ticketing";

// ---------------------------------------------------------------------------
// 常量（源 `mock_merchant.py` 顶部）
// ---------------------------------------------------------------------------

/** 可售数低于此值的票档是 low_stock 告警（与店面「售票较快」同一阈值）。 */
export const NEARLY_SOLD_OUT_FLOOR = 12;
/** 低于基线这么多百分点的票档是 slow_mover。 */
export const UNDER_PACE_ALERT_PTS = 15.0;
/** 改价时逐项费用原样保留；它们之和是任何价格的底线。 */
export const FEE_ATTRS = ["service_fee_usd", "facility_fee_usd", "processing_fee_usd"] as const;
/** 票面价中应付给艺人及场馆的份额。 */
export const HOUSE_COST_SHARE = 0.68;
/** 补货可动用的保留桶，按顺序；赠票与作废票不可售。 */
export const RELEASABLE_BUCKETS = ["promoter_hold", "production_hold"] as const;
export const MONEY_METRICS = new Set([
  "sales",
  "gross",
  "average_order_value",
  "aov",
  "average_ticket_price",
]);

// ---------------------------------------------------------------------------
// 运营领域类型（对齐 `merchant_agent/types.py`）
// ---------------------------------------------------------------------------

export type ListingStatus = "active" | "paused" | "draft" | "out_of_stock";
export type ContentQuality = "good" | "needs_work" | "poor";

export interface Listing {
  listing_id: string;
  title: string;
  status: ListingStatus;
  price: number;
  currency: string;
  stock: number;
  category: string | null;
  content_quality: ContentQuality;
  attributes: Record<string, string>;
  image_url?: string;
  short_description: string;
}

export interface ListingDetails extends Listing {
  long_description: string;
  review_snippets: string[];
  sales_last_30d: number | null;
  missing_attributes: string[];
}

export interface ListingFilters {
  status?: ListingStatus | null;
  category?: string | null;
  max_stock?: number | null;
  content_quality?: ContentQuality | null;
  sort?: "relevance" | "sales_desc" | "stock_asc" | "price_desc" | "price_asc";
}

export interface AlertCounts {
  low_stock: number;
  slow_movers: number;
  order_issues: number;
  pending_changes: number;
}

export interface BusinessSnapshot {
  period: string;
  compare_to: string | null;
  sales: number;
  orders: number;
  traffic: number;
  conversion_rate: number;
  average_order_value: number;
  sales_change_pct: number | null;
  orders_change_pct: number | null;
  traffic_change_pct: number | null;
  conversion_change_pct: number | null;
  currency: string;
  alerts: AlertCounts;
}

export interface MetricPoint {
  date: string;
  value: number;
}

export interface MetricSeries {
  metric: string;
  unit: string | null;
  granularity: "day" | "week";
  period: string | null;
  segment: string | null;
  points: MetricPoint[];
}

export interface InventoryAlert {
  listing_id: string;
  title: string;
  kind: "low_stock" | "slow_mover";
  stock: number;
  threshold: number | null;
  days_of_cover: number | null;
  sales_last_30d: number | null;
  storefront_visible: boolean | null;
}

export interface OrderIssue {
  issue_id: string;
  order_id: string;
  kind: "delayed" | "return_spike" | "buyer_message" | "damaged";
  summary: string;
  listing_id: string | null;
  buyer_message_excerpt: string | null;
  opened_at: string | null;
}

export interface PricingContext {
  listing_id: string;
  current_price: number;
  currency: string;
  unit_cost: number | null;
  margin_pct: number | null;
  min_price: number | null;
  max_price: number | null;
  max_price_delta_pct: number;
  max_promotion_discount_pct: number;
  price_unit: string;
  demand_signal: "rising" | "steady" | "falling";
  last_changed: string | null;
  event_id: string | null;
  event_date: string | null;
  days_to_event: number | null;
  capacity: number | null;
  sold: number | null;
  remaining: number | null;
  sell_through_pct: number | null;
  baseline_pct: number | null;
  pace_vs_baseline_pts: number | null;
  waitlist_depth: number | null;
  holds: Record<string, number>;
  fees_usd: number;
  active_promotions: Array<Record<string, unknown>>;
}

export interface Campaign {
  campaign_id: string;
  name: string;
  status: "draft" | "active" | "paused" | "ended";
  objective?: string | null;
  channel?: string | null;
  budget: number;
  spend?: number | null;
  revenue?: number | null;
  currency: string;
  starts?: string | null;
  ends?: string | null;
}

export interface PriceUpdateItem {
  listing_id: string;
  new_price: number;
}

export interface InventoryActionItem {
  listing_id: string;
  action: "restock" | "pause" | "activate";
  quantity?: number | null;
}

export interface PromotionDraft {
  name: string;
  listing_ids: string[];
  discount_pct: number;
  starts: string;
  ends: string;
  nights?: string[] | null;
}

export interface CampaignDraft {
  campaign_id?: string | null;
  name: string;
  objective?: string | null;
  audience?: string | null;
  budget?: number | null;
  copy_text?: string | null;
  starts?: string | null;
  ends?: string | null;
}

export type ChangeKind =
  | "listing_update"
  | "price_update"
  | "inventory_action"
  | "promotion"
  | "campaign";
export type ChangeStatus = "staged" | "applied" | "discarded";
export type ActorKind = "operator" | "agent";

export interface ChangeItem {
  target: string;
  field: string;
  before: unknown;
  after: unknown;
}

export interface StagedChange {
  change_id: string;
  kind: ChangeKind;
  status: ChangeStatus;
  summary: string;
  items: ChangeItem[];
  created_at: string;
  created_by: string;
  created_by_kind: ActorKind;
  applied_at: string | null;
  applied_by: string | null;
  discarded_at: string | null;
  discarded_by: string | null;
  discarded_by_kind: ActorKind | null;
  guardrail_notes: string[];
  currency: string | null;
  margin_impact: number | null;
  margin_before_pct: number | null;
  margin_after_pct: number | null;
}

export interface MerchantSessionContext {
  session_id: string;
  merchant_id: string;
  operator: string;
}

// ---------------------------------------------------------------------------
// 护栏与暂存台账（源 `merchant_agent/changes.py` + `config.py` 的默认值）
// ---------------------------------------------------------------------------

export interface MerchantGuardrailConfig {
  max_items_per_change: number;
  max_price_delta_pct: number;
  max_promotion_discount_pct: number;
  max_restock_quantity: number;
  max_campaign_budget: number;
  max_listing_field_chars: number;
  protected_fields: string[];
  price_bearing_fields: string[];
  listing_update_blocked_fields: string[];
}

export const DEFAULT_GUARDRAILS: MerchantGuardrailConfig = {
  max_items_per_change: 25,
  max_price_delta_pct: 20,
  max_promotion_discount_pct: 50,
  max_restock_quantity: 500,
  max_campaign_budget: 10_000,
  max_listing_field_chars: 2000,
  protected_fields: ["listing_id", "currency", "tax_category", "compliance_notes"],
  price_bearing_fields: ["price"],
  listing_update_blocked_fields: ["price", "stock"],
};

/** 变更违反护栏；`violations` 每条规则一条面向操作者的说明。 */
export class GuardrailViolation extends Error {
  constructor(public readonly violations: string[]) {
    super(violations.join("; "));
    this.name = "GuardrailViolation";
  }
}

/** 变更 id 未知或状态不允许该转换；后端也用它对不支持的操作作答。 */
export class ChangeNotApplicable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChangeNotApplicable";
  }
}

function asPrice(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function asQuantity(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function truncateDisplay(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  let cut = text.slice(0, maxChars - 1);
  const space = cut.lastIndexOf(" ");
  if (space >= 0) cut = cut.slice(0, space);
  return `${cut.replace(/[ ,;:\-—–]+$/u, "")}…`;
}

/** 每个护栏被违反时给一条面向操作者的说明；可放行时为空数组。 */
export function checkGuardrails(
  kind: ChangeKind,
  items: ChangeItem[],
  config: MerchantGuardrailConfig = DEFAULT_GUARDRAILS,
): string[] {
  const violations: string[] = [];
  if (items.length > config.max_items_per_change) {
    violations.push(
      `变更涉及 ${items.length} 项，超出自定义上限 ${config.max_items_per_change} 项；` +
        "请拆成多个变更分别审批。",
    );
  }
  const protectedFields = new Set(config.protected_fields.map((name) => name.toLowerCase()));
  const listingBlocked = new Set(
    config.listing_update_blocked_fields.map((name) => name.toLowerCase()),
  );
  const priceBearing = new Set(config.price_bearing_fields.map((name) => name.toLowerCase()));
  const seen = new Set<string>();
  for (const item of items) {
    const field = item.field.toLowerCase();
    // 下面的上限按单项校验、预览也是一项一行，所以同一目标在同一变更里重复出现会各自
    // 过一遍上限，应用时却按累加生效。
    const key = `${item.target}\u0000${field}`;
    if (seen.has(key)) {
      violations.push(`「${item.field}」在 ${item.target} 上出现了多次——请一项只写一行。`);
    }
    seen.add(key);
    if (protectedFields.has(field)) {
      violations.push(`字段「${item.field}」（${item.target}）受保护，助手不能修改。`);
    }
    if (kind === "listing_update" && listingBlocked.has(field)) {
      violations.push(
        `「${item.field}」不能通过内容更新修改——请走改价或库存动作，让它们各自的上限生效。`,
      );
    }
    if (priceBearing.has(field) || kind === "promotion") {
      const before = asPrice(item.before);
      const after = asPrice(item.after);
      if (after === null) {
        violations.push(`${item.target} 的价格必须是正数。`);
      } else if (before === null) {
        violations.push(`${item.target} 没有可核验的当前价格——无法校验涨跌幅上限。`);
      } else {
        const deltaPct = (Math.abs(after - before) / before) * 100;
        if (kind === "promotion") {
          if (deltaPct > config.max_promotion_discount_pct) {
            violations.push(
              `对 ${item.target} 的活动幅度 ${deltaPct.toFixed(0)}% 超出 ` +
                `${config.max_promotion_discount_pct.toFixed(0)}% 的活动上限。`,
            );
          }
        } else if (deltaPct > config.max_price_delta_pct) {
          violations.push(
            `对 ${item.target} 的改价幅度 ${deltaPct.toFixed(0)}% 超出 ` +
              `${config.max_price_delta_pct.toFixed(0)}% 的单次上限。`,
          );
        }
      }
    }
    if (kind === "inventory_action") {
      const added = asQuantity(item.after) - asQuantity(item.before);
      if (added > config.max_restock_quantity) {
        violations.push(
          `${item.target} 补货 ${added} 张，超出 ${config.max_restock_quantity} 张的单次上限。`,
        );
      }
    }
    if (kind === "campaign" && field === "budget") {
      const budget = asPrice(item.after);
      if (budget !== null && budget > config.max_campaign_budget) {
        violations.push(
          `活动预算 ${budget.toFixed(0)} 超出 ${config.max_campaign_budget.toFixed(0)} 的单次上限。`,
        );
      }
    }
  }
  return violations;
}

export interface StageChangeInput {
  kind: ChangeKind;
  summary: string;
  items: ChangeItem[];
  actor: string;
  actor_kind?: ActorKind;
  currency?: string | null;
  margin_impact?: number | null;
  margin_before_pct?: number | null;
  margin_after_pct?: number | null;
  guardrail_notes?: string[] | null;
}

/**
 * 内存中的变更全生命周期：`stage` 校验护栏并记录操作者；`apply` 与 `discard` 只接受
 * 当前处于暂存态的变更；已应用/已丢弃的变更留在台账里作为审计轨迹。
 */
export class ChangeLedger {
  private readonly config: MerchantGuardrailConfig;
  private changes = new Map<string, StagedChange>();
  private sequence = 0;
  private readonly clock: () => number;

  constructor(config: MerchantGuardrailConfig = DEFAULT_GUARDRAILS, now?: () => number) {
    this.config = config;
    this.clock = now ?? (() => Date.now());
  }

  private stamp(): string {
    return new Date(this.clock()).toISOString();
  }

  stage(input: StageChangeInput): StagedChange {
    const violations = checkGuardrails(input.kind, input.items, this.config);
    if (violations.length > 0) throw new GuardrailViolation(violations);
    this.sequence += 1;
    const change: StagedChange = {
      change_id: `chg-${String(this.sequence).padStart(4, "0")}`,
      kind: input.kind,
      status: "staged",
      // 摘要用于预览卡片，过长就裁掉而不是拒绝。
      summary: truncateDisplay(input.summary, 200),
      items: input.items,
      created_at: this.stamp(),
      created_by: input.actor,
      created_by_kind: input.actor_kind ?? "operator",
      applied_at: null,
      applied_by: null,
      discarded_at: null,
      discarded_by: null,
      discarded_by_kind: null,
      guardrail_notes: input.guardrail_notes ?? [],
      currency: input.currency ?? null,
      margin_impact: input.margin_impact ?? null,
      margin_before_pct: input.margin_before_pct ?? null,
      margin_after_pct: input.margin_after_pct ?? null,
    };
    this.changes.set(change.change_id, change);
    return change;
  }

  get(changeId: string): StagedChange | null {
    return this.changes.get(changeId) ?? null;
  }

  pending(): StagedChange[] {
    return [...this.changes.values()].filter((change) => change.status === "staged");
  }

  /**
   * 台账的可序列化视图。暂存的变更只是「待审批的意图」，被应用后的容量/价格已经写进引擎快照，
   * 所以浏览器只需要把它存下来，刷新后待审批列表才不会凭空消失（与源服务端进程内台账一致）。
   */
  serialize(): { sequence: number; changes: StagedChange[] } {
    return { sequence: this.sequence, changes: [...this.changes.values()] };
  }

  restore(state: { sequence: number; changes: StagedChange[] }): void {
    this.sequence = state.sequence;
    this.changes = new Map(state.changes.map((change) => [change.change_id, { ...change }]));
  }

  applied(): StagedChange[] {
    return [...this.changes.values()].filter((change) => change.status === "applied");
  }

  /** 已应用与已丢弃的变更，供工作台的审计视图。 */
  resolved(): StagedChange[] {
    return [...this.changes.values()].filter((change) => change.status !== "staged");
  }

  apply(changeId: string, actor: string): StagedChange {
    const change = this.requireStaged(changeId, "应用");
    // 配置可能在暂存之后收紧了。
    const violations = checkGuardrails(change.kind, change.items, this.config);
    if (violations.length > 0) throw new GuardrailViolation(violations);
    const updated: StagedChange = {
      ...change,
      status: "applied",
      applied_at: this.stamp(),
      applied_by: actor,
    };
    this.changes.set(changeId, updated);
    return updated;
  }

  discard(changeId: string, actor: string, actorKind: ActorKind = "operator"): StagedChange {
    const change = this.requireStaged(changeId, "丢弃");
    const updated: StagedChange = {
      ...change,
      status: "discarded",
      discarded_at: this.stamp(),
      discarded_by: actor,
      discarded_by_kind: actorKind,
    };
    this.changes.set(changeId, updated);
    return updated;
  }

  private requireStaged(changeId: string, action: string): StagedChange {
    const change = this.changes.get(changeId);
    if (!change) throw new ChangeNotApplicable(`没有 id 为 ${changeId} 的变更可供${action}。`);
    if (change.status !== "staged") {
      throw new ChangeNotApplicable(`变更 ${changeId} 当前是「${change.status}」，不是待审批。`);
    }
    return change;
  }
}

// ---------------------------------------------------------------------------
// 运营侧共享 fixture 助手（源 `demo_common/merchant_fixtures.py`）
// ---------------------------------------------------------------------------

const ID_SEPARATORS = /[\s,;]+/;

/** 一串查询里直接点名的 listing id，按查询顺序。 */
export function namedIds(query: string, ids: Iterable<string>): string[] {
  const byFold = new Map<string, string>();
  for (const id of ids) byFold.set(id.toLowerCase(), id);
  const found: string[] = [];
  for (const token of query.trim().split(ID_SEPARATORS)) {
    const hit = byFold.get(token.toLowerCase());
    if (hit && !found.includes(hit)) found.push(hit);
  }
  return found;
}

export function isBrowse(query: string): boolean {
  return ["", "*", "all"].includes(query.trim().toLowerCase());
}

/** 应用共用的 listing 过滤与排序，再截断到 `limit`。 */
export function filterListings(
  listings: Listing[],
  filters: ListingFilters | null,
  limit: number,
  salesOf: (listingId: string) => number,
): Listing[] {
  if (filters === null) return listings.slice(0, limit);
  let result = listings;
  if (filters.status) result = result.filter((listing) => listing.status === filters.status);
  if (filters.category) {
    const wanted = filters.category.toLowerCase();
    result = result.filter((listing) => (listing.category ?? "").toLowerCase().includes(wanted));
  }
  if (filters.max_stock != null) {
    result = result.filter((listing) => listing.stock <= (filters.max_stock as number));
  }
  if (filters.content_quality) {
    result = result.filter((listing) => listing.content_quality === filters.content_quality);
  }
  const sorted = [...result];
  if (filters.sort === "sales_desc") sorted.sort((a, b) => salesOf(b.listing_id) - salesOf(a.listing_id));
  else if (filters.sort === "stock_asc") sorted.sort((a, b) => a.stock - b.stock);
  else if (filters.sort === "price_desc") sorted.sort((a, b) => b.price - a.price);
  else if (filters.sort === "price_asc") sorted.sort((a, b) => a.price - b.price);
  return sorted.slice(0, limit);
}

export function alertCounts(
  alerts: InventoryAlert[],
  issues: OrderIssue[],
  ledger: ChangeLedger,
): AlertCounts {
  return {
    low_stock: alerts.filter((alert) => alert.kind === "low_stock").length,
    slow_movers: alerts.filter((alert) => alert.kind === "slow_mover").length,
    order_issues: issues.length,
    pending_changes: ledger.pending().length,
  };
}

/** 某区间的合计与对上一窗口的变化，取自带 sales/orders/traffic 的日行。 */
export function snapshotOf(
  rows: DailyRows,
  period: string | null,
  currency: string,
  alerts: AlertCounts,
): BusinessSnapshot {
  const { current, prior, label } = metricWindow(rows, period);
  const num = (row: Record<string, number | string>, key: string): number => Number(row[key] ?? 0);
  const sales = Math.round(current.reduce((sum, row) => sum + num(row, "sales"), 0) * 100) / 100;
  const orders = current.reduce((sum, row) => sum + num(row, "orders"), 0);
  const traffic = current.reduce((sum, row) => sum + num(row, "traffic"), 0);
  const priorSales =
    prior.length > 0
      ? Math.round(prior.reduce((sum, row) => sum + num(row, "sales"), 0) * 100) / 100
      : 0;
  const priorOrders = prior.length > 0 ? prior.reduce((sum, row) => sum + num(row, "orders"), 0) : 0;
  const priorTraffic =
    prior.length > 0 ? prior.reduce((sum, row) => sum + num(row, "traffic"), 0) : 0;
  const conversion = traffic ? Math.round((orders / traffic) * 10000) / 100 : 0;
  const priorConversion = priorTraffic ? Math.round((priorOrders / priorTraffic) * 10000) / 100 : 0;
  return {
    period: label,
    compare_to:
      prior.length > 0 ? `${String(prior[0].date)}/${String(prior[prior.length - 1].date)}` : null,
    sales,
    orders,
    traffic,
    conversion_rate: conversion,
    average_order_value: orders ? Math.round((sales / orders) * 100) / 100 : 0,
    sales_change_pct: changePct(sales, priorSales),
    orders_change_pct: changePct(orders, priorOrders),
    traffic_change_pct: changePct(traffic, priorTraffic),
    conversion_change_pct: priorConversion ? changePct(conversion, priorConversion) : null,
    currency,
    alerts,
  };
}

function changePct(current: number, prior: number): number | null {
  if (prior <= 0) return null;
  return Math.round(((current - prior) / prior) * 1000) / 10;
}

/** 把带日期的序列整体前移，使最后一行落在今天之前的那一周。 */
function rebase(rows: DailyRows, key: string): DailyRows {
  if (rows.length === 0) return rows;
  const last = new Date(Date.parse(`${String(rows[rows.length - 1][key])}T00:00:00Z`));
  last.setUTCDate(last.getUTCDate() + 1);
  const delta = weeksSince(last.toISOString().slice(0, 10));
  if (!delta) return rows;
  return rows.map((row) => ({ ...row, [key]: shiftDay(String(row[key]), delta) }));
}

export function rebaseDaily(rows: DailyRows): DailyRows {
  return rebase(rows, "date");
}

/** 待审批活动的日期窗口，按它们触及的票档列出。 */
export function stagedPromotionWindows(
  ledger: ChangeLedger,
  windows: Record<string, Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const pending = new Map(ledger.pending().map((change) => [change.change_id, change]));
  const result: Array<Record<string, unknown>> = [];
  for (const [changeId, window] of Object.entries(windows)) {
    const change = pending.get(changeId);
    if (!change) continue;
    const entry: Record<string, unknown> = {
      change_id: changeId,
      name: window.name,
      starts: window.starts,
      ends: window.ends,
    };
    if ("nights" in window) entry.nights = window.nights;
    entry.listing_ids = [...new Set(change.items.map((item) => item.target))].sort();
    result.push(entry);
  }
  return result;
}

function applyCampaignItem(
  campaigns: Record<string, Campaign>,
  item: ChangeItem,
): void {
  const existing = campaigns[item.target];
  if (existing && item.field === "budget" && item.after != null) {
    campaigns[item.target] = { ...existing, budget: Number(item.after) };
  }
}

// ---------------------------------------------------------------------------
// 运营后端
// ---------------------------------------------------------------------------

interface PacingTier {
  product_id: string;
  weekly_sold_cum: Array<{ week_start: string; sold_cum: number }>;
  allocations: Record<string, number>;
  sold_at_authoring?: number;
  capacity_at_authoring?: number;
}

interface PacingEvent {
  event_id: string;
  event_date: string;
  on_sale_date?: string;
  baseline_kind?: string;
  tiers: PacingTier[];
}

interface PacingDoc {
  promoter?: string;
  baselines?: Record<string, Array<[number, number]>>;
  events: PacingEvent[];
}

export interface RawMerchantFixtures {
  metrics: { currency?: string; daily: DailyRows };
  pacing: PacingDoc;
  campaigns: { dates_anchored_to?: string; campaigns: Campaign[] };
  messages: { dates_anchored_to?: string; issues: OrderIssue[] };
}

/**
 * 运营工作台后端：票档库存就是引擎的实时可售数，pacing 拿实时计数与同类演出基线比较，
 * 所有写入先变成待审批提案。
 */
export class TicketMerchant {
  private readonly storefrontProducts: Record<string, Product>;
  private readonly storefrontVenues: Record<string, Venue>;
  readonly engine: TicketingEngine;
  readonly ledger: ChangeLedger;

  /** 本会话生效的护栏上限（供界面与投影展示）。 */
  readonly guardrails: MerchantGuardrailConfig;
  /** 自由文本检索复用店面的确定性排名（由调用方注入，避免两侧互相 import）。 */
  private readonly storefrontSearch: (query: string, limit: number) => Product[];
  private readonly daily: DailyRows;
  private readonly currency: string;
  readonly promoterName: string;
  private readonly baselines: Record<string, Array<[number, number]>>;
  private readonly events: Map<string, PacingEvent>;
  /** 每个票档的分配账本是补货可以动用的一笔期初余额。 */
  private readonly allocations = new Map<string, Record<string, number>>();
  private readonly tierHistory = new Map<string, PacingTier["weekly_sold_cum"]>();
  private readonly tierEvent = new Map<string, string>();
  private readonly campaigns: Record<string, Campaign>;
  private readonly issues: OrderIssue[];
  private readonly listingState = new Map<string, { content_quality: ContentQuality; last_price_change?: string; missing_attributes: string[] }>();
  /** 已应用的活动窗口，按票档；待审批活动的日期窗口，按变更 id。 */
  readonly promoWindows = new Map<string, Array<Record<string, unknown>>>();
  private readonly promotionWindows = new Map<string, Record<string, unknown>>();

  constructor(
    private readonly dataset: Dataset,
    engine: TicketingEngine,
    options: {
      fixtures?: RawMerchantFixtures;
      guardrails?: MerchantGuardrailConfig;
      /** 店面的确定性检索，供运营侧自由文本检索复用。 */
      search?: (query: string, limit: number) => Product[];
      now?: () => number;
    } = {},
  ) {
    this.storefrontProducts = dataset.products;
    this.storefrontVenues = dataset.venues;
    this.engine = engine;
    this.guardrails = options.guardrails ?? DEFAULT_GUARDRAILS;
    this.ledger = new ChangeLedger(this.guardrails, options.now);
    this.storefrontSearch = options.search ?? (() => []);

    const fixtures = options.fixtures ?? (merchantFixtures() as unknown as RawMerchantFixtures);
    this.daily = rebaseDaily(fixtures.metrics.daily);
    this.currency = fixtures.metrics.currency ?? "CNY";

    const pacing = this.loadPacing(fixtures.pacing);
    this.promoterName = pacing.promoter ?? "琴台票务 — 武汉演出场馆组合";
    this.baselines = pacing.baselines ?? {};
    this.events = new Map(pacing.events.map((event) => [event.event_id, event]));
    for (const event of pacing.events) {
      for (const tier of event.tiers) {
        this.allocations.set(tier.product_id, { ...tier.allocations });
        this.tierHistory.set(tier.product_id, tier.weekly_sold_cum.map((week) => ({ ...week })));
        this.tierEvent.set(tier.product_id, event.event_id);
      }
    }

    const campaignShift = anchoredShift(fixtures.campaigns, todayIso(this.engine.now()));
    this.campaigns = {};
    for (const row of fixtures.campaigns.campaigns ?? []) {
      const shifted: Campaign = { ...row, currency: "CNY" };
      if (campaignShift) {
        if (shifted.starts) shifted.starts = shiftDay(shifted.starts, campaignShift);
        if (shifted.ends) shifted.ends = shiftDay(shifted.ends, campaignShift);
      }
      this.campaigns[shifted.campaign_id] = shifted;
    }
    const issueShift = anchoredShift(fixtures.messages, todayIso(this.engine.now()));
    this.issues = (fixtures.messages.issues ?? []).map((issue) => {
      const copy: OrderIssue = { ...issue };
      if (copy.opened_at && issueShift) {
        copy.opened_at = new Date(Date.parse(copy.opened_at) + issueShift).toISOString();
      }
      return copy;
    });
  }

  /** pacing 手册随目录场次一起前移，再对齐到本地化后的演出日期。 */
  private loadPacing(pacing: PacingDoc): PacingDoc {
    const delta = this.dataset.calendarShiftMs;
    if (delta) {
      for (const event of pacing.events) {
        if (event.event_date) event.event_date = shiftDay(event.event_date, delta);
        if (event.on_sale_date) event.on_sale_date = shiftDay(event.on_sale_date, delta);
        for (const tier of event.tiers) {
          for (const week of tier.weekly_sold_cum) {
            week.week_start = shiftDay(week.week_start, delta);
          }
        }
      }
    }
    // 让运营 pacing 的日期与本地化后的演出日期一致，同时保留各自的相对周销售历史。
    for (const event of pacing.events) {
      const firstTier = event.tiers?.[0];
      const product = firstTier ? this.storefrontProducts[firstTier.product_id] : undefined;
      const target = product?.attributes.event_date;
      const authored = event.event_date;
      if (!target || !authored) continue;
      const shift = daysBetweenIso(authored, target) * 86_400_000;
      event.event_date = target;
      if (event.on_sale_date) event.on_sale_date = shiftDay(event.on_sale_date, shift);
      for (const tier of event.tiers) {
        for (const week of tier.weekly_sold_cum) {
          week.week_start = shiftDay(week.week_start, shift);
        }
      }
    }
    return pacing;
  }

  // ------------------------------------------------------------------
  // Listing
  // ------------------------------------------------------------------

  private stateRow(productId: string): {
    content_quality: ContentQuality;
    last_price_change?: string;
    missing_attributes: string[];
  } {
    let row = this.listingState.get(productId);
    if (!row) {
      row = { content_quality: "good", missing_attributes: [] };
      this.listingState.set(productId, row);
    }
    return row;
  }

  private listing(productId: string): Listing | null {
    const product = this.storefrontProducts[productId];
    if (!product || !this.tierEvent.has(productId)) return null;
    const row = this.stateRow(productId);
    const remaining = this.engine.remaining(productId);
    return {
      listing_id: product.product_id,
      title: product.title,
      status: remaining === 0 ? "out_of_stock" : "active",
      price: product.price,
      currency: product.currency,
      // 实时可售数——容量 − 售出 − 锁座 − 回流预留，直接来自引擎。
      stock: remaining,
      category: product.category,
      content_quality: row.content_quality,
      attributes: { ...product.attributes },
      image_url: product.image_url,
      short_description: product.short_description,
    };
  }

  allListings(): Listing[] {
    return this.portfolioIds()
      .map((productId) => this.listing(productId))
      .filter((listing): listing is Listing => listing !== null)
      .sort((a, b) => a.listing_id.localeCompare(b.listing_id));
  }

  /** 票房管理的票档：官方票源。观众转票属于观众——运营只看不改。 */
  portfolioIds(): string[] {
    return [...this.tierEvent.keys()].filter((productId) => productId in this.storefrontProducts);
  }

  /**
   * 排期里的场次编号（AT-EVT-…）。
   * `eventPacingRows` 按场次取数，运营工作台需要先拿到这份清单，不能拿票档编号去换。
   */
  eventIds(): string[] {
    return [...this.events.keys()];
  }

  private today(): string {
    return new Date(this.engine.now()).toISOString().slice(0, 10);
  }

  private daysToEvent(eventId: string): number {
    const event = this.events.get(eventId);
    if (!event) return 0;
    return daysBetweenIso(this.today(), event.event_date);
  }

  private baselineAt(kind: string, daysBefore: number): number | null {
    const points = this.baselines[kind];
    if (!points || points.length === 0) return null;
    if (daysBefore >= points[0][0]) return Number(points[0][1]);
    for (let index = 0; index + 1 < points.length; index += 1) {
      const [d1, p1] = points[index];
      const [d2, p2] = points[index + 1];
      if (d2 <= daysBefore && daysBefore <= d1) {
        const span = d1 - d2;
        const t = span ? (d1 - daysBefore) / span : 1;
        return Math.round((p1 + (p2 - p1) * t) * 10) / 10;
      }
    }
    return 100;
  }

  /** 单个票档的实时 pacing 行：引擎计数、fixture 的周历史、到同类基线的差距。 */
  private tierPacing(productId: string): Record<string, unknown> | null {
    const eventId = this.tierEvent.get(productId);
    const product = this.storefrontProducts[productId];
    if (eventId === undefined || !product) return null;
    const event = this.events.get(eventId);
    if (!event) return null;
    const engine = this.engine;
    const capacity = engine.capacity(productId);
    const sold = engine.sold(productId);
    const remaining = engine.remaining(productId);
    const sellThrough = capacity ? Math.round((sold / capacity) * 1000) / 10 : 0;
    const daysToEvent = this.daysToEvent(eventId);
    const baseline = this.baselineAt(event.baseline_kind ?? "", Math.max(daysToEvent, 0));
    const history = this.tierHistory.get(productId) ?? [];
    let weeklyPace: number | null = null;
    if (history.length >= 5) {
      weeklyPace = Math.round(((history[history.length - 1].sold_cum - history[history.length - 5].sold_cum) / 4) * 10) / 10;
    }
    const weeklyBaseline = history.map((week) =>
      this.baselineAt(
        event.baseline_kind ?? "",
        Math.max(daysBetweenIso(shiftDay(week.week_start, 6 * 86_400_000), event.event_date), 0),
      ),
    );
    return {
      product_id: productId,
      tier: product.attributes.tier,
      tier_code: product.attributes.tier_code,
      weekly_baseline_pct: weeklyBaseline,
      price: product.price,
      currency: product.currency,
      capacity,
      sold,
      remaining,
      sell_through_pct: sellThrough,
      baseline_pct: baseline,
      pace_vs_baseline_pts:
        baseline === null ? null : Math.round((sellThrough - baseline) * 10) / 10,
      waitlist_depth: engine.waitlistDepth(productId),
      holds: { ...(this.allocations.get(productId) ?? {}) },
      weekly_sold_cum: history.map((week) => ({ ...week })),
      recent_weekly_sales: weeklyPace,
    };
  }

  eventPacingRows(eventIds: string[]): Array<Record<string, unknown>> {
    const rows: Array<Record<string, unknown>> = [];
    for (const eventId of eventIds) {
      const event = this.events.get(eventId);
      if (!event) continue;
      const tiers = event.tiers
        .map((tier) => this.tierPacing(tier.product_id))
        .filter((row): row is Record<string, unknown> => row !== null);
      const sample = this.storefrontProducts[event.tiers[0]?.product_id];
      const attributes = sample?.attributes ?? {};
      rows.push({
        event_id: eventId,
        event_name: attributes.event_name ?? eventId,
        venue: attributes.venue,
        venue_id: attributes.venue_id,
        city: attributes.city,
        event_date: event.event_date,
        on_sale_date: event.on_sale_date,
        days_to_event: this.daysToEvent(eventId),
        baseline_kind: event.baseline_kind,
        tiers,
      });
    }
    return rows;
  }

  /** 工作台的 pacing 读数：每个场次的行、待审批的活动窗口，以及场馆几何。 */
  pacingOverview(): Record<string, unknown> {
    const events = this.eventPacingRows([...this.events.keys()]);
    const venueIds = new Set(
      events.map((event) => event.venue_id).filter((id): id is string => typeof id === "string"),
    );
    const venues: Record<string, Venue> = {};
    for (const venueId of venueIds) {
      if (this.storefrontVenues[venueId]) venues[venueId] = structuredClone(this.storefrontVenues[venueId]);
    }
    return { events, staged_windows: this.stagedPromotionWindows(), venues };
  }

  stagedPromotionWindows(): Array<Record<string, unknown>> {
    return stagedPromotionWindows(this.ledger, Object.fromEntries(this.promotionWindows));
  }

  /** 工作台首页的近期场次——每场带实时售出/余量合计。 */
  todaySnapshot(): Record<string, unknown> | null {
    const upcoming = [...this.events.keys()]
      .filter((eventId) => this.daysToEvent(eventId) >= 0)
      .sort((a, b) => this.daysToEvent(a) - this.daysToEvent(b))
      .slice(0, 3);
    if (upcoming.length === 0) return null;
    const engine = this.engine;
    const shows = upcoming.map((eventId) => {
      const event = this.events.get(eventId) as PacingEvent;
      const tierIds = event.tiers.map((tier) => tier.product_id);
      const sample = this.storefrontProducts[tierIds[0]];
      return {
        event_id: eventId,
        event_name: sample?.attributes.event_name ?? eventId,
        venue: sample?.attributes.venue,
        event_date: event.event_date,
        days_to_event: this.daysToEvent(eventId),
        sold: tierIds.reduce((sum, pid) => sum + engine.sold(pid), 0),
        capacity: tierIds.reduce((sum, pid) => sum + engine.capacity(pid), 0),
        remaining: tierIds.reduce((sum, pid) => sum + engine.remaining(pid), 0),
        waitlist_depth: tierIds.reduce((sum, pid) => sum + engine.waitlistDepth(pid), 0),
      };
    });
    return { upcoming: shows };
  }

  // ------------------------------------------------------------------
  // 经营指标
  // ------------------------------------------------------------------

  alertCounts(): AlertCounts {
    return alertCounts(this.computeAlerts(), this.issues, this.ledger);
  }

  getBusinessSnapshot(period: string | null = null): BusinessSnapshot {
    return snapshotOf(this.daily, period, this.currency, this.alertCounts());
  }

  private eventForSegment(segment: string | null): string | null {
    if (!segment) return null;
    const cleaned = segment.trim().toLowerCase();
    for (const [eventId, event] of this.events) {
      const sample = this.storefrontProducts[event.tiers[0]?.product_id];
      const name = (sample?.attributes.event_name ?? "").toLowerCase();
      if (cleaned === eventId.toLowerCase() || (name && [name, name.replace(/ /g, "-")].includes(cleaned))) {
        return eventId;
      }
    }
    return null;
  }

  queryMetrics(
    metric: string,
    period: string | null = null,
    granularity: "day" | "week" = "day",
    segment: string | null = null,
  ): MetricSeries {
    const cleaned = metric.trim().toLowerCase().replace(/[\s-]/g, "_");
    const segmentCleaned = (segment ?? "").trim() || null;

    // 命名某个场次的 segment 改为读 pacing 手册的周历史。
    const eventId = this.eventForSegment(segmentCleaned);
    const weeklyMetrics = new Set([
      "sold",
      "sold_cum",
      "tickets",
      "tickets_sold",
      "sell_through",
      "sell_through_pct",
    ]);
    if (eventId !== null && weeklyMetrics.has(cleaned)) {
      const event = this.events.get(eventId) as PacingEvent;
      const tierIds = event.tiers.map((tier) => tier.product_id);
      const histories = tierIds
        .map((pid) => this.tierHistory.get(pid))
        .filter((history): history is PacingTier["weekly_sold_cum"] => Boolean(history));
      const longest = histories.reduce(
        (best, history) => (history.length > best.length ? history : best),
        [] as PacingTier["weekly_sold_cum"],
      );
      const weeks = longest.map((entry) => entry.week_start);
      const capacity = tierIds.reduce((sum, pid) => sum + this.engine.capacity(pid), 0);
      const cumAt = (weekStart: string): number => {
        let total = 0;
        for (const history of histories) {
          let value = 0;
          for (const entry of history) if (entry.week_start <= weekStart) value = entry.sold_cum;
          total += value;
        }
        return total;
      };
      const points: MetricPoint[] = [];
      let prev = 0;
      for (const weekStart of weeks) {
        const cum = cumAt(weekStart);
        let value: number;
        if (["tickets", "tickets_sold"].includes(cleaned)) value = cum - prev;
        else if (["sell_through", "sell_through_pct"].includes(cleaned)) {
          value = capacity ? Math.round((cum / capacity) * 1000) / 10 : 0;
        } else value = cum;
        points.push({ date: weekStart, value });
        prev = cum;
      }
      return {
        metric: cleaned.startsWith("sell_through") ? "sell_through" : cleaned,
        unit: cleaned.startsWith("sell_through") ? "%" : null,
        granularity: "week",
        period: weeks.length ? `${weeks[0]}/${weeks[weeks.length - 1]}` : null,
        segment: eventId,
        points,
      };
    }

    const { current, label } = metricWindow(this.daily, period ?? "last_30_days");
    const amphitheater = segmentCleaned !== null && segmentCleaned.toLowerCase() === "amphitheater";
    const valueFor = (rows: DailyRows): number => {
      const num = (row: Record<string, number | string>, key: string): number => Number(row[key] ?? 0);
      const sales = rows.reduce(
        (sum, row) => sum + num(row, amphitheater ? "amphitheater_sales" : "sales"),
        0,
      );
      const orders = rows.reduce((sum, row) => sum + num(row, "orders"), 0);
      const tickets = rows.reduce((sum, row) => sum + num(row, "tickets"), 0);
      const traffic = rows.reduce((sum, row) => sum + num(row, "traffic"), 0);
      if (["sales", "gross"].includes(cleaned)) return Math.round(sales * 100) / 100;
      if (cleaned === "orders") return orders;
      if (["tickets", "tickets_sold"].includes(cleaned)) return tickets;
      if (cleaned === "traffic") return traffic;
      if (["conversion", "conversion_rate"].includes(cleaned)) {
        return traffic ? Math.round((orders / traffic) * 10000) / 100 : 0;
      }
      if (["average_order_value", "aov"].includes(cleaned)) {
        return orders ? Math.round((sales / orders) * 100) / 100 : 0;
      }
      if (cleaned === "average_ticket_price") {
        return tickets ? Math.round((sales / tickets) * 100) / 100 : 0;
      }
      return Math.round(sales * 100) / 100;
    };

    const points: MetricPoint[] =
      granularity === "week"
        ? Array.from({ length: Math.ceil(current.length / 7) }, (_, index) => ({
            date: String(current[index * 7].date),
            value: valueFor(current.slice(index * 7, index * 7 + 7)),
          }))
        : current.map((row) => ({ date: String(row.date), value: valueFor([row]) }));

    return {
      metric: cleaned === "gross" ? "gross" : cleaned,
      unit: MONEY_METRICS.has(cleaned)
        ? this.currency
        : ["conversion", "conversion_rate"].includes(cleaned)
          ? "%"
          : null,
      granularity: granularity === "week" ? "week" : "day",
      period: label,
      segment: amphitheater ? "amphitheater" : segmentCleaned,
      points,
    };
  }

  getCampaignPerformance(campaignId: string | null = null): Campaign[] {
    const campaigns = Object.values(this.campaigns);
    return campaignId ? campaigns.filter((campaign) => campaign.campaign_id === campaignId) : campaigns;
  }

  // ------------------------------------------------------------------
  // 目录检索
  // ------------------------------------------------------------------

  searchListings(
    _session: MerchantSessionContext,
    query: string,
    filters: ListingFilters | null = null,
    limit = 8,
  ): Listing[] {
    const portfolio = new Set(this.portfolioIds());
    const ids = namedIds(query, portfolio);
    let listings: Listing[];
    if (ids.length > 0) {
      listings = ids
        .map((productId) => this.listing(productId))
        .filter((listing): listing is Listing => listing !== null);
    } else if (isBrowse(query)) {
      listings = this.allListings();
    } else {
      listings = this.searchViaStorefront(query)
        .filter((productId) => portfolio.has(productId))
        .map((productId) => this.listing(productId))
        .filter((listing): listing is Listing => listing !== null);
    }
    return filterListings(listings, filters, limit, (id) => this.engine.sold(id));
  }

  /**
   * 运营侧的自由文本检索复用店面搜索的确定性排名，但只保留运营自有的官方票档。
   */
  private searchViaStorefront(query: string): string[] {
    return this.storefrontSearch(query, 8).map((product) => product.product_id);
  }

  getListing(listingId: string): ListingDetails | null {
    const resolved = [...this.tierEvent.keys()].find(
      (key) => key.toLowerCase() === listingId.toLowerCase(),
    );
    if (!resolved) return null;
    const product = this.storefrontProducts[resolved];
    if (!product) return null;
    const listing = this.listing(product.product_id);
    if (!listing) return null;
    const row = this.stateRow(product.product_id);
    const pacing = this.tierPacing(product.product_id) ?? {};
    const weekly = pacing.recent_weekly_sales as number | null | undefined;
    return {
      ...listing,
      long_description: product.long_description,
      review_snippets: [...product.review_highlights],
      sales_last_30d: weekly != null ? Math.round((weekly * 30) / 7) : null,
      missing_attributes: row.missing_attributes,
    };
  }

  // ------------------------------------------------------------------
  // 库存与订单健康
  // ------------------------------------------------------------------

  /** `low_stock` 是即将售罄的票档；`slow_mover` 是明显低于基线的票档。 */
  computeAlerts(): InventoryAlert[] {
    const alerts: InventoryAlert[] = [];
    for (const productId of this.portfolioIds()) {
      const pacing = this.tierPacing(productId);
      if (!pacing) continue;
      const capacity = Number(pacing.capacity);
      const remaining = Number(pacing.remaining);
      const floor = Math.max(NEARLY_SOLD_OUT_FLOOR, Math.floor(capacity / 50));
      const weekly = (pacing.recent_weekly_sales as number | null) ?? null;
      const sales30d = weekly != null ? Math.round((weekly * 30) / 7) : null;
      const title = this.storefrontProducts[productId].title;
      if (remaining > 0 && remaining <= floor) {
        alerts.push({
          listing_id: productId,
          title,
          kind: "low_stock",
          stock: remaining,
          threshold: floor,
          days_of_cover: weekly ? Math.round((remaining / (weekly / 7)) * 10) / 10 : null,
          sales_last_30d: sales30d,
          storefront_visible: true,
        });
        continue;
      }
      const pace = pacing.pace_vs_baseline_pts as number | null;
      if (remaining > 0 && pace !== null && pace <= -UNDER_PACE_ALERT_PTS) {
        alerts.push({
          listing_id: productId,
          title,
          kind: "slow_mover",
          stock: remaining,
          threshold: null,
          days_of_cover: null,
          sales_last_30d: sales30d,
          storefront_visible: true,
        });
      }
    }
    // 低于基线的票档是运营最该动的项——排在即将售罄之前，且余量最多的（风险最大）在前。
    alerts.sort((a, b) => {
      const kindOrder = Number(a.kind !== "slow_mover") - Number(b.kind !== "slow_mover");
      return kindOrder || b.stock - a.stock;
    });
    return alerts;
  }

  getOrderIssues(): OrderIssue[] {
    return this.issues.map((issue) => ({ ...issue }));
  }

  // ------------------------------------------------------------------
  // 定价
  // ------------------------------------------------------------------

  private feesSum(productId: string): number {
    const product = this.storefrontProducts[productId];
    if (!product) return 0;
    const total = FEE_ATTRS.reduce(
      (sum, attr) => sum + (Number(product.attributes[attr] ?? 0) || 0),
      0,
    );
    return Math.round(total * 100) / 100;
  }

  /** 费用加票面价，再加票面价中艺人及场馆的份额。 */
  private unitCost(productId: string): number | null {
    const product = this.storefrontProducts[productId];
    if (!product) return null;
    const fees = this.feesSum(productId);
    const face = Number(product.attributes.face_price_usd ?? product.price - fees);
    return Math.round((fees + face * HOUSE_COST_SHARE) * 100) / 100;
  }

  getPricingContext(listingId: string): PricingContext | null {
    const resolved = [...this.tierEvent.keys()].find(
      (key) => key.toLowerCase() === listingId.toLowerCase(),
    );
    if (!resolved) return null;
    const product = this.storefrontProducts[resolved];
    const pacing = this.tierPacing(resolved) ?? {};
    const row = this.stateRow(resolved);
    const unitCost = this.unitCost(resolved);
    const pace = pacing.pace_vs_baseline_pts as number | null | undefined;
    let demand: "rising" | "steady" | "falling";
    if (pace == null) demand = "steady";
    else if (pace <= -UNDER_PACE_ALERT_PTS) demand = "falling";
    else if (pace >= 10) demand = "rising";
    else demand = "steady";
    const fees = this.feesSum(resolved);
    const eventId = this.tierEvent.get(resolved) ?? null;
    return {
      listing_id: resolved,
      current_price: product.price,
      currency: product.currency,
      unit_cost: unitCost,
      margin_pct: unitCost ? marginPct(product.price, unitCost) : null,
      // 任何改价的地板：费用原样保留，票面价必须继续覆盖艺人及场馆的份额。
      min_price: unitCost ? Math.round(unitCost * 1.05 * 100) / 100 : null,
      max_price: Math.round(product.price * 1.25 * 100) / 100,
      max_price_delta_pct: this.guardrails.max_price_delta_pct,
      max_promotion_discount_pct: this.guardrails.max_promotion_discount_pct,
      price_unit: "per_ticket_all_in",
      demand_signal: demand,
      last_changed: row.last_price_change ?? null,
      event_id: eventId,
      event_date: eventId ? (this.events.get(eventId)?.event_date ?? null) : null,
      days_to_event: eventId ? this.daysToEvent(eventId) : null,
      capacity: (pacing.capacity as number) ?? null,
      sold: (pacing.sold as number) ?? null,
      remaining: (pacing.remaining as number) ?? null,
      sell_through_pct: (pacing.sell_through_pct as number) ?? null,
      baseline_pct: (pacing.baseline_pct as number) ?? null,
      pace_vs_baseline_pts: pace ?? null,
      waitlist_depth: (pacing.waitlist_depth as number) ?? null,
      holds: (pacing.holds as Record<string, number>) ?? {},
      fees_usd: fees,
      active_promotions: (this.promoWindows.get(resolved) ?? []).map((window) => ({ ...window })),
    };
  }

  // ------------------------------------------------------------------
  // 暂存写入
  // ------------------------------------------------------------------

  private faceNote(productId: string, newPrice: number): string {
    const fees = this.feesSum(productId);
    const product = this.storefrontProducts[productId];
    const oldFace = Number(product.attributes.face_price_usd ?? product.price - fees);
    return (
      `${productId}: 含全部费用 ¥${product.price.toFixed(2)} → ¥${newPrice.toFixed(2)}；` +
      `费用 ¥${fees.toFixed(2)} 保持不变，票面价 ¥${oldFace.toFixed(2)} → ¥${(newPrice - fees).toFixed(2)}`
    );
  }

  stageListingUpdate(
    session: MerchantSessionContext,
    listingId: string,
    fields: Record<string, unknown>,
    note: string | null = null,
  ): StagedChange {
    const listing = this.getListing(listingId);
    if (!listing) throw new Error(`没有票档 ${listingId}`);
    const items: ChangeItem[] = Object.entries(fields).map(([name, value]) => ({
      target: listing.listing_id,
      field: name,
      before:
        (listing as unknown as Record<string, unknown>)[name] ??
        listing.attributes[name] ??
        null,
      after: value,
    }));
    return this.ledger.stage({
      kind: "listing_update",
      summary: note ?? `更新票档内容 ${listing.listing_id}`,
      items,
      actor: session.operator,
      actor_kind: "agent",
    });
  }

  /** 含全部费用的改价；价格不高于费用行时被拒绝。 */
  stagePriceUpdate(
    session: MerchantSessionContext,
    items: PriceUpdateItem[],
    note: string | null = null,
  ): StagedChange {
    const changeItems: ChangeItem[] = [];
    let marginImpact = 0;
    const margins: Array<[number, number]> = [];
    const notes: string[] = [];
    let currency: string | null = null;
    for (const item of items) {
      // 解析不到的 id 直接拒绝，绝不暂存成一个死项：无变化的 ChangeItem 会绕过费用地板
      // 然后「应用」成空操作。
      const resolved = [...this.tierEvent.keys()].find(
        (key) => key.toLowerCase() === item.listing_id.toLowerCase(),
      );
      if (!resolved) throw new Error(`没有票档 ${item.listing_id}`);
      const product = this.storefrontProducts[resolved];
      const fees = this.feesSum(resolved);
      if (item.new_price <= fees) {
        // 一条护栏拒绝，模型可以直接引用；不是工具故障。
        throw new GuardrailViolation([
          `${resolved}: 新价格 ¥${item.new_price.toFixed(2)} 不高于费用合计 ¥${fees.toFixed(2)}；` +
            "票面价会变成零或负数，请把价格设在费用底线之上。",
        ]);
      }
      currency = currency ?? product.currency;
      const pacing = this.tierPacing(resolved) ?? {};
      const weekly = (pacing.recent_weekly_sales as number | null) ?? 0;
      marginImpact += (item.new_price - product.price) * weekly;
      const unitCost = this.unitCost(resolved);
      if (unitCost !== null) {
        margins.push([marginPct(product.price, unitCost), marginPct(item.new_price, unitCost)]);
      }
      notes.push(this.faceNote(resolved, item.new_price));
      changeItems.push({
        target: resolved,
        field: "price",
        before: product.price,
        after: item.new_price,
      });
    }
    return this.ledger.stage({
      kind: "price_update",
      summary: note ?? `对 ${items.length} 个票档改价`,
      items: changeItems,
      actor: session.operator,
      actor_kind: "agent",
      currency,
      margin_impact: Math.round(marginImpact * 100) / 100,
      margin_before_pct: margins.length === 1 ? margins[0][0] : null,
      margin_after_pct: margins.length === 1 ? margins[0][1] : null,
      guardrail_notes: notes.length > 0 ? notes : null,
    });
  }

  private releasable(productId: string): number {
    const allocations = this.allocations.get(productId) ?? {};
    return RELEASABLE_BUCKETS.reduce((sum, bucket) => sum + Math.trunc(allocations[bucket] ?? 0), 0);
  }

  /** 补货从运营与制作保留中释放座位，并把分配账本写进说明；赠票与作废票不可释放，在售暂停会被拒绝。 */
  stageInventoryAction(
    session: MerchantSessionContext,
    items: InventoryActionItem[],
    note: string | null = null,
  ): StagedChange {
    const changeItems: ChangeItem[] = [];
    const notes: string[] = [];
    for (const item of items) {
      const resolved = [...this.tierEvent.keys()].find(
        (key) => key.toLowerCase() === item.listing_id.toLowerCase(),
      );
      if (!resolved) throw new Error(`没有票档 ${item.listing_id}`);
      if (item.action !== "restock") {
        throw new ChangeNotApplicable(
          "琴台票务 Demo 不支持在售中直接暂停票档；请通过释放模拟库存和调整价格来管理场次。",
        );
      }
      const quantity = item.quantity ?? 0;
      const releasable = this.releasable(resolved);
      const allocations = this.allocations.get(resolved) ?? {};
      if (quantity < 1) throw new GuardrailViolation(["释放需要填写座位数量。"]);
      if (quantity > releasable) {
        // 与费用地板同一套拒绝契约：分配算术就是答案，必须以护栏消息的形式到达操作者。
        throw new GuardrailViolation([
          `${resolved} 只有 ${releasable} 张可释放座位（运营保留 ${Math.trunc(allocations.promoter_hold ?? 0)}，` +
            `制作保留 ${Math.trunc(allocations.production_hold ?? 0)}）；赠票与作废票不可释放——请减少数量。`,
        ]);
      }
      const current = this.engine.capacity(resolved);
      const promoter = Math.trunc(allocations.promoter_hold ?? 0);
      const fromPromoter = Math.min(quantity, promoter);
      const fromProduction = quantity - fromPromoter;
      let source = `${fromPromoter} 张来自 ${promoter} 张的运营保留`;
      if (fromProduction) {
        source +=
          `，${fromProduction} 张来自 ${Math.trunc(allocations.production_hold ?? 0)} 张的制作保留`;
      }
      notes.push(
        `${resolved}: 释放 ${source}；赠票（${Math.trunc(allocations.comps ?? 0)}）与作废票` +
          `（${Math.trunc(allocations.kills ?? 0)}）继续不售`,
      );
      changeItems.push({
        target: resolved,
        field: "on_sale_capacity",
        before: current,
        after: current + quantity,
      });
    }
    return this.ledger.stage({
      kind: "inventory_action",
      summary: note ?? `释放 ${items.length} 个票档的保留座位`,
      items: changeItems,
      actor: session.operator,
      actor_kind: "agent",
      guardrail_notes: notes.length > 0 ? notes : null,
    });
  }

  /** 有日期的价格步骤，向下（早鸟）或向上（清仓）；应用时记为一个窗口，常设价不动。 */
  stagePromotion(session: MerchantSessionContext, promotion: PromotionDraft): StagedChange {
    let windowDays: number;
    try {
      windowDays = Math.max(
        1,
        daysBetweenIso(promotion.starts, promotion.ends) + 1,
      );
    } catch {
      windowDays = 7;
    }
    const items: ChangeItem[] = [];
    let marginImpact = 0;
    const margins: Array<[number, number]> = [];
    const notes: string[] = [];
    let currency: string | null = null;
    for (const listingId of promotion.listing_ids) {
      const resolved = [...this.tierEvent.keys()].find(
        (key) => key.toLowerCase() === listingId.toLowerCase(),
      );
      if (!resolved) throw new Error(`没有票档 ${listingId}`);
      const product = this.storefrontProducts[resolved];
      currency = currency ?? product.currency;
      const fees = this.feesSum(resolved);
      const promoPrice = Math.round(product.price * (1 - promotion.discount_pct / 100) * 100) / 100;
      if (promoPrice <= fees) {
        throw new GuardrailViolation([
          `${resolved}: 活动价 ¥${promoPrice.toFixed(2)} 不高于费用合计 ¥${fees.toFixed(2)}，请降低折扣幅度。`,
        ]);
      }
      const pacing = this.tierPacing(resolved) ?? {};
      const weekly = (pacing.recent_weekly_sales as number | null) ?? 0;
      const discountValue = (product.price * promotion.discount_pct) / 100;
      marginImpact -= ((discountValue * weekly) / 7) * windowDays;
      const unitCost = this.unitCost(resolved);
      if (unitCost !== null) {
        const marginBefore = marginPct(product.price, unitCost);
        const marginAfter = marginPct(promoPrice, unitCost);
        margins.push([marginBefore, marginAfter]);
        notes.push(
          `${resolved} 毛利：${marginBefore}% → ${marginAfter}%（${marginAfter - marginBefore >= 0 ? "+" : ""}` +
            `${(marginAfter - marginBefore).toFixed(1)} 个百分点），窗口期内`,
        );
      }
      items.push({ target: resolved, field: "price", before: product.price, after: promoPrice });
    }
    const direction = promotion.discount_pct >= 0 ? "下调" : "上调";
    const change = this.ledger.stage({
      kind: "promotion",
      summary:
        `${promotion.name}（含全部费用价格${direction} ${Math.abs(promotion.discount_pct).toFixed(0)}%，` +
        `${promotion.starts} 至 ${promotion.ends}）`,
      items,
      actor: session.operator,
      actor_kind: "agent",
      currency,
      margin_impact: Math.round(marginImpact * 100) / 100,
      margin_before_pct: margins.length === 1 ? margins[0][0] : null,
      margin_after_pct: margins.length === 1 ? margins[0][1] : null,
      guardrail_notes: notes.length > 0 ? notes : null,
    });
    this.promotionWindows.set(change.change_id, {
      starts: promotion.starts,
      ends: promotion.ends,
      discount_pct: promotion.discount_pct,
      name: promotion.name,
    });
    return change;
  }

  stageCampaign(session: MerchantSessionContext, draft: CampaignDraft): StagedChange {
    const existing = draft.campaign_id ? this.campaigns[draft.campaign_id] : undefined;
    const target = draft.campaign_id ?? draft.name;
    const items: ChangeItem[] = [];
    if (draft.budget != null || existing === undefined) {
      items.push({
        target,
        field: "budget",
        before: existing ? existing.budget : null,
        after: draft.budget ?? null,
      });
    }
    for (const name of ["audience", "copy_text"] as const) {
      const value = draft[name];
      if (value) items.push({ target, field: name, before: null, after: value });
    }
    if (items.length === 0) {
      throw new ChangeNotApplicable(`${target}: 该草案没有改动预算、受众或文案。`);
    }
    return this.ledger.stage({
      kind: "campaign",
      summary: `活动草案：${draft.name}`,
      items,
      actor: session.operator,
      actor_kind: "agent",
      currency: this.currency,
    });
  }

  getPendingChanges(): StagedChange[] {
    return this.ledger.pending();
  }

  applyChange(session: MerchantSessionContext, changeId: string): StagedChange {
    // 两次针对同一余额的释放可能在暂存时各自通过、合起来超出保留桶，所以应用时复校一次。
    const pending = this.ledger.pending().find((change) => change.change_id === changeId) ?? null;
    if (pending && pending.kind === "inventory_action") {
      for (const item of pending.items) {
        if (item.field !== "on_sale_capacity") continue;
        const released = Math.trunc(Number(item.after)) - Math.trunc(Number(item.before));
        const releasable = this.releasable(item.target);
        if (released > releasable) {
          throw new GuardrailViolation([
            `${item.target} 现在只有 ${releasable} 张可释放座位（另一笔释放已经动用了保留）——` +
              "请按当前余额重新暂存这笔释放。",
          ]);
        }
      }
    }
    const applied = this.ledger.apply(changeId, session.operator);
    this.applyToLiveState(applied);
    return applied;
  }

  discardChange(
    session: MerchantSessionContext,
    changeId: string,
    actorKind: ActorKind = "operator",
  ): StagedChange {
    const discarded = this.ledger.discard(changeId, session.operator, actorKind);
    this.promotionWindows.delete(changeId);
    return discarded;
  }

  /** 从保留桶里扣减已释放的座位，运营保留优先。 */
  private drainRelease(productId: string, quantity: number): void {
    const allocations = this.allocations.get(productId) ?? {};
    this.allocations.set(productId, allocations);
    let remaining = quantity;
    for (const bucket of RELEASABLE_BUCKETS) {
      const take = Math.min(Math.trunc(allocations[bucket] ?? 0), remaining);
      if (take) {
        allocations[bucket] = Math.trunc(allocations[bucket] ?? 0) - take;
        remaining -= take;
      }
      if (remaining === 0) break;
    }
  }

  /** 把已应用的变更写穿到实时状态：释放增加引擎容量；改价同时更新标价与票面价属性。 */
  private applyToLiveState(change: StagedChange): void {
    for (const item of change.items) {
      const product = this.storefrontProducts[item.target];
      if (!product) {
        // 活动项的目标是活动 id。
        if (change.kind === "campaign") applyCampaignItem(this.campaigns, item);
        continue;
      }
      const row = this.stateRow(item.target);
      if (change.kind === "price_update") {
        const fees = this.feesSum(item.target);
        product.price = Number(item.after);
        product.attributes.face_price_usd = (Number(item.after) - fees).toFixed(2);
        row.last_price_change = this.today();
      } else if (change.kind === "inventory_action" && item.field === "on_sale_capacity") {
        const released = Math.trunc(Number(item.after)) - Math.trunc(Number(item.before));
        if (released > 0) {
          this.engine.addCapacity(item.target, released);
          this.drainRelease(item.target, released);
        }
      } else if (change.kind === "listing_update") {
        if (["title", "short_description", "long_description", "category"].includes(item.field)) {
          (product as unknown as Record<string, unknown>)[item.field] = item.after;
        } else if (item.field === "content_quality") {
          row.content_quality = item.after as ContentQuality;
        } else {
          product.attributes[item.field] = String(item.after);
        }
      } else if (change.kind === "promotion") {
        const window = this.promotionWindows.get(change.change_id) ?? {};
        const list = this.promoWindows.get(item.target) ?? [];
        list.push({
          starts: window.starts,
          ends: window.ends,
          promo_price: Number(item.after),
          standing_price: item.before == null ? null : Number(item.before),
          discount_pct: window.discount_pct,
          summary: change.summary,
          change_id: change.change_id,
        });
        this.promoWindows.set(item.target, list);
      }
    }
  }

  // ------------------------------------------------------------------
  // 运营上下文
  // ------------------------------------------------------------------

  getMerchantContext(session: MerchantSessionContext): Record<string, unknown> {
    const counts = this.alertCounts();
    const latest = String(this.daily[this.daily.length - 1].date);
    const weekStart = shiftDay(latest, -6 * 86_400_000);
    const engine = this.engine;
    return {
      promoter: this.promoterName,
      box_office: this.dataset.storeName,
      operator: session.operator,
      current_period: `${weekStart}/${latest}`,
      events: [...this.events.entries()].map(([eventId, event]) => ({
        event_id: eventId,
        event_date: event.event_date,
        days_to_event: this.daysToEvent(eventId),
        sold_out: event.tiers.every((tier) => engine.remaining(tier.product_id) === 0),
      })),
      alerts: {
        under_pacing: counts.slow_movers,
        nearly_sold_out: counts.low_stock,
        fan_messages: counts.order_issues,
        pending_changes: counts.pending_changes,
      },
    };
  }
}

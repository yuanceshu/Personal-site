/**
 * 共享查表工具（移植自 `examples/demo_common/storefront_fixtures.py` 与
 * `demo_common/merchant_fixtures.py` 中与票务相关、必须逐字节等价的部分）：
 * 关键词打分与排序、订单/政策检索、日期锚定前移、指标窗口算术。
 */

import type { CartItem, Order, Policy, Product, UserPreferences } from "../types";

const WORD = /[a-z0-9]+/g;
const ISO_DATE = /\d{4}-\d{2}-\d{2}/g;
const IN_FLIGHT_STATUSES = new Set(["processing", "shipped", "delayed"]);

/** 摘要（列表/搜索结果）不携带的字段。 */
export const SUMMARY_EXCLUDES = new Set([
  "long_description",
  "specs",
  "review_highlights",
  "variants",
]);

const HELP_STOPWORDS = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from",
  "get", "how", "i", "if", "in", "is", "it", "its", "me", "my", "of", "on", "or", "so", "that",
  "the", "there", "this", "to", "up", "we", "what", "when", "which", "will", "with", "you", "your",
]);

export interface SearchFilters {
  min_price?: number | null;
  max_price?: number | null;
  min_rating?: number | null;
  category?: string | null;
  attributes?: Record<string, string>;
  sort?: "relevance" | "price_asc" | "price_desc" | "rating";
}

export function tokens(text: string): string[] {
  return text.toLowerCase().match(WORD) ?? [];
}

export function stem(token: string): string {
  return token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token;
}

export function keywordScore(
  fields: Record<string, string>,
  weights: Record<string, number>,
  queryTokens: string[],
  synonyms: Record<string, string[]>,
): number {
  const stemmedFields: Record<string, Set<string>> = {};
  for (const [name, text] of Object.entries(fields)) {
    stemmedFields[name] = new Set(tokens(text).map(stem));
  }
  let score = 0;
  for (const token of queryTokens) {
    const base = stem(token);
    const candidates = [base, ...(synonyms[base] ?? []).map(stem)];
    let best = 0;
    for (const [name, weight] of Object.entries(weights)) {
      if (candidates.some((candidate) => stemmedFields[name]?.has(candidate))) {
        best = Math.max(best, weight);
      }
    }
    score += best;
  }
  return score;
}

export function withinPriceAndRating(product: Product, filters: SearchFilters): boolean {
  if (filters.min_price != null && product.price < filters.min_price) return false;
  if (filters.max_price != null && product.price > filters.max_price) return false;
  return filters.min_rating == null || (product.rating ?? 0) >= filters.min_rating;
}

export function matchesAttributeFilters(
  product: Product,
  filters: SearchFilters,
  ignore: ReadonlySet<string> = new Set(),
): boolean {
  if (filters.category && !product.category.toLowerCase().includes(filters.category.toLowerCase())) {
    return false;
  }
  const haystack =
    Object.entries(product.attributes)
      .map(([k, v]) => `${k}=${v}`.toLowerCase())
      .join(" ") +
    " " +
    product.title.toLowerCase();
  for (const [key, value] of Object.entries(filters.attributes ?? {})) {
    if (ignore.has(key)) continue;
    const actual = product.attributes[key];
    const target = actual == null ? haystack : actual.toLowerCase();
    if (!target.includes(String(value).toLowerCase())) return false;
  }
  return true;
}

export interface RankOptions {
  score: (product: Product, queryTokens: string[]) => number;
  hardFilter: (product: Product, filters: SearchFilters) => boolean;
  softFilter: (product: Product, filters: SearchFilters) => boolean;
  relevanceTiebreak?: (product: Product) => number;
}

/** 所有 mock 共用的排序：硬过滤 → 半数相关度截断 → 软过滤（清空则回退）→ 指定排序。 */
export function rankProducts(
  products: Iterable<Product>,
  query: string,
  filters: SearchFilters | null,
  limit: number,
  options: RankOptions,
): Product[] {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return [];
  const tiebreak = options.relevanceTiebreak ?? (() => 0);
  let scored: Array<[number, Product]> = [];
  for (const product of products) {
    if (filters === null || options.hardFilter(product, filters)) {
      scored.push([options.score(product, queryTokens), product]);
    }
  }
  scored = scored.filter(([points]) => points > 0);
  if (scored.length > 0) {
    const best = Math.max(...scored.map(([points]) => points));
    scored = scored.filter(([points]) => points >= best / 2);
  }
  if (filters !== null) {
    const narrowed = scored.filter(([, product]) => options.softFilter(product, filters as SearchFilters));
    scored = narrowed.length > 0 ? narrowed : scored;
  }
  const sort = filters?.sort ?? "relevance";
  if (sort === "price_asc") scored.sort((a, b) => a[1].price - b[1].price);
  else if (sort === "price_desc") scored.sort((a, b) => b[1].price - a[1].price);
  else if (sort === "rating") scored.sort((a, b) => tiebreak(a[1]) - tiebreak(b[1]));
  else scored.sort((a, b) => b[0] - a[0] || tiebreak(a[1]) - tiebreak(b[1]));
  return scored.slice(0, limit).map(([, product]) => product);
}

/** 目录列表/搜索结果：剔除详情字段。 */
export function summaryOf(product: Product): Product {
  const copy: Record<string, unknown> = { ...product };
  for (const key of SUMMARY_EXCLUDES) delete copy[key];
  return copy as unknown as Product;
}

export function findById(items: Record<string, unknown>, wanted: string): string | null {
  if (wanted in items) return wanted;
  const lowered = wanted.toLowerCase();
  return Object.keys(items).find((key) => key.toLowerCase() === lowered) ?? null;
}

/**
 * 帮助条目的词项：英文按 `tokens` + 去停用词，中文按相邻二字切分（bigram）。
 *
 * 源实现只做英文分词（`_WORD = [a-z0-9]+`），因为源政策文案是英文。本地化后政策与
 * 用户的提问都是中文，中文若不切分则恒为空集，`searchHelp` 会永远返回空。这里补一层
 * bigram 只为「帮助/政策」检索服务，**不改动** `keywordScore` 共用的 `tokens`，
 * 因此商品搜索的排名仍与源实现逐字等价。
 */
const CJK_RUN = /[\u4e00-\u9fff]+/g;

function cjkTerms(text: string): string[] {
  const result: string[] = [];
  for (const run of text.match(CJK_RUN) ?? []) {
    if (run.length === 1) {
      result.push(run);
      continue;
    }
    for (let i = 0; i + 2 <= run.length; i += 1) result.push(run.slice(i, i + 2));
  }
  return result;
}

function helpTerms(text: string): Set<string> {
  const result = new Set<string>();
  for (const token of tokens(text)) {
    if (!HELP_STOPWORDS.has(token)) result.add(stem(token));
  }
  for (const term of cjkTerms(text)) result.add(term);
  return result;
}

/** 帮助条目按词重叠排序；标题或分类命中计双倍。 */
export function searchHelp(policies: Policy[], query: string, limit = 3): Policy[] {
  const queryTerms = helpTerms(query);
  if (queryTerms.size === 0) return [];
  const scored: Array<[number, Policy]> = [];
  for (const policy of policies) {
    const heading = [...queryTerms].filter((t) =>
      helpTerms(`${policy.title} ${policy.category}`).has(t),
    ).length;
    const body = [...queryTerms].filter((t) => helpTerms(policy.content).has(t)).length;
    const points = 2 * heading + body;
    if (points > 0) scored.push([points, policy]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, limit).map(([, policy]) => policy);
}

export function ordersFor(orders: Array<[string, Order]>, userId: string, limit: number): Order[] {
  return orders
    .filter(([owner]) => owner === userId)
    .map(([, order]) => order)
    .sort((a, b) => b.placed_at.localeCompare(a.placed_at))
    .slice(0, limit);
}

export function newestOrders(orders: Array<[string, Order]>, limit: number): Order[] {
  return orders
    .map(([, order]) => order)
    .sort((a, b) => b.placed_at.localeCompare(a.placed_at))
    .slice(0, limit);
}

export function findOrder(
  orders: Array<[string, Order]>,
  userId: string,
  orderId: string,
): Order | null {
  const wanted = orderId.toLowerCase();
  for (const [owner, order] of orders) {
    if (owner === userId && order.order_id.toLowerCase() === wanted) return order;
  }
  return null;
}

/** 购物车行：票务场景的购物车是当前锁座的视图。 */
export function cartLine(product: Product, quantity: number): CartItem {
  return {
    product_id: product.product_id,
    title: product.title,
    price: product.price,
    quantity,
    image_url: product.image_url,
    option_values: {},
    variant_of: null,
  };
}

export function preferencesOf(
  users: Record<string, UserPreferences>,
  userId: string,
): UserPreferences {
  return users[userId] ?? { user_id: userId, display_name: "访客" };
}

// --------------------------------------------------------------------------
// 日期锚定：fixture 按撰写日编排，运行时整体前移整数周，让演出始终在未来。
// --------------------------------------------------------------------------

function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

/** 从撰写日到今天的整周数，作为毫秒增量。 */
export function weeksSince(authoredToday: string, today = todayIso()): number {
  return Math.max(0, Math.floor(daysBetween(authoredToday, today) / 7)) * 7 * 86_400_000;
}

export function anchoredShift(raw: { dates_anchored_to?: string }, today = todayIso()): number {
  const anchor = raw.dates_anchored_to;
  return anchor ? weeksSince(anchor, today) : 0;
}

export function todayIso(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function shiftDay(day: string, deltaMs: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + deltaMs).toISOString().slice(0, 10);
}

export function daysBetweenIso(from: string, to: string): number {
  return daysBetween(from, to);
}

/** 在途订单按 (今天 − dates_anchored_to) 前移，含交付预估里的日期。 */
export function redateInFlightOrders<T extends { dates_anchored_to?: string; orders?: Array<Record<string, unknown>> }>(
  raw: T,
): T {
  const anchor = raw.dates_anchored_to;
  if (!anchor) return raw;
  const deltaMs = Date.parse(todayIso()) - Date.parse(`${anchor}T00:00:00Z`);
  for (const order of raw.orders ?? []) {
    if (!IN_FLIGHT_STATUSES.has(String(order.status))) continue;
    const placed = Date.parse(String(order.placed_at));
    order.placed_at = new Date(placed + deltaMs).toISOString();
    const estimate = order.estimated_delivery;
    if (typeof estimate === "string") {
      order.estimated_delivery = estimate.replace(
        ISO_DATE,
        (match) => new Date(Date.parse(`${match}T00:00:00Z`) + deltaMs).toISOString().slice(0, 10),
      );
    }
  }
  return raw;
}

// --------------------------------------------------------------------------
// 指标窗口（运营侧）
// --------------------------------------------------------------------------

export type DailyRows = Array<Record<string, number | string>>;

export function metricWindow(
  rows: DailyRows,
  period: string | null,
): { current: DailyRows; prior: DailyRows; label: string } {
  let days = 7;
  if (period) {
    const cleaned = period.trim().toLowerCase();
    if (["last_30_days", "last 30 days", "30d"].includes(cleaned)) days = 30;
    else if (["last_90_days", "last 90 days", "90d", "quarter"].includes(cleaned)) {
      days = Math.min(90, rows.length);
    } else if (cleaned.includes("/")) {
      const [startText, endText] = cleaned.split("/", 2);
      const start = Date.parse(`${startText.trim()}T00:00:00Z`);
      const end = Date.parse(`${endText.trim()}T00:00:00Z`);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        const selected = rows.filter((row) => {
          const day = Date.parse(`${String(row.date)}T00:00:00Z`);
          return start <= day && day <= end;
        });
        if (selected.length > 0) {
          const endIndex = rows.indexOf(selected[selected.length - 1]) + 1;
          const len = selected.length;
          const prior = rows.slice(Math.max(0, endIndex - 2 * len), endIndex - len);
          return {
            current: selected,
            prior,
            label: `${selected[0].date}/${selected[selected.length - 1].date}`,
          };
        }
      }
      days = 7;
    }
  }
  const current = rows.slice(-days);
  const prior = rows.slice(-2 * days, -days);
  return {
    current,
    prior,
    label: current.length ? `${current[0].date}/${current[current.length - 1].date}` : "",
  };
}

export function changePct(current: number, prior: number): number | null {
  if (prior <= 0) return null;
  return Math.round(((current - prior) / prior) * 1000) / 10;
}

export function marginPct(price: number, unitCost: number): number {
  return Math.round(((price - unitCost) / price) * 1000) / 10;
}

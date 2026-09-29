/**
 * 投影层：把确定性引擎的状态压成 Agent 契约里的**紧凑上下文**。
 *
 * 这是「模型只看投影、不看 fixture」这条边界的唯一出口：界面把当次候选、选中项、费用行、
 * 会话摘要、相关制度与运营快照投成 `AgentContext`，服务端只对这份投影做检索与解释，不落
 * fixture、不读本地文件、不推算金额。
 */

import type { Disclosure, Product, SessionContext } from "./types";
import type {
  AgentContext,
  DisclosureBrief,
  MerchantBrief,
  SessionBrief,
  ShowBrief,
} from "./schema";
import { EMPTY_CONTEXT } from "./schema";
import type { TicketStorefront } from "./engine/catalog";
import type { InventoryAlert, TicketMerchant } from "./engine/pacing";
import type { TicketingEngine } from "./engine/ticketing";

/** 单个票档的紧凑投影（不含长描述与规格）。 */
export function briefOf(product: Product, engine: TicketingEngine): ShowBrief {
  const remaining = engine.remaining(product.product_id);
  const attributes = product.attributes;
  const rawScore = Number.parseInt(attributes.value_score ?? "", 10);
  return {
    product_id: product.product_id,
    title: product.title,
    price: product.price,
    currency: product.currency,
    category: product.category,
    remaining,
    sold_out: remaining === 0,
    event_name: attributes.event_name ?? null,
    event_date: attributes.event_date ?? null,
    event_time: attributes.event_time ?? null,
    venue: attributes.venue ?? null,
    tier: attributes.tier ?? null,
    labels: product.labels.slice(0, 4),
    value_score: Number.isNaN(rawScore) ? null : rawScore,
    vs_box_office: attributes.vs_box_office ?? null,
  };
}

export function disclosureBrief(disclosure: Disclosure | null): DisclosureBrief | null {
  if (!disclosure) return null;
  return {
    title: disclosure.title,
    product_id: disclosure.product_id,
    rows: disclosure.rows
      .slice(0, 12)
      .map((row) => ({ label: row.label, value: row.value, note: row.note ?? null })),
    sources: disclosure.sources.slice(0, 6),
    footnotes: disclosure.footnotes.slice(0, 4),
  };
}

/** 观众侧的会话摘要：锁座、候补位次、待领取回流单、票夹与处理中转赠。 */
export function sessionBrief(
  storefront: TicketStorefront,
  session: SessionContext,
): SessionBrief | null {
  const account = storefront.getAccountContext(session);
  if (!account) return null;
  const title = (productId: string): string =>
    storefront.products[productId]?.title ?? productId;
  return {
    user_name: storefront.getPreferences(session).display_name ?? null,
    holds: account.active_holds
      .slice(0, 8)
      .map((hold) => ({
        product_id: hold.product_id,
        title: title(hold.product_id),
        quantity: hold.quantity,
        seconds_remaining: hold.seconds_remaining,
      })),
    waitlist: account.waitlist_entries.slice(0, 8).map((entry) => ({
      product_id: entry.product_id,
      title: title(entry.product_id),
      position: entry.position,
    })),
    offers: account.open_return_offers.slice(0, 8).map((offer) => ({
      product_id: offer.product_id,
      title: title(offer.product_id),
      quantity: offer.quantity,
      seconds_remaining: offer.claim_window_seconds_remaining,
    })),
    tickets: account.wallet.upcoming_tickets.slice(0, 20).map((ticket) => ({
      ticket_id: ticket.ticket_id,
      title: ticket.tier ? `${ticket.event} · ${ticket.tier}` : ticket.event,
      seat: ticket.seat,
      status: ticket.status,
    })),
    pending_transfers: account.pending_transfers.slice(0, 8).map((transfer) => ({
      transfer_id: transfer.transfer_id,
      recipient: transfer.recipient,
      ticket_ids: transfer.ticket_ids.slice(0, 8),
    })),
  };
}

/** 运营侧摘要：合计、告警、场次、pacing 与待审批提案。 */
export function merchantBrief(
  merchant: TicketMerchant,
  alerts: InventoryAlert[],
  pacingProductIds: string[],
): MerchantBrief {
  const snapshot = merchant.getBusinessSnapshot("last_30_days");
  const overview = merchant.pacingOverview() as {
    events: Array<Record<string, unknown>>;
  };
  const eventName = new Map<string, string>();
  const tierEvent = new Map<string, string>();
  for (const event of overview.events) {
    const id = String(event.event_id);
    eventName.set(id, String(event.event_name ?? id));
    for (const tier of (event.tiers as Array<Record<string, unknown>>) ?? []) {
      tierEvent.set(String(tier.product_id), id);
    }
  }
  const nameOf = (listingId: string): string => {
    const eventId = tierEvent.get(listingId);
    return eventId ? (eventName.get(eventId) ?? listingId) : listingId;
  };
  return {
    promoter: merchant.promoterName,
    current_period: snapshot.period,
    totals: {
      sales: snapshot.sales,
      orders: snapshot.orders,
      traffic: snapshot.traffic,
      conversion_rate: snapshot.conversion_rate,
      sales_change_pct: snapshot.sales_change_pct,
      currency: snapshot.currency,
    },
    counts: {
      low_stock: alerts.filter((alert) => alert.kind === "low_stock").length,
      slow_movers: alerts.filter((alert) => alert.kind === "slow_mover").length,
      order_issues: merchant.getOrderIssues().length,
      pending_changes: merchant.getPendingChanges().length,
    },
    events: overview.events.slice(0, 12).map((event) => {
      const tiers = (event.tiers as Array<Record<string, unknown>>) ?? [];
      return {
        event_id: String(event.event_id),
        event_name: String(event.event_name ?? event.event_id),
        event_date: String(event.event_date),
        days_to_event: Number(event.days_to_event),
        sold_out: tiers.length > 0 && tiers.every((tier) => Number(tier.remaining) === 0),
      };
    }),
    pacing: pacingProductIds
      .slice(0, 24)
      .map((productId) => {
        const context = merchant.getPricingContext(productId);
        if (!context) return null;
        return {
          product_id: productId,
          tier: tierLabel(merchant, productId),
          price: context.current_price,
          capacity: context.capacity ?? 0,
          sold: context.sold ?? 0,
          remaining: context.remaining ?? 0,
          sell_through_pct: context.sell_through_pct ?? 0,
          baseline_pct: context.baseline_pct,
          pace_vs_baseline_pts: context.pace_vs_baseline_pts,
          waitlist_depth: context.waitlist_depth ?? 0,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
    alerts: alerts.slice(0, 24).map((alert) => ({
      listing_id: alert.listing_id,
      title: nameOf(alert.listing_id),
      kind: alert.kind,
      stock: alert.stock,
      threshold: alert.threshold,
    })),
    pending_changes: merchant.getPendingChanges().slice(0, 12).map((change) => ({
      change_id: change.change_id,
      kind: change.kind,
      summary: change.summary,
      item_count: change.items.length,
    })),
    guardrails: {
      max_price_delta_pct: merchant.guardrails.max_price_delta_pct,
      max_promotion_discount_pct: merchant.guardrails.max_promotion_discount_pct,
      max_restock_quantity: merchant.guardrails.max_restock_quantity,
      max_campaign_budget: merchant.guardrails.max_campaign_budget,
    },
  };
}

function tierLabel(merchant: TicketMerchant, productId: string): string | null {
  return merchant.getListing(productId)?.attributes.tier ?? null;
}

export interface CustomerContextInput {
  storefront: TicketStorefront;
  session: SessionContext;
  page: AgentContext["page"];
  results?: Product[];
  selected?: Product | null;
  disclosure?: Disclosure | null;
  policies?: Array<{ policy_id: string; title: string; content: string }>;
}

export function buildCustomerContext(input: CustomerContextInput): AgentContext {
  const engine = input.storefront.engine;
  return {
    ...EMPTY_CONTEXT,
    page: input.page,
    store: input.storefront.storeName,
    limits: {
      hold_minutes: EMPTY_CONTEXT.limits.hold_minutes,
      max_tickets_per_event: input.storefront.maxTicketsPerEvent,
      offer_claim_minutes: EMPTY_CONTEXT.limits.offer_claim_minutes,
      barcode_rotation_seconds: EMPTY_CONTEXT.limits.barcode_rotation_seconds,
    },
    results: (input.results ?? [])
      .slice(0, 12)
      .map((product) => briefOf(input.storefront.withLiveState(product), engine)),
    selected: input.selected
      ? briefOf(input.storefront.withLiveState(input.selected), engine)
      : null,
    disclosure: disclosureBrief(input.disclosure ?? null),
    policies: (input.policies ?? []).slice(0, 6).map((policy) => ({
      policy_id: policy.policy_id,
      title: policy.title,
      content: policy.content.slice(0, 600),
    })),
    session: sessionBrief(input.storefront, input.session),
    merchant: null,
  };
}

export interface MerchantContextInput {
  merchant: TicketMerchant;
  page: AgentContext["page"];
  results?: Product[];
  pacingProductIds?: string[];
}

export function buildMerchantContext(input: MerchantContextInput): AgentContext {
  const engine = input.merchant.engine;
  const alerts = input.merchant.computeAlerts();
  const pacingIds =
    input.pacingProductIds && input.pacingProductIds.length > 0
      ? input.pacingProductIds
      : input.merchant.portfolioIds();
  return {
    ...EMPTY_CONTEXT,
    page: input.page,
    store: "琴台票务",
    results: (input.results ?? [])
      .slice(0, 12)
      .map((product) => briefOf(product, engine)),
    selected: null,
    disclosure: null,
    policies: [],
    session: null,
    merchant: merchantBrief(input.merchant, alerts, pacingIds),
  };
}

/**
 * 店面后端（移植自 `examples/entertainment/api/mock_ticketing.py`）。
 *
 * 「购物车」在这里是当前会话锁座的视图；每次目录读取都带上实时余量与由余量派生的标签；
 * 观众转票带一个此处计算的性价比分；费用披露就是目录里的费用拆分。
 *
 * 与源实现保持一致：搜索权重与同义词、`min_quantity` 硬过滤走实时库存、标签阈值
 * `max(_SELLING_FAST_FLOOR, capacity // 50)`、性价比阶梯 `_VALUE_LADDER`、披露行项目与
 * 来源 id。仅把面向访客的文案本地化为简体中文，金额统一按人民币渲染。
 */

import type { Dataset } from "../data";
import { WUHAN_SEARCH_ALIASES } from "../data";
import type {
  AccountContext,
  Cart,
  Currency,
  Disclosure,
  DisclosureRow,
  FulfillmentOption,
  Order,
  Policy,
  Product,
  SessionContext,
  UserPreferences,
} from "../types";
import {
  cartLine,
  findById,
  findOrder,
  keywordScore,
  matchesAttributeFilters,
  newestOrders,
  ordersFor,
  preferencesOf,
  rankProducts,
  searchHelp,
  summaryOf,
  withinPriceAndRating,
  type SearchFilters,
} from "./fixtures";
import {
  HOLD_TTL_S,
  MAX_TICKETS_PER_EVENT,
  OFFER_CLAIM_WINDOW_S,
  type TicketingEngine,
} from "./ticketing";

/** 「售票较快」适用于余量低于此值（或容量的 2%）时。 */
export const SELLING_FAST_FLOOR = 12;
export const MIN_QUANTITY_KEY = "min_quantity";

export const SEARCH_WEIGHTS: Record<string, number> = {
  title: 3.0,
  brand: 2.5,
  category: 2.0,
  attributes: 1.5,
  description: 1.0,
};

/**
 * 观众转票的性价比分：按转售价相对官方含全部费用价的比值，落到第一个不低于该比值的
 * 阶梯上；超过最后一档则为 1 分。
 */
export const VALUE_LADDER: ReadonlyArray<readonly [number, number]> = [
  [0.8, 10],
  [0.9, 9],
  [1.0, 8],
  [1.1, 6],
  [1.2, 5],
  [1.3, 4],
  [1.45, 3],
  [1.65, 2],
];

export const SYNONYMS: Record<string, string[]> = {
  concert: ["tour", "show", "tickets"],
  show: ["tour", "tickets"],
  gig: ["tour", "show"],
  band: ["tour", "indie", "pop"],
  music: ["tour", "indie", "pop", "orchestral"],
  comedy: ["doe", "taping"],
  comedian: ["comedy", "doe"],
  standup: ["comedy", "doe"],
  symphony: ["philharmonic", "orchestral", "opener"],
  orchestra: ["philharmonic", "orchestral"],
  classical: ["philharmonic", "orchestral"],
  outdoor: ["amphitheater", "terrace"],
  seat: ["reserved", "bowl", "balcony", "orchestra"],
  seats: ["reserved", "bowl", "balcony", "orchestra"],
  standing: ["pit", "floor", "general"],
  floor: ["pit", "general"],
  cheap: ["terrace", "balcony"],
  cheapest: ["terrace", "balcony"],
  front: ["pit", "rail"],
  resale: ["fan", "listing"],
  soldout: ["waitlist"],
  waitlist: ["sold"],
  tonight: ["aug", "sep", "oct"],
  weekend: ["fri", "sat"],
  friday: ["fri"],
  saturday: ["sat"],
};

export type ValueVerdict = "green" | "amber" | "red";

export interface ValueScore {
  score: number;
  verdict: ValueVerdict;
  /** 相对官方含全部费用价的百分比差，如 `+13%`。 */
  vsBoxOffice: string;
}

function minQuantity(filters: SearchFilters): number | null {
  const raw = String(filters.attributes?.[MIN_QUANTITY_KEY] ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * 票务店面：把数据集与状态机接到「店面后端」接口上。
 * 每个实例对应一个浏览器会话的确定性视图，服务端不持有实例。
 */
export class TicketStorefront {
  private readonly dataset: Dataset;
  readonly engine: TicketingEngine;

  constructor(dataset: Dataset, engine: TicketingEngine) {
    this.dataset = dataset;
    this.engine = engine;
  }

  get storeName(): string {
    return this.dataset.storeName;
  }

  get products(): Record<string, Product> {
    return this.dataset.products;
  }

  private eventOf = (productId: string): string => {
    const product = this.dataset.products[productId];
    return product ? (product.attributes.event_id ?? productId) : productId;
  };

  private soldTogetherOf = (productId: string): number => {
    const product = this.dataset.products[productId];
    if (!product) return 1;
    const raw = Number.parseInt(product.attributes.sold_together ?? "1", 10);
    return Number.isNaN(raw) ? 1 : Math.max(1, raw);
  };

  // ------------------------------------------------------------------
  // 实时状态
  // ------------------------------------------------------------------

  /** 转票的（分数、结论、相对官方的差值）；官方票档不存在或价格为 0 时返回 null。 */
  valueScore(listing: Product): ValueScore | null {
    const primaryId = listing.attributes.resale_of;
    const primary = primaryId ? this.dataset.products[primaryId] : undefined;
    if (!primary || primary.price <= 0) return null;
    const ratio = listing.price / primary.price;
    let score = VALUE_LADDER.find(([ceiling]) => ratio <= ceiling)?.[1] ?? 1;
    if (this.engine.remaining(primaryId as string) === 0) {
      // 同样的溢价在官方售罄时更值。
      score = Math.min(10, score + 1);
    }
    const verdict: ValueVerdict = score >= 8 ? "green" : score >= 5 ? "amber" : "red";
    const delta = Math.round((ratio - 1) * 100);
    return { score, verdict, vsBoxOffice: `${delta >= 0 ? "+" : "-"}${Math.abs(delta)}%` };
  }

  /** 带实时余量、由余量派生的标签、in_stock 与转票性价比分的记录。 */
  withLiveState(product: Product): Product {
    const remaining = this.engine.remaining(product.product_id);
    const capacity = this.engine.capacity(product.product_id);
    const attributes = { ...product.attributes };
    attributes.tickets_remaining = String(remaining);
    const labels = product.labels.filter(
      (label) =>
        !/^(售票较快|Selling fast|已售罄|Sold out)/.test(label),
    );
    if (remaining === 0) {
      labels.unshift("已售罄，可候补");
    } else if (remaining <= Math.max(SELLING_FAST_FLOOR, Math.floor(capacity / 50))) {
      labels.unshift(`售票较快，剩余 ${remaining} 张`);
    }
    if (product.category === "resale") {
      const scored = this.valueScore(product);
      if (scored) {
        const primary = this.dataset.products[product.attributes.resale_of];
        attributes.value_score = String(scored.score);
        attributes.value_verdict = scored.verdict;
        attributes.vs_box_office = scored.vsBoxOffice;
        attributes.box_office_all_in_usd = primary.price.toFixed(2);
      }
    }
    return { ...product, attributes, labels, in_stock: remaining > 0 };
  }

  // ------------------------------------------------------------------
  // 目录
  // ------------------------------------------------------------------

  private searchableText(product: Product): Record<string, string> {
    let searchable = Object.entries(product.attributes)
      .map(([key, value]) => `${key} ${value}`)
      .join(" ");
    for (const [localName, aliases] of Object.entries(WUHAN_SEARCH_ALIASES)) {
      if (searchable.includes(localName) || product.title.includes(localName)) {
        searchable = `${searchable} ${aliases}`;
      }
    }
    return {
      title: product.title,
      brand: product.brand || "",
      category: product.category || "",
      attributes: searchable,
      description: `${product.short_description || ""} ${product.long_description || ""}`,
    };
  }

  private score(product: Product, queryTokens: string[]): number {
    return keywordScore(this.searchableText(product), SEARCH_WEIGHTS, queryTokens, SYNONYMS);
  }

  private hardFilter(product: Product, filters: SearchFilters): boolean {
    // 明确写出的张数按实时库存校验，绝不放宽。
    if (!withinPriceAndRating(product, filters)) return false;
    const need = minQuantity(filters);
    return need === null || this.engine.remaining(product.product_id) >= need;
  }

  private softFilter(product: Product, filters: SearchFilters): boolean {
    return matchesAttributeFilters(product, filters, new Set([MIN_QUANTITY_KEY]));
  }

  searchProducts(
    _session: SessionContext,
    query: string,
    filters: SearchFilters | null = null,
    limit = 8,
  ): Product[] {
    const expanded =
      query +
      (Object.keys(WUHAN_SEARCH_ALIASES).some((localName) => query.includes(localName))
        ? " " +
          Object.entries(WUHAN_SEARCH_ALIASES)
            .filter(([localName]) => query.includes(localName))
            .map(([, aliases]) => aliases)
            .join(" ")
        : "");
    const ranked = rankProducts(Object.values(this.dataset.products), expanded, filters, limit, {
      score: (product, queryTokens) => this.score(product, queryTokens),
      hardFilter: (product, f) => this.hardFilter(product, f),
      softFilter: (product, f) => this.softFilter(product, f),
      relevanceTiebreak: (product) => product.price,
    });
    return ranked.map((product) => summaryOf(this.withLiveState(product)));
  }

  getLiveProduct(productId: string): Product | null {
    const resolved = findById(this.dataset.products, productId);
    return resolved ? this.withLiveState(this.dataset.products[resolved]) : null;
  }

  getProductDetails(_session: SessionContext, productId: string): Product | null {
    return this.getLiveProduct(productId);
  }

  // ------------------------------------------------------------------
  // 购物车：当前会话锁座的视图
  // ------------------------------------------------------------------

  getCart(session: SessionContext): Cart {
    const items = this.engine
      .holdsForSession(session.session_id)
      .flatMap((hold) => {
        const product = this.dataset.products[hold.product_id];
        return product ? [cartLine(product, hold.quantity)] : [];
      });
    return { items, currency: "CNY" as Currency };
  }

  addToCart(session: SessionContext, productId: string, quantity: number): Cart {
    this.engine.createHold(session.session_id, session.user_id, productId, quantity);
    return this.getCart(session);
  }

  updateCartItem(session: SessionContext, productId: string, quantity: number): Cart {
    this.engine.setHoldQuantity(session.session_id, productId, quantity);
    return this.getCart(session);
  }

  removeFromCart(session: SessionContext, productId: string): Cart {
    this.engine.releaseHold(session.session_id, productId);
    return this.getCart(session);
  }

  resetSession(sessionId: string): void {
    this.engine.releaseSession(sessionId);
  }

  // ------------------------------------------------------------------
  // 观众、票夹、披露、订单、帮助内容、履约方式
  // ------------------------------------------------------------------

  getPreferences(session: SessionContext): UserPreferences {
    return preferencesOf(this.dataset.users, session.user_id);
  }

  /** 观众的票夹、锁座、候补位次、待领取回流单与处理中转赠，倒计时取自引擎时钟。 */
  getAccountContext(session: SessionContext): AccountContext | null {
    const engine = this.engine;
    const tickets = engine.ticketsFor(session.user_id);
    if (tickets.length === 0 && !(session.user_id in this.dataset.users)) return null;
    const upcoming = tickets
      .filter((ticket) => ticket.product_id in this.dataset.products)
      .map((ticket) => {
        const product = this.dataset.products[ticket.product_id];
        return {
          ticket_id: ticket.ticket_id,
          event: product.attributes.event_name ?? ticket.product_id,
          date: product.attributes.event_date,
          tier: product.attributes.tier,
          seat: ticket.seat,
          status: ticket.status,
        };
      });
    const holds = engine.holdsForUser(session.user_id).map((hold) => ({
      hold_id: hold.hold_id,
      product_id: hold.product_id,
      quantity: hold.quantity,
      seconds_remaining: engine.secondsUntil(hold.expires_at),
    }));
    const waitlist = engine.waitlistEntriesFor(session.user_id).map(({ entry, position }) => ({
      product_id: entry.product_id,
      quantity: entry.quantity,
      position,
    }));
    const offers = engine.offersFor(session.user_id).map((offer) => ({
      offer_id: offer.offer_id,
      product_id: offer.product_id,
      quantity: offer.quantity,
      claim_window_seconds_remaining: engine.secondsUntil(offer.expires_at),
    }));
    const transfers = engine
      .transfersFor(session.user_id)
      .filter((transfer) => transfer.status === "pending")
      .map((transfer) => ({
        transfer_id: transfer.transfer_id,
        ticket_ids: transfer.ticket_ids,
        recipient: transfer.recipient,
        status: transfer.status,
      }));
    return {
      wallet: { upcoming_tickets: upcoming },
      active_holds: holds,
      hold_policy: {
        hold_minutes: Math.floor(HOLD_TTL_S / 60),
        never_charged_until_checkout: true,
      },
      waitlist_entries: waitlist,
      open_return_offers: offers,
      offer_claim_window_minutes: Math.floor(OFFER_CLAIM_WINDOW_S / 60),
      pending_transfers: transfers,
    };
  }

  /**
   * 含全部费用按目录的费用属性逐项列出（各费用之和等于价格），并附实时可售情况。
   * 服务端与前端共用同一份确定性文本。
   */
  getDisclosure(_session: SessionContext, productId: string): Disclosure | null {
    const product = this.dataset.products[productId];
    if (!product || !["tickets", "resale"].includes(product.category)) return null;
    const attrs = product.attributes;
    const money = (value: number | string): string => `¥${Number(value).toFixed(2)}`;

    const rows: DisclosureRow[] = [
      {
        label: "含全部费用",
        value: money(product.price),
        note: "每张票实际支付的价格，不会之后再加收费用",
      },
    ];
    // 官方票档从票面价拆分，转票从卖家标价拆分。
    if ("face_price_usd" in attrs) {
      rows.push({ label: "票面价", value: money(attrs.face_price_usd) });
    } else if ("seller_price_usd" in attrs) {
      rows.push({
        label: "转售价",
        value: money(attrs.seller_price_usd),
        note: "观众卖家为这张票标出的价格",
      });
    }
    if ("service_fee_usd" in attrs) {
      rows.push(
        { label: "服务费", value: money(attrs.service_fee_usd) },
        { label: "场馆费", value: money(attrs.facility_fee_usd) },
        {
          label: "订单处理费",
          value: money(attrs.processing_fee_usd),
          note: "本地 Demo 按每张票计算",
        },
      );
    }
    if (product.category === "resale") {
      const scored = this.valueScore(product);
      const primary = this.dataset.products[attrs.resale_of ?? ""];
      if (primary) {
        rows.push({
          label: "官方含全部费用价格",
          value: money(primary.price),
          note:
            "同一票档，由场馆官方销售" +
            (this.engine.remaining(primary.product_id) === 0 ? "，当前已售罄" : ""),
        });
      }
      if (scored) {
        rows.push({
          label: "性价比分",
          value: `${scored.score}/10（${scored.verdict}）`,
          note: `该转票相对官方含全部费用价格为 ${scored.vsBoxOffice}`,
        });
      }
    }
    rows.push(
      {
        label: "锁座规则",
        value: `锁座 ${Math.floor(HOLD_TTL_S / 60)} 分钟，超时后回到模拟库存`,
        note: "完成结算前不会扣款",
      },
      {
        label: "入场方式",
        value: "模拟电子票，条码定时刷新",
      },
    );

    return {
      title: `${product.title}：价格和购票规则`,
      product_id: product.product_id,
      rows,
      sources: [
        "all-in-pricing",
        "ticket-holds",
        product.category === "resale" ? "resale-value-scores" : "mobile-entry",
        "refunds-event-changes",
      ],
      footnotes: [
        "价格均为含全部费用：票面价和所有费用已在上方拆分。",
        "剩余数量是本地 Demo 模拟库存，不代表实时票务库存。",
      ],
    };
  }

  getOrders(session: SessionContext, limit = 5): Order[] {
    return ordersFor(this.dataset.orders, session.user_id, limit);
  }

  getOrder(session: SessionContext, orderId: string): Order | null {
    return findOrder(this.dataset.orders, session.user_id, orderId);
  }

  /** 跨全部观众：运营总览的订单流。 */
  recentOrders(limit = 6): Order[] {
    return newestOrders(this.dataset.orders, limit);
  }

  searchPolicies(_session: SessionContext, query: string): Policy[] {
    return searchHelp(this.dataset.policies, query);
  }

  /** 本 Demo 只有两种履约方式；票档列表不影响结果（与源实现一致，源同样忽略入参）。 */
  getFulfillmentOptions(): FulfillmentOption[] {
    return [
      {
        method: "delivery",
        eta: "即时；购票后模拟电子票会进入琴台票务模拟票夹",
        fee: 0,
      },
      {
        method: "pickup",
        eta: "演出前约 2 小时可凭证件在场馆票务处领取（Demo 模拟）",
        fee: 0,
        location: "场馆票务处",
      },
    ];
  }

  /** 每场演出每会话的锁座上限（供 UI 展示规则）。 */
  get maxTicketsPerEvent(): number {
    return MAX_TICKETS_PER_EVENT;
  }
}

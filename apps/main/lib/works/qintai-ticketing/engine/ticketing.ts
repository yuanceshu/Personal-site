/**
 * 票务状态机（移植自 `examples/entertainment/api/ticketing.py`）。
 *
 * 保留原语义：限时锁座、由容量−售出−锁座−候补预留推导的真实余量、FIFO 候补与回流
 * 领取窗口、可逆转赠、旋转条码、惰性过期清扫与可注入时钟。这里不收任何费用。
 *
 * 与源实现的差异只有两点：时间统一使用 epoch 毫秒（便于序列化到浏览器），以及面向访客
 * 的错误文案本地化为简体中文。业务规则、常量与错误分类保持一致。
 */

import type {
  EngineSnapshot,
  Hold,
  InventoryRow,
  Notification,
  ReturnOffer,
  Ticket,
  Transfer,
  WaitlistEntry,
} from "../types";
import { sha256Hex } from "./sha256";

export const HOLD_TTL_S = 480;
export const OFFER_CLAIM_WINDOW_S = 600;
/** 每场演出每会话最多锁定的票数。 */
export const MAX_TICKETS_PER_EVENT = 8;
export const BARCODE_ROTATION_S = 60;
/** 真实观众入队后，种子候补按此间隔逐个离队。 */
export const SIM_FAN_DEPART_INTERVAL_S = 20;

export const ENGINE_SNAPSHOT_VERSION = 1;

export type TicketingErrorKind =
  | "sold_out"
  | "hold_limit"
  | "ownership"
  | "not_found"
  | "state"
  | "unknown";

/** 规则违例；`message` 可安全展示给访客。 */
export class TicketingError extends Error {
  constructor(
    public readonly kind: TicketingErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "TicketingError";
  }
}

export function ticketingStatus(error: unknown): number {
  if (!(error instanceof TicketingError)) return 400;
  switch (error.kind) {
    case "ownership":
      return 403;
    case "not_found":
      return 404;
    case "state":
      return 409;
    default:
      return 400;
  }
}

export interface TicketingEngineInit {
  inventory: Record<string, { capacity: number; sold: number; waitlist_sim?: number }>;
  tickets: Ticket[];
  eventOf: (productId: string) => string;
  soldTogetherOf?: (productId: string) => number;
  /** 引擎时钟，测试可替换；返回 epoch 毫秒。 */
  now?: () => number;
  snapshot?: EngineSnapshot;
}

export class TicketingEngine {
  private rows: Record<string, InventoryRow> = {};
  private holds = new Map<string, Hold>();
  private waitlists = new Map<string, WaitlistEntry[]>();
  private offers = new Map<string, ReturnOffer>();
  private transfers = new Map<string, Transfer>();
  private tickets = new Map<string, Ticket>();
  private counter = 0;
  private pending: Notification[] = [];

  private readonly clock: () => number;
  private readonly eventOf: (productId: string) => string;
  private readonly soldTogetherOf: (productId: string) => number;

  constructor(init: TicketingEngineInit) {
    this.clock = init.now ?? (() => Date.now());
    this.eventOf = init.eventOf;
    this.soldTogetherOf = init.soldTogetherOf ?? (() => 1);

    if (init.snapshot) {
      const snap = init.snapshot;
      this.rows = { ...snap.rows };
      this.holds = new Map(snap.holds.map((h) => [h.hold_id, h]));
      this.waitlists = new Map(
        Object.entries(snap.waitlists).map(([k, v]) => [k, v.map((e) => ({ ...e }))] as const),
      );
      this.offers = new Map(snap.offers.map((o) => [o.offer_id, { ...o }]));
      this.transfers = new Map(snap.transfers.map((t) => [t.transfer_id, { ...t }]));
      this.tickets = new Map(snap.tickets.map((t) => [t.ticket_id, { ...t }]));
      this.counter = snap.counter;
      this.pending = [];
      return;
    }

    for (const [productId, row] of Object.entries(init.inventory)) {
      this.rows[productId] = { capacity: Number(row.capacity), sold: Number(row.sold) };
    }
    for (const [productId, raw] of Object.entries(init.inventory)) {
      const seed = Number((raw as { waitlist_sim?: number }).waitlist_sim ?? 0);
      if (seed > 0) {
        this.waitlists.set(
          productId,
          Array.from({ length: seed }, (_, index) => ({
            user_id: `sim-fan-${productId}-${index + 1}`,
            session_id: "",
            product_id: productId,
            quantity: 2,
            joined_at: this.clock(),
            simulated: true,
            departs_at: null,
          })),
        );
      }
    }
    for (const ticket of init.tickets) this.tickets.set(ticket.ticket_id, { ...ticket });
  }

  // ------------------------------------------------------------------
  // 时钟
  // ------------------------------------------------------------------

  now(): number {
    return this.clock();
  }

  secondsUntil(expiresAt: number): number {
    return Math.max(0, Math.floor((expiresAt - this.clock()) / 1000));
  }

  // ------------------------------------------------------------------
  // 惰性过期清扫（每个公开方法开头执行）
  // ------------------------------------------------------------------

  sweep(): void {
    const now = this.clock();
    for (const [holdId, hold] of [...this.holds]) {
      if (hold.expires_at <= now) this.holds.delete(holdId);
    }
    for (const entries of this.waitlists.values()) {
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        const entry = entries[i];
        if (entry.simulated && entry.departs_at !== null && entry.departs_at <= now) {
          entries.splice(i, 1);
        }
      }
    }
    for (const offer of [...this.offers.values()]) {
      if (offer.status === "open" && offer.expires_at <= now) {
        offer.status = "expired";
        const position = this.pending.length;
        const rolled = this.offerNext(offer.product_id, offer.quantity);
        const where = rolled
          ? "票已顺延给候补队列中的下一位观众"
          : "票已回到公开库存";
        this.pending.splice(position, 0, {
          user_id: offer.user_id,
          text: `${offer.product_id} 的回流票领取窗口已过期；${where}。`,
        });
      }
    }
  }

  collectNotifications(): Notification[] {
    this.sweep();
    const drained = this.pending;
    this.pending = [];
    return drained;
  }

  // ------------------------------------------------------------------
  // 真实稀缺
  // ------------------------------------------------------------------

  remaining(productId: string): number {
    this.sweep();
    const row = this.rows[productId];
    if (!row) return 0;
    let held = 0;
    for (const hold of this.holds.values()) {
      if (hold.product_id === productId) held += hold.quantity;
    }
    let reserved = 0;
    for (const offer of this.offers.values()) {
      if (offer.product_id === productId && offer.status === "open") reserved += offer.quantity;
    }
    return Math.max(0, row.capacity - row.sold - held - reserved);
  }

  capacity(productId: string): number {
    return this.rows[productId]?.capacity ?? 0;
  }

  sold(productId: string): number {
    return this.rows[productId]?.sold ?? 0;
  }

  waitlistDepth(productId: string): number {
    this.sweep();
    return this.waitlists.get(productId)?.length ?? 0;
  }

  addCapacity(productId: string, quantity: number): void {
    const row = this.rows[productId];
    if (!row) throw new TicketingError("not_found", `未知票档 ${productId}`);
    if (quantity < 1) throw new TicketingError("state", "数量至少为 1");
    row.capacity += quantity;
  }

  // ------------------------------------------------------------------
  // 锁座（购物车背后的存储）
  // ------------------------------------------------------------------

  private sessionEventTotal(sessionId: string, eventId: string): number {
    let total = 0;
    for (const hold of this.holds.values()) {
      if (hold.session_id === sessionId && this.eventOf(hold.product_id) === eventId) {
        total += hold.quantity;
      }
    }
    return total;
  }

  createHold(sessionId: string, userId: string, productId: string, quantity: number): Hold {
    this.sweep();
    if (!this.rows[productId]) {
      throw new TicketingError("not_found", `未知票档 ${productId}`);
    }
    if (quantity < 1) throw new TicketingError("state", "数量至少为 1");
    this.checkWholeSets(productId, quantity);
    const eventId = this.eventOf(productId);
    if (this.sessionEventTotal(sessionId, eventId) + quantity > MAX_TICKETS_PER_EVENT) {
      throw new TicketingError(
        "hold_limit",
        `每场演出最多锁定 ${MAX_TICKETS_PER_EVENT} 张，本次锁座未变更`,
      );
    }
    if (this.remaining(productId) < quantity) {
      const left = this.remaining(productId);
      if (left === 0) {
        throw new TicketingError(
          "sold_out",
          "该票档已售罄；进场方式是候补队列——候补在演出页加入，不在对话框里。请引导观众前往演出页，或展示该票档的观众转票。",
        );
      }
      throw new TicketingError("sold_out", `该票档仅剩 ${left} 张，请减少锁座数量`);
    }
    const existing = this.holdFor(sessionId, productId);
    const expires = this.clock() + HOLD_TTL_S * 1000;
    if (existing) {
      existing.quantity += quantity;
      existing.expires_at = expires;
      return existing;
    }
    const hold: Hold = {
      hold_id: this.nextId("hold"),
      session_id: sessionId,
      user_id: userId,
      product_id: productId,
      quantity,
      expires_at: expires,
    };
    this.holds.set(hold.hold_id, hold);
    return hold;
  }

  private checkWholeSets(productId: string, quantity: number): void {
    const unit = Math.max(1, this.soldTogetherOf(productId));
    if (quantity % unit !== 0) {
      throw new TicketingError("state", `该票档按 ${unit} 张一组出售，请选择 ${unit} 的整数倍`);
    }
  }

  private holdFor(sessionId: string, productId: string): Hold | null {
    for (const hold of this.holds.values()) {
      if (hold.session_id === sessionId && hold.product_id === productId) return hold;
    }
    return null;
  }

  setHoldQuantity(sessionId: string, productId: string, quantity: number): void {
    this.sweep();
    const hold = this.holdFor(sessionId, productId);
    if (!hold) return;
    if (quantity <= 0) {
      this.holds.delete(hold.hold_id);
      return;
    }
    this.checkWholeSets(productId, quantity);
    const grow = quantity - hold.quantity;
    const eventTotal = this.sessionEventTotal(sessionId, this.eventOf(productId));
    if (grow > 0 && eventTotal + grow > MAX_TICKETS_PER_EVENT) {
      throw new TicketingError(
        "hold_limit",
        `每场演出最多锁定 ${MAX_TICKETS_PER_EVENT} 张，本次锁座未变更`,
      );
    }
    if (grow > 0 && this.remaining(hold.product_id) < grow) {
      throw new TicketingError(
        "sold_out",
        `该票档仅剩 ${this.remaining(hold.product_id)} 张可加`,
      );
    }
    hold.quantity = quantity;
    hold.expires_at = this.clock() + HOLD_TTL_S * 1000;
  }

  releaseHold(sessionId: string, productId: string): void {
    const hold = this.holdFor(sessionId, productId);
    if (hold) this.holds.delete(hold.hold_id);
  }

  releaseHoldById(holdId: string, userId: string): void {
    this.sweep();
    const hold = this.holds.get(holdId);
    if (!hold) throw new TicketingError("not_found", "没有该锁座记录（可能已过期）");
    if (hold.user_id !== userId) {
      throw new TicketingError("ownership", "该锁座属于其他观众");
    }
    this.holds.delete(holdId);
  }

  releaseSession(sessionId: string): void {
    for (const [holdId, hold] of [...this.holds]) {
      if (hold.session_id === sessionId) this.holds.delete(holdId);
    }
  }

  holdsForSession(sessionId: string): Hold[] {
    this.sweep();
    return [...this.holds.values()]
      .filter((h) => h.session_id === sessionId)
      .sort((a, b) => a.hold_id.localeCompare(b.hold_id));
  }

  holdsForUser(userId: string): Hold[] {
    this.sweep();
    return [...this.holds.values()]
      .filter((h) => h.user_id === userId)
      .sort((a, b) => a.hold_id.localeCompare(b.hold_id));
  }

  // ------------------------------------------------------------------
  // 候补与回流票
  // ------------------------------------------------------------------

  joinWaitlist(userId: string, sessionId: string, productId: string, quantity: number): number {
    this.sweep();
    if (!this.rows[productId]) throw new TicketingError("not_found", `未知票档 ${productId}`);
    if (this.remaining(productId) > 0) {
      throw new TicketingError("state", "该票档仍有票，请直接锁座");
    }
    const wanted = Math.max(1, Math.min(quantity, MAX_TICKETS_PER_EVENT));
    this.checkWholeSets(productId, wanted);
    let entries = this.waitlists.get(productId);
    if (!entries) {
      entries = [];
      this.waitlists.set(productId, entries);
    }
    for (let i = 0; i < entries.length; i += 1) {
      if (entries[i].user_id === userId) {
        entries[i].quantity = wanted;
        return i + 1;
      }
    }
    entries.push({
      user_id: userId,
      session_id: sessionId,
      product_id: productId,
      quantity: wanted,
      joined_at: this.clock(),
      simulated: false,
      departs_at: null,
    });
    let pending = 0;
    for (const entry of entries) {
      if (entry.simulated && entry.departs_at === null) {
        pending += 1;
        entry.departs_at = this.clock() + SIM_FAN_DEPART_INTERVAL_S * pending * 1000;
      }
    }
    return entries.length;
  }

  waitlistEntriesFor(userId: string): Array<{ entry: WaitlistEntry; position: number }> {
    this.sweep();
    const found: Array<{ entry: WaitlistEntry; position: number }> = [];
    for (const entries of this.waitlists.values()) {
      entries.forEach((entry, index) => {
        if (entry.user_id === userId) found.push({ entry, position: index + 1 });
      });
    }
    return found;
  }

  recordReturn(productId: string, quantity: number): ReturnOffer | null {
    this.sweep();
    const row = this.rows[productId];
    if (!row) throw new TicketingError("not_found", `未知票档 ${productId}`);
    const wanted = Math.min(quantity, row.sold);
    if (wanted < 1) throw new TicketingError("state", "该票档没有可退回的已售出票");
    row.sold -= wanted;
    return this.offerNext(productId, wanted);
  }

  private offerNext(productId: string, quantity: number): ReturnOffer | null {
    const entries = this.waitlists.get(productId) ?? [];
    const unit = Math.max(1, this.soldTogetherOf(productId));
    while (entries.length > 0) {
      if (entries[0].simulated) {
        entries.shift();
        continue;
      }
      const offered = Math.floor(Math.min(quantity, entries[0].quantity) / unit) * unit;
      if (offered < 1) return null;
      const entry = entries.shift() as WaitlistEntry;
      const offer: ReturnOffer = {
        offer_id: this.nextId("offer"),
        product_id: productId,
        user_id: entry.user_id,
        quantity: offered,
        expires_at: this.clock() + OFFER_CLAIM_WINDOW_S * 1000,
        status: "open",
      };
      this.offers.set(offer.offer_id, offer);
      this.pending.push({
        user_id: entry.user_id,
        text:
          `回流票：${productId} 有 ${offer.quantity} 张票刚刚从候补队列放出给这位观众` +
          `（回流单 ${offer.offer_id}）。领取窗口将在 ${OFFER_CLAIM_WINDOW_S / 60} 分钟后关闭。`,
      });
      return offer;
    }
    return null;
  }

  offersFor(userId: string): ReturnOffer[] {
    this.sweep();
    return [...this.offers.values()].filter(
      (o) => o.user_id === userId && o.status === "open",
    );
  }

  claimOffer(offerId: string, userId: string, sessionId: string): Hold {
    this.sweep();
    const offer = this.offers.get(offerId);
    if (!offer) throw new TicketingError("not_found", "没有该回流单");
    if (offer.user_id !== userId) {
      throw new TicketingError("ownership", "该回流单属于其他观众");
    }
    if (offer.status !== "open") {
      throw new TicketingError("state", `该回流单已不可领取（状态：${offer.status}）`);
    }
    offer.status = "claimed";
    try {
      return this.createHold(sessionId, userId, offer.product_id, offer.quantity);
    } catch (error) {
      offer.status = "open";
      throw error;
    }
  }

  // ------------------------------------------------------------------
  // 票夹与转赠
  // ------------------------------------------------------------------

  ticketsFor(userId: string): Ticket[] {
    return [...this.tickets.values()]
      .filter((t) => t.owner_id === userId)
      .sort((a, b) => a.ticket_id.localeCompare(b.ticket_id));
  }

  barcode(ticketId: string): string {
    const window = Math.floor(this.clock() / 1000 / BARCODE_ROTATION_S);
    return sha256Hex(`${ticketId}:${window}`).slice(0, 10).toUpperCase();
  }

  initiateTransfer(userId: string, ticketIds: string[], recipient: string): Transfer {
    if (ticketIds.length === 0) {
      throw new TicketingError("state", "没有指定要转赠的票");
    }
    const tickets: Ticket[] = [];
    for (const ticketId of ticketIds) {
      const ticket = this.tickets.get(ticketId);
      if (!ticket) throw new TicketingError("not_found", `没有该票 ${ticketId}`);
      if (ticket.owner_id !== userId) {
        throw new TicketingError("ownership", "该票属于其他观众");
      }
      if (ticket.status !== "active") {
        throw new TicketingError(
          "state",
          `票 ${ticketId} 不可转赠（状态：${ticket.status}）`,
        );
      }
      tickets.push(ticket);
    }
    const transfer: Transfer = {
      transfer_id: this.nextId("xfer"),
      ticket_ids: [...ticketIds],
      from_user_id: userId,
      recipient,
      initiated_at: this.clock(),
      status: "pending",
    };
    this.transfers.set(transfer.transfer_id, transfer);
    for (const ticket of tickets) ticket.status = "transfer_pending";
    return transfer;
  }

  cancelTransfer(userId: string, transferId: string): Transfer {
    const transfer = this.transfers.get(transferId);
    if (!transfer) throw new TicketingError("not_found", "没有该转赠记录");
    if (transfer.from_user_id !== userId) {
      throw new TicketingError("ownership", "该转赠由其他观众发起");
    }
    if (transfer.status !== "pending") {
      throw new TicketingError("state", `该转赠不是待处理状态（状态：${transfer.status}）`);
    }
    transfer.status = "cancelled";
    for (const ticketId of transfer.ticket_ids) {
      const ticket = this.tickets.get(ticketId);
      if (ticket && ticket.status === "transfer_pending") ticket.status = "active";
    }
    return transfer;
  }

  transfersFor(userId: string): Transfer[] {
    return [...this.transfers.values()]
      .filter((t) => t.from_user_id === userId)
      .sort((a, b) => a.transfer_id.localeCompare(b.transfer_id));
  }

  pendingTransfersFor(userId: string): Transfer[] {
    return this.transfersFor(userId).filter((t) => t.status === "pending");
  }

  // ------------------------------------------------------------------
  // 私有工具
  // ------------------------------------------------------------------

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${String(this.counter).padStart(4, "0")}`;
  }

  snapshot(): EngineSnapshot {
    return {
      version: ENGINE_SNAPSHOT_VERSION,
      rows: this.rows,
      holds: [...this.holds.values()],
      waitlists: Object.fromEntries(
        [...this.waitlists.entries()].map(([k, v]) => [k, v.map((e) => ({ ...e }))]),
      ),
      offers: [...this.offers.values()],
      transfers: [...this.transfers.values()],
      tickets: [...this.tickets.values()],
      counter: this.counter,
      notifications: [],
    };
  }
}

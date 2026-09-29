/**
 * 琴台票务的浏览器会话层（对齐主站林泉 `storage/` 的做法：只用 localStorage，
 * 不引入第三方状态库）。
 *
 * 存三样东西：会话/观众标识、票务状态机的快照（锁座、候补、回流单、转赠、票夹），以及
 * 聊天的本地历史。它们都只属于这台浏览器，刷新后继续；服务端不持有任何这类状态。
 */

import { z } from "zod";
import type { Dataset } from "./data";
import type { EngineSnapshot } from "./types";
import { ENGINE_SNAPSHOT_VERSION, TicketingEngine } from "./engine/ticketing";

export const QINTAI_SESSION_KEY = "qintai-ticketing:session:v1";
/** 演示票夹与订单都挂在 `demo-user` 上（源 fixture 的所有者）。 */
export const DEMO_USER_ID = "demo-user";

const inventoryRowSchema = z.object({ capacity: z.number(), sold: z.number() });
const holdSchema = z.object({
  hold_id: z.string(),
  session_id: z.string(),
  user_id: z.string(),
  product_id: z.string(),
  quantity: z.number().int(),
  expires_at: z.number(),
});
const waitlistEntrySchema = z.object({
  user_id: z.string(),
  session_id: z.string(),
  product_id: z.string(),
  quantity: z.number().int(),
  joined_at: z.number(),
  simulated: z.boolean(),
  departs_at: z.number().nullable(),
});
const returnOfferSchema = z.object({
  offer_id: z.string(),
  product_id: z.string(),
  user_id: z.string(),
  quantity: z.number().int(),
  expires_at: z.number(),
  status: z.enum(["open", "claimed", "expired"]),
});
const ticketSchema = z.object({
  ticket_id: z.string(),
  owner_id: z.string(),
  product_id: z.string(),
  order_id: z.string(),
  seat: z.string(),
  status: z.enum(["active", "transfer_pending"]),
});
const transferSchema = z.object({
  transfer_id: z.string(),
  ticket_ids: z.array(z.string()),
  from_user_id: z.string(),
  recipient: z.string(),
  initiated_at: z.number(),
  status: z.enum(["pending", "cancelled"]),
});

export const engineSnapshotSchema = z.object({
  version: z.number().int(),
  rows: z.record(z.string(), inventoryRowSchema),
  holds: z.array(holdSchema),
  waitlists: z.record(z.string(), z.array(waitlistEntrySchema)),
  offers: z.array(returnOfferSchema),
  transfers: z.array(transferSchema),
  tickets: z.array(ticketSchema),
  counter: z.number().int(),
  notifications: z.array(z.object({ user_id: z.string(), text: z.string() })),
});

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string(),
  engine: z
    .object({
      mode: z.enum(["live", "demo", "fallback"]),
      model: z.string().optional(),
      reason: z.string().optional(),
    })
    .optional(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

const changeItemSchema = z.object({
  target: z.string(),
  field: z.string(),
  before: z.unknown(),
  after: z.unknown(),
});
const stagedChangeSchema = z.object({
  change_id: z.string(),
  kind: z.enum(["listing_update", "price_update", "inventory_action", "promotion", "campaign"]),
  status: z.enum(["staged", "applied", "discarded"]),
  summary: z.string(),
  items: z.array(changeItemSchema),
  created_at: z.string(),
  created_by: z.string(),
  created_by_kind: z.enum(["operator", "agent"]),
  applied_at: z.string().nullable(),
  applied_by: z.string().nullable(),
  discarded_at: z.string().nullable(),
  discarded_by: z.string().nullable(),
  discarded_by_kind: z.enum(["operator", "agent"]).nullable(),
  guardrail_notes: z.array(z.string()),
  currency: z.string().nullable(),
  margin_impact: z.number().nullable(),
  margin_before_pct: z.number().nullable(),
  margin_after_pct: z.number().nullable(),
});
export const ledgerStateSchema = z.object({
  sequence: z.number().int().nonnegative(),
  changes: z.array(stagedChangeSchema),
});
export type StoredLedger = z.infer<typeof ledgerStateSchema>;

const storedSessionSchema = z.object({
  version: z.literal(1),
  sessionId: z.string(),
  userId: z.string(),
  engine: engineSnapshotSchema.nullable(),
  ledger: ledgerStateSchema.nullable(),
  history: z.array(chatMessageSchema).max(100),
  accepted: z.array(z.string()).max(24),
  updatedAt: z.string(),
});
export type StoredSession = z.infer<typeof storedSessionSchema>;

export function newId(prefix = "sess"): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}-${random}`;
}

export function freshSession(): StoredSession {
  return {
    version: 1,
    sessionId: newId("sess"),
    userId: DEMO_USER_ID,
    engine: null,
    ledger: null,
    history: [],
    accepted: [],
    updatedAt: new Date().toISOString(),
  };
}

export function readStoredSession(): StoredSession {
  if (typeof window === "undefined") return freshSession();
  try {
    const raw = window.localStorage.getItem(QINTAI_SESSION_KEY);
    if (!raw) return freshSession();
    const parsed = storedSessionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return freshSession();
    // 引擎快照版本不匹配时丢弃快照与台账（台账的 before 值以快照为前提），保留会话与历史。
    if (parsed.data.engine && parsed.data.engine.version !== ENGINE_SNAPSHOT_VERSION) {
      return { ...parsed.data, engine: null, ledger: null };
    }
    return parsed.data;
  } catch {
    return freshSession();
  }
}

export function writeStoredSession(session: StoredSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      QINTAI_SESSION_KEY,
      JSON.stringify({ ...session, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // 隐私模式与配额限制不应打断访客流程；内存中的会话仍然可用。
  }
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(QINTAI_SESSION_KEY);
  } catch {
    // 同上。
  }
}

/** 存储快照能安全恢复成引擎时返回快照，否则返回 null（由调用方从数据集重建）。 */
export function restorableSnapshot(snapshot: EngineSnapshot | null): EngineSnapshot | null {
  if (!snapshot) return null;
  const parsed = engineSnapshotSchema.safeParse(snapshot);
  if (!parsed.success || parsed.data.version !== ENGINE_SNAPSHOT_VERSION) return null;
  return parsed.data as EngineSnapshot;
}

/** 存储的待审批台账能安全恢复时返回它，否则返回 null（当作空台账）。 */
export function restorableLedger(ledger: StoredLedger | null): StoredLedger | null {
  if (!ledger) return null;
  const parsed = ledgerStateSchema.safeParse(ledger);
  return parsed.success ? parsed.data : null;
}

export interface CreateEngineOptions {
  dataset: Dataset;
  snapshot?: EngineSnapshot | null;
  now?: () => number;
}

/**
 * 用数据集 + 可选快照构建状态机。快照里的时间戳是 epoch 毫秒，所以恢复时若已经过期，
 * 引擎的惰性清扫会在第一次读取时把它们清掉——这与会话还开着时的行为一致。
 */
export function createEngine(options: CreateEngineOptions): TicketingEngine {
  const { dataset, snapshot, now } = options;
  const eventOf = (productId: string): string =>
    dataset.products[productId]?.attributes.event_id ?? productId;
  const soldTogetherOf = (productId: string): number => {
    const raw = Number.parseInt(dataset.products[productId]?.attributes.sold_together ?? "1", 10);
    return Number.isNaN(raw) ? 1 : Math.max(1, raw);
  };
  return new TicketingEngine({
    inventory: dataset.inventory,
    tickets: dataset.tickets,
    eventOf,
    soldTogetherOf,
    snapshot: restorableSnapshot(snapshot ?? null) ?? undefined,
    ...(now ? { now } : {}),
  });
}

/** 会话键（供组件在 `key` 上使用，切换会话时强制重挂）。 */
export function sessionKey(session: StoredSession): string {
  return `${session.sessionId}:${session.userId}`;
}

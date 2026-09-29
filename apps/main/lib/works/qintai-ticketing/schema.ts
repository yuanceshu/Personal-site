/**
 * 琴台票务 Agent 契约（对齐主站食智助手 `lib/works/restaurant-ai/schema.ts` 的形状）。
 *
 * 浏览器与服务端共用这一份 schema：请求里的 `context` 是**前端确定性投影**（当次候选、
 * 选中项、费用行、会话摘要与相关制度），服务端不落 fixture、不读本地文件，只对该投影做
 * 检索/比价/政策解释与**提案暂存**。
 */

import { z } from "zod";

export const roleSchema = z.enum(["customer", "merchant"]);

/** 一次会话里最多带入的记忆条数。 */
const historyItemSchema = z.strictObject({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1200),
});

/** 票档的紧凑投影（列表/候选/选中项共用）。 */
export const showBriefSchema = z.strictObject({
  product_id: z.string().max(40),
  title: z.string().max(200),
  price: z.number().nonnegative(),
  currency: z.string().max(8),
  category: z.string().max(20),
  remaining: z.number().int().nonnegative(),
  sold_out: z.boolean(),
  event_name: z.string().max(120).nullable(),
  event_date: z.string().max(20).nullable(),
  event_time: z.string().max(10).nullable(),
  venue: z.string().max(120).nullable(),
  tier: z.string().max(60).nullable(),
  labels: z.array(z.string().max(40)).max(4),
  /** 转票独有的性价比分（1–10）。 */
  value_score: z.number().int().min(1).max(10).nullable(),
  vs_box_office: z.string().max(12).nullable(),
});

/** 费用逐项披露的投影。 */
export const disclosureSchema = z.strictObject({
  title: z.string().max(220),
  product_id: z.string().max(40),
  rows: z
    .array(
      z.strictObject({
        label: z.string().max(40),
        value: z.string().max(40),
        note: z.string().max(160).nullable(),
      }),
    )
    .max(12),
  sources: z.array(z.string().max(40)).max(6),
  footnotes: z.array(z.string().max(200)).max(4),
});

export const policyBriefSchema = z.strictObject({
  policy_id: z.string().max(40),
  title: z.string().max(80),
  content: z.string().max(600),
});

/** 观众侧的会话摘要（倒计时由前端本地时钟给出，服务端不推算）。 */
export const sessionSchema = z.strictObject({
  user_name: z.string().max(40).nullable(),
  holds: z
    .array(
      z.strictObject({
        product_id: z.string().max(40),
        title: z.string().max(200),
        quantity: z.number().int().positive(),
        seconds_remaining: z.number().int().nonnegative(),
      }),
    )
    .max(8),
  waitlist: z
    .array(
      z.strictObject({
        product_id: z.string().max(40),
        title: z.string().max(200),
        position: z.number().int().positive(),
      }),
    )
    .max(8),
  offers: z
    .array(
      z.strictObject({
        product_id: z.string().max(40),
        title: z.string().max(200),
        quantity: z.number().int().positive(),
        seconds_remaining: z.number().int().nonnegative(),
      }),
    )
    .max(8),
  tickets: z
    .array(
      z.strictObject({
        ticket_id: z.string().max(40),
        title: z.string().max(200),
        seat: z.string().max(80),
        status: z.string().max(30),
      }),
    )
    .max(20),
  pending_transfers: z
    .array(
      z.strictObject({
        transfer_id: z.string().max(40),
        recipient: z.string().max(60),
        ticket_ids: z.array(z.string().max(40)).max(8),
      }),
    )
    .max(8),
});

/** 运营侧摘要：告警、场次与待审批提案。 */
export const merchantBriefSchema = z.strictObject({
  promoter: z.string().max(80),
  current_period: z.string().max(40),
  totals: z.strictObject({
    sales: z.number(),
    orders: z.number().int(),
    traffic: z.number().int(),
    conversion_rate: z.number(),
    sales_change_pct: z.number().nullable(),
    currency: z.string().max(8),
  }),
  counts: z.strictObject({
    low_stock: z.number().int().nonnegative(),
    slow_movers: z.number().int().nonnegative(),
    order_issues: z.number().int().nonnegative(),
    pending_changes: z.number().int().nonnegative(),
  }),
  events: z
    .array(
      z.strictObject({
        event_id: z.string().max(40),
        event_name: z.string().max(120),
        event_date: z.string().max(20),
        days_to_event: z.number().int(),
        sold_out: z.boolean(),
      }),
    )
    .max(12),
  pacing: z
    .array(
      z.strictObject({
        product_id: z.string().max(40),
        tier: z.string().max(60).nullable(),
        price: z.number(),
        capacity: z.number().int(),
        sold: z.number().int(),
        remaining: z.number().int(),
        sell_through_pct: z.number(),
        baseline_pct: z.number().nullable(),
        pace_vs_baseline_pts: z.number().nullable(),
        waitlist_depth: z.number().int(),
      }),
    )
    .max(24),
  alerts: z
    .array(
      z.strictObject({
        listing_id: z.string().max(40),
        title: z.string().max(200),
        kind: z.enum(["low_stock", "slow_mover"]),
        stock: z.number().int(),
        threshold: z.number().int().nullable(),
      }),
    )
    .max(24),
  pending_changes: z
    .array(
      z.strictObject({
        change_id: z.string().max(40),
        kind: z.string().max(30),
        summary: z.string().max(200),
        item_count: z.number().int().nonnegative(),
      }),
    )
    .max(12),
  guardrails: z.strictObject({
    max_price_delta_pct: z.number(),
    max_promotion_discount_pct: z.number(),
    max_restock_quantity: z.number().int(),
    max_campaign_budget: z.number(),
  }),
});

export const contextSchema = z.strictObject({
  page: z.enum(["home", "shows", "show", "wallet", "waitlist", "orders", "events", "holds", "merchant", "other"]),
  store: z.string().max(40),
  limits: z.strictObject({
    hold_minutes: z.number().int().positive(),
    max_tickets_per_event: z.number().int().positive(),
    offer_claim_minutes: z.number().int().positive(),
    barcode_rotation_seconds: z.number().int().positive(),
  }),
  /** 当次界面上的候选集（搜索结果 / 运营票档列表）。 */
  results: z.array(showBriefSchema).max(12),
  selected: showBriefSchema.nullable(),
  disclosure: disclosureSchema.nullable(),
  policies: z.array(policyBriefSchema).max(6),
  session: sessionSchema.nullable(),
  merchant: merchantBriefSchema.nullable(),
});

export const requestSchema = z.strictObject({
  role: roleSchema,
  message: z.string().trim().min(1).max(1200),
  history: z.array(historyItemSchema).max(16),
  /** 用户已确认的提案 id（前端确定性代码据此执行，模型无法自行应用）。 */
  accepted: z
    .array(z.string().max(48).regex(/^[a-z]+-[A-Za-z0-9-]{2,40}$/))
    .max(12),
  context: contextSchema,
});

export const sourceSchema = z.strictObject({
  id: z.string().max(60),
  title: z.string().max(120),
  category: z.string().max(40),
  excerpt: z.string().max(600),
});

export const cardSchema = z.strictObject({
  id: z.string().max(40),
  title: z.string().max(80),
  eyebrow: z.string().max(60),
  items: z
    .array(z.strictObject({ label: z.string().max(60), value: z.string().max(120) }))
    .max(8),
});

/**
 * 草案携带的结构化动作。模型只负责填这四个字段，**执行始终由浏览器侧的确定性代码完成**：
 * 提交时按实时余量与护栏重新校验，不信任这份草案本身。
 */
export const proposalActionSchema = z.strictObject({
  kind: z.enum(["hold", "price", "promotion", "restock"]),
  listing_id: z.string().max(40),
  /** hold 的张数；其余动作为 null。 */
  quantity: z.number().int().positive().nullable(),
  /** price/promotion 的新价格或折扣百分比、restock 的释放张数；hold 为 null。 */
  value: z.number().nullable(),
  note: z.string().max(200).nullable(),
});

export const proposalSchema = z.strictObject({
  id: z.string().max(48),
  title: z.string().max(80),
  detail: z.string().max(400),
  action_label: z.string().max(40),
  action: proposalActionSchema.nullable(),
});

export const resultSchema = z.strictObject({
  mode: z.literal("live"),
  answer: z.string().max(2400),
  sources: z.array(sourceSchema).max(8),
  cards: z.array(cardSchema).max(6),
  proposal: proposalSchema.nullable(),
  followups: z.array(z.string().max(60)).max(3),
});

export type Role = z.infer<typeof roleSchema>;
export type ShowBrief = z.infer<typeof showBriefSchema>;
export type DisclosureBrief = z.infer<typeof disclosureSchema>;
export type SessionBrief = z.infer<typeof sessionSchema>;
export type MerchantBrief = z.infer<typeof merchantBriefSchema>;
export type AgentContext = z.infer<typeof contextSchema>;
export type ChatPayload = z.infer<typeof requestSchema>;
export type ChatSource = z.infer<typeof sourceSchema>;
export type ChatCard = z.infer<typeof cardSchema>;
export type ChatProposalAction = z.infer<typeof proposalActionSchema>;
export type ChatProposal = z.infer<typeof proposalSchema>;
export type ChatResult = z.infer<typeof resultSchema>;

export const EMPTY_CONTEXT: AgentContext = {
  page: "home",
  store: "琴台票务",
  limits: {
    hold_minutes: 8,
    max_tickets_per_event: 8,
    offer_claim_minutes: 10,
    barcode_rotation_seconds: 60,
  },
  results: [],
  selected: null,
  disclosure: null,
  policies: [],
  session: null,
  merchant: null,
};

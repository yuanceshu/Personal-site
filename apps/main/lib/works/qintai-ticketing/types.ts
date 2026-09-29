/**
 * 琴台票务（武汉门票场景）领域类型。
 *
 * 由源 Demo `examples/entertainment/api/ticketing.py`、`mock_ticketing.py` 与
 * `demo_common/storefront_fixtures.py` 移植：保留原字段与业务语义，仅将面向访客的
 * 文案本地化为简体中文。所有金额单位为人民币（CNY），全部为模拟数据。
 */

export type Currency = "CNY" | "USD";

/** 目录商品：官方票档（tickets）或观众转票（resale）。 */
export interface Product {
  product_id: string;
  title: string;
  brand: string;
  price: number;
  currency: Currency;
  category: string;
  attributes: Record<string, string>;
  short_description: string;
  long_description: string;
  specs: Record<string, string>;
  review_highlights: string[];
  /** 目录 fixture 未提供评分（保留字段以对齐过滤语义）。 */
  rating?: number;
  review_count?: number;
  image_url?: string;
  /** 实时派生字段（不由 fixture author）。 */
  labels: string[];
  in_stock: boolean;
}

/** 订单行（fixture）。 */
export interface OrderItem {
  product_id: string;
  title: string;
  quantity: number;
  price: number;
}

export interface Order {
  order_id: string;
  status: string;
  placed_at: string;
  items: OrderItem[];
  total: number;
  currency: Currency;
  estimated_delivery: string;
}

export interface UserPreferences {
  user_id: string;
  display_name: string;
  loyalty_tier?: string;
  default_location?: string;
  preferences?: Record<string, string>;
}

export interface Policy {
  policy_id: string;
  title: string;
  category: string;
  content: string;
}

export interface VenueSection {
  section_id: string;
  label: string;
  short_label?: string;
  tier_code: string | null;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Venue {
  venue_id: string;
  name: string;
  city: string;
  viewbox: { width: number; height: number };
  sections: VenueSection[];
  demo_note?: string;
}

/** 门票状态机中的实体。时间统一用 epoch 毫秒。 */
export interface Hold {
  hold_id: string;
  session_id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  expires_at: number;
}

export interface WaitlistEntry {
  user_id: string;
  session_id: string;
  product_id: string;
  quantity: number;
  joined_at: number;
  simulated: boolean;
  departs_at: number | null;
}

export interface ReturnOffer {
  offer_id: string;
  product_id: string;
  user_id: string;
  quantity: number;
  expires_at: number;
  status: "open" | "claimed" | "expired";
}

export interface Ticket {
  ticket_id: string;
  owner_id: string;
  product_id: string;
  order_id: string;
  seat: string;
  status: "active" | "transfer_pending";
}

export interface Transfer {
  transfer_id: string;
  ticket_ids: string[];
  from_user_id: string;
  recipient: string;
  initiated_at: number;
  status: "pending" | "cancelled";
}

export interface InventoryRow {
  capacity: number;
  sold: number;
}

export interface Notification {
  user_id: string;
  text: string;
}

/** 序列化后的引擎状态（用于浏览器 localStorage 持久化）。 */
export interface EngineSnapshot {
  version: number;
  rows: Record<string, InventoryRow>;
  holds: Hold[];
  waitlists: Record<string, WaitlistEntry[]>;
  offers: ReturnOffer[];
  transfers: Transfer[];
  tickets: Ticket[];
  counter: number;
  notifications: Notification[];
}

/** 会话上下文（对应源 `ShoppingSessionContext`）。 */
export interface SessionContext {
  session_id: string;
  user_id: string;
}

/** 购物车行（对应源 `CartItem`）——票务场景下是当前锁座视图。 */
export interface CartItem {
  product_id: string;
  title: string;
  price: number;
  quantity: number;
  image_url?: string;
  option_values: Record<string, string>;
  variant_of: string | null;
}

export interface Cart {
  items: CartItem[];
  currency: Currency;
}

/** 费用逐项披露（对应源 `DisclosureRow` / `Disclosure`）。 */
export interface DisclosureRow {
  label: string;
  value: string;
  note?: string;
}

export interface Disclosure {
  title: string;
  product_id: string;
  rows: DisclosureRow[];
  sources: string[];
  footnotes: string[];
}

export interface FulfillmentOption {
  method: "delivery" | "pickup" | "shipping";
  eta: string;
  fee: number;
  location?: string;
}

/** 观众账户上下文（对应源 `get_account_context` 的返回值）。 */
export interface AccountContext {
  wallet: {
    upcoming_tickets: Array<{
      ticket_id: string;
      event: string;
      date?: string;
      tier?: string;
      seat: string;
      status: string;
    }>;
  };
  active_holds: Array<{
    hold_id: string;
    product_id: string;
    quantity: number;
    seconds_remaining: number;
  }>;
  hold_policy: { hold_minutes: number; never_charged_until_checkout: boolean };
  waitlist_entries: Array<{ product_id: string; quantity: number; position: number }>;
  open_return_offers: Array<{
    offer_id: string;
    product_id: string;
    quantity: number;
    claim_window_seconds_remaining: number;
  }>;
  offer_claim_window_minutes: number;
  pending_transfers: Array<{
    transfer_id: string;
    ticket_ids: string[];
    recipient: string;
    status: string;
  }>;
}

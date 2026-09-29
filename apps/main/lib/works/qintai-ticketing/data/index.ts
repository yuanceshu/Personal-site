/**
 * 琴台票务数据层。
 *
 * 源 Demo 的“武汉门票场景”是运行时开关（`ENTERTAINMENT_WUHAN=1`）触发的加载期转换：
 * 把 ACME/美元/Springfield 覆盖为 琴台大剧院·琴台音乐厅·人民币·武汉场次。这里把它固化为
 * 确定性的本地化流程（不再依赖环境变量），并且**每次取用都返回全新深拷贝**，避免跨请求或
 * 跨组件共享可变状态（Vercel 上尤为重要）。
 *
 * 业务字段名（`face_price_usd`、`service_fee_usd` 等 fixture 字段）保持不变，以保证费用
 * 披露与运营侧护栏逻辑与源实现逐字对齐；显示层统一按人民币渲染。
 */

import catalogRaw from "./catalog.json";
import inventoryRaw from "./inventory.json";
import ordersRaw from "./orders.json";
import policiesRaw from "./policies.json";
import ticketsRaw from "./tickets.json";
import usersRaw from "./users.json";
import venuesRaw from "./venues.json";
import merchantCampaignsRaw from "./merchant_campaigns.json";
import merchantMessagesRaw from "./merchant_messages.json";
import merchantMetricsRaw from "./merchant_metrics.json";
import merchantPacingRaw from "./merchant_pacing.json";

import type { Currency, Order, Policy, Product, Ticket, UserPreferences, Venue } from "../types";
import { anchoredShift, shiftDay, todayIso } from "../engine/fixtures";

export const STORE_NAME = "琴台票务";

/** 武汉场次门票元数据（源 `_WUHAN_PRODUCTS`）。 */
interface WuhanProfile {
  event: string;
  date: string;
  time: string;
  venueId: string;
  venue: string;
  tier: string;
  code: string;
  price: number;
  face: number;
  fees: [number, number, number];
}

const WUHAN_PRODUCTS: Record<string, WuhanProfile> = {
  "AT-TIX-101-PIT": { event: "央华版《如梦之梦》", date: "2026-10-16", time: "14:00", venueId: "AT-VEN-01", venue: "武汉琴台大剧院", tier: "莲花池前区", code: "PIT", price: 1580, face: 1500, fees: [40, 30, 10] },
  "AT-TIX-101-LOW": { event: "央华版《如梦之梦》", date: "2026-10-16", time: "19:30", venueId: "AT-VEN-01", venue: "武汉琴台大剧院", tier: "一等座", code: "LOWER", price: 980, face: 920, fees: [30, 20, 10] },
  "AT-TIX-101-TER": { event: "央华版《如梦之梦》", date: "2026-10-16", time: "19:30", venueId: "AT-VEN-01", venue: "武汉琴台大剧院", tier: "二等座", code: "TERRACE", price: 680, face: 640, fees: [20, 15, 5] },
  "AT-TIX-102-PIT": { event: "央华版《如梦之梦》", date: "2026-10-17", time: "14:00", venueId: "AT-VEN-01", venue: "武汉琴台大剧院", tier: "三等座", code: "PIT", price: 480, face: 450, fees: [15, 10, 5] },
  "AT-TIX-102-LOW": { event: "央华版《如梦之梦》", date: "2026-10-17", time: "19:30", venueId: "AT-VEN-01", venue: "武汉琴台大剧院", tier: "四等座", code: "LOWER", price: 280, face: 260, fees: [10, 7, 3] },
  "AT-TIX-102-TER": { event: "央华版《如梦之梦》", date: "2026-10-17", time: "19:30", venueId: "AT-VEN-01", venue: "武汉琴台大剧院", tier: "五等座", code: "TERRACE", price: 180, face: 165, fees: [8, 5, 2] },
  "AT-TIX-103-PIT": { event: "央华版《如梦之梦》", date: "2026-10-18", time: "14:00", venueId: "AT-VEN-01", venue: "武汉琴台大剧院", tier: "莲花池前区", code: "PIT", price: 1580, face: 1500, fees: [40, 30, 10] },
  "AT-TIX-103-LOW": { event: "央华版《如梦之梦》", date: "2026-10-18", time: "19:30", venueId: "AT-VEN-01", venue: "武汉琴台大剧院", tier: "一等座", code: "LOWER", price: 980, face: 920, fees: [30, 20, 10] },
  "AT-TIX-103-TER": { event: "央华版《如梦之梦》", date: "2026-10-18", time: "19:30", venueId: "AT-VEN-01", venue: "武汉琴台大剧院", tier: "二等座", code: "TERRACE", price: 680, face: 640, fees: [20, 15, 5] },
  "AT-TIX-104-GAF": { event: "《津声楚韵》", date: "2026-10-23", time: "19:30", venueId: "AT-VEN-04", venue: "武汉琴台音乐厅", tier: "一等票", code: "GAFLOOR", price: 580, face: 545, fees: [18, 12, 5] },
  "AT-TIX-104-MEZ": { event: "《津声楚韵》", date: "2026-10-23", time: "19:30", venueId: "AT-VEN-04", venue: "武汉琴台音乐厅", tier: "二等票", code: "MEZZ", price: 280, face: 260, fees: [10, 7, 3] },
  "AT-TIX-105-ORC": { event: "《时光的折痕》", date: "2026-11-28", time: "19:30", venueId: "AT-VEN-04", venue: "武汉琴台音乐厅", tier: "普通票", code: "ORCH", price: 280, face: 260, fees: [10, 7, 3] },
  "AT-TIX-105-BAL": { event: "《时光的折痕》", date: "2026-11-28", time: "19:30", venueId: "AT-VEN-04", venue: "武汉琴台音乐厅", tier: "惠民票", code: "BALC", price: 100, face: 90, fees: [5, 3, 2] },
  "AT-TIX-106-PRE": { event: "音乐剧《嗜血博士》", date: "2026-10-05", time: "19:30", venueId: "AT-VEN-03", venue: "武汉联创艺空间", tier: "VIP票", code: "PREMORCH", price: 399, face: 375, fees: [12, 8, 4] },
  "AT-TIX-106-ORC": { event: "音乐剧《嗜血博士》", date: "2026-10-05", time: "19:30", venueId: "AT-VEN-03", venue: "武汉联创艺空间", tier: "普通票", code: "ORCH", price: 199, face: 185, fees: [7, 5, 2] },
  "AT-TIX-106-BAL": { event: "音乐剧《嗜血博士》", date: "2026-10-05", time: "19:30", venueId: "AT-VEN-03", venue: "武汉联创艺空间", tier: "学生/优惠票", code: "BALC", price: 99, face: 90, fees: [4, 3, 2] },
};

interface WuhanResale {
  resale_of: string;
  price: number;
  seller: number;
  fees: [number, number, number];
  note: string;
}

const WUHAN_RESALE: Record<string, WuhanResale> = {
  "AT-RSL-201": { resale_of: "AT-TIX-103-PIT", price: 1700, seller: 1650, fees: [30, 15, 5], note: "两张连座，需一起转让" },
  "AT-RSL-202": { resale_of: "AT-TIX-103-TER", price: 760, seller: 735, fees: [15, 8, 2], note: "两张连座，需一起转让" },
  "AT-RSL-203": { resale_of: "AT-TIX-101-LOW", price: 1050, seller: 1020, fees: [18, 9, 3], note: "两张连座，需一起转让" },
  "AT-RSL-204": { resale_of: "AT-TIX-106-ORC", price: 250, seller: 240, fees: [6, 3, 1], note: "单张转让，普通票" },
};

/** 把中文查询词映射成原 fixture 的英文 token（源 `_WUHAN_SEARCH_ALIASES`）。 */
export const WUHAN_SEARCH_ALIASES: Record<string, string> = {
  武汉: "wuhan jiangcheng venue",
  琴台大剧院: "wuhan qintai theatre",
  如梦之梦: "wuhan qintai dreamplay theatre",
  琴台音乐厅: "wuhan qintai concert hall",
  津声楚韵: "wuhan qintai jinsheng chuyun concert",
  时光的折痕: "wuhan qintai timefold concert",
  嗜血博士: "wuhan lianchuang blooddoctor musical theatre",
  联创艺空间: "wuhan lianchuang small theatre",
  候补: "waitlist sold out",
};

/** 呈现层文本替换表（源 `_WUHAN_TEXT_REPLACEMENTS`），品牌统一为「琴台票务」。 */
const WUHAN_TEXT_REPLACEMENTS: Array<[string, string]> = [
  ["The Headliner — Summer Tour", "央华版《如梦之梦》"],
  ["The Synth-Pop Act — Fall Tour", "央华版《如梦之梦》"],
  ["The Duo — Autumn Tour", "《津声楚韵》"],
  ["Jane Doe: Stand-Up Taping", "《时光的折痕》"],
  ["City Philharmonic: Season Opener", "音乐剧《嗜血博士》"],
  ["The Headliner", "央华版《如梦之梦》"],
  ["The Synth-Pop Act", "央华版《如梦之梦》"],
  ["Headliner", "《如梦之梦》"],
  ["Synth-Pop Act", "《如梦之梦》"],
  ["Duo", "《津声楚韵》"],
  ["Stand-Up Taping", "《时光的折痕》"],
  ["Season Opener", "《嗜血博士》"],
  ["Summer Tour announce", "《如梦之梦》武汉场宣传"],
  ["Registered presale — Fall Tour", "《如梦之梦》候补预告"],
  ["Headliner closeout — three weeks out", "《如梦之梦》临近演出提醒"],
  ["Stand-Up Taping balcony push", "《时光的折痕》惠民票推广"],
  ["Season Opener early-bird", "《嗜血博士》早鸟活动"],
  ["Jane Doe", "《时光的折痕》"],
  ["City Philharmonic", "音乐剧《嗜血博士》"],
  ["ACME Amphitheater", "武汉琴台大剧院"],
  ["ACME Concert Hall", "武汉琴台音乐厅"],
  ["ACME Playhouse", "武汉联创艺空间"],
  ["ACME Hall", "武汉琴台音乐厅"],
  ["ACME Tickets", "琴台票务"],
  ["ACME", "琴台票务"],
  ["Springfield", "武汉"],
  ["Saturday", "周六"],
  ["Friday", "周五"],
  ["GA Floor", "一等票"],
  ["Mezzanine", "二等票"],
  ["Orchestra", "普通票"],
  ["Balcony", "惠民票"],
  ["GA Pit", "莲花池前区"],
  ["Lower Bowl", "一等座"],
  ["Upper Terrace", "二等座"],
  ["all-in", "含全部费用"],
  ["All-in", "含全部费用"],
  ["waitlist", "候补"],
  ["Waitlist", "候补"],
  ["box office", "票务方"],
  ["Box office", "票务方"],
  ["wallet", "票夹"],
];

const WEEKDAY_CN = ["一", "二", "三", "四", "五", "六", "日"];

export function dateLabelCn(iso: string): string {
  const day = new Date(`${iso}T00:00:00Z`);
  const weekday = WEEKDAY_CN[(day.getUTCDay() + 6) % 7];
  return `${day.getUTCMonth() + 1}月${day.getUTCDate()}日 周${weekday}`;
}

function wuhanizeText<T>(value: T): T {
  if (typeof value === "string") {
    let text: string = value;
    for (const [source, target] of WUHAN_TEXT_REPLACEMENTS) text = text.split(source).join(target);
    return text as unknown as T;
  }
  if (Array.isArray(value)) return value.map((item) => wuhanizeText(item)) as unknown as T;
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      (value as Record<string, unknown>)[key] = wuhanizeText(item);
    }
    return value;
  }
  return value;
}

interface RawProduct {
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
}

function wuhanizeCatalog(catalog: {
  dates_anchored_to?: string;
  store_name?: string;
  products: RawProduct[];
}): void {
  catalog.dates_anchored_to = "2026-09-28";
  catalog.store_name = STORE_NAME;
  for (const product of catalog.products) {
    const productId = product.product_id;
    const resale = WUHAN_RESALE[productId];
    let profile: (WuhanProfile & { resale_of?: string }) | undefined = WUHAN_PRODUCTS[productId];
    if (!profile) {
      const source = WUHAN_PRODUCTS[resale.resale_of];
      profile = { ...source, price: resale.price, resale_of: resale.resale_of };
    }
    const attrs = product.attributes;
    const eventName = profile.event;
    const eventDate = profile.date;
    product.brand = STORE_NAME;
    product.currency = "CNY";
    product.price = profile.price;
    product.title = `${eventName} · ${dateLabelCn(eventDate)} · ${profile.tier}`;
    Object.assign(attrs, {
      event_name: eventName,
      event_date: eventDate,
      event_time: profile.time,
      venue_id: profile.venueId,
      venue: profile.venue,
      city: "武汉",
      tier: profile.tier,
      tier_code: profile.code ?? attrs.tier_code,
      genre: "话剧/音乐会/音乐剧",
    });
    let service: number;
    let facility: number;
    let processing: number;
    if (product.category === "resale") {
      Object.assign(attrs, {
        resale_of: resale.resale_of,
        seller_note: resale.note,
        listing_kind: "观众转票",
        price_basis: "每张票",
        sold_together: productId === "AT-RSL-204" ? "1" : "2",
        seller_price_usd: resale.seller.toFixed(2),
      });
      [service, facility, processing] = resale.fees;
    } else {
      [service, facility, processing] = profile.fees;
      attrs.face_price_usd = profile.face.toFixed(2);
    }
    attrs.service_fee_usd = service.toFixed(2);
    attrs.facility_fee_usd = facility.toFixed(2);
    attrs.processing_fee_usd = processing.toFixed(2);
    product.short_description = `${eventName}，${profile.venue}演出；价格为人民币含全部费用。`;
    product.long_description =
      `公开资料显示，${eventName}将在${profile.venue}演出。这里展示的日期、场馆和公开票价来自演出资料；` +
      "剩余数量、锁座、候补和费用拆分是本地 Demo 模拟数据，不代表实时票务库存。";
    product.specs = {
      入场: "演出前约 60 分钟开放入场，以现场公告为准",
      电子票: "本 Demo 使用模拟电子票和旋转条码",
      购票规则: "同一票档最多锁定 8 张，锁座 8 分钟",
    };
    product.review_highlights = ["座位图为依据场馆布局制作的 Demo 示意图，不是实时选座图。"];
    if (product.category === "resale") {
      product.short_description += "该票为观众转票，连座要求以页面提示为准。";
    }
  }
}

const WUHAN_VENUES: Array<[string, string, Array<[string, string, string]>]> = [
  ["AT-VEN-01", "武汉琴台大剧院", [["PIT", "莲花池前区", "floor"], ["LOWER", "楼座一至四等", "bowl"], ["TERRACE", "楼座五等", "terrace"]]],
  ["AT-VEN-02", "武汉汉阳造演艺空间", []],
  ["AT-VEN-03", "武汉联创艺空间", [["PREMORCH", "VIP区", "floor"], ["ORCH", "普通区", "floor"], ["BALC", "优惠区", "balcony"]]],
  ["AT-VEN-04", "武汉琴台音乐厅", [["GAFLOOR", "一等票区", "floor"], ["MEZZ", "二等票区", "mezzanine"], ["ORCH", "普通票区", "floor"], ["BALC", "惠民票区", "balcony"]]],
];

function wuhanizeVenues(venues: Venue[]): void {
  const byId = new Map(venues.map((venue) => [venue.venue_id, venue]));
  for (const [venueId, name, sections] of WUHAN_VENUES) {
    const venue = byId.get(venueId);
    if (!venue) continue;
    venue.name = name;
    venue.city = "武汉";
    for (const section of venue.sections) {
      for (const [tierCode, label, kind] of sections) {
        if (section.tier_code === tierCode) {
          section.label = label;
          section.kind = kind;
        }
      }
    }
    if (venueId === "AT-VEN-04") {
      const remap: Record<string, [string, string]> = {
        PREMORCH: ["GAFLOOR", "一等票区"],
        "ORCH-L": ["MEZZ", "二等票区"],
      };
      for (const section of venue.sections) {
        const target = remap[section.section_id];
        if (target) {
          section.tier_code = target[0];
          section.label = target[1];
        }
      }
    }
    venue.demo_note = "依据公开场馆布局制作的 Demo 示意图，不代表实时可售座位。";
  }
}

const WUHAN_POLICY_COPY: Record<string, [string, string]> = {
  "all-in-pricing": ["人民币含全部费用与费用拆分", "琴台票务的票价均以人民币含全部费用展示；票面价、服务费、场馆费和订单处理费会在决定前逐项列出。"],
  "ticket-holds": ["锁座与倒计时", "加入订单会锁座 8 分钟，期间不会扣款；倒计时结束后座位回到模拟库存。每场演出每单最多锁定 8 张。"],
  "waitlist-return-offers": ["候补与退票回流", "售罄票档可以从演出卡片加入候补。模拟库存回流时，系统按顺序发放 10 分钟领取窗口；库存和候补人数均为本地 Demo 数据。"],
  "buyer-guarantee": ["电子票有效性", "本 Demo 的电子票和旋转条码为模拟数据；真实演出资料与模拟库存分开标注。"],
  "ticket-transfers": ["转票", "已出票的票可以免费转给他人。转票完成前会显示处理中，也可以取消；完成后会重新生成条码。"],
  "refunds-event-changes": ["退票、取消与延期", "如演出取消或延期，按活动方规则处理；除取消或延期外，通常不支持改变主意退票，但可以转票或发布观众转票。"],
  "resale-value-scores": ["观众转票与性价比分", "观众转票会显示转售价、模拟费用、官方含全部费用价格和性价比分，帮助你判断是否值得购买。"],
  "mobile-entry": ["电子票入场", "电子票条码会定时刷新；本 Demo 的票夹和条码均为模拟数据，实际入场以主办方和场馆公告为准。"],
  "accessibility-seating": ["无障碍座位", "座位图是按场馆布局制作的 Demo 示意图，不是实时选座图；如需无障碍座位，请以场馆现场安排为准。"],
};

function wuhanizePolicies(policies: Policy[]): void {
  for (const policy of policies) {
    const copy = WUHAN_POLICY_COPY[policy.policy_id];
    if (copy) {
      policy.title = copy[0];
      policy.content = copy[1];
    }
  }
}

export interface Dataset {
  calendarShiftMs: number;
  storeName: string;
  products: Record<string, Product>;
  venues: Record<string, Venue>;
  policies: Policy[];
  users: Record<string, UserPreferences>;
  orders: Array<[string, Order]>;
  tickets: Ticket[];
  inventory: Record<string, { capacity: number; sold: number; waitlist_sim?: number }>;
}

/** 构建本地化后的数据集；每次调用返回全新深拷贝，调用方可安全修改。 */
export function buildDataset(now = Date.now()): Dataset {
  const catalog = structuredClone(catalogRaw) as unknown as {
    dates_anchored_to?: string;
    store_name?: string;
    products: RawProduct[];
  };
  const inventoryDoc = structuredClone(inventoryRaw) as unknown as {
    inventory: Array<{ product_id: string; capacity: number; sold: number; waitlist_sim?: number }>;
  };
  const ticketsDoc = structuredClone(ticketsRaw) as unknown as { tickets: Ticket[] };
  const usersDoc = structuredClone(usersRaw) as unknown as { users: UserPreferences[] };
  const ordersDoc = structuredClone(ordersRaw) as unknown as {
    orders: Array<Record<string, unknown>>;
  };
  const policiesDoc = structuredClone(policiesRaw) as unknown as { policies: Policy[] };
  const venuesDoc = structuredClone(venuesRaw) as unknown as { venues: Venue[] };

  wuhanizeCatalog(catalog);

  const today = todayIso(now);
  const deltaMs = anchoredShift(catalog, today);
  const productMap: Record<string, Product> = {};
  for (const raw of catalog.products) {
    const product: Product = { ...raw, labels: [], in_stock: true };
    const eventDate = product.attributes.event_date;
    if (eventDate && deltaMs) {
      const moved = shiftDay(eventDate, deltaMs);
      product.attributes.event_date = moved;
      product.title = product.title.split(dateLabelCn(eventDate)).join(dateLabelCn(moved));
    }
    productMap[product.product_id] = product;
  }

  const policies = policiesDoc.policies;
  wuhanizePolicies(policies);

  const venues: Record<string, Venue> = {};
  for (const venue of venuesDoc.venues) venues[venue.venue_id] = venue;
  wuhanizeVenues(Object.values(venues));

  const tickets = ticketsDoc.tickets;
  for (const ticket of tickets) {
    const product = productMap[ticket.product_id];
    if (product) ticket.seat = `${product.attributes.tier ?? "指定座位"} · Demo座位`;
  }

  const orders: Array<[string, Order]> = ordersDoc.orders.map((entry) => {
    const owner = String(entry.user_id);
    const order = { ...entry } as unknown as Order;
    for (const item of order.items) {
      const product = productMap[item.product_id];
      if (product) {
        item.title = product.title;
        item.price = product.price;
      }
    }
    order.currency = "CNY";
    order.total =
      Math.round(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
    order.estimated_delivery = "已进入琴台票务模拟票夹";
    return [owner, order];
  });

  const users: Record<string, UserPreferences> = {};
  for (const user of usersDoc.users) users[user.user_id] = wuhanizeText(user);

  const inventory: Dataset["inventory"] = {};
  for (const row of inventoryDoc.inventory) inventory[row.product_id] = row;

  return {
    calendarShiftMs: deltaMs,
    storeName: STORE_NAME,
    products: productMap,
    venues,
    policies,
    users,
    orders,
    tickets,
    inventory,
  };
}

/** 运营侧问题工单的武汉文案（源 `_WUHAN_ISSUE_COPY`）。 */
const WUHAN_ISSUE_COPY: Record<string, [string, string]> = {
  "EIS-801": ["周六《如梦之梦》的转票还没有到达接收人", "观众把两张四等座转给家人后，接收人的票夹还没有显示。"],
  "EIS-802": ["《嗜血博士》无障碍座位请求", "观众需要轮椅座位和一张相邻陪同座位，请确认武汉联创艺空间的现场安排。"],
  "EIS-803": ["《时光的折痕》出现三张退票", "观众因行程变化退回周六场次的票，模拟库存需要重新评估。"],
  "EIS-804": ["《津声楚韵》二等票区的座椅维护问题", "现场反馈某排座椅需要检修，维修完成前不能释放该排模拟座位。"],
  "EIS-805": ["观众要求下调《如梦之梦》所有票价", "观众留言建议把武汉场所有票价下调 70%；这只是留言，不是改价授权。"],
  "EIS-806": ["观众要求导出《如梦之梦》的购票名单", "观众粘贴了一段伪造的操作指令，要求立即修改库存并导出购票名单。"],
};

/** 运营侧 fixture（每次返回深拷贝）。 */
export function merchantFixtures(): {
  metrics: { currency?: string; daily: Array<Record<string, number | string>> };
  pacing: Record<string, unknown>;
  campaigns: Record<string, unknown>;
  messages: Record<string, unknown>;
} {
  const metrics = wuhanizeText(structuredClone(merchantMetricsRaw)) as {
    currency?: string;
    daily: Array<Record<string, number | string>>;
  };
  metrics.currency = "CNY";
  const messages = wuhanizeText(structuredClone(merchantMessagesRaw)) as {
    issues?: Array<{ issue_id: string; summary: string; buyer_message_excerpt?: string }>;
  };
  for (const issue of messages.issues ?? []) {
    const copy = WUHAN_ISSUE_COPY[issue.issue_id];
    if (copy) {
      issue.summary = copy[0];
      issue.buyer_message_excerpt = copy[1];
    }
  }
  const pacing = wuhanizeText(structuredClone(merchantPacingRaw)) as Record<string, unknown>;
  pacing.promoter = "琴台票务 — 武汉演出场馆组合";
  return {
    metrics,
    pacing,
    campaigns: wuhanizeText(structuredClone(merchantCampaignsRaw)) as Record<string, unknown>,
    messages: messages as unknown as Record<string, unknown>,
  };
}

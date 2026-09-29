"use client";

/** 观众侧演出检索：一次查询 + 场馆/价格/张数筛选，结果就是交给助手的候选集。 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCustomerContext, useQintai } from "@/components/works/demos/qintai-ticketing/provider";
import {
  Empty,
  Pill,
  chineseDate,
  count,
  dateBlock,
  money,
} from "@/components/works/demos/qintai-ticketing/ui/parts";
import { MIN_QUANTITY_KEY, SELLING_FAST_FLOOR } from "@/lib/works/qintai-ticketing/engine/catalog";
import type { SearchFilters } from "@/lib/works/qintai-ticketing/engine/fixtures";
import type { Product } from "@/lib/works/qintai-ticketing/types";

const VENUES = ["全部场馆", "武汉琴台大剧院", "武汉琴台音乐厅", "武汉汉阳造演艺空间", "武汉联创艺空间"];
const PRICE_CAPS = [
  { label: "不限价格", value: "" },
  { label: "¥300 以内", value: "300" },
  { label: "¥600 以内", value: "600" },
  { label: "¥1000 以内", value: "1000" },
];
const QUANTITIES = [
  { label: "不限张数", value: "" },
  { label: "至少 2 张", value: "2" },
  { label: "至少 4 张", value: "4" },
];
const SORTS: Array<{ label: string; value: NonNullable<SearchFilters["sort"]> }> = [
  { label: "相关度优先", value: "relevance" },
  { label: "价格从低到高", value: "price_asc" },
  { label: "价格从高到低", value: "price_desc" },
];

function sortProducts(rows: Product[], sort: SearchFilters["sort"]): Product[] {
  const sorted = [...rows];
  if (sort === "price_asc") sorted.sort((a, b) => a.price - b.price);
  else if (sort === "price_desc") sorted.sort((a, b) => b.price - a.price);
  return sorted;
}

export function CustomerShows() {
  const { storefront, session, askNow, revision } = useQintai();
  const [query, setQuery] = useState("");
  const [venue, setVenue] = useState(VENUES[0]);
  const [priceCap, setPriceCap] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [sort, setSort] = useState<NonNullable<SearchFilters["sort"]>>("relevance");

  const filters = useMemo<SearchFilters | null>(() => {
    const attributes: Record<string, string> = {};
    if (venue !== VENUES[0]) attributes.venue = venue;
    if (minQuantity) attributes[MIN_QUANTITY_KEY] = minQuantity;
    const built: SearchFilters = { sort };
    if (priceCap) built.max_price = Number(priceCap);
    if (Object.keys(attributes).length > 0) built.attributes = attributes;
    return built;
  }, [venue, priceCap, minQuantity, sort]);

  const { rows, total, relaxed } = useMemo(() => {
    const all = Object.values(storefront.products).map((product) => storefront.withLiveState(product));
    const matches = (product: Product): boolean => {
      if (priceCap && product.price > Number(priceCap)) return false;
      if (venue !== VENUES[0] && product.attributes.venue !== venue) return false;
      if (minQuantity && storefront.engine.remaining(product.product_id) < Number(minQuantity)) return false;
      return true;
    };
    if (query.trim().length > 0) {
      const hit = storefront.searchProducts(session, query, filters, 24);
      return { rows: hit, total: hit.length, relaxed: false };
    }
    // 空查询走同一套排序规则，但过滤在本地做，保证「不限条件」时列表不为空。
    const pool = all.filter(matches);
    return { rows: sortProducts(pool, sort), total: pool.length, relaxed: false };
    // revision 代表确定性状态（余量）被写过的次数。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storefront, session, query, filters, venue, priceCap, minQuantity, sort, revision]);

  useCustomerContext("shows", () => ({
    results: rows.slice(0, 12),
    selected: rows[0] ? storefront.withLiveState(rows[0]) : null,
    disclosure: null,
    policies: storefront.searchPolicies(session, `${query || "购票规则"} 锁座 退票 转票`).slice(0, 4),
  }));

  return (
    <div className="q-view q-view--shows">
      <form className="q-filters" onSubmit={(event) => event.preventDefault()}>
        <label className="q-filter-wide">
          <span>检索演出、场馆或票档</span>
          <input
            type="search"
            value={query}
            placeholder="例如：如梦之梦、琴台音乐厅、惠民票"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>场馆</span>
          <select value={venue} onChange={(event) => setVenue(event.target.value)}>
            {VENUES.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label>
          <span>含费用上限</span>
          <select value={priceCap} onChange={(event) => setPriceCap(event.target.value)}>
            {PRICE_CAPS.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>连座张数</span>
          <select value={minQuantity} onChange={(event) => setMinQuantity(event.target.value)}>
            {QUANTITIES.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>排序</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as NonNullable<SearchFilters["sort"]>)}>
            {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="q-ghost-button"
          onClick={() =>
            askNow(
              "customer",
              `帮我在这份列表里比较一下：哪一个票档最划算、哪一个还有连座？（共 ${rows.length} 个候选）`,
            )
          }
        >
          让助手比较这批候选 <em>AI</em>
        </button>
      </form>

      <div className="q-section-heading q-section-heading--tight">
        <div>
          <p className="q-overline">{query.trim() ? `检索「${query.trim()}」` : "全部在售"}</p>
          <h2>{count(total)} 个票档</h2>
        </div>
        <span>{relaxed ? "已放宽筛选" : "价格均为含全部费用"}</span>
      </div>

      {rows.length === 0 ? (
        <Empty>没有符合条件的票档。可以换一个说法，或取消价格与张数限制。</Empty>
      ) : (
        <ul className="q-result-list">
          {rows.map((product) => {
            const remaining = storefront.engine.remaining(product.product_id);
            const soldOut = remaining === 0;
            const scarce = !soldOut && remaining <= Math.max(SELLING_FAST_FLOOR, Math.floor(storefront.engine.capacity(product.product_id) / 50));
            const isResale = product.category === "resale";
            const score = Number(product.attributes.value_score ?? "");
            const block = dateBlock(product.attributes.event_date);
            return (
              <li className="q-result" key={product.product_id}>
                <span className="q-result-date">
                  {block ? <>{block.mon}<b>{block.day}</b><small>{block.dow}</small></> : "待定"}
                </span>
                <div className="q-result-main">
                  <h3>{product.attributes.event_name ?? product.title}</h3>
                  <p className="q-result-meta">
                    {[
                      product.attributes.tier,
                      product.attributes.venue,
                      product.attributes.event_time,
                      chineseDate(product.attributes.event_date),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="q-result-labels">
                    <Pill tone={soldOut ? "danger" : scarce ? "warn" : "ok"}>
                      {soldOut ? "已售罄 · 可候补" : scarce ? `售票较快 · 余 ${count(remaining)}` : `余 ${count(remaining)}`}
                    </Pill>
                    {isResale ? <Pill tone="accent">观众转票</Pill> : null}
                    {isResale && Number.isFinite(score) ? (
                      <Pill tone={score >= 8 ? "ok" : score >= 5 ? "warn" : "danger"}>
                        性价比 {score}/10 · {product.attributes.vs_box_office}
                      </Pill>
                    ) : null}
                    <span className="q-result-id">{product.product_id}</span>
                  </p>
                </div>
                <div className="q-result-side">
                  <strong className="q-result-price">{money(product.price)}</strong>
                  <small>含全部费用{isResale ? ` · 官方 ${money(Number(product.attributes.box_office_all_in_usd ?? 0))}` : ""}</small>
                  <div className="q-result-actions">
                    <Link className="q-primary-button q-primary-button--small" href={`/works/demos/qintai-ticketing/shows/${product.product_id}`}>
                      查看与锁座
                    </Link>
                    <button
                      type="button"
                      className="q-text-button"
                      onClick={() =>
                        askNow(
                          "customer",
                          `请说明 ${product.product_id}（${product.attributes.event_name} ${product.attributes.tier}）的费用拆分，以及现在还值不值得买。`,
                        )
                      }
                    >
                      问助手 ↗
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="q-disclaimer">
        检索由页面上的确定性排名完成（标题 3.0 / 品牌 2.5 / 分类 2.0 / 属性 1.5 / 描述 1.0 的权重），
        张数筛选按实时余量硬过滤、绝不放宽。助手只在你点「问助手」时读取这份候选集。
      </p>
    </div>
  );
}

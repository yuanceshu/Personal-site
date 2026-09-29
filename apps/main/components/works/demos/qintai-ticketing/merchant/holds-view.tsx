"use client";

/** 运营台「库存与待审批」：所有改动的唯一写入口，应用后才写穿模拟库存与价格。 */

import { useMemo, useState } from "react";
import {
  OPERATOR_NAME,
  explainOperation,
  useMerchantContext,
  useQintai,
} from "@/components/works/demos/qintai-ticketing/provider";
import { Empty, Panel, Pill, count, money, pct } from "@/components/works/demos/qintai-ticketing/ui/parts";
import type { StagedChange } from "@/lib/works/qintai-ticketing/engine/pacing";

const KIND_LABEL: Record<StagedChange["kind"], string> = {
  listing_update: "票档内容",
  price_update: "改价",
  inventory_action: "补货 / 库存",
  promotion: "活动",
  campaign: "宣传",
};

const FIELD_LABEL: Record<string, string> = {
  price: "含全部费用",
  on_sale_capacity: "在售容量",
  discount_pct: "折扣",
  budget: "预算",
  copy_text: "文案",
  audience: "受众",
};

function renderValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") return Number.isInteger(value) ? count(value) : value.toFixed(2);
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "是" : "否";
  return JSON.stringify(value);
}

function ChangeCard({
  change,
  onApply,
  onDiscard,
}: {
  change: StagedChange;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <article className="q-change">
      <header className="q-change-head">
        <div>
          <Pill tone={change.created_by_kind === "agent" ? "accent" : "muted"}>
            {change.created_by_kind === "agent" ? "助手草案" : "人工暂存"}
          </Pill>
          <strong>{change.summary}</strong>
          <small>
            <span className="q-mono">{change.change_id}</span> · {KIND_LABEL[change.kind]} ·
            {" "}{change.created_by} · {new Date(change.created_at).toLocaleString("zh-CN")}
          </small>
        </div>
        <div className="q-change-actions">
          <button type="button" className="q-primary-button q-primary-button--small" onClick={onApply}>应用</button>
          <button type="button" className="q-outline-button q-outline-button--small" onClick={onDiscard}>丢弃</button>
        </div>
      </header>

      <table className="q-change-table">
        <thead>
          <tr><th>票档</th><th>字段</th><th>改动前</th><th>改动后</th></tr>
        </thead>
        <tbody>
          {change.items.map((item) => (
            <tr key={`${item.target}-${item.field}`}>
              <td className="q-mono">{item.target}</td>
              <td>{FIELD_LABEL[item.field] ?? item.field}</td>
              <td className="q-mono">{renderValue(item.before)}</td>
              <td className="q-mono q-change-after">{renderValue(item.after)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="q-change-foot">
        {change.guardrail_notes.length > 0 ? (
          <ul>
            {change.guardrail_notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        ) : null}
        <p>
          {change.margin_impact != null ? `预计边际影响 ${money(change.margin_impact, { sign: true, whole: true })}。` : ""}
          {change.margin_before_pct != null && change.margin_after_pct != null
            ? `毛利 ${pct(change.margin_before_pct)} → ${pct(change.margin_after_pct)}。`
            : ""}
          应用后立即写穿店面的模拟库存与价格。
        </p>
      </footer>
    </article>
  );
}

export function MerchantHolds() {
  const { merchant, merchantSession, commit, revision } = useQintai();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const { pending, resolved } = useMemo(
    () => ({ pending: merchant.getPendingChanges(), resolved: merchant.ledger.resolved().slice().reverse() }),
    // revision 参与依赖：暂存、应用与丢弃都会改台账。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [merchant, revision],
  );

  useMerchantContext("holds", () => ({ pacingProductIds: merchant.portfolioIds() }));

  const act = (changeId: string, mode: "apply" | "discard") => {
    try {
      const change = commit(() =>
        mode === "apply"
          ? merchant.applyChange(merchantSession, changeId)
          : merchant.discardChange(merchantSession, changeId),
      );
      setNotice({
        ok: true,
        text: mode === "apply" ? `${change.change_id} 已应用，模拟库存与价格已经写穿。` : `${change.change_id} 已丢弃。`,
      });
    } catch (error) {
      setNotice({ ok: false, text: explainOperation(error) });
    }
  };

  return (
    <div className="q-view q-view--holds">
      <header className="q-page-intro q-page-intro--panel">
        <div>
          <p className="q-overline">APPROVALS / 库存与待审批</p>
          <h1>改动在这里才真正发生。</h1>
        </div>
        <p className="q-intro-note">
          操作者：{OPERATOR_NAME} · 待审批 {count(pending.length)} 项。护栏在暂存时校验一次，应用时再校验一次；
          被规则拦下的提案会带着原因留在台账里。
        </p>
      </header>

      {notice ? <p className={notice.ok ? "q-inline-ok" : "q-inline-error"} role="status">{notice.text}</p> : null}

      <Panel title="待审批" subtitle={`${count(pending.length)} 项等待你决定`}>
        {pending.length === 0 ? (
          <Empty>
            目前没有待审批的改动。可以在「演出与定价」里对某个票档暂存改价、补货或活动，
            也可以直接让运营助手准备一份草案。
          </Empty>
        ) : (
          <div className="q-change-stack">
            {pending.map((change) => (
              <ChangeCard
                key={change.change_id}
                change={change}
                onApply={() => act(change.change_id, "apply")}
                onDiscard={() => act(change.change_id, "discard")}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="台账记录" subtitle="已应用与已丢弃的改动会留在这里作为审计轨迹">
        {resolved.length === 0 ? (
          <Empty>还没有已处理的改动。</Empty>
        ) : (
          <ul className="q-ledger">
            {resolved.map((change) => (
              <li key={change.change_id}>
                <span className="q-mono">{change.change_id}</span>
                <Pill tone={change.status === "applied" ? "ok" : "muted"}>
                  {change.status === "applied" ? "已应用" : "已丢弃"}
                </Pill>
                <span className="q-ledger-summary">{change.summary}</span>
                <span className="q-mono q-ledger-meta">
                  {KIND_LABEL[change.kind]} · {count(change.items.length)} 项 ·{" "}
                  {change.applied_at ?? change.discarded_at
                    ? new Date((change.applied_at ?? change.discarded_at) as string).toLocaleString("zh-CN")
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="q-disclaimer">
        台账里的「改动前」是暂存那一刻的快照；应用时页面会重新读取当前容量与价格再写入，
        所以同一档位的多项提案不会互相覆盖成错账。台账只属于当前浏览器会话。
      </p>
    </div>
  );
}

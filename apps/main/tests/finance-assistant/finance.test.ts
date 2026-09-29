import assert from "node:assert/strict";
import test from "node:test";
import { queryFinancialData } from "@/lib/works/finance-assistant/finance/query";
import { compareFinancialPeriods } from "@/lib/works/finance-assistant/finance/comparison";
import { reconcileFromData } from "@/lib/works/finance-assistant/finance/reconciliation";
import { executeFinanceTool, agentToolDefinitions } from "@/lib/works/finance-assistant/agent/tools";
import { reconcileOutput } from "@/lib/works/finance-assistant/finance/schemas/reconciliation";

test("迁移后的 Finance Tool 保留查询与期间比较能力", () => {
  const query = queryFinancialData({ metric: "salesAmount", timeRange: { preset: "previous_month" }, filters: {}, groupBy: ["date"], includeShare: false });
  assert.equal(query.unit, "cents");
  assert.equal(query.rows.length, 31);
  const comparison = compareFinancialPeriods({ metric: "salesAmount", timeRange: { preset: "previous_month" }, comparison: "previous_year", filters: {} });
  assert.equal(comparison.unit, "cents");
  assert.equal(comparison.breakdown.length, 3);
});

test("迁移后的对账 Tool 仍返回可追溯差异明细", () => {
  const summary = reconcileFromData({ mode: "summary", timeRange: { preset: "previous_week" }, channel: "银联" });
  assert.equal(summary.mode, "summary");
  assert.ok(summary.summary.groupsCount > 0);
  const details = reconcileOutput.parse(executeFinanceTool("reconcile_transactions", { mode: "details", timeRange: { preset: "previous_week" }, channel: "银联", sortBy: "ABS_DIFFERENCE_DESC", limit: 3 }));
  assert.equal(details.mode, "details");
  assert.ok(details.groups.length <= 3);
  assert.equal(agentToolDefinitions.length, 6);
});

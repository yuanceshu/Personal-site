import type { Metadata } from "next";
import FinanceWorkspace from "@/components/works/demos/finance-assistant/finance-workspace";
import { generateFinancialReport } from "@/lib/works/finance-assistant/finance/report";
import { queryFinancialData } from "@/lib/works/finance-assistant/finance/query";
import { compareFinancialPeriods } from "@/lib/works/finance-assistant/finance/comparison";
import { detectFinancialAnomalies } from "@/lib/works/finance-assistant/finance/anomaly";
import { reconcileFromData } from "@/lib/works/finance-assistant/finance/reconciliation";
import { resolveDateRange } from "@/lib/works/finance-assistant/finance/dates";
import { DEMO_AS_OF_DATE } from "@/lib/works/finance-assistant/finance/config";
import type { DashboardSnapshot, WorkspaceData } from "@/components/works/demos/finance-assistant/ui/types";
import "@/styles/projects/demos/finance-assistant.css";

export const metadata: Metadata = {
  title: "云川财务智能体 · 经营工作台",
  description: "云川商业集团经营分析、渠道对账与异常监测工作台。",
};

export default function FinanceAssistantPage() {
  const timeRange = { preset: "previous_month" as const };
  const snapshots: Record<string, DashboardSnapshot> = {};
  for (const companyId of ["group", "C001", "C002", "C003"] as const) {
    const filters = companyId === "group" ? {} : { companyIds: [companyId] };
    snapshots[companyId] = {
      report: generateFinancialReport({ timeRange, filters }),
      trend: queryFinancialData({ metric: "salesAmount", timeRange, filters, groupBy: ["date"], includeShare: false }),
      orders: queryFinancialData({ metric: "orderCount", timeRange, filters, groupBy: [], includeShare: false }),
      refundRate: queryFinancialData({ metric: "refundRate", timeRange, filters, groupBy: [], includeShare: false }),
      yearComparison: compareFinancialPeriods({ metric: "salesAmount", timeRange, comparison: "previous_year", filters }),
    };
  }
  const data: WorkspaceData = {
    snapshots,
    anomalies: detectFinancialAnomalies({ timeRange: { preset: "previous_week" }, filters: {} }),
    reconciliation: reconcileFromData({ mode: "summary", timeRange: { preset: "previous_week" }, channel: "银联" }),
    reconciliationDetails: reconcileFromData({ mode: "details", timeRange: { preset: "previous_week" }, channel: "银联", sortBy: "ABS_DIFFERENCE_DESC", limit: 20 }),
    referenceDate: DEMO_AS_OF_DATE,
    reconciliationRange: resolveDateRange({ preset: "previous_week" }),
  };
  return <div className="finance-app"><FinanceWorkspace data={data} /></div>;
}

import type { QueryOutput } from '@/lib/works/finance-assistant/finance/schemas/query';
import type { CompareOutput } from '@/lib/works/finance-assistant/finance/schemas/comparison';
import type { ReportOutput } from '@/lib/works/finance-assistant/finance/schemas/report';
import type { AnomalyOutput } from '@/lib/works/finance-assistant/finance/schemas/anomaly';
import type { ReconcileOutput } from '@/lib/works/finance-assistant/finance/schemas/reconciliation';

export type DashboardSnapshot = {
  report: ReportOutput;
  trend: QueryOutput;
  orders: QueryOutput;
  refundRate: QueryOutput;
  yearComparison: CompareOutput;
};
export type WorkspaceData = {
  snapshots: Record<string, DashboardSnapshot>;
  anomalies: AnomalyOutput;
  reconciliation: ReconcileOutput;
  reconciliationDetails: ReconcileOutput;
  referenceDate: string;
  reconciliationRange: { start: string; end: string };
};

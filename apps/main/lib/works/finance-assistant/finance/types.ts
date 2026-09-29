import { z } from 'zod'; import { financialDailyRecord } from './schemas/data'; import { ledgerRecord } from './schemas/reconciliation';
export type FinancialDailyRecord=z.infer<typeof financialDailyRecord>; export type LedgerRecord=z.infer<typeof ledgerRecord>;
export type { ReconciliationGroup, ReconciliationSummary, InternalLedgerRecord, ChannelSettlementRecord } from './schemas/reconciliation';
export type MetricUnit='cents'|'count'|'ratio';

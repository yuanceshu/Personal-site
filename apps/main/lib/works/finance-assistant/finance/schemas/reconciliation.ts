import { z } from 'zod';
import { channel, companyId, dateString, timeRange } from './common';

// 数据、候选金额、结果金额始终为安全整数分；比例单独使用 number。
export const cents = z.number().int().refine(Number.isSafeInteger, '金额必须为安全整数分');
const recordBase = z.object({
  id: z.string().min(1), date: dateString, companyId, channel,
  batchId: z.string().min(1), orderId: z.string().min(1),
  amountCents: cents.nonnegative(), feeCents: cents.nonnegative(),
});
export const internalLedgerRecord = recordBase.extend({
  paymentTxnId: z.string().min(1), externalTxnId: z.string().min(1).optional(),
  status: z.enum(['posted', 'reversed', 'refunded']),
});
export const channelSettlementRecord = recordBase.extend({
  externalTxnId: z.string().min(1), paymentTxnId: z.string().min(1).optional(),
  status: z.enum(['settled', 'pending', 'refunded']),
});
export const ledgerRecord = z.union([internalLedgerRecord, channelSettlementRecord]);
export const reconciliationDataSchema = z.object({
  internalLedger: z.array(internalLedgerRecord),
  channelSettlement: z.array(channelSettlementRecord),
}).superRefine((data, context) => {
  for (const side of ['internalLedger', 'channelSettlement'] as const) {
    const ids = new Set<string>();
    data[side].forEach((record, index) => {
      if (ids.has(record.id)) context.addIssue({code: 'custom', path: [side, index, 'id'], message: '同一账侧 id 必须唯一'});
      ids.add(record.id);
    });
  }
});
export const matchType = z.enum(['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY', 'UNMATCHED']);
export const issueType = z.enum(['AMOUNT_MISMATCH', 'INTERNAL_ONLY', 'CHANNEL_ONLY', 'STATUS_MISMATCH', 'DUPLICATE_SUSPECTED', 'MANUAL_REVIEW_REQUIRED']);
export const reasonCode = z.enum([
  'EXACT', 'FEE_ADJUSTED', 'WITHIN_TOLERANCE', 'SUM_MATCH', 'SUM_WITHIN_TOLERANCE',
  'AMOUNT_DIFFERENCE', 'REFUND_AMOUNT_DIFFERENCE', 'STATUS_DIFFERENCE',
  'NO_SETTLEMENT', 'NO_INTERNAL', 'DUPLICATE_KEY', 'SEARCH_LIMIT_EXCEEDED',
]);
export const reconciliationConfigSchema = z.object({
  amountToleranceCents: cents.nonnegative(),
  maxRecordsPerSide: z.number().int().min(2).max(4),
  maxDateDifferenceDays: z.literal(1),
});
export const reconciliationGroup = z.object({
  reconciliationId: z.string(), matchStatus: z.enum(['MATCHED', 'UNMATCHED']),
  matchType, issueType: issueType.nullable(), companyId, channel, batchId: z.string(),
  dateRange: z.object({start: dateString, end: dateString}),
  internalIds: z.array(z.string()), settlementIds: z.array(z.string()), orderIds: z.array(z.string()),
  paymentTxnIds: z.array(z.string()), externalTxnIds: z.array(z.string()),
  internalAmountCents: cents, settlementAmountCents: cents,
  internalFeeCents: cents, settlementFeeCents: cents,
  feeAdjustmentCents: cents,
  // differenceCents = internalAmountCents - settlementAmountCents - feeAdjustmentCents。
  differenceCents: cents, reasonCode, needsManualReview: z.boolean(),
});
export const reconciliationSummary = z.object({
  totalInternalCount: z.number().int().nonnegative(), totalSettlementCount: z.number().int().nonnegative(),
  totalInternalAmountCents: cents, totalSettlementAmountCents: cents,
  matchedInternalCount: z.number().int().nonnegative(), matchedSettlementCount: z.number().int().nonnegative(),
  matchedCounts: z.object({oneToOne: z.number().int(), oneToMany: z.number().int(), manyToOne: z.number().int(), manyToMany: z.number().int()}),
  issueCounts: z.object({amountMismatch: z.number().int(), internalOnly: z.number().int(), channelOnly: z.number().int(), statusMismatch: z.number().int(), duplicateSuspected: z.number().int(), manualReviewRequired: z.number().int()}),
  matchedAmountCents: cents, unmatchedAmountCents: cents, unmatchedSettlementAmountCents: cents,
  recordMatchRate: z.number().finite().nullable(), amountMatchRate: z.number().finite().nullable(),
  groupsCount: z.number().int().nonnegative(),
});
export const reconcileInput = z.object({
  mode: z.enum(['summary', 'details']), timeRange,
  channel: channel.optional(), companyId: companyId.optional(), companyIds: z.array(companyId).optional(),
  issueType: issueType.optional(), matchType: matchType.optional(),
  sortBy: z.enum(['ABS_DIFFERENCE_DESC', 'DATE_DESC', 'ID_ASC']).optional(),
  limit: z.number().int().min(1).max(20).optional(),
}).refine(input => input.mode === 'details' || (!input.issueType && !input.matchType), '结果分类筛选仅用于 details 模式');
export const reconcileOutput = z.discriminatedUnion('mode', [
  z.object({mode: z.literal('summary'), summary: reconciliationSummary}),
  z.object({mode: z.literal('details'), groups: z.array(reconciliationGroup)}),
]);
export type InternalLedgerRecord = z.infer<typeof internalLedgerRecord>;
export type ChannelSettlementRecord = z.infer<typeof channelSettlementRecord>;
export type ReconciliationData = z.infer<typeof reconciliationDataSchema>;
export type ReconciliationConfig = z.infer<typeof reconciliationConfigSchema>;
export type ReconciliationGroup = z.infer<typeof reconciliationGroup>;
export type ReconciliationSummary = z.infer<typeof reconciliationSummary>;
export type MatchType = z.infer<typeof matchType>;
export type IssueType = z.infer<typeof issueType>;
export type ReasonCode = z.infer<typeof reasonCode>;
export type ReconcileInput = z.infer<typeof reconcileInput>;
export type ReconcileOutput = z.infer<typeof reconcileOutput>;

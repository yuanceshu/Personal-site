import { formatCurrencyFromCents, formatWanYuanFromCents, formatPercent } from '@/lib/works/finance-assistant/finance/format';

export const companyNames: Record<string, string> = { C001: '华东子公司', C002: '华南子公司', C003: '华北子公司' };
export const metricNames: Record<string, string> = { salesAmount: '销售额', transactionAmount: '交易额', refundAmount: '退款金额', netSalesAmount: '净销售额', orderCount: '订单数', refundRate: '退款率', avgOrderValue: '客单价' };
export const issueNames: Record<string, string> = { AMOUNT_MISMATCH: '金额不一致', INTERNAL_ONLY: '仅内部有记录', CHANNEL_ONLY: '仅渠道有记录', STATUS_MISMATCH: '状态不一致', DUPLICATE_SUSPECTED: '疑似重复', MANUAL_REVIEW_REQUIRED: '需人工复核' };
export const matchNames: Record<string, string> = { ONE_TO_ONE: '一对一', ONE_TO_MANY: '一对多', MANY_TO_ONE: '多对一', MANY_TO_MANY: '多对多', UNMATCHED: '未匹配' };
export const reasonNames: Record<string, string> = { EXACT: '金额与标识精确一致', FEE_ADJUSTED: '扣除手续费后金额一致', WITHIN_TOLERANCE: '差额在容差范围内', SUM_MATCH: '组合金额一致', SUM_WITHIN_TOLERANCE: '组合金额在容差范围内', AMOUNT_DIFFERENCE: '内部与渠道金额存在差异', REFUND_AMOUNT_DIFFERENCE: '退款金额存在差异', STATUS_DIFFERENCE: '内部与渠道状态存在差异', NO_SETTLEMENT: '未找到对应渠道流水', NO_INTERNAL: '未找到对应内部流水', DUPLICATE_KEY: '渠道记录存在重复标识', SEARCH_LIMIT_EXCEEDED: '候选组合超过搜索限制，需人工复核' };
export const label = (key: string) => key.replace(/C00[123]/g, id => companyNames[id] ?? id);
export const currency = (cents: number, compact = true) => compact && Math.abs(cents) >= 1000000 ? formatWanYuanFromCents(cents) : formatCurrencyFromCents(cents);
export const ratio = (value: number | null, signed = false) => `${signed && value !== null && value > 0 ? '+' : ''}${formatPercent(value)}`;
export const date = (value: string) => value.replaceAll('-', '.');
export const scalar = (value: number, unit: string) => unit === 'ratio' ? ratio(value) : value.toLocaleString('zh-CN');

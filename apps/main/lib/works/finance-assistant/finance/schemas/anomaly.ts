import { z } from 'zod'; import { filters, timeRange } from './common';
export const anomalyRule=z.enum(['SALES_DROP','REFUND_RATE','RECON_DIFF','LARGE_TXN','CHANNEL_DROP']);
export const anomalyInput=z.object({timeRange,filters,rules:z.array(anomalyRule).optional()});
const anomalyBase=z.object({severity:z.enum(['low','medium','high']),message:z.string(),date:z.string().optional(),scope:z.string().optional(),deviationRate:z.number().finite().optional()});
const centsItem=anomalyBase.extend({rule:z.enum(['SALES_DROP','CHANNEL_DROP','RECON_DIFF','LARGE_TXN']),valueCents:z.number().int().finite(),baselineCents:z.number().int().finite()});
const ratioItem=anomalyBase.extend({rule:z.literal('REFUND_RATE'),valueRatio:z.number().finite(),baselineRatio:z.number().finite()});
export const anomalyOutput=z.object({items:z.array(z.union([centsItem,ratioItem]))});
export type AnomalyInput=z.infer<typeof anomalyInput>; export type AnomalyOutput=z.infer<typeof anomalyOutput>;

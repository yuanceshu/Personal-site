import { z } from 'zod'; import { filters, metricCode, timeRange } from './common';
export const groupBy=z.enum(['date','company','channel','category']);
export const queryInput=z.object({metric:metricCode,timeRange,filters,groupBy:z.array(groupBy).max(2).default([]),includeShare:z.boolean().default(false)});
const base=z.object({metric:metricCode,range:z.object({start:z.string(),end:z.string()})});
const centsRow=z.object({key:z.string(),valueCents:z.number().int().finite(),share:z.number().finite().optional()});
const scalarRow=z.object({key:z.string(),value:z.number().finite(),share:z.number().finite().optional()});
export const queryOutput=z.union([base.extend({unit:z.literal('cents'),totalCents:z.number().int().finite(),rows:z.array(centsRow)}),base.extend({unit:z.enum(['count','ratio']),totalValue:z.number().finite(),rows:z.array(scalarRow)})]);
export type QueryInput=z.infer<typeof queryInput>; export type QueryOutput=z.infer<typeof queryOutput>;

import { z } from 'zod'; import { filters, metricCode, timeRange } from './common';
const base=z.object({metric:metricCode,changeRate:z.number().finite().nullable()});
const centsBreakdown=z.object({key:z.string(),currentCents:z.number().int().finite(),previousCents:z.number().int().finite(),changeCents:z.number().int().finite(),contributionRate:z.number().finite().nullable()});
const scalarBreakdown=z.object({key:z.string(),currentValue:z.number().finite(),previousValue:z.number().finite(),changeValue:z.number().finite(),contributionRate:z.number().finite().nullable()});
export const compareInput=z.object({metric:metricCode,timeRange,comparison:z.enum(['previous_period','previous_month','previous_year']),filters});
export const compareOutput=z.union([base.extend({unit:z.literal('cents'),currentCents:z.number().int().finite(),previousCents:z.number().int().finite(),absoluteChangeCents:z.number().int().finite(),breakdown:z.array(centsBreakdown)}),base.extend({unit:z.enum(['count','ratio']),currentValue:z.number().finite(),previousValue:z.number().finite(),changeValue:z.number().finite(),breakdown:z.array(scalarBreakdown)})]);
export type CompareInput=z.infer<typeof compareInput>; export type CompareOutput=z.infer<typeof compareOutput>;

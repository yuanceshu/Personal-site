import { z } from 'zod'; import { filters, metricCode, timeRange } from './common';
export const varianceInput=z.object({metric:metricCode,timeRange,filters,dimension:z.enum(['company','channel','category','date'])});
const base=z.object({metric:metricCode});
const centsContributor=z.object({key:z.string(),changeCents:z.number().int().finite(),contributionRate:z.number().finite().nullable()});
const scalarContributor=z.object({key:z.string(),changeValue:z.number().finite(),contributionRate:z.number().finite().nullable()});
export const varianceOutput=z.union([base.extend({unit:z.literal('cents'),overall:z.object({currentCents:z.number().int().finite(),previousCents:z.number().int().finite(),absoluteChangeCents:z.number().int().finite()}),topContributors:z.array(centsContributor),concentratedPeriod:z.string().nullable()}),base.extend({unit:z.enum(['count','ratio']),overall:z.object({currentValue:z.number().finite(),previousValue:z.number().finite(),changeValue:z.number().finite()}),topContributors:z.array(scalarContributor),concentratedPeriod:z.string().nullable()})]);
export type VarianceInput=z.infer<typeof varianceInput>; export type VarianceOutput=z.infer<typeof varianceOutput>;

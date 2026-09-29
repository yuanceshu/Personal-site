import { z } from 'zod'; import { channel, category, companyId, dateString } from './common'; import { reconciliationDataSchema } from './reconciliation';
export const financialDailyRecord=z.object({date:dateString,companyId,channel,category,orderCount:z.number().int().nonnegative(),salesAmountCents:z.number().int().nonnegative(),transactionAmountCents:z.number().int().nonnegative(),refundCount:z.number().int().nonnegative(),refundAmountCents:z.number().int().nonnegative()});
export const financialDailyData=z.array(financialDailyRecord);
export const reconciliationData=reconciliationDataSchema;

import config from '@/lib/works/finance-assistant/data/finance-config.json';
export const financeConfig=config; export const DEMO_AS_OF_DATE=config.demoAsOfDate;
type Rule={code:string;dropRate?:number;baselineDays?:number;threshold?:number;thresholdCents?:number};
const rules=config.anomalyRules as Rule[];
const rule=(code:string)=>rules.find(item=>item.code===code)!;
export const anomalyRuleConfig={SALES_DROP:rule('SALES_DROP'),REFUND_RATE:rule('REFUND_RATE'),RECON_DIFF:rule('RECON_DIFF'),LARGE_TXN:rule('LARGE_TXN'),CHANNEL_DROP:rule('CHANNEL_DROP')};

import { reconciliationConfigSchema } from './schemas/reconciliation';
export const reconciliationConfig = reconciliationConfigSchema.parse(config.reconciliation);

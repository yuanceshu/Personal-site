import type { MetricCode } from './schemas/common'; import { financeConfig } from './config';
export function resolveMetric(value:string):MetricCode{const found=financeConfig.metrics.find(m=>m.code===value||m.name===value);if(!found)throw new Error(`未知指标: ${value}`);return found.code as MetricCode;}
export function metricUnit(metric:MetricCode){return ['refundRate'].includes(metric)?'ratio':metric==='orderCount'?'count':'cents' as const;}

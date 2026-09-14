import { periods } from "./catalog";
import type { DataRef } from "@/lib/works/ai-solution-lab/schema";

export type MetricRef = Extract<
  DataRef,
  "healthcare_metrics" | "retail_metrics" | "generic_metrics"
>;
export const metricDatasets = {
  healthcare_metrics: {
    label: "医院经营示例",
    metric: "门诊人次",
    secondary: "预约人次",
    money: "缴费金额",
    unit: "人次",
    periods,
  },
  retail_metrics: {
    label: "零售经营示例",
    metric: "成交订单",
    secondary: "到店人数",
    money: "销售金额",
    unit: "单",
    periods: {
      week: {
        label: "本周",
        visits: [210, 195, 230, 250, 240, 320, 355],
        previous: 1700,
        appointments: 8700,
        revenue: 378000,
        labels: periods.week.labels,
      },
      previous: {
        label: "上周",
        visits: [205, 190, 205, 240, 230, 290, 340],
        previous: 1650,
        appointments: 8100,
        revenue: 340000,
        labels: periods.week.labels,
      },
    },
  },
  generic_metrics: {
    label: "通用业务参考数据（不代表你的实际指标）",
    metric: "已完成事项",
    secondary: "新增事项",
    money: "示例业务金额",
    unit: "项",
    periods: {
      week: {
        label: "本周",
        visits: [24, 30, 27, 35, 31, 18, 15],
        previous: 175,
        appointments: 205,
        revenue: 50000,
        labels: periods.week.labels,
      },
      previous: {
        label: "上周",
        visits: [22, 26, 25, 29, 30, 24, 19],
        previous: 170,
        appointments: 190,
        revenue: 48000,
        labels: periods.week.labels,
      },
    },
  },
};
export function getStats(ref: MetricRef, period: keyof typeof periods) {
  const dataset = metricDatasets[ref];
  const data = dataset.periods[period];
  const total = data.visits.reduce((a, b) => a + b, 0);
  const change = (((total - data.previous) / data.previous) * 100).toFixed(1);
  const minimum = Math.min(...data.visits);
  return {
    dataset,
    data,
    total,
    change,
    minimum,
    minimumDay: data.labels[data.visits.indexOf(minimum)],
  };
}

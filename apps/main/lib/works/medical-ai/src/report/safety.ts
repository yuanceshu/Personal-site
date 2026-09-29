import type { RawCtReport } from './types';

export interface ReportSafetyResult {
  critical: boolean;
  source: 'MOCK_PACS_CRITICAL_FLAG';
  message: string;
}

/** 报告安全和腹痛症状 Safety 分开；这里只读取 Mock PACS 的确定性字段。 */
export function evaluateReportSafety(report: Pick<RawCtReport, 'critical_flag'>): ReportSafetyResult {
  return {
    critical: report.critical_flag,
    source: 'MOCK_PACS_CRITICAL_FLAG',
    message: report.critical_flag ? 'Mock PACS 标记该报告需要尽快由现场医生处理。' : 'Mock PACS 未标记明确危急值。',
  };
}

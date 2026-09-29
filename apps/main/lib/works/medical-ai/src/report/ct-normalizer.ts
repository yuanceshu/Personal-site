import type { RawCtReport, StructuredCtReport } from './types';

/** 只做结构整理，不从报告外推诊断或危急程度。 */
export function normalizeCtReport(raw: RawCtReport): StructuredCtReport {
  if (raw.report_status !== 'READY' || (raw.status !== undefined && raw.status !== 'READY')) {
    throw new Error('报告尚未 READY，不能进行报告解释');
  }

  return {
    report_id: raw.report_id,
    visit_id: raw.visit_id,
    exam_name: raw.exam_name,
    exam_date: raw.exam_date,
    clinical_history: raw.clinical_history,
    technique: raw.technique,
    findings: [...raw.findings],
    impression: raw.impression.trim() ? [raw.impression.trim()] : [],
    recommendations: raw.recommendation.trim() ? [raw.recommendation.trim()] : [],
    report_status: 'READY',
    critical_flag: raw.critical_flag,
    source: raw.source,
    source_url: raw.source_url,
    is_demo_data: true,
  };
}

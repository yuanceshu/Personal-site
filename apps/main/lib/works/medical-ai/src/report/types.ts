import type { KnowledgeEntry } from '../knowledge/types';

export type ReportSignificance = 'normal' | 'attention' | 'uncertain';

/** Mock LIS/PACS 返回的原始腹部 CT 报告事实。 */
export interface RawCtReport {
  report_id: string;
  visit_id: string;
  exam_name: string;
  exam_date: string;
  clinical_history: string;
  technique: string;
  findings: string[];
  impression: string;
  recommendation: string;
  report_status: 'PENDING' | 'READY';
  critical_flag: boolean;
  source: string;
  source_url: string;
  is_demo_data: true;

  // 兼容前五阶段已经使用的字段。
  report_type?: string;
  status?: 'READY';
  raw_content?: string;
  structured_data?: {
    findings: string[];
    impression: string;
  };
}

export interface StructuredCtReport {
  report_id: string;
  visit_id: string;
  exam_name: string;
  exam_date: string;
  clinical_history: string;
  technique: string;
  findings: string[];
  impression: string[];
  recommendations: string[];
  report_status: 'READY';
  critical_flag: boolean;
  source: string;
  source_url: string;
  is_demo_data: true;
}

export interface KnowledgeReference {
  id: string;
  title: string;
  source: string;
  source_url: string;
  review_date: string;
  version: string;
}

export interface ReportKeyFinding {
  original: string;
  explanation: string;
  significance: ReportSignificance;
}

export interface ReportInterpretationResult {
  summary: string;
  key_findings: ReportKeyFinding[];
  uncertainty: string[];
  next_steps: string[];
  critical: boolean;
  sources: KnowledgeReference[];
}

export interface ReportInterpretationToolResult {
  raw_report: RawCtReport;
  structured_report: StructuredCtReport;
  interpretation: ReportInterpretationResult;
}

export function toKnowledgeReference(entry: KnowledgeEntry): KnowledgeReference {
  return {
    id: entry.id,
    title: entry.title,
    source: entry.source,
    source_url: entry.source_url,
    review_date: entry.review_date,
    version: entry.version,
  };
}

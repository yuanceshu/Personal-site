import { z } from 'zod';

export const RawCtReportSchema = z.object({
  report_id: z.string(),
  visit_id: z.string(),
  exam_name: z.string(),
  exam_date: z.string(),
  clinical_history: z.string(),
  technique: z.string(),
  findings: z.array(z.string()),
  impression: z.string(),
  recommendation: z.string(),
  report_status: z.enum(['PENDING', 'READY']),
  critical_flag: z.boolean(),
  source: z.string(),
  source_url: z.string(),
  is_demo_data: z.literal(true),
  report_type: z.string().optional(),
  status: z.literal('READY').optional(),
  raw_content: z.string().optional(),
  structured_data: z.object({ findings: z.array(z.string()), impression: z.string() }).optional(),
}).strict();

export const StructuredCtReportSchema = z.object({
  report_id: z.string(),
  visit_id: z.string(),
  exam_name: z.string(),
  exam_date: z.string(),
  clinical_history: z.string(),
  technique: z.string(),
  findings: z.array(z.string()),
  impression: z.array(z.string()),
  recommendations: z.array(z.string()),
  report_status: z.literal('READY'),
  critical_flag: z.boolean(),
  source: z.string(),
  source_url: z.string(),
  is_demo_data: z.literal(true),
}).strict();

export const KnowledgeReferenceSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  source_url: z.string(),
  review_date: z.string(),
  version: z.string(),
}).strict();

export const ReportInterpretationResultSchema = z.object({
  summary: z.string(),
  key_findings: z.array(z.object({
    original: z.string(),
    explanation: z.string(),
    significance: z.enum(['normal', 'attention', 'uncertain']),
  }).strict()),
  uncertainty: z.array(z.string()),
  next_steps: z.array(z.string()),
  critical: z.boolean(),
  sources: z.array(KnowledgeReferenceSchema),
}).strict();

export const ReportInterpretationToolResultSchema = z.object({
  raw_report: RawCtReportSchema,
  structured_report: StructuredCtReportSchema,
  interpretation: ReportInterpretationResultSchema,
}).strict();

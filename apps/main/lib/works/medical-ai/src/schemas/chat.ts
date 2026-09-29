import { z } from 'zod';
import { VisitContextSchema } from './visit';
import { SafetyResultSchema } from './safety';
import { SymptomContextSchema } from './safety';
import { TriageResultSchema } from '../triage/schemas';

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1, 'message 不能为空'),
  patient_id: z.string().min(1).default('demo001'),
  session_id: z.string().min(1).optional(),
}).strict();

export const ToolCallTraceSchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.unknown()),
  result: z.unknown(),
  effect: z.enum(['read', 'write']).optional(),
});

export const ChatResponseSchema = z.object({
  message: z.string(),
  tool_calls: z.array(ToolCallTraceSchema),
  visit_context: VisitContextSchema.nullable(),
  mode: z.enum(['fallback', 'llm']),
  session_id: z.string(),
  debug: z.object({
    intent: z.string(),
    route: z.enum(['MEDICAL_KNOWLEDGE', 'HOSPITAL_KNOWLEDGE', 'BUSINESS_TOOL', 'VISIT_CONTEXT', 'SAFETY_RULES', 'OTHER']),
    knowledge_domain: z.enum(['medical', 'hospital']).nullable(),
    knowledge_entry_ids: z.array(z.string()),
    safety_check: SafetyResultSchema.nullable(),
    symptom_context: SymptomContextSchema.nullable(),
    triage_status: TriageResultSchema.shape.status.nullable(),
    missing_fields: z.array(z.string()),
    recommended_department: z.object({ department_id: z.string(), department_name: z.string() }).nullable(),
    report_id: z.string().nullable(),
    report_source: z.string().nullable(),
    structured_impression: z.array(z.string()),
    critical_flag: z.boolean().nullable(),
    interpretation_route: z.string().nullable(),
  }),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

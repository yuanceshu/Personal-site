import { z } from 'zod';

export const TriageResultSchema = z.object({
  status: z.enum(['NEED_MORE_INFO', 'READY', 'ESCALATED']),
  safety_status: z.enum(['SAFE', 'EMERGENCY']),
  risk_level: z.enum(['SAFE', 'EMERGENCY']),
  department_id: z.string().nullable(),
  department_name: z.string().nullable(),
  reason: z.string().nullable(),
  missing_fields: z.array(z.string()),
}).strict();

export type TriageResultOutput = z.infer<typeof TriageResultSchema>;

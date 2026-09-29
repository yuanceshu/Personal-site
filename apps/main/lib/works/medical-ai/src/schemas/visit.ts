import { z } from 'zod';
import { VISIT_STAGES } from '../domain/visit-context';

export const VisitStageSchema = z.enum(VISIT_STAGES);

export const VisitContextSchema = z.object({
  patient_id: z.string(),
  visit_id: z.string(),
  current_stage: VisitStageSchema,
  department_id: z.string().nullable(),
  department_name: z.string().nullable(),
  doctor_id: z.string().nullable(),
  doctor_name: z.string().nullable(),
  appointment_time: z.string().nullable(),
  registration_status: z.enum(['NOT_REGISTERED', 'COMPLETED']),
  current_order: z.string().nullable(),
  payment_status: z.enum(['UNPAID', 'PAID']).nullable(),
  exam_status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).nullable(),
  report_status: z.enum(['PENDING', 'READY']).nullable(),
  next_action: z.string(),
});

export type VisitContextInput = z.infer<typeof VisitContextSchema>;

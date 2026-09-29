import { z } from 'zod';
import { VISIT_STAGES } from '../domain/visit-context';
import { VisitContextSchema } from './visit';
import { KnowledgeSearchResponseSchema } from './knowledge';
import { SymptomContextSchema } from './safety';
import { ReportInterpretationToolResultSchema, RawCtReportSchema } from '../report/schemas';

export const RegistrationInputSchema = z.object({
  patient_id: z.string().optional(),
  department_id: z.string().default('general_surgery'),
  doctor_id: z.string().default('doctor001'),
  appointment_time: z.string().min(1, 'appointment_time 不能为空'),
}).strict();

export const GetDoctorsInputSchema = z.object({ department_id: z.string().optional() }).strict();
export const GetSlotsInputSchema = z.object({ doctor_id: z.string() }).strict();
export const EmptyToolInputSchema = z.object({}).strict();
export const RouteInputSchema = z.object({ destination: z.enum(['普外科', '医学影像中心']) }).strict();
export const UpdateStageInputSchema = z.object({ stage: z.enum(VISIT_STAGES) }).strict();
export const PatientInputSchema = z.object({ patient_id: z.string().optional() }).strict();
export const KnowledgeSearchInputSchema = z.object({ query: z.string().trim().min(1, 'query 不能为空') }).strict();
export const SafetyInputSchema = z.object({ symptom_context: SymptomContextSchema }).strict();
export const InterpretReportInputSchema = z.object({ report_id: z.string().min(1) }).strict();

export const ToolInputSchemas = {
  get_doctors: GetDoctorsInputSchema,
  get_registration_slots: GetSlotsInputSchema,
  create_registration: RegistrationInputSchema,
  get_visit_context: EmptyToolInputSchema,
  get_exam_orders: EmptyToolInputSchema,
  get_payment_status: EmptyToolInputSchema,
  pay_order: EmptyToolInputSchema,
  get_queue_status: EmptyToolInputSchema,
  get_report: EmptyToolInputSchema,
  interpret_report: InterpretReportInputSchema,
  get_route: RouteInputSchema,
  update_visit_stage: UpdateStageInputSchema,
  get_patient: PatientInputSchema,
  search_medical_knowledge: KnowledgeSearchInputSchema,
  search_hospital_knowledge: KnowledgeSearchInputSchema,
  evaluate_safety: SafetyInputSchema,
} as const;

export const ToolNameSchema = z.enum([
  'get_doctors',
  'get_registration_slots',
  'create_registration',
  'get_visit_context',
  'get_exam_orders',
  'get_payment_status',
  'pay_order',
  'get_queue_status',
  'get_report',
  'interpret_report',
  'get_route',
  'update_visit_stage',
  'get_patient',
  'search_medical_knowledge',
  'search_hospital_knowledge',
  'evaluate_safety',
]);

export type ToolName = z.infer<typeof ToolNameSchema>;

export const ToolOutputSchemas = {
  get_doctors: z.array(z.object({ doctor_id: z.string(), name: z.string(), department_id: z.string(), department: z.string(), title: z.string(), is_demo_data: z.literal(true) })),
  get_registration_slots: z.array(z.object({ slot_id: z.string(), doctor_id: z.string(), appointment_time: z.string(), status: z.enum(['AVAILABLE', 'BOOKED']), is_demo_data: z.literal(true) })),
  create_registration: VisitContextSchema,
  get_visit_context: VisitContextSchema,
  get_exam_orders: z.array(z.object({ exam_id: z.string(), visit_id: z.string(), exam_type: z.string(), location: z.string(), price: z.number(), payment_status: z.enum(['UNPAID', 'PAID']), exam_status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']), queue_number: z.string(), report_status: z.enum(['PENDING', 'READY']), is_demo_data: z.literal(true) })),
  get_payment_status: z.object({ exam_id: z.string(), exam_type: z.string(), price: z.number(), payment_status: z.enum(['UNPAID', 'PAID']), is_demo_data: z.literal(true) }),
  pay_order: z.object({ order: z.unknown(), visit_context: VisitContextSchema }),
  get_queue_status: z.object({ queue_number: z.string(), current_number: z.string(), people_ahead: z.number(), estimated_wait_minutes: z.number(), location: z.string(), is_demo_data: z.literal(true) }),
  get_report: RawCtReportSchema,
  interpret_report: ReportInterpretationToolResultSchema,
  get_route: z.object({ start: z.string(), destination: z.string(), steps: z.array(z.string()), is_demo_data: z.literal(true) }),
  update_visit_stage: VisitContextSchema,
  get_patient: z.object({ patient_id: z.string(), name: z.string(), gender: z.string(), age: z.number(), is_demo_data: z.literal(true) }),
  search_medical_knowledge: KnowledgeSearchResponseSchema,
  search_hospital_knowledge: KnowledgeSearchResponseSchema,
  evaluate_safety: z.object({
    risk_level: z.enum(['SAFE', 'EMERGENCY']),
    action: z.enum(['CONTINUE', 'ESCALATE']),
    message: z.string(),
    matched_rule_ids: z.array(z.string()),
    source_urls: z.array(z.string()),
  }),
} as const;

export type ToolInputMap = {
  [Name in ToolName]: z.input<(typeof ToolInputSchemas)[Name]>;
};

export function parseToolInput<Name extends ToolName>(name: Name, input: unknown): z.output<(typeof ToolInputSchemas)[Name]> {
  return ToolInputSchemas[name].parse(input) as z.output<(typeof ToolInputSchemas)[Name]>;
}

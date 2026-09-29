export const VISIT_STAGES = [
  'PRE_VISIT',
  'REGISTERED',
  'ARRIVED',
  'WAITING_DOCTOR',
  'CONSULTING',
  'PAYMENT',
  'WAITING_EXAM',
  'EXAMINING',
  'WAITING_REPORT',
  'RETURN_VISIT',
  'FINISHED',
] as const;

export type VisitStage = (typeof VISIT_STAGES)[number];
export type RegistrationStatus = 'NOT_REGISTERED' | 'COMPLETED';
export type PaymentStatus = 'UNPAID' | 'PAID';
export type ExamStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type ReportStatus = 'PENDING' | 'READY';

const allowedTransitions: Record<VisitStage, readonly VisitStage[]> = {
  PRE_VISIT: ['REGISTERED'],
  REGISTERED: ['ARRIVED'],
  ARRIVED: ['WAITING_DOCTOR'],
  WAITING_DOCTOR: ['CONSULTING'],
  CONSULTING: ['PAYMENT'],
  PAYMENT: ['WAITING_EXAM'],
  WAITING_EXAM: ['EXAMINING'],
  EXAMINING: ['WAITING_REPORT'],
  WAITING_REPORT: ['RETURN_VISIT'],
  RETURN_VISIT: ['FINISHED'],
  FINISHED: [],
};

export const NEXT_ACTIONS: Readonly<Record<VisitStage, string>> = {
  PRE_VISIT: '选择普外科、医生和预约时间完成挂号',
  REGISTERED: '前往门诊楼3楼普外科签到',
  ARRIVED: '在门诊楼3楼普外科签到后等待叫号',
  WAITING_DOCTOR: '等待张明远医生叫号',
  CONSULTING: '等待医生完成问诊并开具检查',
  PAYMENT: '完成腹部CT检查缴费',
  WAITING_EXAM: '前往二楼医学影像中心等待检查',
  EXAMINING: '在二楼医学影像中心完成腹部CT检查',
  WAITING_REPORT: '等待腹部CT报告',
  RETURN_VISIT: '携带检查结果返回普外科',
  FINISHED: '本次就诊已完成',
};

export interface VisitContext {
  patient_id: string;
  visit_id: string;
  current_stage: VisitStage;
  department_id: string | null;
  department_name: string | null;
  doctor_id: string | null;
  doctor_name: string | null;
  appointment_time: string | null;
  registration_status: RegistrationStatus;
  current_order: string | null;
  payment_status: PaymentStatus | null;
  exam_status: ExamStatus | null;
  report_status: ReportStatus | null;
  next_action: string;
}

export function createInitialVisitContext(): VisitContext {
  return {
    patient_id: 'demo001',
    visit_id: 'visit001',
    current_stage: 'PRE_VISIT',
    department_id: null,
    department_name: null,
    doctor_id: null,
    doctor_name: null,
    appointment_time: null,
    registration_status: 'NOT_REGISTERED',
    current_order: null,
    payment_status: null,
    exam_status: null,
    report_status: null,
    next_action: NEXT_ACTIONS.PRE_VISIT,
  };
}

export function canTransition(from: VisitStage, to: VisitStage): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

export function assertStage(stage: unknown): asserts stage is VisitStage {
  if (typeof stage !== 'string' || !VISIT_STAGES.includes(stage as VisitStage)) {
    throw new Error(`不支持的就诊阶段: ${String(stage)}`);
  }
}

export function cloneVisitContext(context: VisitContext): VisitContext {
  return structuredClone(context);
}

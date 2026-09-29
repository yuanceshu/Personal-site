import {
  departments,
  doctors,
  patients,
  queue,
  report,
  registrationSlots,
  DEMO_PATIENT_ID,
  DEMO_VISIT_ID,
  type Doctor,
  type RegistrationSlot,
} from '../mock/data';
import {
  assertStage,
  canTransition,
  cloneVisitContext,
  createInitialVisitContext,
  NEXT_ACTIONS,
  type VisitContext,
} from '../domain/visit-context';
import { searchMedicalKnowledge } from '../knowledge/search';
import { normalizeCtReport, interpretCtReport } from '../report';
import type { ReportInterpretationToolResult } from '../report/types';

export interface RegistrationInput {
  patient_id?: string;
  department_id?: string;
  doctor_id?: string;
  appointment_time?: string;
}

export interface ExamOrder {
  exam_id: string;
  visit_id: string;
  exam_type: string;
  location: string;
  price: number;
  payment_status: 'UNPAID' | 'PAID';
  exam_status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  queue_number: string;
  report_status: 'PENDING' | 'READY';
  is_demo_data: true;
}

export interface PaymentStatus {
  exam_id: string;
  exam_type: string;
  price: number;
  payment_status: 'UNPAID' | 'PAID';
  is_demo_data: true;
}

export interface InterpretReportInput {
  report_id: string;
}

export interface RouteResult {
  start: string;
  destination: string;
  steps: string[];
  is_demo_data: true;
}

let visitContext = createInitialVisitContext();
let slots: RegistrationSlot[] = structuredClone(registrationSlots);
let examOrder: ExamOrder | null = null;
let reportReady = false;

export interface MockStateSnapshot {
  visitContext: VisitContext;
  slots: RegistrationSlot[];
  examOrder: ExamOrder | null;
  reportReady: boolean;
}

function notFound(message: string): never {
  throw new Error(message);
}

function getPatientOrThrow(patientId = DEMO_PATIENT_ID) {
  const patient = patients.find((item) => item.patient_id === patientId);
  if (!patient) notFound(`未找到患者: ${patientId}`);
  return structuredClone(patient);
}

function getDoctorOrThrow(doctorId: string): Doctor {
  const doctor = doctors.find((item) => item.doctor_id === doctorId);
  if (!doctor) notFound(`未找到医生: ${doctorId}`);
  return doctor;
}

function getDepartmentOrThrow(departmentId: string) {
  const department = departments.find((item) => item.department_id === departmentId);
  if (!department) notFound(`未找到科室: ${departmentId}`);
  return department;
}

export function resetMockState(): void {
  visitContext = createInitialVisitContext();
  slots = structuredClone(registrationSlots);
  examOrder = null;
  reportReady = false;
}

/** 将 Demo 业务状态序列化到浏览器，避免依赖 Vercel 实例内存。 */
export function exportMockState(): MockStateSnapshot {
  return structuredClone({ visitContext, slots, examOrder, reportReady });
}

/** 恢复一次请求的 Demo 业务状态；所有数据仍受后续 Tool 和状态机校验。 */
export function importMockState(snapshot: MockStateSnapshot | null | undefined): void {
  if (!snapshot?.visitContext || !Array.isArray(snapshot.slots)) {
    resetMockState();
    return;
  }
  visitContext = structuredClone(snapshot.visitContext);
  slots = structuredClone(snapshot.slots);
  examOrder = snapshot.examOrder ? structuredClone(snapshot.examOrder) : null;
  reportReady = snapshot.reportReady === true;
}

export function get_patient(patientId = DEMO_PATIENT_ID) {
  return getPatientOrThrow(patientId);
}

export function get_doctors(departmentId?: string): Doctor[] {
  const result = departmentId ? doctors.filter((doctor) => doctor.department_id === departmentId) : doctors;
  return structuredClone(result);
}

export function get_registration_slots(doctorId = 'doctor001'): RegistrationSlot[] {
  getDoctorOrThrow(doctorId);
  return structuredClone(slots.filter((slot) => slot.doctor_id === doctorId));
}

export function create_registration({
  patient_id: patientId = DEMO_PATIENT_ID,
  department_id: departmentId = 'general_surgery',
  doctor_id: doctorId = 'doctor001',
  appointment_time: appointmentTime,
}: RegistrationInput = {}): VisitContext {
  getPatientOrThrow(patientId);
  const department = getDepartmentOrThrow(departmentId);
  const doctor = getDoctorOrThrow(doctorId);
  if (doctor.department_id !== department.department_id) throw new Error('医生与所选科室不匹配');
  if (visitContext.current_stage !== 'PRE_VISIT') throw new Error(`当前阶段不允许挂号: ${visitContext.current_stage}`);
  const slot = slots.find((item) => item.doctor_id === doctorId && item.appointment_time === appointmentTime);
  if (!slot) throw new Error('该号源不存在');
  if (slot.status !== 'AVAILABLE') throw new Error('该号源已被占用');

  slot.status = 'BOOKED';
  visitContext = {
    ...visitContext,
    department_id: department.department_id,
    department_name: department.department_name,
    doctor_id: doctor.doctor_id,
    doctor_name: doctor.name,
    appointment_time: slot.appointment_time,
    registration_status: 'COMPLETED',
    current_stage: 'REGISTERED',
    next_action: NEXT_ACTIONS.REGISTERED,
  };
  return cloneVisitContext(visitContext);
}

export function get_visit_context(): VisitContext {
  return cloneVisitContext(visitContext);
}

export function get_exam_orders(): ExamOrder[] {
  return examOrder ? [structuredClone(examOrder)] : [];
}

export function get_payment_status(): PaymentStatus {
  if (!examOrder) throw new Error('当前还没有检查订单');
  return {
    exam_id: examOrder.exam_id,
    exam_type: examOrder.exam_type,
    price: examOrder.price,
    payment_status: examOrder.payment_status,
    is_demo_data: true,
  };
}

function createExamOrder(): ExamOrder {
  if (examOrder) return examOrder;
  examOrder = {
    exam_id: 'exam001',
    visit_id: DEMO_VISIT_ID,
    exam_type: '腹部 CT',
    location: '二楼医学影像中心',
    price: 268,
    payment_status: 'UNPAID',
    exam_status: 'NOT_STARTED',
    queue_number: queue.queue_number,
    report_status: 'PENDING',
    is_demo_data: true,
  };
  return examOrder;
}

export function pay_order(): { order: ExamOrder; visit_context: VisitContext } {
  if (visitContext.current_stage !== 'PAYMENT') throw new Error(`当前阶段不允许缴费: ${visitContext.current_stage}`);
  const order = createExamOrder();
  order.payment_status = 'PAID';
  visitContext = { ...visitContext, payment_status: 'PAID', current_stage: 'WAITING_EXAM', next_action: NEXT_ACTIONS.WAITING_EXAM };
  return { order: structuredClone(order), visit_context: cloneVisitContext(visitContext) };
}

export function get_queue_status() {
  if (!examOrder) throw new Error('当前还没有检查订单');
  return structuredClone(queue);
}

export function get_report() {
  if (!reportReady || visitContext.report_status !== 'READY') throw new Error('报告尚未生成');
  return structuredClone(report);
}

/** 只读报告解释 Tool：事实先从 get_report 获取，再经过结构化和确定性解释。 */
export function interpret_report({ report_id }: InterpretReportInput): ReportInterpretationToolResult {
  const rawReport = get_report();
  if (rawReport.report_id !== report_id) throw new Error(`未找到报告: ${report_id}`);
  const structuredReport = normalizeCtReport(rawReport);
  const knowledge = searchMedicalKnowledge('腹部 CT 报告 Impression Findings 不确定');
  const sources = knowledge.results
    .filter((entry) => entry.id === 'medical-report-ct-001')
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      source: entry.source,
      source_url: entry.source_url,
      review_date: entry.review_date,
      version: entry.version,
    }));
  return {
    raw_report: rawReport,
    structured_report: structuredReport,
    interpretation: interpretCtReport(structuredReport, sources),
  };
}

export function get_route(destination = '普外科'): RouteResult {
  const routes: Record<string, Omit<RouteResult, 'is_demo_data'>> = {
    普外科: {
      start: '门诊大厅',
      destination: '门诊楼3楼普外科签到区',
      steps: ['从门诊大厅入口直行至服务台', '从右侧扶梯前往3楼', '出扶梯后左转，沿走廊直行约30米', '右侧即可看到普外科签到区'],
    },
    医学影像中心: {
      start: '门诊楼3楼普外科',
      destination: '二楼医学影像中心 CT 登记台',
      steps: ['从普外科签到区返回扶梯口', '乘扶梯或电梯前往2楼', '沿影像中心指引到达登记台', '在 CT 登记台出示缴费结果并取号'],
    },
  };
  const route = routes[destination];
  if (!route) throw new Error(`暂无前往 ${destination} 的 Mock 路线`);
  return { ...structuredClone(route), is_demo_data: true };
}

export function update_visit_stage(stage: unknown): VisitContext {
  assertStage(stage);
  if (stage === visitContext.current_stage) return cloneVisitContext(visitContext);
  if (!canTransition(visitContext.current_stage, stage)) throw new Error(`不允许从 ${visitContext.current_stage} 直接进入 ${stage}`);

  if (stage === 'PAYMENT') {
    const order = createExamOrder();
    visitContext = {
      ...visitContext,
      current_order: '腹部CT',
      payment_status: order.payment_status,
      exam_status: order.exam_status,
      report_status: order.report_status,
      current_stage: stage,
      next_action: NEXT_ACTIONS[stage],
    };
    return cloneVisitContext(visitContext);
  }
  if (stage === 'EXAMINING') {
    if (!examOrder || examOrder.payment_status !== 'PAID') throw new Error('检查开始前必须先完成缴费');
    examOrder.exam_status = 'IN_PROGRESS';
  }
  if (stage === 'WAITING_REPORT') {
    if (!examOrder || examOrder.exam_status !== 'IN_PROGRESS') throw new Error('开始检查后才能等待报告');
    examOrder.exam_status = 'COMPLETED';
    examOrder.report_status = 'PENDING';
  }
  if (stage === 'RETURN_VISIT') {
    if (!examOrder || examOrder.exam_status !== 'COMPLETED') throw new Error('检查完成后才能返回医生');
    examOrder.report_status = 'READY';
    reportReady = true;
  }

  visitContext = {
    ...visitContext,
    current_stage: stage,
    exam_status: examOrder?.exam_status ?? visitContext.exam_status,
    report_status: examOrder?.report_status ?? visitContext.report_status,
    next_action: NEXT_ACTIONS[stage],
  };
  return cloneVisitContext(visitContext);
}

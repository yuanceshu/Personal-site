import {
  create_registration,
  get_doctors,
  get_exam_orders,
  get_payment_status,
  get_patient,
  get_queue_status,
  get_report,
  interpret_report,
  get_registration_slots,
  get_route,
  get_visit_context,
  pay_order,
  update_visit_stage,
} from '../tools/mock-tools';
import { ToolNameSchema, ToolOutputSchemas, parseToolInput, type ToolName } from '../schemas/tools';
import { searchMedicalKnowledge, searchHospitalKnowledge } from '../knowledge/search';
import { evaluateSafety } from '../safety/engine';

export interface ToolDefinition {
  type: 'function';
  function: {
    name: ToolName;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type ToolEffect = 'read' | 'write';

export const TOOL_EFFECTS: Readonly<Record<ToolName, ToolEffect>> = {
  get_doctors: 'read', get_registration_slots: 'read', create_registration: 'write',
  get_visit_context: 'read', get_exam_orders: 'read', get_payment_status: 'read', pay_order: 'write',
  get_queue_status: 'read', get_report: 'read', interpret_report: 'read', get_route: 'read', update_visit_stage: 'write',
  get_patient: 'read', search_medical_knowledge: 'read', search_hospital_knowledge: 'read', evaluate_safety: 'read',
};

export function getToolEffect(name: string): ToolEffect | null {
  return TOOL_EFFECTS[name as ToolName] ?? null;
}

const toolImplementations: Record<ToolName, (input: never) => unknown> = {
  get_doctors: (input) => get_doctors((input as { department_id?: string }).department_id),
  get_registration_slots: (input) => get_registration_slots((input as { doctor_id: string }).doctor_id),
  create_registration: (input) => create_registration(input as { patient_id?: string; department_id?: string; doctor_id?: string; appointment_time?: string }),
  get_visit_context: () => get_visit_context(),
  get_exam_orders: () => get_exam_orders(),
  get_payment_status: () => get_payment_status(),
  pay_order: () => pay_order(),
  get_queue_status: () => get_queue_status(),
  get_report: () => get_report(),
  interpret_report: (input) => interpret_report(input as { report_id: string }),
  get_route: (input) => get_route((input as { destination: '普外科' | '医学影像中心' }).destination),
  update_visit_stage: (input) => update_visit_stage((input as { stage: string }).stage),
  get_patient: (input) => get_patient((input as { patient_id?: string }).patient_id),
  search_medical_knowledge: (input) => searchMedicalKnowledge((input as { query: string }).query),
  search_hospital_knowledge: (input) => searchHospitalKnowledge((input as { query: string }).query),
  evaluate_safety: (input) => evaluateSafety((input as { symptom_context: Parameters<typeof evaluateSafety>[0] }).symptom_context),
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  { type: 'function', function: { name: 'get_doctors', description: '查询 Demo 医生和所属科室。医生信息必须从此 Tool 获取。', parameters: { type: 'object', properties: { department_id: { type: 'string', description: '可选，科室 ID。' } }, additionalProperties: false } } },
  { type: 'function', function: { name: 'get_registration_slots', description: '查询指定医生当前 Mock 号源。号源时间必须从此 Tool 获取。', parameters: { type: 'object', properties: { doctor_id: { type: 'string', description: '医生 ID。' } }, required: ['doctor_id'], additionalProperties: false } } },
  { type: 'function', function: { name: 'create_registration', description: '使用已确认的患者、科室、医生和号源创建 Demo 挂号，并更新 Visit Context。', parameters: { type: 'object', properties: { patient_id: { type: 'string' }, department_id: { type: 'string' }, doctor_id: { type: 'string' }, appointment_time: { type: 'string' } }, required: ['department_id', 'doctor_id', 'appointment_time'], additionalProperties: false } } },
  { type: 'function', function: { name: 'get_visit_context', description: '读取当前患者本次就医旅程的 Visit Context、阶段和下一步动作。', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'get_exam_orders', description: '查询当前就诊的检查订单。', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'get_payment_status', description: '只读查询当前检查订单的缴费状态，不会产生支付副作用。', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'pay_order', description: '为当前腹部 CT 检查订单完成 Demo 缴费。只有 PAYMENT 阶段可以调用。', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'get_queue_status', description: '查询当前检查的 Mock 排队状态。', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'get_report', description: '查询已生成的 Mock 报告。只有报告 READY 后才能获得报告内容。', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'interpret_report', description: '只读解释已 READY 的腹部 CT Mock 报告。事实必须来自 get_report，解释不能改变报告、Visit Context 或其他业务状态。', parameters: { type: 'object', properties: { report_id: { type: 'string', description: '来自 get_report 的报告 ID。' } }, required: ['report_id'], additionalProperties: false } } },
  { type: 'function', function: { name: 'get_route', description: '查询医院内部 Mock 路线，返回分步骤文字路线。', parameters: { type: 'object', properties: { destination: { type: 'string', enum: ['普外科', '医学影像中心'] } }, required: ['destination'], additionalProperties: false } } },
  { type: 'function', function: { name: 'update_visit_stage', description: '推进 Demo Visit Context 到下一个已定义阶段。不要跳过状态机阶段。', parameters: { type: 'object', properties: { stage: { type: 'string', enum: ['PRE_VISIT', 'REGISTERED', 'ARRIVED', 'WAITING_DOCTOR', 'CONSULTING', 'PAYMENT', 'WAITING_EXAM', 'EXAMINING', 'WAITING_REPORT', 'RETURN_VISIT', 'FINISHED'] }, required: ['stage'], additionalProperties: false } } } },
  { type: 'function', function: { name: 'get_patient', description: '查询当前 Demo 患者的基础资料。', parameters: { type: 'object', properties: { patient_id: { type: 'string' } }, additionalProperties: false } } },
  { type: 'function', function: { name: 'search_medical_knowledge', description: '查询当前 Demo 医学知识。医学事实必须来自此 Tool，结果无内容时不得编造。', parameters: { type: 'object', properties: { query: { type: 'string', description: '患者的问题或医学关键词。' } }, required: ['query'], additionalProperties: false } } },
  { type: 'function', function: { name: 'search_hospital_knowledge', description: '查询明川市中心医院 Demo 的稳定医院事实，例如科室位置、门诊时间和停车规则。', parameters: { type: 'object', properties: { query: { type: 'string', description: '医院服务或位置问题。' } }, required: ['query'], additionalProperties: false } } },
  { type: 'function', function: { name: 'evaluate_safety', description: '根据结构化腹痛症状检查本轮 Demo Safety Rules。只能判断是否需要升级现场评估，不能诊断疾病。', parameters: { type: 'object', properties: { symptom_context: { type: 'object', description: '已提取的结构化症状信息。' } }, required: ['symptom_context'], additionalProperties: false } } },
];

export const TOOL_NAMES = Object.freeze(TOOL_DEFINITIONS.map((tool) => tool.function.name));

export function listToolDefinitions(): ToolDefinition[] {
  return structuredClone(TOOL_DEFINITIONS);
}

export function executeTool(name: string, args: unknown = {}, { patientId = 'demo001' } = {}): unknown {
  const parsedName = ToolNameSchema.parse(name);
  let input: unknown = args;
  if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
    const objectInput = { ...(args as Record<string, unknown>) };
    if (parsedName === 'create_registration' && !objectInput.patient_id) objectInput.patient_id = patientId;
    if (parsedName === 'get_patient' && !objectInput.patient_id) objectInput.patient_id = patientId;
    input = objectInput;
  }
  const parsedInput = parseToolInput(parsedName, input);
  const value = toolImplementations[parsedName](parsedInput as never);
  return ToolOutputSchemas[parsedName].parse(value);
}

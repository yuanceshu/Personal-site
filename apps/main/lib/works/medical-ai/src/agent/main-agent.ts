import { SYSTEM_PROMPT } from './system-prompt';
import { LlmClient, type LlmAssistantMessage, type LlmMessage } from './llm-client';
import { executeTool, getToolEffect, listToolDefinitions } from './tool-registry';
import type { Doctor, QueueStatus, RegistrationSlot } from '../mock/data';
import type { VisitContext } from '../domain/visit-context';
import type { KnowledgeSearchResponse } from '../knowledge/types';
import { evaluateSafety } from '../safety/engine';
import type { SafetyResult, SymptomContext } from '../safety/types';
import { triageAbdominalPain } from '../triage/abdominal-pain';
import type { TriageResult } from '../triage/types';
import type { RawCtReport, ReportInterpretationToolResult } from '../report/types';

interface PendingRegistration {
  doctor_id: string;
  doctor_name: string;
  department_id: string;
  department_name: string;
}

export interface AgentSession {
  patient_id: string;
  messages: LlmMessage[];
  pending_registration: PendingRegistration | null;
  report_available: boolean;
  symptom_context: SymptomContext;
  safety_escalated: boolean;
  last_safety_result: SafetyResult | null;
  last_triage_result: TriageResult | null;
  triage_started: boolean;
  triage_ready: boolean;
  pending_slots: RegistrationSlot[];
  last_report_id: string | null;
  symptom_episode_id: number;
}

export interface ToolCallTrace {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  effect?: 'read' | 'write';
}

export interface AgentResult {
  message: string;
  tool_calls: ToolCallTrace[];
  visit_context: VisitContext | null;
  mode: 'fallback' | 'llm';
  session_id: string;
  debug: AgentDebug;
}

export interface AgentDebug {
  intent: string;
  route: 'MEDICAL_KNOWLEDGE' | 'HOSPITAL_KNOWLEDGE' | 'BUSINESS_TOOL' | 'VISIT_CONTEXT' | 'SAFETY_RULES' | 'OTHER';
  knowledge_domain: 'medical' | 'hospital' | null;
  knowledge_entry_ids: string[];
  safety_check: SafetyResult | null;
  symptom_context: SymptomContext | null;
  triage_status: TriageResult['status'] | null;
  missing_fields: string[];
  recommended_department: { department_id: string; department_name: string } | null;
  report_id: string | null;
  report_source: string | null;
  structured_impression: string[];
  critical_flag: boolean | null;
  interpretation_route: string | null;
}

interface HandleInput {
  message: string;
  patient_id?: string;
  session_id?: string;
}

interface Output {
  message: string;
  context?: VisitContext;
  debug?: Partial<AgentDebug>;
}

type InvokeResult<T> = { ok: true; value: T } | { ok: false; error: string };

const sessions = new Map<string, AgentSession>();
const THEN_PATTERN = /^(然后呢[？?]?|接下来呢[？?]?|下一步(干嘛|是什么)?[？?]?|我现在(应该)?(干什么|去哪)[？?]?|接下来去哪[？?]?)$/;
const TIME_PATTERN = /\b\d{1,2}:\d{2}\b/;
const NEW_SYMPTOM_EPISODE_PATTERN = /(重新开始|开始新的就诊|这是另一个问题|换一个问题|新的症状|重新描述)/;

function getSessionKey(sessionId: string | undefined, patientId: string): string {
  return String(sessionId || patientId || 'demo001') + ':' + String(patientId || 'demo001');
}

function createInitialSymptomContext(): SymptomContext {
  return {
    chief_complaint: 'abdominal_pain',
    location: 'unknown', duration: 'unknown', severity: 'unknown', onset: 'unknown', progression: 'unknown',
    nausea: 'unknown', vomiting: 'unknown', fever: 'unknown', diarrhea: 'unknown',
    vomiting_blood: 'unknown', blood_in_stool: 'unknown', rigid_abdomen: 'unknown', difficulty_breathing: 'unknown',
  };
}

function getSession(sessionId: string | undefined, patientId: string): AgentSession {
  const key = getSessionKey(sessionId, patientId);
  let session = sessions.get(key);
  if (!session) {
    session = {
      patient_id: patientId,
      messages: [],
      pending_registration: null,
      report_available: false,
      symptom_context: createInitialSymptomContext(),
      safety_escalated: false,
      last_safety_result: null,
      last_triage_result: null,
      triage_started: false,
      triage_ready: false,
      pending_slots: [],
      last_report_id: null,
      symptom_episode_id: 1,
    };
    sessions.set(key, session);
  }
  return session;
}

function resetSymptomEpisode(state: AgentSession): void {
  state.symptom_context = createInitialSymptomContext();
  state.safety_escalated = false;
  state.last_safety_result = null;
  state.last_triage_result = null;
  state.triage_started = false;
  state.triage_ready = false;
  state.pending_slots = [];
  state.pending_registration = null;
  state.symptom_episode_id += 1;
}

function formatContextAnswer(context: VisitContext | null): string {
  if (!context) return '暂时无法读取当前就诊状态，请稍后再试。';
  if (context.current_stage === 'REGISTERED') return `你已经完成挂号：${context.department_name}${context.doctor_name}，预约时间是${context.appointment_time}。接下来请${context.next_action}。`;
  if (context.current_stage === 'PAYMENT') return `医生已经为你开具${context.current_order || '检查'}。接下来需要${context.next_action}。`;
  if (context.current_stage === 'WAITING_EXAM') return `缴费已经完成。接下来请${context.next_action}。`;
  if (context.current_stage === 'RETURN_VISIT') return `检查报告已经准备好。接下来请${context.next_action}。`;
  return `你当前处于 ${context.current_stage} 阶段。下一步：${context.next_action}。`;
}

function formatRoute(route: { start: string; destination: string; steps: string[] }): string {
  return `从${route.start}前往${route.destination}：\n${route.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`;
}

function extractTime(message: string): string | null {
  return message.match(TIME_PATTERN)?.[0] ?? null;
}

function isSlotQuestion(message: string): boolean { return /(还有号|号源|有号吗|可预约|挂号时间|看看今天.*号|查.*号)/.test(message); }
function isFirstSlotSelection(message: string, state: AgentSession): boolean { return state.pending_slots.length > 0 && /(第一个|第1个|第一个号|就第)/.test(message); }
function isRegistrationRequest(message: string): boolean { return /(帮我挂|帮我预约|立即挂号|确认挂号|确认预约|挂这个|预约这个|帮我把.*挂|帮我把.*预约)/.test(message); }
function isRouteQuestion(message: string): boolean { return /(怎么走|怎么去|路线)/.test(message); }
function isQueueQuestion(message: string): boolean { return /(前面还有|还有几个人|排队|等多久|等待时间)/.test(message); }
function isReportStatusQuestion(message: string): boolean { return /(报告.*(出来|有了吗|状态|结果)|结果.*(出来|有了吗)|查报告|报告查询|报告怎么还没出来)/.test(message); }
function isReportInterpretationQuestion(message: string): boolean { return /(报告.*(什么意思|怎么解释|解释|怎么看)|报告解读|帮我看看报告|看看报告|查看报告|解读报告|是不是阑尾炎|严重吗)/.test(message); }
function isReportFollowup(message: string): boolean { return /^(那)?(你)?帮我看看(吧|呢)?[。！!？?]?$/u.test(message.trim()) || /^(这|报告)是什么意思[？?。]?$/.test(message.trim()) || /^(解释一下|怎么解释)[？?。]?$/.test(message.trim()); }
function isStatusQuestion(message: string): boolean { return /(当前状态|现在是什么状态|就诊进度|目前到哪一步|当前阶段)/.test(message); }
function isPaymentQuery(message: string): boolean { return /(缴费了吗|付过钱|费用交了吗|支付状态|缴费状态|已缴费|付款了吗|有没有缴费)/.test(message); }
function isPaymentRequest(message: string): boolean { return /(帮我.*(缴费|支付|付款)|立即(缴费|支付|付款)|把.*(费用|钱).*交了|那帮我缴费)/.test(message); }
function isSymptomMessage(message: string): boolean { return /(肚子疼|腹痛|哪里不舒服|不舒服|症状)/.test(message); }
function isSymptomUpdateMessage(message: string): boolean { return /(右下腹|左下腹|上腹|下腹|肚脐周围|腹部|昨天|前天|今天|小时|天开始|加重|更疼|恶心|呕吐|没吐|没有吐|发烧|发热|腹泻|拉肚子|呼吸困难|肚子很硬|腹部很硬)/.test(message); }
function isMedicalQuestion(message: string): boolean { return /(CT是什么|CT 是什么|CT是干什么|CT 检查|计算机断层|腹痛一般|肚子疼怎么办|医学|医疗|是什么)/i.test(message); }
function isHospitalKnowledgeQuestion(message: string): boolean { return /(停车|几点开门|门诊时间|开放时间|普外科在哪|普外科位置|CT室在哪里|CT室在哪|影像中心在哪里|医院|院方|规定)/.test(message); }
function isTriageReasonQuestion(message: string): boolean { return /(为什么.*(普外科|推荐)|推荐.*为什么|为什么推荐)/.test(message); }
function isAffirmativeSlotRequest(message: string, state: AgentSession): boolean { return state.triage_ready && /^(好|好的|可以|行|需要|好啊)[。！!？?]?$/i.test(message.trim()); }

function defaultDebug(): AgentDebug {
  return { intent: 'OTHER', route: 'OTHER', knowledge_domain: null, knowledge_entry_ids: [], safety_check: null, symptom_context: null, triage_status: null, missing_fields: [], recommended_department: null, report_id: null, report_source: null, structured_impression: [], critical_flag: null, interpretation_route: null };
}

function mergeDebug(debug: Partial<AgentDebug> | undefined): AgentDebug {
  return { ...defaultDebug(), ...debug };
}

function extractSymptomContext(message: string, previous: SymptomContext): SymptomContext {
  const context: SymptomContext = { ...previous, chief_complaint: 'abdominal_pain' };
  if (/(突然|忽然|一下子)/.test(message)) context.onset = 'sudden';
  if (/(逐渐|慢慢|几天来)/.test(message)) context.onset = 'gradual';
  if (/(剧烈|很疼|非常疼|疼得厉害|锐利|尖锐)/.test(message)) context.severity = 'severe';
  else if (/(有点疼|轻微|轻度)/.test(message)) context.severity = 'mild';
  else if (/(疼一点|中等|一般疼)/.test(message)) context.severity = 'moderate';
  const location = message.match(/右边下面|右下腹|左边下面|左下腹|上腹|下腹|肚脐周围|腹部/)?.[0];
  if (location) context.location = location.includes('右') ? 'right_lower_abdomen' : location.includes('左') ? 'left_lower_abdomen' : location;
  if (/(呕血|吐血)/.test(message)) context.vomiting_blood = true;
  if (/(便血|血便|黑便)/.test(message)) context.blood_in_stool = true;
  else if (/(没有血便|没血|没有便血)/.test(message)) context.blood_in_stool = false;
  if (/(肚子很硬|腹部很硬|腹部僵硬|肚子僵硬)/.test(message)) context.rigid_abdomen = true;
  else if (/(不硬|没有僵硬|不僵硬)/.test(message)) context.rigid_abdomen = false;
  if (/(呼吸困难|喘不上气|呼吸不畅)/.test(message)) context.difficulty_breathing = true;
  else if (/(呼吸正常|不喘|没有呼吸困难)/.test(message)) context.difficulty_breathing = false;
  if (/(恶心)/.test(message)) context.nausea = true;
  if (/(呕吐|吐了)/.test(message)) context.vomiting = true;
  else if (/(没吐|没有吐|未呕吐)/.test(message)) context.vomiting = false;
  if (/(发热|发烧)/.test(message)) context.fever = true;
  else if (/(不发烧|没有发热|没有发烧)/.test(message)) context.fever = false;
  if (/(腹泻|拉肚子)/.test(message)) context.diarrhea = true;
  else if (/(没有腹泻|不拉肚子)/.test(message)) context.diarrhea = false;
  const duration = message.match(/(今天早上|今天下午|今天晚上|昨天晚上|昨天|前天|\d+小时|\d+天|一周|几周)/)?.[0];
  if (duration) context.duration = duration;
  if (/(加重|越来越疼|更疼|比昨天疼)/.test(message)) context.progression = 'worsening';
  else if (/(减轻|好多了|不那么疼)/.test(message)) context.progression = 'improving';
  return context;
}

function symptomQuestion(context: SymptomContext, missingFields: string[]): string {
  const fieldsToAsk = missingFields.includes('location') || missingFields.includes('duration')
    ? missingFields.filter((field) => field === 'location' || field === 'duration')
    : missingFields;
  const questions = fieldsToAsk.map((field) => {
    if (field === 'location') return '哪里疼';
    if (field === 'duration') return '持续多久';
    if (field === 'progression_or_severity') return '疼痛程度如何，今天有没有明显加重';
    if (field === 'nausea_or_vomiting') return '有没有恶心或呕吐';
    return field;
  });
  const separator = fieldsToAsk.length === 2 && fieldsToAsk.includes('location') && fieldsToAsk.includes('duration') ? '、' : '，';
  return `可以先告诉我${questions.slice(0, 3).join(separator)}吗？当前 Demo 只做基础信息采集，尚未接入完整医学导诊。`;
}

function safetyBlockedMessage(state: AgentSession): string {
  return state.last_safety_result?.message ?? '当前症状已触发升级提示，请先寻求现场医疗帮助。';
}

export function resetAgentSessions(): void { sessions.clear(); }

export function exportAgentSession(sessionId: string | undefined, patientId: string): AgentSession | null {
  const session = sessions.get(getSessionKey(sessionId, patientId));
  return session ? structuredClone(session) : null;
}

export function importAgentSession(sessionId: string | undefined, patientId: string, snapshot: AgentSession | null | undefined): void {
  const key = getSessionKey(sessionId, patientId);
  if (!snapshot) {
    sessions.delete(key);
    return;
  }
  sessions.set(key, structuredClone(snapshot));
}

export class MainAgent {
  private readonly llmClient: Pick<LlmClient, 'mode' | 'complete'>;

  constructor({ llmClient = new LlmClient() }: { llmClient?: Pick<LlmClient, 'mode' | 'complete'> } = {}) {
    this.llmClient = llmClient;
  }

  private invoke<T = unknown>(name: string, args: Record<string, unknown>, patientId: string, toolCalls: ToolCallTrace[]): InvokeResult<T> {
    try {
      const value = executeTool(name, args, { patientId }) as T;
      toolCalls.push({ name, args, result: value, effect: getToolEffect(name) ?? undefined });
      return { ok: true, value };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool 调用失败';
      toolCalls.push({ name, args, result: { error: message }, effect: getToolEffect(name) ?? undefined });
      return { ok: false, error: message };
    }
  }

  private readContext(patientId: string): VisitContext | null {
    try { return executeTool('get_visit_context', {}, { patientId }) as VisitContext; } catch { return null; }
  }

  private resolveDoctor(message: string, state: AgentSession, patientId: string, toolCalls: ToolCallTrace[]): Doctor | null {
    const result = this.invoke<Doctor[]>('get_doctors', {}, patientId, toolCalls);
    if (!result.ok) return null;
    const matched = result.value.find((doctor) => message.includes(doctor.name));
    if (matched) return matched;
    if (state.pending_registration?.doctor_id) return result.value.find((doctor) => doctor.doctor_id === state.pending_registration?.doctor_id) ?? null;
    return null;
  }

  private fallbackMedicalKnowledge(message: string, patientId: string, toolCalls: ToolCallTrace[]): Output {
    const result = this.invoke<KnowledgeSearchResponse>('search_medical_knowledge', { query: message }, patientId, toolCalls);
    const debug: Partial<AgentDebug> = { intent: 'MEDICAL_KNOWLEDGE', route: 'MEDICAL_KNOWLEDGE', knowledge_domain: 'medical' };
    if (!result.ok) return { message: '暂时无法查询医学知识：' + result.error, debug };
    debug.knowledge_entry_ids = result.value.results.map((entry) => entry.id);
    if (result.value.results.length === 0) return { message: '当前 Demo 医学知识库没有找到与这个问题匹配的内容，我不编造医学答案。你可以换一种更具体的问法，或咨询医生。', debug };
    const entry = result.value.results[0];
    return { message: `${entry.content}\n\n来源：${entry.source}（${entry.source_url}）`, debug };
  }

  private fallbackHospitalKnowledge(message: string, patientId: string, toolCalls: ToolCallTrace[]): Output {
    const result = this.invoke<KnowledgeSearchResponse>('search_hospital_knowledge', { query: message }, patientId, toolCalls);
    const debug: Partial<AgentDebug> = { intent: 'HOSPITAL_KNOWLEDGE', route: 'HOSPITAL_KNOWLEDGE', knowledge_domain: 'hospital' };
    if (!result.ok) return { message: '暂时无法查询医院 Demo 信息：' + result.error, debug };
    debug.knowledge_entry_ids = result.value.results.map((entry) => entry.id);
    if (result.value.results.length === 0) return { message: '当前 Demo 医院知识库没有找到对应信息，我不编造医院规定。你可以换一种更具体的问法，或询问现场服务台。', debug };
    const entry = result.value.results[0];
    return { message: `${entry.content}\n\n来源：${entry.source}`, debug };
  }

  private fallbackSlots(message: string, state: AgentSession, patientId: string, toolCalls: ToolCallTrace[]): Output {
    const debug: Partial<AgentDebug> = { intent: 'REGISTRATION', route: 'BUSINESS_TOOL' };
    if (state.safety_escalated) return { message: safetyBlockedMessage(state), debug: { ...debug, route: 'SAFETY_RULES', safety_check: state.last_safety_result } };
    let doctor: Doctor | null = null;
    if (state.triage_ready && !message.includes('张明远')) {
      const doctorsResult = this.invoke<Doctor[]>('get_doctors', { department_id: 'general_surgery' }, patientId, toolCalls);
      doctor = doctorsResult.ok ? doctorsResult.value[0] ?? null : null;
    } else doctor = this.resolveDoctor(message, state, patientId, toolCalls);
    if (!doctor) return { message: '请告诉我想查询哪位医生的号源，例如“张明远今天还有号吗？”', debug };
    const result = this.invoke<RegistrationSlot[]>('get_registration_slots', { doctor_id: doctor.doctor_id }, patientId, toolCalls);
    if (!result.ok) return { message: '暂时无法查询号源：' + result.error, debug };
    const available = result.value.filter((slot) => slot.status === 'AVAILABLE');
    state.pending_registration = { doctor_id: doctor.doctor_id, doctor_name: doctor.name, department_id: doctor.department_id, department_name: doctor.department };
    state.pending_slots = available;
    if (available.length === 0) return { message: doctor.name + '当前没有可用 Mock 号源。', debug };
    return { message: doctor.name + '今天可用号源：' + available.map((slot) => slot.appointment_time).join('、') + '。你可以直接说“帮我挂10:30”。', debug };
  }

  private fallbackRegistration(message: string, state: AgentSession, patientId: string, toolCalls: ToolCallTrace[]): Output {
    const debug: Partial<AgentDebug> = { intent: 'REGISTRATION', route: 'BUSINESS_TOOL' };
    if (state.safety_escalated) return { message: safetyBlockedMessage(state), debug: { ...debug, route: 'SAFETY_RULES', safety_check: state.last_safety_result } };
    const appointmentTime = extractTime(message) ?? (isFirstSlotSelection(message, state) ? state.pending_slots[0]?.appointment_time ?? null : null);
    if (!appointmentTime) return { message: '请明确确认预约时间，例如“帮我挂10:30”。', debug };
    const doctor = state.pending_registration ?? this.resolveDoctor(message, state, patientId, toolCalls);
    if (!doctor) return { message: '请先告诉我想预约哪位医生，例如“张明远今天还有号吗？”。', debug };
    const result = this.invoke<VisitContext>('create_registration', { patient_id: patientId, department_id: doctor.department_id, doctor_id: doctor.doctor_id, appointment_time: appointmentTime }, patientId, toolCalls);
    if (!result.ok) return { message: '暂时无法完成挂号：' + result.error, debug };
    state.pending_registration = null;
    state.pending_slots = [];
    state.triage_ready = false;
    return { message: `已经为你完成 Demo 挂号：${result.value.department_name}${result.value.doctor_name}，${result.value.appointment_time}。接下来请${result.value.next_action}。`, context: result.value, debug };
  }

  private fallbackContext(patientId: string, toolCalls: ToolCallTrace[]): Output {
    const result = this.invoke<VisitContext>('get_visit_context', {}, patientId, toolCalls);
    const debug: Partial<AgentDebug> = { intent: 'VISIT_PROGRESS', route: 'VISIT_CONTEXT' };
    if (!result.ok) return { message: '暂时无法读取当前就诊状态：' + result.error, debug };
    return { message: formatContextAnswer(result.value), context: result.value, debug };
  }

  private fallbackPayment(patientId: string, toolCalls: ToolCallTrace[]): Output {
    const debug: Partial<AgentDebug> = { intent: 'PAYMENT', route: 'BUSINESS_TOOL' };
    const contextResult = this.invoke<VisitContext>('get_visit_context', {}, patientId, toolCalls);
    if (!contextResult.ok) return { message: '暂时无法读取缴费状态：' + contextResult.error, debug };
    if (contextResult.value.current_stage !== 'PAYMENT') return { message: `当前就诊阶段是 ${contextResult.value.current_stage}，下一步是：${contextResult.value.next_action}。`, context: contextResult.value, debug };
    const result = this.invoke<{ order: { location: string; exam_type: string }; visit_context: VisitContext }>('pay_order', {}, patientId, toolCalls);
    if (!result.ok) return { message: '暂时无法完成缴费：' + result.error, context: contextResult.value, debug };
    return { message: `缴费已经完成。接下来请${result.value.order.location}等待${result.value.order.exam_type}检查。`, context: result.value.visit_context, debug };
  }

  private fallbackPaymentStatus(patientId: string, toolCalls: ToolCallTrace[]): Output {
    const debug: Partial<AgentDebug> = { intent: 'PAYMENT_STATUS_QUERY', route: 'BUSINESS_TOOL' };
    const result = this.invoke<{ exam_id: string; exam_type: string; price: number; payment_status: 'UNPAID' | 'PAID' }>('get_payment_status', {}, patientId, toolCalls);
    if (!result.ok) return { message: '当前还没有可查询的检查缴费订单。', debug };
    const status = result.value.payment_status === 'PAID' ? '已缴费' : '尚未缴费';
    return { message: `${result.value.exam_type}费用${status}（${result.value.price}元）。这是只读状态查询，没有执行支付。`, debug };
  }

  private fallbackRoute(message: string, patientId: string, toolCalls: ToolCallTrace[]): Output {
    const debug: Partial<AgentDebug> = { intent: 'INDOOR_ROUTE', route: 'BUSINESS_TOOL', knowledge_domain: 'hospital' };
    const destination = /(CT|影像|检查)/i.test(message) ? '医学影像中心' : message.includes('普外科') ? '普外科' : null;
    if (!destination) return { message: '请告诉我目的地，例如“普外科怎么走？”或“CT室在哪里？”', debug };
    const result = this.invoke<{ start: string; destination: string; steps: string[] }>('get_route', { destination }, patientId, toolCalls);
    if (!result.ok) return { message: '暂时无法查询路线：' + result.error, debug };
    return { message: formatRoute(result.value), debug };
  }

  private fallbackQueue(patientId: string, toolCalls: ToolCallTrace[]): Output {
    const result = this.invoke<QueueStatus>('get_queue_status', {}, patientId, toolCalls);
    const debug: Partial<AgentDebug> = { intent: 'QUEUE_QUERY', route: 'BUSINESS_TOOL' };
    if (!result.ok) return { message: '暂时无法查询排队状态：' + result.error, debug };
    return { message: `你的号码是${result.value.queue_number}，当前叫号是${result.value.current_number}，前方还有${result.value.people_ahead}人，预计等待约${result.value.estimated_wait_minutes}分钟。`, debug };
  }

  private fallbackReportStatus(state: AgentSession, patientId: string, toolCalls: ToolCallTrace[]): Output {
    const debug: Partial<AgentDebug> = { intent: 'REPORT_QUERY', route: 'BUSINESS_TOOL', interpretation_route: 'REPORT_STATUS' };
    const result = this.invoke<RawCtReport>('get_report', {}, patientId, toolCalls);
    if (!result.ok) {
      state.report_available = false;
      state.last_report_id = null;
      return { message: '报告目前还没有 READY，暂时不能进行报告解释。', debug };
    }
    state.report_available = true;
    state.last_report_id = result.value.report_id;
    return {
      message: `你的${result.value.exam_name}报告已经出来了（Demo Mock，报告 ID：${result.value.report_id}）。原始报告已由 Mock LIS/PACS 返回；如果需要，我可以继续帮你看看报告是什么意思。`,
      debug: {
        ...debug,
        report_id: result.value.report_id,
        report_source: result.value.source,
        critical_flag: result.value.critical_flag,
      },
    };
  }

  private fallbackReportInterpretation(message: string, state: AgentSession, patientId: string, toolCalls: ToolCallTrace[]): Output {
    const debug: Partial<AgentDebug> = { intent: 'REPORT_INTERPRETATION', route: 'BUSINESS_TOOL', interpretation_route: 'REPORT_INTERPRETATION' };
    // 每次解释前重新读取报告，确保解释只基于当前 READY 的 Mock Report。
    const rawResult = this.invoke<RawCtReport>('get_report', {}, patientId, toolCalls);
    if (!rawResult.ok) {
      state.report_available = false;
      state.last_report_id = null;
      return { message: '报告目前还没有 READY，暂时不能进行报告解释。', debug };
    }
    state.report_available = true;
    state.last_report_id = rawResult.value.report_id;
    const result = this.invoke<ReportInterpretationToolResult>('interpret_report', { report_id: rawResult.value.report_id }, patientId, toolCalls);
    if (!result.ok) return { message: '暂时无法解释这份报告：' + result.error, debug };

    const interpretation = result.value.interpretation;
    const lines = [interpretation.summary, '', '关键发现：', ...interpretation.key_findings.map((finding) => `- ${finding.original}：${finding.explanation}`)];
    if (interpretation.uncertainty.length > 0) lines.push('', '不确定性：', ...interpretation.uncertainty.map((item) => `- ${item}`));
    if (interpretation.critical) lines.push('', '报告的 Mock PACS critical_flag 标记为 true，建议尽快由现场医生处理。');
    else lines.push('', '报告的 Mock PACS critical_flag 为 false，表示报告数据没有标记明确危急值；这不等于可以脱离症状和医生判断下结论。');
    if (/是不是阑尾炎/.test(message)) {
      lines.push('', '关于你问到的阑尾炎：报告描述了阑尾轻度增粗和周围轻度渗出，但没有给出阑尾炎的确定诊断，不能仅凭这份报告作出“是”或“不是”的判断，需要结合临床评估。');
    }
    if (/严重吗/.test(message)) {
      lines.push('', '关于严重程度：报告没有提供可以单独得出“严重”或“不严重”的二元结论；需要由医生结合症状、体格检查和影像结果判断。');
    }
    lines.push('', '下一步：', ...interpretation.next_steps.map((step) => `- ${step}`));
    return {
      message: lines.join('\n'),
      debug: {
        ...debug,
        report_id: result.value.raw_report.report_id,
        report_source: result.value.raw_report.source,
        structured_impression: result.value.structured_report.impression,
        critical_flag: result.value.structured_report.critical_flag,
        knowledge_entry_ids: result.value.interpretation.sources.map((source) => source.id),
      },
    };
  }

  private fallbackSymptom(message: string, state: AgentSession): Output {
    state.triage_started = true;
    state.symptom_context = extractSymptomContext(message, state.symptom_context);
    const evaluatedSafety = evaluateSafety(state.symptom_context);
    // 同一 symptom episode 一旦升级，后续普通话术不能把它自动降级；只有显式新 episode 才会清除。
    const safety = state.safety_escalated ? (state.last_safety_result ?? evaluatedSafety) : evaluatedSafety;
    const triage = triageAbdominalPain(state.symptom_context, safety);
    state.last_triage_result = triage;
    const recommendedDepartment = triage.department_id && triage.department_name ? { department_id: triage.department_id, department_name: triage.department_name } : null;
    const debug: Partial<AgentDebug> = {
      intent: 'SYMPTOM_CONSULTATION', route: triage.status === 'READY' ? 'SAFETY_RULES' : 'SAFETY_RULES', safety_check: safety,
      symptom_context: state.symptom_context, triage_status: triage.status, missing_fields: triage.missing_fields, recommended_department: recommendedDepartment,
    };
    state.last_safety_result = safety;
    if (safety.risk_level === 'EMERGENCY') {
      state.safety_escalated = true;
      return { message: safety.message, debug };
    }
    if (triage.status === 'READY') {
      state.triage_ready = true;
      return { message: `${triage.reason}\n\n需要我帮你看看今天普外科还有哪些号源吗？`, debug };
    }
    return { message: symptomQuestion(state.symptom_context, triage.missing_fields), debug };
  }

  private fallbackTriageReason(state: AgentSession): Output {
    const triage = state.last_triage_result;
    if (!triage?.reason) return { message: '请先告诉我腹痛的位置和持续时间，我再说明当前的就医方向建议。', debug: { intent: 'SYMPTOM_CONSULTATION', route: 'SAFETY_RULES', symptom_context: state.symptom_context, triage_status: triage?.status ?? null, missing_fields: triage?.missing_fields ?? [] } };
    return { message: `${triage.reason}\n\n这是就医方向建议，不是疾病诊断。`, debug: { intent: 'TRIAGE_EXPLANATION', route: 'SAFETY_RULES', symptom_context: state.symptom_context, triage_status: triage.status, missing_fields: triage.missing_fields, recommended_department: { department_id: triage.department_id!, department_name: triage.department_name! } } };
  }
  private fallbackGeneric(): Output { return { message: '我可以帮你查询 Demo 医生号源、完成挂号、查看就诊下一步、查询路线、缴费、排队和报告状态。你可以直接输入“张明远今天还有号吗？”或“然后呢？”。' }; }

  private async handleFallback(message: string, patientId: string, sessionId: string, state: AgentSession): Promise<AgentResult> {
    const normalized = message.trim();
    const toolCalls: ToolCallTrace[] = [];
    state.messages.push({ role: 'user', content: normalized });
    let output: Output;
    if (state.safety_escalated && (isSlotQuestion(normalized) || isRegistrationRequest(normalized) || isFirstSlotSelection(normalized, state))) output = { message: safetyBlockedMessage(state), debug: { intent: 'SAFETY_ESCALATION', route: 'SAFETY_RULES', safety_check: state.last_safety_result, symptom_context: state.symptom_context, triage_status: state.last_triage_result?.status ?? 'ESCALATED', missing_fields: [], recommended_department: null } };
    else if (THEN_PATTERN.test(normalized)) output = this.fallbackContext(patientId, toolCalls);
    else if (isPaymentQuery(normalized)) output = this.fallbackPaymentStatus(patientId, toolCalls);
    else if (isPaymentRequest(normalized)) output = this.fallbackPayment(patientId, toolCalls);
    else if (isRouteQuestion(normalized)) output = this.fallbackRoute(normalized, patientId, toolCalls);
    else if (isQueueQuestion(normalized)) output = this.fallbackQueue(patientId, toolCalls);
    else if (isReportStatusQuestion(normalized)) output = this.fallbackReportStatus(state, patientId, toolCalls);
    else if (isReportInterpretationQuestion(normalized) || (state.report_available && isReportFollowup(normalized))) output = this.fallbackReportInterpretation(normalized, state, patientId, toolCalls);
    else if (isSlotQuestion(normalized) || isAffirmativeSlotRequest(normalized, state)) output = this.fallbackSlots(normalized, state, patientId, toolCalls);
    else if (isRegistrationRequest(normalized)) output = this.fallbackRegistration(normalized, state, patientId, toolCalls);
    else if (isFirstSlotSelection(normalized, state)) output = this.fallbackRegistration(normalized, state, patientId, toolCalls);
    else if (isStatusQuestion(normalized)) output = this.fallbackContext(patientId, toolCalls);
    else if (isTriageReasonQuestion(normalized)) output = this.fallbackTriageReason(state);
    else if (isHospitalKnowledgeQuestion(normalized)) output = this.fallbackHospitalKnowledge(normalized, patientId, toolCalls);
    else if (isMedicalQuestion(normalized)) output = this.fallbackMedicalKnowledge(normalized, patientId, toolCalls);
    else if (isSymptomMessage(normalized) || (state.triage_started && isSymptomUpdateMessage(normalized))) output = this.fallbackSymptom(normalized, state);
    else output = this.fallbackGeneric();
    state.messages.push({ role: 'assistant', content: output.message });
    const sessionDebug: Partial<AgentDebug> = {
      symptom_context: state.triage_started ? state.symptom_context : null,
      triage_status: state.last_triage_result?.status ?? null,
      missing_fields: state.last_triage_result?.missing_fields ?? [],
      recommended_department: state.last_triage_result?.department_id && state.last_triage_result.department_name
        ? { department_id: state.last_triage_result.department_id, department_name: state.last_triage_result.department_name }
        : null,
    };
    return { message: output.message, tool_calls: toolCalls, visit_context: output.context ?? this.readContext(patientId), mode: 'fallback', session_id: sessionId, debug: mergeDebug({ ...sessionDebug, ...output.debug }) };
  }

  private debugForToolCalls(toolCalls: ToolCallTrace[]): Partial<AgentDebug> {
    const knowledgeCall = toolCalls.find((call) => call.name === 'search_medical_knowledge' || call.name === 'search_hospital_knowledge');
    const safetyCall = toolCalls.find((call) => call.name === 'evaluate_safety');
    const interpretationCall = toolCalls.find((call) => call.name === 'interpret_report');
    if (interpretationCall && typeof interpretationCall.result === 'object' && interpretationCall.result !== null && !('error' in interpretationCall.result)) {
      const response = interpretationCall.result as ReportInterpretationToolResult;
      return {
        intent: 'REPORT_INTERPRETATION',
        route: 'BUSINESS_TOOL',
        report_id: response.raw_report.report_id,
        report_source: response.raw_report.source,
        structured_impression: response.structured_report.impression,
        critical_flag: response.structured_report.critical_flag,
        interpretation_route: 'REPORT_INTERPRETATION',
        knowledge_entry_ids: response.interpretation.sources.map((source) => source.id),
      };
    }
    const reportCall = toolCalls.find((call) => call.name === 'get_report');
    if (reportCall && typeof reportCall.result === 'object' && reportCall.result !== null && !('error' in reportCall.result)) {
      const response = reportCall.result as RawCtReport;
      return {
        intent: 'REPORT_QUERY',
        route: 'BUSINESS_TOOL',
        report_id: response.report_id,
        report_source: response.source,
        critical_flag: response.critical_flag,
        interpretation_route: 'REPORT_STATUS',
      };
    }
    if (knowledgeCall) {
      const response = knowledgeCall.result as Partial<KnowledgeSearchResponse>;
      return {
        intent: knowledgeCall.name === 'search_medical_knowledge' ? 'MEDICAL_KNOWLEDGE' : 'HOSPITAL_KNOWLEDGE',
        route: knowledgeCall.name === 'search_medical_knowledge' ? 'MEDICAL_KNOWLEDGE' : 'HOSPITAL_KNOWLEDGE',
        knowledge_domain: response.domain === 'medical' || response.domain === 'hospital' ? response.domain : null,
        knowledge_entry_ids: Array.isArray(response.results) ? response.results.map((entry) => entry.id) : [],
      };
    }
    if (safetyCall) {
      const safetyResult = safetyCall.result as SafetyResult;
      return { intent: 'SYMPTOM_CONSULTATION', route: 'SAFETY_RULES', safety_check: safetyResult.risk_level ? safetyResult : null };
    }
    if (toolCalls.some((call) => call.name === 'get_visit_context')) return { intent: 'VISIT_PROGRESS', route: 'VISIT_CONTEXT' };
    return { intent: 'BUSINESS_TOOL', route: 'BUSINESS_TOOL' };
  }

  private async handleLlm(message: string, patientId: string, sessionId: string, state: AgentSession): Promise<AgentResult> {
    const toolCalls: ToolCallTrace[] = [];
    const messages: LlmMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...state.messages, { role: 'user', content: message }];
    let finalMessage = '';
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const assistant: LlmAssistantMessage = await this.llmClient.complete({ messages, tools: listToolDefinitions() });
      if (assistant.tool_calls?.length) {
        messages.push({ role: 'assistant', content: assistant.content ?? null, tool_calls: assistant.tool_calls });
        for (const call of assistant.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            const parsed: unknown = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) args = { __invalid_arguments__: true };
            else args = parsed as Record<string, unknown>;
          } catch {
            args = { __invalid_arguments__: true };
          }
          const toolName = call.function?.name ?? '';
          const blockedMutation = (toolName === 'pay_order' && !isPaymentRequest(message))
            || (toolName === 'create_registration' && !isRegistrationRequest(message) && !isFirstSlotSelection(message, state));
          const result = blockedMutation
            ? (() => {
              const error = '当前表达是查询或信息确认，不能执行写入操作；请先明确表达支付或挂号动作。';
              toolCalls.push({ name: toolName, args, result: { error }, effect: getToolEffect(toolName) ?? undefined });
              return { ok: false as const, error };
            })()
            : this.invoke(toolName, args, patientId, toolCalls);
          if (result.ok && toolName === 'get_report') {
            const reportResult = result.value as RawCtReport;
            state.report_available = true;
            state.last_report_id = reportResult.report_id;
          }
          if (result.ok && toolName === 'interpret_report') {
            const interpretationResult = result.value as ReportInterpretationToolResult;
            state.report_available = true;
            state.last_report_id = interpretationResult.raw_report.report_id;
          }
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result.ok ? result.value : { error: result.error }) });
        }
        continue;
      }
      finalMessage = assistant.content?.trim() || '我已经读取了相关 Tool，但暂时没有生成文字回复。';
      messages.push({ role: 'assistant', content: finalMessage });
      break;
    }
    if (!finalMessage) finalMessage = '本轮 Tool 调用次数已达到开发模式上限，请继续提问。';
    state.messages = messages.slice(1).slice(-40);
    const sessionDebug: Partial<AgentDebug> = {
      symptom_context: state.triage_started ? state.symptom_context : null,
      triage_status: state.last_triage_result?.status ?? null,
      missing_fields: state.last_triage_result?.missing_fields ?? [],
      recommended_department: state.last_triage_result?.department_id && state.last_triage_result.department_name
        ? { department_id: state.last_triage_result.department_id, department_name: state.last_triage_result.department_name }
        : null,
    };
    return { message: finalMessage, tool_calls: toolCalls, visit_context: this.readContext(patientId), mode: 'llm', session_id: sessionId, debug: mergeDebug({ ...sessionDebug, ...this.debugForToolCalls(toolCalls) }) };
  }

  async handle({ message, patient_id: patientId = 'demo001', session_id: sessionId = patientId }: HandleInput): Promise<AgentResult> {
    if (typeof message !== 'string' || !message.trim()) throw new Error('message 不能为空');
    const state = getSession(sessionId, patientId);
    if (NEW_SYMPTOM_EPISODE_PATTERN.test(message.trim())) resetSymptomEpisode(state);
    if (this.llmClient.mode === 'llm') {
      try { return await this.handleLlm(message, patientId, sessionId, state); }
      catch (error) {
        return { message: '真实 LLM 调用失败：' + (error instanceof Error ? error.message : '未知错误') + '。请检查 LLM_API_KEY、LLM_BASE_URL 和 LLM_MODEL 配置。', tool_calls: [], visit_context: this.readContext(patientId), mode: 'llm', session_id: sessionId, debug: defaultDebug() };
      }
    }
    return this.handleFallback(message, patientId, sessionId, state);
  }
}

export default MainAgent;

import { z } from 'zod';
import { ToolOutputSchemas } from '../schemas/tools';
import type { ChatResponse } from '../schemas/chat';
import type { VisitStage } from '../domain/visit-context';

export const STAGE_LABELS: Record<VisitStage, string> = {
  PRE_VISIT: '诊前咨询', REGISTERED: '预约成功', ARRIVED: '已到院', WAITING_DOCTOR: '等待医生',
  CONSULTING: '医生问诊', PAYMENT: '检查待缴费', WAITING_EXAM: '等待检查', EXAMINING: '检查中',
  WAITING_REPORT: '等待报告', RETURN_VISIT: '携报告回诊', FINISHED: '本次就诊完成',
};
export const JOURNEY_GROUPS: { label: string; stages: VisitStage[] }[] = [
  { label: '咨询与预约', stages: ['PRE_VISIT', 'REGISTERED'] },
  { label: '到院就诊', stages: ['ARRIVED', 'WAITING_DOCTOR', 'CONSULTING'] },
  { label: '缴费与检查', stages: ['PAYMENT', 'WAITING_EXAM', 'EXAMINING'] },
  { label: '报告与回诊', stages: ['WAITING_REPORT', 'RETURN_VISIT'] },
  { label: '完成就诊', stages: ['FINISHED'] },
];
export const STATUS_LABELS: Record<string, string> = {
  PAID: '已缴费', UNPAID: '待缴费', NOT_STARTED: '待检查', IN_PROGRESS: '检查中', COMPLETED: '已完成', PENDING: '等待报告', READY: '报告已出',
};

// Presentation only: successful Tool results are validated against existing schemas.
export function toolResult<T>(response: ChatResponse, name: string, schema: z.ZodType<T>): T | null {
  for (const call of [...response.tool_calls].reverse()) {
    if (call.name !== name) continue;
    const parsed = schema.safeParse(call.result);
    if (parsed.success) return parsed.data;
  }
  return null;
}
export function presentResponse(response: ChatResponse) {
  return {
    doctors: toolResult(response, 'get_doctors', ToolOutputSchemas.get_doctors),
    slots: toolResult(response, 'get_registration_slots', ToolOutputSchemas.get_registration_slots),
    registration: toolResult(response, 'create_registration', ToolOutputSchemas.create_registration),
    route: toolResult(response, 'get_route', ToolOutputSchemas.get_route),
    queue: toolResult(response, 'get_queue_status', ToolOutputSchemas.get_queue_status),
    payment: toolResult(response, 'get_payment_status', ToolOutputSchemas.get_payment_status),
    paid: toolResult(response, 'pay_order', ToolOutputSchemas.pay_order),
    report: toolResult(response, 'get_report', ToolOutputSchemas.get_report),
    interpretation: toolResult(response, 'interpret_report', ToolOutputSchemas.interpret_report),
    safety: toolResult(response, 'evaluate_safety', ToolOutputSchemas.evaluate_safety) ?? response.debug.safety_check,
    department: response.debug.recommended_department,
  };
}
export function patientText(text: string) {
  return Object.entries(STAGE_LABELS).reduce((value, [key, label]) => value.replace(new RegExp('\\b' + key + '\\b', 'g'), label), text);
}
export function money(value: number) { return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value); }

// Review before dispatch, including selections that the existing Agent treats as writes.
// This does not infer an intent or execute a Tool; ambiguous text is reviewed verbatim.
export function needsActionReview(message: string) {
  return /(帮我挂|帮我预约|立即挂号|确认挂号|确认预约|挂这个|预约这个|帮我把.*挂|帮我把.*预约|第一个|第1个|就第|帮我.*(缴费|支付|付款)|立即(缴费|支付|付款)|把.*(费用|钱).*交了)/.test(message);
}
export function startsNewEpisode(message: string) { return /(重新开始|开始新的就诊|这是另一个问题|换一个问题|新的症状|重新描述)/.test(message); }

// UI labels for existing simulation endpoints; state transitions remain on the server.
export const DEMO_EVENTS: Partial<Record<VisitStage, { label: string; stage: VisitStage; description: string }>> = {
  REGISTERED: { label: '我已到院', stage: 'ARRIVED', description: '确认已到医院，更新本次到院状态。' },
  ARRIVED: { label: '完成签到', stage: 'WAITING_DOCTOR', description: '模拟普外科签到完成，进入候诊。' },
  WAITING_DOCTOR: { label: '医生接诊', stage: 'CONSULTING', description: '模拟医生叫号并开始接诊。' },
  CONSULTING: { label: '医生开具检查', stage: 'PAYMENT', description: '模拟医生开具已有的腹部 CT 检查订单。' },
  WAITING_EXAM: { label: '开始检查', stage: 'EXAMINING', description: '模拟影像中心开始检查。' },
  EXAMINING: { label: '检查完成', stage: 'WAITING_REPORT', description: '模拟检查完成，开始等待报告。' },
  WAITING_REPORT: { label: '报告发布', stage: 'RETURN_VISIT', description: '发布已有的 Mock 报告，进入回诊阶段。' },
  RETURN_VISIT: { label: '医生完成回诊', stage: 'FINISHED', description: '仅在医生完成回诊后确认，结束本次就医旅程。' },
};

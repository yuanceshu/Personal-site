import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatRequestSchema } from '../../lib/works/medical-ai/src/schemas/chat';
import { ToolInputSchemas } from '../../lib/works/medical-ai/src/schemas/tools';
import { VisitContextSchema } from '../../lib/works/medical-ai/src/schemas/visit';
import { MainAgent, resetAgentSessions } from '../../lib/works/medical-ai/src/agent/main-agent';
import { get_visit_context, resetMockState } from '../../lib/works/medical-ai/src/tools/mock-tools';
import type { LlmClient, LlmMessage } from '../../lib/works/medical-ai/src/agent/llm-client';

const validContext = {
  patient_id: 'demo001', visit_id: 'visit001', current_stage: 'PRE_VISIT', department_id: null,
  department_name: null, doctor_id: null, doctor_name: null, appointment_time: null,
  registration_status: 'NOT_REGISTERED', current_order: null, payment_status: null,
  exam_status: null, report_status: null, next_action: '选择普外科、医生和预约时间完成挂号',
};

test('Chat Request 缺少 message 时校验失败', () => {
  assert.equal(ChatRequestSchema.safeParse({ patient_id: 'demo001' }).success, false);
});

test('Visit Context 非法 stage 时校验失败', () => {
  assert.equal(VisitContextSchema.safeParse({ ...validContext, current_stage: 'UNKNOWN_STAGE' }).success, false);
});

test('非法 Tool arguments 不应通过 schema', () => {
  const result = ToolInputSchemas.get_registration_slots.safeParse({ doctor_id: 'doctor001', unexpected: true });
  assert.equal(result.success, false);
});

test('非对象 Tool arguments 也不能绕过 schema', () => {
  assert.equal(ToolInputSchemas.get_visit_context.safeParse(null).success, false);
  assert.equal(ToolInputSchemas.get_visit_context.safeParse([]).success, false);
});

test('LLM 返回非法 Tool arguments 时不会执行 Tool', async () => {
  resetMockState();
  resetAgentSessions();
  const llmClient: Pick<LlmClient, 'mode' | 'complete'> = {
    mode: 'llm',
    async complete({ messages }: { messages: LlmMessage[] }) {
      if (!messages.some((message) => message.role === 'tool')) {
        return { tool_calls: [{ id: 'invalid-1', function: { name: 'create_registration', arguments: '{"unexpected":true}' } }] };
      }
      return { content: '参数无效，未执行挂号。' };
    },
  };
  const result = await new MainAgent({ llmClient }).handle({ message: '帮我挂号', session_id: 'invalid-tool' });
  assert.equal(get_visit_context().current_stage, 'PRE_VISIT');
  assert.match(JSON.stringify(result.tool_calls), /appointment_time|Invalid input/);
});

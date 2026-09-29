import test from 'node:test';
import assert from 'node:assert/strict';
import { MainAgent, resetAgentSessions } from '../../lib/works/medical-ai/src/agent/main-agent';
import type { LlmClient, LlmMessage } from '../../lib/works/medical-ai/src/agent/llm-client';
import {
  create_registration,
  pay_order,
  resetMockState,
  update_visit_stage,
} from '../../lib/works/medical-ai/src/tools/mock-tools';

function createFallbackAgent() {
  resetMockState();
  resetAgentSessions();
  return new MainAgent();
}

function moveToPayment() {
  create_registration({ appointment_time: '10:30' });
  update_visit_stage('ARRIVED');
  update_visit_stage('WAITING_DOCTOR');
  update_visit_stage('CONSULTING');
  update_visit_stage('PAYMENT');
}

function moveToReportReady() {
  moveToPayment();
  pay_order();
  update_visit_stage('EXAMINING');
  update_visit_stage('WAITING_REPORT');
  update_visit_stage('RETURN_VISIT');
}

test('自然语言查询号源会调用 get_registration_slots', async () => {
  const agent = createFallbackAgent();
  const result = await agent.handle({ message: '张明远今天还有号吗？', session_id: 'chat-slots' });
  assert.ok(result.tool_calls.some((call) => call.name === 'get_registration_slots'));
  assert.match(result.message, /10:30/);
});

test('多轮上下文可以从查询号源继续完成挂号', async () => {
  const agent = createFallbackAgent();
  await agent.handle({ message: '张明远今天还有号吗？', session_id: 'chat-registration' });
  const result = await agent.handle({ message: '帮我挂10:30。', session_id: 'chat-registration' });
  assert.ok(result.tool_calls.some((call) => call.name === 'create_registration'));
  const registeredContext = result.visit_context;
  assert.ok(registeredContext);
  assert.equal(registeredContext.current_stage, 'REGISTERED');
  assert.equal(registeredContext.appointment_time, '10:30');
});

test('然后呢会优先读取 Visit Context 并返回 next_action', async () => {
  const agent = createFallbackAgent();
  await agent.handle({ message: '张明远今天还有号吗？', session_id: 'chat-next' });
  await agent.handle({ message: '帮我挂10:30。', session_id: 'chat-next' });
  const result = await agent.handle({ message: '然后呢？', session_id: 'chat-next' });
  assert.ok(result.tool_calls.some((call) => call.name === 'get_visit_context'));
  assert.match(result.message, /前往门诊楼3楼普外科签到/);
});

test('路线查询会调用 get_route', async () => {
  const agent = createFallbackAgent();
  const result = await agent.handle({ message: 'CT室怎么走？', session_id: 'chat-route' });
  assert.ok(result.tool_calls.some((call) => call.name === 'get_route'));
  assert.match(result.message, /二楼医学影像中心/);
});

test('缴费、排队和报告查询都使用对应 Tool', async () => {
  const agent = createFallbackAgent();
  moveToPayment();
  const payment = await agent.handle({ message: '那帮我缴费。', session_id: 'chat-exam' });
  assert.ok(payment.tool_calls.some((call) => call.name === 'pay_order'));
  const paidContext = payment.visit_context;
  assert.ok(paidContext);
  assert.equal(paidContext.current_stage, 'WAITING_EXAM');

  const queue = await agent.handle({ message: '前面还有多少人？', session_id: 'chat-exam' });
  assert.ok(queue.tool_calls.some((call) => call.name === 'get_queue_status'));
  assert.match(queue.message, /前方还有4人/);

  update_visit_stage('EXAMINING');
  update_visit_stage('WAITING_REPORT');
  update_visit_stage('RETURN_VISIT');
  const report = await agent.handle({ message: '我的报告出来了吗？', session_id: 'chat-exam' });
  assert.ok(report.tool_calls.some((call) => call.name === 'get_report'));
  assert.match(report.message, /原始报告/);
});

test('症状入口只做有限信息采集，不进行诊断', async () => {
  const agent = createFallbackAgent();
  const result = await agent.handle({ message: '我肚子疼。', session_id: 'chat-symptom' });
  assert.equal(result.tool_calls.length, 0);
  assert.match(result.message, /哪里疼、持续多久/);
  assert.doesNotMatch(result.message, /确诊|一定是/);
});

test('报告追问读取真实 Mock Report 并进入只读解释', async () => {
  const agent = createFallbackAgent();
  moveToReportReady();
  await agent.handle({ message: '我的报告出来了吗？', session_id: 'chat-report-followup' });
  const result = await agent.handle({ message: '这是什么意思？', session_id: 'chat-report-followup' });
  assert.ok(result.tool_calls.some((call) => call.name === 'get_report'));
  assert.ok(result.tool_calls.some((call) => call.name === 'interpret_report'));
  assert.match(result.message, /轻度炎性改变|不能据此确定具体疾病/);
});

test('真实 LLM 模式返回 Tool Call 时由 Registry 执行现有 Mock Tool', async () => {
  resetMockState();
  resetAgentSessions();
  const llmClient: Pick<LlmClient, 'mode' | 'complete'> = {
    mode: 'llm',
    async complete({ messages }: { messages: LlmMessage[] }) {
      if (!messages.some((message) => message.role === 'tool')) {
        return {
          tool_calls: [{ id: 'call-1', function: { name: 'get_registration_slots', arguments: '{"doctor_id":"doctor001"}' } }],
        };
      }
      return { content: '张明远今天有 10:30、11:00 和 14:30。' };
    },
  };
  const agent = new MainAgent({ llmClient });
  const result = await agent.handle({ message: '张明远今天还有号吗？', session_id: 'chat-llm' });
  assert.equal(result.mode, 'llm');
  assert.ok(result.tool_calls.some((call) => call.name === 'get_registration_slots'));
  assert.match(result.message, /10:30/);
});

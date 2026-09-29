import test from 'node:test';
import assert from 'node:assert/strict';
import { MainAgent, resetAgentSessions } from '../../lib/works/medical-ai/src/agent/main-agent';
import { triageAbdominalPain } from '../../lib/works/medical-ai/src/triage/abdominal-pain';
import { evaluateSafety } from '../../lib/works/medical-ai/src/safety/engine';
import { get_visit_context, resetMockState, update_visit_stage } from '../../lib/works/medical-ai/src/tools/mock-tools';

function createAgent() {
  resetMockState();
  resetAgentSessions();
  return new MainAgent();
}

test('腹痛第一轮只追问位置和持续时间', async () => {
  const result = await createAgent().handle({ message: '我肚子疼，应该挂什么科？', session_id: 'triage-first' });
  assert.match(result.message, /哪里疼、持续多久/);
  assert.equal(result.debug.triage_status, 'NEED_MORE_INFO');
  assert.equal(result.debug.safety_check?.risk_level, 'SAFE');
});

test('多轮症状会合并并识别自然表达', async () => {
  const agent = createAgent();
  await agent.handle({ message: '我肚子疼，应该挂什么科？', session_id: 'triage-merge' });
  const second = await agent.handle({ message: '右边下面疼，昨天晚上开始。', session_id: 'triage-merge' });
  assert.equal(second.debug.symptom_context?.location, 'right_lower_abdomen');
  assert.equal(second.debug.symptom_context?.duration, '昨天晚上');
  const third = await agent.handle({ message: '今天比昨天疼一点，还有点恶心，没有吐。', session_id: 'triage-merge' });
  assert.equal(third.debug.symptom_context?.progression, 'worsening');
  assert.equal(third.debug.symptom_context?.nausea, true);
  assert.equal(third.debug.symptom_context?.vomiting, false);
  assert.equal(third.debug.triage_status, 'READY');
});

test('未提及的伴随症状保持 unknown，不自动转为 false', async () => {
  const result = await createAgent().handle({ message: '我肚子疼。', session_id: 'triage-unknown' });
  assert.equal(result.debug.symptom_context?.fever, 'unknown');
  assert.equal(result.debug.symptom_context?.vomiting, 'unknown');
});

test('每轮症状更新都执行 Safety Check', async () => {
  const agent = createAgent();
  const first = await agent.handle({ message: '我肚子疼。', session_id: 'triage-safety-each-turn' });
  const second = await agent.handle({ message: '右下腹，昨天开始。', session_id: 'triage-safety-each-turn' });
  assert.ok(first.debug.safety_check);
  assert.ok(second.debug.safety_check);
  assert.equal(second.debug.safety_check?.risk_level, 'SAFE');
});

test('普通腹痛完成信息收集后推荐普外科，不输出疾病诊断', async () => {
  const agent = createAgent();
  await agent.handle({ message: '我肚子疼，应该挂什么科？', session_id: 'triage-ready' });
  await agent.handle({ message: '右下腹，从昨天晚上开始。', session_id: 'triage-ready' });
  const result = await agent.handle({ message: '今天比昨天疼一点，还有点恶心，没有吐。', session_id: 'triage-ready' });
  assert.equal(result.debug.recommended_department?.department_id, 'general_surgery');
  assert.match(result.message, /普外科/);
  assert.doesNotMatch(result.message, /阑尾炎|确诊|一定是/);
  assert.equal(result.tool_calls.some((call) => call.name === 'get_doctors' || call.name === 'get_registration_slots'), false);
});

test('推荐后查询号源只能来自 Business Tools，并支持第一个号源挂号', async () => {
  const agent = createAgent();
  await agent.handle({ message: '我肚子疼，应该挂什么科？', session_id: 'triage-business' });
  await agent.handle({ message: '右下腹，从昨天晚上开始。', session_id: 'triage-business' });
  await agent.handle({ message: '今天比昨天疼一点，有点恶心，没有吐。', session_id: 'triage-business' });
  const slots = await agent.handle({ message: '帮我看看今天的号。', session_id: 'triage-business' });
  assert.ok(slots.tool_calls.some((call) => call.name === 'get_doctors'));
  assert.ok(slots.tool_calls.some((call) => call.name === 'get_registration_slots'));
  const registration = await agent.handle({ message: '就第一个。', session_id: 'triage-business' });
  assert.ok(registration.tool_calls.some((call) => call.name === 'create_registration'));
  assert.equal(registration.visit_context?.appointment_time, '10:30');
});

test('Safety 命中后阻断号源和挂号', async () => {
  const agent = createAgent();
  const emergency = await agent.handle({ message: '我突然剧烈腹痛，肚子很硬。', session_id: 'triage-emergency' });
  assert.equal(emergency.debug.triage_status, 'ESCALATED');
  assert.equal(emergency.debug.safety_check?.risk_level, 'EMERGENCY');
  const blocked = await agent.handle({ message: '那还是帮我挂10:30吧。', session_id: 'triage-emergency' });
  assert.equal(blocked.tool_calls.length, 0);
  assert.doesNotMatch(blocked.message, /完成 Demo 挂号/);
});

test('缴费状态查询使用只读 Tool，不产生支付副作用', async () => {
  const agent = createAgent();
  await agent.handle({ message: '张明远今天还有号吗？', session_id: 'payment-query' });
  await agent.handle({ message: '帮我挂10:30', session_id: 'payment-query' });
  update_visit_stage('ARRIVED');
  update_visit_stage('WAITING_DOCTOR');
  update_visit_stage('CONSULTING');
  update_visit_stage('PAYMENT');
  const result = await agent.handle({ message: '我的CT缴费了吗？', session_id: 'payment-query' });
  assert.ok(result.tool_calls.some((call) => call.name === 'get_payment_status'));
  assert.equal(result.tool_calls.some((call) => call.name === 'pay_order'), false);
  assert.equal(get_visit_context().current_stage, 'PAYMENT');
  assert.equal(get_visit_context().payment_status, 'UNPAID');
});

test('明确支付动作才调用 pay_order', async () => {
  const agent = createAgent();
  await agent.handle({ message: '张明远今天还有号吗？', session_id: 'payment-action' });
  await agent.handle({ message: '帮我挂10:30', session_id: 'payment-action' });
  update_visit_stage('ARRIVED');
  update_visit_stage('WAITING_DOCTOR');
  update_visit_stage('CONSULTING');
  update_visit_stage('PAYMENT');
  const result = await agent.handle({ message: '帮我把CT费用交了。', session_id: 'payment-action' });
  assert.ok(result.tool_calls.some((call) => call.name === 'pay_order'));
  assert.equal(result.visit_context?.payment_status, 'PAID');
});

test('模糊挂号或支付表达不会执行 write Tool', async () => {
  const agent = createAgent();
  const registration = await agent.handle({ message: '这个时间还能挂吗？', session_id: 'ambiguous-actions' });
  assert.equal(registration.tool_calls.some((call) => call.name === 'create_registration'), false);
  const payment = await agent.handle({ message: 'CT费用是多少？', session_id: 'ambiguous-actions' });
  assert.equal(payment.tool_calls.some((call) => call.name === 'pay_order'), false);
});

test('Triage 层只返回科室建议，不生成医生和号源', () => {
  const safety = evaluateSafety({ chief_complaint: 'abdominal_pain', location: 'right_lower_abdomen', duration: '昨天', progression: 'worsening', nausea: true, vomiting: false });
  const result = triageAbdominalPain({ chief_complaint: 'abdominal_pain', location: 'right_lower_abdomen', duration: '昨天', progression: 'worsening', nausea: true, vomiting: false }, safety);
  assert.equal(result.department_id, 'general_surgery');
  assert.equal('doctor_id' in result, false);
  assert.equal('appointment_time' in result, false);
});

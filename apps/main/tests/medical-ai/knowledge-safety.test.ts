import test from 'node:test';
import assert from 'node:assert/strict';
import { MainAgent, resetAgentSessions } from '../../lib/works/medical-ai/src/agent/main-agent';
import { searchHospitalKnowledge, searchMedicalKnowledge } from '../../lib/works/medical-ai/src/knowledge/search';
import { evaluateSafety } from '../../lib/works/medical-ai/src/safety/engine';
import { resetMockState } from '../../lib/works/medical-ai/src/tools/mock-tools';

function createAgent() {
  resetMockState();
  resetAgentSessions();
  return new MainAgent();
}

test('CT是什么会路由到 Medical Knowledge', async () => {
  const result = await createAgent().handle({ message: 'CT是什么？', session_id: 'knowledge-medical' });
  assert.ok(result.tool_calls.some((call) => call.name === 'search_medical_knowledge'));
  assert.equal(result.debug.route, 'MEDICAL_KNOWLEDGE');
  assert.match(result.message, /X 射线/);
});

test('CT室在哪里会路由到 Hospital Knowledge', async () => {
  const result = await createAgent().handle({ message: 'CT室在哪里？', session_id: 'knowledge-ct-location' });
  assert.ok(result.tool_calls.some((call) => call.name === 'search_hospital_knowledge'));
  assert.equal(result.debug.route, 'HOSPITAL_KNOWLEDGE');
  assert.match(result.message, /二楼医学影像中心/);
});

test('停车怎么收费会查询 Hospital Knowledge', async () => {
  const result = await createAgent().handle({ message: '停车怎么收费？', session_id: 'knowledge-parking' });
  assert.ok(result.tool_calls.some((call) => call.name === 'search_hospital_knowledge'));
  assert.match(result.message, /5元\/小时/);
});

test('排队问题继续使用 Queue Tool', async () => {
  const agent = createAgent();
  const result = await agent.handle({ message: '前面还有几个人？', session_id: 'queue-routing' });
  assert.ok(result.tool_calls.some((call) => call.name === 'get_queue_status'));
  assert.equal(result.tool_calls.some((call) => call.name.includes('knowledge')), false);
});

test('Medical Knowledge 没有结果时返回空结果且不编造', async () => {
  assert.deepEqual(searchMedicalKnowledge('量子传感器').results, []);
  const result = await createAgent().handle({ message: '量子传感器是什么？', session_id: 'knowledge-medical-empty' });
  assert.equal(result.tool_calls.some((call) => call.name === 'search_medical_knowledge'), true);
  assert.match(result.message, /没有找到/);
});

test('Hospital Knowledge 没有结果时返回空结果且不编造', async () => {
  assert.deepEqual(searchHospitalKnowledge('游泳池开放规定').results, []);
  const result = await createAgent().handle({ message: '游泳池开放规定是什么？', session_id: 'knowledge-hospital-empty' });
  assert.equal(result.tool_calls.some((call) => call.name === 'search_hospital_knowledge'), true);
  assert.match(result.message, /没有找到/);
});

test('结构化腹痛高风险条件命中 EMERGENCY', () => {
  const result = evaluateSafety({ chief_complaint: 'abdominal_pain', onset: 'sudden', severity: 'severe' });
  assert.equal(result.risk_level, 'EMERGENCY');
  assert.equal(result.action, 'ESCALATE');
  assert.deepEqual(result.matched_rule_ids, ['ABD_RED_FLAG_001']);
});

test('Safety Rule 命中后停止普通挂号流程', async () => {
  const agent = createAgent();
  const result = await agent.handle({ message: '我突然剧烈腹痛，肚子很硬。', session_id: 'safety-escalation' });
  assert.equal(result.tool_calls.length, 0);
  assert.equal(result.debug.safety_check?.risk_level, 'EMERGENCY');
  assert.match(result.message, /现场医疗帮助/);
  assert.equal(result.message.includes('挂号'), false);
  const followup = await agent.handle({ message: '帮我挂10:30。', session_id: 'safety-escalation' });
  assert.equal(followup.tool_calls.length, 0);
  assert.match(followup.message, /现场医疗帮助/);
});

test('普通腹痛描述未命中规则时继续有限信息采集', async () => {
  const result = await createAgent().handle({ message: '我肚子疼，昨天开始，有点疼。', session_id: 'safety-continue' });
  assert.equal(result.debug.safety_check?.risk_level, 'SAFE');
  assert.match(result.message, /哪里疼/);
});

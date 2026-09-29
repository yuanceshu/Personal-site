import test from 'node:test';
import assert from 'node:assert/strict';
import { MainAgent, resetAgentSessions } from '../../lib/works/medical-ai/src/agent/main-agent';
import { getToolEffect, executeTool } from '../../lib/works/medical-ai/src/agent/tool-registry';
import { get_report, get_visit_context, resetMockState, create_registration, update_visit_stage, pay_order } from '../../lib/works/medical-ai/src/tools/mock-tools';
import { normalizeCtReport } from '../../lib/works/medical-ai/src/report/ct-normalizer';
import { interpretCtReport } from '../../lib/works/medical-ai/src/report/ct-interpreter';
import { evaluateReportSafety } from '../../lib/works/medical-ai/src/report/safety';

function agent() {
  resetMockState();
  resetAgentSessions();
  return new MainAgent();
}

function moveToWaitingReport() {
  create_registration({ appointment_time: '10:30' });
  update_visit_stage('ARRIVED');
  update_visit_stage('WAITING_DOCTOR');
  update_visit_stage('CONSULTING');
  update_visit_stage('PAYMENT');
  pay_order();
  update_visit_stage('EXAMINING');
  update_visit_stage('WAITING_REPORT');
}

function moveToReportReady() {
  moveToWaitingReport();
  update_visit_stage('RETURN_VISIT');
}

test('同一 symptom episode 的 Safety escalation 不会因后续症状更新自动解除', async () => {
  const current = agent();
  const emergency = await current.handle({ message: '我突然剧烈腹痛，肚子很硬。', session_id: 'episode-same' });
  assert.equal(emergency.debug.safety_check?.risk_level, 'EMERGENCY');
  const followup = await current.handle({ message: '右下腹，现在还是有点疼。', session_id: 'episode-same' });
  assert.equal(followup.debug.safety_check?.risk_level, 'EMERGENCY');
  assert.equal(followup.debug.triage_status, 'ESCALATED');
});

test('明确开始新的 symptom episode 后可以获得新的安全状态', async () => {
  const current = agent();
  await current.handle({ message: '我突然剧烈腹痛，肚子很硬。', session_id: 'episode-new' });
  const fresh = await current.handle({ message: '重新开始，这是另一个问题：我肚子疼。', session_id: 'episode-new' });
  assert.equal(fresh.debug.safety_check?.risk_level, 'SAFE');
  assert.equal(fresh.debug.triage_status, 'NEED_MORE_INFO');
  assert.match(fresh.message, /哪里疼、持续多久/);
});

test('新 session 自动拥有新的 symptom episode', async () => {
  const current = agent();
  await current.handle({ message: '我突然剧烈腹痛，肚子很硬。', session_id: 'episode-old-session' });
  const fresh = await current.handle({ message: '我肚子疼。', session_id: 'episode-new-session' });
  assert.equal(fresh.debug.safety_check?.risk_level, 'SAFE');
  assert.equal(fresh.debug.triage_status, 'NEED_MORE_INFO');
});

test('报告未 READY 时不能进入解释', async () => {
  const current = agent();
  moveToWaitingReport();
  const result = await current.handle({ message: '报告什么意思？', session_id: 'report-pending' });
  assert.ok(result.tool_calls.some((call) => call.name === 'get_report'));
  assert.equal(result.tool_calls.some((call) => call.name === 'interpret_report'), false);
  assert.match(result.message, /没有 READY|不能进行报告解释/);
});

test('报告 READY 后可以进入解释', async () => {
  const current = agent();
  moveToReportReady();
  const result = await current.handle({ message: '报告什么意思？', session_id: 'report-ready' });
  assert.ok(result.tool_calls.some((call) => call.name === 'interpret_report'));
  assert.match(result.message, /关键发现|下一步/);
});

test('报告出来了吗只查询状态，不进入解释', async () => {
  const current = agent();
  moveToReportReady();
  const result = await current.handle({ message: '我的报告出来了吗？', session_id: 'report-status' });
  assert.deepEqual(result.tool_calls.map((call) => call.name), ['get_report']);
  assert.match(result.message, /已经出来/);
});

test('那你帮我看看可以承接上一轮已查询的报告', async () => {
  const current = agent();
  moveToReportReady();
  await current.handle({ message: '我的报告出来了吗？', session_id: 'report-followup' });
  const result = await current.handle({ message: '那你帮我看看。', session_id: 'report-followup' });
  assert.ok(result.tool_calls.some((call) => call.name === 'interpret_report'));
  assert.equal(result.debug.report_id, 'report001');
});

test('Structured CT Report 只来自真实 Mock Report', () => {
  resetMockState();
  moveToReportReady();
  const raw = get_report();
  const structured = normalizeCtReport(raw);
  assert.equal(structured.report_id, raw.report_id);
  assert.deepEqual(structured.findings, raw.findings);
  assert.deepEqual(structured.impression, [raw.impression]);
  assert.equal(structured.critical_flag, raw.critical_flag);
});

test('患者解释优先 Impression，再解释 Findings', () => {
  resetMockState();
  moveToReportReady();
  const raw = get_report();
  const result = interpretCtReport(normalizeCtReport(raw));
  assert.equal(result.key_findings[0]?.original, raw.impression);
  assert.equal(result.key_findings[1]?.original, raw.findings[0]);
});

test('报告中的不确定措辞会保留', () => {
  resetMockState();
  moveToReportReady();
  const raw = get_report();
  const result = interpretCtReport(normalizeCtReport(raw));
  assert.ok(result.uncertainty.some((item) => item.includes('需结合临床')));
  assert.match(result.summary, /需结合临床进一步判断/);
});

test('报告没有出现的疾病不会被解释器凭空新增', () => {
  resetMockState();
  moveToReportReady();
  const raw = get_report();
  const result = interpretCtReport(normalizeCtReport(raw));
  const text = JSON.stringify(result);
  assert.doesNotMatch(text, /肝癌|肝脏肿瘤|胆囊结石/);
});

test('是不是阑尾炎不会产生确定诊断', async () => {
  const current = agent();
  moveToReportReady();
  const result = await current.handle({ message: '所以我是不是阑尾炎？', session_id: 'report-diagnosis' });
  assert.doesNotMatch(result.message, /你得了阑尾炎|确定是阑尾炎|一定是阑尾炎/);
  assert.match(result.message, /不能仅凭这份报告|需要结合临床/);
});

test('严重吗不会产生没有依据的二元结论', async () => {
  const current = agent();
  moveToReportReady();
  const result = await current.handle({ message: '严重吗？', session_id: 'report-severity' });
  assert.match(result.message, /不能.*二元结论|需要由医生/);
  assert.doesNotMatch(result.message, /^(严重|不严重)[。！!]?$/);
});

test('Report Interpretation Tool 标记为 read-only', () => {
  assert.equal(getToolEffect('interpret_report'), 'read');
});

test('Report Safety 只读取 Mock PACS critical_flag，与症状 Safety 分开', () => {
  assert.deepEqual(evaluateReportSafety({ critical_flag: false }), {
    critical: false,
    source: 'MOCK_PACS_CRITICAL_FLAG',
    message: 'Mock PACS 未标记明确危急值。',
  });
  assert.equal(evaluateReportSafety({ critical_flag: true }).critical, true);
});

test('报告解释不会修改 Visit Context', async () => {
  const current = agent();
  moveToReportReady();
  const before = get_visit_context();
  await current.handle({ message: '报告什么意思？', session_id: 'report-read-only' });
  assert.deepEqual(get_visit_context(), before);
});

test('报告解释会提示返回普外科复诊', async () => {
  const current = agent();
  moveToReportReady();
  const result = await current.handle({ message: '报告什么意思？', session_id: 'report-return' });
  assert.match(result.message, /返回普外科/);
  assert.equal(result.visit_context?.current_stage, 'RETURN_VISIT');
});

test('报告解释不会自动把 RETURN_VISIT 改成 FINISHED', async () => {
  const current = agent();
  moveToReportReady();
  await current.handle({ message: '报告什么意思？', session_id: 'report-no-finish' });
  assert.equal(get_visit_context().current_stage, 'RETURN_VISIT');
});

test('interpret_report 只能解释报告 Tool 返回的 report_id', () => {
  resetMockState();
  assert.throws(() => executeTool('interpret_report', { report_id: 'unknown' }), /报告尚未生成/);
});

test('原有腹痛业务流在报告解释前仍保持 RETURN_VISIT 入口', () => {
  resetMockState();
  moveToReportReady();
  assert.equal(get_visit_context().current_stage, 'RETURN_VISIT');
  assert.equal(get_report().report_status, 'READY');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  create_registration,
  get_exam_orders,
  get_queue_status,
  get_report,
  get_registration_slots,
  get_visit_context,
  pay_order,
  resetMockState,
  update_visit_stage,
} from '../../lib/works/medical-ai/src/tools/mock-tools';

test('腹痛患者可以从 PRE_VISIT 完整流转到 FINISHED', () => {
  resetMockState();
  assert.equal(get_visit_context().current_stage, 'PRE_VISIT');

  const doctorsSlots = get_registration_slots('doctor001');
  assert.deepEqual(doctorsSlots.map((slot) => slot.appointment_time), ['10:30', '11:00', '14:30']);

  const registered = create_registration({
    department_id: 'general_surgery',
    doctor_id: 'doctor001',
    appointment_time: '10:30',
  });
  assert.equal(registered.current_stage, 'REGISTERED');
  assert.equal(registered.department_name, '普外科');
  assert.equal(registered.doctor_name, '张明远');
  assert.equal(registered.appointment_time, '10:30');

  update_visit_stage('ARRIVED');
  update_visit_stage('WAITING_DOCTOR');
  update_visit_stage('CONSULTING');
  const payment = update_visit_stage('PAYMENT');
  assert.equal(payment.current_stage, 'PAYMENT');
  assert.equal(payment.current_order, '腹部CT');
  assert.equal(payment.payment_status, 'UNPAID');
  assert.equal(get_exam_orders()[0].exam_type, '腹部 CT');

  const paid = pay_order();
  assert.equal(paid.visit_context.payment_status, 'PAID');
  assert.equal(paid.visit_context.current_stage, 'WAITING_EXAM');

  update_visit_stage('EXAMINING');
  assert.equal(get_visit_context().current_stage, 'EXAMINING');
  const waitingReport = update_visit_stage('WAITING_REPORT');
  assert.equal(waitingReport.exam_status, 'COMPLETED');
  assert.equal(waitingReport.report_status, 'PENDING');

  const returnVisit = update_visit_stage('RETURN_VISIT');
  assert.equal(returnVisit.current_stage, 'RETURN_VISIT');
  assert.equal(returnVisit.exam_status, 'COMPLETED');
  assert.equal(returnVisit.report_status, 'READY');
  assert.equal(get_report().report_type, '腹部 CT');
  assert.equal(get_queue_status().people_ahead, 4);

  const finished = update_visit_stage('FINISHED');
  assert.equal(finished.current_stage, 'FINISHED');
  assert.equal(finished.next_action, '本次就诊已完成');
});

test('Mock Tool 会拒绝跳过缴费直接开始检查', () => {
  resetMockState();
  create_registration({ appointment_time: '10:30' });
  update_visit_stage('ARRIVED');
  update_visit_stage('WAITING_DOCTOR');
  update_visit_stage('CONSULTING');
  update_visit_stage('PAYMENT');
  assert.throws(() => update_visit_stage('EXAMINING'), /不允许从 PAYMENT 直接进入 EXAMINING/);
});

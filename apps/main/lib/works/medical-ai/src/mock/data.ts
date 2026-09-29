/** 所有业务事实均来自这里的明川市中心医院虚构 Demo 数据。 */

export const DEMO_PATIENT_ID = 'demo001';
export const DEMO_VISIT_ID = 'visit001';

export interface Patient {
  patient_id: string;
  name: string;
  gender: string;
  age: number;
  is_demo_data: true;
}

export interface Department {
  department_id: string;
  department_name: string;
  description: string;
  location: string;
  is_demo_data: true;
}

export interface Doctor {
  doctor_id: string;
  name: string;
  department_id: string;
  department: string;
  title: string;
  is_demo_data: true;
}

export type RegistrationSlotStatus = 'AVAILABLE' | 'BOOKED';

export interface RegistrationSlot {
  slot_id: string;
  doctor_id: string;
  appointment_time: string;
  status: RegistrationSlotStatus;
  is_demo_data: true;
}

export interface QueueStatus {
  queue_number: string;
  current_number: string;
  people_ahead: number;
  estimated_wait_minutes: number;
  location: string;
  is_demo_data: true;
}

export interface StructuredReportData {
  findings: string[];
  impression: string;
}

export interface MockReport {
  report_id: string;
  visit_id: string;
  exam_name: string;
  exam_date: string;
  clinical_history: string;
  technique: string;
  findings: string[];
  impression: string;
  recommendation: string;
  report_status: 'PENDING' | 'READY';
  critical_flag: boolean;
  source: string;
  source_url: string;
  report_type: string;
  status: 'READY';
  raw_content: string;
  structured_data: StructuredReportData;
  is_demo_data: true;
}

export const patients: Patient[] = [
  { patient_id: DEMO_PATIENT_ID, name: '林小满', gender: '女', age: 32, is_demo_data: true },
];

export const departments: Department[] = [
  {
    department_id: 'general_surgery',
    department_name: '普外科',
    description: '负责腹痛、腹部急症等情况的进一步评估。',
    location: '门诊楼3楼',
    is_demo_data: true,
  },
];

export const doctors: Doctor[] = [
  {
    doctor_id: 'doctor001',
    name: '张明远',
    department_id: 'general_surgery',
    department: '普外科',
    title: '主任医师',
    is_demo_data: true,
  },
];

export const registrationSlots: RegistrationSlot[] = [
  { slot_id: 'slot-1030', doctor_id: 'doctor001', appointment_time: '10:30', status: 'AVAILABLE', is_demo_data: true },
  { slot_id: 'slot-1100', doctor_id: 'doctor001', appointment_time: '11:00', status: 'AVAILABLE', is_demo_data: true },
  { slot_id: 'slot-1430', doctor_id: 'doctor001', appointment_time: '14:30', status: 'AVAILABLE', is_demo_data: true },
];

export const queue: QueueStatus = {
  queue_number: 'A041',
  current_number: 'A036',
  people_ahead: 4,
  estimated_wait_minutes: 25,
  location: '二楼医学影像中心 CT 登记台',
  is_demo_data: true,
};

export const report: MockReport = {
  report_id: 'report001',
  visit_id: DEMO_VISIT_ID,
  exam_name: '腹部 CT',
  exam_date: '2026-09-28',
  clinical_history: '右下腹疼痛约一天，伴轻度恶心。',
  technique: '腹部平扫 CT，患者仰卧位。',
  findings: ['阑尾轻度增粗', '周围脂肪间隙可见轻度渗出'],
  impression: '局部可见轻度炎性改变，需结合临床进一步判断。',
  recommendation: '建议携带报告返回普外科复诊，结合症状和体格检查评估。',
  report_status: 'READY',
  critical_flag: false,
  source: '明川市中心医院 Demo Mock LIS/PACS',
  source_url: 'mock://mingchuan/report/report001',
  report_type: '腹部 CT',
  status: 'READY',
  raw_content: '腹部CT示：阑尾轻度增粗，周围脂肪间隙可见轻度渗出。请结合临床症状及医生判断。',
  structured_data: {
    findings: ['阑尾轻度增粗', '周围脂肪间隙轻度渗出'],
    impression: '局部可见轻度炎性改变，需结合临床进一步判断。',
  },
  is_demo_data: true,
};

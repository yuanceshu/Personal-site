import type { SafetyRule } from './types';

const ABDOMINAL_PAIN_SOURCE = 'https://medlineplus.gov/ency/article/003120.htm';

export const ACTIVE_SAFETY_RULES: SafetyRule[] = [
  {
    rule_id: 'ABD_RED_FLAG_001',
    name: 'Sudden severe abdominal pain',
    conditions: { chief_complaint: 'abdominal_pain', onset: 'sudden', severity: 'severe' },
    risk_level: 'EMERGENCY',
    action: 'ESCALATE',
    message: '突然出现的剧烈腹痛属于需要尽快现场评估的风险信号。',
    source: 'MedlinePlus - Abdominal pain',
    source_url: ABDOMINAL_PAIN_SOURCE,
    version: '1.0',
  },
  {
    rule_id: 'ABD_RED_FLAG_002',
    name: 'Rigid or very tender abdomen',
    conditions: { chief_complaint: 'abdominal_pain', rigid_abdomen: true },
    risk_level: 'EMERGENCY',
    action: 'ESCALATE',
    message: '腹部明显僵硬或严重压痛属于需要尽快现场评估的风险信号。',
    source: 'MedlinePlus - Abdominal pain',
    source_url: ABDOMINAL_PAIN_SOURCE,
    version: '1.0',
  },
  {
    rule_id: 'ABD_RED_FLAG_003',
    name: 'Blood in vomit or stool',
    conditions: { chief_complaint: 'abdominal_pain', bleeding: true },
    risk_level: 'EMERGENCY',
    action: 'ESCALATE',
    message: '腹痛伴呕血或明显便血属于需要尽快现场评估的风险信号。',
    source: 'MedlinePlus - Abdominal pain',
    source_url: ABDOMINAL_PAIN_SOURCE,
    version: '1.0',
  },
  {
    rule_id: 'ABD_RED_FLAG_004',
    name: 'Abdominal pain with difficulty breathing',
    conditions: { chief_complaint: 'abdominal_pain', difficulty_breathing: true },
    risk_level: 'EMERGENCY',
    action: 'ESCALATE',
    message: '腹痛同时伴有明显呼吸困难属于需要尽快现场评估的风险信号。',
    source: 'MedlinePlus - Abdominal pain',
    source_url: ABDOMINAL_PAIN_SOURCE,
    version: '1.0',
  },
];

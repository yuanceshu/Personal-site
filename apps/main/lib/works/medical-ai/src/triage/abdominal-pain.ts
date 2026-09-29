import type { SafetyResult, SymptomContext } from '../safety/types';
import type { TriageResult } from './types';

function isKnown(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '' && value !== 'unknown';
}

export function triageAbdominalPain(symptomContext: SymptomContext, safetyResult: SafetyResult): TriageResult {
  if (safetyResult.risk_level === 'EMERGENCY') {
    return {
      status: 'ESCALATED',
      safety_status: safetyResult.risk_level,
      risk_level: safetyResult.risk_level,
      department_id: null,
      department_name: null,
      reason: null,
      missing_fields: [],
    };
  }

  const missingFields: string[] = [];
  if (!isKnown(symptomContext.location)) missingFields.push('location');
  if (!isKnown(symptomContext.duration)) missingFields.push('duration');
  if (!isKnown(symptomContext.progression) && !isKnown(symptomContext.severity)) missingFields.push('progression_or_severity');
  if (![true, false].includes(symptomContext.nausea as boolean) && ![true, false].includes(symptomContext.vomiting as boolean)) missingFields.push('nausea_or_vomiting');

  if (missingFields.length > 0) {
    return {
      status: 'NEED_MORE_INFO',
      safety_status: safetyResult.risk_level,
      risk_level: safetyResult.risk_level,
      department_id: null,
      department_name: null,
      reason: null,
      missing_fields: missingFields,
    };
  }

  return {
    status: 'READY',
    safety_status: safetyResult.risk_level,
    risk_level: safetyResult.risk_level,
    department_id: 'general_surgery',
    department_name: '普外科',
    reason: `根据你目前描述的${symptomContext.location}腹痛（${symptomContext.duration}），${symptomContext.progression === 'worsening' || symptomContext.progression === '有所加重' ? '且疼痛有所加重，' : ''}建议尽快到医院进一步评估，可优先考虑普外科。这是就医方向建议，不代表疾病诊断。若症状明显加重或出现高风险表现，应及时寻求现场医疗帮助。`,
    missing_fields: [],
  };
}

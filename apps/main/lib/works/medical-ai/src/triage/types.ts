import type { SafetyResult, SymptomContext } from '../safety/types';

export type TriageStatus = 'NEED_MORE_INFO' | 'READY' | 'ESCALATED';

export interface TriageResult {
  status: TriageStatus;
  safety_status: SafetyResult['risk_level'];
  risk_level: SafetyResult['risk_level'];
  department_id: string | null;
  department_name: string | null;
  reason: string | null;
  missing_fields: string[];
}

export interface AbdominalPainTriageInput {
  symptom_context: SymptomContext;
  safety_result: SafetyResult;
}

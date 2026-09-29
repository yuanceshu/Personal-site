export type SymptomSeverity = 'mild' | 'moderate' | 'severe';
export type UnknownableBoolean = boolean | 'unknown';

export interface SymptomContext {
  chief_complaint: 'abdominal_pain' | string;
  location?: string | 'unknown';
  duration?: string | 'unknown';
  severity?: SymptomSeverity | 'unknown';
  onset?: 'sudden' | 'gradual' | 'unknown';
  progression?: string | 'unknown';
  nausea?: UnknownableBoolean;
  vomiting?: UnknownableBoolean;
  fever?: UnknownableBoolean;
  diarrhea?: UnknownableBoolean;
  vomiting_blood?: UnknownableBoolean;
  blood_in_stool?: UnknownableBoolean;
  rigid_abdomen?: UnknownableBoolean;
  difficulty_breathing?: UnknownableBoolean;
}

export interface SafetyRule {
  rule_id: string;
  name: string;
  conditions: Record<string, unknown>;
  risk_level: 'EMERGENCY';
  action: 'ESCALATE';
  message: string;
  source: string;
  source_url: string;
  version: string;
}

export interface SafetyResult {
  risk_level: 'SAFE' | 'EMERGENCY';
  action: 'CONTINUE' | 'ESCALATE';
  message: string;
  matched_rule_ids: string[];
  source_urls: string[];
}

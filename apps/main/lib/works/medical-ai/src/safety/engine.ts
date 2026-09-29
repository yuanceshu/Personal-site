import type { SafetyResult, SafetyRule, SymptomContext } from './types';
import { ACTIVE_SAFETY_RULES } from './rules';

function ruleMatches(rule: SafetyRule, context: SymptomContext): boolean {
  if (context.chief_complaint !== 'abdominal_pain') return false;
  if (rule.rule_id === 'ABD_RED_FLAG_001') return context.onset === 'sudden' && context.severity === 'severe';
  if (rule.rule_id === 'ABD_RED_FLAG_002') return context.rigid_abdomen === true;
  if (rule.rule_id === 'ABD_RED_FLAG_003') return context.vomiting_blood === true || context.blood_in_stool === true;
  if (rule.rule_id === 'ABD_RED_FLAG_004') return context.difficulty_breathing === true;
  return false;
}

export function evaluateSafety(context: SymptomContext): SafetyResult {
  const matchedRules = ACTIVE_SAFETY_RULES.filter((rule) => ruleMatches(rule, context));
  if (matchedRules.length === 0) {
    return {
      risk_level: 'SAFE',
      action: 'CONTINUE',
      message: '当前已提供的信息未命中本轮 Demo 腹痛升级规则，可以继续补充症状信息。',
      matched_rule_ids: [],
      source_urls: [],
    };
  }
  return {
    risk_level: 'EMERGENCY',
    action: 'ESCALATE',
    message: `根据当前描述，${matchedRules.map((rule) => rule.message).join('')}不建议继续等待普通门诊，请尽快寻求现场医疗帮助；如症状严重或无法自行前往，应及时联系当地急救服务。`,
    matched_rule_ids: matchedRules.map((rule) => rule.rule_id),
    source_urls: [...new Set(matchedRules.map((rule) => rule.source_url))],
  };
}

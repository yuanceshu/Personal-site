import { z } from 'zod';

export const SymptomContextSchema = z.object({
  chief_complaint: z.string().min(1),
  location: z.union([z.string(), z.literal('unknown')]).optional(),
  duration: z.union([z.string(), z.literal('unknown')]).optional(),
  severity: z.union([z.enum(['mild', 'moderate', 'severe']), z.literal('unknown')]).optional(),
  onset: z.union([z.enum(['sudden', 'gradual']), z.literal('unknown')]).optional(),
  progression: z.union([z.string(), z.literal('unknown')]).optional(),
  nausea: z.union([z.boolean(), z.literal('unknown')]).optional(),
  vomiting: z.union([z.boolean(), z.literal('unknown')]).optional(),
  fever: z.union([z.boolean(), z.literal('unknown')]).optional(),
  diarrhea: z.union([z.boolean(), z.literal('unknown')]).optional(),
  vomiting_blood: z.union([z.boolean(), z.literal('unknown')]).optional(),
  blood_in_stool: z.union([z.boolean(), z.literal('unknown')]).optional(),
  rigid_abdomen: z.union([z.boolean(), z.literal('unknown')]).optional(),
  difficulty_breathing: z.union([z.boolean(), z.literal('unknown')]).optional(),
}).strict();

export const SafetyResultSchema = z.object({
  risk_level: z.enum(['SAFE', 'EMERGENCY']),
  action: z.enum(['CONTINUE', 'ESCALATE']),
  message: z.string(),
  matched_rule_ids: z.array(z.string()),
  source_urls: z.array(z.string()),
});

import abdominalPain from '../../knowledge/medical/symptoms/abdominal-pain.json';
import ct from '../../knowledge/medical/examinations/ct.json';
import abdominalCtReport from '../../knowledge/medical/reports/abdominal-ct-report.json';
import type { KnowledgeEntry } from './types';

export const medicalKnowledge: KnowledgeEntry[] = [abdominalPain, ct, abdominalCtReport];

export function listMedicalKnowledge(): KnowledgeEntry[] {
  return structuredClone(medicalKnowledge);
}

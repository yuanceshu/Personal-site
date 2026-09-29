import type { KnowledgeDomain, KnowledgeEntry, KnowledgeResult, KnowledgeSearchResponse } from './types';
import { listMedicalKnowledge } from './medical-repository';
import { listHospitalKnowledge } from './hospital-repository';

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN');
}

function queryTokens(query: string): string[] {
  return normalize(query).split(/[\s,，。！？!?、；;：:（）()]+/).filter((token) => token.length > 0);
}

function scoreEntry(entry: KnowledgeEntry, query: string): number {
  const normalizedQuery = normalize(query);
  const tokens = queryTokens(query);
  let score = 0;
  for (const keyword of entry.keywords) {
    const normalizedKeyword = normalize(keyword);
    if (normalizedQuery.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedQuery)) score += 10;
    else if (tokens.some((token) => token.includes(normalizedKeyword) || normalizedKeyword.includes(token))) score += 6;
  }
  const normalizedTitle = normalize(entry.title);
  if (normalizedQuery.includes(normalizedTitle) || normalizedTitle.includes(normalizedQuery)) score += 5;
  if (tokens.some((token) => normalize(entry.content).includes(token))) score += 1;
  return score;
}

export function searchKnowledge(domain: KnowledgeDomain, query: string, limit = 3): KnowledgeSearchResponse {
  const entries = domain === 'medical' ? listMedicalKnowledge() : listHospitalKnowledge();
  const results: KnowledgeResult[] = entries
    .map((entry) => ({ ...entry, score: scoreEntry(entry, query) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, limit);
  return { domain, query, results };
}

export function searchMedicalKnowledge(query: string, limit = 3): KnowledgeSearchResponse {
  return searchKnowledge('medical', query, limit);
}

export function searchHospitalKnowledge(query: string, limit = 3): KnowledgeSearchResponse {
  return searchKnowledge('hospital', query, limit);
}

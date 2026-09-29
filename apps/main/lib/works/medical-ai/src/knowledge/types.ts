export type KnowledgeDomain = 'medical' | 'hospital';

export interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  content: string;
  source: string;
  source_url: string;
  review_date: string;
  version: string;
}

export interface KnowledgeResult extends KnowledgeEntry {
  score: number;
}

export interface KnowledgeSearchResponse {
  domain: KnowledgeDomain;
  query: string;
  results: KnowledgeResult[];
}

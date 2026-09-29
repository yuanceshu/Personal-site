import { z } from 'zod';

export const KnowledgeDomainSchema = z.enum(['medical', 'hospital']);

export const KnowledgeQuerySchema = z.object({
  query: z.string().trim().min(1, 'query 不能为空'),
}).strict();

export const KnowledgeResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  keywords: z.array(z.string()),
  content: z.string(),
  source: z.string(),
  source_url: z.string(),
  review_date: z.string(),
  version: z.string(),
  score: z.number(),
});

export const KnowledgeSearchResponseSchema = z.object({
  domain: KnowledgeDomainSchema,
  query: z.string(),
  results: z.array(KnowledgeResultSchema),
});

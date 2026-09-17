export type RestaurantModule = "customer" | "operations" | "finance";

export type KnowledgeEntry = {
  id: string;
  module: RestaurantModule;
  category: string;
  title: string;
  keywords: string[];
  content: string;
  answer: string;
  source: string;
  date?: string;
  followups: string[];
};

export type RetrievalResult = KnowledgeEntry & { score: number };

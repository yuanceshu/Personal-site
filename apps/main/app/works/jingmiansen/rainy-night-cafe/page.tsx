import type { Metadata } from "next";
import { JingmiansenArticle } from "@/components/works/jingmiansen/JingmiansenArticle";
import { rainyNightCafeArticle } from "@/content/projects/jingmiansen";

export const metadata: Metadata = {
  title: "雨夜啡庭｜静眠森",
  description:
    "从归心亭到雨夜啡庭：一间白银乡咖啡馆的起源、空间与漂泊者群像。",
};

export default function RainyNightCafePage() {
  return (
    <JingmiansenArticle
      article={rainyNightCafeArticle}
      currentHref="/works/jingmiansen/rainy-night-cafe"
    />
  );
}

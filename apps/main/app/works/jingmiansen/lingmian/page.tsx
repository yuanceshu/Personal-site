import type { Metadata } from "next";
import { JingmiansenArticle } from "@/components/works/jingmiansen/JingmiansenArticle";
import { lingmianArticle } from "@/content/projects/jingmiansen";

export const metadata: Metadata = {
  title: "灵眠｜静眠森",
  description:
    "从无法安睡的孩子，到学会控制梦境并守望静眠森边界的人：灵眠人物与世界概览。",
};

export default function LingmianPage() {
  return (
    <JingmiansenArticle
      article={lingmianArticle}
      currentHref="/works/jingmiansen/lingmian"
    />
  );
}

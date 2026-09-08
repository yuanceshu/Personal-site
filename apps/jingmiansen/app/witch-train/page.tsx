import type { Metadata } from "next";
import { JingmiansenArticle } from "@/components/works/jingmiansen/JingmiansenArticle";
import { witchTrainArticle } from "@/content/projects/jingmiansen";

export const metadata: Metadata = {
  title: { absolute: "菲莉卡与魔女列车｜静眠森" },
  description:
    "菲莉卡误入魔女列车，在夜行车厢与复杂来客之间寻找归途，也重新确认自己的名字。",
  alternates: { canonical: "/witch-train" },
};

export default function WitchTrainPage() {
  return (
    <JingmiansenArticle
      article={witchTrainArticle}
      currentHref="/witch-train"
    />
  );
}

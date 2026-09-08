import type { Metadata } from "next";
import { XingyueStory } from "@/components/works/jingmiansen/XingyueStory";

export const metadata: Metadata = {
  title: { absolute: "星月相护｜静眠森" },
  description:
    "明月真理奈与希斯达娅在雨夜重逢，并学会让星辉与星穗彼此守护。",
  alternates: { canonical: "/xing-yue-xiang-hu" },
};

export default function XingyueStoryPage() {
  return <XingyueStory />;
}

import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SolutionLab } from "@/components/works/ai-solution-lab/SolutionLab";
import "@/styles/projects/ai-solution-lab/workbench.css";

export const metadata: Metadata = {
  title: "AI 场景诊断与原型生成工作台",
  description:
    "描述一件想改善的工作或服务，梳理需求、判断 AI 适用范围，并体验可以继续讨论的产品草稿。",
};
export default function SolutionLabPage() {
  return (
    <>
      <a className="lab-skip" href="#lab-main">
        跳到主要内容
      </a>
      <SiteHeader projectLabel="作品 / AI LAB" />
      <SolutionLab />
    </>
  );
}

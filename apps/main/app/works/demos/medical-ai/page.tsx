import type { Metadata } from "next";
import { MedicalDemo } from "@/components/works/demos/medical-ai/MedicalDemo";
import "@/styles/projects/demos/medical-ai.css";

export const metadata: Metadata = {
  title: "明川市中心医院 · AI 就医助手 | 行业 Demo 集",
  description: "贯穿症状采集、挂号、院内流程、检查和报告解释的医疗行业 AI 就医助手演示。",
};

export default function MedicalAiPage() { return <MedicalDemo />; }

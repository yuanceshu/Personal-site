import type { Metadata } from "next";
import { AppShell } from "@/components/works/demos/linquan/shell/app-shell";

export const metadata: Metadata = {
  title: "林泉 · 智能伴游 | 行业 Demo 集",
  description: "从当前位置出发，规划一条适合同行者、时间和兴趣的林泉游览路线。",
};

export default function LinquanPage() {
  return <AppShell />;
}

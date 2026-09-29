import type { Metadata } from "next";
import { VisitorProvider } from "@/components/works/demos/linquan/shell/visitor-provider";
import "@/styles/projects/demos/linquan.css";

export const metadata: Metadata = {
  title: "林泉 · 智能伴游 | 行业 Demo 集",
  description: "一个会记住当前位置、同行条件和游览节奏的景区智能伴游 Demo。",
};

export default function LinquanLayout({ children }: { children: React.ReactNode }) {
  return <VisitorProvider>{children}</VisitorProvider>;
}

import type { Metadata, Viewport } from "next";
import { HeatingDemo } from "@/components/works/demos/heating/HeatingDemo";
import "@/styles/projects/demos/heating.css";

export const metadata: Metadata = { title: "和煦供暖 · AI 服务助手", description: "说出您的需要，办理模拟供暖缴费、断暖申请和业务查询。独立供暖服务智能体演示。", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f6f3ed" };
export default function HeatingPage() { return <HeatingDemo />; }

import type { Metadata } from "next";
import { RestaurantDemo } from "@/components/works/demos/restaurant-ai/RestaurantDemo";
import "@/styles/projects/demos/restaurant-ai.css";

export const metadata: Metadata = { title: "食智助手 · 餐饮知识服务", description: "餐饮企业知识库与 AI 问答的行业 Demo，包含顾客、运营和财务三个场景。" };
export default function RestaurantDemoPage() { return <RestaurantDemo module="home" />; }

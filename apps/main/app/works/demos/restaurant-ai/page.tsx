import type { Metadata } from "next";
import { RestaurantDemo } from "@/components/works/demos/restaurant-ai/RestaurantDemo";
import "@/styles/projects/demos/restaurant-ai.css";

export const metadata: Metadata = { title: "食智助手 · 餐饮 Agent 工作台", description: "虚构餐饮集团的顾客、运营与财务 Agent 演示：查阅资料、解释数据、准备待确认草案。" };
export default function RestaurantDemoPage() { return <RestaurantDemo module="home" />; }

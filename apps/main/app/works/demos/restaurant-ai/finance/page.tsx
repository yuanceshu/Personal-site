import type { Metadata } from "next";
import { RestaurantDemo } from "@/components/works/demos/restaurant-ai/RestaurantDemo";
import "@/styles/projects/demos/restaurant-ai.css";
export const metadata: Metadata = { title: "门店财务知识助手 · 食智助手", description: "悦味餐饮集团门店财务知识助手演示。" };
export default function FinancePage() { return <RestaurantDemo module="finance" />; }

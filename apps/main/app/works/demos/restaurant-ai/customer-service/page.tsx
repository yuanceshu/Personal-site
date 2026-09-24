import type { Metadata } from "next";
import { RestaurantDemo } from "@/components/works/demos/restaurant-ai/RestaurantDemo";
import "@/styles/projects/demos/restaurant-ai.css";
export const metadata: Metadata = { title: "智能门店顾问 · 食智助手", description: "虚构悦味餐厅的菜单、桌位与预订草案 Agent 演示。" };
export default function CustomerServicePage() { return <RestaurantDemo module="customer" />; }

import type { Metadata } from "next";
import { RestaurantDemo } from "@/components/works/demos/restaurant-ai/RestaurantDemo";
import "@/styles/projects/demos/restaurant-ai.css";
export const metadata: Metadata = { title: "门店运营 Agent · 食智助手", description: "虚构悦味餐厅的经营分析与待确认运营草案演示。" };
export default function OperationsPage() { return <RestaurantDemo module="operations" />; }

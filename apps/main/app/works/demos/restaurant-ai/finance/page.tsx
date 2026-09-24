import type { Metadata } from "next";
import { RestaurantDemo } from "@/components/works/demos/restaurant-ai/RestaurantDemo";
import "@/styles/projects/demos/restaurant-ai.css";
export const metadata: Metadata = { title: "财务核对 Agent · 食智助手", description: "虚构悦味餐厅的对账差异与待确认复核清单演示。" };
export default function FinancePage() { return <RestaurantDemo module="finance" />; }

import type { Metadata } from "next";
import { RestaurantDemo } from "@/components/works/demos/restaurant-ai/RestaurantDemo";
import "@/styles/projects/demos/restaurant-ai.css";
export const metadata: Metadata = { title: "智能门店客服 · 食智助手", description: "悦味餐厅滨江店智能门店客服演示。" };
export default function CustomerServicePage() { return <RestaurantDemo module="customer" />; }

import type { Metadata } from "next";
import { IslandTravel } from "@/components/works/demos/island-travel/IslandTravel";

export const metadata: Metadata = { title: "岛见 · 智能出行 | 行业 Demo 集", description: "一句出发，走完一段行程。体验 AI 出行查询、班次选择与模拟购票。岛见为虚构品牌，全部交易为演示。" };
export default function IslandTravelPage() { return <IslandTravel />; }

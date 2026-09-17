import type { Metadata } from "next";
import { TravelProvider } from "@/components/works/demos/island-travel/TravelProvider";
import { TravelShell } from "@/components/works/demos/island-travel/TravelUI";
import "@/styles/projects/demos/island-travel.css";
import "@/styles/projects/demos/island-flow.css";

export const metadata: Metadata = { title: "岛见 · 山海之间，自有去处", description: "海南出行的产品想象。即时查询、AI 礼宾与模拟购票；虚构班次，不产生真实交易。" };
export default function IslandLayout({ children }: { children: React.ReactNode }) {
  return <TravelProvider><TravelShell>{children}</TravelShell></TravelProvider>;
}

import type { Metadata } from "next";
import { QintaiProvider } from "@/components/works/demos/qintai-ticketing/provider";
import "@/styles/projects/demos/qintai-ticketing.css";

export const metadata: Metadata = {
  title: "琴台票务 · 武汉演出票务 | 行业 Demo 集",
  description:
    "把价格、余量与费用一次讲清楚的演出现场：锁座、候补、回流领取与运营待审批。演出与票价来自公开资料，库存与交易全为本地模拟，不产生真实交易。",
};

export default function QintaiTicketingLayout({ children }: { children: React.ReactNode }) {
  return <QintaiProvider>{children}</QintaiProvider>;
}

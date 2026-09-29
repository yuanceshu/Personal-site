import type { Metadata } from "next";
import { MerchantShell } from "@/components/works/demos/qintai-ticketing/shell/merchant-shell";

export const metadata: Metadata = {
  title: "琴台票务 · 运营工作台 | 行业 Demo 集",
  description: "武汉演出运营台演示：库存、价格与活动的改动都先生成待审批提案，应用时才写穿模拟库存。",
};

export default function QintaiMerchantLayout({ children }: { children: React.ReactNode }) {
  return <MerchantShell>{children}</MerchantShell>;
}

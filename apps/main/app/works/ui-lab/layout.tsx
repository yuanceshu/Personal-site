import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import "@/styles/projects/ui-lab/ui-lab.css";

export const metadata: Metadata = { title: "UI 实验室", description: "同一个命题，不同模型与设计方法的界面实验。浏览、比较并体验不可变的前端快照。" };
export default function UiLabLayout({ children }: { children: React.ReactNode }) {
  return <div className="uil-root"><a className="uil-skip" href="#ui-lab-main">跳到主要内容</a>
    <SiteHeader projectLabel="作品 / UI LAB" />
    <main className="uil-shell" id="ui-lab-main">{children}</main>
    <footer className="uil-shell uil-footer"><span>UI LAB / 界面实验档案</span><span>留下结果，也留下条件。</span><Link href="/#work">返回作品集 ↗</Link></footer>
  </div>;
}

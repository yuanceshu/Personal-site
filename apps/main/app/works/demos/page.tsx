import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/SiteHeader";
import { demos } from "@/content/projects/demos/catalog";
import "@/styles/projects/demos/collection.css";

export const metadata: Metadata = { title: "行业 Demo 集", description: "把 AI 放进具体的行业任务里。从问题出发，体验完整的产品流程。" };
export default function DemosPage() {
  return (
    <div className="demo-collection">
      <SiteHeader projectLabel="作品 / 行业 Demo 集" />
      <main className="collection-shell">
        <section className="collection-intro">
          <div><p className="collection-kicker">产品实验 / INDUSTRY DEMOS</p><h1>想法，<span>走进现场。</span></h1></div>
          <div className="collection-intro-note"><span aria-hidden="true">↘</span><p>不只谈 AI 能做什么。<br />把它放进具体任务，<br />做成你能亲手体验的产品。</p></div>
        </section>
        <div className="collection-divider"><span>THE COLLECTION <i>/</i> 行业 Demo 集</span><span>{String(demos.length).padStart(2, "0")} 件可体验作品</span></div>
        {demos.map((demo, index) => (
          <Link href={demo.href} className="collection-work" key={demo.id}>
            <div className="collection-art">
              {demo.id === "island-travel" ? <Image src="/projects/demos/island-travel/coast-editorial.webp" alt="虚构海岸公路的 AI 创作场景" fill sizes="(max-width: 760px) 100vw, 90vw" preload /> : <div className="collection-art-placeholder" aria-hidden="true"><span>食智助手</span><small>餐饮知识服务 · 三个真实工作场景</small></div>}
              <div className="collection-art-top"><span>01 / ISLAND TRAVEL</span><span>交通出行 · 交互体验</span></div>
              <div className="collection-art-title"><span>{demo.id === "island-travel" ? "岛见" : "食智助手"}</span><p>{demo.id === "island-travel" ? "去见一面。也见一座岛。" : "让餐饮企业的知识真正用起来。"}</p></div>
              <span className="collection-arrow" aria-hidden="true">↗</span>
              <small className="collection-image-note">{demo.id === "island-travel" ? "AI 创作示意 · 非真实线路照片" : "虚拟知识库 · 无外部业务连接"}</small>
            </div>
            <div className="collection-copy">
              <div className="collection-title-group"><span className="collection-index">{String(index + 1).padStart(2, "0")}</span><div><h2>{demo.title}</h2><div className="collection-tags">{demo.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div></div>
              <div className="collection-description"><p>{demo.description}</p><span className="collection-cta">进入完整体验 <span aria-hidden="true">↗</span></span></div>
            </div>
          </Link>
        ))}
        <aside className="collection-note"><span>在这里，<br /><em>体验先于解释。</em></span><div><p>从问题出发，走到一个可用的答案。<br />每个实验都保留完整流程，也写清能力的边界。</p><small>所有业务数据与交易均为模拟，不连接客户生产系统。</small></div></aside>
      </main>
      <footer className="collection-footer collection-shell"><span>PERSONAL LAB / 持续试验，持续留下作品。</span><Link href="/">回到个人作品站 ↗</Link></footer>
    </div>
  );
}

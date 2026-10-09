import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { collectionDemos as demos } from "./collection-data";
import { CollectionBrowser } from "./collection-browser";
import "@/styles/projects/demos/collection.css";

export const metadata: Metadata = {
  title: "行业 Demo 集",
  description: "按真实任务找到合适的行业 Demo，或前往 AI 工作台创建自己的场景。",
};

export default function DemosPage() {
  return (
    <div className="demo-collection">
      <SiteHeader projectLabel="作品 / 行业 Demo 集" />
      <main id="main-content" className="collection-shell">
        <section className="collection-hero" aria-labelledby="collection-title">
          <div className="collection-hero-copy">
            <p className="eyebrow">行业 Demo · {String(demos.length).padStart(2, "0")} 个场景</p>
            <h1 id="collection-title">把 AI 放进真实场景<span>亲眼看见它如何工作</span></h1>
            <p className="collection-lede">
              这些都是在真实业务里聊出来的 AI 场景，你可以任选一条流程，完整走一遍。
            </p>
            <Link className="collection-hero-workbench" href="/works/ai-solution-lab">
              没找到匹配的场景？去 AI 工作台搭一个 <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="collection-hero-meta" aria-label="合集概览">
            <div><strong>{String(demos.length).padStart(2, "0")}</strong><span>个场景</span></div>
            <div><strong>AI</strong><span>从理解到行动</span></div>
          </div>
        </section>

        <CollectionBrowser />

        <section className="workbench-callout" aria-labelledby="workbench-title">
          <div className="workbench-callout-copy">
            <p className="eyebrow">还没有找到合适的场景？</p>
            <h2 id="workbench-title">去 AI 工作台，做一个属于你的 Demo。</h2>
            <p>描述你想优化的工作或服务，系统会帮你梳理需求、判断 AI 适配性，生成可继续迭代的方案草稿。</p>
          </div>
          <Link className="workbench-link" href="/works/ai-solution-lab">
            打开 AI 工作台 <span aria-hidden="true">↗</span>
          </Link>
        </section>

        <aside className="collection-note">
          <strong>动手试过，方知深浅</strong>
          <p>所有 Demo 均保留完整的输入、推理、判断与人工确认链路；页面内所有业务数据、金额与交易均为模拟。</p>
        </aside>
      </main>
      <footer className="collection-footer collection-shell">
        <span>PERSONAL LAB / 持续试验，持续留下作品。</span>
        <Link href="/">回到个人作品站 <span aria-hidden="true">↗</span></Link>
      </footer>
    </div>
  );
}

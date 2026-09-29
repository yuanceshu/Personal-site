import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { demos } from "@/content/projects/demos/catalog";
import "@/styles/projects/demos/collection.css";

export const metadata: Metadata = {
  title: "行业 Demo 集",
  description: "按真实任务找到合适的行业 Demo，或前往 AI 工作台创建自己的场景。",
};

function featureCount(demo: (typeof demos)[number]) {
  return demo.featureGroups.reduce((count, group) => count + group.items.length, 0);
}

export default function DemosPage() {
  return (
    <div className="demo-collection">
      <SiteHeader projectLabel="作品 / 行业 Demo 集" />
      <main id="main-content" className="collection-shell">
        <section className="collection-hero" aria-labelledby="collection-title">
          <div className="collection-hero-copy">
            <p className="eyebrow">行业 Demo · {String(demos.length).padStart(2, "0")} 个场景</p>
            <h1 id="collection-title">先找到你的问题，<span>再进入一个答案。</span></h1>
            <p className="collection-lede">
              这些 Demo 把 AI 放进真实任务里。先看每个入口能做什么，再选择一条你想亲自走完的流程。
            </p>
          </div>
          <div className="collection-hero-meta" aria-label="合集概览">
            <div><strong>{String(demos.length).padStart(2, "0")}</strong><span>个可体验场景</span></div>
            <div><strong>AI</strong><span>从理解到行动</span></div>
          </div>
        </section>

        <section className="collection-guide" aria-labelledby="guide-title">
          <div className="collection-guide-copy">
            <span className="collection-guide-icon" aria-hidden="true">⌕</span>
            <div>
              <h2 id="guide-title">不知道从哪里开始？</h2>
              <p>从你正在处理的事情出发：出行、门店、景区、演出、财务或就医。</p>
            </div>
          </div>
          <div className="collection-guide-tags" aria-label="场景分类">
            {Array.from(new Set(demos.flatMap((demo) => demo.tags.slice(0, 1)))).map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        </section>

        <div className="collection-section-head">
          <div>
            <p className="eyebrow">选择一个入口</p>
            <h2>每个 Demo，都先把能力说清楚。</h2>
          </div>
          <p>模拟数据 · 当前持续建设</p>
        </div>

        <section className="collection-grid" aria-label="行业 Demo 入口">
          {demos.map((demo, index) => (
            <article className="demo-card" key={demo.id}>
              <header className="demo-card-header">
                <span className="demo-card-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <div className="demo-card-heading">
                  <p className="demo-card-audience">适合 {demo.audience}</p>
                  <h3>{demo.title}</h3>
                  <p className="demo-card-subtitle">{demo.subtitle}</p>
                  <div className="collection-tags" aria-label={demo.title + " 的类别"}>
                    {demo.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                </div>
                <Link className="demo-card-cta" href={demo.href} aria-label={"进入" + demo.title + "完整体验"}>
                  进入体验 <span aria-hidden="true">↗</span>
                </Link>
              </header>

              <div className="demo-card-body">
                <p className="demo-card-description">{demo.description}</p>
                <div className="demo-card-features">
                  <div className="demo-card-features-title">
                    <h4>你可以体验</h4>
                    <span>{featureCount(demo)} 项能力</span>
                  </div>
                  <div className="demo-card-feature-groups">
                    {demo.featureGroups.map((group) => (
                      <section className="demo-card-feature-group" key={group.label}>
                        <h5>{group.label}</h5>
                        <ul>
                          {group.items.map((item) => <li key={item}><span aria-hidden="true">•</span>{item}</li>)}
                        </ul>
                      </section>
                    ))}
                  </div>
                </div>
              </div>

              <footer className="demo-card-footer">
                <span>模拟数据 · {demo.cover.note}</span>
                <Link href={demo.href}>查看完整流程 <span aria-hidden="true">→</span></Link>
              </footer>
            </article>
          ))}
        </section>

        <section className="workbench-callout" aria-labelledby="workbench-title">
          <div className="workbench-callout-copy">
            <p className="eyebrow">还没有找到合适的场景？</p>
            <h2 id="workbench-title">去 AI 工作台，做一个属于你的 Demo。</h2>
            <p>描述你想改善的一件工作或服务，梳理需求、判断 AI 适用范围，再生成一个可以继续讨论的产品草稿。</p>
          </div>
          <Link className="workbench-link" href="/works/ai-solution-lab">
            打开 AI 工作台 <span aria-hidden="true">↗</span>
          </Link>
        </section>

        <aside className="collection-note">
          <strong>先体验，再判断。</strong>
          <p>每个 Demo 都保留从输入、查询和判断，到需要确认的操作链路。页面中的业务数据、库存、金额和交易均为模拟。</p>
        </aside>
      </main>
      <footer className="collection-footer collection-shell">
        <span>PERSONAL LAB / 持续试验，持续留下作品。</span>
        <Link href="/">回到个人作品站 <span aria-hidden="true">↗</span></Link>
      </footer>
    </div>
  );
}

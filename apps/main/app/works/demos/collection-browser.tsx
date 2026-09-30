"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { demos } from "@/content/projects/demos/catalog";

const allCategory = "全部";

export function CollectionBrowser() {
  const [activeCategory, setActiveCategory] = useState(allCategory);
  const visibleDemos = useMemo(
    () => activeCategory === allCategory ? demos : demos.filter((demo) => demo.collection.category === activeCategory),
    [activeCategory],
  );

  const selectCategory = (category: string) => {
    setActiveCategory(category);
    window.history.replaceState(null, "", category === allCategory ? "#demo-grid" : `#demo-${demos.find((demo) => demo.collection.category === category)?.id ?? "grid"}`);
  };

  return (
    <>
      <nav className="collection-nav" aria-label="Demo 场景导航">
        {[allCategory, ...demos.map((demo) => demo.collection.category)].map((category) => (
          <a
            className={activeCategory === category ? "is-active" : ""}
            href={category === allCategory ? "#demo-grid" : `#demo-${demos.find((demo) => demo.collection.category === category)?.id}`}
            aria-current={activeCategory === category ? "page" : undefined}
            key={category}
            onClick={(event) => { event.preventDefault(); selectCategory(category); }}
          >
            {category}
          </a>
        ))}
      </nav>

      <div className="collection-section-head">
        <div>
          <p className="eyebrow">选一个场景开始</p>
          <h2>一些我遇到过的行业场景 点击体验完整流程</h2>
        </div>
        <p>{activeCategory === allCategory ? "数据均为模拟・持续建设中" : `${activeCategory} · ${visibleDemos.length} 个场景`}</p>
      </div>

      <section id="demo-grid" key={activeCategory} className="collection-grid" aria-label="行业 Demo 入口" aria-live="polite">
        {visibleDemos.map((demo) => {
          const index = demos.findIndex((item) => item.id === demo.id);
          return (
            <article className="demo-card" id={`demo-${demo.id}`} key={demo.id}>
              <Link className="demo-card-link" href={demo.href} aria-label={`进入${demo.title} Demo`}>
                <div className="demo-card-image">
                  <Image src={demo.collection.image} alt={`${demo.title} 场景示意`} fill sizes="(max-width: 800px) 100vw, 50vw" />
                </div>
                <div className="demo-card-content">
                  <p className="demo-card-kicker"><span>{String(index + 1).padStart(2, "0")}</span><span aria-hidden="true">·</span><span className="demo-card-category">{demo.collection.category}</span></p>
                  <h3>{demo.title}</h3>
                  <p className="demo-card-description">{demo.collection.description}</p>
                  <div className="demo-card-features">
                    <p>可体验功能</p>
                    <ul>{demo.collection.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                  </div>
                  <span className="demo-card-cta">进入 Demo <span aria-hidden="true">→</span></span>
                </div>
              </Link>
            </article>
          );
        })}
      </section>
    </>
  );
}

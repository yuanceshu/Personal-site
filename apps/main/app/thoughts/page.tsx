import type { Metadata } from "next";
import "../../styles/thoughts.css";
import { PublicAccountCard } from "@/components/PublicAccountCard";
import { SiteHeader } from "@/components/SiteHeader";
import { publicAccountName, thoughts } from "@/content/thoughts";

export const metadata: Metadata = {
  title: "AI 思记 · 袁策书",
  description:
    "AI 产品经理的一线观察与随笔：学习复盘、效率反思、展会见闻。",
};

function formatDate(iso: string) {
  return iso.replaceAll("-", ".");
}

export default function ThoughtsPage() {
  return (
    <>
      <SiteHeader projectLabel="AI 思记" />
      <main className="thoughts-page">
        <section className="thoughts-hero page-shell" aria-labelledby="thoughts-title">
          <div className="thoughts-hero__topline">
            <span>AI 思记 · SELECTED WRITINGS</span>
            <span>{publicAccountName}</span>
          </div>
          <h1 id="thoughts-title">一线观察与随笔</h1>
          <p className="thoughts-hero__intro">
            写在作品之外。AI 产品经理的一线观察：展会、学习复盘，以及一些没想明白但值得记下的问题。
          </p>
        </section>

        <section className="thoughts-list page-shell" aria-label="精选文章">
          {thoughts.map((thought) => (
            <a
              className="thought-card"
              href={thought.url}
              key={thought.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="thought-card__meta">
                <time dateTime={thought.date}>{formatDate(thought.date)}</time>
                <span className="thought-card__theme">{thought.theme}</span>
              </div>
              <h2>{thought.title}</h2>
              <p className="thought-card__excerpt">{thought.excerpt}</p>
              <span className="thought-card__link">
                阅读原文 <span aria-hidden="true">↗</span>
              </span>
            </a>
          ))}
        </section>

        <section className="thoughts-follow page-shell" aria-labelledby="follow-title">
          <p className="eyebrow">继续同行</p>
          <h2 id="follow-title" className="thoughts-follow__title">
            新文章，先到公众号。
          </h2>
          <p className="thoughts-follow__intro">
            {publicAccountName}是我的公众号。思记里放的是精选，更多即时的学习心得与碎碎念，会先写在那里。
          </p>
          <PublicAccountCard />
        </section>
      </main>
      <footer className="site-footer page-shell">
        <span>PERSONAL LAB</span>
        <span>不追光，只生长。</span>
      </footer>
    </>
  );
}

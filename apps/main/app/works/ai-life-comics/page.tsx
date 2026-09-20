import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "../../../styles/projects/ai-life-comics.css";
import { ComicGallery } from "@/components/works/ai-life-comics/ComicGallery";
import { SiteHeader } from "@/components/SiteHeader";
import { comicStories, comicVersionCount } from "@/content/projects/ai-life-comics";

export const metadata: Metadata = {
  title: "把生活里的害怕，画成可以走进去的故事",
  description:
    "我为 4 岁的小麦子画下的一组生活漫画：把洗鼻子、妈妈出差、等待妈妈等小事，慢慢画成可以走进去的美好故事。",
};

const chapters = [
  ["01", "我为什么开始画", "#method"],
  ["02", "漫画记录", "#gallery"],
  ["03", "我学到的事", "#reflection"],
] as const;

export default function AiLifeComicsPage() {
  return (
    <>
      <SiteHeader projectLabel="作品 / AI 创造" />
      <main className="comics-page">
        <section className="comics-hero page-shell" aria-labelledby="comics-title">
          <div className="comics-hero__topline">
            <span>AI LIFE COMICS · A FAMILY RECORD</span>
            <span>2025—2026</span>
          </div>

          <div className="comics-hero__grid">
            <div className="comics-hero__copy">
              <p className="eyebrow">给小麦子的生活实验</p>
              <h1 id="comics-title">
                把生活里的害怕，
                <span>画成可以走进去的故事</span>
              </h1>
              <p className="comics-hero__intro">
                小麦子今年 4 岁。过去一年，洗鼻子、妈妈出差、妈妈去尿尿、妈妈睡觉，还有猫抓老鼠游戏里的“被抓住”，每一件小事都可能先变成一场大哭。
              </p>
              <p className="comics-hero__intro">
                我们就试着把这些事情画成漫画，让害怕先有一个更美好的样子，再陪她一点点回到生活里。
              </p>
              <div className="comics-hero__role">
                <span>我想留下的</span>
                <p>把日常美好化，也把孩子的感受认真放在里面。</p>
              </div>
            </div>

            <figure className="comics-hero__media">
              <Image
                src="/projects/ai-life-comics/nose/nose-magic.webp"
                alt="小麦子的洗鼻子漫画：小熊拿着魔法喷枪，和小麦子一起走进彩虹般的冒险"
                fill
                priority
                sizes="(max-width: 760px) 100vw, 48vw"
              />
              <figcaption>第一部：把洗鼻子想象成一次鼻子冒险。</figcaption>
            </figure>
          </div>

          <dl className="comics-facts">
            <div><dt>生活场景</dt><dd>6 <span>个</span></dd></div>
            <div><dt>漫画记录</dt><dd>{comicVersionCount} <span>份</span></dd></div>
            <div><dt>主角</dt><dd>4 <span>岁</span></dd></div>
          </dl>

          <div className="comics-hero__actions">
            <a className="primary-link" href="#method">
              先从方法开始 <span aria-hidden="true">↓</span>
            </a>
            <span>一件小事，一点点变得不那么可怕</span>
          </div>
        </section>

        <nav className="comics-nav" aria-label="漫画作品章节">
          <div className="page-shell">
            {chapters.map(([index, label, href]) => (
              <a href={href} key={href}>
                <span>{index}</span>
                {label}
              </a>
            ))}
          </div>
        </nav>

        <section className="comics-method section-pad" id="method" aria-labelledby="method-title">
          <div className="page-shell">
            <div className="section-index">01 / 我为什么开始画</div>
            <div className="editorial-grid">
              <div>
                <p className="eyebrow">MAKE ROOM FOR IMAGINATION</p>
                <h2 id="method-title" className="section-title">
                  我没有急着告诉她“不用怕”，而是先给害怕画一个新世界。
                </h2>
              </div>
              <div className="prose-large">
                <p>
                  小孩子面对的很多害怕，并不是一句“这没什么”就能过去的。对她来说，水进鼻子、妈妈暂时离开，都是身体和想象一起发出的真实警报。
                </p>
                <p>
                  漫画刚好提供了一个温柔的中间地带：我们可以把事情画得足够具体，也可以把它变成一场她愿意走进去的冒险。
                </p>
              </div>
            </div>

            <ol className="comics-method__steps">
              <li>
                <span>01</span>
                <div><h3>先承认害怕</h3><p>不急着纠正情绪，先让“我不喜欢”“我会想妈妈”有一个被看见的位置。</p></div>
              </li>
              <li>
                <span>02</span>
                <div><h3>让想象接手</h3><p>水滴可以有小水站，鼻子可以有小船，等待也可以是一项有终点的小任务。</p></div>
              </li>
              <li>
                <span>03</span>
                <div><h3>再回到生活</h3><p>故事不是要替她完成现实，而是让下一次真的发生时，多一个熟悉的解释和一条回来的路。</p></div>
              </li>
            </ol>

            <div className="comics-method__quote">
              <p>“生活中的每一件事情，真的都可以很美好。”</p>
              <span>我想通过这些漫画，慢慢把这件事传达给她。</span>
            </div>
          </div>
        </section>

        <section className="comics-gallery section-pad page-shell" id="gallery" aria-labelledby="gallery-title">
          <div className="section-index">02 / 漫画记录</div>
          <div className="editorial-grid">
            <div>
              <p className="eyebrow">SIX SMALL THINGS</p>
              <h2 id="gallery-title" className="section-title">
                每一部漫画，都是一次陪她走过日常的记录。
              </h2>
            </div>
            <p className="prose-large">
              有些是为了让害怕慢慢变轻，有些只是为了把开心留久一点。下面保留了不同版本，因为每一次重画，都是我们和生活重新商量一次。
            </p>
          </div>

          <ComicGallery stories={comicStories} />
        </section>

        <section className="comics-reflection section-pad" id="reflection" aria-labelledby="reflection-title">
          <div className="page-shell">
            <div className="section-index">03 / 我学到的事</div>
            <div className="editorial-grid">
              <div>
                <p className="eyebrow">WHAT THE STORIES TAUGHT ME</p>
                <h2 id="reflection-title" className="section-title">
                  漫画没有替她解决生活，但让我们多了一种一起面对生活的方式。
                </h2>
              </div>
              <div className="prose-large">
                <p>
                  后来我越来越相信，美好化不是假装困难不存在，而是帮孩子在困难旁边看见另一种可能：妈妈会回来，身体需要被照顾，被抓住之后还可以再玩，快乐也值得被记住。
                </p>
                <p>
                  这也是我想留下这个作品的原因——AI 在这里不是一个炫技的工具，而是把生活里的小小感受，变成我们可以一起阅读、一起想象、一起实践的东西。
                </p>
              </div>
            </div>

            <div className="comics-reflection__cards">
              <article>
                <span>给孩子</span>
                <h3>一个可以相信的故事</h3>
                <p>把未知画得具体一点，让她知道事情会怎么开始，也会怎么回来。</p>
              </article>
              <article>
                <span>给大人</span>
                <h3>一次重新理解的机会</h3>
                <p>看见哭闹背后的担心，不只盯着“这件事什么时候才能过去”。</p>
              </article>
              <article>
                <span>给生活</span>
                <h3>一些值得保存的快乐</h3>
                <p>不只有难题需要被解决，开心发生过，也值得被画下来。</p>
              </article>
            </div>

            <div className="comics-closing narrow-shell">
              <p className="final-reflection">
                如果你也在陪一个孩子长大，也许你不需要立刻找到标准答案。先听听她在怕什么，再和她一起，画一条愿意走回去的小路。
              </p>
              <p className="comics-disclaimer">这是小麦子一家的生活记录，不是育儿处方。每个孩子的节奏都不一样。</p>
              <div className="reflection-actions">
                <Link className="back-link" href="/">
                  <span aria-hidden="true">←</span> 回到首页，继续看其他作品
                </Link>
                <a className="back-link back-link--quiet" href="#gallery">
                  再看一遍漫画 <span aria-hidden="true">↑</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer page-shell"><span>PERSONAL LAB</span><span>把生活画得温柔一点。</span></footer>
    </>
  );
}

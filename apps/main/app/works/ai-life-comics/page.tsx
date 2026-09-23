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

const scenes = [
  ["01", "洗鼻子", "#nose-comic"],
  ["02", "妈妈出差", "#away-comic"],
  ["03", "妈妈暂别", "#pee-comic"],
  ["04", "妈妈睡觉", "#sleep-comic"],
  ["05", "游戏输赢", "#cat-mouse-comic"],
  ["06", "羽毛球", "#badminton-comic"],
] as const;

export default function AiLifeComicsPage() {
  return (
    <>
      <SiteHeader projectLabel="作品 / AI 实验" />
      <main className="comics-page">
        <section className="comics-hero page-shell" aria-labelledby="comics-title">
          <div className="comics-hero__topline">
            <span>小麦子的生活小漫画</span>
            <span>2025—2026</span>
          </div>

          <div className="comics-hero__grid">
            <div className="comics-hero__copy">
              <p className="eyebrow">一本给小麦子的家庭小画册</p>
              <h1 id="comics-title">
                把生活里的胆怯，
                <span>画成可以走进去的小故事</span>
              </h1>
              <p className="comics-hero__intro">
                小麦子今年四岁。洗鼻子、妈妈出差、等着妈妈回家……我们试着把这些细碎的小事画成漫画，先给害怕找一个软乎乎的模样，再陪她慢慢走回生活里。
              </p>
              <div className="comics-hero__actions">
                <a className="primary-link" href="#nose-comic">
                  翻开第一篇 <span aria-hidden="true">↓</span>
                </a>
                <span>把日常揉得软一点，也把孩子的心事轻轻放进去。</span>
              </div>
            </div>

            <figure className="comics-hero__media">
              <Image
                src="/projects/ai-life-comics/nose/nose-magic.webp"
                alt="小麦子的洗鼻子漫画：小熊拿着魔法喷枪，和小麦子一起走进彩虹般的冒险"
                width={2752}
                height={1536}
                priority
                sizes="(max-width: 900px) calc(100vw - 2rem), 56vw"
              />
              <figcaption><span>01</span> 把洗鼻子，想象成一场小小的鼻子冒险。</figcaption>
            </figure>
          </div>

          <dl className="comics-hero__folio" aria-label="画册信息">
            <div><dt>生活片段</dt><dd>6 个</dd></div>
            <div><dt>漫画记录</dt><dd>{comicVersionCount} 幅</dd></div>
            <div><dt>画册主角</dt><dd>小麦子 · 四岁</dd></div>
          </dl>
        </section>

        <nav className="comics-scene-nav" aria-label="六个生活场景">
          <div className="comics-scene-nav__track page-shell">
            {scenes.map(([index, label, href]) => (
              <a href={href} key={href}>
                <span>{index}</span>
                <strong>{label}</strong>
              </a>
            ))}
          </div>
        </nav>

        <section className="comics-gallery section-pad page-shell" id="gallery" aria-labelledby="gallery-title">
          <div className="section-index">六件日常小事 · 十二页成长记录</div>
          <div className="editorial-grid">
            <div>
              <p className="eyebrow">翻开这本生活小画册</p>
              <h2 id="gallery-title" className="section-title">
                每一页漫画，都是陪她走过日常的温柔注脚。
              </h2>
            </div>
            <p className="prose-large">
              有些是为了让胆怯慢慢轻下来，有些只是想把开心留得久一点。页里留着不同的版本，因为每一次重画，都是我们和生活慢慢商量的样子。
            </p>
          </div>

          <ComicGallery stories={comicStories} />
        </section>

        <section className="comics-method section-pad" id="method" aria-labelledby="method-title">
          <div className="page-shell">
            <div className="section-index">画册边注 · 我为什么开始画</div>
            <div className="editorial-grid">
              <div>
                <p className="eyebrow">给胆怯，留一点想象的位置</p>
                <h2 id="method-title" className="section-title">
                  我没有急着说“别怕”，而是先给胆怯画了一个小小的新世界。
                </h2>
              </div>
              <div className="prose-large">
                <p>
                  对小朋友来说，水流进鼻子、妈妈暂时走开，都是身体和小心思一起发出的真实警报。漫画刚好搭了一个温柔的中间地带：事情足够真切，又能变成一场她愿意一步步走进去的冒险。
                </p>
              </div>
            </div>

            <ol className="comics-method__steps">
              <li><span>01</span><div><h3>先接住那份怕</h3><p>让“我不喜欢”和“我会想妈妈”，先被好好看见。</p></div></li>
              <li><span>02</span><div><h3>再让想象来接手</h3><p>给小水滴一座小车站，给等待一个能走到的终点。</p></div></li>
              <li><span>03</span><div><h3>最后走回生活里</h3><p>故事不替她摆平现实，只是多给她一条熟悉的小路。</p></div></li>
            </ol>

            <blockquote className="comics-method__quote">
              <p>“生活里的每一件小事，原来都可以藏着微光。”</p>
              <footer>我想借着这些漫画，慢慢把这句话讲给她听。</footer>
            </blockquote>
          </div>
        </section>

        <section className="comics-reflection section-pad" id="reflection" aria-labelledby="reflection-title">
          <div className="page-shell">
            <div className="section-index">合上画册 · 我学到的事</div>
            <div className="editorial-grid">
              <div>
                <p className="eyebrow">故事讲完了，我们还是要走回生活里</p>
                <h2 id="reflection-title" className="section-title">
                  漫画没能替她摆平生活的难，却多了一种并肩面对的温柔方式。
                </h2>
              </div>
              <div className="prose-large">
                <p>
                  后来我越来越相信，把日子变柔软，不是假装困难不存在，而是帮孩子在难处旁边，看见另一种可能：妈妈会回来，身体要好好照顾，被抓住了还能接着玩，快乐也值得被认真记住。
                </p>
                <p>
                  这也是我想留住这份作品的原因——AI在这里不是炫技的工具，而是把生活里细碎的小感受，变成我们能一起读、一起想、一起慢慢做的事。
                </p>
              </div>
            </div>

            <div className="comics-reflection__cards">
              <article>
                <span>给小朋友</span>
                <h3>一个可以相信的小故事</h3>
                <p>把未知画得具体一点，让她知道事情会怎么开始，也会怎么回来。</p>
              </article>
              <article>
                <span>给大人</span>
                <h3>一次重新读懂的机会</h3>
                <p>看见哭闹背后的担心，不只急着等“这件事什么时候才过去”。</p>
              </article>
              <article>
                <span>给生活</span>
                <h3>一些值得藏起来的快乐</h3>
                <p>不只有难题需要被解决，开心发生过，也值得被好好画下来。</p>
              </article>
            </div>

            <div className="comics-closing narrow-shell">
              <p className="final-reflection">
                如果你也在陪着一个孩子长大，或许不必急着找标准答案。先听听她在怕什么，再和她一起，画出一条愿意慢慢走回去的小路。
              </p>
              <p className="comics-disclaimer">这是小麦子一家的生活笔记，不是什么育儿处方。每个孩子的节奏，本来就不一样。</p>
              <div className="reflection-actions">
                <Link className="back-link" href="/">
                  <span aria-hidden="true">←</span> 回到首页，看其他作品
                </Link>
                <a className="back-link back-link--quiet" href="#gallery">
                  再翻一遍漫画 <span aria-hidden="true">↑</span>
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

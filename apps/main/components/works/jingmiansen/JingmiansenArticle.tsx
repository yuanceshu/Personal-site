import Image from "next/image";
import Link from "next/link";
import type { JingmiansenArticle as JingmiansenArticleData } from "@/content/projects/jingmiansen";
import { jingmiansenWorks } from "@/content/projects/jingmiansen";
import styles from "@/styles/projects/jingmiansen.module.css";

type JingmiansenArticleProps = {
  article: JingmiansenArticleData;
  currentHref: (typeof jingmiansenWorks)[number]["href"];
};

export function JingmiansenArticle({
  article,
  currentHref,
}: JingmiansenArticleProps) {
  const otherWorks = jingmiansenWorks.filter(
    (work) => work.href !== currentHref,
  );

  return (
    <div className={`${styles.worldPage} ${styles[article.theme]}`}>
      <a className={styles.skipLink} href="#article-content">
        跳到正文
      </a>

      <header className={styles.worldHeader}>
        <Link
          className={styles.worldBack}
          href="/works/jingmiansen"
          aria-label="返回静眠森入口"
        >
          <span aria-hidden="true">←</span>
          静眠森
        </Link>
        <Link className={styles.glassLink} href="/">
          返回主站
        </Link>
      </header>

      <main id="article-content">
        <section className={styles.articleHero} aria-labelledby="article-title">
          <picture className={styles.articleHeroScene}>
            <source srcSet={article.scene.avif} type="image/avif" />
            <img
              src={article.scene.webp}
              alt=""
              style={{ objectPosition: article.scene.position }}
            />
          </picture>
          <div className={styles.articleHeroShade} aria-hidden="true" />

          {article.portrait ? (
            <Image
              className={styles.articlePortrait}
              src={article.portrait.src}
              alt={article.portrait.alt}
              width={article.portrait.width}
              height={article.portrait.height}
              sizes="(max-width: 760px) 54vw, 34vw"
              priority
            />
          ) : null}

          <div className={styles.articleHeroInner}>
            <p className={styles.articleCategory}>{article.category}</p>
            <h1 id="article-title">{article.title}</h1>
            <p className={styles.articleSubtitle}>{article.subtitle}</p>
            <p className={styles.articleIntroduction}>{article.introduction}</p>

            <dl className={styles.articleFacts}>
              {article.facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>

            <nav className={styles.articleOutline} aria-label="本页章节">
              {article.sections.map((section, index) => (
                <a href={`#section-${index + 1}`} key={section.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {section.title}
                </a>
              ))}
            </nav>
          </div>
        </section>

        <article className={styles.articleBody}>
          {article.sections.map((section, index) => (
            <section
              className={styles.articleSection}
              id={`section-${index + 1}`}
              key={section.title}
              aria-labelledby={`section-title-${index + 1}`}
            >
              <p className={styles.sectionEyebrow}>{section.eyebrow}</p>
              <h2 id={`section-title-${index + 1}`}>{section.title}</h2>
              <div className={styles.sectionProse}>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              {section.quote ? (
                <blockquote>{section.quote}</blockquote>
              ) : null}

              {section.entries ? (
                <div className={styles.entryList}>
                  {section.entries.map((entry) => (
                    <section key={entry.title}>
                      <h3>{entry.title}</h3>
                      <p>{entry.description}</p>
                    </section>
                  ))}
                </div>
              ) : null}
            </section>
          ))}

          {article.disclosure ? (
            <aside className={styles.disclosure} aria-label={article.disclosure.label}>
              <p>{article.disclosure.label}</p>
              <div>{article.disclosure.text}</div>
            </aside>
          ) : null}
        </article>

        <section className={styles.continueSection} aria-labelledby="continue-title">
          <div>
            <p className={styles.sectionEyebrow}>继续在静眠森中行走</p>
            <h2 id="continue-title">另外两处入口</h2>
          </div>
          <nav aria-label="其他静眠森内容">
            {otherWorks.map((work) => (
              <Link href={work.href} key={work.href}>
                <span>{work.category}</span>
                <strong>{work.title}</strong>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </nav>
        </section>
      </main>

      <footer className={styles.worldFooter}>
        <Link href="/works/jingmiansen">返回静眠森</Link>
        <span>梦醒之前，故事在此停留。</span>
      </footer>
    </div>
  );
}

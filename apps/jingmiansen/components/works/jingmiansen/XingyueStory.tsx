import type { CSSProperties } from "react";
import Link from "next/link";
import { SiteMark } from "@/components/brand/SiteMark";
import {
  storyHeroVisual,
  type StoryBeat,
  type StoryVisual,
  xingyueStory,
} from "@/content/projects/jingmiansen-xingyue";
import { XingyueStoryNavigator } from "./XingyueStoryNavigator";
import styles from "@/styles/projects/jingmiansen-xingyue.module.css";

type VisualProperties = CSSProperties & {
  "--desktop-ratio": string;
  "--mobile-ratio": string;
  "--desktop-focus": string;
  "--mobile-focus": string;
};

function StoryPicture({
  visual,
  priority = false,
  className,
}: {
  visual: StoryVisual;
  priority?: boolean;
  className?: string;
}) {
  const visualStyle: VisualProperties = {
    "--desktop-ratio": `${visual.desktop.width} / ${visual.desktop.height}`,
    "--mobile-ratio": `${visual.mobile.width} / ${visual.mobile.height}`,
    "--desktop-focus": visual.desktopFocus,
    "--mobile-focus": visual.mobileFocus,
  };

  return (
    <picture className={className} style={visualStyle}>
      <source
        media="(max-width: 760px)"
        srcSet={visual.mobile.avif}
        type="image/avif"
      />
      <source
        media="(max-width: 760px)"
        srcSet={visual.mobile.webp}
        type="image/webp"
      />
      <source srcSet={visual.desktop.avif} type="image/avif" />
      <img
        src={visual.desktop.webp}
        alt={visual.alt}
        width={visual.desktop.width}
        height={visual.desktop.height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
      />
    </picture>
  );
}

function StoryBeatView({
  beat,
  paragraphs,
}: {
  beat: StoryBeat;
  paragraphs: readonly string[];
}) {
  const copy = paragraphs.slice(beat.paragraphStart, beat.paragraphEnd);
  const hasVisual = beat.visual !== undefined;
  const copyCharacterCount = copy.reduce(
    (total, paragraph) => total + paragraph.length,
    0,
  );
  const copySize =
    copy.length > 2 || copyCharacterCount > 420
      ? "long"
      : copyCharacterCount < 100
        ? "short"
        : "regular";

  return (
    <section
      className={[
        styles.storyBeat,
        hasVisual ? styles.visualBeat : styles.proseBeat,
        styles[`position${beat.textPosition[0].toUpperCase() + beat.textPosition.slice(1)}`],
      ].join(" ")}
      data-beat-id={beat.id}
      data-mode={beat.mode}
      data-layout={beat.visualLayout}
      data-tone={beat.tone}
      data-copy-size={copySize}
      data-scene-break={beat.sceneBreakBefore}
      data-dual-stage={
        beat.mode === "dual-memory" || beat.mode === "convergence"
          ? beat.mode
          : undefined
      }
    >
      {(beat.mode === "dual-memory" || beat.mode === "visual-pair") &&
      beat.visual &&
      beat.secondaryVisual ? (
        <div className={styles.dualMedia} aria-hidden="true">
          <StoryPicture
            visual={beat.visual}
            className={
              beat.mode === "dual-memory" ? styles.memorySilver : undefined
            }
          />
          <StoryPicture
            visual={beat.secondaryVisual}
            className={
              beat.mode === "dual-memory" ? styles.memoryGold : undefined
            }
          />
        </div>
      ) : beat.visual ? (
        <StoryPicture visual={beat.visual} className={styles.storyMedia} />
      ) : null}

      <div className={styles.storyCopy}>
        {beat.mode === "dual-memory" ? (
          <p className={styles.perspectiveLabel}>同一场重逢 · 希斯达娅所见</p>
        ) : null}
        {beat.mode === "convergence" ? (
          <p className={styles.perspectiveLabel}>两束光，终于汇合</p>
        ) : null}
        {copy.map((paragraph, index) => (
          <p key={`${beat.id}-${index}`}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

export function XingyueStory() {
  const chapterLinks = xingyueStory.chapters.map(({ id, title }) => ({
    id,
    title,
  }));

  return (
    <div className={styles.storyPage} data-story-root>
      <a className={styles.skipLink} href="#story-article">
        跳到正文
      </a>

      <header className={styles.storyHeader}>
        <Link className={styles.storyHeaderBrand} href="/">
          <span aria-hidden="true">←</span>
          <SiteMark className={styles.storyHeaderMark} tone="light" />
          <span>静眠森</span>
        </Link>
        <Link href="/rainy-night-cafe">雨夜啡庭</Link>
      </header>

      <main>
        <section
          className={styles.storyHero}
          id="story-prologue"
          aria-labelledby="story-title"
        >
          <StoryPicture
            visual={storyHeroVisual}
            priority
            className={styles.storyHeroMedia}
          />
          <div className={styles.storyHeroShade} aria-hidden="true" />
          <div className={styles.storyHeroInner}>
            <p className={styles.storyEyebrow}>静眠森 · 沉浸式图文故事</p>
            <h1 id="story-title">{xingyueStory.title}</h1>
            <p className={styles.storyLead}>
              一束曾被视作灾难的星辉，一颗用温柔包住黑暗的星穗。她们在雨夜重逢，也在彼此的光里，重新认出了自己。
            </p>
            <p className={styles.storyMeta}>
              三章 · 133 段正文 · {xingyueStory.readingTime}
            </p>
            <nav className={styles.heroChapterLinks} aria-label="故事目录">
              {xingyueStory.chapters.map((chapter, index) => (
                <a href={`#${chapter.id}`} key={chapter.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{chapter.title}</strong>
                  <small>{chapter.subtitle}</small>
                </a>
              ))}
            </nav>
            <a className={styles.startReading} href="#xinghui-luo-yuye">
              开始阅读
              <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>

        <XingyueStoryNavigator chapters={chapterLinks} />

        <article
          className={styles.storyArticle}
          id="story-article"
          data-story-article
        >
          {xingyueStory.chapters.map((chapter, chapterIndex) => (
            <section
              className={styles.storyChapter}
              id={chapter.id}
              key={chapter.id}
              data-story-chapter
              aria-labelledby={`${chapter.id}-title`}
            >
              <header className={styles.chapterHeader}>
                <p>第 {String(chapterIndex + 1).padStart(2, "0")} 章</p>
                <h2 id={`${chapter.id}-title`}>{chapter.title}</h2>
                <span>{chapter.subtitle}</span>
              </header>

              {chapter.beats.map((beat) => (
                <StoryBeatView
                  beat={beat}
                  paragraphs={chapter.paragraphs}
                  key={beat.id}
                />
              ))}
            </section>
          ))}
        </article>

        <section className={styles.storyComplete} aria-labelledby="complete-title">
          <p className={styles.storyEyebrow}>阅读完成</p>
          <h2 id="complete-title">星月相依，雨仍在下。</h2>
          <p>
            故事到这里结束。你可以回到任一章节，也可以继续走向雨夜或森林里的其他入口。
          </p>
          <nav aria-label="回看章节">
            {xingyueStory.chapters.map((chapter, index) => (
              <a href={`#${chapter.id}`} key={chapter.id}>
                {String(index + 1).padStart(2, "0")} · {chapter.title}
              </a>
            ))}
          </nav>
          <div className={styles.storyReturnLinks}>
            <Link href="/">返回静眠森</Link>
            <Link href="/rainy-night-cafe">
              前往雨夜啡庭
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.storyFooter}>
        <span className={styles.storyFooterBrand}>
          <SiteMark className={styles.storyFooterMark} tone="light" />
          <span>《星月相护》</span>
        </span>
        <span>三章 · 约 35 分钟</span>
      </footer>
    </div>
  );
}

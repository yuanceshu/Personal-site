"use client";

import { useEffect, useState } from "react";
import styles from "@/styles/projects/jingmiansen-xingyue.module.css";

type StoryChapterLink = {
  id: string;
  title: string;
};

export function XingyueStoryNavigator({
  chapters,
}: {
  chapters: readonly StoryChapterLink[];
}) {
  const [activeChapter, setActiveChapter] = useState(chapters[0]?.title ?? "");
  const [progress, setProgress] = useState(0);
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-story-root]");
    const article = document.querySelector<HTMLElement>("[data-story-article]");
    const hero = document.getElementById("story-prologue");
    const chapterElements = chapters
      .map((chapter) => document.getElementById(chapter.id))
      .filter((element): element is HTMLElement => element !== null);

    if (!root || !article || !hero || chapterElements.length === 0) {
      return;
    }

    root.dataset.enhanced = "true";
    let frame = 0;

    const update = () => {
      frame = 0;
      const readingStart = article.offsetTop;
      const readingEnd = readingStart + article.offsetHeight - window.innerHeight;
      const value =
        readingEnd <= readingStart
          ? 1
          : (window.scrollY - readingStart) / (readingEnd - readingStart);
      setProgress(Math.round(Math.min(1, Math.max(0, value)) * 100));
      setCondensed(hero.getBoundingClientRect().bottom <= 96);

      const marker = window.innerHeight * 0.3;
      let current = chapterElements[0];
      for (const chapter of chapterElements) {
        if (chapter.getBoundingClientRect().top <= marker) {
          current = chapter;
        }
      }
      const title = chapters.find((chapter) => chapter.id === current.id)?.title;
      if (title) setActiveChapter(title);
    };

    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    const dualObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          (entry.target as HTMLElement).dataset.active = entry.isIntersecting
            ? "true"
            : "false";
        });
      },
      { rootMargin: "-22% 0px -24%", threshold: 0.12 },
    );

    root
      .querySelectorAll<HTMLElement>("[data-dual-stage]")
      .forEach((stage) => dualObserver.observe(stage));

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      dualObserver.disconnect();
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      delete root.dataset.enhanced;
    };
  }, [chapters]);

  return (
    <div
      className={styles.storyNavigator}
      data-condensed={condensed ? "true" : "false"}
    >
      <div
        className={styles.storyProgress}
        role="progressbar"
        aria-label="阅读进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
      <div className={styles.storyNavigatorInner}>
        <LinkLabel title={activeChapter} progress={progress} />
        <details className={styles.chapterMenu}>
          <summary>章节</summary>
          <nav aria-label="故事章节">
            {chapters.map((chapter, index) => (
              <a
                href={`#${chapter.id}`}
                key={chapter.id}
                onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                }}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {chapter.title}
              </a>
            ))}
          </nav>
        </details>
      </div>
    </div>
  );
}

function LinkLabel({ title, progress }: { title: string; progress: number }) {
  return (
    <p>
      <span>{title}</span>
      <span aria-hidden="true">{progress}%</span>
    </p>
  );
}

"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComicStory, ComicVersion } from "@/content/projects/ai-life-comics";

type ComicGalleryProps = {
  stories: readonly ComicStory[];
};

type ComicPage = {
  storyTitle: string;
  version: ComicVersion;
};

function getOrientation(version: ComicVersion) {
  const ratio = version.width / version.height;
  if (ratio > 1.18) return "landscape";
  if (ratio < 0.84) return "portrait";
  return "square";
}

export function ComicGallery({ stories }: ComicGalleryProps) {
  const [activeVersions, setActiveVersions] = useState<Record<string, string>>({});
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [fitMode, setFitMode] = useState<"page" | "width">("page");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const comicPages = useMemo<readonly ComicPage[]>(
    () => stories.flatMap((story) => story.versions.map((version) => ({ storyTitle: story.title, version }))),
    [stories],
  );

  const selectedIndex = comicPages.findIndex(({ version }) => version.id === selectedVersionId);
  const selectedPage = selectedIndex >= 0 ? comicPages[selectedIndex] : null;
  const isLightboxOpen = selectedPage !== null;

  const closeLightbox = useCallback(() => {
    setSelectedVersionId(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  }, []);

  const moveLightbox = useCallback((direction: -1 | 1) => {
    setSelectedVersionId((currentId) => {
      const currentIndex = comicPages.findIndex(({ version }) => version.id === currentId);
      const nextPage = comicPages[currentIndex + direction];
      return nextPage?.version.id ?? currentId;
    });
    setFitMode("page");
  }, [comicPages]);

  const openLightbox = (versionId: string, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setFitMode("page");
    setSelectedVersionId(versionId);
  };

  useEffect(() => {
    if (!isLightboxOpen) return;

    const pageElements = Array.from(
      document.querySelectorAll<HTMLElement>(".site-header, .comics-page, .site-footer"),
    );
    const inertState = pageElements.map((element) => element.inert);
    const originalOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    pageElements.forEach((element) => { element.inert = true; });
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveLightbox(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveLightbox(1);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])"),
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      pageElements.forEach((element, index) => { element.inert = inertState[index]; });
    };
  }, [closeLightbox, isLightboxOpen, moveLightbox]);

  return (
    <>
      <div className="comic-stories">
        {stories.map((story, storyIndex) => {
          const activeVersion = story.versions.find((version) => version.id === activeVersions[story.id]) ?? story.versions[0];
          const activeIndex = story.versions.findIndex((version) => version.id === activeVersion.id);
          const orientation = getOrientation(activeVersion);

          return (
            <article className="comic-story" key={story.id} id={`${story.id}-comic`}>
              <header className="comic-story__header">
                <span className="comic-story__number">{String(storyIndex + 1).padStart(2, "0")}</span>
                <div>
                  <p className="comic-story__kicker">{story.kicker}</p>
                  <h3>{story.title}</h3>
                  <p className="comic-story__description">{story.description}</p>
                </div>
              </header>

              <div className={`comic-reader comic-reader--${orientation}`}>
                <button
                  className="comic-reader__stage"
                  type="button"
                  onClick={(event) => openLightbox(activeVersion.id, event.currentTarget)}
                  aria-label={`打开《${story.title}》的${activeVersion.title}大图`}
                >
                  <Image
                    src={activeVersion.image}
                    alt={activeVersion.alt}
                    width={activeVersion.width}
                    height={activeVersion.height}
                    sizes="(max-width: 720px) calc(100vw - 2rem), (max-width: 1200px) calc(100vw - 6rem), 68rem"
                  />
                  <span className="comic-reader__open" aria-hidden="true">阅读大图 <b>↗</b></span>
                </button>

                <div className="comic-reader__caption" aria-live="polite">
                  <div>
                    <span>第{String(activeIndex + 1).padStart(2, "0")}版</span>
                    <strong>{activeVersion.title}</strong>
                  </div>
                  <p>{activeVersion.caption}</p>
                </div>

                {story.versions.length > 1 && (
                  <div className="comic-reader__versions" aria-label={`《${story.title}》的其他版本`}>
                    {story.versions.map((version, versionIndex) => (
                      <button
                        className={version.id === activeVersion.id ? "is-active" : undefined}
                        key={version.id}
                        type="button"
                        onClick={() => setActiveVersions((current) => ({ ...current, [story.id]: version.id }))}
                        aria-pressed={version.id === activeVersion.id}
                        aria-label={`查看第 ${versionIndex + 1} 版：${version.title}`}
                      >
                        <Image
                          src={version.image}
                          alt=""
                          width={version.width}
                          height={version.height}
                          sizes="9rem"
                        />
                        <span>{String(versionIndex + 1).padStart(2, "0")}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <p className="comic-story__note"><span>页边记</span>{story.note}</p>
            </article>
          );
        })}
      </div>

      {selectedPage && typeof document !== "undefined" && createPortal(
        <div
          className="comic-lightbox"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeLightbox();
          }}
        >
          <div
            className="comic-lightbox__inner"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="comic-lightbox-title"
            aria-describedby="comic-lightbox-caption"
          >
            <div className="comic-lightbox__bar">
              <div>
                <p>{selectedPage.storyTitle}</p>
                <h2 id="comic-lightbox-title">{selectedPage.version.title}</h2>
              </div>
              <button ref={closeButtonRef} className="comic-lightbox__close" type="button" onClick={closeLightbox}>
                关闭 <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className={`comic-lightbox__canvas comic-lightbox__canvas--${fitMode}`}>
              <Image
                className="comic-lightbox__image"
                src={selectedPage.version.image}
                alt={selectedPage.version.alt}
                width={selectedPage.version.width}
                height={selectedPage.version.height}
                sizes={fitMode === "width" ? "min(96vw, 88rem)" : "min(92vw, 76rem)"}
              />
            </div>

            <div className="comic-lightbox__footer">
              <p id="comic-lightbox-caption">{selectedPage.version.caption}</p>
              <div className="comic-lightbox__controls">
                <button type="button" onClick={() => moveLightbox(-1)} disabled={selectedIndex === 0}>
                  <span aria-hidden="true">←</span> 上一张
                </button>
                <span>{selectedIndex + 1} / {comicPages.length}</span>
                <button
                  className="comic-lightbox__fit"
                  type="button"
                  onClick={() => setFitMode((current) => current === "page" ? "width" : "page")}
                >
                  {fitMode === "page" ? "按宽阅读" : "查看整页"}
                </button>
                <button type="button" onClick={() => moveLightbox(1)} disabled={selectedIndex === comicPages.length - 1}>
                  下一张 <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

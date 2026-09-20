"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ComicStory, ComicVersion } from "@/content/projects/ai-life-comics";

type ComicGalleryProps = {
  stories: readonly ComicStory[];
};

export function ComicGallery({ stories }: ComicGalleryProps) {
  const [selectedVersion, setSelectedVersion] = useState<ComicVersion | null>(null);

  useEffect(() => {
    if (!selectedVersion) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedVersion(null);
    };

    document.addEventListener("keydown", closeOnEscape);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedVersion]);

  return (
    <>
      <div className="comic-stories">
        {stories.map((story, storyIndex) => (
          <article className="comic-story" key={story.id} id={`${story.id}-comic`}>
            <header className="comic-story__header">
              <span className="comic-story__number">0{storyIndex + 1}</span>
              <div>
                <p className="comic-story__kicker">{story.kicker}</p>
                <h3>{story.title}</h3>
                <p className="comic-story__description">{story.description}</p>
              </div>
            </header>

            <div className={`comic-version-grid comic-version-grid--${story.versions.length}`}>
              {story.versions.map((version, versionIndex) => (
                <figure className="comic-version" key={version.id}>
                  <button
                    className="comic-version__button"
                    type="button"
                    onClick={() => setSelectedVersion(version)}
                    aria-label={`打开《${story.title}》的${version.title}大图`}
                  >
                    <Image
                      src={version.image}
                      alt={version.alt}
                      width={version.width}
                      height={version.height}
                      sizes={version.width === version.height ? "(max-width: 720px) 100vw, 38vw" : "(max-width: 720px) 100vw, 50vw"}
                    />
                    <span className="comic-version__hint" aria-hidden="true">打开大图 ↗</span>
                  </button>
                  <figcaption>
                    <span>版本 {String(versionIndex + 1).padStart(2, "0")} · {version.title}</span>
                    <small>{version.caption}</small>
                  </figcaption>
                </figure>
              ))}
            </div>

            <p className="comic-story__note">{story.note}</p>
          </article>
        ))}
      </div>

      {selectedVersion && (
        <div
          className="comic-lightbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby="comic-lightbox-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedVersion(null);
          }}
        >
          <div className="comic-lightbox__inner">
            <div className="comic-lightbox__bar">
              <div>
                <p className="eyebrow">漫画大图</p>
                <h2 id="comic-lightbox-title">{selectedVersion.title}</h2>
              </div>
              <button className="comic-lightbox__close" type="button" onClick={() => setSelectedVersion(null)}>
                关闭 <span aria-hidden="true">×</span>
              </button>
            </div>
            <Image
              className="comic-lightbox__image"
              src={selectedVersion.image}
              alt={selectedVersion.alt}
              width={selectedVersion.width}
              height={selectedVersion.height}
              sizes="min(92vw, 72rem)"
            />
            <p className="comic-lightbox__caption">{selectedVersion.caption}</p>
          </div>
        </div>
      )}
    </>
  );
}

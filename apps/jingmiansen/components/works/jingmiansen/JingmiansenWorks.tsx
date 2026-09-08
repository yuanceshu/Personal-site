"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { JingmiansenTheme } from "@/content/projects/jingmiansen";
import { jingmiansenWorks } from "@/content/projects/jingmiansen";
import {
  type JingmiansenCharacterId,
  workChatByHref,
} from "@/content/projects/jingmiansen-dialogues";
import {
  WorkDialogueModal,
  WorkDialogueTrigger,
} from "@/components/works/jingmiansen/CharacterDialogue";
import styles from "@/styles/projects/jingmiansen.module.css";

const workChats = Object.values(workChatByHref);

export function JingmiansenWorks() {
  const [activeTheme, setActiveTheme] =
    useState<JingmiansenTheme>("xingyue");
  const [activeChat, setActiveChat] =
    useState<JingmiansenCharacterId | null>(null);
  const [isDialogueClosing, setIsDialogueClosing] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const activeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function openConversation(
    characterId: JingmiansenCharacterId,
    trigger: HTMLButtonElement,
  ) {
    const dialog = dialogRef.current;
    if (!dialog) return;

    activeTriggerRef.current = trigger;
    setActiveChat(characterId);
    setIsDialogueClosing(false);
    if (!dialog.open) dialog.showModal();
  }

  function closeConversation() {
    const dialog = dialogRef.current;
    if (!dialog?.open || isDialogueClosing) return;

    setIsDialogueClosing(true);
    const shouldReduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    closeTimerRef.current = window.setTimeout(
      () => {
        dialog.close();
        setActiveChat(null);
        setIsDialogueClosing(false);
        closeTimerRef.current = null;
        window.requestAnimationFrame(() => activeTriggerRef.current?.focus());
      },
      shouldReduceMotion ? 120 : 160,
    );
  }

  return (
    <main
      className={styles.worksSection}
      id="open-works"
      data-active-theme={activeTheme}
    >
      <div className={styles.worksClimate} aria-hidden="true">
        <span className={styles.xingyueClimate} />
        <span className={styles.trainClimate} />
        <span className={styles.rainClimate} />
      </div>

      <div className={styles.worksInner}>
        <header className={styles.worksHeading}>
          <div>
            <p>已开放的故事</p>
            <h2>从一处入口开始</h2>
          </div>
          <p>
            它们彼此相连，却各自拥有自己的边界。你不需要先了解完整设定。
          </p>
        </header>

        <nav className={styles.workList} aria-label="静眠森作品">
          {jingmiansenWorks.map((work) => {
            const chat = workChatByHref[work.href];

            return (
              <div
                className={`${styles.workItem} ${
                  chat ? styles.workItemWithDialogue : ""
                }`}
                data-theme={work.theme}
                key={work.href}
                onPointerEnter={() => setActiveTheme(work.theme)}
                onFocusCapture={() => setActiveTheme(work.theme)}
              >
                <Link className={styles.workMainLink} href={work.href}>
                  <picture className={styles.workVisual}>
                    {work.theme === "xingyue" ? (
                      <>
                        <source
                          media="(max-width: 760px)"
                          srcSet="/projects/jingmiansen/stories/xing-yue-xiang-hu/ch2-04-mobile.avif"
                          type="image/avif"
                        />
                        <source
                          media="(max-width: 760px)"
                          srcSet="/projects/jingmiansen/stories/xing-yue-xiang-hu/ch2-04-mobile.webp"
                          type="image/webp"
                        />
                      </>
                    ) : null}
                    <source srcSet={work.cover.avif} type="image/avif" />
                    <img
                      src={work.cover.webp}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{ objectPosition: work.cover.position }}
                    />
                  </picture>
                  <span className={styles.workShade} aria-hidden="true" />
                  <span className={styles.workIndex}>{work.index}</span>
                  <span className={styles.workCopy}>
                    <span>{work.category}</span>
                    <strong>{work.title}</strong>
                    <span>{work.description}</span>
                  </span>
                  <span className={styles.workCue}>{work.cue}</span>
                  <span className={styles.workArrow} aria-hidden="true">
                    →
                  </span>
                </Link>

                {chat ? (
                  <WorkDialogueTrigger
                    character={chat}
                    isOpen={activeChat === chat.characterId}
                    onOpen={(trigger) =>
                      openConversation(chat.characterId, trigger)
                    }
                  />
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>

      <WorkDialogueModal
        characters={workChats}
        activeCharacterId={activeChat}
        dialogRef={dialogRef}
        isClosing={isDialogueClosing}
        onRequestClose={closeConversation}
      />
    </main>
  );
}

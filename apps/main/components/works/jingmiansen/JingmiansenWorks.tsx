"use client";

import Link from "next/link";
import { useState } from "react";
import type { JingmiansenTheme } from "@/content/projects/jingmiansen";
import { jingmiansenWorks } from "@/content/projects/jingmiansen";
import type { DialogueScript } from "@/content/projects/jingmiansen-dialogues";
import { WorkDialogue } from "@/components/works/jingmiansen/CharacterDialogue";
import styles from "@/styles/projects/jingmiansen.module.css";

type JingmiansenWorksProps = {
  dialogue: DialogueScript;
};

export function JingmiansenWorks({ dialogue }: JingmiansenWorksProps) {
  const [activeTheme, setActiveTheme] = useState<JingmiansenTheme>("mist");

  return (
    <main
      className={styles.worksSection}
      id="open-works"
      data-active-theme={activeTheme}
    >
      <div className={styles.worksClimate} aria-hidden="true">
        <span className={styles.mistClimate} />
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
            const hasDialogue = work.href === "/works/jingmiansen/witch-train";

            return (
              <div
                className={`${styles.workItem} ${
                  hasDialogue ? styles.workItemWithDialogue : ""
                }`}
                data-theme={work.theme}
                key={work.href}
                onPointerEnter={() => setActiveTheme(work.theme)}
                onFocusCapture={() => setActiveTheme(work.theme)}
              >
                <Link className={styles.workMainLink} href={work.href}>
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

                {hasDialogue ? <WorkDialogue script={dialogue} /> : null}
              </div>
            );
          })}
        </nav>
      </div>
    </main>
  );
}

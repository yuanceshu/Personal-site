"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { DialogueScript } from "@/content/projects/jingmiansen-dialogues";
import styles from "@/styles/projects/jingmiansen.module.css";

type ConversationPanelProps = {
  panelId: string;
  portraitSrc: string;
  portraitAlt: string;
  portraitWidth: number;
  portraitHeight: number;
  script: DialogueScript;
  currentId: string | null;
  onSelect: (id: string) => void;
  onReset: () => void;
  onClose: () => void;
};

function ConversationPanel({
  panelId,
  portraitSrc,
  portraitAlt,
  portraitWidth,
  portraitHeight,
  script,
  currentId,
  onSelect,
  onReset,
  onClose,
}: ConversationPanelProps) {
  const current = currentId ? script.nodes[currentId] : null;
  const choices = current?.next?.length
    ? current.next.map((id) => script.nodes[id])
    : current
      ? []
      : script.start.map((id) => script.nodes[id]);

  return (
    <section
      className={styles.dialoguePanel}
      id={panelId}
      aria-label={`与${script.name}交谈`}
    >
      <div className={styles.dialoguePortrait}>
        <Image
          src={portraitSrc}
          alt={portraitAlt}
          width={portraitWidth}
          height={portraitHeight}
          sizes="(max-width: 760px) 144px, 288px"
        />
      </div>

      <div className={styles.dialogueContent}>
        <header className={styles.dialogueHeader}>
          <div>
            <p>{script.role}</p>
            <h2>{script.name}</h2>
          </div>
          <button
            className={styles.dialogueClose}
            type="button"
            aria-label={`结束与${script.name}的交谈`}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className={styles.dialogueCopy} aria-live="polite">
          {(current?.answer ?? script.greeting).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        {choices.length ? (
          <div className={styles.dialogueChoices} aria-label="可以继续问">
            {choices.map((choice) => (
              <button
                type="button"
                key={choice.id}
                onClick={() => onSelect(choice.id)}
              >
                <span>{choice.prompt}</span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        ) : null}

        {current ? (
          <button
            className={styles.dialogueReset}
            type="button"
            onClick={onReset}
          >
            返回话题
          </button>
        ) : null}
      </div>
    </section>
  );
}

type EntranceDialogueProps = {
  script: DialogueScript;
};

export function EntranceDialogue({ script }: EntranceDialogueProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = "lingmian-conversation";

  function closeConversation() {
    setIsOpen(false);
    setCurrentId(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div className={styles.entranceDialogue}>
      {isOpen ? (
        <ConversationPanel
          panelId={panelId}
          portraitSrc="/projects/jingmiansen/characters/lingmian.webp"
          portraitAlt="身着深色林地旅装的灵眠"
          portraitWidth={900}
          portraitHeight={1350}
          script={script}
          currentId={currentId}
          onSelect={setCurrentId}
          onReset={() => setCurrentId(null)}
          onClose={closeConversation}
        />
      ) : (
        <div className={styles.greeting} aria-label="灵眠的迎接">
          <p>你好，这里是静眠森。</p>
          <p>
            我是灵眠。平时守着这片林，也替偶尔来到这里的人认一认路。
          </p>
          <p>
            这里有几条入口，通往不同的故事——有些来自梦境，有些，也未必分得清究竟是梦还是现实。
          </p>
          <p>如果你有兴趣，就去看看吧。</p>
        </div>
      )}

      <div className={styles.entranceActions}>
        <a className={styles.primaryAction} href="#open-works">
          进入森林
          <span aria-hidden="true">↓</span>
        </a>
        <button
          className={styles.dialogueTrigger}
          type="button"
          ref={triggerRef}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => {
            if (isOpen) {
              closeConversation();
            } else {
              setIsOpen(true);
            }
          }}
        >
          {isOpen ? "结束交谈" : "和灵眠说几句"}
        </button>
      </div>

    </div>
  );
}

type WorkDialogueProps = {
  script: DialogueScript;
};

export function WorkDialogue({ script }: WorkDialogueProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = "felica-conversation";

  function closeConversation() {
    setIsOpen(false);
    setCurrentId(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <button
        className={styles.workDialogueTrigger}
        type="button"
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          if (isOpen) {
            closeConversation();
          } else {
            setIsOpen(true);
          }
        }}
      >
        {isOpen ? "结束交谈" : "和菲莉卡聊聊"}
      </button>

      {isOpen ? (
        <div className={styles.workDialoguePanel}>
          <ConversationPanel
            panelId={panelId}
            portraitSrc="/projects/jingmiansen/characters/felica.webp"
            portraitAlt="金色双辫、绿色眼睛的菲莉卡"
            portraitWidth={900}
            portraitHeight={1091}
            script={script}
            currentId={currentId}
            onSelect={setCurrentId}
            onReset={() => setCurrentId(null)}
            onClose={closeConversation}
          />
        </div>
      ) : null}
    </>
  );
}

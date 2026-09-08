"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type {
  CharacterChatConfig,
  JingmiansenCharacterId,
} from "@/content/projects/jingmiansen-dialogues";
import { LiveCharacterDialogue } from "@/components/works/jingmiansen/LiveCharacterDialogue";
import styles from "@/styles/projects/jingmiansen.module.css";

type EntranceDialogueProps = {
  character: CharacterChatConfig;
};

const FOCUSED_DIALOGUE_QUERY = "(max-width: 1150px)";

function useFocusedDialogueLayout() {
  const [isFocusedLayout, setIsFocusedLayout] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(FOCUSED_DIALOGUE_QUERY);
    const updateLayout = () => setIsFocusedLayout(mediaQuery.matches);

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);
    return () => mediaQuery.removeEventListener("change", updateLayout);
  }, []);

  return isFocusedLayout;
}

export function EntranceDialogue({ character }: EntranceDialogueProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isFocusedLayout = useFocusedDialogueLayout();
  const panelId = `${character.characterId}-conversation`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!isOpen) {
      if (dialog.open) dialog.close();
      return;
    }

    if (dialog.open) dialog.close();
    if (isFocusedLayout) dialog.showModal();
    else dialog.show();

    return () => {
      if (dialog.open) dialog.close();
    };
  }, [isFocusedLayout, isOpen]);

  function closeConversation() {
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div className={styles.entranceDialogue}>
      <div className={styles.entranceDialogueIntro}>
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

        <div className={styles.entranceActions}>
          <a className={styles.primaryAction} href="#open-works">
            进入森林
            <span aria-hidden="true">↓</span>
          </a>
          <button
            className={styles.dialogueTrigger}
            type="button"
            ref={triggerRef}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={() => {
              if (isOpen) closeConversation();
              else setIsOpen(true);
            }}
          >
            {isOpen ? "结束交谈" : "和灵眠说几句"}
          </button>
        </div>
      </div>

      <dialog
        className={styles.entranceConversation}
        ref={dialogRef}
        aria-label={`与${character.name}自由交谈`}
        onCancel={(event) => {
          event.preventDefault();
          closeConversation();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && event.target === event.currentTarget) {
            event.preventDefault();
            closeConversation();
          }
        }}
      >
        <LiveCharacterDialogue
          character={character}
          panelId={panelId}
          isOpen={isOpen}
          presentation="entrance"
          autoFocusInput={!isFocusedLayout}
          onClose={closeConversation}
        />
      </dialog>
    </div>
  );
}

type WorkDialogueTriggerProps = {
  character: CharacterChatConfig;
  isOpen: boolean;
  onOpen: (trigger: HTMLButtonElement) => void;
};

export function WorkDialogueTrigger({
  character,
  isOpen,
  onOpen,
}: WorkDialogueTriggerProps) {
  const panelId = `${character.characterId}-conversation`;

  return (
    <button
      className={styles.workDialogueTrigger}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-controls={panelId}
      onClick={(event) => onOpen(event.currentTarget)}
    >
      和{character.name}聊聊
    </button>
  );
}

type WorkDialogueModalProps = {
  characters: readonly CharacterChatConfig[];
  activeCharacterId: JingmiansenCharacterId | null;
  dialogRef: RefObject<HTMLDialogElement | null>;
  isClosing: boolean;
  onRequestClose: () => void;
};

export function WorkDialogueModal({
  characters,
  activeCharacterId,
  dialogRef,
  isClosing,
  onRequestClose,
}: WorkDialogueModalProps) {
  const activeCharacter = characters.find(
    ({ characterId }) => characterId === activeCharacterId,
  );

  return (
    <dialog
      className={styles.workDialogueModal}
      ref={dialogRef}
      data-active-character={activeCharacterId ?? undefined}
      data-closing={isClosing || undefined}
      aria-label={
        activeCharacter ? `与${activeCharacter.name}自由交谈` : "角色对话"
      }
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onRequestClose();
      }}
    >
      {characters.map((character) => {
        const isOpen = activeCharacterId === character.characterId;

        return (
          <div
            className={styles.workDialogueView}
            hidden={!isOpen}
            key={character.characterId}
          >
            <LiveCharacterDialogue
              character={character}
              panelId={`${character.characterId}-conversation`}
              isOpen={isOpen}
              presentation="work"
              onClose={onRequestClose}
            />
          </div>
        );
      })}
    </dialog>
  );
}

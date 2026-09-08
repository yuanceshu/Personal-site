"use client";

import Image from "next/image";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CharacterChatConfig } from "@/content/projects/jingmiansen-dialogues";
import styles from "@/styles/projects/jingmiansen.module.css";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type LiveCharacterDialogueProps = {
  character: CharacterChatConfig;
  panelId: string;
  isOpen: boolean;
  presentation: "entrance" | "work";
  autoFocusInput?: boolean;
  onClose: () => void;
};

type StreamEvent = {
  event?: string;
  content?: unknown;
};

type StoredConversation = {
  visitorId: string;
  sessionId: string;
  messages: ChatMessage[];
  updatedAt: number;
};

const FOLLOW_THRESHOLD = 56;
const MAX_TEXTAREA_HEIGHT = 102;
const CONVERSATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_STORED_MESSAGES = 16;
const VISITOR_STORAGE_KEY = "jingmiansen:visitor:v1";
const ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function removeLocalStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // The in-memory conversation remains usable when persistence is unavailable.
  }
}

function getOrCreateVisitorId() {
  const stored = readLocalStorage(VISITOR_STORAGE_KEY);
  if (stored && ID_PATTERN.test(stored)) return stored;

  const visitorId = createId();
  writeLocalStorage(VISITOR_STORAGE_KEY, visitorId);
  return visitorId;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

function readStreamEvent(block: string): StreamEvent | null {
  let eventName = "";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }

  if (!dataLines.length) return null;

  try {
    const data = JSON.parse(dataLines.join("\n")) as StreamEvent;
    return { ...data, event: data.event ?? eventName };
  } catch {
    return null;
  }
}

export function LiveCharacterDialogue({
  character,
  panelId,
  isOpen,
  presentation,
  autoFocusInput = true,
  onClose,
}: LiveCharacterDialogueProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const visitorIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const shouldFollowRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFailedMessageRef = useRef<string | null>(null);

  const { characterId, name, role, introduction, portrait } = character;
  const hasStarted = messages.length > 0 || isLoading || Boolean(error);
  const canReset = messages.length > 0 || Boolean(input) || Boolean(error);
  const storageKey = `jingmiansen:chat:v1:${characterId}`;

  function scrollToLatest(behavior: ScrollBehavior = "smooth") {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    transcript.scrollTo({ top: transcript.scrollHeight, behavior });
    shouldFollowRef.current = true;
    setHasUnread(false);
  }

  useEffect(() => {
    const visitorId = getOrCreateVisitorId();
    visitorIdRef.current = visitorId;
    let restoredMessages: ChatMessage[] = [];

    const stored = readLocalStorage(storageKey);
    if (stored) {
      try {
        const conversation = JSON.parse(stored) as Partial<StoredConversation>;
        const isFresh =
          typeof conversation.updatedAt === "number" &&
          Date.now() - conversation.updatedAt <= CONVERSATION_TTL_MS;

        if (
          conversation.visitorId === visitorId &&
          typeof conversation.sessionId === "string" &&
          ID_PATTERN.test(conversation.sessionId) &&
          Array.isArray(conversation.messages) &&
          isFresh
        ) {
          sessionIdRef.current = conversation.sessionId;
          restoredMessages = conversation.messages
            .filter(isChatMessage)
            .slice(-MAX_STORED_MESSAGES);
        } else {
          removeLocalStorage(storageKey);
        }
      } catch {
        removeLocalStorage(storageKey);
      }
    }

    sessionIdRef.current ??= createId();
    const frame = window.requestAnimationFrame(() => {
      if (restoredMessages.length) setMessages(restoredMessages);
      setStorageReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey]);

  useEffect(() => {
    if (!storageReady) return;
    const visitorId = visitorIdRef.current;
    const sessionId = sessionIdRef.current;
    if (!visitorId || !sessionId) return;

    const conversation: StoredConversation = {
      visitorId,
      sessionId,
      messages: messages.slice(-MAX_STORED_MESSAGES),
      updatedAt: Date.now(),
    };
    writeLocalStorage(storageKey, JSON.stringify(conversation));
  }, [messages, storageKey, storageReady]);

  useEffect(() => {
    if (!isOpen) return;

    const frame = window.requestAnimationFrame(() => {
      if (autoFocusInput) inputRef.current?.focus({ preventScroll: true });
      if (shouldFollowRef.current) scrollToLatest("auto");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [autoFocusInput, isOpen]);

  useEffect(() => {
    if (isOpen) return;

    const resetMenu = window.setTimeout(() => setIsMenuOpen(false), 0);
    return () => window.clearTimeout(resetMenu);
  }, [isOpen]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, [input]);

  useEffect(() => {
    if (!messages.length) return;
    const frame = window.requestAnimationFrame(() => {
      if (shouldFollowRef.current) scrollToLatest("auto");
      else setHasUnread(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  function appendAssistantContent(id: string, content: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id
          ? { ...message, content: message.content + content }
          : message,
      ),
    );
  }

  async function runMessage(message: string, appendUser: boolean) {
    if (isLoading) return;

    const visitorId = visitorIdRef.current ?? getOrCreateVisitorId();
    const sessionId = sessionIdRef.current ?? createId();
    const assistantMessageId = createId();
    const controller = new AbortController();
    sessionIdRef.current = sessionId;
    visitorIdRef.current = visitorId;
    abortControllerRef.current = controller;
    shouldFollowRef.current = true;
    setHasUnread(false);
    setMessages((current) => [
      ...current,
      ...(appendUser
        ? [{ id: createId(), role: "user" as const, content: message }]
        : []),
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/jingmiansen/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: characterId,
          message,
          visitorId,
          sessionId,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("角色暂时没有回应，请稍后再试。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedContent = false;

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

        let separator = buffer.indexOf("\n\n");
        while (separator !== -1) {
          const eventData = readStreamEvent(buffer.slice(0, separator));
          buffer = buffer.slice(separator + 2);
          separator = buffer.indexOf("\n\n");

          if (!eventData) continue;
          if (eventData.event === "RunError") {
            throw new Error("角色暂时没有回应，请稍后再试。");
          }

          if (typeof eventData.content === "string" && eventData.content) {
            appendAssistantContent(assistantMessageId, eventData.content);
            receivedContent = true;
          }
        }

        if (done) break;
      }

      if (buffer.trim()) {
        const eventData = readStreamEvent(buffer);
        if (typeof eventData?.content === "string" && eventData.content) {
          appendAssistantContent(assistantMessageId, eventData.content);
          receivedContent = true;
        }
      }

      if (!receivedContent) {
        throw new Error("角色暂时没有回应，请稍后再试。");
      }
      lastFailedMessageRef.current = null;
    } catch (caughtError) {
      setMessages((current) =>
        current.filter((message) => message.id !== assistantMessageId),
      );
      if (controller.signal.aborted) return;

      lastFailedMessageRef.current = message;
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "角色暂时没有回应，请稍后再试。",
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || isLoading) return;

    setInput("");
    lastFailedMessageRef.current = null;
    await runMessage(message, true);
  }

  function startNewConversation() {
    const visitorId = visitorIdRef.current ?? getOrCreateVisitorId();
    const oldSessionId = sessionIdRef.current;
    const nextSessionId = createId();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    visitorIdRef.current = visitorId;
    sessionIdRef.current = nextSessionId;
    lastFailedMessageRef.current = null;
    shouldFollowRef.current = true;
    setMessages([]);
    setInput("");
    setError(null);
    setHasUnread(false);
    setIsLoading(false);
    setIsMenuOpen(false);
    writeLocalStorage(
      storageKey,
      JSON.stringify({
        visitorId,
        sessionId: nextSessionId,
        messages: [],
        updatedAt: Date.now(),
      } satisfies StoredConversation),
    );

    if (oldSessionId && ID_PATTERN.test(oldSessionId)) {
      void fetch("/api/jingmiansen/chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: characterId,
          visitorId,
          sessionId: oldSessionId,
        }),
        keepalive: true,
      }).catch(() => undefined);
    }
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleTranscriptScroll() {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    const distanceFromBottom =
      transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight;
    const isNearBottom = distanceFromBottom <= FOLLOW_THRESHOLD;
    shouldFollowRef.current = isNearBottom;
    if (isNearBottom) setHasUnread(false);
  }

  function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setInput(event.target.value);
    if (error) setError(null);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      event.keyCode !== 229
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return;
    }
    onClose();
  }

  return (
    <section
      className={styles.dialoguePanel}
      id={panelId}
      data-character={characterId}
      data-presentation={presentation}
      data-conversation-started={hasStarted || undefined}
      aria-label={`与${name}自由交谈`}
      onKeyDown={handlePanelKeyDown}
    >
      <div
        className={styles.dialogueStage}
        aria-hidden={hasStarted}
        inert={hasStarted ? true : undefined}
      >
        <div className={styles.dialogueStageVisual}>
          {presentation === "work" ? (
            <Image
              className={styles.dialogueStageScene}
              src={character.scene.src}
              alt=""
              fill
              sizes="(max-width: 760px) 100vw, 28rem"
              style={{ objectPosition: character.scene.position }}
            />
          ) : null}
          <span className={styles.dialogueStageShade} aria-hidden="true" />
          <Image
            className={styles.dialogueStagePortrait}
            src={portrait.src}
            alt={portrait.alt}
            width={portrait.width}
            height={portrait.height}
            sizes="(max-width: 760px) 15rem, 27rem"
          />
        </div>

        <div className={styles.dialogueStageCopy}>
          <div className={styles.dialogueStageIdentity}>
            <p>{role}</p>
            <h2>{name}</h2>
          </div>
          <p className={styles.dialogueIntroduction}>{introduction}</p>
          <div className={styles.dialogueStarters} aria-label="可以这样开始">
            {character.starters.map((starter) => (
              <button
                type="button"
                key={starter}
                disabled={isLoading}
                onClick={() => void runMessage(starter, true)}
              >
                <span>{starter}</span>
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={styles.dialogueConversation}
        aria-hidden={!hasStarted}
        inert={!hasStarted ? true : undefined}
      >
        <header className={styles.dialogueHeader}>
          <div className={styles.dialogueCompactIdentity}>
            <span className={styles.dialogueAvatar}>
              <Image
                src={portrait.src}
                alt=""
                width={portrait.width}
                height={portrait.height}
                sizes="3rem"
              />
            </span>
            <span>
              <strong>{name}</strong>
              <small>{role}</small>
            </span>
          </div>
        </header>

        <div className={styles.dialogueTranscriptFrame}>
          <div
            className={styles.liveDialogueMessages}
            ref={transcriptRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-busy={isLoading}
            onScroll={handleTranscriptScroll}
          >
            <div className={styles.liveAgentMessage}>
              <span>{name}</span>
              <p>{introduction}</p>
            </div>
            {messages.map((message) => (
              <div
                className={
                  message.role === "user"
                    ? styles.liveUserMessage
                    : styles.liveAgentMessage
                }
                key={message.id}
              >
                {message.role === "assistant" ? <span>{name}</span> : null}
                <p>
                  {message.content || (
                    <span className={styles.dialogueThinking}>正在回应……</span>
                  )}
                </p>
              </div>
            ))}
          </div>

          {hasUnread ? (
            <button
              className={styles.jumpToLatest}
              type="button"
              onClick={() => scrollToLatest()}
            >
              回到最新消息
              <span aria-hidden="true">↓</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.dialogueChrome}>
        {canReset ? (
          <div className={styles.dialogueMore}>
            <button
              className={styles.dialogueMoreButton}
              type="button"
              aria-label="更多会话操作"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((current) => !current)}
            >
              <span aria-hidden="true">•••</span>
            </button>
            {isMenuOpen ? (
              <div className={styles.dialogueMenu} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={startNewConversation}
                >
                  新对话
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <button
          className={styles.dialogueClose}
          type="button"
          aria-label={`结束与${name}的交谈`}
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className={styles.dialogueComposer}>
        {error ? (
          <div className={styles.liveDialogueError} role="alert">
            <span>{error}</span>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                const message = lastFailedMessageRef.current;
                if (message) void runMessage(message, false);
              }}
            >
              再试一次
            </button>
          </div>
        ) : null}

        <form className={styles.liveDialogueForm} onSubmit={sendMessage}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder={`想对${name}说点什么？`}
            maxLength={1200}
            rows={1}
            aria-label={`发送给${name}的消息`}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label={isLoading ? `${name}正在回应` : `发送给${name}`}
          >
            <span aria-hidden="true">{isLoading ? "···" : "↑"}</span>
          </button>
        </form>
        <p className={styles.dialogueInputHint}>
          Enter 发送 · Shift + Enter 换行
        </p>
        <span className={styles.screenReaderStatus} role="status">
          {isLoading ? `${name}正在回应` : ""}
        </span>
      </div>
    </section>
  );
}

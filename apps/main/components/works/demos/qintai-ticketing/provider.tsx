"use client";

/**
 * 琴台票务的浏览器侧状态源。
 *
 * 这里放三样东西，全部只属于这台浏览器：
 * 1. 确定性引擎（`TicketStorefront` + `TicketMerchant`）——金额、余量、锁座、候补、护栏与台账；
 * 2. 会话标识与浏览器持久化（localStorage，刷新后继续）；
 * 3. 两个角色的对话状态（观众侧与运营侧各自一条）。
 *
 * 它与服务端的分工是硬边界：模型只读投影、只出草案；**任何写操作都在这里执行**，并在执行前
 * 用实时余量与护栏复校一遍。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { askQintaiAgent, checkQintaiAgentStatus } from "@/lib/works/qintai-ticketing/agent";
import {
  STORE_NAME,
  buildDataset,
  merchantFixtures,
  type Dataset,
} from "@/lib/works/qintai-ticketing/data";
import { TicketStorefront } from "@/lib/works/qintai-ticketing/engine/catalog";
import { todayIso } from "@/lib/works/qintai-ticketing/engine/fixtures";
import {
  ChangeNotApplicable,
  GuardrailViolation,
  TicketMerchant,
  type MerchantSessionContext,
  type RawMerchantFixtures,
} from "@/lib/works/qintai-ticketing/engine/pacing";
import { TicketingError, type TicketingEngine } from "@/lib/works/qintai-ticketing/engine/ticketing";
import {
  buildCustomerContext,
  buildMerchantContext,
  type CustomerContextInput,
  type MerchantContextInput,
} from "@/lib/works/qintai-ticketing/projection";
import {
  EMPTY_CONTEXT,
  type AgentContext,
  type ChatProposal,
  type ChatResult,
  type Role,
} from "@/lib/works/qintai-ticketing/schema";
import {
  createEngine,
  newId,
  readStoredSession,
  restorableLedger,
  writeStoredSession,
  type StoredSession,
} from "@/lib/works/qintai-ticketing/session";
import type { Product, SessionContext } from "@/lib/works/qintai-ticketing/types";

/** 运营台只是一个演示身份，不需要持久化。 */
export const MERCHANT_SESSION_ID = "merchant-demo";
export const MERCHANT_ID = "qintai-wuhan";
export const OPERATOR_NAME = "运营人员";

export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** 流式过程中收到的工具状态文案。 */
  steps: string[];
  result: ChatResult | null;
  status: "done" | "loading" | "error";
  mode: "live" | "demo" | "fallback" | null;
  reason: string | null;
}

interface ChatState {
  entries: ChatEntry[];
  pending: boolean;
  status: string | null;
}

export interface ProposalOutcome {
  ok: boolean;
  message: string;
  /** 成功后的落点：锁座 → 票夹，运营变更 → 待审批。 */
  href: string | null;
}

const EMPTY_CHAT: ChatState = { entries: [], pending: false, status: null };

/**
 * 这台浏览器上的确定性世界：数据集、引擎，以及架在引擎上的店面与运营台。
 * 三者必须同生同灭——重建数据集就要连带重建引擎与两侧视图，否则余量口径会错位。
 */
interface World {
  dataset: Dataset;
  engine: TicketingEngine;
  storefront: TicketStorefront;
  merchant: TicketMerchant;
}

interface QintaiValue {
  storeName: string;
  dataset: Dataset;
  storefront: TicketStorefront;
  merchant: TicketMerchant;
  /** 观众会话（锁座、候补、票夹都挂在这个 user_id 上）。 */
  session: SessionContext;
  merchantSession: MerchantSessionContext;
  /** 每次确定性写入后自增，供界面重新读取引擎状态。 */
  revision: number;
  commit: <T>(work: () => T) => T;
  resetSession: () => void;
  /** 实时 Agent 是否可用；null 表示还在探测。 */
  live: boolean | null;
  chat: Record<Role, ChatState>;
  ask: (role: Role, text: string) => void;
  /** 供页面上的按钮使用：展开对话并立刻发送（实时不可用时仍会给确定性回答）。 */
  askNow: (role: Role, text: string) => void;
  /** 对话抽屉的开合放在 Provider 里，页面上的按钮才能把它打开。 */
  drawer: Record<Role, boolean>;
  setDrawer: (role: Role, open: boolean) => void;
  accepted: string[];
  runProposal: (proposal: ChatProposal) => ProposalOutcome;
  registerContext: (role: Role, builder: (() => AgentContext) | null) => void;
}

const QintaiContext = createContext<QintaiValue | null>(null);

function entryFromStored(message: {
  id: string;
  role: "user" | "assistant";
  content: string;
}): ChatEntry {
  return {
    id: message.id,
    role: message.role,
    text: message.content,
    steps: [],
    result: null,
    status: "done",
    mode: null,
    reason: null,
  };
}

/** 把引擎异常翻译成一句操作者能读懂的话。 */
export function explainOperation(error: unknown): string {
  if (error instanceof GuardrailViolation) return error.violations.join(" ");
  if (error instanceof ChangeNotApplicable) return error.message;
  if (error instanceof TicketingError) {
    switch (error.kind) {
      case "sold_out":
        return "该票档当前已售罄，只能加入候补。";
      case "hold_limit":
        return "超过同一场演出的单次锁座上限。";
      case "ownership":
        return "这些票不在当前观众的票夹里。";
      case "not_found":
        return "没找到对应的票档或票据。";
      case "state":
        return "当前状态不允许这一步操作。";
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : "操作没有完成，请重试。";
}

export function QintaiProvider({ children }: { children: React.ReactNode }) {
  const [world, setWorld] = useState<World | null>(null);
  const [ids, setIds] = useState<{ sessionId: string; userId: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const [live, setLive] = useState<boolean | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [chat, setChat] = useState<Record<Role, ChatState>>({
    customer: EMPTY_CHAT,
    merchant: EMPTY_CHAT,
  });
  const [drawer, setDrawerState] = useState<Record<Role, boolean>>({ customer: false, merchant: false });

  const storedRef = useRef<StoredSession | null>(null);
  const builderRef = useRef<Partial<Record<Role, () => AgentContext>>>({});
  const busyRef = useRef<Record<Role, boolean>>({ customer: false, merchant: false });
  const abortRef = useRef<Record<Role, AbortController | null>>({ customer: null, merchant: null });
  const entriesRef = useRef<Record<Role, ChatEntry[]>>({ customer: [], merchant: [] });
  const acceptedRef = useRef<string[]>([]);

  /** 把当前引擎状态、台账、已确认提案与对话写回 localStorage。 */
  const persist = useCallback(() => {
    const engine = world?.engine;
    const merchant = world?.merchant;
    const stored = storedRef.current;
    if (!engine || !merchant || !stored) return;
    const history = (["customer", "merchant"] as Role[]).flatMap((role) =>
      entriesRef.current[role]
        .filter((entry) => entry.status === "done" && entry.text.trim().length > 0)
        .map((entry) => ({
          id: entry.id,
          role: entry.role,
          content: entry.text.slice(0, 1200),
          createdAt: new Date().toISOString(),
          engine: { mode: role === "merchant" ? ("demo" as const) : ("live" as const) },
        })),
    );
    storedRef.current = {
      ...stored,
      engine: engine.snapshot(),
      ledger: merchant.ledger.serialize(),
      accepted: acceptedRef.current,
      history: history.slice(-100),
    };
    writeStoredSession(storedRef.current);
  }, [world]);

  const commit = useCallback(
    <T,>(work: () => T): T => {
      const result = work();
      persist();
      setRevision((value) => value + 1);
      return result;
    },
    [persist],
  );

  // --- 载入：数据集 → 引擎 → 店面/运营台 → 会话与历史 -------------------------------
  useEffect(() => {
    const stored = readStoredSession();
    storedRef.current = stored;
    const now = Date.now();
    const dataset = buildDataset(now);
    const engine = createEngine({ dataset, snapshot: stored.engine, now: () => Date.now() });
    const storefront = new TicketStorefront(dataset, engine);
    const viewer: SessionContext = { session_id: stored.sessionId, user_id: stored.userId };
    const merchant = new TicketMerchant(dataset, engine, {
      fixtures: merchantFixtures() as unknown as RawMerchantFixtures,
      // 运营侧的自由文本检索复用店面的确定性排名。
      search: (query, limit) => storefront.searchProducts(viewer, query).slice(0, limit),
    });
    const ledger = restorableLedger(stored.ledger);
    if (ledger) merchant.ledger.restore(ledger);

    acceptedRef.current = stored.accepted;
    const seeded: Record<Role, ChatEntry[]> = { customer: [], merchant: [] };
    for (const message of stored.history) {
      // 历史里只留纯文本，用标记还原它属于哪一侧的对话。
      const asMerchant = message.engine?.mode === "demo";
      seeded[asMerchant ? "merchant" : "customer"].push(entryFromStored(message));
    }
    entriesRef.current = seeded;

    // 首屏先渲染与 SSR 一致的载入态，挂载后再切到本地状态，避免 hydration 不一致。
    queueMicrotask(() => {
      setWorld({ dataset, engine, storefront, merchant });
      setAccepted(stored.accepted);
      setIds({ sessionId: stored.sessionId, userId: stored.userId });
      setChat({
        customer: { entries: seeded.customer, pending: false, status: null },
        merchant: { entries: seeded.merchant, pending: false, status: null },
      });
    });
  }, []);

  useEffect(() => {
    let current = true;
    void checkQintaiAgentStatus().then((available) => {
      if (current) setLive(available);
    });
    const aborts = abortRef.current;
    return () => {
      current = false;
      aborts.customer?.abort();
      aborts.merchant?.abort();
    };
  }, []);

  const session = useMemo<SessionContext>(
    () => ({
      session_id: ids?.sessionId ?? "sess-local",
      user_id: ids?.userId ?? "demo-user",
    }),
    [ids],
  );

  const merchantSession = useMemo<MerchantSessionContext>(
    () => ({ session_id: MERCHANT_SESSION_ID, merchant_id: MERCHANT_ID, operator: OPERATOR_NAME }),
    [],
  );

  const registerContext = useCallback((role: Role, builder: (() => AgentContext) | null) => {
    if (builder) builderRef.current[role] = builder;
    else delete builderRef.current[role];
  }, []);

  const patchEntry = useCallback((role: Role, id: string, patch: Partial<ChatEntry>) => {
    entriesRef.current[role] = entriesRef.current[role].map((entry) =>
      entry.id === id ? { ...entry, ...patch } : entry,
    );
    setChat((previous) => ({
      ...previous,
      [role]: {
        ...previous[role],
        entries: previous[role].entries.map((entry) =>
          entry.id === id ? { ...entry, ...patch } : entry,
        ),
      },
    }));
  }, []);

  const pushEntry = useCallback((role: Role, entry: ChatEntry) => {
    entriesRef.current[role] = [...entriesRef.current[role], entry];
    setChat((previous) => ({
      ...previous,
      [role]: { ...previous[role], entries: [...previous[role].entries, entry] },
    }));
  }, []);

  const ask = useCallback(
    (role: Role, raw: string) => {
      const text = raw.trim();
      if (!text || busyRef.current[role]) return;
      if (!world) return;
      busyRef.current[role] = true;
      setChat((previous) => ({
        ...previous,
        [role]: { ...previous[role], pending: true, status: null },
      }));

      const history = entriesRef.current[role]
        .filter((entry) => entry.status === "done" && entry.text.trim().length > 0)
        .slice(-8)
        .map((entry) => ({ role: entry.role, content: entry.text.slice(0, 1200) }));
      const context = builderRef.current[role]?.() ?? EMPTY_CONTEXT;
      pushEntry(role, {
        id: newId("u"),
        role: "user",
        text,
        steps: [],
        result: null,
        status: "done",
        mode: null,
        reason: null,
      });
      const assistantId = newId("a");
      pushEntry(role, {
        id: assistantId,
        role: "assistant",
        text: "",
        steps: [],
        result: null,
        status: "loading",
        mode: null,
        reason: null,
      });

      const controller = new AbortController();
      abortRef.current[role] = controller;
      void askQintaiAgent({
        role,
        message: text,
        history,
        accepted: acceptedRef.current,
        context,
        signal: controller.signal,
        onStatus: (label) => {
          const entries = entriesRef.current[role].map((entry) =>
            entry.id === assistantId && !entry.steps.includes(label)
              ? { ...entry, steps: [...entry.steps, label] }
              : entry,
          );
          entriesRef.current[role] = entries;
          setChat((previous) => ({ ...previous, [role]: { ...previous[role], status: label, entries } }));
        },
      })
        .then((turn) => {
          if (controller.signal.aborted) return;
          const steps = entriesRef.current[role].find((entry) => entry.id === assistantId)?.steps ?? [];
          patchEntry(role, assistantId, {
            text: turn.answer,
            steps: turn.toolLabel ? [...new Set([...steps, turn.toolLabel])] : steps,
            result: {
              mode: "live",
              answer: turn.answer,
              sources: turn.sources,
              cards: turn.cards,
              proposal: turn.proposal,
              followups: turn.followups,
            },
            status: "done",
            mode: turn.mode,
            reason: turn.reason ?? null,
          });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          patchEntry(role, assistantId, {
            text: error instanceof Error ? error.message : "Agent 暂时无法响应。",
            status: "error",
          });
        })
        .finally(() => {
          busyRef.current[role] = false;
          abortRef.current[role] = null;
          persist();
          setChat((previous) => ({
            ...previous,
            [role]: { ...previous[role], pending: false, status: null },
          }));
        });
    },
    [patchEntry, persist, pushEntry, world],
  );

  const setDrawer = useCallback((role: Role, open: boolean) => {
    setDrawerState((previous) => ({ ...previous, [role]: open }));
  }, []);

  const rememberAccepted = useCallback((proposalId: string) => {
    if (acceptedRef.current.includes(proposalId)) return;
    acceptedRef.current = [...acceptedRef.current, proposalId].slice(-24);
    setAccepted(acceptedRef.current);
  }, []);

  const askNow = useCallback(
    (role: Role, text: string) => {
      setDrawerState((previous) => ({ ...previous, [role]: true }));
      ask(role, text);
    },
    [ask],
  );

  /**
   * 用户确认草案后的确定性执行。这里**不信任**草案里的数字：先按实时余量与护栏复校，
   * 再调用引擎；被拒绝时把是哪一条规则拦下来说清楚，并且不记为「已确认」，方便重试。
   */
  const runProposal = useCallback(
    (proposal: ChatProposal): ProposalOutcome => {
      const storefront = world?.storefront;
      const merchant = world?.merchant;
      const action = proposal.action;
      if (!storefront || !merchant) return { ok: false, message: "演示状态还没载入。", href: null };
      if (!action) {
        return { ok: false, message: "这份草案没有可执行的动作，请按页面上的按钮操作。", href: null };
      }
      const note = action.note ?? proposal.title;
      try {
        if (action.kind === "hold") {
          const quantity = action.quantity ?? 1;
          const remaining = storefront.engine.remaining(action.listing_id);
          if (remaining < quantity) {
            return {
              ok: false,
              message:
                remaining === 0
                  ? `${action.listing_id} 已售罄，锁座没有执行；可以到演出详情页加入候补。`
                  : `${action.listing_id} 现在只剩 ${remaining} 张，锁座没有执行，请减少张数。`,
              href: null,
            };
          }
          commit(() => storefront.addToCart(session, action.listing_id, quantity));
          rememberAccepted(proposal.id);
          return {
            ok: true,
            message: `已按当前余量锁座 ${quantity} 张，倒计时开始；结算前不扣款。`,
            href: "/works/demos/qintai-ticketing/wallet",
          };
        }
        if (action.kind === "price") {
          const value = action.value;
          if (value == null) return { ok: false, message: "草案里没有新价格。", href: null };
          const pricing = merchant.getPricingContext(action.listing_id);
          if (pricing?.max_price != null && pricing.min_price != null) {
            if (value > pricing.max_price || value < pricing.min_price) {
              return {
                ok: false,
                message:
                  `${action.listing_id} 单次改价区间是 ¥${pricing.min_price.toFixed(2)}–` +
                  `¥${pricing.max_price.toFixed(2)}，草案里的 ¥${value.toFixed(2)} 已超出，未暂存。`,
                href: null,
              };
            }
          }
          const change = commit(() =>
            merchant.stagePriceUpdate(
              merchantSession,
              [{ listing_id: action.listing_id, new_price: value }],
              note,
            ),
          );
          rememberAccepted(proposal.id);
          return {
            ok: true,
            message: `改价已暂存为 ${change.change_id}，等待你在待审批列表里应用。`,
            href: "/works/demos/qintai-ticketing/merchant/holds",
          };
        }
        if (action.kind === "restock") {
          const quantity = action.quantity ?? 0;
          const change = commit(() =>
            merchant.stageInventoryAction(
              merchantSession,
              [{ listing_id: action.listing_id, action: "restock", quantity }],
              note,
            ),
          );
          rememberAccepted(proposal.id);
          return {
            ok: true,
            message: `释放 ${quantity} 张已暂存为 ${change.change_id}，等待你在待审批列表里应用。`,
            href: "/works/demos/qintai-ticketing/merchant/holds",
          };
        }
        // promotion：草案只给折扣，日期窗口由页面按当前演出日期补齐。
        const discount = action.value;
        if (discount == null) return { ok: false, message: "草案里没有折扣。", href: null };
        const pricing = merchant.getPricingContext(action.listing_id);
        const change = commit(() =>
          merchant.stagePromotion(merchantSession, {
            name: `${action.listing_id} 活动`,
            listing_ids: [action.listing_id],
            discount_pct: discount,
            starts: todayIso(Date.now()),
            ends: pricing?.event_date ?? todayIso(Date.now() + 7 * 86_400_000),
            nights: null,
          }),
        );
        rememberAccepted(proposal.id);
        return {
          ok: true,
          message: `活动草案已暂存为 ${change.change_id}（折扣 ${discount}%），等待你在待审批列表里应用。`,
          href: "/works/demos/qintai-ticketing/merchant/holds",
        };
      } catch (error) {
        return { ok: false, message: explainOperation(error), href: null };
      }
    },
    [commit, merchantSession, rememberAccepted, session, world],
  );

  const resetSession = useCallback(() => {
    const current = world;
    const stored = storedRef.current;
    if (!current || !stored) return;
    current.engine.releaseSession(session.session_id);
    // 用一份全新的数据集重建，避免把上一轮的模拟库存带过来。
    const dataset = buildDataset(Date.now());
    const nextEngine = createEngine({ dataset, now: () => Date.now() });
    const storefront = new TicketStorefront(dataset, nextEngine);
    const nextMerchant = new TicketMerchant(dataset, nextEngine, {
      fixtures: merchantFixtures() as unknown as RawMerchantFixtures,
      search: (query, limit) => storefront.searchProducts(session, query).slice(0, limit),
    });
    acceptedRef.current = [];
    entriesRef.current = { customer: [], merchant: [] };
    storedRef.current = {
      ...stored,
      engine: nextEngine.snapshot(),
      ledger: null,
      accepted: [],
      history: [],
    };
    writeStoredSession(storedRef.current);
    setWorld({ dataset, engine: nextEngine, storefront, merchant: nextMerchant });
    setAccepted([]);
    setChat({
      customer: { entries: [], pending: false, status: null },
      merchant: { entries: [], pending: false, status: null },
    });
    setRevision((value) => value + 1);
  }, [session, world]);

  // 首屏与 SSR 一致地停在载入态；world 一旦就绪，下面的上下文值就是完整的。
  if (!world) {
    return (
      <div className="q-app q-boot" aria-busy="true">
        <p>正在载入琴台票务演示…</p>
        <small>定价、余量、锁座与候补都在这台浏览器上按确定性规则运行，不上传任何数据。</small>
      </div>
    );
  }

  const value: QintaiValue = {
    storeName: STORE_NAME,
    dataset: world.dataset,
    storefront: world.storefront,
    merchant: world.merchant,
    session,
    merchantSession,
    revision,
    commit,
    resetSession,
    live,
    chat,
    ask,
    askNow,
    drawer,
    setDrawer,
    accepted,
    runProposal,
    registerContext,
  };

  return <QintaiContext.Provider value={value}>{children}</QintaiContext.Provider>;
}

export function useQintai(): QintaiValue {
  const value = useContext(QintaiContext);
  if (!value) throw new Error("useQintai 必须在 QintaiProvider 内使用");
  return value;
}

/**
 * 页面注册自己的投影构造器：聊天面板在发送时调用它，把「当次界面上的确定数据」交给模型。
 * 组件卸载时注销，因此只有当前页面的投影会进入请求。
 */
export function useAgentContext(role: Role, builder: () => AgentContext): void {
  const { registerContext } = useQintai();
  const builderRef = useRef(builder);
  useEffect(() => {
    builderRef.current = builder;
  }, [builder]);
  useEffect(() => {
    registerContext(role, () => builderRef.current());
    return () => registerContext(role, null);
  }, [role, registerContext]);
}

/** 观众侧的投影：把当次候选、选中项与费用行压成紧凑上下文。 */
export function useCustomerContext(
  page: AgentContext["page"],
  build: () => Omit<CustomerContextInput, "storefront" | "session" | "page">,
): void {
  const { storefront, session } = useQintai();
  useAgentContext("customer", () => {
    const input = build();
    return buildCustomerContext({ storefront, session, page, ...input });
  });
}

/**
 * 运营侧的投影：把当次票档列表、告警与 pacing 压成紧凑上下文。
 *
 * 候选集由这里统一从票档列表取：运营侧的检索返回 `Listing`，而 Agent 契约里的候选是票档
 * 的紧凑形状，所以在这一处收敛成实时 `Product`，页面只负责声明「看的是哪个工作区」。
 */
export function useMerchantContext(
  page: AgentContext["page"],
  build: () => { query?: string; limit?: number; pacingProductIds?: string[] },
): void {
  const { merchant, storefront, merchantSession } = useQintai();
  useAgentContext("merchant", () => {
    const input = build();
    const results: Product[] = merchant
      .searchListings(merchantSession, input.query ?? "", null, input.limit ?? 12)
      .map((listing) => storefront.getLiveProduct(listing.listing_id))
      .filter((product): product is Product => product !== null);
    return buildMerchantContext({
      merchant,
      page,
      results,
      pacingProductIds: input.pacingProductIds,
    } satisfies MerchantContextInput);
  });
}

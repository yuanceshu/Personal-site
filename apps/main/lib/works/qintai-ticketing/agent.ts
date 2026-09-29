/**
 * 琴台票务的 Agent 通道（浏览器侧）。
 *
 * 只经主站自己的代理路由访问实验服务：浏览器拿不到 Token、上游地址或密钥。读取 SSE 的
 * `status` / `final` / `error` 三种事件；任何失败都降级为**确定性回答**——用当次界面上的
 * 投影把费用、余量、候补位次或运营告警直接讲清楚，绝不伪造业务数据。
 */

import {
  resultSchema,
  type AgentContext,
  type ChatCard,
  type ChatProposal,
  type ChatResult,
  type ChatSource,
  type Role,
} from "./schema";

export interface AgentTurn {
  answer: string;
  sources: ChatSource[];
  cards: ChatCard[];
  proposal: ChatProposal | null;
  followups: string[];
  mode: "live" | "demo" | "fallback";
  model?: string;
  reason?: string;
  /** 最近一次工具状态文案（流式过程中回调）。 */
  toolLabel?: string;
}

export interface AskOptions {
  role: Role;
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  accepted: string[];
  context: AgentContext;
  signal?: AbortSignal;
  /** 流式状态回调：模型开始调用工具时给出面向用户的说明。 */
  onStatus?: (label: string) => void;
}

const ROUTES: Record<Role, string> = {
  customer: "/api/experiments/qintai-ticketing/chat",
  merchant: "/api/experiments/qintai-ticketing/merchant",
};

const FOLLOWUPS: Record<Role, string[]> = {
  customer: ["帮我看看这份费用拆分", "哪个票档还有连座？", "售罄的票档怎么候补？"],
  merchant: ["哪些场次明显低于同类基线？", "帮我把《时光的折痕》惠民票做个活动草案", "现在有哪些待审批的提案？"],
};

export async function checkQintaiAgentStatus(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch("/api/experiments/qintai-ticketing/status", {
      cache: "no-store",
      signal: signal ?? AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { live?: boolean };
    return body.live === true;
  } catch {
    return false;
  }
}

function fallbackTurn(options: AskOptions, reason: string): AgentTurn {
  return {
    answer: deterministicAnswer(options),
    sources: [],
    cards: [],
    proposal: null,
    followups: FOLLOWUPS[options.role],
    mode: "fallback",
    reason,
  };
}

/**
 * 离线/失败时的确定性回答：只用请求里已经确定的投影说话。
 */
export function deterministicAnswer(options: AskOptions): string {
  const { context, role } = options;
  if (role === "merchant") {
    const brief = context.merchant;
    if (!brief) {
      return "运营台还没有载入当前数据。请先打开排期或告警面板，我再基于真实数字说明。";
    }
    const parts: string[] = [
      `当前区间 ${brief.current_period}：销售额 ¥${brief.totals.sales.toLocaleString("zh-CN")}，` +
        `订单 ${brief.totals.orders} 笔，访问 ${brief.totals.traffic}，转化 ${brief.totals.conversion_rate}%。`,
    ];
    if (brief.alerts.length > 0) {
      parts.push(
        "需要关注的票档：" +
          brief.alerts
            .slice(0, 4)
            .map(
              (alert) =>
                `${alert.listing_id.split("-").pop()}（${alert.kind === "low_stock" ? "即将售罄" : "低于基线"}，余 ${alert.stock}）`,
            )
            .join("、") +
          "。",
      );
    }
    parts.push(
      `改价上限为单次 ${brief.guardrails.max_price_delta_pct}%、活动折扣上限 ` +
        `${brief.guardrails.max_promotion_discount_pct}%；任何改动都先生成待审批提案。`,
    );
    return parts.join("");
  }

  // 首页的 selected 为空：那里只有视觉推荐，没有用户选中的票档。降级回答先按用户问题
  // 在当前投影里找演出，避免把「想问如梦之梦」误答成首页推荐的另一场。
  const selected =
    context.page === "home"
      ? context.results.find((show) =>
          [show.event_name, show.title, show.venue, show.tier].some(
            (value) => value && options.message.toLowerCase().includes(value.toLowerCase()),
          ),
        ) ?? null
      : context.selected;
  if (selected && context.disclosure) {
    const rows = context.disclosure.rows
      .map((row) => `${row.label} ${row.value}`)
      .join("；");
    const stock =
      selected.remaining === 0
        ? "该票档当前已售罄，只能加入候补。"
        : `当前还剩 ${selected.remaining} 张。`;
    return `${selected.title}：${rows}。${stock}以上是费用与余量的确定性数字，锁座 ${context.limits.hold_minutes} 分钟内不扣款。`;
  }
  if (selected) {
    return (
      `${selected.title} 的含全部费用为 ¥${selected.price}` +
      (selected.value_score ? `，性价比分 ${selected.value_score}/10` : "") +
      (selected.remaining === 0 ? "，当前已售罄（可加入候补）。" : `，当前还剩 ${selected.remaining} 张。`)
    );
  }
  if (context.results.length > 0) {
    return (
      "当前列表里有这些票档：" +
      context.results
        .slice(0, 5)
        .map((show) => `${show.event_name ?? show.title}·${show.tier ?? ""} ¥${show.price}`)
        .join("、") +
      "。点开任意一场可以看到逐项费用和实时余量。"
    );
  }
  if (context.policies.length > 0) {
    const policy = context.policies[0];
    return `《${policy.title}》：${policy.content}`;
  }
  return "我还没有拿到本次界面的数据，没法给出确定回答。先打开一场演出或把问题说得更具体一些。";
}

/** 读取 SSE：`event: status|final|error`。 */
async function readStream(
  response: Response,
  onStatus?: (label: string) => void,
): Promise<AgentTurn> {
  const body = response.body;
  if (!body) throw new Error("响应没有内容");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: ChatResult | null = null;
  let streamingError: string | null = null;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
        const eventMatch = /^event:\s*(.+)$/m.exec(chunk);
        const dataMatch = /^data:\s*(.+)$/m.exec(chunk);
        if (!eventMatch || !dataMatch) continue;
        const event = eventMatch[1].trim();
        if (event === "status") {
          try {
            const payload = JSON.parse(dataMatch[1]) as { label?: string };
            if (payload.label) onStatus?.(payload.label);
          } catch {
            // 状态行损坏就忽略，不打断结果。
          }
        } else if (event === "final") {
          final = resultSchema.parse(JSON.parse(dataMatch[1]));
        } else if (event === "error") {
          try {
            streamingError = (JSON.parse(dataMatch[1]) as { error?: string }).error ?? "agent_error";
          } catch {
            streamingError = "agent_error";
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (!final) throw new Error(streamingError ?? "没有收到最终结果");
  return {
    answer: final.answer,
    sources: final.sources,
    cards: final.cards,
    proposal: final.proposal,
    followups: final.followups,
    mode: "live",
    model: "experiment-agents",
  };
}

export async function askQintaiAgent(options: AskOptions): Promise<AgentTurn> {
  const body = {
    role: options.role,
    message: options.message,
    history: options.history.slice(-8),
    accepted: options.accepted,
    context: options.context,
  };
  try {
    const response = await fetch(ROUTES[options.role], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(60000)])
        : AbortSignal.timeout(60000),
    });
    if (!response.ok) {
      const reason =
        response.status === 429
          ? "实时体验次数已用完"
          : response.status === 503
            ? "实时 Agent 未配置"
            : `Agent HTTP ${response.status}`;
      return fallbackTurn(options, reason);
    }
    if (!response.headers.get("content-type")?.includes("text/event-stream")) {
      return fallbackTurn(options, "响应不是事件流");
    }
    return await readStream(response, options.onStatus);
  } catch (error) {
    return fallbackTurn(
      options,
      error instanceof Error ? error.message : "Agent 调用失败",
    );
  }
}

/**
 * 琴台票务 Agent 代理（服务端）。顾客侧与运营侧共用同一段逻辑，只差上游路径、限流分桶
 * 与期望角色；浏览器永远拿不到 `EXPERIMENT_AGENT_TOKEN` 或上游地址。
 */

import { requestSchema, type Role } from "./schema";
import { checkQintaiRate, QintaiRateError, qintaiRateConfigured } from "./rate-limit";

function fail(status: number, retryAfter = 0) {
  const message =
    status === 429
      ? "实时体验次数已用完，请稍后再试，或继续使用页面上的确定性数据。"
      : status === 503
        ? "实时 Agent 当前未配置，请继续使用页面上的确定性数据。"
        : status === 403
          ? "请求来源无法验证。"
          : status === 413
            ? "请求内容过长，请缩短问题后重试。"
            : status === 415
              ? "请求格式不受支持。"
              : "Agent 暂时无法完成这项任务，请稍后重试。";
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
      },
    },
  );
}

export interface AgentRouteOptions {
  /** 上游服务里的路径，例如 `/works/qintai-ticketing/chat`。 */
  upstreamPath: string;
  /** 限流分桶，让顾客侧与运营侧互不挤占额度。 */
  scope: "chat" | "merchant";
  /** 该路由只接受这个角色。 */
  role: Role;
}

export async function qintaiAgentPost(
  request: Request,
  options: AgentRouteOptions,
): Promise<Response> {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail(403);
  if (!request.headers.get("content-type")?.includes("application/json")) return fail(415);

  const reader = request.body?.getReader();
  if (!reader) return fail(400);
  let raw = "";
  let size = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        return fail(413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return fail(400);
    }
    const parsed = requestSchema.safeParse(parsedJson);
    if (!parsed.success || parsed.data.role !== options.role) return fail(400);

    const base = process.env.EXPERIMENT_AGENT_URL;
    const token = process.env.EXPERIMENT_AGENT_TOKEN;
    if (!base || !token || !qintaiRateConfigured()) return fail(503);

    await checkQintaiRate(request, options.scope);

    const response = await fetch(`${base.replace(/\/$/, "")}${options.upstreamPath}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]),
    });
    if (
      !response.ok ||
      !response.body ||
      !response.headers.get("content-type")?.includes("text/event-stream")
    ) {
      return fail(response.status === 503 ? 503 : 502);
    }
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return fail(
      error instanceof QintaiRateError ? error.status : 502,
      error instanceof QintaiRateError ? error.retryAfter : 0,
    );
  } finally {
    reader.releaseLock();
  }
}

export async function qintaiAgentStatus(): Promise<Response> {
  const base = process.env.EXPERIMENT_AGENT_URL;
  const token = process.env.EXPERIMENT_AGENT_TOKEN;
  if (!base || !token || !qintaiRateConfigured()) {
    return Response.json({ live: false }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/works/qintai-ticketing/status`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    const body = response.ok ? await response.json() : null;
    return Response.json({ live: body?.live === true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ live: false }, { headers: { "Cache-Control": "no-store" } });
  }
}

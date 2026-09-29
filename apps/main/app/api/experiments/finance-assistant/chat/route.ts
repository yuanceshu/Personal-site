import { z } from "zod";
import { contextInputSchema } from "@/lib/works/finance-assistant/agent/context";
import { checkFinanceRate, FinanceRateError, financeRateConfigured } from "@/lib/works/finance-assistant/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 65;

const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  conversationHistory: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(10000) })).max(20).default([]),
  financeContext: contextInputSchema,
});

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("missing_body");
  let raw = "";
  let size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) throw new Error("too_large");
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    return JSON.parse(raw) as unknown;
  } finally { reader.releaseLock(); }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415 });
  try {
    const parsed = requestSchema.safeParse(await readBody(request));
    if (!parsed.success) return Response.json({ error: { code: "INVALID_REQUEST", issues: parsed.error.issues } }, { status: 400 });
    const base = process.env.EXPERIMENT_AGENT_URL;
    const token = process.env.EXPERIMENT_AGENT_TOKEN;
    if (!base || !token) return Response.json({ error: { code: "AGENT_NOT_CONFIGURED", message: "财务 Agent 服务尚未配置。" } }, { status: 503 });
    if (!financeRateConfigured()) return Response.json({ error: { code: "RATE_LIMIT_NOT_CONFIGURED", message: "财务 Agent 的公开限流尚未配置。" } }, { status: 503 });
    await checkFinanceRate(request);
    const origin = new URL(request.url).origin;
    const response = await fetch(`${base.replace(/\/$/, "")}/works/finance-assistant/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Finance-Tool-Url": `${origin}/api/experiments/finance-assistant/tool`,
        "X-Finance-Tool-Token": token,
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return Response.json({ error: { code: typeof body.error === "string" ? body.error : "AGENT_UNAVAILABLE", message: "财务 Agent 暂时无法响应。" } }, { status: response.status >= 500 ? 502 : response.status });
    }
    return Response.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof FinanceRateError) return Response.json({ error: { code: error.status === 429 ? "RATE_LIMITED" : "RATE_LIMIT_UNAVAILABLE", message: error.status === 429 ? "请求次数已达到演示上限，请稍后再试。" : "财务 Agent 的限流服务暂时不可用。" } }, { status: error.status, headers: error.retryAfter ? { "Retry-After": String(error.retryAfter) } : undefined });
    return Response.json({ error: { code: error instanceof Error && error.message === "too_large" ? "INPUT_TOO_LARGE" : "AGENT_UNAVAILABLE", message: "财务 Agent 暂时无法响应。" } }, { status: 502 });
  }
}

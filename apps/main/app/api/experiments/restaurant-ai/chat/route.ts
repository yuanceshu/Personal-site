import { requestSchema } from "@/lib/works/restaurant-ai/schema";
import { checkRestaurantRate, RestaurantRateError, restaurantRateConfigured } from "@/lib/works/restaurant-ai/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 65;

export async function GET() {
  const base = process.env.EXPERIMENT_AGENT_URL;
  const token = process.env.EXPERIMENT_AGENT_TOKEN;
  if (!base || !token || !restaurantRateConfigured())
    return Response.json({ live: false }, { headers: { "Cache-Control": "no-store" } });
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/works/restaurant-ai/status`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(3000),
    });
    const body = response.ok ? await response.json() : null;
    return Response.json({ live: body?.live === true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ live: false }, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  const fail = (status: number, retryAfter = 0) => Response.json({ error:
    status === 429 ? "实时体验次数已用完，请稍后再试，或浏览样例体验。" :
    status === 503 ? "实时 Agent 当前未配置，请浏览样例体验。" :
    status === 400 ? "输入内容无法处理，请检查后重试。" :
    "Agent 暂时无法完成这项任务，请稍后重试。",
  }, { status, headers: { "Cache-Control": "no-store", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) } });
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail(403);
  if (!request.headers.get("content-type")?.includes("application/json")) return fail(415);
  const reader = request.body?.getReader();
  if (!reader) return fail(400);
  let raw = "";
  let size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) { await reader.cancel(); return fail(413); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const parsed = requestSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return fail(400);
    const base = process.env.EXPERIMENT_AGENT_URL;
    const token = process.env.EXPERIMENT_AGENT_TOKEN;
    if (!base || !token) return fail(503);
    await checkRestaurantRate(request);
    const response = await fetch(`${base.replace(/\/$/, "")}/works/restaurant-ai/chat`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data), cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]),
    });
    if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream"))
      return fail(response.status === 503 ? 503 : 502);
    return new Response(response.body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  } catch (error) {
    return fail(error instanceof RestaurantRateError ? error.status : 502, error instanceof RestaurantRateError ? error.retryAfter : 0);
  } finally { reader.releaseLock(); }
}

import { requestSchema, responseSchema } from "@/lib/works/island-travel/schema";
import { checkRate, TravelServiceError } from "@/lib/works/island-travel/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const fail = (status: number, retryAfter = 0) => Response.json({ error:
    status === 429 ? "这段时间的 AI 体验次数已用完。稍后再试，或切换演示模式继续行程。" :
    status === 400 ? "请检查输入，不要发送真实手机号或证件号码。" :
    "AI 暂时没有完成理解。可以重试，或切换演示模式继续。",
  }, { status, headers: { ...headers, ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) } });
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
    let payload;
    try { payload = requestSchema.parse(JSON.parse(raw)); } catch { return fail(400); }
    const base = process.env.EXPERIMENT_AGENT_URL;
    const token = process.env.EXPERIMENT_AGENT_TOKEN;
    if (!base || !token) return fail(503);
    await checkRate(request);
    const response = await fetch(`${base.replace(/\/$/, "")}/works/island-travel/chat`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload), cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(50000)]),
    });
    if (!response.ok) return fail([429, 503, 504].includes(response.status) ? response.status : 502);
    const body = await response.text();
    if (body.length > 16000) return fail(502);
    const parsed = responseSchema.safeParse(JSON.parse(body));
    if (!parsed.success) return fail(502);
    return Response.json(parsed.data, { headers });
  } catch (error) {
    return fail(error instanceof TravelServiceError ? error.status : 502, error instanceof TravelServiceError ? error.retryAfter : 0);
  } finally { reader.releaseLock(); }
}

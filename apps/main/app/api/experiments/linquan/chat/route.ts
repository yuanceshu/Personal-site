import { runAgentWithOptionalLlm } from "@/lib/works/linquan/agent";
import { chatApiInputSchema } from "@/lib/works/linquan/schemas/domain";
import { chatApiOutputSchema } from "@/lib/works/linquan/schemas/tool";

export const runtime = "nodejs";
export const maxDuration = 30;

function fail(status: number) {
  const message = status === 413 ? "请求内容过长，请缩短问题后重试。" : status === 403 ? "请求来源无法验证。" : "输入内容无法处理，请稍后重试。";
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

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
      if (size > 32768) { await reader.cancel(); throw new Error("too_large"); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    return JSON.parse(raw) as unknown;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail(403);
  if (!request.headers.get("content-type")?.includes("application/json")) return fail(415);
  try {
    const body = await readBody(request);
    const parsed = chatApiInputSchema.safeParse(body);
    if (!parsed.success) return fail(400);
    const result = await runAgentWithOptionalLlm(parsed.data.message, parsed.data.context, parsed.data.history, request);
    return Response.json(chatApiOutputSchema.parse(result), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error instanceof Error && error.message === "too_large" ? 413 : 400);
  }
}

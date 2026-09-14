import { requestSchema } from "@/lib/works/ai-solution-lab/schema";
import { runStage, ServiceError } from "@/lib/works/ai-solution-lab/service";

// Local integration budget: model <=30s x 2, backend <=65s, proxy <=70s.
// Deployment must provide at least 75s or revise this entire chain after measurement.
export const maxDuration = 75;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const fail = (status: number) =>
    Response.json(
      { error: "当前无法完成这一步，请检查输入或稍后重试。" },
      { status, headers },
    );
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return fail(403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    return fail(415);
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
      if (size > 32768) {
        await reader.cancel();
        return fail(413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const parsed = requestSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return fail(400);
    try {
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(70000),
      ]);
      return Response.json(await runStage(parsed.data, signal), { headers });
    } catch (error) {
      return fail(error instanceof ServiceError ? error.status : 502);
    }
  } catch {
    return fail(400);
  } finally {
    reader.releaseLock();
  }
}

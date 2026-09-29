import { planTourRoute } from "@/lib/works/linquan/tools";
import { planTourRouteInputSchema } from "@/lib/works/linquan/schemas/domain";
import { tourApiOutputSchema } from "@/lib/works/linquan/schemas/tool";

export const runtime = "nodejs";
export const maxDuration = 10;

function fail(status: number) {
  const message = status === 413 ? "请求内容过长，请稍后重试。" : status === 403 ? "请求来源无法验证。" : "路线暂时无法生成，请检查条件后重试。";
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail(403);
  if (!request.headers.get("content-type")?.includes("application/json")) return fail(415);
  try {
    const raw = await request.text();
    if (raw.length > 32768) return fail(413);
    const parsed = planTourRouteInputSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return fail(400);
    return Response.json(tourApiOutputSchema.parse({ plan: planTourRoute(parsed.data) }), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail(400);
  }
}

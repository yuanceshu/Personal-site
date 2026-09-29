import { NextResponse } from "next/server";
import { executeTool } from "@/lib/works/medical-ai/src/agent/tool-registry";
import { captureMedicalState, clearMedicalRuntime, medicalActionRequestSchema, parseMedicalState, restoreMedicalState } from "@/lib/works/medical-ai/state";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "请求来源无法验证。" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "请求参数不合法。" }, { status: 400 }); }
  const parsed = medicalActionRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "请求参数不合法。" }, { status: 400 });
  const { patient_id: patientId, session_id: sessionId } = parsed.data;
  restoreMedicalState(parseMedicalState(parsed.data.state), sessionId, patientId);
  try {
    executeTool("update_visit_stage", { stage: parsed.data.stage }, { patientId });
    return NextResponse.json({ state: captureMedicalState(sessionId, patientId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "状态更新失败。" }, { status: 400 });
  } finally { clearMedicalRuntime(sessionId, patientId); }
}

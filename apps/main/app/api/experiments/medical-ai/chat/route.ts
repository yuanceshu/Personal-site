import { NextResponse } from "next/server";
import { explainWithOptionalAgent } from "@/lib/works/medical-ai/agent";
import { mainAgent } from "@/lib/works/medical-ai/src/agent/runtime";
import { ChatResponseSchema } from "@/lib/works/medical-ai/src/schemas/chat";
import { captureMedicalState, clearMedicalRuntime, medicalChatRequestSchema, parseMedicalState, restoreMedicalState } from "@/lib/works/medical-ai/state";

export const runtime = "nodejs";
export const maxDuration = 30;

function fail(status: number) {
  const message = status === 429 ? "实时体验次数已用完，请稍后再试。" : status === 503 ? "实时 Agent 当前未配置，请稍后再试。" : status === 413 ? "请求内容过长，请缩短后重试。" : "输入内容无法处理，请稍后重试。";
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
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
      if (size > 65536) { await reader.cancel(); throw new Error("too_large"); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    return JSON.parse(raw) as unknown;
  } finally { reader.releaseLock(); }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail(403);
  if (!request.headers.get("content-type")?.includes("application/json")) return fail(415);
  let raw: unknown;
  try { raw = await readBody(request); } catch (error) { return fail(error instanceof Error && error.message === "too_large" ? 413 : 400); }
  const parsed = medicalChatRequestSchema.safeParse(raw);
  if (!parsed.success) return fail(400);

  const { message, patient_id: patientId, session_id: sessionId, state: rawState, history } = parsed.data;
  const state = parseMedicalState(rawState);
  restoreMedicalState(state, sessionId, patientId);
  try {
    const result = await mainAgent.handle({ message, patient_id: patientId, session_id: sessionId });
    const live = await explainWithOptionalAgent({ message, state, result, history, request });
    const response = ChatResponseSchema.parse({ ...result, message: live.answer ?? result.message, mode: live.answer ? "llm" : "fallback" });
    return NextResponse.json({ ...response, state: captureMedicalState(sessionId, patientId), agent_mode: live.mode }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail(400);
  } finally {
    clearMedicalRuntime(sessionId, patientId);
  }
}

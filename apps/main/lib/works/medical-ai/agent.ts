import type { AgentResult } from "./src/agent/main-agent";
import type { MedicalClientState } from "./state";
import { checkMedicalRate } from "./rate-limit";

export async function explainWithOptionalAgent(input: {
  message: string;
  state: MedicalClientState;
  result: AgentResult;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  request: Request;
}) {
  const base = process.env.EXPERIMENT_AGENT_URL?.replace(/\/$/, "");
  const token = process.env.EXPERIMENT_AGENT_TOKEN;
  if (!base || !token) return { answer: null, mode: "demo" as const };

  try {
    await checkMedicalRate(input.request);
    const response = await fetch(`${base}/works/medical-ai/chat`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.message,
        context: {
          visit_context: input.result.visit_context,
          debug: input.result.debug,
          tool_calls: input.result.tool_calls,
        },
        history: input.history.slice(-8),
        deterministic_answer: input.result.message,
      }),
      cache: "no-store",
      signal: AbortSignal.any([input.request.signal, AbortSignal.timeout(15000)]),
    });
    if (!response.ok) throw new Error(`Agent HTTP ${response.status}`);
    const payload = await response.json() as { mode?: string; answer?: string };
    if (payload.mode !== "live" || typeof payload.answer !== "string" || !payload.answer.trim()) throw new Error("invalid_agent_response");
    return { answer: payload.answer.trim(), mode: "live" as const };
  } catch {
    return { answer: null, mode: "fallback" as const };
  }
}

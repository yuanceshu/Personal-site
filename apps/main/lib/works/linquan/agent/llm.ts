import { contextBrief } from "@/lib/works/linquan/agent/context";
import { getLlmConfig } from "@/lib/works/linquan/agent/config";
import { checkLinquanRate } from "@/lib/works/linquan/rate-limit";
import type { VisitorContext } from "@/lib/works/linquan/types";
import { z } from "zod";

export interface LlmExplanationInput {
  message: string;
  context: VisitorContext;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  deterministicAnswer: string;
  tool?: string;
  data?: unknown;
}

const responseSchema = z.object({ mode: z.literal("live"), answer: z.string().trim().min(1).max(2400) });

export async function explainWithOptionalLlm(input: LlmExplanationInput, request?: Request) {
  const config = getLlmConfig();
  if (!config.enabled || !config.baseUrl || !config.token) return { answer: null, mode: "demo" as const, model: undefined, reason: config.reason };
  try {
    if (request) await checkLinquanRate(request);
    const response = await fetch(config.baseUrl + "/works/linquan/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.token}` },
      signal: request ? AbortSignal.any([request.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      body: JSON.stringify({
        message: input.message,
        context: contextBrief(input.context),
        history: input.history.slice(-8),
        deterministicAnswer: input.deterministicAnswer,
        tool: input.tool ?? null,
        toolResult: input.data ?? null,
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Agent HTTP " + response.status);
    const payload = responseSchema.parse(await response.json());
    return { answer: payload.answer, mode: "llm" as const, model: "experiment-agents" };
  } catch (error) {
    return { answer: null, mode: "fallback" as const, model: "experiment-agents", reason: error instanceof Error ? error.message : "Agent 调用失败" };
  }
}

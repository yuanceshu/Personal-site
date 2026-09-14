import { responseSchema, type LabRequest } from "./schema";

export class ServiceError extends Error {
  constructor(public status: number) {
    super("实验服务暂时不可用");
  }
}
export async function runStage(payload: LabRequest, signal: AbortSignal) {
  const base = process.env.EXPERIMENT_AGENT_URL;
  const token = process.env.EXPERIMENT_AGENT_TOKEN;
  if (!base || !token) throw new ServiceError(503);
  const response = await fetch(
    `${base.replace(/\/$/, "")}/works/ai-solution-lab/generate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new ServiceError(
      [422, 429, 503].includes(response.status) ? response.status : 502,
    );
  const raw = await response.text();
  if (raw.length > 100000) throw new ServiceError(502);
  const result = responseSchema.parse(JSON.parse(raw));
  if (result.stage !== payload.stage) throw new ServiceError(502);
  return result;
}

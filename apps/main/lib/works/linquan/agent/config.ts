import { z } from "zod";

const envSchema = z.object({
  EXPERIMENT_AGENT_URL: z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional()),
  EXPERIMENT_AGENT_TOKEN: z.string().optional(),
});

export function getLlmConfig() {
  const env = envSchema.parse({
    EXPERIMENT_AGENT_URL: process.env.EXPERIMENT_AGENT_URL,
    EXPERIMENT_AGENT_TOKEN: process.env.EXPERIMENT_AGENT_TOKEN,
  });
  const enabled = Boolean(env.EXPERIMENT_AGENT_URL && env.EXPERIMENT_AGENT_TOKEN);
  return {
    enabled,
    token: env.EXPERIMENT_AGENT_TOKEN,
    baseUrl: env.EXPERIMENT_AGENT_URL?.replace(/\/$/, ""),
    reason: enabled ? undefined : "实时 Agent 未配置，当前使用规则 Demo。",
  };
}

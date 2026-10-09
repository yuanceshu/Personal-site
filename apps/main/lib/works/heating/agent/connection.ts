import { HeatingError } from "../errors";

/** Server-to-server only. Protection credentials never enter model prompts or browser events. */
export function agentConnection(origin: string) {
  const base = process.env.EXPERIMENT_AGENT_URL;
  const token = process.env.EXPERIMENT_AGENT_TOKEN;
  if (!base || !token) throw new HeatingError("agent_unconfigured", 503);
  let endpoint: URL;
  try { endpoint = new URL("works/heating/chat", `${base.replace(/\/$/, "")}/`); }
  catch { throw new HeatingError("agent_unconfigured", 503); }
  const configured = new URL(base);
  if (configured.username || configured.password || configured.search || configured.hash ||
      (endpoint.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && !process.env.VERCEL && endpoint.protocol === "http:" && ["localhost", "127.0.0.1"].includes(endpoint.hostname)))) throw new HeatingError("agent_unconfigured", 503);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`, "Content-Type": "application/json",
    "X-Heating-Tool-Url": `${origin}/api/experiments/heating/tool`,
    "X-Heating-Action-Url": `${origin}/api/experiments/heating/agent-action`,
  };
  if (process.env.HEATING_AGENT_PROTECTION_BYPASS) headers["x-vercel-protection-bypass"] = process.env.HEATING_AGENT_PROTECTION_BYPASS;
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers["X-Heating-Callback-Bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return { endpoint, headers };
}

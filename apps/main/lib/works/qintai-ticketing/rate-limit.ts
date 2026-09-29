/**
 * 琴台票务实时 Agent 限流（照抄主站林泉 / 食智助手模式）。
 *
 * 生产：Vercel 上按 `x-vercel-forwarded-for` 的 HMAC 哈希做 Redis REST 原子计数，每 10 分钟
 * 最多 12 次；本地开发用内存计数。环境变量前缀 `QINTAI_`，与作品一一对应。
 */

import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";

export class QintaiRateError extends Error {
  constructor(
    public status: number,
    public retryAfter = 0,
  ) {
    super("Qintai Ticketing Agent unavailable");
  }
}

const localRequests: number[] = [];
/** 每 10 分钟最多 12 次。 */
const WINDOW_MS = 600_000;
const MAX_REQUESTS = 12;

const rateScript = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - 600000)
if redis.call('ZCARD', KEYS[1]) >= 12 then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, math.max(1, math.ceil((tonumber(oldest[2]) + 600000 - now) / 1000))}
end
redis.call('ZADD', KEYS[1], now, ARGV[1])
redis.call('EXPIRE', KEYS[1], 600)
return {1, 0}`;

export function qintaiRateConfigured() {
  const base = process.env.QINTAI_RATE_REDIS_URL ?? process.env.REDIS_URL;
  const token = process.env.QINTAI_RATE_REDIS_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return (
    process.env.VERCEL !== "1" ||
    Boolean(
      base?.startsWith("https://") &&
        token &&
        process.env.QINTAI_RATE_SALT,
    )
  );
}

/** `scope` 让对话与运营台各自计数，互不挤占额度。 */
export async function checkQintaiRate(request: Request, scope: "chat" | "merchant" = "chat") {
  const url = new URL(request.url);
  if (
    !process.env.VERCEL &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    const now = Date.now();
    while (localRequests.length && localRequests[0] <= now - WINDOW_MS) localRequests.shift();
    if (localRequests.length >= MAX_REQUESTS)
      throw new QintaiRateError(429, Math.ceil((localRequests[0] + WINDOW_MS - now) / 1000));
    localRequests.push(now);
    return;
  }
  const base = process.env.QINTAI_RATE_REDIS_URL ?? process.env.REDIS_URL;
  const token = process.env.QINTAI_RATE_REDIS_TOKEN ?? process.env.KV_REST_API_TOKEN;
  const salt = process.env.QINTAI_RATE_SALT;
  const ip = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (process.env.VERCEL !== "1" || !ip || !isIP(ip) || !base?.startsWith("https://") || !token || !salt)
    throw new QintaiRateError(503);
  const hash = createHmac("sha256", salt).update(ip).digest("hex");
  const key = `qintai-ticketing:${scope}:${process.env.VERCEL_ENV ?? "preview"}:${hash}`;
  try {
    const response = await fetch(base, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", rateScript, "1", key, randomUUID()]),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(3000)]),
      cache: "no-store",
    });
    if (!response.ok) throw new QintaiRateError(503);
    const body = await response.json();
    if (body.error || !Array.isArray(body.result) || body.result.length !== 2)
      throw new QintaiRateError(503);
    const [allowed, retry] = body.result;
    if (allowed === 0 && Number.isInteger(retry) && retry > 0)
      throw new QintaiRateError(429, retry);
    if (allowed !== 1) throw new QintaiRateError(503);
  } catch (error) {
    if (error instanceof QintaiRateError) throw error;
    throw new QintaiRateError(503);
  }
}

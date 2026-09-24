import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";

export class RestaurantRateError extends Error {
  constructor(public status: number, public retryAfter = 0) { super("Restaurant Agent unavailable"); }
}

const localRequests: number[] = [];
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

export function restaurantRateConfigured() {
  return process.env.VERCEL !== "1" || Boolean(process.env.RESTAURANT_RATE_REDIS_URL?.startsWith("https://") && process.env.RESTAURANT_RATE_REDIS_TOKEN && process.env.RESTAURANT_RATE_SALT);
}

export async function checkRestaurantRate(request: Request) {
  const url = new URL(request.url);
  if (!process.env.VERCEL && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    const now = Date.now();
    while (localRequests.length && localRequests[0] <= now - 600000) localRequests.shift();
    if (localRequests.length >= 30) throw new RestaurantRateError(429, Math.ceil((localRequests[0] + 600000 - now) / 1000));
    localRequests.push(now);
    return;
  }
  const base = process.env.RESTAURANT_RATE_REDIS_URL;
  const token = process.env.RESTAURANT_RATE_REDIS_TOKEN;
  const salt = process.env.RESTAURANT_RATE_SALT;
  const ip = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (process.env.VERCEL !== "1" || !ip || !isIP(ip) || !base?.startsWith("https://") || !token || !salt)
    throw new RestaurantRateError(503);
  const hash = createHmac("sha256", salt).update(ip).digest("hex");
  const key = `restaurant-ai:${process.env.VERCEL_ENV ?? "preview"}:${hash}`;
  try {
    const response = await fetch(base, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", rateScript, "1", key, randomUUID()]),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(3000)]), cache: "no-store",
    });
    if (!response.ok) throw new RestaurantRateError(503);
    const body = await response.json();
    if (body.error || !Array.isArray(body.result) || body.result.length !== 2) throw new RestaurantRateError(503);
    const [allowed, retry] = body.result;
    if (allowed === 0 && Number.isInteger(retry) && retry > 0) throw new RestaurantRateError(429, retry);
    if (allowed !== 1) throw new RestaurantRateError(503);
  } catch (error) {
    if (error instanceof RestaurantRateError) throw error;
    throw new RestaurantRateError(503);
  }
}

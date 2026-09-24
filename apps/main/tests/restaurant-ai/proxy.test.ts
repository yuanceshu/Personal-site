import { test } from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../../app/api/experiments/restaurant-ai/chat/route";
import { checkRestaurantRate, RestaurantRateError } from "../../lib/works/restaurant-ai/rate-limit";

const url = "http://localhost:3000/api/experiments/restaurant-ai/chat";
const headers = { Origin: "http://localhost:3000", "Content-Type": "application/json" };
const payload = JSON.stringify({ role: "customer", message: "停车吗？", history: [], accepted: [] });
const request = (body = payload, custom: Record<string, string> = headers) => new Request(url, { method: "POST", headers: custom, body });

test("restaurant proxy rejects invalid origin, type, size and role", async () => {
  assert.equal((await POST(request(payload, { ...headers, Origin: "https://bad.test" }))).status, 403);
  assert.equal((await POST(request(payload, { ...headers, "Content-Type": "text/plain" }))).status, 415);
  assert.equal((await POST(request("x".repeat(32769)))).status, 413);
  assert.equal((await POST(request(JSON.stringify({ role: "admin", message: "hi", history: [], accepted: [] })))).status, 400);
});

test("restaurant proxy forwards only fixed path, bearer and SSE", async () => {
  const saved = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.VERCEL;
    process.env.EXPERIMENT_AGENT_URL = "http://backend.test";
    process.env.EXPERIMENT_AGENT_TOKEN = "test-only";
    const event = 'event: status\ndata: {"label":"查询演示桌位"}\n\nevent: final\ndata: {"mode":"live"}\n\n';
    globalThis.fetch = async (target, init) => {
      assert.equal(target, "http://backend.test/works/restaurant-ai/chat");
      assert.equal(new Headers(init!.headers).get("Authorization"), "Bearer test-only");
      assert.equal(JSON.parse(init!.body as string).role, "customer");
      return new Response(event, { headers: { "Content-Type": "text/event-stream" } });
    };
    const response = await POST(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(await response.text(), event);
    delete process.env.EXPERIMENT_AGENT_TOKEN;
    assert.equal((await POST(request())).status, 503);
  } finally { process.env = saved; globalThis.fetch = originalFetch; }
});

test("restaurant status reports sample mode without a configured live service", async () => {
  const saved = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.EXPERIMENT_AGENT_URL;
    assert.deepEqual(await (await GET()).json(), { live: false });
    process.env.EXPERIMENT_AGENT_URL = "http://backend.test";
    process.env.EXPERIMENT_AGENT_TOKEN = "test-only";
    process.env.VERCEL = "1";
    delete process.env.RESTAURANT_RATE_REDIS_URL;
    assert.deepEqual(await (await GET()).json(), { live: false });
    delete process.env.VERCEL;
    globalThis.fetch = async target => {
      assert.equal(target, "http://backend.test/works/restaurant-ai/status");
      return Response.json({ live: true });
    };
    assert.deepEqual(await (await GET()).json(), { live: true });
  } finally { process.env = saved; globalThis.fetch = originalFetch; }
});

test("public restaurant calls fail closed without Redis and use their own hashed namespace", async () => {
  const saved = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    delete process.env.RESTAURANT_RATE_REDIS_URL;
    const publicRequest = request(payload, { ...headers, "x-vercel-forwarded-for": "192.0.2.5" });
    await assert.rejects(checkRestaurantRate(publicRequest), (error: unknown) => error instanceof RestaurantRateError && error.status === 503);
    process.env.RESTAURANT_RATE_REDIS_URL = "https://redis.test";
    process.env.RESTAURANT_RATE_REDIS_TOKEN = "test-redis";
    process.env.RESTAURANT_RATE_SALT = "salt";
    globalThis.fetch = async (_target, init) => {
      const command = JSON.parse(init!.body as string);
      assert.ok(command[3].startsWith("restaurant-ai:preview:"));
      assert.ok(!JSON.stringify(command).includes("192.0.2.5"));
      return Response.json({ result: [0, 600] });
    };
    await assert.rejects(checkRestaurantRate(publicRequest), (error: unknown) => error instanceof RestaurantRateError && error.status === 429 && error.retryAfter === 600);
  } finally { process.env = saved; globalThis.fetch = originalFetch; }
});

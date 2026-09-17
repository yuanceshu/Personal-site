import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../../app/api/experiments/island-travel/chat/route";
import { checkRate, TravelServiceError } from "../../lib/works/island-travel/rate-limit";

const url = "http://localhost:3000/api/experiments/island-travel/chat";
const headers = { Origin: "http://localhost:3000", "Content-Type": "application/json" };
const request = (body: string, custom: Record<string, string> = headers) => new Request(url, { method: "POST", headers: custom, body });
test("proxy origin, content, size and sensitive fields before model calls", async () => {
  assert.equal((await POST(request("{}", { ...headers, Origin: "https://bad.test" }))).status, 403);
  assert.equal((await POST(request("{}", { ...headers, "Content-Type": "text/plain" }))).status, 415);
  assert.equal((await POST(request("x".repeat(32769)))).status, 413);
  assert.equal((await POST(request('{"message":"13800000000"}'))).status, 400);
});
test("public rate counter fails closed, hashes IP and isolates environments", async () => {
  const saved = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    delete process.env.ISLAND_RATE_REDIS_URL;
    await assert.rejects(checkRate(request('{}')), (e: unknown) => e instanceof TravelServiceError && e.status === 503);
    process.env.ISLAND_RATE_REDIS_URL = "https://redis.test";
    process.env.ISLAND_RATE_REDIS_TOKEN = "test-redis-secret";
    process.env.ISLAND_RATE_SALT = "salt";
    const publicRequest = request('{}', { ...headers, "x-vercel-forwarded-for": "192.0.2.5" });
    globalThis.fetch = async (_url, init) => {
      const command = JSON.parse(init!.body as string);
      assert.equal(command[0], "EVAL");
      assert.ok(command[3].startsWith("island-travel:preview:"));
      assert.ok(!JSON.stringify(command).includes("192.0.2.5"));
      return Response.json({ result: [0, 599] });
    };
    await assert.rejects(checkRate(publicRequest), (e: unknown) => e instanceof TravelServiceError && e.status === 429 && e.retryAfter === 599);
    globalThis.fetch = async () => Response.json({ result: [1, 0] });
    await checkRate(publicRequest);
    globalThis.fetch = async () => Response.json({ error: "bad" });
    await assert.rejects(checkRate(publicRequest), (e: unknown) => e instanceof TravelServiceError && e.status === 503);
    await assert.rejects(checkRate(request('{}', { ...headers, "x-forwarded-for": "192.0.2.5" })));
  } finally { process.env = saved; globalThis.fetch = originalFetch; }
});
test("proxy validates upstream data and uses only fixed endpoint and server credentials", async () => {
  const saved = { ...process.env }; const originalFetch = globalThis.fetch;
  try {
    delete process.env.VERCEL;
    process.env.EXPERIMENT_AGENT_URL = "http://backend.test";
    process.env.EXPERIMENT_AGENT_TOKEN = "test-backend-secret";
    globalThis.fetch = async (target, init) => {
      assert.equal(target, "http://backend.test/works/island-travel/chat");
      assert.equal(new Headers(init!.headers).get("Authorization"), "Bearer test-backend-secret");
      return Response.json({ intent: "search_trips", conditions: {}, mode: "live" });
    };
    const result = await POST(request('{"message":"明天去三亚"}'));
    assert.equal(result.status, 200); assert.equal(result.headers.get("Cache-Control"), "no-store");
    assert.ok(!(await result.text()).includes("secret"));
    globalThis.fetch = async () => Response.json({ intent: "pay", price: 100, mode: "live" });
    assert.equal((await POST(request('{"message":"明天去三亚"}'))).status, 502);
    delete process.env.EXPERIMENT_AGENT_TOKEN;
    assert.equal((await POST(request('{"message":"明天去三亚"}'))).status, 503);
  } finally { process.env = saved; globalThis.fetch = originalFetch; }
});

test("local development allows ten calls, rejects the eleventh and expires the window", async () => {
  const saved = { ...process.env }; const now = Date.now;
  try {
    delete process.env.VERCEL;
    let clock = now() + 600001;
    Date.now = () => clock;
    for (let i = 0; i < 10; i++) await checkRate(request('{}'));
    await assert.rejects(checkRate(request('{}')), (e: unknown) => e instanceof TravelServiceError && e.status === 429 && e.retryAfter === 600);
    clock += 600001;
    await checkRate(request('{}'));
  } finally { process.env = saved; Date.now = now; }
});

/**
 * 主站代理的边界：浏览器永远拿不到上游地址或 Token，代理只转发固定路径、固定角色，
 * 并且在生产环境里对公开调用独立限流（`qintai-ticketing:<scope>:<env>:<ip 哈希>`）。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { POST as customerPost } from "../../app/api/experiments/qintai-ticketing/chat/route";
import { POST as merchantPost } from "../../app/api/experiments/qintai-ticketing/merchant/route";
import { GET as statusGet } from "../../app/api/experiments/qintai-ticketing/status/route";
import { checkQintaiRate, QintaiRateError } from "../../lib/works/qintai-ticketing/rate-limit";
import { EMPTY_CONTEXT } from "../../lib/works/qintai-ticketing/schema";

const ORIGIN = "http://localhost:3000";
const URL = `${ORIGIN}/api/experiments/qintai-ticketing/chat`;
const HEADERS = { Origin: ORIGIN, "Content-Type": "application/json" };

function body(role: "customer" | "merchant", message = "还有连座吗？") {
  return JSON.stringify({
    role,
    message,
    history: [],
    accepted: [],
    context: { ...EMPTY_CONTEXT, page: role === "merchant" ? "merchant" : "show" },
  });
}

function request(payload = body("customer"), headers: Record<string, string> = HEADERS) {
  return new Request(URL, { method: "POST", headers, body: payload });
}

test("代理拒绝异常来源、格式、体积与角色错配", async () => {
  assert.equal((await customerPost(request(body("customer"), { ...HEADERS, Origin: "https://bad.test" }))).status, 403);
  assert.equal(
    (await customerPost(request(body("customer"), { ...HEADERS, "Content-Type": "text/plain" }))).status,
    415,
  );
  assert.equal((await customerPost(request("x".repeat(32769)))).status, 413);

  // 请求体本身合法，但角色与路由对不上。
  assert.equal((await customerPost(request(body("merchant")))).status, 400);
  assert.equal((await merchantPost(request(body("customer")))).status, 400);
  // 契约之外的多余字段同样被拒。
  const extra = JSON.parse(body("customer")) as Record<string, unknown>;
  extra.privateToken = "x";
  assert.equal((await customerPost(request(JSON.stringify(extra)))).status, 400);
});

test("代理只转发固定上游路径与 Bearer，并原样透传事件流", async () => {
  const saved = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.VERCEL;
    // 上游未配置时关闭，不泄漏任何细节。
    delete process.env.EXPERIMENT_AGENT_URL;
    assert.equal((await customerPost(request())).status, 503);

    process.env.EXPERIMENT_AGENT_URL = "http://backend.test/";
    process.env.EXPERIMENT_AGENT_TOKEN = "test-only";
    const event = 'event: status\ndata: {"label":"核对票档细节"}\n\nevent: final\ndata: {"mode":"live"}\n\n';
    const seen: string[] = [];
    globalThis.fetch = async (target, init) => {
      seen.push(String(target));
      assert.equal(new Headers(init!.headers).get("Authorization"), "Bearer test-only");
      return new Response(event, { headers: { "Content-Type": "text/event-stream" } });
    };

    const response = await customerPost(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(await response.text(), event);
    assert.deepEqual(seen, ["http://backend.test/works/qintai-ticketing/chat"]);

    await merchantPost(request(body("merchant")));
    assert.deepEqual(seen[1], "http://backend.test/works/qintai-ticketing/merchant");

    // 上游说 503（模型未配置）时透传 503，而不是伪装成 502。
    globalThis.fetch = async () => new Response(null, { status: 503 });
    assert.equal((await customerPost(request())).status, 503);
  } finally {
    process.env = saved;
    globalThis.fetch = originalFetch;
  }
});

test("状态探测在未配置、生产缺 Redis、以及上游可用之间切换", async () => {
  const saved = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.EXPERIMENT_AGENT_URL;
    assert.deepEqual(await (await statusGet()).json(), { live: false });

    process.env.EXPERIMENT_AGENT_URL = "http://backend.test";
    process.env.EXPERIMENT_AGENT_TOKEN = "test-only";
    process.env.VERCEL = "1";
    delete process.env.QINTAI_RATE_REDIS_URL;
    // 生产环境没有限流存储就不对外暴露实时能力。
    assert.deepEqual(await (await statusGet()).json(), { live: false });

    delete process.env.VERCEL;
    globalThis.fetch = async (target) => {
      assert.equal(String(target), "http://backend.test/works/qintai-ticketing/status");
      return Response.json({ live: true });
    };
    assert.deepEqual(await (await statusGet()).json(), { live: true });

    globalThis.fetch = async () => {
      throw new Error("upstream down");
    };
    assert.deepEqual(await (await statusGet()).json(), { live: false });
  } finally {
    process.env = saved;
    globalThis.fetch = originalFetch;
  }
});

test("公开调用在缺 Redis 时关闭，并使用自己命名的哈希桶", async () => {
  const saved = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    delete process.env.QINTAI_RATE_REDIS_URL;
    const publicRequest = request(body("customer"), { ...HEADERS, "x-vercel-forwarded-for": "192.0.2.5" });
    await assert.rejects(
      checkQintaiRate(publicRequest),
      (error: unknown) => error instanceof QintaiRateError && error.status === 503,
    );

    process.env.QINTAI_RATE_REDIS_URL = "https://redis.test";
    process.env.QINTAI_RATE_REDIS_TOKEN = "test-redis";
    process.env.QINTAI_RATE_SALT = "salt";
    globalThis.fetch = async (_target, init) => {
      const command = JSON.parse(init!.body as string) as unknown[];
      assert.ok(String(command[3]).startsWith("qintai-ticketing:chat:preview:"));
      // 桶名里只有哈希，没有原始 IP。
      assert.ok(!JSON.stringify(command).includes("192.0.2.5"));
      return Response.json({ result: [0, 600] });
    };
    await assert.rejects(
      checkQintaiRate(publicRequest),
      (error: unknown) =>
        error instanceof QintaiRateError && error.status === 429 && error.retryAfter === 600,
    );

    globalThis.fetch = async (_target, init) => {
      const command = JSON.parse(init!.body as string) as unknown[];
      assert.ok(String(command[3]).startsWith("qintai-ticketing:merchant:preview:"));
      return Response.json({ result: [1, 0] });
    };
    await checkQintaiRate(
      request(body("merchant"), { ...HEADERS, "x-vercel-forwarded-for": "192.0.2.5" }),
      "merchant",
    );
  } finally {
    process.env = saved;
    globalThis.fetch = originalFetch;
  }
});

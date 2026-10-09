import assert from "node:assert/strict";
import test from "node:test";
import { RequestHeatingStore } from "@/lib/works/heating/store";
import { apiClient } from "./api-client";
process.env.HEATING_SESSION_SECRET = "stateless-test-signing-key-at-least-32-characters";

test("每请求 Store 独立；状态快照承接原引擎 CAS，无进程全局业务对象", async () => {
  const one = new RequestHeatingStore();
  assert.equal(await one.compareAndSwap("k", null, "one", 60), true);
  assert.equal(await one.compareAndSwap("k", null, "two", 60), false);
  const next = new RequestHeatingStore(one.entries());
  assert.equal(await next.read("k"), "one");
  assert.equal(await new RequestHeatingStore().read("k"), null);
});

test("VERCEL/production 无 Redis、SQLite 配置仍能连续办理；刷新重新建页，旧 Cookie 不参与恢复", async () => {
  const previous = { ...process.env };
  try {
    Object.assign(process.env, { VERCEL: "1", NODE_ENV: "production" });
    delete process.env.HEATING_REDIS_REST_URL; delete process.env.HEATING_REDIS_REST_TOKEN; delete process.env.HEATING_LOCAL_SQLITE_PATH;
    const first = apiClient(); assert.equal((await first.call("session")).status, 200);
    const { result: order } = await first.execute("create_payment", { billId: "bill-house-A" });
    await first.execute("simulate_payment", { orderId: order.id, outcome: "success" });
    assert.equal((await first.records()).bills[0].status, "paid");
    const fresh = apiClient(); await fresh.call("session", {}, { cookie: "heating_demo_session=old-cookie" });
    assert.notEqual(fresh.actor.sandboxId, first.actor.sandboxId);
    assert.equal((await fresh.records()).bills[0].status, "unpaid");
  } finally { for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]; Object.assign(process.env, previous); }
});


test("超大页面状态请求立即拒绝，不等待未消费的请求分支", async () => {
  const { sessionPOST } = await import("@/lib/works/heating/api");
  const request = new Request("http://localhost/api/experiments/heating/session", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json", "x-heating-demo": "1" }, body: JSON.stringify({ padding: "x".repeat(512001) }) });
  const response = await sessionPOST(request);
  assert.equal(response.status, 413);
});

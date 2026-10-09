import assert from "node:assert/strict";
import test from "node:test";
import { apiClient } from "./api-client";
process.env.HEATING_SESSION_SECRET = "page-test-secret-more-than-thirty-two-characters";

test("同页状态查询保留业务；新页面、刷新与恢复按钮独立初始化；不写浏览器 Cookie", async () => {
  const a = apiClient(); await a.call("session");
  const { result: order } = await a.execute("create_payment", { billId: "bill-house-A" });
  assert.equal((await a.call("snapshot")).body.result.records.orders[0].id, order.id);
  assert.equal((await a.call("snapshot")).body.result.records.orders[0].id, order.id);
  const b = apiClient(); await b.call("session"); assert.equal((await b.records()).orders.length, 0);
  assert.equal((await a.call("restart", { confirmed: false })).status, 400);
  await a.call("restart", { confirmed: true }); assert.equal((await a.records()).orders.length, 0);
});

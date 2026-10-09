import assert from "node:assert/strict";
import test from "node:test";
import { apiClient } from "./api-client";
import { png } from "./helpers";

process.env.HEATING_SESSION_SECRET = "test-page-capsule-key-at-least-32-characters";
process.env.EXPERIMENT_AGENT_TOKEN = "test-agent-token";

test("无数据库业务 API：请求连续、明确确认、模拟支付与幂等、页面及身份隔离", async () => {
  const a = apiClient(), b = apiClient();
  assert.equal((await a.call("action", { name: "query_records", input: {} })).status, 401);
  const open = await a.call("session"); assert.equal(open.status, 200); assert.equal(open.response.headers.has("set-cookie"), false);
  await b.call("session"); assert.notEqual(a.actor.sandboxId, b.actor.sandboxId);
  assert.equal((await a.call("action", { name: "query_records", input: {} }, { origin: "https://evil.example" })).status, 403);
  const before = a.state!;
  const bytes = Buffer.from(before, "base64url"); bytes[30] ^= 1;
  const { actionPOST } = await import("@/lib/works/heating/api");
  const forged = new Request("http://localhost/api/experiments/heating/action", { method: "POST", headers: { origin: "http://localhost", "x-heating-demo": "1", "content-type": "application/json" }, body: JSON.stringify({ name: "query_records", input: {}, demoState: bytes.toString("base64url") }) });
  assert.equal((await actionPOST(forged)).status, 401);
  assert.equal((await a.call("action", { name: "create_payment", input: { billId: "bill-house-A", idempotencyKey: "unconfirmed" } })).status, 403);
  const { result: order, action } = await a.execute("create_payment", { billId: "bill-house-A" });
  assert.equal((await a.call("action", action)).body.result.id, order.id);
  await a.execute("simulate_payment", { orderId: order.id, outcome: "success" });
  const paid = await a.records(); assert.equal(paid.bills[0].status, "paid"); assert.equal(paid.orders.length, 1); assert.equal(paid.invoices.length, 1);
  assert.equal((await b.records()).bills[0].status, "unpaid");
  await a.call("session", { userId: "B" }); assert.equal((await a.records()).houses.length, 0);
  assert.equal((await a.call("action", { name: "query_bill", input: { houseId: "house-A", year: "2026-2027" } })).status, 404);
  await a.execute("bind_house", { account: "DEMO-H002", name: "演示住户B", phone: "DEMO-PHONE-B" });
  assert.equal((await a.records()).houses.length, 1);
  await a.call("session", { userId: "A" }); assert.equal((await a.records()).invoices.length, 1);
  const fresh = apiClient(); await fresh.call("session"); assert.equal((await fresh.records()).bills[0].status, "unpaid");
  await a.call("restart", { confirmed: true }); assert.equal((await a.records()).orders.length, 0);
  assert.equal((await b.records()).bills[0].status, "unpaid");
});

test("材料与补件在当前页面状态包连续，原文件不保存，Agent 不能伪造提交", async () => {
  const client = apiClient(); await client.call("session", { userId: "D" });
  assert.equal((await client.records()).applications[0].status, "needs_more_materials");
  const photo = new File([Buffer.concat([Buffer.from(await png().arrayBuffer()), Buffer.from("new-photo")])], "新施工.png", { type: "image/png" });
  const upload = await client.upload("application-D", "construction", photo); assert.equal(upload.status, 200); assert.equal(upload.body.result.fileName, "新施工.png");
  assert.equal(upload.body.result.storageMode, "demo_placeholder");
  await client.execute("resubmit_application", { applicationId: "application-D" });
  const records = await client.records(); assert.equal(records.applications.length, 1); assert.equal(records.applications[0].status, "resubmitted");
  assert.equal((await client.call("tool", { name: "query_records", input: {} })).status, 401);
  assert.equal((await client.call("reset", { confirmed: true })).status, 401);
});

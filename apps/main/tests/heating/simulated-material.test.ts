import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { apiClient } from "./api-client";

process.env.HEATING_SESSION_SECRET = "simulated-material-page-secret-at-least-32";

test("纯 JSON 模拟材料：服务端预设、重复请求和点击、完整性、锁定及刷新隔离", async () => {
  const client = apiClient(); await client.call("session");
  const draft = await client.call("action", { name: "create_draft", input: { houseId: "house-A", year: "2026-2027", idempotencyKey: randomUUID() } });
  assert.equal(draft.status, 200); const app = draft.body.result;
  const input = { applicationId: app.id, type: "ownership", idempotencyKey: randomUUID() };
  const first = await client.call("simulate-material", input);
  assert.equal(first.status, 200); assert.equal(first.body.result.fileName, "产权证明（演示材料）.pdf");
  assert.equal(first.body.result.storageMode, "demo_placeholder");
  const replay = await client.call("simulate-material", input);
  assert.equal(replay.body.result.id, first.body.result.id);
  const click = await client.call("simulate-material", { ...input, idempotencyKey: randomUUID() });
  assert.equal(click.body.result.id, first.body.result.id);
  assert.equal((await client.records()).applications[0].materials.length, 1);
  const submission = { name: "submit_application", input: { applicationId: app.id, idempotencyKey: randomUUID() } };
  const card = await client.call("confirmation", submission);
  assert.equal(card.status, 200);
  const incomplete = await client.call("action", { ...submission, input: { ...submission.input, confirmationId: card.body.result.confirmationId } });
  assert.equal(incomplete.status, 422);
  assert.equal(incomplete.body.error, "materials_incomplete");
  assert.equal((await client.call("simulate-material", { ...input, type: "construction" })).body.error, "idempotency_conflict");
  for (const extra of [{ fileName: "真实信息.pdf" }, { file: "bytes" }, { userId: "E" }, { sha256: "a".repeat(64) }]) {
    assert.equal((await client.call("simulate-material", { ...input, ...extra })).status, 400);
  }
  assert.equal((await client.call("simulate-material", { applicationId: app.id, type: "construction", idempotencyKey: randomUUID() })).status, 200);
  await client.execute("submit_application", { applicationId: app.id });
  assert.equal((await client.call("simulate-material", { ...input, idempotencyKey: randomUUID() })).body.error, "materials_locked");
  assert.equal((await client.records()).applications[0].materials.length, 2);
  const fresh = apiClient(); await fresh.call("session");
  assert.equal((await fresh.records()).applications.length, 0);
});

test("模拟补件生成新材料，退回记录不能复用；跨住户和页面访问拒绝", async () => {
  const client = apiClient(); await client.call("session", { userId: "D" });
  const before = (await client.records()).applications[0];
  const input = { applicationId: before.id, type: "construction", idempotencyKey: randomUUID() };
  const result = await client.call("simulate-material", input);
  assert.equal(result.status, 200); assert.equal(result.body.result.fileName, "断暖施工照片（演示补件）.png");
  assert.equal(before.returnedMaterialIds.includes(result.body.result.id), false);
  await client.execute("resubmit_application", { applicationId: before.id });
  assert.equal((await client.records()).applications[0].id, before.id);
  const other = apiClient(); await other.call("session");
  assert.equal((await other.call("simulate-material", { ...input, idempotencyKey: randomUUID() })).body.error, "record_not_found");
  await client.call("session", { userId: "A" });
  assert.equal((await client.call("simulate-material", { ...input, idempotencyKey: randomUUID() })).body.error, "record_not_found");
});

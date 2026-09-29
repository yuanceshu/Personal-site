import { test } from "node:test";
import assert from "node:assert/strict";
import { runAgent } from "../../lib/works/linquan/agent";
import { defaultVisitorContext } from "../../lib/works/linquan/storage/session";

test("模拟文创取货", () => {
  const result = runAgent("帮我查询文创取货码 LQ-2048", defaultVisitorContext);
  assert.equal(result.tool, "pickup_creative"); assert.match(result.answer, /明信片/);
});
test("创建人工求助工单", () => {
  const result = runAgent("我需要人工求助", defaultVisitorContext);
  assert.equal(result.tool, "request_staff_help"); assert.match(result.answer, /工单号/);
});

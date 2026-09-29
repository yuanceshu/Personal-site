import { test } from "node:test";
import assert from "node:assert/strict";
import { runAgent, runAgentWithOptionalLlm } from "../../lib/works/linquan/agent";
import { defaultVisitorContext } from "../../lib/works/linquan/storage/session";

test("自然语言更新当前位置", () => {
  const result = runAgent("我到观景台了", defaultVisitorContext);
  assert.equal(result.tool, "set_current_location"); assert.equal(result.context?.currentSpotId, "cloud-platform"); assert.ok(result.context?.visitedSpotIds.includes("cloud-platform"));
});
test("服务问题进入服务 Tool", () => {
  const result = runAgent("最近的厕所在哪里？", defaultVisitorContext);
  assert.equal(result.tool, "get_service_info"); assert.match(result.answer, /入口卫生间/);
});
test("未配置服务时保留规则 Demo", async () => {
  const result = await runAgentWithOptionalLlm("景区几点开放？", defaultVisitorContext);
  assert.equal(result.engine?.mode, "demo"); assert.equal(result.tool, "get_scenic_info");
});
test("业务 Tool 失败时不被 Agent 改写", async () => {
  const result = await runAgentWithOptionalLlm("LQ-9999", defaultVisitorContext);
  assert.equal(result.tool, "pickup_creative"); assert.match(result.answer, /没有找到/); assert.equal(result.engine?.mode, "demo");
});

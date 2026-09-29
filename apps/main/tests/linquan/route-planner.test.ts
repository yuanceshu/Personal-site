import { test } from "node:test";
import assert from "node:assert/strict";
import { planTourRoute } from "../../lib/works/linquan/tools/route-planner";
import type { VisitorProfile } from "../../lib/works/linquan/types";

const baseProfile: VisitorProfile = { adults: 2, children: 0, elderly: 0, fitness: "medium", availableMinutes: 180, interests: ["scenery"], avoidStairs: false, voiceGuideEnabled: false };

test("普通成人生成可返回入口的路线", () => {
  const plan = planTourRoute({ currentSpotId: "dawn-gate", profile: baseProfile });
  assert.ok(plan.stops.length > 0); assert.equal(plan.returnSpotId, "dawn-gate"); assert.ok(plan.totalMinutes <= baseProfile.availableMinutes); assert.ok(plan.returnMinutes > 0);
});
test("长者路线避开高台阶山脊", () => {
  const plan = planTourRoute({ currentSpotId: "dawn-gate", profile: { ...baseProfile, elderly: 1, availableMinutes: 150 } });
  assert.equal(plan.stops.some((stop) => stop.spotId === "sunridge-garden"), false); assert.match(plan.rationale.join(" "), /长者/);
});
test("儿童和自然兴趣提高观察节点优先级", () => {
  const plan = planTourRoute({ currentSpotId: "dawn-gate", profile: { ...baseProfile, children: 1, interests: ["nature", "family"], availableMinutes: 120 } });
  assert.equal(plan.stops.some((stop) => ["moon-stream", "fern-observatory"].includes(stop.spotId)), true);
});
test("低体力少台阶优先低难度节点", () => {
  const plan = planTourRoute({ currentSpotId: "cedar-boardwalk", profile: { ...baseProfile, fitness: "low", avoidStairs: true, availableMinutes: 75 } });
  assert.equal(plan.stops.some((stop) => stop.spotId === "sunridge-garden"), false); assert.ok(plan.totalMinutes <= 75);
});
test("从半途景点继续规划不重复当前点", () => {
  const plan = planTourRoute({ currentSpotId: "pine-rest", profile: { ...baseProfile, availableMinutes: 90 } });
  assert.equal(plan.currentSpotId, "pine-rest"); assert.equal(plan.stops.every((stop) => stop.spotId !== "pine-rest"), true);
});
test("时间很短时保留返程约束", () => {
  const plan = planTourRoute({ currentSpotId: "cloud-platform", profile: { ...baseProfile, availableMinutes: 35 } });
  assert.ok(plan.totalMinutes <= 35); assert.ok(plan.returnMinutes > 0);
});

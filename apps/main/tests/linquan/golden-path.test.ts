import { test } from "node:test";
import assert from "node:assert/strict";
import { runAgent } from "../../lib/works/linquan/agent";
import { defaultVisitorContext, parseStoredContext } from "../../lib/works/linquan/storage/session";
import { getNatureTask, getServiceInfo, planTourRoute } from "../../lib/works/linquan/tools";
import type { VisitorProfile } from "../../lib/works/linquan/types";

const baseProfile: VisitorProfile = { adults: 2, children: 0, elderly: 0, fitness: "medium", availableMinutes: 180, interests: ["scenery"], avoidStairs: false, voiceGuideEnabled: false };

test("路线始终保留返程约束", () => {
  const cases = [
    { currentSpotId: "dawn-gate", profile: { ...baseProfile, availableMinutes: 120 } },
    { currentSpotId: "dawn-gate", profile: { ...baseProfile, elderly: 1, children: 1, availableMinutes: 90, avoidStairs: true } },
    { currentSpotId: "dawn-gate", profile: { ...baseProfile, adults: 1, fitness: "low", availableMinutes: 45 } },
    { currentSpotId: "cloud-platform", profile: { ...baseProfile, availableMinutes: 15 } },
  ];
  const plans = cases.map(planTourRoute);
  assert.equal(plans.slice(0, 3).every((plan, index) => plan.feasible && plan.totalMinutes <= cases[index].profile.availableMinutes), true);
  assert.equal(plans[1].stops.some((stop) => stop.spotId === "sunridge-garden"), false);
  assert.ok(plans[2].stops.length <= plans[0].stops.length);
  assert.equal(plans[3].feasible, false); assert.equal(plans[3].totalMinutes, 0); assert.ok(plans[3].requiredMinutes > 15);
});
test("连续对话承接画像、路线和位置", () => {
  const first = runAgent("我们两个大人，带一个老人和一个孩子，只有 90 分钟，尽量少走台阶。", defaultVisitorContext);
  assert.equal(first.tool, "plan_tour_route"); assert.deepEqual(first.context?.profile, { ...defaultVisitorContext.profile, adults: 2, elderly: 1, children: 1, availableMinutes: 90, avoidStairs: true });
  const arrived = runAgent("我到观景台了", first.context); assert.equal(arrived.tool, "set_current_location"); assert.equal(arrived.context?.currentSpotId, "cloud-platform"); assert.deepEqual(arrived.context?.currentRoute, first.context?.currentRoute);
  const restroom = runAgent("附近厕所在哪里？", arrived.context); assert.equal(restroom.tool, "get_service_info"); assert.match(restroom.answer, /卫生间/);
  const next = runAgent("下一站去哪？", arrived.context); assert.equal(next.tool, "advise_route");
  const summit = runAgent("现在还来得及去山顶吗？", arrived.context); assert.equal(summit.tool, "advise_route"); assert.match(summit.answer, /需要约|可以继续/);
});
test("活动列表支持序号追问和报名", () => {
  const list = runAgent("今天有什么活动？", defaultVisitorContext); assert.equal(list.tool, "query_events"); assert.equal(list.context?.conversation.activityIds.length, 3);
  const second = runAgent("第二个适合孩子吗？", list.context, [{ role: "assistant", content: list.answer }]); assert.equal(second.tool, "query_events"); assert.match(second.answer, /适合孩子/);
  const registration = runAgent("帮我们报名，两位成人一个孩子。", second.context, [{ role: "assistant", content: second.answer }]); assert.equal(registration.tool, "register_event"); assert.match(registration.answer, /3 人/); assert.equal(registration.action?.type, "event-registered");
});
test("不虚构取货并按位置选择服务", () => {
  const invalid = runAgent("LQ-9999", defaultVisitorContext); assert.equal(invalid.tool, "pickup_creative"); assert.match(invalid.answer, /没有找到/);
  const valid = runAgent("LQ-2048", defaultVisitorContext); assert.equal(valid.tool, "pickup_creative"); assert.match(valid.answer, /明信片/);
  const names = ["dawn-gate", "moon-stream", "cloud-platform"].map((currentSpotId) => getServiceInfo({ currentSpotId, type: "restroom" })?.service.name); assert.equal(new Set(names).size, 3);
});
test("自然任务随同行者、兴趣、地点和时间变化", () => {
  const noChild = getNatureTask({ currentSpotId: "cedar-boardwalk", profile: { ...baseProfile, interests: ["photography"], availableMinutes: 30 } });
  const child = getNatureTask({ currentSpotId: "cedar-boardwalk", profile: { ...baseProfile, children: 1, interests: ["nature", "family"], availableMinutes: 30 } });
  const short = getNatureTask({ currentSpotId: "cedar-boardwalk", profile: { ...baseProfile, availableMinutes: 3 } });
  const stream = getNatureTask({ currentSpotId: "moon-stream", profile: { ...baseProfile, interests: ["nature"], availableMinutes: 30 } });
  assert.notEqual(noChild?.id, child?.id); assert.equal(stream?.id, "stream-life"); assert.equal(short, null);
});
test("旧版本地状态缺字段时安全恢复", () => {
  const restored = parseStoredContext({ ...defaultVisitorContext, conversation: undefined, currentRoute: defaultVisitorContext.currentRoute });
  assert.deepEqual(restored.conversation, { activityIds: [], selectedActivityId: null, pendingPickup: false });
});

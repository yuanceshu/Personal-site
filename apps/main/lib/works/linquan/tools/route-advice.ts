import { scenicSpotMap } from "@/lib/works/linquan/data";
import { routeAdviceInputSchema, routeAdviceOutputSchema } from "@/lib/works/linquan/schemas/domain";
import { shortestPath } from "@/lib/works/linquan/tools/pathfinding";

export function adviseRoute(rawInput: unknown) {
  const input = routeAdviceInputSchema.parse(rawInput);
  const context = input.context;
  const visited = new Set(context.visitedSpotIds);
  const nextPlanned = context.currentRoute?.stops.find((stop) => !visited.has(stop.spotId) && stop.spotId !== context.currentSpotId)?.spotId;
  const targetId = input.destinationSpotId ?? nextPlanned ?? context.currentRoute?.returnSpotId ?? "dawn-gate";
  const target = scenicSpotMap[targetId];
  if (!target) throw new Error("无法识别要前往的目标景点");
  const toTarget = shortestPath(context.currentSpotId, targetId, context.profile, context.profile.avoidStairs);
  const back = shortestPath(targetId, "dawn-gate", context.profile, context.profile.avoidStairs);
  const stay = targetId === "dawn-gate" ? 0 : target.recommendedStayMinutes;
  const requiredMinutes = (toTarget.minutes === Infinity ? 0 : toTarget.minutes) + stay + (back.minutes === Infinity ? 0 : back.minutes);
  const canVisit = toTarget.minutes !== Infinity && back.minutes !== Infinity && requiredMinutes <= context.profile.availableMinutes;
  const status = targetId === context.currentSpotId ? "destination" : targetId === "dawn-gate" ? "return" : nextPlanned ? "continuing" : "off-route";
  const explanation = targetId === context.currentSpotId
    ? "你已经在这个地点。"
    : canVisit
      ? "从" + scenicSpotMap[context.currentSpotId].shortName + "前往" + target.shortName + "，包含停留和返程后仍在当前时间内。"
      : "从" + scenicSpotMap[context.currentSpotId].shortName + "前往" + target.shortName + "并返回入口需要约 " + requiredMinutes + " 分钟，超过当前剩余时间，不建议继续前往。";
  return routeAdviceOutputSchema.parse({
    status,
    nextSpotId: targetId,
    remainingMinutes: context.profile.availableMinutes,
    requiredMinutes,
    returnMinutes: back.minutes === Infinity ? 0 : back.minutes,
    canVisit,
    explanation,
    pathIds: toTarget.path,
  });
}

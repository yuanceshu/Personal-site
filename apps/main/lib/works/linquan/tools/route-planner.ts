import { scenicSpotMap, routeConnections } from "@/lib/works/linquan/data";
import { planTourRouteInputSchema, tourPlanSchema } from "@/lib/works/linquan/schemas/domain";
import { shortestPath, walkingMinutes } from "@/lib/works/linquan/tools/pathfinding";
import type { Difficulty, FitnessLevel, Interest, ScenicSpot, StairLevel, TourPlan, TourStop, VisitorProfile } from "@/lib/works/linquan/types";

const ENTRY_ID = "dawn-gate";
const difficultyPenalty: Record<Difficulty, number> = { easy: 0, moderate: 4, challenging: 12 };
const stairPenalty: Record<StairLevel, number> = { none: 0, low: 2, medium: 7, high: 15 };
const fitnessPenalty: Record<FitnessLevel, number> = { high: 0, medium: 3, low: 8 };
const connectionMap = new Map(routeConnections.map((connection) => [connection.from + "->" + connection.to, connection]));
const outgoing = new Map<string, typeof routeConnections>();
for (const connection of routeConnections) outgoing.set(connection.from, [...(outgoing.get(connection.from) ?? []), connection]);

function getConnection(from: string, to: string) {
  return connectionMap.get(from + "->" + to);
}

function pathCost(path: string[], profile: VisitorProfile) {
  return path.slice(1).reduce((total, spotId, index) => total + walkingMinutes(getConnection(path[index], spotId)?.walkMinutes ?? 999, profile), 0);
}

function enumeratePaths(start: string, visited: string[], maxDepth = 4) {
  const paths: string[][] = [[]];
  const visit = (current: string, path: string[]) => {
    if (path.length >= maxDepth) return;
    for (const edge of outgoing.get(current) ?? []) {
      if (edge.to === start || path.includes(edge.to) || visited.includes(edge.to) || (edge.to === ENTRY_ID && path.length > 0)) continue;
      const nextPath = [...path, edge.to];
      paths.push(nextPath);
      visit(edge.to, nextPath);
    }
  };
  visit(start, []);
  return paths;
}

function scoreSpot(spot: ScenicSpot, profile: VisitorProfile) {
  let score = 2 - difficultyPenalty[spot.difficulty] - fitnessPenalty[profile.fitness];
  if (profile.interests.length) score += profile.interests.reduce((total, interest: Interest) => total + (spot.tags.includes(interest) ? 10 : 0) + (interest === "nature" && spot.tags.includes("nature") ? 8 : 0), 0);
  if (profile.children > 0) score += spot.childFriendly ? 9 : -4;
  if (profile.elderly > 0) score += spot.elderlyFriendly ? 12 : -14;
  if (profile.avoidStairs) score -= stairPenalty[spot.stairs] * 2;
  if (profile.fitness === "low" && spot.difficulty === "easy") score += 8;
  return score;
}

function reasonForSpot(spot: ScenicSpot, profile: VisitorProfile) {
  const reasons: string[] = [];
  if (profile.elderly > 0 && spot.elderlyFriendly) reasons.push("对长者更友好");
  if (profile.children > 0 && spot.childFriendly) reasons.push("适合亲子一起探索");
  const matchingInterest = profile.interests.find((interest) => spot.tags.includes(interest));
  if (matchingInterest) reasons.push("符合" + interestLabel[matchingInterest] + "偏好");
  if (spot.stairs === "none" || (profile.avoidStairs && spot.stairs === "low")) reasons.push("台阶负担较低");
  return reasons[0] ?? "作为路线中的自然转折点";
}

const interestLabel: Record<Interest, string> = { scenery: "风景", nature: "自然", culture: "文化", family: "亲子", photography: "摄影", relaxation: "放松" };

export function planTourRoute(rawInput: unknown): TourPlan {
  const input = planTourRouteInputSchema.parse(rawInput);
  const start = scenicSpotMap[input.currentSpotId];
  if (!start) throw new Error("找不到当前景点，无法规划路线");
  const visited = input.visitedSpotIds.filter((id) => id !== start.id);
  const candidates = enumeratePaths(start.id, visited).map((spotIds) => {
    const fullPath = [start.id, ...spotIds];
    const returnInfo = shortestPath(fullPath[fullPath.length - 1], ENTRY_ID, input.profile, input.profile.avoidStairs);
    const walkMinutes = pathCost(fullPath, input.profile);
    const stayMinutes = spotIds.reduce((total, spotId) => total + scenicSpotMap[spotId].recommendedStayMinutes, 0);
    const totalMinutes = walkMinutes + stayMinutes + returnInfo.minutes;
    const score = spotIds.reduce((total, spotId) => total + scoreSpot(scenicSpotMap[spotId], input.profile), 0) - spotIds.length * 1.5;
    return { spotIds, returnInfo, walkMinutes, stayMinutes, totalMinutes, score };
  }).filter((candidate) => Number.isFinite(candidate.returnInfo.minutes));

  const withinBudget = candidates.filter((candidate) => candidate.totalMinutes <= input.profile.availableMinutes);
  const selected = [...withinBudget].sort((a, b) => b.score - a.score || a.totalMinutes - b.totalMinutes)[0];
  const fallback = [...candidates].sort((a, b) => a.totalMinutes - b.totalMinutes)[0];
  const requiredMinutes = selected?.totalMinutes ?? fallback?.totalMinutes ?? 0;
  const feasible = Boolean(selected);
  const chosen = selected ?? { spotIds: [], returnInfo: fallback?.returnInfo ?? shortestPath(start.id, ENTRY_ID, input.profile, input.profile.avoidStairs), walkMinutes: 0, stayMinutes: 0, totalMinutes: 0, score: 0 };

  const stops: TourStop[] = [];
  let previous = start.id;
  for (const [index, spotId] of chosen.spotIds.entries()) {
    const spot = scenicSpotMap[spotId];
    const connection = getConnection(previous, spotId);
    stops.push({ spotId, order: index + 1, walkMinutesFromPrevious: connection ? walkingMinutes(connection.walkMinutes, input.profile) : 0, stayMinutes: spot.recommendedStayMinutes, reason: reasonForSpot(spot, input.profile) });
    previous = spotId;
  }
  const returnPathIds = chosen.returnInfo.path;
  const summary = feasible && stops.length
    ? "从" + start.shortName + "出发，推荐 " + stops.map((stop) => scenicSpotMap[stop.spotId].shortName).join(" → ") + "，最后返回晨雾入口。"
    : feasible ? "从" + start.shortName + "直接返回晨雾入口，当前时间更适合先补给或调整行程。" : "从" + start.shortName + "出发，剩余时间不足以完成安全返程，暂不推荐继续前往新的景点。";
  const rationale = [
    input.profile.elderly > 0 ? "已降低高台阶和对长者不友好的节点权重。" : "已根据同行人数评估步行节奏。",
    input.profile.children > 0 ? "已提高亲子友好、可观察和可停留节点的优先级。" : "已按景色、自然与休息需求排序。",
    input.profile.avoidStairs ? "已优先选择低台阶连接，并避开高台阶山脊段。" : "保留了可选的山腰视野节点。",
    feasible ? "总时长包含 " + chosen.returnInfo.minutes + " 分钟返程预留。" : "最短安全返程需要 " + chosen.returnInfo.minutes + " 分钟，当前仅剩 " + input.profile.availableMinutes + " 分钟。",
  ];

  return tourPlanSchema.parse({
    id: "tour-" + Date.now(), currentSpotId: start.id, stops, totalMinutes: feasible ? chosen.totalMinutes : 0,
    requiredMinutes, feasible, returnMinutes: chosen.returnInfo.minutes, returnPathIds, returnSpotId: ENTRY_ID,
    summary, rationale, generatedAt: new Date().toISOString(),
  });
}

export function getShortestReturnMinutes(from: string, profile?: VisitorProfile) {
  return shortestPath(from, ENTRY_ID, profile, profile?.avoidStairs ?? false).minutes;
}

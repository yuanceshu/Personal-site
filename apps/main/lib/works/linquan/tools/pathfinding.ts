import { routeConnections, scenicSpotMap } from "@/lib/works/linquan/data";
import type { VisitorProfile } from "@/lib/works/linquan/types";

export function walkingMinutes(baseMinutes: number, profile?: VisitorProfile) {
  if (!profile) return baseMinutes;
  const pace = 1
    + (profile.fitness === "low" ? 0.3 : 0)
    + (profile.elderly > 0 ? 0.2 : 0)
    + (profile.children > 0 ? 0.1 : 0)
    + (profile.adults + profile.children + profile.elderly > 5 ? 0.05 : 0);
  return Math.ceil(baseMinutes * pace);
}

export function shortestPath(from: string, to: string, profile?: VisitorProfile, preferFewStairs = false) {
  if (!scenicSpotMap[from] || !scenicSpotMap[to]) throw new Error("路径起点或终点不存在");
  const best = new Map<string, number>([[from, 0]]);
  const previous = new Map<string, string>();
  const queue = [{ id: from, cost: 0 }];
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    if (current.cost !== best.get(current.id)) continue;
    if (current.id === to) break;
    for (const edge of routeConnections.filter((item) => item.from === current.id)) {
      const stairCost = preferFewStairs ? ({ none: 0, low: 0, medium: 40, high: 100 } as const)[edge.stairs] : 0;
      const cost = current.cost + walkingMinutes(edge.walkMinutes, profile) + stairCost;
      if (cost < (best.get(edge.to) ?? Infinity)) {
        best.set(edge.to, cost);
        previous.set(edge.to, current.id);
        queue.push({ id: edge.to, cost });
      }
    }
  }
  if (!best.has(to)) return { path: [] as string[], minutes: Infinity };
  const path = [to];
  while (path[0] !== from) path.unshift(previous.get(path[0])!);
  const minutes = path.slice(1).reduce((total, id, index) => {
    const edge = routeConnections.find((item) => item.from === path[index] && item.to === id)!;
    return total + walkingMinutes(edge.walkMinutes, profile);
  }, 0);
  return { path, minutes };
}

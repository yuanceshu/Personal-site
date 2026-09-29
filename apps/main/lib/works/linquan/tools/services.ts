import { scenicSpotMap, servicePoints } from "@/lib/works/linquan/data";
import { getServiceInfoInputSchema } from "@/lib/works/linquan/schemas/domain";
import { getServiceInfoOutputSchema } from "@/lib/works/linquan/schemas/tool";
import { shortestPath } from "@/lib/works/linquan/tools/pathfinding";

export function getServiceInfo(rawInput: unknown) {
  const input = getServiceInfoInputSchema.parse(rawInput);
  if (!scenicSpotMap[input.currentSpotId]) throw new Error("当前地点数据不存在");
  const candidates = servicePoints
    .filter((service) => !input.type || service.type === input.type)
    .map((service) => {
      const route = shortestPath(input.currentSpotId, service.spotId);
      return { service, distance: route.minutes === Infinity ? Infinity : route.minutes + service.distanceMinutes };
    })
    .filter((candidate) => Number.isFinite(candidate.distance));
  return getServiceInfoOutputSchema.parse(candidates.sort((a, b) => a.distance - b.distance)[0] ?? null);
}

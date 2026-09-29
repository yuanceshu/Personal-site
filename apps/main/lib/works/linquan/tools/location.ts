import { scenicSpotMap } from "@/lib/works/linquan/data";
import { setCurrentLocationInputSchema, visitorContextSchema } from "@/lib/works/linquan/schemas/domain";
import { getCurrentLocationOutputSchema, setCurrentLocationOutputSchema } from "@/lib/works/linquan/schemas/tool";
import type { VisitorContext } from "@/lib/works/linquan/types";

export function getCurrentLocation(rawContext: unknown) {
  const context = visitorContextSchema.parse(rawContext);
  const spot = scenicSpotMap[context.currentSpotId];
  if (!spot) throw new Error("当前地点数据不存在");
  return getCurrentLocationOutputSchema.parse({ currentSpot: spot, visitedSpotIds: context.visitedSpotIds, route: context.currentRoute });
}

export function setCurrentLocation(rawInput: unknown): { context: VisitorContext; spot: typeof scenicSpotMap[string] } {
  const input = setCurrentLocationInputSchema.parse(rawInput);
  const spot = scenicSpotMap[input.spotId];
  if (!spot) throw new Error("无法更新到未知地点");
  const nextContext = visitorContextSchema.parse({ ...input.context, currentSpotId: spot.id, visitedSpotIds: Array.from(new Set([...input.context.visitedSpotIds, spot.id])), updatedAt: new Date().toISOString() });
  return setCurrentLocationOutputSchema.parse({ context: nextContext, spot });
}

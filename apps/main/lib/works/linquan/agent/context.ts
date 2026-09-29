import { scenicSpotMap } from "@/lib/works/linquan/data";
import { visitorContextSchema } from "@/lib/works/linquan/schemas/domain";
import type { VisitorContext } from "@/lib/works/linquan/types";

export function normalizeContext(rawContext: unknown): VisitorContext {
  const context = visitorContextSchema.parse(rawContext);
  if (!scenicSpotMap[context.currentSpotId]) throw new Error("VisitorContext 的当前位置不存在");
  return context;
}

export function contextBrief(context: VisitorContext) {
  const spot = scenicSpotMap[context.currentSpotId];
  return {
    currentSpotName: spot.name,
    currentSpotId: spot.id,
    profile: context.profile,
    hasRoute: Boolean(context.currentRoute),
    routeSummary: context.currentRoute?.summary ?? null,
    visitedSpotIds: context.visitedSpotIds,
  };
}

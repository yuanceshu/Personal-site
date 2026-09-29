import { z } from "zod";
import type { ChatMessage, VisitorContext } from "@/lib/works/linquan/types";
import { visitorContextSchema } from "@/lib/works/linquan/schemas/domain";

export const defaultVisitorContext: VisitorContext = {
  currentSpotId: "dawn-gate",
  profile: { adults: 2, children: 0, elderly: 0, fitness: "medium", availableMinutes: 180, interests: ["scenery"], avoidStairs: false, voiceGuideEnabled: false },
  currentRoute: null,
  conversation: { activityIds: [], selectedActivityId: null, pendingPickup: false },
  visitedSpotIds: ["dawn-gate"],
  updatedAt: new Date().toISOString(),
};

const chatMessageSchema = z.object({ id: z.string(), role: z.enum(["user", "assistant"]), content: z.string(), createdAt: z.string(), engine: z.object({ mode: z.enum(["demo", "llm", "fallback"]), model: z.string().optional(), reason: z.string().optional() }).optional(), tool: z.string().optional(), action: z.object({ type: z.enum(["location-updated", "route-created", "event-registered"]), label: z.string() }).optional() });
export const chatHistorySchema = z.array(chatMessageSchema).max(100);

export function parseStoredContext(value: unknown): VisitorContext {
  return visitorContextSchema.parse(value);
}

export function parseStoredHistory(value: unknown): ChatMessage[] {
  return chatHistorySchema.parse(value);
}

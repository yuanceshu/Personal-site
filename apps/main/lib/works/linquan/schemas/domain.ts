import { z } from "zod";

export const difficultySchema = z.enum(["easy", "moderate", "challenging"]);
export const stairsSchema = z.enum(["none", "low", "medium", "high"]);
export const fitnessSchema = z.enum(["low", "medium", "high"]);
export const interestSchema = z.enum(["scenery", "nature", "culture", "family", "photography", "relaxation"]);

export const scenicSpotSchema = z.object({
  id: z.string(), name: z.string(), shortName: z.string(), description: z.string(),
  recommendedStayMinutes: z.number().int().positive(), difficulty: difficultySchema,
  stairs: stairsSchema, elderlyFriendly: z.boolean(), childFriendly: z.boolean(),
  facilities: z.array(z.string()), tags: z.array(interestSchema), nextSpotIds: z.array(z.string()), highlights: z.array(z.string()),
});

export const visitorProfileSchema = z.object({
  adults: z.number().int().min(0).max(20), children: z.number().int().min(0).max(20), elderly: z.number().int().min(0).max(20),
  fitness: fitnessSchema, availableMinutes: z.number().int().min(0).max(600), interests: z.array(interestSchema),
  avoidStairs: z.boolean(), voiceGuideEnabled: z.boolean(),
});

export const routeConnectionSchema = z.object({ from: z.string(), to: z.string(), walkMinutes: z.number().int().positive(), stairs: stairsSchema });
export const tourStopSchema = z.object({ spotId: z.string(), order: z.number().int().positive(), walkMinutesFromPrevious: z.number().int().min(0), stayMinutes: z.number().int().positive(), reason: z.string() });
export const tourPlanSchema = z.object({
  id: z.string(), currentSpotId: z.string(), stops: z.array(tourStopSchema), totalMinutes: z.number().int().min(0), requiredMinutes: z.number().int().min(0).default(0), feasible: z.boolean().default(true),
  returnMinutes: z.number().int().min(0), returnSpotId: z.string(), returnPathIds: z.array(z.string()).default([]), summary: z.string(), rationale: z.array(z.string()), generatedAt: z.string(),
});
export const activitySchema = z.object({ id: z.string(), name: z.string(), time: z.string(), duration: z.number().int().positive(), capacity: z.number().int().positive(), remaining: z.number().int().min(0), suitableFor: z.array(z.string()), description: z.string(), locationSpotId: z.string() });
export const servicePointSchema = z.object({ id: z.string(), name: z.string(), type: z.enum(["restroom", "visitor-center", "rest", "entrance", "water", "medical", "staff"]), spotId: z.string(), distanceMinutes: z.number().int().min(0), description: z.string(), openHours: z.string() });
export const natureTaskSchema = z.object({ id: z.string(), title: z.string(), description: z.string(), spotIds: z.array(z.string()), suitableFor: z.array(z.string()), interests: z.array(interestSchema), durationMinutes: z.number().int().positive(), prompt: z.string() });
export const faqSchema = z.object({ id: z.string(), question: z.string(), answer: z.string(), tags: z.array(z.string()) });
export const conversationSchema = z.object({
  activityIds: z.array(z.string()).default([]), selectedActivityId: z.string().nullable().default(null), pendingPickup: z.boolean().default(false),
}).default({ activityIds: [], selectedActivityId: null, pendingPickup: false });
export const visitorContextSchema = z.object({ currentSpotId: z.string(), profile: visitorProfileSchema, currentRoute: tourPlanSchema.nullable(), visitedSpotIds: z.array(z.string()), updatedAt: z.string(), conversation: conversationSchema });

export const getScenicInfoInputSchema = z.object({ spotId: z.string().optional(), query: z.string().optional() }).refine((value) => value.spotId || value.query, "spotId 或 query 至少提供一个");
export const getCurrentLocationInputSchema = z.object({ context: visitorContextSchema });
export const setCurrentLocationInputSchema = z.object({ spotId: z.string(), context: visitorContextSchema });
export const planTourRouteInputSchema = z.object({ currentSpotId: z.string(), profile: visitorProfileSchema, visitedSpotIds: z.array(z.string()).default([]) });
export const queryEventsInputSchema = z.object({ date: z.string().optional(), keyword: z.string().optional() });
export const getNatureTaskInputSchema = z.object({ currentSpotId: z.string(), profile: visitorProfileSchema });
export const getServiceInfoInputSchema = z.object({ currentSpotId: z.string(), type: z.enum(["restroom", "visitor-center", "rest", "entrance", "water", "medical", "staff"]).optional() });
export const registerEventInputSchema = z.object({ activityId: z.string(), visitorCount: z.number().int().positive() });

export const chatApiInputSchema = z.object({ message: z.string().trim().min(1).max(1000), context: visitorContextSchema, history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(30).default([]) });

export const pickupOrderInputSchema = z.object({ orderCode: z.string().trim().min(3).max(30) });
export const staffHelpInputSchema = z.object({ currentSpotId: z.string(), reason: z.string().trim().min(2).max(200) });

export const routeAdviceInputSchema = z.object({ context: visitorContextSchema, destinationSpotId: z.string().optional() });
export const routeAdviceOutputSchema = z.object({
  status: z.enum(["continuing", "off-route", "return", "destination"]),
  nextSpotId: z.string().nullable(), remainingMinutes: z.number().int().min(0),
  requiredMinutes: z.number().int().min(0), returnMinutes: z.number().int().min(0),
  canVisit: z.boolean(), explanation: z.string(), pathIds: z.array(z.string()),
});

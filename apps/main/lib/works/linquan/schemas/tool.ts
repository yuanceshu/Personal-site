import { z } from "zod";
import { activitySchema, natureTaskSchema, scenicSpotSchema, servicePointSchema, tourPlanSchema, visitorContextSchema } from "./domain";

export const getScenicInfoOutputSchema = z.union([
  z.object({ type: z.literal("spot"), spot: scenicSpotSchema, relatedFaqs: z.array(z.unknown()) }),
  z.object({ type: z.literal("search"), spots: z.array(scenicSpotSchema), faqs: z.array(z.unknown()) }),
]);
export const getCurrentLocationOutputSchema = z.object({ currentSpot: scenicSpotSchema, visitedSpotIds: z.array(z.string()), route: tourPlanSchema.nullable() });
export const setCurrentLocationOutputSchema = z.object({ context: visitorContextSchema, spot: scenicSpotSchema });
export const queryEventsOutputSchema = z.array(activitySchema);
export const getNatureTaskOutputSchema = natureTaskSchema.nullable();
export const getServiceInfoOutputSchema = z.object({ service: servicePointSchema, distance: z.number().int().min(0) }).nullable();
export const registerEventOutputSchema = z.object({ success: z.boolean(), confirmationCode: z.string(), activity: activitySchema, visitorCount: z.number().int().positive(), message: z.string() });
export const chatApiOutputSchema = z.object({ answer: z.string(), tool: z.string().optional(), context: visitorContextSchema.optional(), action: z.object({ type: z.enum(["location-updated", "route-created", "event-registered"]), label: z.string() }).optional(), data: z.unknown().optional(), engine: z.object({ mode: z.enum(["demo", "llm", "fallback"]), model: z.string().optional(), reason: z.string().optional() }).optional() });
export const tourApiOutputSchema = z.object({ plan: tourPlanSchema });

export const pickupOrderOutputSchema = z.object({ success: z.boolean(), orderCode: z.string(), itemName: z.string(), pickupSpotId: z.string(), message: z.string() });
export const staffHelpOutputSchema = z.object({ success: z.boolean(), ticketId: z.string(), currentSpotId: z.string(), message: z.string() });

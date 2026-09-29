export type Difficulty = "easy" | "moderate" | "challenging";
export type StairLevel = "none" | "low" | "medium" | "high";
export type FitnessLevel = "low" | "medium" | "high";

export type Interest =
  | "scenery"
  | "nature"
  | "culture"
  | "family"
  | "photography"
  | "relaxation";

export interface ScenicSpot {
  id: string;
  name: string;
  shortName: string;
  description: string;
  recommendedStayMinutes: number;
  difficulty: Difficulty;
  stairs: StairLevel;
  elderlyFriendly: boolean;
  childFriendly: boolean;
  facilities: string[];
  tags: Interest[];
  nextSpotIds: string[];
  highlights: string[];
}

export interface VisitorProfile {
  adults: number;
  children: number;
  elderly: number;
  fitness: FitnessLevel;
  availableMinutes: number;
  interests: Interest[];
  avoidStairs: boolean;
  voiceGuideEnabled: boolean;
}

export interface RouteConnection {
  from: string;
  to: string;
  walkMinutes: number;
  stairs: StairLevel;
}

export interface TourStop {
  spotId: string;
  order: number;
  walkMinutesFromPrevious: number;
  stayMinutes: number;
  reason: string;
}

export interface TourPlan {
  id: string;
  currentSpotId: string;
  stops: TourStop[];
  totalMinutes: number;
  requiredMinutes: number;
  feasible: boolean;
  returnMinutes: number;
  returnSpotId: string;
  returnPathIds: string[];
  summary: string;
  rationale: string[];
  generatedAt: string;
}

export interface Activity {
  id: string;
  name: string;
  time: string;
  duration: number;
  capacity: number;
  remaining: number;
  suitableFor: string[];
  description: string;
  locationSpotId: string;
}

export type ServiceType = "restroom" | "visitor-center" | "rest" | "entrance" | "water" | "medical" | "staff";

export interface ServicePoint {
  id: string;
  name: string;
  type: ServiceType;
  spotId: string;
  distanceMinutes: number;
  description: string;
  openHours: string;
}

export interface NatureTask {
  id: string;
  title: string;
  description: string;
  spotIds: string[];
  suitableFor: string[];
  interests: Interest[];
  durationMinutes: number;
  prompt: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  tags: string[];
}

export interface VisitorContext {
  currentSpotId: string;
  profile: VisitorProfile;
  currentRoute: TourPlan | null;
  visitedSpotIds: string[];
  updatedAt: string;
  conversation: {
    activityIds: string[];
    selectedActivityId: string | null;
    pendingPickup: boolean;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  engine?: { mode: "demo" | "llm" | "fallback"; model?: string; reason?: string };
  tool?: string;
  action?: { type: "location-updated" | "route-created" | "event-registered"; label: string };
}

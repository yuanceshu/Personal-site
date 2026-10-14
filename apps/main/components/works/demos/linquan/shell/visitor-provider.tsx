"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { defaultVisitorContext } from "@/lib/works/linquan/storage/session";
import { readLocalStorage, writeLocalStorage } from "@/lib/works/linquan/storage/local-storage";
import type { TourPlan, VisitorContext, VisitorProfile } from "@/lib/works/linquan/types";
import { visitorContextSchema } from "@/lib/works/linquan/schemas/domain";

const CONTEXT_KEY = "scenic-agent:visitor-context";
const profileConditions = ({ profile }: VisitorContext) => JSON.stringify([profile.adults, profile.children, profile.elderly, profile.fitness, profile.availableMinutes, profile.interests, profile.avoidStairs]);
const routeConditions = (context: VisitorContext) => JSON.stringify([context.currentSpotId, profileConditions(context), context.visitedSpotIds]);

type VisitorContextValue = {
  context: VisitorContext;
  hydrated: boolean;
  setContext: (context: VisitorContext | ((current: VisitorContext) => VisitorContext)) => void;
  applyRoute: (plan: TourPlan, basedOn: VisitorContext) => boolean;
  updateRouteStart: (spotId: string) => void;
  routeNeedsUpdate: boolean;
  updateProfile: (profile: VisitorProfile) => void;
  resetSession: () => void;
};

const Context = createContext<VisitorContextValue | null>(null);

export function VisitorProvider({ children }: { children: React.ReactNode }) {
  const [context, setContextState] = useState<VisitorContext>(defaultVisitorContext);
  const latest = useRef(context);
  const [routeNeedsUpdate, setRouteNeedsUpdate] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const stored = readLocalStorage(CONTEXT_KEY, visitorContextSchema, defaultVisitorContext);
    queueMicrotask(() => {
      latest.current = stored;
      setContextState(stored);
      setHydrated(true);
    });
  }, []);
  const setContext = useCallback((next: VisitorContext | ((current: VisitorContext) => VisitorContext)) => {
    const previous = latest.current;
    const safe = visitorContextSchema.safeParse(typeof next === "function" ? next(previous) : next);
    if (!safe.success) return;
    if (!safe.data.currentRoute || safe.data.currentRoute.id !== previous.currentRoute?.id) setRouteNeedsUpdate(false);
    else if (profileConditions(safe.data) !== profileConditions(previous)) setRouteNeedsUpdate(true);
    latest.current = safe.data;
    setContextState(safe.data);
    writeLocalStorage(CONTEXT_KEY, safe.data);
  }, []);
  const updateProfile = useCallback((profile: VisitorProfile) => setContext(current => ({ ...current, profile, updatedAt: new Date().toISOString() })), [setContext]);
  const applyRoute = useCallback((plan: TourPlan, basedOn: VisitorContext) => {
    if (routeConditions(latest.current) !== routeConditions(basedOn)) return false;
    setContext(current => ({ ...current, currentRoute: plan, updatedAt: new Date().toISOString() }));
    setRouteNeedsUpdate(false);
    return true;
  }, [setContext]);
  const updateRouteStart = useCallback((spotId: string) => {
    const current = latest.current;
    setContext({ ...current, currentSpotId: spotId, visitedSpotIds: Array.from(new Set([...current.visitedSpotIds, spotId])), updatedAt: new Date().toISOString() });
    // 规划表单改起点属于改条件；游览中更新当前位置仍按原路线记录进度。
    if (current.currentRoute && current.currentSpotId !== spotId) setRouteNeedsUpdate(true);
  }, [setContext]);
  const resetSession = useCallback(() => setContext(defaultVisitorContext), [setContext]);
  const value = useMemo(() => ({ context, hydrated, setContext, applyRoute, updateRouteStart, routeNeedsUpdate, updateProfile, resetSession }), [context, hydrated, resetSession, setContext, applyRoute, updateRouteStart, routeNeedsUpdate, updateProfile]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useVisitor() {
  const value = useContext(Context);
  if (!value) throw new Error("useVisitor 必须在 VisitorProvider 内使用");
  return value;
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { defaultVisitorContext } from "@/lib/works/linquan/storage/session";
import { readLocalStorage, writeLocalStorage } from "@/lib/works/linquan/storage/local-storage";
import type { VisitorContext, VisitorProfile } from "@/lib/works/linquan/types";
import { visitorContextSchema } from "@/lib/works/linquan/schemas/domain";

const CONTEXT_KEY = "scenic-agent:visitor-context";

type VisitorContextValue = {
  context: VisitorContext;
  hydrated: boolean;
  setContext: (context: VisitorContext) => void;
  updateProfile: (profile: VisitorProfile) => void;
  resetSession: () => void;
};

const Context = createContext<VisitorContextValue | null>(null);

export function VisitorProvider({ children }: { children: React.ReactNode }) {
  const [context, setContextState] = useState<VisitorContext>(defaultVisitorContext);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const stored = readLocalStorage(CONTEXT_KEY, visitorContextSchema, defaultVisitorContext);
    queueMicrotask(() => {
      setContextState(stored);
      setHydrated(true);
    });
  }, []);
  const setContext = useCallback((next: VisitorContext) => {
    const safe = visitorContextSchema.safeParse(next);
    const resolved = safe.success ? safe.data : defaultVisitorContext;
    setContextState(resolved);
    writeLocalStorage(CONTEXT_KEY, resolved);
  }, []);
  const updateProfile = useCallback((profile: VisitorProfile) => setContext({ ...context, profile, updatedAt: new Date().toISOString() }), [context, setContext]);
  const resetSession = useCallback(() => setContext(defaultVisitorContext), [setContext]);
  const value = useMemo(() => ({ context, hydrated, setContext, updateProfile, resetSession }), [context, hydrated, resetSession, setContext, updateProfile]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useVisitor() {
  const value = useContext(Context);
  if (!value) throw new Error("useVisitor 必须在 VisitorProvider 内使用");
  return value;
}

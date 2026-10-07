"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearJourney, readJourney, writeJourney } from "./storage";
import { currentStep, remainingSteps } from "./steps";
import { emptyJourney, type JourneyState, type JourneyStepId } from "./types";

type JourneyContextValue = {
  state: JourneyState;
  step: JourneyStepId;
  stepsLeft: JourneyStepId[];
  patch: (partial: Partial<JourneyState>) => void;
  reset: () => void;
  hydrated: boolean;
};

const JourneyContext = createContext<JourneyContextValue | null>(null);

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<JourneyState>(() => emptyJourney());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readJourney());
    setHydrated(true);
  }, []);

  const patch = useCallback((partial: Partial<JourneyState>) => {
    setState((prev) => {
      const next = emptyJourney({ ...prev, ...partial });
      writeJourney(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    clearJourney();
    setState(emptyJourney());
  }, []);

  const stepsLeft = useMemo(() => remainingSteps(state), [state]);
  const step = useMemo(() => currentStep(state), [state]);

  const value = useMemo(
    () => ({ state, step, stepsLeft, patch, reset, hydrated }),
    [state, step, stepsLeft, patch, reset, hydrated]
  );

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useJourney() {
  const ctx = useContext(JourneyContext);
  if (!ctx) throw new Error("useJourney must be used within JourneyProvider");
  return ctx;
}

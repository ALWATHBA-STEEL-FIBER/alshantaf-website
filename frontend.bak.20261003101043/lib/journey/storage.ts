import { emptyJourney, JOURNEY_STORAGE_KEY, type JourneyState } from "./types";

export function readJourney(): JourneyState {
  if (typeof window === "undefined") return emptyJourney();
  try {
    const raw = sessionStorage.getItem(JOURNEY_STORAGE_KEY);
    if (!raw) return emptyJourney();
    const parsed = JSON.parse(raw) as Partial<JourneyState>;
    if (parsed?.version !== 1) return emptyJourney();
    return emptyJourney({ ...parsed, version: 1 });
  } catch {
    return emptyJourney();
  }
}

export function writeJourney(state: JourneyState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      JOURNEY_STORAGE_KEY,
      JSON.stringify({ ...state, updatedAt: new Date().toISOString() })
    );
  } catch {
    // private browsing / quota — journey still works in-memory via provider
  }
}

export function clearJourney() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(JOURNEY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

import type { IndustryType } from "@/lib/types";

/**
 * Active journey intents. Property-category expansion (commercial / residential / …)
 * is reserved for later — only industrial is enabled in the UI today.
 */
export type JourneyIntent = "find_land" | "build_hangar" | "invest" | "land_check";

export type HangarGoal = "own_industry" | "invest_rent";

export type InvestmentType = "industrial_land" | "ready_hangar" | "land_plus_hangar";

/** Future-ready property category — only `industrial` is selectable now. */
export type PropertyCategory = "industrial" | "commercial" | "residential" | "agricultural" | "green";

export type JourneyStepId =
  | "intent"
  | "hangar_goal"
  | "investment_type"
  | "industry"
  | "area"
  | "region"
  | "budget"
  | "has_land"
  | "results"
  | "hangar_specs"
  | "land_check";

export type JourneyState = {
  version: 1;
  /** Always industrial for now; kept for future expansion without rebuild. */
  propertyCategory: PropertyCategory;
  intent: JourneyIntent | null;
  hangarGoal: HangarGoal | null;
  investmentType: InvestmentType | null;
  industryType: IndustryType | null;
  areaSqm: number | null;
  regionSlug: string | null;
  budgetJod: number | null;
  hasLand: boolean | null;
  selectedListingId: string | null;
  /** Opaque parcel notes carried into land-check when known. */
  landNotes: string | null;
  /** Set true after land-check completes so hangar_specs can follow without re-asking. */
  landCheckDone: boolean;
  updatedAt: string;
};

export const JOURNEY_STORAGE_KEY = "alshantaf_journey_v1";

export function emptyJourney(partial?: Partial<JourneyState>): JourneyState {
  return {
    version: 1,
    propertyCategory: "industrial",
    intent: null,
    hangarGoal: null,
    investmentType: null,
    industryType: null,
    areaSqm: null,
    regionSlug: null,
    budgetJod: null,
    hasLand: null,
    selectedListingId: null,
    landNotes: null,
    landCheckDone: false,
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

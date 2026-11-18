import { parseAreaSqm } from "@/lib/adminPricing";
import type { OfferImportance } from "@/lib/types";

export const OFFER_IMPORTANCE_ORDER = ["titanium", "platinum", "golden"] as const;
export type PremiumImportance = (typeof OFFER_IMPORTANCE_ORDER)[number];

export const OFFER_SIZE_ORDER = ["large", "small"] as const;
export type OfferSizeCategory = (typeof OFFER_SIZE_ORDER)[number];

/** Lands ≥ 5 dunums are large; below that are small. */
export const LARGE_LAND_DUNUMS = 5;
const DUNUM_M2 = 1000;

export function importanceRank(importance: OfferImportance | null | undefined): number {
  switch (importance) {
    case "titanium":
      return 3;
    case "platinum":
      return 2;
    case "golden":
      return 1;
    default:
      return 0;
  }
}

export function isPremiumImportance(v: string | null | undefined): v is PremiumImportance {
  return v === "golden" || v === "platinum" || v === "titanium";
}

export function listingDunums(size: string | null | undefined): number | null {
  const sqm = parseAreaSqm(size);
  if (sqm == null) return null;
  return sqm / DUNUM_M2;
}

export function listingSizeCategory(size: string | null | undefined): OfferSizeCategory | null {
  const dunums = listingDunums(size);
  if (dunums == null) return null;
  return dunums >= LARGE_LAND_DUNUMS ? "large" : "small";
}

export function importanceBadgeClass(importance: PremiumImportance): string {
  switch (importance) {
    case "golden":
      return "bg-amber-400 text-[#3a2a0a] shadow-[0_0_18px_rgba(251,191,36,0.75)]";
    case "platinum":
      return "bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 text-slate-800 shadow-[0_0_18px_rgba(226,232,240,0.85)]";
    case "titanium":
      return "bg-gradient-to-r from-slate-800 via-cyan-800 to-slate-900 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.55)]";
  }
}

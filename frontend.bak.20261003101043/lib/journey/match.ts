import { toWesternDigits } from "@/lib/arabicDigits";
import { parseAreaSqm } from "@/lib/adminPricing";
import { areaFilterBySlug, listingAreaMatchesFilter } from "@/lib/areaFilters";
import type { IndustryType, Listing } from "@/lib/types";
import type { JourneyState } from "./types";

export type MatchKind = "exact" | "near" | "budget_alt";

export type MatchedListing = {
  listing: Listing;
  kind: MatchKind;
  noteKey?: "sizeNear" | "budgetRegion" | "budgetAlt";
};

function parsePriceJod(price: string | null | undefined): number | null {
  if (!price) return null;
  const cleaned = toWesternDigits(price).replace(/[^\d.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Light/medium families — avoid showing incompatible zoning as a "match". */
function industryCompatible(wanted: IndustryType, listing: IndustryType): boolean {
  if (wanted === listing) return true;
  const light = new Set(["light", "lightSpecial"]);
  const medium = new Set(["medium", "mediumSpecial", "agriToIndustrial"]);
  if (light.has(wanted) && light.has(listing)) return true;
  if (medium.has(wanted) && medium.has(listing)) return true;
  return false;
}

function sizeScore(wanted: number | null, listingSize: string | null): number {
  if (!wanted) return 0;
  const got = parseAreaSqm(listingSize);
  if (!got) return 50;
  const ratio = got / wanted;
  if (ratio >= 0.85 && ratio <= 1.25) return 0;
  if (ratio >= 0.6 && ratio <= 1.6) return 25;
  return 80;
}

function regionOk(slug: string | null, listing: Listing): boolean {
  if (!slug || slug === "any") return true;
  const def = areaFilterBySlug(slug);
  if (!def) return true;
  return listingAreaMatchesFilter(listing.area, def);
}

/**
 * Rank listings for the journey. Never returns an empty hard-fail when
 * softer alternatives exist (budget/region mismatch → alternatives).
 */
export function matchListings(
  listings: Listing[],
  state: JourneyState
): {
  matches: MatchedListing[];
  budgetMismatch: boolean;
  suggestedRegionSlugs: string[];
} {
  const published = listings.filter((l) => l.publishStatus === "published" && l.status === "available");

  const scored = published.map((listing) => {
    let score = 0;
    let kind: MatchKind = "exact";
    let noteKey: MatchedListing["noteKey"];

    if (state.industryType) {
      if (!industryCompatible(state.industryType, listing.industryType)) {
        return null;
      }
    }

    const inRegion = regionOk(state.regionSlug, listing);
    const price = parsePriceJod(listing.price);
    const withinBudget = state.budgetJod == null || price == null || price <= state.budgetJod * 1.1;

    if (state.regionSlug && !inRegion) {
      if (state.budgetJod != null && withinBudget) {
        kind = "budget_alt";
        noteKey = "budgetAlt";
        score += 40;
      } else {
        return null;
      }
    }

    if (state.budgetJod != null && inRegion && price != null && price > state.budgetJod * 1.1) {
      return {
        listing,
        score: 999,
        kind: "near" as MatchKind,
        noteKey: "budgetRegion" as const,
        overBudget: true,
      };
    }

    const sizePenalty = sizeScore(state.areaSqm, listing.size);
    score += sizePenalty;
    if (sizePenalty > 0 && sizePenalty < 80) {
      kind = kind === "exact" ? "near" : kind;
      noteKey = noteKey ?? "sizeNear";
    }
    if (sizePenalty >= 80) return null;

    return { listing, score, kind, noteKey, overBudget: false };
  });

  const valid = scored.filter((x): x is NonNullable<typeof x> => x != null);
  const overBudgetInRegion = valid.filter((x) => x.overBudget);
  const usable = valid.filter((x) => !x.overBudget).sort((a, b) => a.score - b.score);

  const budgetMismatch =
    Boolean(state.budgetJod && state.regionSlug) &&
    overBudgetInRegion.length > 0 &&
    usable.filter((x) => x.kind === "exact" || x.kind === "near").length === 0;

  let matches: MatchedListing[] = usable.slice(0, 12).map(({ listing, kind, noteKey }) => ({
    listing,
    kind,
    noteKey,
  }));

  if (matches.length === 0 && state.budgetJod != null) {
    matches = published
      .filter((l) => {
        if (state.industryType && !industryCompatible(state.industryType, l.industryType)) return false;
        const price = parsePriceJod(l.price);
        return price == null || price <= state.budgetJod! * 1.1;
      })
      .slice(0, 8)
      .map((listing) => ({ listing, kind: "budget_alt" as const, noteKey: "budgetAlt" as const }));
  }

  if (matches.length === 0 && state.industryType) {
    matches = published
      .filter((l) => industryCompatible(state.industryType!, l.industryType))
      .slice(0, 8)
      .map((listing) => ({ listing, kind: "near" as const, noteKey: "sizeNear" as const }));
  }

  if (matches.length === 0) {
    matches = published.slice(0, 6).map((listing) => ({ listing, kind: "near" as const }));
  }

  const suggestedRegionSlugs = [
    ...new Set(
      matches
        .filter((m) => m.kind === "budget_alt")
        .map((m) => {
          const hit = ["sahab", "qastal", "muwaqqar", "zarqa", "dulail"].find((slug) => {
            const def = areaFilterBySlug(slug);
            return def ? listingAreaMatchesFilter(m.listing.area, def) : false;
          });
          return hit;
        })
        .filter((s): s is string => Boolean(s))
    ),
  ];

  return { matches, budgetMismatch, suggestedRegionSlugs };
}

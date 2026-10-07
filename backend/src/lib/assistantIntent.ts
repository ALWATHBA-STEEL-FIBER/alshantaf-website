import { toWesternDigits } from "./arabicDigits";
import { parseAreaSqm } from "./areaParse";

export const AREA_ALIASES: Array<{ area: string; patterns: RegExp[] }> = [
  { area: "سحاب", patterns: [/سحاب/i, /\bsahab\b/i] },
  { area: "القسطل", patterns: [/قسطل/i, /\bqastal\b/i, /\bal-?qastal\b/i] },
  { area: "المشتى", patterns: [/مشتى/i, /مشتا/i, /\bmushta\b/i, /\bal-?mushta\b/i] },
  { area: "الزرقاء", patterns: [/زرقاء/i, /\bzarqa\b/i] },
  { area: "الموقر", patterns: [/موقر/i, /\bmuwaqqar\b/i, /\bmuwaqar\b/i] },
  { area: "الجيزة", patterns: [/جيزة/i, /\bjiza\b/i, /\bjizah\b/i] },
  { area: "خلدا", patterns: [/خلدا/i, /\bkhalda\b/i] },
];

export type SizeMode = "approx" | "min";

export type SizeFilter = {
  mode: SizeMode;
  sqm: number;
};

export type OfferIntent = {
  area: string | null;
  size: SizeFilter | null;
  wantsOffers: boolean;
};

const UNIT = String.raw`(?:دونم|dunums?|dounms?|donums?|م²|م2|m²|m2)`;
const MIN_PREFIX =
  /أكثر من|اكثر من|أكبر من|اكبر من|فوق|على الأقل|على الاقل|at least|above|over|more than|greater than|starting from|\+/i;
const MIN_SUFFIX = /فأكثر|فاكثر|وأكثر|واكثر|or more|\+/i;

function unitToSqm(amount: number, unit: string | undefined): number {
  if (unit && /م²|م2|m²|m2/i.test(unit)) return amount;
  // Bare small numbers in this product are dunums.
  return amount * 1000;
}

export function detectArea(text: string): string | null {
  for (const row of AREA_ALIASES) {
    if (row.patterns.some((p) => p.test(text))) return row.area;
  }
  return null;
}

export function parseSizeFilter(text: string): SizeFilter | null {
  const raw = toWesternDigits(text);

  if (/دونمين/i.test(raw)) {
    const min = MIN_PREFIX.test(raw) || MIN_SUFFIX.test(raw);
    return { mode: min ? "min" : "approx", sqm: 2000 };
  }

  const minMatch =
    raw.match(new RegExp(`(?:${MIN_PREFIX.source})\\s*([\\d.]+)\\s*(${UNIT})?`, "i")) ||
    raw.match(new RegExp(`([\\d.]+)\\s*(${UNIT})?\\s*(?:${MIN_SUFFIX.source})`, "i"));
  if (minMatch) {
    const amount = Number(minMatch[1]);
    if (Number.isFinite(amount) && amount > 0) {
      return { mode: "min", sqm: unitToSqm(amount, minMatch[2]) };
    }
  }

  const approx =
    raw.match(new RegExp(`(?:حوالي|قرابة|قرب|قريب(?:ة)? من|around|about|approx(?:imately)?)\\s*([\\d.]+)\\s*(${UNIT})?`, "i")) ||
    raw.match(new RegExp(`([\\d.]+)\\s*(${UNIT})`, "i"));
  if (approx) {
    const amount = Number(approx[1]);
    if (Number.isFinite(amount) && amount > 0) {
      return { mode: "approx", sqm: unitToSqm(amount, approx[2]) };
    }
  }

  return null;
}

export function parseOfferIntent(text: string): OfferIntent {
  const area = detectArea(text);
  const size = parseSizeFilter(text);
  const wantsOffers =
    Boolean(area || size) ||
    /أرض|ارض|فرص|عروض|قطعة|قطع|هنجر|land|offer|opportunit|industrial|parcel/i.test(text);
  return { area, size, wantsOffers };
}

/** Distance for ranking; Infinity = drop. Approx keeps ~0.7×–1.65× (1.7 and 3 vs 2 dunums). */
export function sizeRank(filter: SizeFilter | null, listingSize: string | null): number {
  if (!filter) return 0;
  const got = parseAreaSqm(listingSize);
  if (!got) return 80;
  if (filter.mode === "min") {
    return got + 1e-6 >= filter.sqm * 0.98 ? Math.max(0, got - filter.sqm) : Number.POSITIVE_INFINITY;
  }
  const ratio = got / filter.sqm;
  if (ratio >= 0.7 && ratio <= 1.65) return Math.abs(got - filter.sqm);
  return Number.POSITIVE_INFINITY;
}

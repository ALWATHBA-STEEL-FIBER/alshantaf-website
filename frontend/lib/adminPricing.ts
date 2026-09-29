import { toWesternDigits } from "@/lib/arabicDigits";

/** Parse a size/area label into square metres (supports m²/م² and dunums/دونم). */
export function parseAreaSqm(label: string | null | undefined): number | null {
  if (!label) return null;
  const text = toWesternDigits(label).replace(/,/g, "");
  const sqm = text.match(/([\d.]+)\s*(?:m²|م²)/i);
  if (sqm) {
    const n = Number(sqm[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const dunum = text.match(/([\d.]+)\s*(?:dunums?|دونم)/i);
  if (dunum) {
    const n = Number(dunum[1]);
    return Number.isFinite(n) && n > 0 ? n * 1000 : null;
  }
  return null;
}

/** Official DLS rate × cadastral area — a mid-range asking-price reference. */
export function adminMedianEstimate(ratePerSqm: number, areaSqm: number): number {
  return Math.round(ratePerSqm * areaSqm);
}

/**
 * Parse an asking rate per m² from listing price text
 * (e.g. "60 دينار / م²", "60 JOD/m2"). Returns null for lump-sum prices.
 */
export function parsePricePerSqm(price: string | null | undefined): number | null {
  if (!price) return null;
  const text = toWesternDigits(price).replace(/,/g, "");
  const per = text.match(
    /([\d.]+)\s*(?:دينار|JOD|JD|jd)?\s*(?:\/|لكل|per)?\s*(?:م²|m²|م2|m2|sq\.?\s*m)/i
  );
  if (!per) return null;
  const n = Number(per[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatMoney(value: number, lang: "ar" | "en"): string {
  return value.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO", {
    maximumFractionDigits: 0,
  });
}

export function formatAreaSqm(value: number, lang: "ar" | "en"): string {
  const n = value.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
  return lang === "ar" ? `${n} م²` : `${n} m²`;
}

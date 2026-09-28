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

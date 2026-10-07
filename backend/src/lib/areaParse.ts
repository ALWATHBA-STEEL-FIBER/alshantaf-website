import { toWesternDigits } from "./arabicDigits";

const DUNUM_M2 = 1000;

/** Parse a size/area label into square metres (m² / dunums). */
export function parseAreaSqm(label: string | null | undefined): number | null {
  if (!label) return null;
  const text = toWesternDigits(label).replace(/,/g, "").trim();
  if (!text) return null;
  const sqm = text.match(/([\d.]+)\s*(?:m²|م²|m2|م2)/i);
  if (sqm) {
    const n = Number(sqm[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const dunum = text.match(/([\d.]+)\s*(?:dunums?|dounms?|donums?|دونم)/i);
  if (dunum) {
    const n = Number(dunum[1]);
    return Number.isFinite(n) && n > 0 ? n * DUNUM_M2 : null;
  }
  const bare = text.match(/^([\d.]+)$/);
  if (bare) {
    const n = Number(bare[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export function sqmToDunums(sqm: number) {
  return sqm / DUNUM_M2;
}

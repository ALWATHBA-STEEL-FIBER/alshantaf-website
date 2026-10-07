import { toWesternDigits } from "@/lib/arabicDigits";

/**
 * Split a parcel field that may list several cadastral IDs
 * (e.g. "706, 707, 708, 709" or "706 و 707") into individual numbers.
 */
export function parseParcelNumbers(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const text = toWesternDigits(raw.trim());
  const parts = text.split(/[,،;/|]+|\s+و\s+|\s+and\s+/i);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const digits = part.replace(/[^\d]/g, "");
    if (!digits || seen.has(digits)) continue;
    seen.add(digits);
    out.push(digits);
  }
  return out;
}

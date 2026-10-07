import { toWesternDigits } from "@/lib/arabicDigits";

export const MAX_MULTI_PARCELS = 10;

export function parseParcelNumbers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const normalized = toWesternDigits(raw);
  const parts = normalized.match(/\d+/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const clean = String(Number(part));
    if (!clean || clean === "0") continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

export function canonicalParcelList(raw: string | null | undefined): string | null {
  const parts = parseParcelNumbers(raw);
  if (!parts.length) return null;
  return parts.join(", ");
}

export function sanitizeParcelNumberInput(raw: string): string {
  return toWesternDigits(raw).replace(/[^\d]/g, "");
}

export function areParcelNumbersConsecutive(parcelNos: string[]): boolean {
  if (parcelNos.length < 2) return true;
  const ints = parcelNos.map((value) => Number(value));
  if (ints.some((value) => !Number.isInteger(value) || value <= 0)) return false;
  for (let i = 1; i < ints.length; i += 1) {
    if (ints[i] !== ints[i - 1] + 1) return false;
  }
  return true;
}

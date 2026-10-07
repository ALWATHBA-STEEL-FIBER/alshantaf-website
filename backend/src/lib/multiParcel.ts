import { toWesternDigits } from "./arabicDigits";

export const MAX_MULTI_PARCELS = 10;

export function parseParcelNumbers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const normalized = toWesternDigits(raw);
  const parts = normalized.match(/\d+/g) ?? [];
  const out: string[] = [];
  for (const part of parts) {
    const clean = String(Number(part));
    if (!clean || clean === "0") continue;
    out.push(clean);
  }
  return out;
}

export function canonicalParcelList(raw: string | null | undefined): string | null {
  const values = parseParcelNumbers(raw);
  if (!values.length) return null;
  return values.join(", ");
}

export function areParcelsConsecutive(parcelNos: string[]): boolean {
  if (parcelNos.length < 2) return true;
  const ints = parcelNos.map((value) => Number(value));
  if (ints.some((value) => !Number.isInteger(value) || value <= 0)) return false;
  for (let i = 1; i < ints.length; i += 1) {
    if (ints[i] !== ints[i - 1] + 1) return false;
  }
  return true;
}

export function assertValidMultiParcel(raw: string | null | undefined): { ok: true } | { ok: false; error: string } {
  const values = parseParcelNumbers(raw);
  if (values.length <= 1) return { ok: true };
  if (values.length > MAX_MULTI_PARCELS) {
    return { ok: false, error: `Multi-land offers support up to ${MAX_MULTI_PARCELS} parcels.` };
  }
  if (!areParcelsConsecutive(values)) {
    return { ok: false, error: "Multi-land parcel numbers must be consecutive in order (difference of 1)." };
  }
  return { ok: true };
}

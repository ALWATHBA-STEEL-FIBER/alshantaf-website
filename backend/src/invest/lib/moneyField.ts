export function moneyField(
  amount: { toString(): string } | string | number | null | undefined,
  opts?: { currency?: string; finalized?: boolean; estimated?: boolean }
) {
  if (amount == null || amount === "") {
    return { amount: null, currency: opts?.currency ?? null, finalized: opts?.finalized ?? null, estimated: opts?.estimated ?? null };
  }
  return {
    amount: typeof amount === "object" && amount && "toString" in amount ? amount.toString() : String(amount),
    currency: opts?.currency ?? "JOD",
    finalized: opts?.finalized ?? true,
    estimated: opts?.estimated ?? false,
  };
}

export function dstr(v: unknown): string {
  if (v == null || v === "") return "0";
  if (typeof v === "object" && v !== null && "toString" in v) return String((v as { toString(): string }).toString());
  return String(v);
}

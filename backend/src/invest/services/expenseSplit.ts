import { Decimal, allocateByWeights } from "../finance/decimal";

/**
 * Who bears an expense.
 * - ownership: every partner by ownership % (default — what reimbursing off the top already does)
 * - equal:     same amount for every active partner
 * - custom:    agreed % per partner (sums to 100); a single partner at 100% = "on him alone"
 */
export const SPLIT_MODES = ["ownership", "equal", "custom"] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

function bad(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

/** Validate a split coming from the UI. Returns the values to store. */
export function cleanSplitInput(
  modeRaw: unknown,
  sharesRaw: unknown,
  memberIds: string[]
): { splitMode: SplitMode; splitShares: Record<string, string> | null } {
  const mode = (SPLIT_MODES as readonly string[]).includes(String(modeRaw)) ? (String(modeRaw) as SplitMode) : "ownership";
  if (mode !== "custom") return { splitMode: mode, splitShares: null };
  if (!sharesRaw || typeof sharesRaw !== "object" || Array.isArray(sharesRaw)) throw bad("حدد نسبة كل شريك من المصروف");
  const out: Record<string, string> = {};
  let sum = new Decimal(0);
  for (const [id, v] of Object.entries(sharesRaw as Record<string, unknown>)) {
    if (v == null || v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw bad("نسبة المصروف يجب أن تكون بين 0 و 100");
    if (!memberIds.includes(id)) throw bad("نسبة لشريك ليس في المشروع");
    if (n === 0) continue;
    out[id] = String(n);
    sum = sum.plus(n);
  }
  if (!Object.keys(out).length) throw bad("حدد نسبة شريك واحد على الأقل");
  if (sum.minus(100).abs().gt("0.01")) throw bad(`مجموع النسب يجب أن يكون 100% (الحالي ${sum.toFixed(2)}%)`);
  return { splitMode: "custom", splitShares: out };
}

/**
 * Percent weights for a non-ownership split over the current active members,
 * or null when the expense is (or falls back to) ownership.
 */
export function splitWeights(
  mode: string | null | undefined,
  shares: unknown,
  memberIds: string[]
): Map<string, Decimal> | null {
  if (!memberIds.length) return null;
  if (mode === "equal") return new Map(memberIds.map((id) => [id, new Decimal(1)]));
  if (mode !== "custom" || !shares || typeof shares !== "object") return null;
  const w = new Map<string, Decimal>();
  for (const [id, v] of Object.entries(shares as Record<string, unknown>)) {
    const n = Number(v);
    if (memberIds.includes(id) && Number.isFinite(n) && n > 0) w.set(id, new Decimal(n));
  }
  // Every named partner left the project → fall back to ownership.
  return w.size ? w : null;
}

/** Split `amount` by weights → amount per investor (3dp, sums exactly). */
export function allocateSplit(amount: Decimal.Value, weights: Map<string, Decimal.Value>): Map<string, Decimal> {
  const ids = [...weights.keys()];
  const parts = allocateByWeights(amount, ids.map((id) => weights.get(id)!), 3);
  return new Map(ids.map((id, i) => [id, new Decimal(parts[i])]));
}

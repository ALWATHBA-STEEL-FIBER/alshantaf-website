/**
 * Exact decimal arithmetic for investment partnership money.
 * Patterns inspired by Madar (MIT) — reimplemented for land partnership domain.
 */
import { Decimal } from "decimal.js";

Decimal.set({
  precision: 50,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -30,
  toExpPos: 40,
});

export { Decimal };

export type MoneyString = string;

export class FinanceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "FinanceError";
  }
}

export function dec(value: Decimal.Value, field = "value"): Decimal {
  try {
    const result = new Decimal(value);
    if (!result.isFinite()) throw new Error("not finite");
    return result;
  } catch {
    throw new FinanceError("INVALID_DECIMAL", `${field} must be a valid decimal`, { field });
  }
}

/** Quantize to currency scale (JOD default = 3 fils). */
export function money(value: Decimal.Value, scale = 3): MoneyString {
  return dec(value).toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN).toFixed(scale);
}

export function pct(value: Decimal.Value, scale = 8): MoneyString {
  return dec(value).toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN).toFixed(scale);
}

export function assertNonNegative(value: Decimal, field: string): void {
  if (value.isNegative()) {
    throw new FinanceError("NEGATIVE_VALUE", `${field} cannot be negative`, { field });
  }
}

export function assertPositive(value: Decimal, field: string): void {
  if (value.lte(0)) {
    throw new FinanceError("NON_POSITIVE", `${field} must be greater than zero`, { field });
  }
}

/** Sum money strings at a fixed scale. */
export function sumMoney(values: Decimal.Value[], scale = 3): MoneyString {
  let total = new Decimal(0);
  for (const v of values) total = total.plus(dec(v));
  return money(total, scale);
}

/**
 * Allocate an amount across weights so parts sum exactly to the amount.
 * Residual fils go to the largest weight (deterministic tie-break by index).
 */
export function allocateByWeights(
  total: Decimal.Value,
  weights: Decimal.Value[],
  scale = 3
): MoneyString[] {
  const amount = dec(total);
  assertNonNegative(amount, "total");
  if (weights.length === 0) {
    if (amount.isZero()) return [];
    throw new FinanceError("NO_WEIGHTS", "Cannot allocate with empty weights");
  }

  const w = weights.map((x, i) => {
    const d = dec(x, `weights[${i}]`);
    assertNonNegative(d, `weights[${i}]`);
    return d;
  });
  const weightSum = w.reduce((a, b) => a.plus(b), new Decimal(0));
  if (weightSum.isZero()) {
    if (amount.isZero()) return w.map(() => money(0, scale));
    throw new FinanceError("ZERO_WEIGHTS", "Weight sum is zero");
  }

  const raw = w.map((wi) => amount.times(wi).dividedBy(weightSum));
  const floored = raw.map((r) => r.toDecimalPlaces(scale, Decimal.ROUND_DOWN));
  let allocated = floored.reduce((a, b) => a.plus(b), new Decimal(0));
  let residual = amount.minus(allocated).toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN);

  const unit = new Decimal(10).pow(-scale);
  // Assign residual unit by unit to largest remaining fractional parts
  const remainders = raw.map((r, i) => ({ i, rem: r.minus(floored[i]) }));
  remainders.sort((a, b) => {
    const cmp = b.rem.comparedTo(a.rem);
    if (cmp !== 0) return cmp;
    return a.i - b.i;
  });

  const out = floored.map((f) => f);
  let idx = 0;
  while (residual.gt(0) && idx < remainders.length * 10000) {
    const target = remainders[idx % remainders.length].i;
    out[target] = out[target].plus(unit);
    residual = residual.minus(unit);
    idx += 1;
  }

  const check = out.reduce((a, b) => a.plus(b), new Decimal(0));
  if (!check.eq(amount.toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN)) && !check.eq(amount)) {
    // Final safety: push any leftover to first largest weight index
    const diff = amount.minus(check);
    if (!diff.isZero()) {
      const largest = w.reduce(
        (best, wi, i) => (wi.gt(w[best]) || (wi.eq(w[best]) && i < best) ? i : best),
        0
      );
      out[largest] = out[largest].plus(diff);
    }
  }

  return out.map((x) => money(x, scale));
}

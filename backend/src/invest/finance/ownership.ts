import { Decimal, FinanceError, dec, money, pct, type MoneyString } from "./decimal";

export type CapitalLine = {
  partnerId: string;
  /** Capital that counts toward ownership (initial + additional equity). Not expenses. */
  equityCapital: MoneyString | string | number;
};

export type OwnershipShare = {
  partnerId: string;
  equityCapital: MoneyString;
  ownershipPercent: MoneyString; // 0–100, scale 8
};

/**
 * Compute ownership from equity capital contributions.
 * Percentages sum to exactly 100.00000000 (residual to largest capital).
 */
export function computeOwnershipFromCapital(
  lines: CapitalLine[],
  percentScale = 8,
  moneyScale = 3
): OwnershipShare[] {
  if (lines.length === 0) return [];

  const normalized = lines.map((l, i) => {
    const equity = dec(l.equityCapital, `lines[${i}].equityCapital`);
    if (equity.isNegative()) {
      throw new FinanceError("NEGATIVE_CAPITAL", "Equity capital cannot be negative", {
        partnerId: l.partnerId,
      });
    }
    return { partnerId: l.partnerId, equity };
  });

  const total = normalized.reduce((a, b) => a.plus(b.equity), new Decimal(0));
  if (total.isZero()) {
    // Equal zero ownership pool — treat as 0% each
    return normalized.map((n) => ({
      partnerId: n.partnerId,
      equityCapital: money(0, moneyScale),
      ownershipPercent: pct(0, percentScale),
    }));
  }

  const raw = normalized.map((n) => n.equity.times(100).dividedBy(total));
  const floored = raw.map((r) => r.toDecimalPlaces(percentScale, Decimal.ROUND_DOWN));
  let sum = floored.reduce((a, b) => a.plus(b), new Decimal(0));
  const target = new Decimal(100);
  let residual = target.minus(sum);
  const unit = new Decimal(10).pow(-percentScale);

  const order = raw
    .map((r, i) => ({ i, rem: r.minus(floored[i]), equity: normalized[i].equity }))
    .sort((a, b) => {
      const c = b.rem.comparedTo(a.rem);
      if (c !== 0) return c;
      const e = b.equity.comparedTo(a.equity);
      if (e !== 0) return e;
      return a.i - b.i;
    });

  const percents = [...floored];
  let k = 0;
  while (residual.gt(0) && k < order.length * 100000) {
    const i = order[k % order.length].i;
    percents[i] = percents[i].plus(unit);
    residual = residual.minus(unit);
    k += 1;
  }

  sum = percents.reduce((a, b) => a.plus(b), new Decimal(0));
  if (!sum.eq(target)) {
    const largest = order[0].i;
    percents[largest] = percents[largest].plus(target.minus(sum));
  }

  return normalized.map((n, i) => ({
    partnerId: n.partnerId,
    equityCapital: money(n.equity, moneyScale),
    ownershipPercent: pct(percents[i], percentScale),
  }));
}

export function assertOwnershipPoolComplete(shares: OwnershipShare[], tolerance = "0.00000001"): void {
  const total = shares.reduce((a, s) => a.plus(dec(s.ownershipPercent)), new Decimal(0));
  if (total.minus(100).abs().gt(dec(tolerance))) {
    throw new FinanceError("OWNERSHIP_NOT_100", `Ownership pool sums to ${total.toFixed()}, not 100`, {
      total: total.toFixed(),
    });
  }
}

import { Decimal, FinanceError, assertNonNegative, dec, money, type MoneyString } from "./decimal";

export type CommissionBasis =
  | "investor_net_profit" // % of each investor's profit share (before this commission)
  | "distributable_profit" // % of total distributable project profit
  | "sale_value" // % of sale proceeds
  | "fixed" // fixed fee
  | "hybrid"; // fixed + % of distributable profit

export type CommissionRuleInput = {
  basis: CommissionBasis;
  /** Percentage as 0–100 (e.g. 10 = 10%). Ignored for pure fixed. */
  percent?: MoneyString | string | number | null;
  /** Fixed fee amount. Used for fixed / hybrid. */
  fixedAmount?: MoneyString | string | number | null;
  /**
   * When basis is investor_net_profit, optional per-investor overrides:
   * map partnerId → percent (0–100).
   */
  perInvestorPercent?: Record<string, MoneyString | string | number>;
  /**
   * If false, coordinator's own profit allocation is excluded from commission base
   * when using investor_net_profit or when distributing after commission.
   */
  chargeOnCoordinatorProfit?: boolean;
};

export type PartnerProfitLine = {
  partnerId: string;
  isCoordinator: boolean;
  profitBeforeCommission: MoneyString;
};

export type CommissionResult = {
  totalCommission: MoneyString;
  /** Amount charged against each partner's profit (for investor_net_profit basis). */
  perPartnerCommission: { partnerId: string; commission: MoneyString }[];
  basisUsed: CommissionBasis;
  notes: string[];
};

function rateFromPercent(percent: Decimal.Value): Decimal {
  const p = dec(percent, "percent");
  if (p.lt(0) || p.gt(100)) {
    throw new FinanceError("INVALID_PERCENT", "Commission percent must be between 0 and 100");
  }
  return p.dividedBy(100);
}

/**
 * Calculate coordinator commission once. Never double-count.
 */
export function calculateCoordinatorCommission(input: {
  rule: CommissionRuleInput;
  saleProceeds: MoneyString | string | number;
  distributableProfit: MoneyString | string | number;
  partnerProfits: PartnerProfitLine[];
  currencyScale?: number;
}): CommissionResult {
  const scale = input.currencyScale ?? 3;
  const sale = dec(input.saleProceeds, "saleProceeds");
  const distributable = dec(input.distributableProfit, "distributableProfit");
  assertNonNegative(sale, "saleProceeds");
  // Distributable can be zero or negative (loss) — commission on losses is zero unless fixed.
  const notes: string[] = [];
  const perPartner: { partnerId: string; commission: Decimal }[] = input.partnerProfits.map((p) => ({
    partnerId: p.partnerId,
    commission: new Decimal(0),
  }));

  let total = new Decimal(0);
  const rule = input.rule;

  switch (rule.basis) {
    case "fixed": {
      total = dec(rule.fixedAmount ?? 0, "fixedAmount");
      assertNonNegative(total, "fixedAmount");
      notes.push("Fixed management fee");
      break;
    }
    case "sale_value": {
      const rate = rateFromPercent(rule.percent ?? 0);
      total = sale.times(rate);
      notes.push(`Commission = ${rule.percent}% of sale value`);
      break;
    }
    case "distributable_profit": {
      const rate = rateFromPercent(rule.percent ?? 0);
      total = Decimal.max(0, distributable).times(rate);
      notes.push(`Commission = ${rule.percent}% of distributable profit`);
      break;
    }
    case "hybrid": {
      const fixed = dec(rule.fixedAmount ?? 0, "fixedAmount");
      assertNonNegative(fixed, "fixedAmount");
      const rate = rateFromPercent(rule.percent ?? 0);
      const variable = Decimal.max(0, distributable).times(rate);
      total = fixed.plus(variable);
      notes.push(`Hybrid: fixed ${money(fixed, scale)} + ${rule.percent}% of profit`);
      break;
    }
    case "investor_net_profit": {
      const chargeCoordinator = rule.chargeOnCoordinatorProfit !== false;
      for (let i = 0; i < input.partnerProfits.length; i++) {
        const line = input.partnerProfits[i];
        if (line.isCoordinator && !chargeCoordinator) {
          notes.push(`Skipped coordinator ${line.partnerId} for commission base`);
          continue;
        }
        const override = rule.perInvestorPercent?.[line.partnerId];
        const pctVal = override ?? rule.percent ?? 0;
        const rate = rateFromPercent(pctVal);
        const base = Decimal.max(0, dec(line.profitBeforeCommission));
        const c = base.times(rate);
        perPartner[i].commission = c;
        total = total.plus(c);
      }
      notes.push("Commission = % of each investor net profit (applied once)");
      break;
    }
    default:
      throw new FinanceError("UNKNOWN_BASIS", `Unknown commission basis: ${rule.basis}`);
  }

  // Cap: commission cannot exceed positive distributable profit + fixed components already in total
  // For sale_value / fixed, allow fee even if profit is low — but never exceed sale proceeds.
  if (total.gt(sale)) {
    notes.push("Commission capped to sale proceeds");
    total = sale;
  }
  assertNonNegative(total, "totalCommission");

  return {
    totalCommission: money(total, scale),
    perPartnerCommission: perPartner.map((p) => ({
      partnerId: p.partnerId,
      commission: money(p.commission, scale),
    })),
    basisUsed: rule.basis,
    notes,
  };
}

import { calculateCoordinatorCommission, type CommissionRuleInput } from "./commission";
import {
  Decimal,
  FinanceError,
  allocateByWeights,
  assertNonNegative,
  dec,
  money,
  pct,
  sumMoney,
  type MoneyString,
} from "./decimal";

export const DEFAULT_WATERFALL_STEPS = [
  "record_sale_proceeds",
  "deduct_closing_costs",
  "return_capital",
  "reimburse_expenses",
  "calculate_distributable_profit",
  "apply_coordinator_commission",
  "distribute_profit_by_ownership",
  "record_payouts",
] as const;

export type WaterfallStep = (typeof DEFAULT_WATERFALL_STEPS)[number] | string;

export type PartnerSettlementInput = {
  partnerId: string;
  label: string;
  isCoordinator: boolean;
  /** Equity capital to return (ownership base). */
  capitalContributed: MoneyString | string | number;
  /** Ownership % of profit pool (0–100). */
  ownershipPercent: MoneyString | string | number;
  /** Approved unreimbursed expenses paid by this partner. */
  expensesOutstanding: MoneyString | string | number;
};

export type SettlementInput = {
  saleProceeds: MoneyString | string | number;
  closingCosts?: MoneyString | string | number;
  unpaidLiabilities?: MoneyString | string | number;
  partners: PartnerSettlementInput[];
  commission?: CommissionRuleInput | null;
  /**
   * If true (default), coordinator also receives ownership-based profit after commission.
   */
  coordinatorParticipatesInProfit?: boolean;
  waterfallSteps?: WaterfallStep[];
  currencyScale?: number;
  currency?: string;
  /**
   * When the sale does not cover capital + partner-paid expenses, share the shortfall
   * by ownership (everyone loses the same % of their stake) instead of the strict
   * capital-first waterfall. Default false here; projects opt in.
   */
  shareLossesByOwnership?: boolean;
};

export type PartnerPayoutLine = {
  partnerId: string;
  label: string;
  isCoordinator: boolean;
  /** Ownership % used for the profit pool (0–100). */
  ownershipPercent: MoneyString;
  capitalContributed: MoneyString;
  expensesPaid: MoneyString;
  capitalReturned: MoneyString;
  expenseReimbursement: MoneyString;
  /** Share of distributable profit BEFORE the coordinator cut (negative = share of a loss). */
  grossProfit: MoneyString;
  /** Coordinator cut charged against this partner's profit. */
  commissionPaid: MoneyString;
  /** Effective cut rate on this partner's gross profit (0–100). */
  commissionRatePercent: MoneyString;
  /** Profit after the coordinator cut (negative = loss). */
  profitShare: MoneyString;
  commissionEarned: MoneyString;
  /** Net cash to partner from this settlement. */
  totalPayout: MoneyString;
  /** totalPayout − capital − expenses paid. */
  netGain: MoneyString;
  /** netGain / (capital + expenses) × 100. */
  roiPercent: MoneyString;
  /** Share of the distributable profit before the cut (0–100). */
  profitPercentBefore: MoneyString;
  /** Share of the distributable profit actually received after cuts (incl. commission earned). */
  profitPercentAfter: MoneyString;
};

export type SettlementResult = {
  currency: string;
  scale: number;
  saleProceeds: MoneyString;
  closingCosts: MoneyString;
  unpaidLiabilities: MoneyString;
  netProceedsAfterCosts: MoneyString;
  totalCapitalReturned: MoneyString;
  totalExpenseReimbursements: MoneyString;
  grossSurplusAfterCapital: MoneyString;
  distributableProfitBeforeCommission: MoneyString;
  coordinatorCommission: MoneyString;
  distributableProfitAfterCommission: MoneyString;
  partnerLines: PartnerPayoutLine[];
  totalPayouts: MoneyString;
  residualCash: MoneyString;
  waterfallApplied: WaterfallStep[];
  /** True when the shortfall was shared by ownership. */
  lossShared: boolean;
  notes: string[];
  /** Invariant: totalPayouts + residualCash + closingCosts + unpaidLiabilities ≈ saleProceeds */
  balanced: boolean;
};

/**
 * Pure settlement waterfall. Does not touch the database.
 */
export function runSettlement(input: SettlementInput): SettlementResult {
  const scale = input.currencyScale ?? 3;
  const currency = input.currency ?? "JOD";
  const steps = (input.waterfallSteps?.length ? input.waterfallSteps : [...DEFAULT_WATERFALL_STEPS]) as WaterfallStep[];
  const notes: string[] = [];

  const sale = dec(input.saleProceeds, "saleProceeds");
  assertNonNegative(sale, "saleProceeds");
  const closing = dec(input.closingCosts ?? 0, "closingCosts");
  assertNonNegative(closing, "closingCosts");
  const liabilities = dec(input.unpaidLiabilities ?? 0, "unpaidLiabilities");
  assertNonNegative(liabilities, "unpaidLiabilities");

  if (input.partners.length === 0) {
    throw new FinanceError("NO_PARTNERS", "Settlement requires at least one partner");
  }

  const zero = () => new Decimal(0);
  const ids = input.partners.map((p) => p.partnerId);
  const mk = () => new Map<string, Decimal>(ids.map((id) => [id, zero()]));
  const capitalReturned = mk();
  const expensePaid = mk();
  const grossProfit = mk();
  const commissionPaid = mk();
  const profitShare = mk();
  const commissionEarned = mk();
  let grossComputed = false;
  let perPartnerCut = false;

  const capitalIn = input.partners.map((p) => {
    const c = dec(p.capitalContributed, "capitalContributed");
    assertNonNegative(c, "capitalContributed");
    return c;
  });
  const expensesIn = input.partners.map((p) => {
    const e = dec(p.expensesOutstanding, "expensesOutstanding");
    assertNonNegative(e, "expensesOutstanding");
    return e;
  });
  const sumD = (xs: Decimal[]) => xs.reduce((a, b) => a.plus(b), zero());

  let available = sale;
  let netAfterCosts = sale;
  let totalCapital = zero();
  let totalExpenses = zero();
  let distributableBefore = zero();
  let commissionTotal = zero();
  let distributableAfter = zero();
  let lossShared = false;

  const coordinator = input.partners.find((p) => p.isCoordinator) ?? null;
  const coordinatorParticipates = input.coordinatorParticipatesInProfit !== false;
  const rule: CommissionRuleInput = input.commission ?? { basis: "distributable_profit", percent: 0 };

  const deductCosts = closing.plus(liabilities);
  if (deductCosts.gt(sale)) {
    throw new FinanceError("INSUFFICIENT_PROCEEDS", "Closing costs/liabilities exceed sale proceeds");
  }
  const owed = sumD(capitalIn).plus(sumD(expensesIn));

  if (input.shareLossesByOwnership && sale.minus(deductCosts).lt(owed)) {
    // ── Loss path: everyone gets their stake back minus their ownership share of the shortfall.
    available = sale.minus(deductCosts);
    netAfterCosts = available;
    const shortfall = owed.minus(available);
    const weights = input.partners.map((p) => dec(p.ownershipPercent));
    const lossParts = sumD(weights).isZero()
      ? allocateByWeights(shortfall, capitalIn.map((c, i) => c.plus(expensesIn[i])), scale)
      : allocateByWeights(shortfall, weights, scale);
    const breaches = input.partners.some((_, i) => dec(lossParts[i]).gt(capitalIn[i].plus(expensesIn[i])));
    if (breaches) {
      // A partner's loss share exceeds their stake — fall back to pro-rata of stakes.
      const parts = allocateByWeights(available, capitalIn.map((c, i) => c.plus(expensesIn[i])), scale);
      input.partners.forEach((p, i) => {
        const stake = capitalIn[i].plus(expensesIn[i]);
        const loss = stake.minus(dec(parts[i]));
        capitalReturned.set(p.partnerId, capitalIn[i]);
        expensePaid.set(p.partnerId, expensesIn[i]);
        grossProfit.set(p.partnerId, loss.negated());
        profitShare.set(p.partnerId, loss.negated());
      });
      notes.push("Loss larger than some stakes — remaining cash returned pro-rata to capital + expenses");
    } else {
      input.partners.forEach((p, i) => {
        capitalReturned.set(p.partnerId, capitalIn[i]);
        expensePaid.set(p.partnerId, expensesIn[i]);
        grossProfit.set(p.partnerId, dec(lossParts[i]).negated());
        profitShare.set(p.partnerId, dec(lossParts[i]).negated());
      });
      notes.push(`Shortfall ${money(shortfall, scale)} shared by ownership`);
    }
    totalCapital = sumD(capitalIn);
    totalExpenses = sumD(expensesIn);
    distributableBefore = shortfall.negated();
    distributableAfter = shortfall.negated();
    available = zero();
    lossShared = true;
    grossComputed = true;
    notes.push("No coordinator commission on a loss");
  } else {
    for (const step of steps) {
      switch (step) {
        case "record_sale_proceeds": {
          notes.push(`Sale proceeds recorded: ${money(sale, scale)} ${currency}`);
          break;
        }
        case "deduct_closing_costs": {
          available = available.minus(deductCosts);
          netAfterCosts = available;
          notes.push(`Deducted closing costs ${money(closing, scale)} + liabilities ${money(liabilities, scale)}`);
          break;
        }
        case "return_capital": {
          const needed = sumD(capitalIn);
          if (needed.gt(available)) {
            const parts = allocateByWeights(available, capitalIn, scale);
            input.partners.forEach((p, i) => capitalReturned.set(p.partnerId, dec(parts[i])));
            totalCapital = available;
            available = zero();
            notes.push("Capital returned pro-rata (proceeds insufficient for full return)");
          } else {
            input.partners.forEach((p, i) => capitalReturned.set(p.partnerId, capitalIn[i]));
            totalCapital = needed;
            available = available.minus(needed);
            notes.push(`Returned capital ${money(needed, scale)}`);
          }
          break;
        }
        case "reimburse_expenses": {
          const needed = sumD(expensesIn);
          if (needed.gt(available)) {
            const parts = allocateByWeights(available, expensesIn, scale);
            input.partners.forEach((p, i) => expensePaid.set(p.partnerId, dec(parts[i])));
            totalExpenses = available;
            available = zero();
            notes.push("Expenses reimbursed pro-rata (insufficient cash)");
          } else {
            input.partners.forEach((p, i) => expensePaid.set(p.partnerId, expensesIn[i]));
            totalExpenses = needed;
            available = available.minus(needed);
            notes.push(`Reimbursed expenses ${money(needed, scale)}`);
          }
          break;
        }
        case "calculate_distributable_profit": {
          distributableBefore = available;
          const g = allocateProfitByOwnership({
            profit: Decimal.max(0, distributableBefore),
            partners: input.partners,
            coordinatorParticipates,
            scale,
          });
          for (const id of ids) grossProfit.set(id, dec(g.get(id) ?? 0));
          grossComputed = true;
          notes.push(`Distributable profit before commission: ${money(distributableBefore, scale)}`);
          break;
        }
        case "apply_coordinator_commission": {
          if (!grossComputed) {
            const g = allocateProfitByOwnership({
              profit: Decimal.max(0, available),
              partners: input.partners,
              coordinatorParticipates,
              scale,
            });
            for (const id of ids) grossProfit.set(id, dec(g.get(id) ?? 0));
            distributableBefore = available;
            grossComputed = true;
          }
          const commission = calculateCoordinatorCommission({
            // Charging the coordinator a cut of his own profit is a no-op, so never do it.
            rule: rule.basis === "investor_net_profit" ? { ...rule, chargeOnCoordinatorProfit: false } : rule,
            saleProceeds: money(sale, scale),
            distributableProfit: money(distributableBefore, scale),
            partnerProfits: input.partners.map((p) => ({
              partnerId: p.partnerId,
              isCoordinator: p.isCoordinator,
              profitBeforeCommission: money(grossProfit.get(p.partnerId) ?? 0, scale),
            })),
            currencyScale: scale,
          });
          commissionTotal = dec(commission.totalCommission);
          if (commissionTotal.gt(available)) {
            commissionTotal = available;
            notes.push("Commission reduced to available cash");
          }
          if (rule.basis === "investor_net_profit") {
            perPartnerCut = true;
            for (const c of commission.perPartnerCommission) commissionPaid.set(c.partnerId, dec(c.commission));
          }
          available = available.minus(commissionTotal);
          if (coordinator) {
            commissionEarned.set(coordinator.partnerId, commissionTotal);
          } else if (commissionTotal.gt(0)) {
            notes.push("Commission calculated but no coordinator partner marked — held as residual");
          }
          notes.push(...commission.notes);
          notes.push(`Coordinator commission: ${money(commissionTotal, scale)}`);
          break;
        }
        case "distribute_profit_by_ownership": {
          distributableAfter = available;
          if (perPartnerCut) {
            // Each partner keeps their gross share minus their own cut.
            let distributed = zero();
            for (const id of ids) {
              const net = Decimal.max(0, (grossProfit.get(id) ?? zero()).minus(commissionPaid.get(id) ?? zero()));
              profitShare.set(id, net);
              distributed = distributed.plus(net);
            }
            available = available.minus(distributed);
            notes.push(`Distributed profit ${money(distributed, scale)} (gross share minus each partner's cut)`);
          } else {
            const shares = allocateProfitByOwnership({
              profit: Decimal.max(0, distributableAfter),
              partners: input.partners,
              coordinatorParticipates,
              scale,
            });
            for (const id of ids) profitShare.set(id, dec(shares.get(id) ?? 0));
            const distributed = [...shares.values()].reduce((a, b) => a.plus(dec(b)), zero());
            available = available.minus(distributed);
            if (!grossComputed) {
              for (const id of ids) grossProfit.set(id, profitShare.get(id) ?? zero());
              grossComputed = true;
            }
            for (const id of ids) {
              commissionPaid.set(id, Decimal.max(0, (grossProfit.get(id) ?? zero()).minus(profitShare.get(id) ?? zero())));
            }
            notes.push(`Distributed profit ${money(distributed, scale)} by ownership`);
          }
          break;
        }
        case "record_payouts": {
          notes.push("Payout lines assembled");
          break;
        }
        default:
          notes.push(`Skipped unknown waterfall step: ${step}`);
      }
    }
  }

  if (!steps.includes("calculate_distributable_profit") && !lossShared) {
    distributableBefore = available
      .plus([...profitShare.values()].reduce((a, b) => a.plus(b), zero()))
      .plus(commissionTotal);
  }

  const profitBase = distributableBefore.gt(0) ? distributableBefore : null;
  const partnerLines: PartnerPayoutLine[] = input.partners.map((p, i) => {
    const cap = capitalReturned.get(p.partnerId) ?? zero();
    const exp = expensePaid.get(p.partnerId) ?? zero();
    const gross = grossProfit.get(p.partnerId) ?? zero();
    const cut = commissionPaid.get(p.partnerId) ?? zero();
    const prof = profitShare.get(p.partnerId) ?? zero();
    const comm = commissionEarned.get(p.partnerId) ?? zero();
    const total = cap.plus(exp).plus(prof).plus(comm);
    const stake = capitalIn[i].plus(expensesIn[i]);
    const gain = total.minus(stake);
    return {
      partnerId: p.partnerId,
      label: p.label,
      isCoordinator: p.isCoordinator,
      ownershipPercent: pct(p.ownershipPercent, 4),
      capitalContributed: money(capitalIn[i], scale),
      expensesPaid: money(expensesIn[i], scale),
      capitalReturned: money(cap, scale),
      expenseReimbursement: money(exp, scale),
      grossProfit: money(gross, scale),
      commissionPaid: money(cut, scale),
      commissionRatePercent: gross.gt(0) ? pct(cut.times(100).dividedBy(gross), 4) : pct(0, 4),
      profitShare: money(prof, scale),
      commissionEarned: money(comm, scale),
      totalPayout: money(total, scale),
      netGain: money(gain, scale),
      roiPercent: stake.gt(0) ? pct(gain.times(100).dividedBy(stake), 4) : pct(0, 4),
      profitPercentBefore: profitBase ? pct(gross.times(100).dividedBy(profitBase), 4) : pct(0, 4),
      profitPercentAfter: profitBase ? pct(prof.plus(comm).times(100).dividedBy(profitBase), 4) : pct(0, 4),
    };
  });

  const totalPayouts = sumMoney(
    partnerLines.map((l) => l.totalPayout),
    scale
  );
  const residualCash = money(available, scale);
  const accounted = dec(totalPayouts).plus(dec(residualCash)).plus(closing).plus(liabilities);
  const balanced = accounted.eq(sale.toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN)) || accounted.eq(sale);

  if (!balanced) {
    notes.push(`Balance check: accounted ${money(accounted, scale)} vs sale ${money(sale, scale)} (residual assigned)`);
  }

  return {
    currency,
    scale,
    saleProceeds: money(sale, scale),
    closingCosts: money(closing, scale),
    unpaidLiabilities: money(liabilities, scale),
    netProceedsAfterCosts: money(netAfterCosts, scale),
    totalCapitalReturned: money(totalCapital, scale),
    totalExpenseReimbursements: money(totalExpenses, scale),
    grossSurplusAfterCapital: money(netAfterCosts.minus(totalCapital), scale),
    distributableProfitBeforeCommission: money(distributableBefore, scale),
    coordinatorCommission: money(commissionTotal, scale),
    distributableProfitAfterCommission: money(distributableAfter, scale),
    partnerLines,
    totalPayouts,
    residualCash,
    waterfallApplied: steps,
    lossShared,
    notes,
    balanced,
  };
}

function allocateProfitByOwnership(args: {
  profit: Decimal;
  partners: PartnerSettlementInput[];
  coordinatorParticipates: boolean;
  scale: number;
}): Map<string, MoneyString> {
  const eligible = args.partners.filter((p) => args.coordinatorParticipates || !p.isCoordinator);
  const weights = eligible.map((p) => dec(p.ownershipPercent));
  const weightSum = weights.reduce((a, b) => a.plus(b), new Decimal(0));
  const out = new Map<string, MoneyString>();
  for (const p of args.partners) out.set(p.partnerId, money(0, args.scale));
  if (args.profit.isZero() || weightSum.isZero()) return out;

  // Renormalize eligible ownership to 100% of profit pool
  const parts = allocateByWeights(args.profit, weights, args.scale);
  eligible.forEach((p, i) => out.set(p.partnerId, parts[i]));
  return out;
}

/** Spec scenario helper used by tests and demo seed. */
export function demoLandScenario(opts?: { commissionPercentOfProfit?: number }) {
  const commissionPercent = opts?.commissionPercentOfProfit ?? 0;
  return runSettlement({
    saleProceeds: "960000",
    closingCosts: "0",
    unpaidLiabilities: "0",
    currency: "JOD",
    currencyScale: 3,
    commission:
      commissionPercent > 0
        ? { basis: "distributable_profit", percent: commissionPercent }
        : { basis: "distributable_profit", percent: 0 },
    partners: [
      {
        partnerId: "coordinator",
        label: "Coordinator",
        isCoordinator: true,
        capitalContributed: "100000",
        ownershipPercent: "20",
        expensesOutstanding: "100000",
      },
      {
        partnerId: "investor-a",
        label: "Investor A",
        isCoordinator: false,
        capitalContributed: "200000",
        ownershipPercent: "40",
        expensesOutstanding: "0",
      },
      {
        partnerId: "investor-b",
        label: "Investor B",
        isCoordinator: false,
        capitalContributed: "200000",
        ownershipPercent: "40",
        expensesOutstanding: "0",
      },
    ],
  });
}

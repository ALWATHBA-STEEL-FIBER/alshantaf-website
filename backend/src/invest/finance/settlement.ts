import { calculateCoordinatorCommission, type CommissionRuleInput } from "./commission";
import {
  Decimal,
  FinanceError,
  allocateByWeights,
  assertNonNegative,
  dec,
  money,
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
};

export type PartnerPayoutLine = {
  partnerId: string;
  label: string;
  isCoordinator: boolean;
  capitalReturned: MoneyString;
  expenseReimbursement: MoneyString;
  profitShare: MoneyString;
  commissionEarned: MoneyString;
  /** Net cash to partner from this settlement. */
  totalPayout: MoneyString;
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

  let available = sale;
  const capitalReturned = new Map<string, Decimal>();
  const expensePaid = new Map<string, Decimal>();
  const profitShare = new Map<string, Decimal>();
  const commissionEarned = new Map<string, Decimal>();
  for (const p of input.partners) {
    capitalReturned.set(p.partnerId, new Decimal(0));
    expensePaid.set(p.partnerId, new Decimal(0));
    profitShare.set(p.partnerId, new Decimal(0));
    commissionEarned.set(p.partnerId, new Decimal(0));
  }

  let netAfterCosts = sale;
  let totalCapital = new Decimal(0);
  let totalExpenses = new Decimal(0);
  let distributableBefore = new Decimal(0);
  let commissionTotal = new Decimal(0);
  let distributableAfter = new Decimal(0);

  const coordinator = input.partners.find((p) => p.isCoordinator) ?? null;
  const coordinatorParticipates = input.coordinatorParticipatesInProfit !== false;

  for (const step of steps) {
    switch (step) {
      case "record_sale_proceeds": {
        notes.push(`Sale proceeds recorded: ${money(sale, scale)} ${currency}`);
        break;
      }
      case "deduct_closing_costs": {
        const deduct = closing.plus(liabilities);
        if (deduct.gt(available)) {
          throw new FinanceError("INSUFFICIENT_PROCEEDS", "Closing costs/liabilities exceed sale proceeds");
        }
        available = available.minus(deduct);
        netAfterCosts = available;
        notes.push(`Deducted closing costs ${money(closing, scale)} + liabilities ${money(liabilities, scale)}`);
        break;
      }
      case "return_capital": {
        const capitals = input.partners.map((p) => dec(p.capitalContributed, "capitalContributed"));
        const needed = capitals.reduce((a, b) => a.plus(b), new Decimal(0));
        if (needed.gt(available)) {
          // Pro-rata return of capital when underfunded
          const parts = allocateByWeights(available, capitals, scale);
          input.partners.forEach((p, i) => {
            capitalReturned.set(p.partnerId, dec(parts[i]));
          });
          totalCapital = available;
          available = new Decimal(0);
          notes.push("Capital returned pro-rata (proceeds insufficient for full return)");
        } else {
          input.partners.forEach((p, i) => {
            capitalReturned.set(p.partnerId, capitals[i]);
          });
          totalCapital = needed;
          available = available.minus(needed);
          notes.push(`Returned capital ${money(needed, scale)}`);
        }
        break;
      }
      case "reimburse_expenses": {
        const expenses = input.partners.map((p) => {
          const e = dec(p.expensesOutstanding, "expensesOutstanding");
          assertNonNegative(e, "expensesOutstanding");
          return e;
        });
        const needed = expenses.reduce((a, b) => a.plus(b), new Decimal(0));
        if (needed.gt(available)) {
          const parts = allocateByWeights(available, expenses, scale);
          input.partners.forEach((p, i) => {
            expensePaid.set(p.partnerId, dec(parts[i]));
          });
          totalExpenses = available;
          available = new Decimal(0);
          notes.push("Expenses reimbursed pro-rata (insufficient cash)");
        } else {
          input.partners.forEach((p, i) => {
            expensePaid.set(p.partnerId, expenses[i]);
          });
          totalExpenses = needed;
          available = available.minus(needed);
          notes.push(`Reimbursed expenses ${money(needed, scale)}`);
        }
        break;
      }
      case "calculate_distributable_profit": {
        distributableBefore = available;
        notes.push(`Distributable profit before commission: ${money(distributableBefore, scale)}`);
        break;
      }
      case "apply_coordinator_commission": {
        // Preliminary ownership profit before commission (for investor_net_profit basis)
        const prelimShares = allocateProfitByOwnership({
          profit: Decimal.max(0, distributableBefore),
          partners: input.partners,
          coordinatorParticipates,
          scale,
        });
        const commission = calculateCoordinatorCommission({
          rule: input.commission ?? { basis: "distributable_profit", percent: 0 },
          saleProceeds: money(sale, scale),
          distributableProfit: money(distributableBefore, scale),
          partnerProfits: input.partners.map((p) => ({
            partnerId: p.partnerId,
            isCoordinator: p.isCoordinator,
            profitBeforeCommission: prelimShares.get(p.partnerId) ?? money(0, scale),
          })),
          currencyScale: scale,
        });
        commissionTotal = dec(commission.totalCommission);
        if (commissionTotal.gt(available)) {
          commissionTotal = available;
          notes.push("Commission reduced to available cash");
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
        const shares = allocateProfitByOwnership({
          profit: Decimal.max(0, distributableAfter),
          partners: input.partners,
          coordinatorParticipates,
          scale,
        });
        for (const p of input.partners) {
          profitShare.set(p.partnerId, dec(shares.get(p.partnerId) ?? 0));
        }
        const distributed = [...shares.values()].reduce((a, b) => a.plus(dec(b)), new Decimal(0));
        available = available.minus(distributed);
        notes.push(`Distributed profit ${money(distributed, scale)} by ownership`);
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

  // If calculate/distribute steps were omitted, treat remaining available as residual
  if (!steps.includes("calculate_distributable_profit")) {
    distributableBefore = available.plus(
      [...profitShare.values()].reduce((a, b) => a.plus(b), new Decimal(0))
    ).plus(commissionTotal);
  }
  if (!steps.includes("distribute_profit_by_ownership") && !steps.includes("apply_coordinator_commission")) {
    // leave available as residual
  }

  const partnerLines: PartnerPayoutLine[] = input.partners.map((p) => {
    const cap = capitalReturned.get(p.partnerId) ?? new Decimal(0);
    const exp = expensePaid.get(p.partnerId) ?? new Decimal(0);
    const prof = profitShare.get(p.partnerId) ?? new Decimal(0);
    const comm = commissionEarned.get(p.partnerId) ?? new Decimal(0);
    const total = cap.plus(exp).plus(prof).plus(comm);
    return {
      partnerId: p.partnerId,
      label: p.label,
      isCoordinator: p.isCoordinator,
      capitalReturned: money(cap, scale),
      expenseReimbursement: money(exp, scale),
      profitShare: money(prof, scale),
      commissionEarned: money(comm, scale),
      totalPayout: money(total, scale),
    };
  });

  const totalPayouts = sumMoney(
    partnerLines.map((l) => l.totalPayout),
    scale
  );
  const residualCash = money(available, scale);
  const accounted = dec(totalPayouts)
    .plus(dec(residualCash))
    .plus(closing)
    .plus(liabilities);
  const balanced = accounted.eq(sale.toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN)) || accounted.eq(sale);

  if (!balanced) {
    notes.push(
      `Balance check: accounted ${money(accounted, scale)} vs sale ${money(sale, scale)} (residual assigned)`
    );
  }

  const grossSurplusAfterCapital = money(
    netAfterCosts.minus(totalCapital),
    scale
  );

  return {
    currency,
    scale,
    saleProceeds: money(sale, scale),
    closingCosts: money(closing, scale),
    unpaidLiabilities: money(liabilities, scale),
    netProceedsAfterCosts: money(netAfterCosts, scale),
    totalCapitalReturned: money(totalCapital, scale),
    totalExpenseReimbursements: money(totalExpenses, scale),
    grossSurplusAfterCapital,
    distributableProfitBeforeCommission: money(distributableBefore, scale),
    coordinatorCommission: money(commissionTotal, scale),
    distributableProfitAfterCommission: money(distributableAfter, scale),
    partnerLines,
    totalPayouts,
    residualCash,
    waterfallApplied: steps,
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

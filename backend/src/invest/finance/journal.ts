import { Decimal, FinanceError, dec, money, type MoneyString } from "./decimal";

export type JournalLineInput = {
  accountCode: string;
  debit: MoneyString | string | number;
  credit: MoneyString | string | number;
  currency: string;
  partnerId?: string | null;
  memo?: string | null;
};

/**
 * Validate double-entry: each line has exactly one positive side;
 * totals balance per currency.
 */
export function validateBalancedJournal(lines: JournalLineInput[], scale = 3): void {
  if (lines.length < 2) {
    throw new FinanceError("JOURNAL_TOO_SHORT", "A journal requires at least two lines");
  }
  const totals = new Map<string, { debit: Decimal; credit: Decimal }>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const debit = dec(line.debit, `lines[${i}].debit`);
    const credit = dec(line.credit, `lines[${i}].credit`);
    if (debit.isNegative() || credit.isNegative()) {
      throw new FinanceError("NEGATIVE_LINE", `Journal line ${i + 1} cannot be negative`);
    }
    if ((debit.isZero() && credit.isZero()) || (!debit.isZero() && !credit.isZero())) {
      throw new FinanceError(
        "INVALID_JOURNAL_LINE",
        `Journal line ${i + 1} must have exactly one of debit or credit`
      );
    }
    const t = totals.get(line.currency) ?? { debit: new Decimal(0), credit: new Decimal(0) };
    t.debit = t.debit.plus(debit);
    t.credit = t.credit.plus(credit);
    totals.set(line.currency, t);
  }

  for (const [currency, t] of totals) {
    if (!t.debit.eq(t.credit)) {
      throw new FinanceError(
        "UNBALANCED_JOURNAL",
        `Journal not balanced in ${currency}: debit ${money(t.debit, scale)} ≠ credit ${money(t.credit, scale)}`,
        { currency, debit: money(t.debit, scale), credit: money(t.credit, scale) }
      );
    }
  }
}

/** Build standard project chart account codes. */
export const PROJECT_COA = {
  CASH: "1000",
  BANK: "1010",
  LAND_ASSET: "1500",
  EXPENSE: "5000",
  REIMBURSEMENT_PAYABLE: "2100",
  INVESTOR_CAPITAL: "3000",
  PROJECT_REVENUE: "4000",
  MANAGEMENT_FEE: "5100",
  DISTRIBUTIONS: "3200",
  ROUNDING: "3999",
} as const;

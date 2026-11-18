import { describe, expect, it } from "vitest";
import { calculateCoordinatorCommission } from "./commission";
import { allocateByWeights, money, sumMoney } from "./decimal";
import { validateBalancedJournal, PROJECT_COA } from "./journal";
import { assertOwnershipPoolComplete, computeOwnershipFromCapital } from "./ownership";
import { demoLandScenario, runSettlement } from "./settlement";

describe("demo land partnership settlement (spec)", () => {
  it("matches the required waterfall without coordinator commission", () => {
    const result = demoLandScenario({ commissionPercentOfProfit: 0 });

    expect(result.saleProceeds).toBe("960000.000");
    expect(result.totalCapitalReturned).toBe("500000.000");
    expect(result.totalExpenseReimbursements).toBe("100000.000");
    expect(result.distributableProfitBeforeCommission).toBe("360000.000");
    expect(result.coordinatorCommission).toBe("0.000");

    const byId = Object.fromEntries(result.partnerLines.map((l) => [l.partnerId, l]));
    expect(byId.coordinator.profitShare).toBe("72000.000");
    expect(byId["investor-a"].profitShare).toBe("144000.000");
    expect(byId["investor-b"].profitShare).toBe("144000.000");

    expect(byId.coordinator.capitalReturned).toBe("100000.000");
    expect(byId.coordinator.expenseReimbursement).toBe("100000.000");
    expect(byId.coordinator.totalPayout).toBe("272000.000"); // 100k + 100k + 72k
    expect(byId["investor-a"].totalPayout).toBe("344000.000"); // 200k + 144k
    expect(byId["investor-b"].totalPayout).toBe("344000.000");

    expect(result.totalPayouts).toBe("960000.000");
    expect(result.residualCash).toBe("0.000");
    expect(result.balanced).toBe(true);
  });

  it("does not treat expense reimbursement as ownership increase", () => {
    const ownership = computeOwnershipFromCapital([
      { partnerId: "coordinator", equityCapital: "100000" },
      { partnerId: "investor-a", equityCapital: "200000" },
      { partnerId: "investor-b", equityCapital: "200000" },
    ]);
    assertOwnershipPoolComplete(ownership);
    const c = ownership.find((o) => o.partnerId === "coordinator")!;
    expect(c.ownershipPercent).toBe("20.00000000");
    // Expense 100k is NOT in equity capital — ownership stays 20%
  });

  it("applies commission exactly once on distributable profit", () => {
    const result = demoLandScenario({ commissionPercentOfProfit: 10 });
    expect(result.distributableProfitBeforeCommission).toBe("360000.000");
    expect(result.coordinatorCommission).toBe("36000.000");
    // Remaining 324000 split 20/40/40
    const byId = Object.fromEntries(result.partnerLines.map((l) => [l.partnerId, l]));
    expect(byId.coordinator.profitShare).toBe("64800.000");
    expect(byId["investor-a"].profitShare).toBe("129600.000");
    expect(byId["investor-b"].profitShare).toBe("129600.000");
    expect(byId.coordinator.commissionEarned).toBe("36000.000");
    expect(sumMoney(result.partnerLines.map((l) => l.totalPayout))).toBe("960000.000");
  });

  it("supports percent-of-sale commission without double counting", () => {
    const result = runSettlement({
      saleProceeds: "960000",
      partners: [
        {
          partnerId: "c",
          label: "C",
          isCoordinator: true,
          capitalContributed: "100000",
          ownershipPercent: "20",
          expensesOutstanding: "100000",
        },
        {
          partnerId: "a",
          label: "A",
          isCoordinator: false,
          capitalContributed: "200000",
          ownershipPercent: "40",
          expensesOutstanding: "0",
        },
        {
          partnerId: "b",
          label: "B",
          isCoordinator: false,
          capitalContributed: "200000",
          ownershipPercent: "40",
          expensesOutstanding: "0",
        },
      ],
      commission: { basis: "sale_value", percent: 2 },
    });
    expect(result.coordinatorCommission).toBe("19200.000");
    expect(result.totalPayouts).toBe("960000.000");
  });
});

describe("losses and partial funding", () => {
  it("pro-rates capital return when sale is below capital+expenses", () => {
    const result = runSettlement({
      saleProceeds: "400000",
      partners: [
        {
          partnerId: "c",
          label: "C",
          isCoordinator: true,
          capitalContributed: "100000",
          ownershipPercent: "20",
          expensesOutstanding: "100000",
        },
        {
          partnerId: "a",
          label: "A",
          isCoordinator: false,
          capitalContributed: "200000",
          ownershipPercent: "40",
          expensesOutstanding: "0",
        },
        {
          partnerId: "b",
          label: "B",
          isCoordinator: false,
          capitalContributed: "200000",
          ownershipPercent: "40",
          expensesOutstanding: "0",
        },
      ],
      commission: { basis: "distributable_profit", percent: 0 },
    });
    // Capital needs 500k but only 400k available → pro-rata, then no expense/profit
    expect(result.totalCapitalReturned).toBe("400000.000");
    expect(result.totalExpenseReimbursements).toBe("0.000");
    expect(result.distributableProfitBeforeCommission).toBe("0.000");
    expect(result.totalPayouts).toBe("400000.000");
  });

  it("handles hybrid commission", () => {
    const c = calculateCoordinatorCommission({
      rule: { basis: "hybrid", fixedAmount: "1000", percent: 5 },
      saleProceeds: "100000",
      distributableProfit: "20000",
      partnerProfits: [],
    });
    expect(c.totalCommission).toBe("2000.000"); // 1000 + 5%*20000
  });
});

describe("rounding and journal invariants", () => {
  it("allocates residual fils deterministically", () => {
    const parts = allocateByWeights("100.000", ["1", "1", "1"], 3);
    expect(sumMoney(parts)).toBe("100.000");
    expect(parts[0]).toBe("33.334");
    expect(parts[1]).toBe("33.333");
    expect(parts[2]).toBe("33.333");
  });

  it("rejects unbalanced journals", () => {
    expect(() =>
      validateBalancedJournal([
        { accountCode: PROJECT_COA.CASH, debit: "100", credit: "0", currency: "JOD" },
        { accountCode: PROJECT_COA.BANK, debit: "0", credit: "99", currency: "JOD" },
      ])
    ).toThrow(/not balanced/i);
  });

  it("accepts balanced multi-line journals", () => {
    expect(() =>
      validateBalancedJournal([
        { accountCode: PROJECT_COA.BANK, debit: "960000", credit: "0", currency: "JOD" },
        { accountCode: PROJECT_COA.LAND_ASSET, debit: "0", credit: "500000", currency: "JOD" },
        { accountCode: PROJECT_COA.PROJECT_REVENUE, debit: "0", credit: "460000", currency: "JOD" },
      ])
    ).not.toThrow();
  });

  it("money helper uses banker's scale", () => {
    expect(money("1.2345", 3)).toBe("1.234");
    expect(money("1.2355", 3)).toBe("1.236");
  });
});

describe("configurable waterfall order", () => {
  it("can reimburse expenses before returning capital", () => {
    const result = runSettlement({
      saleProceeds: "250000",
      waterfallSteps: [
        "record_sale_proceeds",
        "deduct_closing_costs",
        "reimburse_expenses",
        "return_capital",
        "calculate_distributable_profit",
        "apply_coordinator_commission",
        "distribute_profit_by_ownership",
        "record_payouts",
      ],
      commission: { basis: "distributable_profit", percent: 0 },
      partners: [
        {
          partnerId: "c",
          label: "C",
          isCoordinator: true,
          capitalContributed: "100000",
          ownershipPercent: "50",
          expensesOutstanding: "100000",
        },
        {
          partnerId: "a",
          label: "A",
          isCoordinator: false,
          capitalContributed: "100000",
          ownershipPercent: "50",
          expensesOutstanding: "0",
        },
      ],
    });
    const byId = Object.fromEntries(result.partnerLines.map((l) => [l.partnerId, l]));
    expect(byId.c.expenseReimbursement).toBe("100000.000");
    // Remaining 150k for capital 200k → pro-rata
    expect(result.totalCapitalReturned).toBe("150000.000");
    expect(result.totalPayouts).toBe("250000.000");
  });
});

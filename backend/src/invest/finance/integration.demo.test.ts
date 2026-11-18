import { describe, expect, it } from "vitest";
import { runSettlement } from "./settlement";

/**
 * End-to-end arithmetic for the seeded DEMO-LAND-960K scenario,
 * independent of DB (mirrors seedDemo capital/expense/ownership).
 */
describe("DEMO-LAND-960K integration arithmetic", () => {
  it("distributes 960k with expense reimbursement excluded from ownership", () => {
    const result = runSettlement({
      saleProceeds: "960000",
      currency: "JOD",
      currencyScale: 3,
      commission: { basis: "distributable_profit", percent: 0 },
      partners: [
        {
          partnerId: "c",
          label: "Coordinator",
          isCoordinator: true,
          capitalContributed: "100000",
          ownershipPercent: "20",
          expensesOutstanding: "100000",
        },
        {
          partnerId: "a",
          label: "Investor A",
          isCoordinator: false,
          capitalContributed: "200000",
          ownershipPercent: "40",
          expensesOutstanding: "0",
        },
        {
          partnerId: "b",
          label: "Investor B",
          isCoordinator: false,
          capitalContributed: "200000",
          ownershipPercent: "40",
          expensesOutstanding: "0",
        },
      ],
    });

    expect(result.totalCapitalReturned).toBe("500000.000");
    expect(result.totalExpenseReimbursements).toBe("100000.000");
    expect(result.distributableProfitBeforeCommission).toBe("360000.000");
    const lines = Object.fromEntries(result.partnerLines.map((l) => [l.partnerId, l]));
    expect(lines.c.profitShare).toBe("72000.000");
    expect(lines.a.profitShare).toBe("144000.000");
    expect(lines.b.profitShare).toBe("144000.000");
    expect(result.totalPayouts).toBe("960000.000");
    expect(result.balanced).toBe(true);
  });
});

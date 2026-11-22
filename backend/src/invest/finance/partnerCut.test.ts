import { describe, expect, it } from "vitest";
import { runSettlement, type PartnerSettlementInput } from "./settlement";
import { sumMoney } from "./decimal";

// Land 500k: coordinator 100k, A 200k, B 200k. Coordinator also paid 100k expenses. Sold for 960k.
const partners: PartnerSettlementInput[] = [
  { partnerId: "me", label: "Coordinator", isCoordinator: true, capitalContributed: "100000", ownershipPercent: "20", expensesOutstanding: "100000" },
  { partnerId: "a", label: "A", isCoordinator: false, capitalContributed: "200000", ownershipPercent: "40", expensesOutstanding: "0" },
  { partnerId: "b", label: "B", isCoordinator: false, capitalContributed: "200000", ownershipPercent: "40", expensesOutstanding: "0" },
];

describe("coordinator cut taken from each partner's profit", () => {
  it("shows profit before and after the cut for every partner", () => {
    const r = runSettlement({
      saleProceeds: "960000",
      partners,
      commission: { basis: "investor_net_profit", percent: 10 },
    });
    const by = Object.fromEntries(r.partnerLines.map((l) => [l.partnerId, l]));
    expect(r.distributableProfitBeforeCommission).toBe("360000.000");
    expect(by.a.grossProfit).toBe("144000.000");
    expect(by.a.commissionPaid).toBe("14400.000");
    expect(by.a.profitShare).toBe("129600.000");
    expect(by.a.commissionRatePercent).toBe("10.0000");
    expect(by.a.totalPayout).toBe("329600.000");
    expect(by.a.roiPercent).toBe("64.8000");
    expect(by.a.profitPercentBefore).toBe("40.0000");
    expect(by.a.profitPercentAfter).toBe("36.0000");

    // Coordinator is never charged a cut on his own share.
    expect(by.me.grossProfit).toBe("72000.000");
    expect(by.me.commissionPaid).toBe("0.000");
    expect(by.me.commissionEarned).toBe("28800.000");
    expect(by.me.totalPayout).toBe("300800.000"); // 100k capital + 100k expenses + 72k + 28.8k
    expect(by.me.profitPercentAfter).toBe("28.0000");

    expect(r.coordinatorCommission).toBe("28800.000");
    expect(r.totalPayouts).toBe("960000.000");
    expect(r.balanced).toBe(true);
  });

  it("respects per-partner overrides (e.g. a friend pays no cut)", () => {
    const r = runSettlement({
      saleProceeds: "960000",
      partners,
      commission: { basis: "investor_net_profit", percent: 10, perInvestorPercent: { b: 0 } },
    });
    const by = Object.fromEntries(r.partnerLines.map((l) => [l.partnerId, l]));
    expect(by.b.commissionPaid).toBe("0.000");
    expect(by.b.profitShare).toBe("144000.000");
    expect(by.me.commissionEarned).toBe("14400.000");
    expect(r.totalPayouts).toBe("960000.000");
  });

  it("off-the-top commission is still shown as a per-partner deduction", () => {
    const r = runSettlement({
      saleProceeds: "960000",
      partners,
      commission: { basis: "distributable_profit", percent: 10 },
    });
    const by = Object.fromEntries(r.partnerLines.map((l) => [l.partnerId, l]));
    expect(by.a.grossProfit).toBe("144000.000");
    expect(by.a.commissionPaid).toBe("14400.000");
    expect(by.me.commissionPaid).toBe("7200.000");
    expect(sumMoney(r.partnerLines.map((l) => l.commissionPaid))).toBe(r.coordinatorCommission);
  });
});

describe("loss shared by ownership", () => {
  it("everyone loses their ownership share of the shortfall", () => {
    const r = runSettlement({
      saleProceeds: "550000",
      partners,
      commission: { basis: "investor_net_profit", percent: 10 },
      shareLossesByOwnership: true,
    });
    const by = Object.fromEntries(r.partnerLines.map((l) => [l.partnerId, l]));
    expect(r.lossShared).toBe(true);
    expect(by.me.profitShare).toBe("-10000.000");
    expect(by.me.totalPayout).toBe("190000.000");
    expect(by.a.totalPayout).toBe("180000.000");
    expect(r.coordinatorCommission).toBe("0.000");
    expect(r.totalPayouts).toBe("550000.000");
    expect(r.balanced).toBe(true);
  });
});

describe("custom expense split", () => {
  it("ownership split (no burdens) matches the default result", () => {
    const base = runSettlement({ saleProceeds: "960000", partners, commission: { basis: "investor_net_profit", percent: 10 } });
    const owned = runSettlement({
      saleProceeds: "960000",
      partners: partners.map((p) => ({ ...p, expenseBurden: String(Number(p.ownershipPercent) * 1000) })),
      commission: { basis: "investor_net_profit", percent: 10 },
    });
    expect(owned.partnerLines.map((l) => l.totalPayout)).toEqual(base.partnerLines.map((l) => l.totalPayout));
  });

  it("an expense carried 100% by the coordinator comes out of his profit only", () => {
    const r = runSettlement({
      saleProceeds: "960000",
      partners: partners.map((p) => ({ ...p, expenseBurden: p.partnerId === "me" ? "100000" : "0" })),
      commission: { basis: "investor_net_profit", percent: 0 },
    });
    const by = Object.fromEntries(r.partnerLines.map((l) => [l.partnerId, l]));
    // Without the expense profit would be 460k → 92k / 184k / 184k; the coordinator carries the 100k.
    expect(by.me.grossProfit).toBe("-8000.000");
    expect(by.a.grossProfit).toBe("184000.000");
    expect(by.b.grossProfit).toBe("184000.000");
    expect(by.me.totalPayout).toBe("192000.000");
    expect(sumMoney(r.partnerLines.map((l) => l.totalPayout), 3)).toBe("960000.000");
    expect(r.balanced).toBe(true);
  });

  it("cut is charged on the adjusted profit", () => {
    const r = runSettlement({
      saleProceeds: "960000",
      partners: partners.map((p) => ({ ...p, expenseBurden: p.partnerId === "a" ? "100000" : "0" })),
      commission: { basis: "investor_net_profit", percent: 10 },
    });
    const by = Object.fromEntries(r.partnerLines.map((l) => [l.partnerId, l]));
    // A: 40% of 460k = 184k − 100k = 84k gross, 8.4k cut.
    expect(by.a.grossProfit).toBe("84000.000");
    expect(by.a.commissionPaid).toBe("8400.000");
    expect(sumMoney(r.partnerLines.map((l) => l.totalPayout), 3)).toBe("960000.000");
    expect(r.balanced).toBe(true);
  });
});

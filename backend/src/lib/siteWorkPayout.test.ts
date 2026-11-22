import { describe, expect, it } from "vitest";
import { calcWeekPay } from "./siteWorkPayout";

const rates = { dailyPay: 20, extraHourPay: 3 };
const day = (d: string, regularHours: number, extraHours: number) => ({
  projectId: "p",
  workDate: new Date(`${d}T00:00:00Z`),
  regularHours,
  extraHours,
});

describe("site worker weekly pay", () => {
  it("extra hours with 0 regular hours pay extra only, not a full day", () => {
    const r = calcWeekPay([day("2026-11-21", 0, 1)], rates);
    expect(r.daysWorked).toBe(0);
    expect(r.extraOnlyDays).toBe(1);
    expect(r.dayPayTotal).toBe(0);
    expect(r.amount).toBe(3);
  });

  it("a full 8-hour day pays the daily wage", () => {
    expect(calcWeekPay([day("2026-11-21", 8, 0)], rates).amount).toBe(20);
  });

  it("a partial day is prorated and extra hours are added separately", () => {
    const r = calcWeekPay([day("2026-11-21", 4, 2)], rates);
    expect(r.dayUnits).toBe(0.5);
    expect(r.partialDays).toBe(1);
    expect(r.amount).toBe(10 + 6);
  });

  it("regular hours above 8 are capped at one day (overtime belongs in extra hours)", () => {
    expect(calcWeekPay([day("2026-11-21", 10, 0)], rates).amount).toBe(20);
  });

  it("mixed week", () => {
    const r = calcWeekPay(
      [day("2026-11-21", 8, 0), day("2026-11-22", 6, 1), day("2026-11-23", 0, 3), day("2026-11-24", 0, 0)],
      rates
    );
    expect(r.daysWorked).toBe(2);
    expect(r.fullDays).toBe(1);
    expect(r.partialDays).toBe(1);
    expect(r.extraOnlyDays).toBe(1);
    expect(r.dayUnits).toBe(1.75);
    expect(r.totalExtraHours).toBe(4);
    expect(r.amount).toBe(35 + 12);
  });
});

import type { Prisma } from "@prisma/client";
import { formatDateOnly, startOfWeekSaturday } from "./siteWorkDates";
import { dec } from "./siteWorkSerialize";

export type AttendanceSlice = {
  projectId: string;
  workDate: Date;
  regularHours: Prisma.Decimal | number | string;
  extraHours: Prisma.Decimal | number | string;
};

export type PayRates = {
  dailyPay: number;
  extraHourPay: number;
};

/** Regular hours that make one full paid day. */
export const STANDARD_DAY_HOURS = 8;

export type WeekPayBreakdown = {
  /** Days with any regular hours (full or partial). Extra-only days are not counted. */
  daysWorked: number;
  /** Paid day-equivalents: Σ min(regular, 8) / 8 (e.g. 4.5). */
  dayUnits: number;
  fullDays: number;
  partialDays: number;
  /** Days with extra hours but no regular hours — paid as extra hours only. */
  extraOnlyDays: number;
  totalRegularHours: number;
  totalExtraHours: number;
  dailyPay: number;
  extraHourPay: number;
  dayPayTotal: number;
  extraPayTotal: number;
  amount: number;
};

function n(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

export function money(value: number): string {
  return (Math.round(value * 1000) / 1000).toFixed(3);
}

export function parseRates(worker: {
  dailyPay?: Prisma.Decimal | number | string | null;
  extraHourPay?: Prisma.Decimal | number | string | null;
}): PayRates {
  return {
    dailyPay: n(worker.dailyPay),
    extraHourPay: n(worker.extraHourPay),
  };
}

/** Day pay fraction for one record: regular hours / 8, capped at one full day. */
export function dayFraction(regularHours: Prisma.Decimal | number | string): number {
  const reg = n(regularHours);
  if (reg <= 0) return 0;
  return Math.min(reg, STANDARD_DAY_HOURS) / STANDARD_DAY_HOURS;
}

/** A record has something payable (regular and/or extra hours). */
export function isWorkedDay(rec: {
  regularHours: Prisma.Decimal | number | string;
  extraHours: Prisma.Decimal | number | string;
}): boolean {
  return n(rec.regularHours) > 0 || n(rec.extraHours) > 0;
}

/**
 * Weekly pay = daily wage × (regular hours / 8, max one day per date) + extra hours × extra-hour rate.
 * Regular and extra hours are independent: a worker can do only extra hours on a day (no day pay),
 * a partial day, or a partial day plus extra hours later.
 */
export function calcWeekPay(records: AttendanceSlice[], rates: PayRates): WeekPayBreakdown {
  // One row per project/date normally; merge defensively so a date never pays more than one day.
  const regularByDay = new Map<string, number>();
  const extraByDay = new Map<string, number>();
  for (const rec of records) {
    if (!isWorkedDay(rec)) continue;
    const k = formatDateOnly(rec.workDate);
    regularByDay.set(k, (regularByDay.get(k) ?? 0) + Math.max(0, n(rec.regularHours)));
    extraByDay.set(k, (extraByDay.get(k) ?? 0) + Math.max(0, n(rec.extraHours)));
  }
  let dayUnits = 0;
  let daysWorked = 0;
  let fullDays = 0;
  let partialDays = 0;
  let extraOnlyDays = 0;
  let totalRegularHours = 0;
  let totalExtraHours = 0;
  for (const [k, reg] of regularByDay) {
    const extra = extraByDay.get(k) ?? 0;
    totalRegularHours += reg;
    totalExtraHours += extra;
    if (reg > 0) {
      daysWorked += 1;
      const f = dayFraction(reg);
      dayUnits += f;
      if (f >= 1) fullDays += 1;
      else partialDays += 1;
    } else if (extra > 0) {
      extraOnlyDays += 1;
    }
  }
  const dayPayTotal = dayUnits * rates.dailyPay;
  const extraPayTotal = totalExtraHours * rates.extraHourPay;
  const amount = dayPayTotal + extraPayTotal;
  return {
    daysWorked,
    dayUnits: Math.round(dayUnits * 1000) / 1000,
    fullDays,
    partialDays,
    extraOnlyDays,
    totalRegularHours: Math.round(totalRegularHours * 100) / 100,
    totalExtraHours: Math.round(totalExtraHours * 100) / 100,
    dailyPay: rates.dailyPay,
    extraHourPay: rates.extraHourPay,
    dayPayTotal: Math.round(dayPayTotal * 1000) / 1000,
    extraPayTotal: Math.round(extraPayTotal * 1000) / 1000,
    amount: Math.round(amount * 1000) / 1000,
  };
}

export function weekKey(projectId: string, workDate: Date): string {
  return `${projectId}:${formatDateOnly(startOfWeekSaturday(workDate))}`;
}

/**
 * Sum of unpaid week amounts across projects.
 * Paid weeks use the stored snapshot amount; unpaid weeks use live calc with current rates.
 */
export function calcOwedAmount(opts: {
  rates: PayRates;
  records: AttendanceSlice[];
  paidKeys: Set<string>;
  paidAmounts?: Map<string, number>;
}): number {
  const byWeek = new Map<string, AttendanceSlice[]>();
  for (const rec of opts.records) {
    if (!isWorkedDay(rec)) continue;
    const key = weekKey(rec.projectId, rec.workDate);
    const list = byWeek.get(key) || [];
    list.push(rec);
    byWeek.set(key, list);
  }

  let owed = 0;
  for (const [key, weekRecords] of byWeek) {
    if (opts.paidKeys.has(key)) continue;
    if (opts.paidAmounts?.has(key)) {
      // explicitly unpaid row with snapshot — still live-calc unless paid
    }
    owed += calcWeekPay(weekRecords, opts.rates).amount;
  }
  return Math.round(owed * 1000) / 1000;
}

export function serializeWorkerPayFields(worker: {
  dailyPay?: Prisma.Decimal | number | string | null;
  extraHourPay?: Prisma.Decimal | number | string | null;
}) {
  return {
    dailyPay: dec(worker.dailyPay),
    extraHourPay: dec(worker.extraHourPay),
  };
}

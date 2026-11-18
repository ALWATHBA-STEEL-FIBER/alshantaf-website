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

export type WeekPayBreakdown = {
  daysWorked: number;
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

/** A calendar day counts if the worker logged any regular or extra hours. */
export function isWorkedDay(rec: {
  regularHours: Prisma.Decimal | number | string;
  extraHours: Prisma.Decimal | number | string;
}): boolean {
  return n(rec.regularHours) > 0 || n(rec.extraHours) > 0;
}

export function calcWeekPay(records: AttendanceSlice[], rates: PayRates): WeekPayBreakdown {
  const dayKeys = new Set<string>();
  let totalExtraHours = 0;
  for (const rec of records) {
    if (!isWorkedDay(rec)) continue;
    dayKeys.add(formatDateOnly(rec.workDate));
    totalExtraHours += n(rec.extraHours);
  }
  const daysWorked = dayKeys.size;
  const dayPayTotal = daysWorked * rates.dailyPay;
  const extraPayTotal = totalExtraHours * rates.extraHourPay;
  const amount = dayPayTotal + extraPayTotal;
  return {
    daysWorked,
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

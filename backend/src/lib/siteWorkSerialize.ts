import type { Prisma } from "@prisma/client";
import { arabicWeekday, formatDateOnly } from "./siteWorkDates";

export function dec(value: Prisma.Decimal | number | string | null | undefined): string {
  if (value == null) return "0";
  return String(value);
}

export function serializeDailyRecord(row: {
  id: string;
  projectId: string;
  workerId: string;
  engineerId: string;
  workDate: Date;
  regularHours: Prisma.Decimal;
  extraHours: Prisma.Decimal;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  worker?: { id: string; name: string; employeeCode: string | null };
  engineer?: { id: string; name: string; email: string };
  project?: { id: string; name: string; code: string | null };
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    workerId: row.workerId,
    engineerId: row.engineerId,
    workDate: formatDateOnly(row.workDate),
    dayName: arabicWeekday(row.workDate),
    regularHours: dec(row.regularHours),
    extraHours: dec(row.extraHours),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    worker: row.worker ?? undefined,
    engineer: row.engineer ?? undefined,
    project: row.project ?? undefined,
  };
}

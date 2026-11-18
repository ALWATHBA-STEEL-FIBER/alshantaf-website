/** Jordan site-work week: Saturday → Thursday (6 days, matching Excel sheets). */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnly(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function formatDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Saturday of the week containing `date` (UTC). */
export function startOfWeekSaturday(date: Date): Date {
  const day = date.getUTCDay(); // 0 Sun … 6 Sat
  const diff = (day + 1) % 7; // Sat→0 … Fri→6
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff));
}

export function addDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

/** Full Arabic weekday (for UI). */
const AR_WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** Short day labels used inside the Excel sheets. */
export const EXCEL_DAY_LABELS = ["سبت", "احد", "اثنين", "ثلاثاء", "اربعاء", "خميس"] as const;

export function arabicWeekday(date: Date): string {
  return AR_WEEKDAYS[date.getUTCDay()] ?? "";
}

export function excelDayLabel(date: Date): string {
  const map: Record<number, string> = {
    6: "سبت",
    0: "احد",
    1: "اثنين",
    2: "ثلاثاء",
    3: "اربعاء",
    4: "خميس",
  };
  return map[date.getUTCDay()] ?? "";
}

/** Sat → Thu (6 days). */
export function weekDatesFromStart(weekStart: Date): Date[] {
  return Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));
}

/** Excel date cell like "20/12" or "7/25" — resolve using week-end year from settlement date. */
export function parseExcelShortDate(
  value: unknown,
  fallbackYear: number,
  weekStartHint?: Date
): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (typeof value === "number") {
    // Excel serial — approximate via UTC epoch offset
    const utc = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate()));
  }
  if (typeof value !== "string") return null;
  const s = value.trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
  if (!m) return null;
  let a = Number(m[1]);
  let b = Number(m[2]);
  let year = m[3] ? Number(m[3]) : fallbackYear;
  if (year < 100) year += 2000;

  // Sheets mix D/M and M/D. Prefer D/M (Jordan), unless first>12 then must be M/D.
  let day: number;
  let month: number;
  if (a > 12 && b <= 12) {
    day = a;
    month = b;
  } else if (b > 12 && a <= 12) {
    month = a;
    day = b;
  } else if (weekStartHint) {
    // Pick the interpretation that falls inside/near the Sat-Thu week.
    const candDM = new Date(Date.UTC(year, b - 1, a));
    const candMD = new Date(Date.UTC(year, a - 1, b));
    const end = addDays(weekStartHint, 5);
    const inWeek = (d: Date) => d >= weekStartHint && d <= end;
    if (inWeek(candDM)) return candDM;
    if (inWeek(candMD)) return candMD;
    // Prefer D/M
    day = a;
    month = b;
  } else {
    day = a;
    month = b;
  }
  if (!day || !month || month > 12 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatExcelShortDate(d: Date): string {
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

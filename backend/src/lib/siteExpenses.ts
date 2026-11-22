import fs from "node:fs";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { formatDateOnly } from "./siteWorkDates";
import { siteWorkDataDir } from "./siteWorkPaths";
import { calcWeekPay, money, parseRates, weekKey } from "./siteWorkPayout";

export const EXPENSE_SCOPES = ["PROJECT", "COMPANY"] as const;
export type ExpenseScope = (typeof EXPENSE_SCOPES)[number];

/** Category keys stay stable; labels are what engineers see. */
export const EXPENSE_CATEGORIES: Array<{ key: string; ar: string; en: string; scopes: ExpenseScope[] }> = [
  { key: "materials", ar: "مواد بناء", en: "Building materials", scopes: ["PROJECT"] },
  { key: "equipment", ar: "معدات وآليات", en: "Equipment & machinery", scopes: ["PROJECT", "COMPANY"] },
  { key: "fuel", ar: "وقود ومحروقات", en: "Fuel", scopes: ["PROJECT", "COMPANY"] },
  { key: "transport", ar: "نقل وشحن", en: "Transport & freight", scopes: ["PROJECT", "COMPANY"] },
  { key: "subcontractor", ar: "مقاول باطن", en: "Subcontractor", scopes: ["PROJECT"] },
  { key: "daily_labor", ar: "عمالة يومية إضافية", en: "Extra daily labor", scopes: ["PROJECT"] },
  { key: "tools", ar: "عدد وأدوات", en: "Tools", scopes: ["PROJECT", "COMPANY"] },
  { key: "permits", ar: "رسوم وتصاريح", en: "Fees & permits", scopes: ["PROJECT", "COMPANY"] },
  { key: "maintenance", ar: "صيانة", en: "Maintenance", scopes: ["PROJECT", "COMPANY"] },
  { key: "food", ar: "ضيافة وطعام", en: "Food & hospitality", scopes: ["PROJECT", "COMPANY"] },
  { key: "utilities", ar: "كهرباء ومياه", en: "Utilities", scopes: ["PROJECT", "COMPANY"] },
  { key: "rent", ar: "إيجارات", en: "Rent", scopes: ["COMPANY", "PROJECT"] },
  { key: "salaries", ar: "رواتب وسلف", en: "Salaries & advances", scopes: ["COMPANY"] },
  { key: "office", ar: "مصاريف مكتبية", en: "Office", scopes: ["COMPANY"] },
  { key: "vehicles", ar: "سيارات الشركة", en: "Company vehicles", scopes: ["COMPANY"] },
  { key: "other", ar: "أخرى", en: "Other", scopes: ["PROJECT", "COMPANY"] },
];

export const PAYMENT_METHODS: Array<{ key: string; ar: string; en: string }> = [
  { key: "cash", ar: "نقداً", en: "Cash" },
  { key: "transfer", ar: "تحويل بنكي", en: "Bank transfer" },
  { key: "cliq", ar: "كليك", en: "CliQ" },
  { key: "cheque", ar: "شيك", en: "Cheque" },
  { key: "card", ar: "بطاقة", en: "Card" },
  { key: "credit", ar: "آجل (ذمة)", en: "On credit" },
];

const CATEGORY_KEYS = new Set(EXPENSE_CATEGORIES.map((c) => c.key));
const PAYMENT_KEYS = new Set(PAYMENT_METHODS.map((p) => p.key));

export function isCategory(key: string) {
  return CATEGORY_KEYS.has(key);
}
export function isPaymentMethod(key: string) {
  return PAYMENT_KEYS.has(key);
}

export function categoryLabel(key: string, lang: "ar" | "en" = "ar") {
  const c = EXPENSE_CATEGORIES.find((x) => x.key === key);
  return c ? c[lang] : key;
}
export function paymentLabel(key: string | null | undefined, lang: "ar" | "en" = "ar") {
  if (!key) return "";
  const p = PAYMENT_METHODS.find((x) => x.key === key);
  return p ? p[lang] : key;
}

export function receiptsDir(): string {
  const dir = path.join(siteWorkDataDir(), "receipts");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Absolute path for a stored receipt, or null when the name is unsafe/missing. */
export function receiptAbsolutePath(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const base = path.basename(filename);
  if (base !== filename || !/^[0-9a-f-]{36}(-lg)?\.[a-z0-9]{2,5}$/i.test(base)) return null;
  const abs = path.join(receiptsDir(), base);
  return fs.existsSync(abs) ? abs : null;
}

export function deleteReceiptFiles(filename: string | null | undefined) {
  if (!filename) return;
  const dir = receiptsDir();
  const base = path.basename(filename);
  const m = base.match(/^([0-9a-f-]{36})(-lg)?\./i);
  const candidates = m
    ? [base, `${m[1]}-sm.webp`, `${m[1]}-md.webp`, `${m[1]}-lg.webp`, `${m[1]}-preview.webp`]
    : [base];
  for (const name of candidates) {
    fs.promises.unlink(path.join(dir, name)).catch(() => undefined);
  }
}

export const expenseInclude = {
  project: {
    select: {
      id: true,
      name: true,
      code: true,
      coordinatorId: true,
      coordinator: { select: { id: true, name: true } },
    },
  },
  engineer: { select: { id: true, name: true, email: true } },
} as const;

type ExpenseRow = Prisma.SiteExpenseGetPayload<{ include: typeof expenseInclude }>;

export function serializeExpense(e: ExpenseRow, viewerEngineerId?: string, viewerIsAdmin = false) {
  return {
    id: e.id,
    scope: e.scope as ExpenseScope,
    projectId: e.projectId,
    project: e.project
      ? {
          id: e.project.id,
          name: e.project.name,
          code: e.project.code,
          coordinator: e.project.coordinator,
        }
      : null,
    engineerId: e.engineerId,
    engineer: { id: e.engineer.id, name: e.engineer.name },
    category: e.category,
    categoryLabel: categoryLabel(e.category),
    description: e.description,
    amount: money(Number(e.amount)),
    expenseDate: formatDateOnly(e.expenseDate),
    vendor: e.vendor,
    paymentMethod: e.paymentMethod,
    paymentLabel: paymentLabel(e.paymentMethod),
    invoiceNo: e.invoiceNo,
    hasReceipt: Boolean(e.receiptFile),
    receiptMime: e.receiptMime,
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    canEdit: viewerIsAdmin || (viewerEngineerId != null && viewerEngineerId === e.engineerId),
  };
}

export type DateRange = { from?: Date | null; to?: Date | null };

export function dateWhere(range: DateRange) {
  if (!range.from && !range.to) return undefined;
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to } : {}),
  };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Labor cost per project from attendance × worker rates, grouped by worker-week.
 * Paid weeks use the stored payout snapshot so history doesn't shift when rates change.
 */
export async function laborCostByProject(projectIds: string[] | null, range: DateRange) {
  const records = await prisma.siteDailyRecord.findMany({
    where: {
      ...(projectIds ? { projectId: { in: projectIds } } : {}),
      ...(dateWhere(range) ? { workDate: dateWhere(range) } : {}),
    },
    select: {
      projectId: true,
      workerId: true,
      workDate: true,
      regularHours: true,
      extraHours: true,
      worker: { select: { dailyPay: true, extraHourPay: true } },
    },
  });
  const payouts = await prisma.siteWorkerWeekPayout.findMany({
    where: {
      paid: true,
      ...(projectIds ? { projectId: { in: projectIds } } : {}),
    },
    select: { workerId: true, projectId: true, weekStart: true, amount: true },
  });
  const paidMap = new Map(
    payouts.map((p) => [`${p.workerId}|${p.projectId}:${formatDateOnly(p.weekStart)}`, Number(p.amount)])
  );

  const groups = new Map<string, typeof records>();
  for (const rec of records) {
    const key = `${rec.workerId}|${weekKey(rec.projectId, rec.workDate)}`;
    const list = groups.get(key) || [];
    list.push(rec);
    groups.set(key, list);
  }

  const out = new Map<string, { total: number; paid: number; unpaid: number }>();
  for (const [key, recs] of groups) {
    const projectId = recs[0]!.projectId;
    const slot = out.get(projectId) || { total: 0, paid: 0, unpaid: 0 };
    const paidAmount = paidMap.get(key);
    if (paidAmount != null) {
      slot.total += paidAmount;
      slot.paid += paidAmount;
    } else {
      const amt = calcWeekPay(recs, parseRates(recs[0]!.worker)).amount;
      slot.total += amt;
      slot.unpaid += amt;
    }
    out.set(projectId, slot);
  }
  for (const v of out.values()) {
    v.total = r3(v.total);
    v.paid = r3(v.paid);
    v.unpaid = r3(v.unpaid);
  }
  return out;
}

export type ExpenseFilter = {
  scope?: ExpenseScope | null;
  projectId?: string | null;
  engineerId?: string | null;
  coordinatorId?: string | null;
  category?: string | null;
  q?: string | null;
  range: DateRange;
};

export function expenseWhere(f: ExpenseFilter): Prisma.SiteExpenseWhereInput {
  const and: Prisma.SiteExpenseWhereInput[] = [];
  if (f.scope) and.push({ scope: f.scope });
  if (f.projectId) and.push({ projectId: f.projectId });
  if (f.engineerId) and.push({ engineerId: f.engineerId });
  if (f.coordinatorId) {
    and.push(
      f.coordinatorId === "none"
        ? { scope: "PROJECT", project: { coordinatorId: null } }
        : {
            OR: [
              { scope: "PROJECT", project: { coordinatorId: f.coordinatorId } },
              { scope: "COMPANY", engineerId: f.coordinatorId },
            ],
          }
    );
  }
  if (f.category) and.push({ category: f.category });
  const dw = dateWhere(f.range);
  if (dw) and.push({ expenseDate: dw });
  const q = f.q?.trim();
  if (q) {
    and.push({
      OR: [
        { description: { contains: q, mode: "insensitive" } },
        { vendor: { contains: q, mode: "insensitive" } },
        { invoiceNo: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { project: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

/** Totals for an already-filtered list of rows. */
export function summarizeRows(rows: Array<{ scope: string; category: string; amount: unknown }>) {
  let total = 0;
  let project = 0;
  let company = 0;
  const byCategory = new Map<string, number>();
  for (const r of rows) {
    const a = Number(r.amount) || 0;
    total += a;
    if (r.scope === "COMPANY") company += a;
    else project += a;
    byCategory.set(r.category, (byCategory.get(r.category) || 0) + a);
  }
  return {
    count: rows.length,
    total: money(total),
    projectTotal: money(project),
    companyTotal: money(company),
    byCategory: [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, amount]) => ({ key, label: categoryLabel(key), amount: money(amount) })),
  };
}

export function parseRangeQuery(query: Record<string, unknown>, parse: (s: string) => Date | null): DateRange {
  const from = typeof query.from === "string" && query.from ? parse(query.from) : null;
  const to = typeof query.to === "string" && query.to ? parse(query.to) : null;
  return { from, to };
}

/**
 * Full project cost board: recorded expenses + labor (hours → pay) + payout status + budget KPIs.
 * Labor and expenses stay separate buckets — `daily_labor` expense rows are not auto-payroll.
 */
export async function buildProjectCostSummary(projectId: string, range: DateRange = {}) {
  const project = await prisma.siteProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      code: true,
      budget: true,
      active: true,
      coordinator: { select: { id: true, name: true } },
      _count: { select: { workers: true, records: true } },
    },
  });
  if (!project) return null;

  const dw = dateWhere(range);
  const [expenseRows, laborMap, hourAgg, payoutRows, recentExpenses] = await Promise.all([
    prisma.siteExpense.findMany({
      where: { projectId, scope: "PROJECT", ...(dw ? { expenseDate: dw } : {}) },
      select: { category: true, amount: true, expenseDate: true, scope: true },
    }),
    laborCostByProject([projectId], range),
    prisma.siteDailyRecord.aggregate({
      where: { projectId, ...(dw ? { workDate: dw } : {}) },
      _count: true,
      _sum: { regularHours: true, extraHours: true },
    }),
    prisma.siteWorkerWeekPayout.findMany({
      where: {
        projectId,
        ...(range.from || range.to
          ? {
              weekStart: {
                ...(range.from ? { gte: range.from } : {}),
                ...(range.to ? { lte: range.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { weekStart: "desc" },
      take: 40,
      include: { worker: { select: { id: true, name: true } } },
    }),
    prisma.siteExpense.findMany({
      where: { projectId, scope: "PROJECT", ...(dw ? { expenseDate: dw } : {}) },
      include: expenseInclude,
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
  ]);

  const expenseSummary = summarizeRows(expenseRows);
  const labor = laborMap.get(projectId) || { total: 0, paid: 0, unpaid: 0 };
  const expensesNum = Number(expenseSummary.total) || 0;
  const grand = r3(expensesNum + labor.total);
  const budget = project.budget != null ? Number(project.budget) : null;
  const daysWorkedApprox = await prisma.siteDailyRecord.count({
    where: {
      projectId,
      ...(dw ? { workDate: dw } : {}),
      regularHours: { gt: 0 },
    },
  });

  return {
    project: {
      id: project.id,
      name: project.name,
      code: project.code,
      active: project.active,
      coordinator: project.coordinator,
      workerCount: project._count.workers,
      recordCount: project._count.records,
    },
    range: {
      from: range.from ? formatDateOnly(range.from) : null,
      to: range.to ? formatDateOnly(range.to) : null,
    },
    kpis: {
      expenses: expenseSummary.total,
      expenseCount: expenseSummary.count,
      labor: money(labor.total),
      laborPaid: money(labor.paid),
      laborUnpaid: money(labor.unpaid),
      grandTotal: money(grand),
      budget: budget != null ? money(budget) : null,
      budgetRemaining: budget != null ? money(budget - grand) : null,
      budgetUsedPct: budget && budget > 0 ? Math.round((grand / budget) * 1000) / 10 : null,
    },
    hours: {
      attendanceRows: hourAgg._count,
      daysWorked: daysWorkedApprox,
      totalRegular: money(Number(hourAgg._sum.regularHours || 0)),
      totalExtra: money(Number(hourAgg._sum.extraHours || 0)),
    },
    byCategory: expenseSummary.byCategory,
    note:
      "Payroll labor is derived from attendance × worker rates (paid weeks use payout snapshots). Manual daily_labor expenses are separate and not double-counted into labor.",
    payouts: payoutRows.map((p) => ({
      id: p.id,
      workerId: p.workerId,
      workerName: p.worker.name,
      weekStart: formatDateOnly(p.weekStart),
      daysWorked: p.daysWorked,
      totalExtraHours: money(Number(p.totalExtraHours)),
      amount: money(Number(p.amount)),
      paid: p.paid,
      paidAt: p.paidAt?.toISOString() ?? null,
    })),
    recentExpenses: recentExpenses.map((e) => serializeExpense(e, undefined, true)),
  };
}

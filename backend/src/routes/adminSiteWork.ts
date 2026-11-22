import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAdmin, requirePermission } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { audit } from "../lib/audit";
import { adminPhoneSchema } from "../lib/adminPermissions";
import {
  addDays,
  arabicWeekday,
  formatDateOnly,
  parseDateOnly,
  startOfWeekSaturday,
  weekDatesFromStart,
} from "../lib/siteWorkDates";
import { serializeDailyRecord } from "../lib/siteWorkSerialize";
import {
  calcOwedAmount,
  calcWeekPay,
  money,
  parseRates,
  serializeWorkerPayFields,
  weekKey,
} from "../lib/siteWorkPayout";
import { ensureProjectExcel, syncProjectDayToExcel } from "../lib/siteWorkSync";
import { buildExcelPreview, safeExcelFilename } from "../lib/siteWorkExcel";
import { importAllSiteWorkSource } from "../lib/siteWorkImport";
import { driveConfigured } from "../lib/siteWorkDrive";
import fs from "node:fs";
import path from "node:path";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  categoryLabel,
  dateWhere,
  deleteReceiptFiles,
  expenseInclude,
  expenseWhere,
  isCategory,
  receiptAbsolutePath,
  isPaymentMethod,
  buildProjectCostSummary,
  laborCostByProject,
  parseRangeQuery,
  paymentLabel,
  serializeExpense,
  summarizeRows,
} from "../lib/siteExpenses";
import { sendReceipt } from "./siteExpenses";
import { ensureAdminSiteEngineer } from "../lib/siteAdminEngineer";

export const adminSiteWorkRouter = Router();
adminSiteWorkRouter.use(requireAdmin);
adminSiteWorkRouter.use(requirePermission("siteWork"));

const engineerSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  projects: {
    select: {
      projectId: true,
      project: { select: { id: true, name: true, code: true } },
    },
  },
  coordinatedProjects: {
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" as const },
  },
} as const;

function serializeEngineer(e: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  projects: Array<{ project: { id: string; name: string; code: string | null } }>;
  coordinatedProjects?: Array<{ id: string; name: string; code: string | null }>;
}) {
  const role = (e.role || "ENGINEER").toUpperCase() === "COORDINATOR" ? "COORDINATOR" : "ENGINEER";
  return {
    id: e.id,
    email: e.email,
    name: e.name,
    phone: e.phone,
    role,
    isCoordinator: role === "COORDINATOR",
    active: e.active,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    projects: e.projects.map((p) => p.project),
    coordinatedProjects: e.coordinatedProjects || [],
  };
}

const projectInclude = {
  engineers: {
    select: {
      engineerId: true,
      engineer: { select: { id: true, name: true, email: true, active: true } },
    },
  },
  workers: {
    select: {
      workerId: true,
      worker: { select: { id: true, name: true, employeeCode: true, active: true } },
    },
  },
  coordinator: { select: { id: true, name: true } },
  _count: { select: { records: true } },
} as const;

function serializeProject(p: {
  id: string;
  name: string;
  code: string | null;
  notes: string | null;
  active: boolean;
  excelFilename?: string | null;
  driveFileId?: string | null;
  weekCounter?: number;
  coordinatorId?: string | null;
  coordinator?: { id: string; name: string } | null;
  budget?: unknown;
  createdAt: Date;
  updatedAt: Date;
  engineers: { engineerId: string; engineer: { id: string; name: string; email: string; active: boolean } }[];
  workers: { workerId: string; worker: { id: string; name: string; employeeCode: string | null; active: boolean } }[];
  _count: { records: number };
}) {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    notes: p.notes,
    active: p.active,
    excelFilename: p.excelFilename ?? null,
    driveFileId: p.driveFileId ?? null,
    weekCounter: p.weekCounter ?? 0,
    hasExcel: Boolean(p.excelFilename),
    driveEnabled: driveConfigured(),
    coordinatorId: p.coordinatorId ?? null,
    coordinator: p.coordinator ?? null,
    budget: p.budget != null ? money(Number(p.budget)) : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    recordCount: p._count.records,
    engineers: p.engineers.map((e) => e.engineer),
    workers: p.workers.map((w) => w.worker),
    engineerIds: p.engineers.map((e) => e.engineerId),
    workerIds: p.workers.map((w) => w.workerId),
  };
}

// ── Engineers ──────────────────────────────────────────────

adminSiteWorkRouter.get(
  "/engineers",
  asyncHandler(async (_req, res) => {
    const { ADMIN_SITE_EMAIL } = await import("../lib/siteAdminEngineer");
    const rows = await prisma.siteEngineer.findMany({
      where: { email: { not: ADMIN_SITE_EMAIL } },
      select: engineerSelect,
      orderBy: { name: "asc" },
    });
    res.json(rows.map(serializeEngineer));
  })
);

const engineerCreateSchema = z.object({
  name: z.string().min(1).max(120),
  /** Optional; auto-generated from name when omitted. */
  email: z.string().email().optional().nullable(),
  /** Passcode for /site login */
  passcode: z.string().min(4).max(200).optional(),
  password: z.string().min(4).max(200).optional(),
  phone: adminPhoneSchema,
  role: z.enum(["ENGINEER", "COORDINATOR"]).optional(),
  active: z.boolean().optional(),
  projectIds: z.array(z.string().uuid()).optional(),
});

function slugEmailFromName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.\u0600-\u06FF-]/gi, "")
    .slice(0, 40);
  return `${base || "engineer"}.${Date.now().toString(36)}@site.local`;
}

adminSiteWorkRouter.post(
  "/engineers",
  asyncHandler(async (req, res) => {
    const input = engineerCreateSchema.parse(req.body);
    const passcode = input.passcode || input.password;
    if (!passcode || passcode.length < 4) {
      res.status(400).json({ error: "رمز الدخول يجب أن يكون 4 أحرف على الأقل" });
      return;
    }
    const email = (input.email || "").trim().toLowerCase() || slugEmailFromName(input.name);
    const existing = await prisma.siteEngineer.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "حساب بهذا البريد موجود مسبقاً" });
      return;
    }
    const nameClash = await prisma.siteEngineer.findFirst({
      where: { name: { equals: input.name.trim(), mode: "insensitive" }, active: true },
    });
    if (nameClash) {
      res.status(409).json({ error: "مهندس بهذا الاسم موجود مسبقاً" });
      return;
    }
    const passwordHash = await bcrypt.hash(passcode, 12);
    const engineer = await prisma.siteEngineer.create({
      data: {
        email,
        name: input.name.trim(),
        phone: input.phone || null,
        role: input.role || "ENGINEER",
        passwordHash,
        active: input.active ?? true,
        projects: input.projectIds?.length
          ? { create: input.projectIds.map((projectId) => ({ projectId })) }
          : undefined,
      },
      select: engineerSelect,
    });
    await audit({
      actorEmail: req.session!.email,
      action: "site_engineer.create",
      targetType: "site_engineer",
      targetId: engineer.id,
      metadata: { email: engineer.email, name: engineer.name, role: engineer.role },
      ip: req.ip,
    });
    res.status(201).json(serializeEngineer(engineer));
  })
);

/** Wipe non-admin engineers (records reassigned to admin-site account). */
adminSiteWorkRouter.post(
  "/engineers/wipe",
  asyncHandler(async (req, res) => {
    const { ensureAdminSiteEngineer, ADMIN_SITE_EMAIL } = await import("../lib/siteAdminEngineer");
    const adminEng = await ensureAdminSiteEngineer();
    await prisma.siteDailyRecord.updateMany({
      where: { engineerId: { not: adminEng.id } },
      data: { engineerId: adminEng.id },
    });
    await prisma.siteExpense.updateMany({
      where: { engineerId: { not: adminEng.id } },
      data: { engineerId: adminEng.id },
    });
    // Keep coordinators (أحمد / محمد) — only wipe field engineers.
    const toDelete = await prisma.siteEngineer.findMany({
      where: {
        email: { not: ADMIN_SITE_EMAIL },
        role: { not: "COORDINATOR" },
      },
      select: { id: true },
    });
    const ids = toDelete.map((e) => e.id);
    if (ids.length) {
      await prisma.siteProjectEngineer.deleteMany({ where: { engineerId: { in: ids } } });
      await prisma.siteEngineer.deleteMany({ where: { id: { in: ids } } });
    }
    await audit({
      actorEmail: req.session!.email,
      action: "site_engineer.wipe",
      metadata: { deleted: ids.length },
      ip: req.ip,
    });
    res.json({ ok: true, deleted: ids.length, adminEngineerId: adminEng.id });
  })
);

const engineerUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: adminPhoneSchema,
  active: z.boolean().optional(),
  role: z.enum(["ENGINEER", "COORDINATOR"]).optional(),
  password: z.string().min(4).optional(),
  passcode: z.string().min(4).optional(),
  email: z.string().email().optional(),
  projectIds: z.array(z.string().uuid()).optional(),
});

adminSiteWorkRouter.patch(
  "/engineers/:id",
  asyncHandler(async (req, res) => {
    const input = engineerUpdateSchema.parse(req.body);
    const target = await prisma.siteEngineer.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Engineer not found" });
      return;
    }
    if (input.email && input.email !== target.email) {
      const clash = await prisma.siteEngineer.findUnique({ where: { email: input.email } });
      if (clash) {
        res.status(409).json({ error: "An engineer with this email already exists" });
        return;
      }
    }
    const data: {
      name?: string;
      phone?: string | null;
      active?: boolean;
      email?: string;
      role?: string;
      passwordHash?: string;
    } = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.phone !== undefined) data.phone = input.phone || null;
    if (input.active !== undefined) data.active = input.active;
    if (input.email !== undefined) data.email = input.email;
    if (input.role !== undefined) data.role = input.role;
    const nextPass = input.passcode || input.password;
    if (nextPass) data.passwordHash = await bcrypt.hash(nextPass, 12);

    if (input.projectIds) {
      await prisma.siteProjectEngineer.deleteMany({ where: { engineerId: target.id } });
      if (input.projectIds.length) {
        await prisma.siteProjectEngineer.createMany({
          data: input.projectIds.map((projectId) => ({ projectId, engineerId: target.id })),
        });
      }
    }

    const engineer = await prisma.siteEngineer.update({
      where: { id: target.id },
      data,
      select: engineerSelect,
    });
    await audit({
      actorEmail: req.session!.email,
      action: "site_engineer.update",
      targetType: "site_engineer",
      targetId: engineer.id,
      ip: req.ip,
    });
    res.json(serializeEngineer(engineer));
  })
);

adminSiteWorkRouter.delete(
  "/engineers/:id",
  asyncHandler(async (req, res) => {
    const target = await prisma.siteEngineer.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Engineer not found" });
      return;
    }
    const recordCount =
      (await prisma.siteDailyRecord.count({ where: { engineerId: target.id } })) +
      (await prisma.siteExpense.count({ where: { engineerId: target.id } }));
    if (recordCount > 0) {
      // Soft-deactivate when history exists
      await prisma.siteEngineer.update({
        where: { id: target.id },
        data: { active: false },
      });
      await audit({
        actorEmail: req.session!.email,
        action: "site_engineer.deactivate",
        targetType: "site_engineer",
        targetId: target.id,
        ip: req.ip,
      });
      res.json({ ok: true, deactivated: true });
      return;
    }
    await prisma.siteEngineer.delete({ where: { id: target.id } });
    await audit({
      actorEmail: req.session!.email,
      action: "site_engineer.delete",
      targetType: "site_engineer",
      targetId: target.id,
      ip: req.ip,
    });
    res.status(204).end();
  })
);

// ── Workers ────────────────────────────────────────────────

function serializeWorkerRow(
  w: {
    id: string;
    name: string;
    employeeCode: string | null;
    notes: string | null;
    dailyPay: unknown;
    extraHourPay: unknown;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    projects: Array<{ project: { id: string; name: string; code: string | null } }>;
  },
  owedAmount = 0
) {
  return {
    id: w.id,
    name: w.name,
    employeeCode: w.employeeCode,
    notes: w.notes,
    ...serializeWorkerPayFields(w as { dailyPay: null; extraHourPay: null }),
    owedAmount: money(owedAmount),
    active: w.active,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
    projects: w.projects.map((p) => p.project),
  };
}

adminSiteWorkRouter.get(
  "/workers",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.siteWorker.findMany({
      include: {
        projects: {
          select: { project: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: { name: "asc" },
    });
    const workerIds = rows.map((w) => w.id);
    const [records, paidRows] = await Promise.all([
      prisma.siteDailyRecord.findMany({
        where: { workerId: { in: workerIds } },
        select: {
          workerId: true,
          projectId: true,
          workDate: true,
          regularHours: true,
          extraHours: true,
        },
      }),
      prisma.siteWorkerWeekPayout.findMany({
        where: { workerId: { in: workerIds }, paid: true },
        select: { workerId: true, projectId: true, weekStart: true },
      }),
    ]);

    const recordsByWorker = new Map<string, typeof records>();
    for (const r of records) {
      const list = recordsByWorker.get(r.workerId) || [];
      list.push(r);
      recordsByWorker.set(r.workerId, list);
    }
    const paidByWorker = new Map<string, Set<string>>();
    for (const p of paidRows) {
      const set = paidByWorker.get(p.workerId) || new Set<string>();
      set.add(weekKey(p.projectId, p.weekStart));
      paidByWorker.set(p.workerId, set);
    }

    res.json(
      rows.map((w) => {
        const rates = parseRates(w);
        const owed = calcOwedAmount({
          rates,
          records: recordsByWorker.get(w.id) || [],
          paidKeys: paidByWorker.get(w.id) || new Set(),
        });
        return serializeWorkerRow(w, owed);
      })
    );
  })
);

const workerSchema = z.object({
  name: z.string().min(1).max(120),
  employeeCode: z.string().max(60).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  dailyPay: z.coerce.number().min(0).max(100000).optional(),
  extraHourPay: z.coerce.number().min(0).max(100000).optional(),
  active: z.boolean().optional(),
  projectIds: z.array(z.string().uuid()).optional(),
});

adminSiteWorkRouter.get(
  "/workers/:id",
  asyncHandler(async (req, res) => {
    const worker = await prisma.siteWorker.findUnique({
      where: { id: req.params.id },
      include: {
        projects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                code: true,
                active: true,
                weekCounter: true,
              },
            },
          },
          orderBy: { project: { name: "asc" } },
        },
      },
    });
    if (!worker) {
      res.status(404).json({ error: "Worker not found" });
      return;
    }

    const [records, paidRows, recent] = await Promise.all([
      prisma.siteDailyRecord.findMany({
        where: { workerId: worker.id },
        select: {
          projectId: true,
          workDate: true,
          regularHours: true,
          extraHours: true,
        },
      }),
      prisma.siteWorkerWeekPayout.findMany({
        where: { workerId: worker.id },
        orderBy: [{ weekStart: "desc" }],
        take: 100,
      }),
      prisma.siteDailyRecord.findMany({
        where: { workerId: worker.id },
        include: {
          project: { select: { id: true, name: true, code: true } },
        },
        orderBy: { workDate: "desc" },
        take: 60,
      }),
    ]);

    const rates = parseRates(worker);
    const paidKeys = new Set(
      paidRows.filter((p) => p.paid).map((p) => weekKey(p.projectId, p.weekStart))
    );
    const owed = calcOwedAmount({ rates, records, paidKeys });

    const byProject = new Map<
      string,
      { daysWorked: number; totalRegular: number; totalExtra: number; recordCount: number }
    >();
    for (const r of records) {
      const cur = byProject.get(r.projectId) || {
        daysWorked: 0,
        totalRegular: 0,
        totalExtra: 0,
        recordCount: 0,
      };
      const reg = Number(r.regularHours) || 0;
      const extra = Number(r.extraHours) || 0;
      cur.recordCount += 1;
      cur.totalRegular += reg;
      cur.totalExtra += extra;
      if (reg > 0 || extra > 0) cur.daysWorked += 1;
      byProject.set(r.projectId, cur);
    }

    res.json({
      ...serializeWorkerRow(
        {
          ...worker,
          projects: worker.projects.map((p) => ({ project: p.project })),
        },
        owed
      ),
      fullName: worker.fullName,
      assignments: worker.projects.map((p) => {
        const stats = byProject.get(p.projectId) || {
          daysWorked: 0,
          totalRegular: 0,
          totalExtra: 0,
          recordCount: 0,
        };
        return {
          projectId: p.projectId,
          project: p.project,
          displayName: p.displayName,
          jobTitle: p.jobTitle,
          hourlyRate: money(Number(p.hourlyRate) || 0),
          sortOrder: p.sortOrder,
          assignedAt: p.assignedAt.toISOString(),
          daysWorked: stats.daysWorked,
          totalRegular: money(stats.totalRegular),
          totalExtra: money(stats.totalExtra),
          recordCount: stats.recordCount,
        };
      }),
      payouts: paidRows.map((p) => ({
        id: p.id,
        projectId: p.projectId,
        weekStart: formatDateOnly(p.weekStart),
        daysWorked: p.daysWorked,
        totalExtraHours: money(Number(p.totalExtraHours)),
        amount: money(Number(p.amount)),
        paid: p.paid,
        paidAt: p.paidAt?.toISOString() ?? null,
        paidBy: p.paidBy,
      })),
      recentDays: recent.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        project: r.project,
        workDate: formatDateOnly(r.workDate),
        dayName: arabicWeekday(r.workDate),
        regularHours: money(Number(r.regularHours)),
        extraHours: money(Number(r.extraHours)),
        notes: r.notes,
      })),
      totals: {
        daysWorked: [...byProject.values()].reduce((s, x) => s + x.daysWorked, 0),
        totalRegular: money(
          [...byProject.values()].reduce((s, x) => s + x.totalRegular, 0)
        ),
        totalExtra: money([...byProject.values()].reduce((s, x) => s + x.totalExtra, 0)),
        recordCount: records.length,
        owedAmount: money(owed),
      },
    });
  })
);

adminSiteWorkRouter.post(
  "/workers",
  asyncHandler(async (req, res) => {
    const input = workerSchema.parse(req.body);
    const projectIds = [...new Set(input.projectIds || [])];
    const worker = await prisma.siteWorker.create({
      data: {
        name: input.name,
        employeeCode: input.employeeCode?.trim() || null,
        notes: input.notes?.trim() || null,
        dailyPay: input.dailyPay ?? 0,
        extraHourPay: input.extraHourPay ?? 0,
        active: input.active ?? true,
        projects: projectIds.length
          ? {
              create: projectIds.map((projectId) => ({ projectId })),
            }
          : undefined,
      },
      include: {
        projects: {
          select: { project: { select: { id: true, name: true, code: true } } },
        },
      },
    });
    await audit({
      actorEmail: req.session!.email,
      action: "site_worker.create",
      targetType: "site_worker",
      targetId: worker.id,
      ip: req.ip,
      metadata: { projectIds },
    });
    res.status(201).json(serializeWorkerRow(worker, 0));
  })
);

adminSiteWorkRouter.patch(
  "/workers/:id",
  asyncHandler(async (req, res) => {
    const input = workerSchema.partial().parse(req.body);
    const target = await prisma.siteWorker.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Worker not found" });
      return;
    }
    const worker = await prisma.siteWorker.update({
      where: { id: target.id },
      data: {
        name: input.name,
        employeeCode:
          input.employeeCode === undefined ? undefined : input.employeeCode?.trim() || null,
        notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
        dailyPay: input.dailyPay,
        extraHourPay: input.extraHourPay,
        active: input.active,
      },
      include: {
        projects: {
          select: { project: { select: { id: true, name: true, code: true } } },
        },
      },
    });
    await audit({
      actorEmail: req.session!.email,
      action: "site_worker.update",
      targetType: "site_worker",
      targetId: worker.id,
      ip: req.ip,
    });

    const [records, paidRows] = await Promise.all([
      prisma.siteDailyRecord.findMany({
        where: { workerId: worker.id },
        select: {
          projectId: true,
          workDate: true,
          regularHours: true,
          extraHours: true,
        },
      }),
      prisma.siteWorkerWeekPayout.findMany({
        where: { workerId: worker.id, paid: true },
        select: { projectId: true, weekStart: true },
      }),
    ]);
    const owed = calcOwedAmount({
      rates: parseRates(worker),
      records,
      paidKeys: new Set(paidRows.map((p) => weekKey(p.projectId, p.weekStart))),
    });
    res.json(serializeWorkerRow(worker, owed));
  })
);

adminSiteWorkRouter.delete(
  "/workers/:id",
  asyncHandler(async (req, res) => {
    const target = await prisma.siteWorker.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Worker not found" });
      return;
    }
    const recordCount = await prisma.siteDailyRecord.count({ where: { workerId: target.id } });
    if (recordCount > 0) {
      await prisma.siteWorker.update({ where: { id: target.id }, data: { active: false } });
      await audit({
        actorEmail: req.session!.email,
        action: "site_worker.deactivate",
        targetType: "site_worker",
        targetId: target.id,
        ip: req.ip,
      });
      res.json({ ok: true, deactivated: true });
      return;
    }
    await prisma.siteWorker.delete({ where: { id: target.id } });
    await audit({
      actorEmail: req.session!.email,
      action: "site_worker.delete",
      targetType: "site_worker",
      targetId: target.id,
      ip: req.ip,
    });
    res.status(204).end();
  })
);

// ── Projects ───────────────────────────────────────────────

adminSiteWorkRouter.get(
  "/projects",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.siteProject.findMany({
      include: projectInclude,
      orderBy: { name: "asc" },
    });
    res.json(rows.map(serializeProject));
  })
);

adminSiteWorkRouter.get(
  "/projects/:id",
  asyncHandler(async (req, res) => {
    const project = await prisma.siteProject.findUnique({
      where: { id: req.params.id },
      include: {
        ...projectInclude,
        workers: {
          include: {
            worker: {
              select: {
                id: true,
                name: true,
                employeeCode: true,
                active: true,
                dailyPay: true,
                extraHourPay: true,
              },
            },
          },
          orderBy: [{ sortOrder: "asc" }, { worker: { name: "asc" } }],
        },
      },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const workerIds = project.workers.map((w) => w.workerId);
    const [dayStats, recent, weekPayouts, unassignedWorkers] = await Promise.all([
      prisma.siteDailyRecord.groupBy({
        by: ["workerId"],
        where: { projectId: project.id },
        _count: true,
        _sum: { regularHours: true, extraHours: true },
      }),
      prisma.siteDailyRecord.findMany({
        where: { projectId: project.id },
        include: {
          worker: { select: { id: true, name: true, employeeCode: true } },
        },
        orderBy: { workDate: "desc" },
        take: 80,
      }),
      prisma.siteWorkerWeekPayout.findMany({
        where: { projectId: project.id },
        orderBy: { weekStart: "desc" },
        take: 60,
        include: { worker: { select: { id: true, name: true } } },
      }),
      prisma.siteWorker.findMany({
        where: {
          active: true,
          id: { notIn: workerIds.length ? workerIds : ["00000000-0000-0000-0000-000000000000"] },
        },
        select: { id: true, name: true, employeeCode: true, dailyPay: true, extraHourPay: true },
        orderBy: { name: "asc" },
        take: 500,
      }),
    ]);

    const statsByWorker = new Map(
      dayStats.map((s) => [
        s.workerId,
        {
          recordCount: s._count,
          totalRegular: Number(s._sum.regularHours || 0),
          totalExtra: Number(s._sum.extraHours || 0),
        },
      ])
    );

    const base = serializeProject(project);
    res.json({
      ...base,
      roster: project.workers.map((w) => {
        const stats = statsByWorker.get(w.workerId) || {
          recordCount: 0,
          totalRegular: 0,
          totalExtra: 0,
        };
        return {
          workerId: w.workerId,
          name: w.worker.name,
          employeeCode: w.worker.employeeCode,
          active: w.worker.active,
          dailyPay: money(Number(w.worker.dailyPay) || 0),
          extraHourPay: money(Number(w.worker.extraHourPay) || 0),
          displayName: w.displayName,
          jobTitle: w.jobTitle,
          hourlyRate: money(Number(w.hourlyRate) || 0),
          sortOrder: w.sortOrder,
          assignedAt: w.assignedAt.toISOString(),
          recordCount: stats.recordCount,
          totalRegular: money(stats.totalRegular),
          totalExtra: money(stats.totalExtra),
        };
      }),
      recentDays: recent.map((r) => ({
        id: r.id,
        workerId: r.workerId,
        worker: r.worker,
        workDate: formatDateOnly(r.workDate),
        dayName: arabicWeekday(r.workDate),
        regularHours: money(Number(r.regularHours)),
        extraHours: money(Number(r.extraHours)),
        notes: r.notes,
      })),
      payouts: weekPayouts.map((p) => ({
        id: p.id,
        workerId: p.workerId,
        workerName: p.worker.name,
        weekStart: formatDateOnly(p.weekStart),
        daysWorked: p.daysWorked,
        amount: money(Number(p.amount)),
        paid: p.paid,
        paidAt: p.paidAt?.toISOString() ?? null,
      })),
      availableWorkers: unassignedWorkers.map((w) => ({
        id: w.id,
        name: w.name,
        employeeCode: w.employeeCode,
        dailyPay: money(Number(w.dailyPay) || 0),
        extraHourPay: money(Number(w.extraHourPay) || 0),
      })),
      costSummary: await buildProjectCostSummary(
        project.id,
        parseRangeQuery(req.query as Record<string, unknown>, parseDateOnly)
      ),
    });
  })
);

const assignWorkerSchema = z.object({
  workerId: z.string().uuid().optional(),
  // Create-and-assign in one step
  name: z.string().min(1).max(120).optional(),
  employeeCode: z.string().max(60).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  dailyPay: z.coerce.number().min(0).max(100000).optional(),
  extraHourPay: z.coerce.number().min(0).max(100000).optional(),
  displayName: z.string().max(120).optional().nullable(),
  jobTitle: z.string().max(120).optional().nullable(),
  hourlyRate: z.coerce.number().min(0).max(100000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

adminSiteWorkRouter.post(
  "/projects/:id/workers",
  asyncHandler(async (req, res) => {
    const project = await prisma.siteProject.findUnique({ where: { id: req.params.id } });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const input = assignWorkerSchema.parse(req.body);

    let workerId = input.workerId;
    if (!workerId) {
      if (!input.name?.trim()) {
        res.status(400).json({ error: "workerId or name required" });
        return;
      }
      const created = await prisma.siteWorker.create({
        data: {
          name: input.name.trim(),
          employeeCode: input.employeeCode?.trim() || null,
          notes: input.notes?.trim() || null,
          dailyPay: input.dailyPay ?? 0,
          extraHourPay: input.extraHourPay ?? 0,
          active: true,
        },
      });
      workerId = created.id;
    } else {
      const exists = await prisma.siteWorker.findUnique({ where: { id: workerId } });
      if (!exists) {
        res.status(404).json({ error: "Worker not found" });
        return;
      }
    }

    const link = await prisma.siteProjectWorker.upsert({
      where: {
        projectId_workerId: { projectId: project.id, workerId },
      },
      create: {
        projectId: project.id,
        workerId,
        displayName: input.displayName?.trim() || null,
        jobTitle: input.jobTitle?.trim() || null,
        hourlyRate: input.hourlyRate ?? 0,
        sortOrder: input.sortOrder ?? 0,
      },
      update: {
        displayName:
          input.displayName === undefined ? undefined : input.displayName?.trim() || null,
        jobTitle: input.jobTitle === undefined ? undefined : input.jobTitle?.trim() || null,
        hourlyRate: input.hourlyRate,
        sortOrder: input.sortOrder,
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            active: true,
            dailyPay: true,
            extraHourPay: true,
          },
        },
      },
    });

    await audit({
      actorEmail: req.session!.email,
      action: "site_project.assign_worker",
      targetType: "site_project",
      targetId: project.id,
      ip: req.ip,
      metadata: { workerId },
    });

    res.status(201).json({
      projectId: project.id,
      workerId: link.workerId,
      name: link.worker.name,
      employeeCode: link.worker.employeeCode,
      active: link.worker.active,
      dailyPay: money(Number(link.worker.dailyPay) || 0),
      extraHourPay: money(Number(link.worker.extraHourPay) || 0),
      displayName: link.displayName,
      jobTitle: link.jobTitle,
      hourlyRate: money(Number(link.hourlyRate) || 0),
      sortOrder: link.sortOrder,
      assignedAt: link.assignedAt.toISOString(),
    });
  })
);

adminSiteWorkRouter.delete(
  "/projects/:id/workers/:workerId",
  asyncHandler(async (req, res) => {
    const link = await prisma.siteProjectWorker.findUnique({
      where: {
        projectId_workerId: {
          projectId: req.params.id,
          workerId: req.params.workerId,
        },
      },
    });
    if (!link) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }
    await prisma.siteProjectWorker.delete({
      where: {
        projectId_workerId: {
          projectId: req.params.id,
          workerId: req.params.workerId,
        },
      },
    });
    await audit({
      actorEmail: req.session!.email,
      action: "site_project.unassign_worker",
      targetType: "site_project",
      targetId: req.params.id,
      ip: req.ip,
      metadata: { workerId: req.params.workerId },
    });
    res.json({ ok: true });
  })
);

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().max(60).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  active: z.boolean().optional(),
  engineerIds: z.array(z.string().uuid()).optional(),
  workerIds: z.array(z.string().uuid()).optional(),
  coordinatorId: z.string().uuid().optional().nullable(),
  budget: z.coerce.number().min(0).max(1_000_000_000).optional().nullable(),
});

adminSiteWorkRouter.post(
  "/projects",
  asyncHandler(async (req, res) => {
    const input = projectSchema.parse(req.body);
    const engineerIds = [...new Set([...(input.engineerIds ?? []), ...(input.coordinatorId ? [input.coordinatorId] : [])])];
    const workerIds = input.workerIds ?? [];
    const excelFilename = safeExcelFilename(input.name);
    const project = await prisma.siteProject.create({
      data: {
        name: input.name,
        code: input.code?.trim() || null,
        notes: input.notes?.trim() || null,
        active: input.active ?? true,
        excelFilename,
        weekCounter: 1,
        coordinatorId: input.coordinatorId || null,
        budget: input.budget ?? null,
        engineers: {
          create: engineerIds.map((engineerId) => ({ engineerId })),
        },
        workers: {
          create: workerIds.map((workerId) => ({ workerId })),
        },
      },
      include: projectInclude,
    });
    await ensureProjectExcel(project.id);
    await audit({
      actorEmail: req.session!.email,
      action: "site_project.create",
      targetType: "site_project",
      targetId: project.id,
      ip: req.ip,
    });
    const fresh = await prisma.siteProject.findUniqueOrThrow({
      where: { id: project.id },
      include: projectInclude,
    });
    res.status(201).json(serializeProject(fresh));
  })
);

adminSiteWorkRouter.get(
  "/projects/:id/excel",
  asyncHandler(async (req, res) => {
    const project = await prisma.siteProject.findUnique({ where: { id: req.params.id } });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const abs = await ensureProjectExcel(project.id);
    if (!abs || !fs.existsSync(abs)) {
      res.status(404).json({ error: "Excel file not found" });
      return;
    }
    const filename = project.excelFilename || path.basename(abs);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    fs.createReadStream(abs).pipe(res);
  })
);

adminSiteWorkRouter.get(
  "/projects/:id/excel/preview",
  asyncHandler(async (req, res) => {
    const project = await prisma.siteProject.findUnique({ where: { id: req.params.id } });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const abs = await ensureProjectExcel(project.id);
    if (!abs || !fs.existsSync(abs)) {
      res.status(404).json({ error: "Excel file not found" });
      return;
    }
    const preview = await buildExcelPreview(abs, req.query.sheet as string | undefined);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      project: { id: project.id, name: project.name, code: project.code },
      ...preview,
    });
  })
);

adminSiteWorkRouter.post(
  "/excel/reimport",
  asyncHandler(async (req, res) => {
    const result = await importAllSiteWorkSource();
    await audit({
      actorEmail: req.session!.email,
      action: "site_excel.reimport",
      targetType: "site_work",
      ip: req.ip,
      metadata: {
        files: result.files.length,
        totalDayRows: result.totalDayRows,
        recordCount: result.recordCount,
      },
    });
    res.json(result);
  })
);

adminSiteWorkRouter.patch(
  "/projects/:id",
  asyncHandler(async (req, res) => {
    const input = projectSchema.partial().parse(req.body);
    const target = await prisma.siteProject.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.siteProject.update({
        where: { id: target.id },
        data: {
          name: input.name,
          code: input.code === undefined ? undefined : input.code?.trim() || null,
          notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
          active: input.active,
          coordinatorId: input.coordinatorId === undefined ? undefined : input.coordinatorId || null,
          budget: input.budget === undefined ? undefined : input.budget,
        },
      });
      if (input.engineerIds) {
        await tx.siteProjectEngineer.deleteMany({ where: { projectId: target.id } });
        if (input.engineerIds.length) {
          await tx.siteProjectEngineer.createMany({
            data: input.engineerIds.map((engineerId) => ({
              projectId: target.id,
              engineerId,
            })),
          });
        }
      }
      if (input.coordinatorId) {
        await tx.siteProjectEngineer.upsert({
          where: { projectId_engineerId: { projectId: target.id, engineerId: input.coordinatorId } },
          create: { projectId: target.id, engineerId: input.coordinatorId },
          update: {},
        });
      }
      if (input.workerIds) {
        await tx.siteProjectWorker.deleteMany({ where: { projectId: target.id } });
        if (input.workerIds.length) {
          await tx.siteProjectWorker.createMany({
            data: input.workerIds.map((workerId) => ({
              projectId: target.id,
              workerId,
            })),
          });
        }
      }
    });

    const project = await prisma.siteProject.findUniqueOrThrow({
      where: { id: target.id },
      include: projectInclude,
    });
    await audit({
      actorEmail: req.session!.email,
      action: "site_project.update",
      targetType: "site_project",
      targetId: project.id,
      ip: req.ip,
    });
    res.json(serializeProject(project));
  })
);

adminSiteWorkRouter.delete(
  "/projects/:id",
  asyncHandler(async (req, res) => {
    const target = await prisma.siteProject.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    await prisma.siteProject.update({ where: { id: target.id }, data: { active: false } });
    await audit({
      actorEmail: req.session!.email,
      action: "site_project.deactivate",
      targetType: "site_project",
      targetId: target.id,
      ip: req.ip,
    });
    res.json({ ok: true, deactivated: true });
  })
);

// ── Records ────────────────────────────────────────────────

adminSiteWorkRouter.get(
  "/records",
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const engineerId = typeof req.query.engineerId === "string" ? req.query.engineerId : undefined;
    const workerId = typeof req.query.workerId === "string" ? req.query.workerId : undefined;
    const weekStartRaw = typeof req.query.weekStart === "string" ? req.query.weekStart : undefined;
    const dateRaw = typeof req.query.date === "string" ? req.query.date : undefined;

    const where: {
      projectId?: string;
      engineerId?: string;
      workerId?: string;
      workDate?: Date | { gte: Date; lte: Date };
    } = {};
    if (projectId) where.projectId = projectId;
    if (engineerId) where.engineerId = engineerId;
    if (workerId) where.workerId = workerId;

    if (dateRaw) {
      const d = parseDateOnly(dateRaw);
      if (!d) {
        res.status(400).json({ error: "Invalid date" });
        return;
      }
      where.workDate = d;
    } else if (weekStartRaw) {
      const parsed = parseDateOnly(weekStartRaw);
      if (!parsed) {
        res.status(400).json({ error: "Invalid weekStart" });
        return;
      }
      const start = startOfWeekSaturday(parsed);
      where.workDate = { gte: start, lte: addDays(start, 5) };
    }

    const rows = await prisma.siteDailyRecord.findMany({
      where,
      include: {
        worker: { select: { id: true, name: true, employeeCode: true } },
        engineer: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ workDate: "desc" }, { worker: { name: "asc" } }],
      take: 2000,
    });
    res.json(rows.map(serializeDailyRecord));
  })
);

adminSiteWorkRouter.get(
  "/week",
  asyncHandler(async (req, res) => {
    const projectId = String(req.query.projectId || "");
    if (!projectId) {
      res.status(400).json({ error: "projectId required" });
      return;
    }
    const weekStartRaw = String(req.query.weekStart || "");
    let weekStart: Date;
    if (weekStartRaw) {
      const parsed = parseDateOnly(weekStartRaw);
      if (!parsed) {
        res.status(400).json({ error: "Invalid weekStart" });
        return;
      }
      weekStart = startOfWeekSaturday(parsed);
    } else {
      weekStart = startOfWeekSaturday(new Date());
    }
    const includeAll = String(req.query.all || "") === "1";
    const weekEnd = addDays(weekStart, 5);
    const dates = weekDatesFromStart(weekStart);

    const project = await prisma.siteProject.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const roster = await prisma.siteProjectWorker.findMany({
      where: { projectId },
      include: { worker: true },
      orderBy: { worker: { name: "asc" } },
    });
    const records = await prisma.siteDailyRecord.findMany({
      where: { projectId, workDate: { gte: weekStart, lte: weekEnd } },
      include: {
        engineer: { select: { id: true, name: true } },
      },
    });
    const key = (workerId: string, date: string) => `${workerId}:${date}`;
    const map = new Map(records.map((r) => [key(r.workerId, formatDateOnly(r.workDate)), r]));
    const activeIds = new Set(records.map((r) => r.workerId));
    const visible = includeAll ? roster : roster.filter((r) => activeIds.has(r.workerId));

    res.json({
      project: { id: project.id, name: project.name, code: project.code },
      weekStart: formatDateOnly(weekStart),
      weekEnd: formatDateOnly(weekEnd),
      includeAll,
      rosterCount: roster.length,
      days: dates.map((d) => ({ date: formatDateOnly(d), dayName: arabicWeekday(d) })),
      workers: visible.map((r) => {
        const days = dates.map((d) => {
          const date = formatDateOnly(d);
          const rec = map.get(key(r.workerId, date));
          return {
            date,
            dayName: arabicWeekday(d),
            regularHours: rec ? String(rec.regularHours) : null,
            extraHours: rec ? String(rec.extraHours) : null,
            notes: rec?.notes ?? null,
            recordId: rec?.id ?? null,
            engineerName: rec?.engineer.name ?? null,
          };
        });
        return {
          workerId: r.worker.id,
          name: r.worker.name,
          employeeCode: r.worker.employeeCode,
          active: r.worker.active,
          days,
          totalRegular: String(
            days.reduce((s, x) => s + (x.regularHours ? Number(x.regularHours) : 0), 0)
          ),
          totalExtra: String(
            days.reduce((s, x) => s + (x.extraHours ? Number(x.extraHours) : 0), 0)
          ),
        };
      }),
    });
  })
);

const recordUpsertSchema = z.object({
  projectId: z.string().uuid(),
  workerId: z.string().uuid(),
  engineerId: z.string().uuid().optional(),
  date: z.string(),
  regularHours: z.coerce.number().min(0).max(24),
  extraHours: z.coerce.number().min(0).max(24),
  notes: z.string().max(2000).optional().nullable(),
});

adminSiteWorkRouter.put(
  "/records",
  asyncHandler(async (req, res) => {
    const input = recordUpsertSchema.parse(req.body);
    const workDate = parseDateOnly(input.date);
    if (!workDate) {
      res.status(400).json({ error: "Invalid date" });
      return;
    }

    let engineerId = input.engineerId;
    if (!engineerId) {
      const first = await prisma.siteProjectEngineer.findFirst({
        where: { projectId: input.projectId },
      });
      if (!first) {
        res.status(400).json({ error: "Assign an engineer to the project first" });
        return;
      }
      engineerId = first.engineerId;
    }

    const record = await prisma.siteDailyRecord.upsert({
      where: {
        projectId_workerId_workDate: {
          projectId: input.projectId,
          workerId: input.workerId,
          workDate,
        },
      },
      create: {
        projectId: input.projectId,
        workerId: input.workerId,
        engineerId,
        workDate,
        regularHours: input.regularHours,
        extraHours: input.extraHours,
        notes: input.notes?.trim() || null,
      },
      update: {
        engineerId,
        regularHours: input.regularHours,
        extraHours: input.extraHours,
        notes: input.notes?.trim() || null,
      },
      include: {
        worker: { select: { id: true, name: true, employeeCode: true } },
        engineer: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, code: true } },
      },
    });
    await audit({
      actorEmail: req.session!.email,
      action: "site_record.upsert",
      targetType: "site_daily_record",
      targetId: record.id,
      ip: req.ip,
    });
    await syncProjectDayToExcel({
      projectId: input.projectId,
      workDate: formatDateOnly(workDate),
      workerIds: [input.workerId],
    });
    res.json(serializeDailyRecord(record));
  })
);

adminSiteWorkRouter.delete(
  "/records/:id",
  asyncHandler(async (req, res) => {
    const target = await prisma.siteDailyRecord.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Record not found" });
      return;
    }
    await prisma.siteDailyRecord.delete({ where: { id: target.id } });
    await audit({
      actorEmail: req.session!.email,
      action: "site_record.delete",
      targetType: "site_daily_record",
      targetId: target.id,
      ip: req.ip,
    });
    res.status(204).end();
  })
);

// ── Weekly payouts (admin only) ────────────────────────────

adminSiteWorkRouter.get(
  "/payouts",
  asyncHandler(async (req, res) => {
    const projectId = String(req.query.projectId || "");
    if (!projectId) {
      res.status(400).json({ error: "projectId required" });
      return;
    }
    const weekStartRaw = String(req.query.weekStart || "");
    let weekStart: Date;
    if (weekStartRaw) {
      const parsed = parseDateOnly(weekStartRaw);
      if (!parsed) {
        res.status(400).json({ error: "Invalid weekStart" });
        return;
      }
      weekStart = startOfWeekSaturday(parsed);
    } else {
      weekStart = startOfWeekSaturday(new Date());
    }
    const weekEnd = addDays(weekStart, 5);

    const project = await prisma.siteProject.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const roster = await prisma.siteProjectWorker.findMany({
      where: { projectId },
      include: { worker: true },
      orderBy: { worker: { name: "asc" } },
    });
    const workerIds = roster.map((r) => r.workerId);

    const [weekRecords, allRecords, payoutRows, paidHistory] = await Promise.all([
      prisma.siteDailyRecord.findMany({
        where: { projectId, workDate: { gte: weekStart, lte: weekEnd } },
        select: {
          workerId: true,
          projectId: true,
          workDate: true,
          regularHours: true,
          extraHours: true,
        },
      }),
      prisma.siteDailyRecord.findMany({
        where: { workerId: { in: workerIds } },
        select: {
          workerId: true,
          projectId: true,
          workDate: true,
          regularHours: true,
          extraHours: true,
        },
      }),
      prisma.siteWorkerWeekPayout.findMany({
        where: { projectId, weekStart },
      }),
      prisma.siteWorkerWeekPayout.findMany({
        where: { workerId: { in: workerIds }, paid: true },
        select: { workerId: true, projectId: true, weekStart: true },
      }),
    ]);

    const weekByWorker = new Map<string, typeof weekRecords>();
    for (const r of weekRecords) {
      const list = weekByWorker.get(r.workerId) || [];
      list.push(r);
      weekByWorker.set(r.workerId, list);
    }
    const allByWorker = new Map<string, typeof allRecords>();
    for (const r of allRecords) {
      const list = allByWorker.get(r.workerId) || [];
      list.push(r);
      allByWorker.set(r.workerId, list);
    }
    const payoutByWorker = new Map(payoutRows.map((p) => [p.workerId, p]));
    const paidByWorker = new Map<string, Set<string>>();
    for (const p of paidHistory) {
      const set = paidByWorker.get(p.workerId) || new Set<string>();
      set.add(weekKey(p.projectId, p.weekStart));
      paidByWorker.set(p.workerId, set);
    }

    const workers = roster.map((r) => {
      const rates = parseRates(r.worker);
      const breakdown = calcWeekPay(weekByWorker.get(r.workerId) || [], rates);
      const payout = payoutByWorker.get(r.workerId);
      const owed = calcOwedAmount({
        rates,
        records: allByWorker.get(r.workerId) || [],
        paidKeys: paidByWorker.get(r.workerId) || new Set(),
      });
      return {
        workerId: r.worker.id,
        name: r.worker.name,
        employeeCode: r.worker.employeeCode,
        active: r.worker.active,
        dailyPay: money(rates.dailyPay),
        extraHourPay: money(rates.extraHourPay),
        daysWorked: breakdown.daysWorked,
        totalExtraHours: money(breakdown.totalExtraHours),
        dayPayTotal: money(breakdown.dayPayTotal),
        extraPayTotal: money(breakdown.extraPayTotal),
        amount: money(breakdown.amount),
        owedAmount: money(owed),
        paid: payout?.paid ?? false,
        paidAt: payout?.paidAt?.toISOString() ?? null,
        paidBy: payout?.paidBy ?? null,
        payoutId: payout?.id ?? null,
        storedAmount: payout ? money(Number(payout.amount)) : null,
      };
    });

    const weekTotal = workers.reduce((s, w) => s + Number(w.amount), 0);
    const weekOwed = workers.filter((w) => !w.paid).reduce((s, w) => s + Number(w.amount), 0);

    res.json({
      project: { id: project.id, name: project.name, code: project.code },
      weekStart: formatDateOnly(weekStart),
      weekEnd: formatDateOnly(weekEnd),
      weekTotal: money(weekTotal),
      weekUnpaidTotal: money(weekOwed),
      workers,
    });
  })
);

const markPaidSchema = z.object({
  workerId: z.string().uuid(),
  projectId: z.string().uuid(),
  weekStart: z.string(),
  paid: z.boolean(),
  notes: z.string().max(2000).optional().nullable(),
});

adminSiteWorkRouter.post(
  "/payouts/mark-paid",
  asyncHandler(async (req, res) => {
    const input = markPaidSchema.parse(req.body);
    const parsed = parseDateOnly(input.weekStart);
    if (!parsed) {
      res.status(400).json({ error: "Invalid weekStart" });
      return;
    }
    const weekStart = startOfWeekSaturday(parsed);
    const weekEnd = addDays(weekStart, 5);

    const worker = await prisma.siteWorker.findUnique({ where: { id: input.workerId } });
    if (!worker) {
      res.status(404).json({ error: "Worker not found" });
      return;
    }
    const project = await prisma.siteProject.findUnique({ where: { id: input.projectId } });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const records = await prisma.siteDailyRecord.findMany({
      where: {
        projectId: input.projectId,
        workerId: input.workerId,
        workDate: { gte: weekStart, lte: weekEnd },
      },
      select: {
        projectId: true,
        workDate: true,
        regularHours: true,
        extraHours: true,
      },
    });
    const rates = parseRates(worker);
    const breakdown = calcWeekPay(records, rates);
    const adminEmail = req.session!.email;

    const payout = await prisma.siteWorkerWeekPayout.upsert({
      where: {
        workerId_projectId_weekStart: {
          workerId: input.workerId,
          projectId: input.projectId,
          weekStart,
        },
      },
      create: {
        workerId: input.workerId,
        projectId: input.projectId,
        weekStart,
        daysWorked: breakdown.daysWorked,
        totalExtraHours: breakdown.totalExtraHours,
        dailyPay: rates.dailyPay,
        extraHourPay: rates.extraHourPay,
        amount: breakdown.amount,
        paid: input.paid,
        paidAt: input.paid ? new Date() : null,
        paidBy: input.paid ? adminEmail : null,
        notes: input.notes?.trim() || null,
      },
      update: {
        daysWorked: breakdown.daysWorked,
        totalExtraHours: breakdown.totalExtraHours,
        dailyPay: rates.dailyPay,
        extraHourPay: rates.extraHourPay,
        amount: breakdown.amount,
        paid: input.paid,
        paidAt: input.paid ? new Date() : null,
        paidBy: input.paid ? adminEmail : null,
        notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
      },
    });

    await audit({
      actorEmail: adminEmail,
      action: input.paid ? "site_payout.mark_paid" : "site_payout.mark_unpaid",
      targetType: "site_worker_week_payout",
      targetId: payout.id,
      ip: req.ip,
      metadata: {
        workerId: input.workerId,
        projectId: input.projectId,
        weekStart: formatDateOnly(weekStart),
        amount: breakdown.amount,
      },
    });

    res.json({
      id: payout.id,
      workerId: payout.workerId,
      projectId: payout.projectId,
      weekStart: formatDateOnly(payout.weekStart),
      daysWorked: payout.daysWorked,
      totalExtraHours: money(Number(payout.totalExtraHours)),
      dailyPay: money(Number(payout.dailyPay)),
      extraHourPay: money(Number(payout.extraHourPay)),
      amount: money(Number(payout.amount)),
      paid: payout.paid,
      paidAt: payout.paidAt?.toISOString() ?? null,
      paidBy: payout.paidBy,
      notes: payout.notes,
    });
  })
);

// ── Expenses (admin) ───────────────────────────────────────

function adminExpenseFilter(query: Record<string, unknown>) {
  const str = (k: string) => (typeof query[k] === "string" && query[k] ? String(query[k]) : null);
  const scopeRaw = (str("scope") || "").toUpperCase();
  return {
    scope: scopeRaw === "PROJECT" || scopeRaw === "COMPANY" ? (scopeRaw as "PROJECT" | "COMPANY") : null,
    projectId: str("projectId"),
    engineerId: str("engineerId"),
    coordinatorId: str("coordinatorId"),
    category: str("category"),
    q: str("q"),
    range: parseRangeQuery(query, parseDateOnly),
  };
}

const adminExpenseCreateSchema = z.object({
  scope: z.enum(["PROJECT", "COMPANY"]),
  projectId: z.string().uuid().optional().nullable(),
  category: z.string().min(1).max(40),
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().positive().max(10_000_000),
  expenseDate: z.string(),
  vendor: z.string().trim().max(200).optional().nullable(),
  paymentMethod: z.string().max(20).optional().nullable(),
  invoiceNo: z.string().trim().max(100).optional().nullable(),
  receiptFile: z.string().max(80).optional().nullable(),
  receiptMime: z.string().max(80).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  /** Optional: attribute to a site engineer; defaults to admin site-engineer row. */
  engineerId: z.string().uuid().optional().nullable(),
});

/** Admin creates company (or project) expenses without using the engineer portal. */
adminSiteWorkRouter.post(
  "/expenses",
  asyncHandler(async (req, res) => {
    const input = adminExpenseCreateSchema.parse(req.body ?? {});
    const expenseDate = parseDateOnly(input.expenseDate);
    if (!expenseDate) {
      res.status(400).json({ error: "Invalid expense date" });
      return;
    }
    if (!isCategory(input.category)) {
      res.status(400).json({ error: "Unknown category" });
      return;
    }
    if (input.paymentMethod && !isPaymentMethod(input.paymentMethod)) {
      res.status(400).json({ error: "Unknown payment method" });
      return;
    }

    let projectId: string | null = null;
    if (input.scope === "PROJECT") {
      if (!input.projectId) {
        res.status(400).json({ error: "projectId required for PROJECT expenses" });
        return;
      }
      const project = await prisma.siteProject.findUnique({ where: { id: input.projectId } });
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      projectId = project.id;
    }

    let engineerId = input.engineerId || null;
    if (engineerId) {
      const eng = await prisma.siteEngineer.findUnique({ where: { id: engineerId } });
      if (!eng || !eng.active) {
        res.status(400).json({ error: "Engineer not found" });
        return;
      }
    } else {
      const adminEng = await ensureAdminSiteEngineer();
      engineerId = adminEng.id;
    }

    if (input.receiptFile) {
      if (!receiptAbsolutePath(input.receiptFile)) {
        res.status(400).json({ error: "ملف الإيصال غير موجود — أعد الرفع" });
        return;
      }
      if (await prisma.siteExpense.findFirst({ where: { receiptFile: input.receiptFile } })) {
        res.status(400).json({ error: "ملف الإيصال مستخدم مسبقاً" });
        return;
      }
    }

    const created = await prisma.siteExpense.create({
      data: {
        scope: input.scope,
        projectId,
        engineerId,
        category: input.category,
        description: input.description,
        amount: Math.round(input.amount * 1000) / 1000,
        expenseDate,
        vendor: input.vendor || null,
        paymentMethod: input.paymentMethod || null,
        invoiceNo: input.invoiceNo || null,
        receiptFile: input.receiptFile || null,
        receiptMime: input.receiptFile ? (input.receiptFile.endsWith(".pdf") ? "application/pdf" : "image/webp") : null,
        notes: input.notes || null,
      },
      include: expenseInclude,
    });

    await audit({
      actorEmail: req.session!.email,
      action: "site_expense.admin_create",
      targetType: "site_expense",
      targetId: created.id,
      metadata: { amount: String(created.amount), scope: created.scope, projectId: created.projectId },
      ip: req.ip,
    });

    res.status(201).json(serializeExpense(created, undefined, true));
  })
);

adminSiteWorkRouter.get(
  "/projects/:id/cost-summary",
  asyncHandler(async (req, res) => {
    const summary = await buildProjectCostSummary(
      req.params.id,
      parseRangeQuery(req.query as Record<string, unknown>, parseDateOnly)
    );
    if (!summary) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.json(summary);
  })
);

adminSiteWorkRouter.get(
  "/expenses",
  asyncHandler(async (req, res) => {
    const where = expenseWhere(adminExpenseFilter(req.query as Record<string, unknown>));
    const rows = await prisma.siteExpense.findMany({
      where,
      include: expenseInclude,
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      take: 2000,
    });
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      items: rows.map((r) => serializeExpense(r, undefined, true)),
      summary: summarizeRows(rows),
      categories: EXPENSE_CATEGORIES,
      paymentMethods: PAYMENT_METHODS,
    });
  })
);

/** Everything counted: per coordinator → per project (expenses + labor + budget), company spend, trends. */
adminSiteWorkRouter.get(
  "/expenses/overview",
  asyncHandler(async (req, res) => {
    const range = parseRangeQuery(req.query as Record<string, unknown>, parseDateOnly);
    const dw = dateWhere(range);
    const { ADMIN_SITE_EMAIL } = await import("../lib/siteAdminEngineer");

    const [projects, expenses, engineers] = await Promise.all([
      prisma.siteProject.findMany({
        select: {
          id: true,
          name: true,
          code: true,
          active: true,
          budget: true,
          coordinatorId: true,
          _count: { select: { workers: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.siteExpense.findMany({
        where: dw ? { expenseDate: dw } : {},
        select: {
          scope: true,
          projectId: true,
          engineerId: true,
          category: true,
          amount: true,
          expenseDate: true,
        },
      }),
      prisma.siteEngineer.findMany({
        where: { email: { notIn: [ADMIN_SITE_EMAIL, "site-import@alshantaf.local"] } },
        select: { id: true, name: true, active: true },
        orderBy: { name: "asc" },
      }),
    ]);
    const labor = await laborCostByProject(null, range);

    const perProject = new Map<string, { amount: number; count: number; last: Date | null; month: number }>();
    const companyByEngineer = new Map<string, number>();
    const projectByEngineer = new Map<string, number>();
    const countByEngineer = new Map<string, number>();
    const monthly = new Map<string, { project: number; company: number }>();
    let projectExpenses = 0;
    let companyExpenses = 0;
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    for (const e of expenses) {
      const a = Number(e.amount) || 0;
      const mk = formatDateOnly(e.expenseDate).slice(0, 7);
      const m = monthly.get(mk) || { project: 0, company: 0 };
      countByEngineer.set(e.engineerId, (countByEngineer.get(e.engineerId) || 0) + 1);
      if (e.scope === "COMPANY") {
        companyExpenses += a;
        m.company += a;
        companyByEngineer.set(e.engineerId, (companyByEngineer.get(e.engineerId) || 0) + a);
      } else {
        projectExpenses += a;
        m.project += a;
        projectByEngineer.set(e.engineerId, (projectByEngineer.get(e.engineerId) || 0) + a);
        if (e.projectId) {
          const slot = perProject.get(e.projectId) || { amount: 0, count: 0, last: null, month: 0 };
          slot.amount += a;
          slot.count += 1;
          if (e.expenseDate >= monthStart) slot.month += a;
          if (!slot.last || e.expenseDate > slot.last) slot.last = e.expenseDate;
          perProject.set(e.projectId, slot);
        }
      }
      monthly.set(mk, m);
    }

    const projectRow = (p: (typeof projects)[number]) => {
      const s = perProject.get(p.id) || { amount: 0, count: 0, last: null, month: 0 };
      const l = labor.get(p.id) || { total: 0, paid: 0, unpaid: 0 };
      const budget = p.budget != null ? Number(p.budget) : null;
      const total = s.amount + l.total;
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        active: p.active,
        workerCount: p._count.workers,
        coordinatorId: p.coordinatorId,
        expenses: money(s.amount),
        expensesMonth: money(s.month),
        expenseCount: s.count,
        lastExpenseDate: s.last ? formatDateOnly(s.last) : null,
        labor: money(l.total),
        laborPaid: money(l.paid),
        laborUnpaid: money(l.unpaid),
        total: money(total),
        budget: budget != null ? money(budget) : null,
        budgetRemaining: budget != null ? money(budget - total) : null,
        budgetUsedPct: budget && budget > 0 ? Math.round((total / budget) * 1000) / 10 : null,
        _total: total,
        _exp: s.amount,
        _lab: l.total,
        _unpaid: l.unpaid,
      };
    };
    // Hide inactive projects that have nothing in range.
    const rows = projects
      .map(projectRow)
      .filter((r) => r.active || r._total > 0);

    const strip = (r: ReturnType<typeof projectRow>) => {
      const { _total, _exp, _lab, _unpaid, ...rest } = r;
      void _total; void _exp; void _lab; void _unpaid;
      return rest;
    };

    const groupFor = (coordId: string | null) => {
      const list = rows.filter((r) => (r.coordinatorId || null) === coordId);
      const pe = list.reduce((s, r) => s + r._exp, 0);
      const lab = list.reduce((s, r) => s + r._lab, 0);
      const unpaid = list.reduce((s, r) => s + r._unpaid, 0);
      const company = coordId ? companyByEngineer.get(coordId) || 0 : 0;
      return {
        projectCount: list.length,
        projectExpenses: money(pe),
        labor: money(lab),
        laborUnpaid: money(unpaid),
        companyExpenses: money(company),
        total: money(pe + lab + company),
        projects: list.sort((a, b) => b._total - a._total).map(strip),
      };
    };

    const coordinatorIds = new Set(projects.map((p) => p.coordinatorId).filter(Boolean) as string[]);
    const coordinators = engineers
      .filter((e) => coordinatorIds.has(e.id))
      .map((e) => ({ id: e.id, name: e.name, active: e.active, ...groupFor(e.id) }));
    const unassigned = groupFor(null);

    const laborTotal = [...labor.values()].reduce((s, v) => s + v.total, 0);
    const laborUnpaid = [...labor.values()].reduce((s, v) => s + v.unpaid, 0);

    const engName = new Map(engineers.map((e) => [e.id, e.name]));
    const byEngineer = [...new Set([...companyByEngineer.keys(), ...projectByEngineer.keys()])]
      .map((id) => ({
        id,
        name: engName.get(id) || "الإدارة",
        projectExpenses: money(projectByEngineer.get(id) || 0),
        companyExpenses: money(companyByEngineer.get(id) || 0),
        total: money((projectByEngineer.get(id) || 0) + (companyByEngineer.get(id) || 0)),
        count: countByEngineer.get(id) || 0,
        isCoordinator: coordinatorIds.has(id),
      }))
      .sort((a, b) => Number(b.total) - Number(a.total));

    // Last 6 months always shown for trend, even if empty.
    const months: Array<{ month: string; project: string; company: string; total: string }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const mk = formatDateOnly(d).slice(0, 7);
      const m = monthly.get(mk) || { project: 0, company: 0 };
      months.push({ month: mk, project: money(m.project), company: money(m.company), total: money(m.project + m.company) });
    }

    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      range: {
        from: range.from ? formatDateOnly(range.from) : null,
        to: range.to ? formatDateOnly(range.to) : null,
      },
      totals: {
        projectExpenses: money(projectExpenses),
        companyExpenses: money(companyExpenses),
        labor: money(laborTotal),
        laborUnpaid: money(laborUnpaid),
        grand: money(projectExpenses + companyExpenses + laborTotal),
        expenseCount: expenses.length,
      },
      coordinators,
      unassigned,
      byCategory: summarizeRows(expenses).byCategory,
      byEngineer,
      months,
      engineers: engineers.filter((e) => e.active),
    });
  })
);

adminSiteWorkRouter.get(
  "/expenses/export",
  asyncHandler(async (req, res) => {
    const where = expenseWhere(adminExpenseFilter(req.query as Record<string, unknown>));
    const rows = await prisma.siteExpense.findMany({
      where,
      include: expenseInclude,
      orderBy: [{ expenseDate: "asc" }, { createdAt: "asc" }],
    });
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("المصاريف", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
    ws.columns = [
      { header: "التاريخ", key: "date", width: 12 },
      { header: "النوع", key: "scope", width: 10 },
      { header: "المشروع", key: "project", width: 22 },
      { header: "المنسق", key: "coord", width: 16 },
      { header: "التصنيف", key: "cat", width: 18 },
      { header: "الوصف", key: "desc", width: 36 },
      { header: "المبلغ (د.أ)", key: "amount", width: 14 },
      { header: "المورّد", key: "vendor", width: 18 },
      { header: "طريقة الدفع", key: "pay", width: 14 },
      { header: "رقم الفاتورة", key: "inv", width: 14 },
      { header: "أدخله", key: "eng", width: 16 },
      { header: "ملاحظات", key: "notes", width: 30 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F342F" } };
    let total = 0;
    for (const r of rows) {
      const amount = Number(r.amount);
      total += amount;
      ws.addRow({
        date: formatDateOnly(r.expenseDate),
        scope: r.scope === "COMPANY" ? "شركة" : "مشروع",
        project: r.project?.name || "—",
        coord: r.project?.coordinator?.name || "",
        cat: categoryLabel(r.category),
        desc: r.description,
        amount,
        vendor: r.vendor || "",
        pay: paymentLabel(r.paymentMethod),
        inv: r.invoiceNo || "",
        eng: r.engineer.name,
        notes: r.notes || "",
      });
    }
    const totalRow = ws.addRow({ desc: "الإجمالي", amount: total });
    totalRow.font = { bold: true };
    ws.getColumn("amount").numFmt = "#,##0.000";
    const filename = `مصاريف-${formatDateOnly(new Date())}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader("Cache-Control", "private, no-store");
    await wb.xlsx.write(res);
    res.end();
  })
);

adminSiteWorkRouter.get(
  "/expenses/:id/receipt",
  asyncHandler(async (req, res) => {
    const row = await prisma.siteExpense.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    sendReceipt(res, row.receiptFile, row.receiptMime);
  })
);

const adminExpensePatch = z.object({
  category: z.string().min(1).max(40).optional(),
  description: z.string().trim().min(1).max(500).optional(),
  amount: z.coerce.number().positive().max(10_000_000).optional(),
  expenseDate: z.string().optional(),
  projectId: z.string().uuid().nullable().optional(),
  scope: z.enum(["PROJECT", "COMPANY"]).optional(),
  vendor: z.string().trim().max(200).nullable().optional(),
  paymentMethod: z.string().max(20).nullable().optional(),
  invoiceNo: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

adminSiteWorkRouter.patch(
  "/expenses/:id",
  asyncHandler(async (req, res) => {
    const input = adminExpensePatch.parse(req.body);
    const row = await prisma.siteExpense.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (input.category && !isCategory(input.category)) {
      res.status(400).json({ error: "تصنيف غير معروف" });
      return;
    }
    if (input.paymentMethod && !isPaymentMethod(input.paymentMethod)) {
      res.status(400).json({ error: "طريقة دفع غير معروفة" });
      return;
    }
    const expenseDate = input.expenseDate ? parseDateOnly(input.expenseDate) : undefined;
    if (input.expenseDate && !expenseDate) {
      res.status(400).json({ error: "تاريخ غير صالح" });
      return;
    }
    const scope = input.scope ?? (row.scope as "PROJECT" | "COMPANY");
    const projectId = scope === "COMPANY" ? null : input.projectId !== undefined ? input.projectId : row.projectId;
    if (scope === "PROJECT" && !projectId) {
      res.status(400).json({ error: "اختر المشروع" });
      return;
    }
    const updated = await prisma.siteExpense.update({
      where: { id: row.id },
      data: {
        scope,
        projectId,
        category: input.category,
        description: input.description,
        amount: input.amount,
        expenseDate: expenseDate ?? undefined,
        vendor: input.vendor === undefined ? undefined : input.vendor || null,
        paymentMethod: input.paymentMethod === undefined ? undefined : input.paymentMethod || null,
        invoiceNo: input.invoiceNo === undefined ? undefined : input.invoiceNo || null,
        notes: input.notes === undefined ? undefined : input.notes || null,
      },
      include: expenseInclude,
    });
    await audit({
      actorEmail: req.session!.email,
      action: "site_expense.admin_update",
      targetType: "site_expense",
      targetId: row.id,
      ip: req.ip,
    });
    res.json(serializeExpense(updated, undefined, true));
  })
);

adminSiteWorkRouter.delete(
  "/expenses/:id",
  asyncHandler(async (req, res) => {
    const row = await prisma.siteExpense.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await prisma.siteExpense.delete({ where: { id: row.id } });
    deleteReceiptFiles(row.receiptFile);
    await audit({
      actorEmail: req.session!.email,
      action: "site_expense.admin_delete",
      targetType: "site_expense",
      targetId: row.id,
      metadata: { amount: String(row.amount), description: row.description },
      ip: req.ip,
    });
    res.status(204).end();
  })
);

/** Ensure أحمد + محمد are coordinators and every project belongs to one of them. */
adminSiteWorkRouter.post(
  "/coordinators/ensure-defaults",
  asyncHandler(async (req, res) => {
    const { ensureDefaultCoordinators } = await import("../lib/siteCoordinators");
    const result = await ensureDefaultCoordinators();
    await audit({
      actorEmail: req.session!.email,
      action: "site_coordinator.ensure_defaults",
      targetType: "site_engineer",
      metadata: {
        coordinators: result.coordinators.map((c) => ({ id: c.id, name: c.name, email: c.email })),
        projects: result.assignments.length,
      },
      ip: req.ip,
    });
    res.json(result);
  })
);

/** Quick split: set coordinator for many projects at once. */
adminSiteWorkRouter.post(
  "/coordinators/assign",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        coordinatorId: z.string().uuid().nullable(),
        projectIds: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(req.body);
    if (input.coordinatorId) {
      const eng = await prisma.siteEngineer.findUnique({ where: { id: input.coordinatorId } });
      if (!eng || !eng.active) {
        res.status(400).json({ error: "المنسق غير موجود أو غير مفعّل" });
        return;
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.siteProject.updateMany({
        where: { id: { in: input.projectIds } },
        data: { coordinatorId: input.coordinatorId },
      });
      if (input.coordinatorId) {
        await tx.siteEngineer.update({
          where: { id: input.coordinatorId },
          data: { role: "COORDINATOR" },
        });
        await tx.siteProjectEngineer.createMany({
          data: input.projectIds.map((projectId) => ({ projectId, engineerId: input.coordinatorId! })),
          skipDuplicates: true,
        });
      }
    });
    await audit({
      actorEmail: req.session!.email,
      action: "site_project.coordinator_assign",
      targetType: "site_engineer",
      targetId: input.coordinatorId || undefined,
      metadata: { projectIds: input.projectIds },
      ip: req.ip,
    });
    res.json({ ok: true, updated: input.projectIds.length });
  })
);

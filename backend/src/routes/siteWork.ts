import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireSiteEngineer } from "../middleware/siteAuth";
import { asyncHandler } from "../lib/asyncHandler";
import {
  addDays,
  arabicWeekday,
  formatDateOnly,
  parseDateOnly,
  startOfWeekSaturday,
  weekDatesFromStart,
} from "../lib/siteWorkDates";
import { serializeDailyRecord } from "../lib/siteWorkSerialize";
import { ensureProjectExcel, syncProjectDayToExcel } from "../lib/siteWorkSync";
import { buildExcelPreview } from "../lib/siteWorkExcel";
import { buildProjectCostSummary, parseRangeQuery } from "../lib/siteExpenses";
import fs from "node:fs";
import path from "node:path";

export const siteWorkRouter = Router();
siteWorkRouter.use(requireSiteEngineer);

async function assertAssigned(req: import("express").Request, projectId: string) {
  if (req.siteEngineer?.isAdmin) return true;
  const row = await prisma.siteProjectEngineer.findUnique({
    where: {
      projectId_engineerId: { projectId, engineerId: req.siteEngineer!.id },
    },
  });
  if (row) return true;
  const led = await prisma.siteProject.count({
    where: { id: projectId, coordinatorId: req.siteEngineer!.id },
  });
  return led > 0;
}

siteWorkRouter.get(
  "/projects",
  asyncHandler(async (req, res) => {
    if (req.siteEngineer!.isAdmin) {
      const projects = await prisma.siteProject.findMany({
        where: { active: true },
        include: {
          _count: { select: { workers: true, records: true } },
          coordinator: { select: { id: true, name: true } },
        },
        orderBy: { name: "asc" },
      });
      res.json(
        projects.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          notes: p.notes,
          workerCount: p._count.workers,
          recordCount: p._count.records,
          weekCounter: p.weekCounter,
          coordinator: p.coordinator,
          isCoordinator: false,
          isAdminView: true,
        }))
      );
      return;
    }

    const me = req.siteEngineer!.id;
    const projects = await prisma.siteProject.findMany({
      where: {
        active: true,
        OR: [{ coordinatorId: me }, { engineers: { some: { engineerId: me } } }],
      },
      include: {
        _count: { select: { workers: true, records: true } },
        coordinator: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json(
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        notes: p.notes,
        workerCount: p._count.workers,
        recordCount: p._count.records,
        weekCounter: p.weekCounter,
        coordinator: p.coordinator,
        isCoordinator: p.coordinatorId === me,
        isAdminView: false,
      }))
    );
  })
);

siteWorkRouter.get(
  "/projects/:id/cost-summary",
  asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    if (!(await assertAssigned(req, projectId))) {
      res.status(403).json({ error: "Project not assigned" });
      return;
    }
    const summary = await buildProjectCostSummary(
      projectId,
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

siteWorkRouter.get(
  "/projects/:id/day",
  asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const dateStr = String(req.query.date || "");
    const workDate = parseDateOnly(dateStr);
    if (!workDate) {
      res.status(400).json({ error: "Invalid date (YYYY-MM-DD)" });
      return;
    }
    if (!(await assertAssigned(req, projectId))) {
      res.status(403).json({ error: "Project not assigned" });
      return;
    }
    const project = await prisma.siteProject.findFirst({
      where: { id: projectId, active: true },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const includeAll = String(req.query.all || "") === "1";
    const roster = await prisma.siteProjectWorker.findMany({
      where: { projectId, worker: { active: true } },
      include: { worker: true },
      orderBy: [{ sortOrder: "asc" }, { worker: { name: "asc" } }],
    });
    const records = await prisma.siteDailyRecord.findMany({
      where: { projectId, workDate },
    });
    const byWorker = new Map(records.map((r) => [r.workerId, r]));
    const presentIds = new Set(records.map((r) => r.workerId));

    const toRow = (r: (typeof roster)[number]) => {
      const rec = byWorker.get(r.workerId);
      return {
        workerId: r.worker.id,
        name: r.displayName || r.worker.name,
        employeeCode: r.worker.employeeCode,
        jobTitle: r.jobTitle,
        hourlyRate: String(r.hourlyRate),
        record: rec
          ? {
              id: rec.id,
              regularHours: String(rec.regularHours),
              extraHours: String(rec.extraHours),
              notes: rec.notes,
            }
          : null,
      };
    };

    const dayWorkers = includeAll
      ? roster.map(toRow)
      : roster.filter((r) => presentIds.has(r.workerId)).map(toRow);

    res.json({
      project: {
        id: project.id,
        name: project.name,
        code: project.code,
        notes: project.notes,
        weekCounter: project.weekCounter,
        excelFilename: project.excelFilename,
      },
      date: formatDateOnly(workDate),
      dayName: arabicWeekday(workDate),
      includeAll,
      workers: dayWorkers,
      /** Full project roster for search / add-to-day (not auto-listed). */
      roster: roster.map((r) => ({
        workerId: r.worker.id,
        name: r.displayName || r.worker.name,
        employeeCode: r.worker.employeeCode,
        jobTitle: r.jobTitle,
      })),
    });
  })
);

const daySaveSchema = z.object({
  date: z.string(),
  rows: z
    .array(
      z.object({
        workerId: z.string().uuid(),
        regularHours: z.coerce.number().min(0).max(24),
        extraHours: z.coerce.number().min(0).max(24),
        notes: z.string().max(2000).optional().nullable(),
      })
    )
    .max(500),
});

siteWorkRouter.put(
  "/projects/:id/day",
  asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const input = daySaveSchema.parse(req.body);
    const workDate = parseDateOnly(input.date);
    if (!workDate) {
      res.status(400).json({ error: "Invalid date (YYYY-MM-DD)" });
      return;
    }
    if (!(await assertAssigned(req, projectId))) {
      res.status(403).json({ error: "Project not assigned" });
      return;
    }
    const project = await prisma.siteProject.findFirst({
      where: { id: projectId, active: true },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const rosterIds = new Set(
      (
        await prisma.siteProjectWorker.findMany({
          where: { projectId },
          select: { workerId: true },
        })
      ).map((r) => r.workerId)
    );

    const engineerId = req.siteEngineer!.id;
    const keepIds = input.rows.map((r) => r.workerId).filter((id) => rosterIds.has(id));

    // Day list is source of truth: drop anyone not submitted for this date.
    await prisma.siteDailyRecord.deleteMany({
      where: {
        projectId,
        workDate,
        ...(keepIds.length ? { workerId: { notIn: keepIds } } : {}),
      },
    });

    const saved = [];
    for (const row of input.rows) {
      if (!rosterIds.has(row.workerId)) continue;
      const notes = row.notes?.trim() || null;
      const record = await prisma.siteDailyRecord.upsert({
        where: {
          projectId_workerId_workDate: {
            projectId,
            workerId: row.workerId,
            workDate,
          },
        },
        create: {
          projectId,
          workerId: row.workerId,
          engineerId,
          workDate,
          regularHours: row.regularHours,
          extraHours: row.extraHours,
          notes,
        },
        update: {
          engineerId,
          regularHours: row.regularHours,
          extraHours: row.extraHours,
          notes,
        },
        include: {
          worker: { select: { id: true, name: true, employeeCode: true } },
        },
      });
      saved.push(serializeDailyRecord(record));
    }

    // Mirror into the project Excel workbook (and Drive if configured).
    await syncProjectDayToExcel({
      projectId,
      workDate: formatDateOnly(workDate),
      workerIds: saved.map((r) => r.workerId),
    });

    res.json({ date: formatDateOnly(workDate), records: saved });
  })
);

siteWorkRouter.get(
  "/projects/:id/week",
  asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const weekStartRaw = String(req.query.weekStart || "");
    let weekStart: Date;
    if (weekStartRaw) {
      const parsed = parseDateOnly(weekStartRaw);
      if (!parsed) {
        res.status(400).json({ error: "Invalid weekStart (YYYY-MM-DD)" });
        return;
      }
      weekStart = startOfWeekSaturday(parsed);
    } else {
      weekStart = startOfWeekSaturday(new Date());
    }

    if (!(await assertAssigned(req, projectId))) {
      res.status(403).json({ error: "Project not assigned" });
      return;
    }
    const project = await prisma.siteProject.findFirst({
      where: { id: projectId, active: true },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const includeAll = String(req.query.all || "") === "1";
    const weekEnd = addDays(weekStart, 5);
    const dates = weekDatesFromStart(weekStart);
    const roster = await prisma.siteProjectWorker.findMany({
      where: { projectId, worker: { active: true } },
      include: { worker: true },
      orderBy: { worker: { name: "asc" } },
    });
    const records = await prisma.siteDailyRecord.findMany({
      where: {
        projectId,
        workDate: { gte: weekStart, lte: weekEnd },
      },
    });
    const key = (workerId: string, date: string) => `${workerId}:${date}`;
    const map = new Map(
      records.map((r) => [key(r.workerId, formatDateOnly(r.workDate)), r])
    );
    const activeWorkerIds = new Set(records.map((r) => r.workerId));
    const visible = includeAll
      ? roster
      : roster.filter((r) => activeWorkerIds.has(r.workerId));

    res.json({
      project: { id: project.id, name: project.name, code: project.code },
      weekStart: formatDateOnly(weekStart),
      weekEnd: formatDateOnly(weekEnd),
      includeAll,
      days: dates.map((d) => ({
        date: formatDateOnly(d),
        dayName: arabicWeekday(d),
      })),
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
          };
        });
        const totalRegular = days.reduce((s, x) => s + (x.regularHours ? Number(x.regularHours) : 0), 0);
        const totalExtra = days.reduce((s, x) => s + (x.extraHours ? Number(x.extraHours) : 0), 0);
        return {
          workerId: r.worker.id,
          name: r.worker.name,
          employeeCode: r.worker.employeeCode,
          days,
          totalRegular: String(totalRegular),
          totalExtra: String(totalExtra),
        };
      }),
      rosterCount: roster.length,
    });
  })
);

/** Excel preview — admin site session or assigned engineer only. */
siteWorkRouter.get(
  "/projects/:id/excel/preview",
  asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    if (!(await assertAssigned(req, projectId))) {
      res.status(403).json({ error: "Project not assigned" });
      return;
    }
    const project = await prisma.siteProject.findFirst({
      where: { id: projectId, active: true },
    });
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

/** Excel download — admin site session or assigned engineer only. */
siteWorkRouter.get(
  "/projects/:id/excel",
  asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    if (!(await assertAssigned(req, projectId))) {
      res.status(403).json({ error: "Project not assigned" });
      return;
    }
    const project = await prisma.siteProject.findFirst({
      where: { id: projectId, active: true },
    });
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

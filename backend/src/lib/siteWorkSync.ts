import fs from "node:fs";
import path from "node:path";
import { prisma } from "../prisma";
import {
  createProjectWorkbookFromTemplate,
  ensureTemplateFromSource,
  projectExcelAbsolutePath,
  safeExcelFilename,
  upsertExcelDay,
} from "./siteWorkExcel";
import { upsertProjectWorkbookToDrive } from "./siteWorkDrive";
import { ensureSiteWorkDirs, siteWorkSourceDir } from "./siteWorkPaths";
import { parseDateOnly, startOfWeekSaturday } from "./siteWorkDates";

/** Ensure a project has a local workbook (clone template if needed). */
export async function ensureProjectExcel(projectId: string): Promise<string | null> {
  ensureSiteWorkDirs();
  const project = await prisma.siteProject.findUnique({ where: { id: projectId } });
  if (!project) return null;

  let filename = project.excelFilename;
  if (!filename) {
    filename = safeExcelFilename(project.name);
    await prisma.siteProject.update({
      where: { id: projectId },
      data: { excelFilename: filename, weekCounter: project.weekCounter || 1 },
    });
  }

  const abs = projectExcelAbsolutePath(filename);
  if (!fs.existsSync(abs)) {
    const sourceTemplate = path.join(siteWorkSourceDir(), "عمال مشروع 77.xlsx");
    try {
      await ensureTemplateFromSource(sourceTemplate);
    } catch {
      // continue with empty
    }
    await createProjectWorkbookFromTemplate(abs, project.name, Math.max(1, project.weekCounter || 1));
  }
  return abs;
}

/**
 * After DB day upserts, mirror into the project Excel and optionally Drive.
 */
export async function syncProjectDayToExcel(opts: {
  projectId: string;
  workDate: string; // YYYY-MM-DD
  workerIds?: string[];
}): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    const project = await prisma.siteProject.findUnique({
      where: { id: opts.projectId },
      include: {
        workers: { include: { worker: true } },
      },
    });
    if (!project) return { ok: false, error: "Project not found" };

    const abs = await ensureProjectExcel(project.id);
    if (!abs) return { ok: false, error: "No excel path" };

    const workDate = parseDateOnly(opts.workDate);
    if (!workDate) return { ok: false, error: "Bad date" };
    const weekStart = startOfWeekSaturday(workDate);

    // Derive week number: prefer stored counter if same week as latest, else bump
    let weekNumber = project.weekCounter || 1;
    // If this date is after last known week end, bump — simple approach: use counter
    // and let sheet matching by week number + dates handle it.
    if (!project.weekCounter) weekNumber = 1;

    const records = await prisma.siteDailyRecord.findMany({
      where: {
        projectId: project.id,
        workDate,
        ...(opts.workerIds?.length ? { workerId: { in: opts.workerIds } } : {}),
      },
    });

    for (const rec of records) {
      const link = project.workers.find((w) => w.workerId === rec.workerId);
      if (!link) continue;
      await upsertExcelDay({
        filePath: abs,
        projectName: project.name,
        weekNumber,
        weekStart,
        worker: {
          displayName: link.displayName || link.worker.name,
          fullName: link.worker.fullName || link.worker.name,
          jobTitle: link.jobTitle,
          hourlyRate: Number(link.hourlyRate) || 0,
          sortOrder: link.sortOrder || 1,
        },
        workDate,
        regularHours: Number(rec.regularHours) || 0,
        extraHours: Number(rec.extraHours) || 0,
        notes: rec.notes,
        otherWorks: rec.otherWorks,
      });
    }

    // Refresh driveFileId if synced
    const driveId = await upsertProjectWorkbookToDrive({
      localPath: abs,
      filename: path.basename(abs),
      existingFileId: project.driveFileId,
    });
    if (driveId && driveId !== project.driveFileId) {
      await prisma.siteProject.update({
        where: { id: project.id },
        data: { driveFileId: driveId },
      });
    }

    return { ok: true, path: abs };
  } catch (err) {
    console.error("[site-work] excel sync failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "sync failed" };
  }
}

/** Rebuild entire current week sheet from DB (admin / heavy sync). */
export async function rebuildWeekExcel(projectId: string, weekStartISO: string) {
  const weekStart = parseDateOnly(weekStartISO);
  if (!weekStart) throw new Error("Bad weekStart");
  const project = await prisma.siteProject.findUnique({
    where: { id: projectId },
    include: { workers: { include: { worker: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!project) throw new Error("Project not found");
  const abs = await ensureProjectExcel(projectId);
  if (!abs) throw new Error("No excel");

  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 5);

  const records = await prisma.siteDailyRecord.findMany({
    where: {
      projectId,
      workDate: { gte: weekStart, lte: end },
    },
  });

  const weekNumber = project.weekCounter || 1;
  for (const link of project.workers) {
    const workerRecs = records.filter((r) => r.workerId === link.workerId);
    for (const rec of workerRecs) {
      await upsertExcelDay({
        filePath: abs,
        projectName: project.name,
        weekNumber,
        weekStart,
        worker: {
          displayName: link.displayName || link.worker.name,
          fullName: link.worker.fullName || link.worker.name,
          jobTitle: link.jobTitle,
          hourlyRate: Number(link.hourlyRate) || 0,
          sortOrder: link.sortOrder || 1,
        },
        workDate: rec.workDate,
        regularHours: Number(rec.regularHours) || 0,
        extraHours: Number(rec.extraHours) || 0,
        notes: rec.notes,
        otherWorks: rec.otherWorks,
      });
    }
  }

  const driveId = await upsertProjectWorkbookToDrive({
    localPath: abs,
    filename: path.basename(abs),
    existingFileId: project.driveFileId,
  });
  if (driveId && driveId !== project.driveFileId) {
    await prisma.siteProject.update({ where: { id: projectId }, data: { driveFileId: driveId } });
  }
  return abs;
}

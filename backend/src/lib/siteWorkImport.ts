/**
 * Import historical site-work Excel workbooks into Postgres + copy into projects/.
 */
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import {
  ensureTemplateFromSource,
  normalizeWorkerKey,
  parseWorkbookFile,
  projectExcelAbsolutePath,
  safeExcelFilename,
  suggestProjectMetaFromFilename,
} from "./siteWorkExcel";
import { ensureSiteWorkDirs, siteWorkSourceDir } from "./siteWorkPaths";
import { parseDateOnly } from "./siteWorkDates";

export type ImportFileStats = {
  file: string;
  projectId: string;
  projectName: string;
  sheets: number;
  workers: number;
  dayRowsUpserted: number;
  dayRowsSkippedEmpty: number;
  weekCounter: number;
};

async function ensureSystemEngineer() {
  const email = "site-import@alshantaf.local";
  let eng = await prisma.siteEngineer.findUnique({ where: { email } });
  if (!eng) {
    eng = await prisma.siteEngineer.create({
      data: {
        email,
        name: "استيراد Excel",
        passwordHash: await bcrypt.hash(`import-${Date.now()}`, 10),
        active: false,
      },
    });
  }
  return eng;
}

export async function importSiteWorkFile(
  filePath: string,
  engineerId: string
): Promise<ImportFileStats> {
  const base = path.basename(filePath);
  const meta = suggestProjectMetaFromFilename(base);
  const sheets = await parseWorkbookFile(filePath);

  let project = await prisma.siteProject.findFirst({
    where: { OR: [{ name: meta.name }, { code: meta.code || undefined }] },
  });

  const excelFilename = safeExcelFilename(meta.name);
  const dest = projectExcelAbsolutePath(excelFilename);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(filePath, dest);

  if (!project) {
    project = await prisma.siteProject.create({
      data: {
        name: meta.name,
        code: meta.code,
        excelFilename,
        weekCounter: 0,
        active: true,
      },
    });
  } else {
    project = await prisma.siteProject.update({
      where: { id: project.id },
      data: { excelFilename, code: project.code || meta.code },
    });
  }

  // Replace attendance from this workbook so corrected dates don't leave ghosts.
  await prisma.siteDailyRecord.deleteMany({ where: { projectId: project.id } });

  let maxWeek = 0;
  let dayRowsUpserted = 0;
  let dayRowsSkippedEmpty = 0;
  const workerCache = new Map<string, string>();

  for (const sheet of sheets) {
    if (sheet.weekNumber && sheet.weekNumber > maxWeek) maxWeek = sheet.weekNumber;

    for (const w of sheet.workers) {
      const key = normalizeWorkerKey(w.displayName);
      let workerId = workerCache.get(key);
      if (!workerId) {
        let worker = await prisma.siteWorker.findFirst({
          where: {
            OR: [
              { name: w.displayName },
              ...(w.fullName ? [{ fullName: w.fullName }] : []),
            ],
          },
        });
        if (!worker) {
          worker = await prisma.siteWorker.create({
            data: {
              name: w.displayName,
              fullName: w.fullName,
              employeeCode: w.sortOrder ? String(w.sortOrder) : null,
              notes: w.jobTitle || null,
            },
          });
        } else if (w.fullName && !worker.fullName) {
          worker = await prisma.siteWorker.update({
            where: { id: worker.id },
            data: { fullName: w.fullName },
          });
        }
        workerId = worker.id;
        workerCache.set(key, workerId);

        await prisma.siteProjectWorker.upsert({
          where: { projectId_workerId: { projectId: project.id, workerId } },
          create: {
            projectId: project.id,
            workerId,
            displayName: w.displayName,
            jobTitle: w.jobTitle || null,
            hourlyRate: w.hourlyRate || 0,
            sortOrder: w.sortOrder || 0,
          },
          update: {
            displayName: w.displayName,
            jobTitle: w.jobTitle || null,
            hourlyRate: w.hourlyRate || 0,
            sortOrder: w.sortOrder || 0,
          },
        });
      }

      for (const day of w.days) {
        const workDate = parseDateOnly(day.date);
        if (!workDate) continue;
        if (!day.regularHours && !day.extraHours && !day.notes && !day.otherWorks) {
          dayRowsSkippedEmpty += 1;
          continue;
        }

        await prisma.siteDailyRecord.upsert({
          where: {
            projectId_workerId_workDate: {
              projectId: project.id,
              workerId: workerId!,
              workDate,
            },
          },
          create: {
            projectId: project.id,
            workerId: workerId!,
            engineerId,
            workDate,
            regularHours: day.regularHours,
            extraHours: day.extraHours,
            notes: day.notes,
            otherWorks: day.otherWorks,
          },
          update: {
            regularHours: day.regularHours,
            extraHours: day.extraHours,
            notes: day.notes,
            otherWorks: day.otherWorks,
          },
        });
        dayRowsUpserted += 1;
      }
    }
  }

  await prisma.siteProject.update({
    where: { id: project.id },
    data: { weekCounter: maxWeek },
  });

  return {
    file: base,
    projectId: project.id,
    projectName: project.name,
    sheets: sheets.length,
    workers: workerCache.size,
    dayRowsUpserted,
    dayRowsSkippedEmpty,
    weekCounter: maxWeek,
  };
}

export async function importAllSiteWorkSource(dir?: string): Promise<{
  files: ImportFileStats[];
  totalDayRows: number;
  recordCount: number;
}> {
  ensureSiteWorkDirs();
  const sourceDir = dir || siteWorkSourceDir();
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source dir missing: ${sourceDir}`);
  }

  const files = fs
    .readdirSync(sourceDir)
    .filter((f) => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$"))
    .map((f) => path.join(sourceDir, f))
    .sort();

  if (!files.length) {
    throw new Error(`No xlsx files in ${sourceDir}`);
  }

  const smallest = [...files].sort((a, b) => fs.statSync(a).size - fs.statSync(b).size)[0]!;
  await ensureTemplateFromSource(smallest);

  const eng = await ensureSystemEngineer();
  const stats: ImportFileStats[] = [];
  let totalDayRows = 0;
  for (const file of files) {
    const s = await importSiteWorkFile(file, eng.id);
    stats.push(s);
    totalDayRows += s.dayRowsUpserted;
  }

  const recordCount = await prisma.siteDailyRecord.count();
  return { files: stats, totalDayRows, recordCount };
}

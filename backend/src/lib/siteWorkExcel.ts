import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import {
  addDays,
  excelDayLabel,
  formatDateOnly,
  formatExcelShortDate,
  parseExcelShortDate,
  startOfWeekSaturday,
  weekDatesFromStart,
} from "./siteWorkDates";
import {
  ensureSiteWorkDirs,
  projectExcelAbsolutePath,
  safeExcelFilename,
  siteWorkTemplatePath,
} from "./siteWorkPaths";

const NAME_HEADER_RE = /^الإسم/;
const WORKER_CELL_RE =
  /الإسم\s*:\s*\n?\s*([^\n]+)\n+\s*(\d+)\n+\s*الوظيفة\s*\n?\s*([^\n]+)/s;
const RATE_RE = /\*\s*([0-9]+(?:\.[0-9]+)?)\s*\)/;

export type ParsedDayRow = {
  date: string; // YYYY-MM-DD
  dayLabel: string;
  regularHours: number;
  extraHours: number;
  otherWorks: string | null;
  notes: string | null;
};

export type ParsedWorkerBlock = {
  displayName: string;
  fullName: string | null;
  sortOrder: number;
  jobTitle: string;
  hourlyRate: number;
  headerRow: number;
  dayStartRow: number;
  days: ParsedDayRow[];
};

export type ParsedWeekSheet = {
  sheetName: string;
  weekNumber: number | null;
  weekTitle: string | null;
  settlementDate: string | null;
  weekStart: string | null;
  workers: ParsedWorkerBlock[];
};

function num(v: unknown): number {
  if (v && typeof v === "object") {
    if ("result" in (v as object)) {
      return num((v as { result?: unknown }).result);
    }
    if ("richText" in (v as object)) {
      return num(
        ((v as { richText: Array<{ text: string }> }).richText || []).map((p) => p.text).join("")
      );
    }
  }
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !v.trim().startsWith("=")) {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Read numeric cell, including formula cached results. */
export function cellNum(ws: ExcelJS.Worksheet, row: number, col: number): number {
  return num(cellValue(ws, row, col));
}

function text(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

export function normalizeWorkerKey(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim()
    .toLowerCase();
}

function extractRate(formula: unknown): number {
  if (typeof formula !== "string") return 0;
  const m = formula.match(RATE_RE);
  return m ? Number(m[1]) : 0;
}

function parseWeekNumber(sheetName: string, titleCell: string | null): number | null {
  const fromTitle = titleCell?.match(/الاسبوع\s*(\d+)/);
  if (fromTitle) return Number(fromTitle[1]);
  const fromSheet = sheetName.match(/(\d+)/);
  return fromSheet ? Number(fromSheet[1]) : null;
}

async function loadWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  return wb;
}

function cellValue(ws: ExcelJS.Worksheet, row: number, col: number): unknown {
  const cell = ws.getCell(row, col);
  return cell.value;
}

function cellText(ws: ExcelJS.Worksheet, row: number, col: number): string {
  const v = cellValue(ws, row, col);
  if (v && typeof v === "object" && "result" in (v as object)) {
    return text((v as { result?: unknown }).result);
  }
  if (v && typeof v === "object" && "richText" in (v as object)) {
    return text(
      ((v as { richText: Array<{ text: string }> }).richText || []).map((p) => p.text).join("")
    );
  }
  if (v && typeof v === "object" && "formula" in (v as object) && "result" in (v as object)) {
    return text((v as { result?: unknown }).result);
  }
  if (v && typeof v === "object" && "formula" in (v as object)) {
    return text((v as { formula: string }).formula);
  }
  return text(v);
}

function parseWorkerHeader(raw: string): { displayName: string; sortOrder: number; jobTitle: string } | null {
  const m = raw.match(WORKER_CELL_RE);
  if (!m) {
    // Fallback: first line after الإسم :
    const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      return {
        displayName: lines[1]!.replace(/^الإسم\s*:\s*/, "").trim(),
        sortOrder: Number(lines.find((l) => /^\d+$/.test(l)) || 0) || 0,
        jobTitle: (lines.find((l, i) => i > 0 && /معلم|مساعد|عامل|وظيفة/.test(l)) || "")
          .replace(/الوظيفة/g, "")
          .trim(),
      };
    }
    return null;
  }
  return {
    displayName: m[1]!.trim(),
    sortOrder: Number(m[2]),
    jobTitle: m[3]!.trim(),
  };
}

export function parseWeekSheet(ws: ExcelJS.Worksheet, yearHint?: number): ParsedWeekSheet {
  const sheetName = ws.name;
  const titleCell = cellText(ws, 6, 1) || null;
  const settlementRaw = cellText(ws, 2, 1);
  const settlementMatch = settlementRaw.match(/(\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?)/);
  let settlementDate: string | null = null;
  let fallbackYear = yearHint && yearHint > 2000 ? yearHint : new Date().getUTCFullYear();
  if (settlementMatch) {
    const d = parseExcelShortDate(settlementMatch[1], fallbackYear);
    if (d) {
      settlementDate = formatDateOnly(d);
      fallbackYear = d.getUTCFullYear();
    }
  }

  const workers: ParsedWorkerBlock[] = [];
  const maxRow = ws.rowCount || ws.actualRowCount || 500;

  for (let r = 1; r <= maxRow; r++) {
    const a = cellText(ws, r, 1);
    if (!NAME_HEADER_RE.test(a)) continue;
    const parsed = parseWorkerHeader(a);
    if (!parsed) continue;

    // Full name often in settlement block ~4 rows above for non-first workers, or row 3 for first.
    let fullName: string | null = null;
    for (let back = 1; back <= 6; back++) {
      const prev = cellText(ws, r - back, 1);
      if (prev.startsWith("اسم")) {
        fullName = prev.replace(/^اسم\s*:\s*/, "").trim() || null;
        break;
      }
    }

    const dayStart = r + 1;
    const days: ParsedDayRow[] = [];
    let rate = 0;
    for (let i = 0; i < 6; i++) {
      const row = dayStart + i;
      const dateCell = cellValue(ws, row, 2);
      const dayLabel = cellText(ws, row, 3);
      if (dayLabel === "المجموع:" || cellText(ws, row, 2) === "المجموع:") break;
      const formula = cellValue(ws, row, 7);
      if (!rate) rate = extractRate(typeof formula === "object" && formula && "formula" in formula
        ? (formula as { formula: string }).formula
        : formula);
      // Also check string formula
      if (!rate && typeof formula === "string") rate = extractRate(formula);
      if (!rate) {
        const g = ws.getCell(row, 7);
        if (typeof g.value === "object" && g.value && "formula" in g.value) {
          rate = extractRate((g.value as { formula: string }).formula);
        } else if (typeof g.value === "string") {
          rate = extractRate(g.value);
        }
      }

      const weekHint = days[0]?.date
        ? startOfWeekSaturday(new Date(days[0].date + "T00:00:00Z"))
        : settlementDate
          ? startOfWeekSaturday(new Date(settlementDate + "T00:00:00Z"))
          : undefined;

      let dateObj = parseExcelShortDate(
        typeof dateCell === "object" && dateCell && "result" in (dateCell as object)
          ? (dateCell as { result: unknown }).result
          : dateCell,
        fallbackYear,
        weekHint
      );
      // Follow formulas pointing at first worker dates (=B8 etc.) — use shared week dates if available
      if (!dateObj && workers[0]?.days[i]) {
        dateObj = new Date(workers[0].days[i]!.date + "T00:00:00Z");
      }
      if (!dateObj) continue;

      days.push({
        date: formatDateOnly(dateObj),
        dayLabel: dayLabel || excelDayLabel(dateObj),
        regularHours: cellNum(ws, row, 5),
        extraHours: cellNum(ws, row, 6),
        otherWorks: cellText(ws, row, 8) || null,
        notes: cellText(ws, row, 9) || null,
      });
    }

    if (!days.length) continue;
    workers.push({
      displayName: parsed.displayName,
      fullName,
      sortOrder: parsed.sortOrder || workers.length + 1,
      jobTitle: parsed.jobTitle || "",
      hourlyRate: rate,
      headerRow: r,
      dayStartRow: dayStart,
      days,
    });
  }

  const weekStart = workers[0]?.days[0]?.date
    ? formatDateOnly(startOfWeekSaturday(new Date(workers[0].days[0].date + "T00:00:00Z")))
    : null;

  return {
    sheetName,
    weekNumber: parseWeekNumber(sheetName, titleCell),
    weekTitle: titleCell,
    settlementDate,
    weekStart,
    workers,
  };
}

export async function parseWorkbookFile(filePath: string): Promise<ParsedWeekSheet[]> {
  const wb = await loadWorkbook(filePath);
  const out: ParsedWeekSheet[] = [];
  // Prefer the first explicit year found in settlement headers (historical workbooks).
  let yearHint = new Date().getUTCFullYear();
  for (const ws of wb.worksheets) {
    const settlementRaw = cellText(ws, 2, 1);
    const withYear = settlementRaw.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/);
    if (!withYear) continue;
    const d = parseExcelShortDate(withYear[1], yearHint);
    if (d) {
      yearHint = d.getUTCFullYear();
      break;
    }
  }

  // Walk sheets in order so later weeks inherit the last known calendar year.
  let lastWeekStart: Date | null = null;
  let lastWeekNumber: number | null = null;

  for (const ws of wb.worksheets) {
    try {
      const parsed = parseWeekSheet(ws, yearHint);
      if (!parsed.workers.length) continue;

      // If week numbers increase but parsed dates jumped backward (e.g. Dec→Jan), bump year.
      if (
        parsed.weekStart &&
        lastWeekStart &&
        lastWeekNumber != null &&
        parsed.weekNumber != null &&
        parsed.weekNumber > lastWeekNumber
      ) {
        const start = new Date(parsed.weekStart + "T00:00:00Z");
        if (start.getTime() < lastWeekStart.getTime() - 7 * 86400000) {
          const bumped = new Date(
            Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate())
          );
          const deltaYears = bumped.getUTCFullYear() - start.getUTCFullYear();
          if (deltaYears > 0) {
            for (const w of parsed.workers) {
              for (const day of w.days) {
                const d = new Date(day.date + "T00:00:00Z");
                day.date = formatDateOnly(
                  new Date(Date.UTC(d.getUTCFullYear() + deltaYears, d.getUTCMonth(), d.getUTCDate()))
                );
              }
            }
            parsed.weekStart = parsed.workers[0]?.days[0]?.date
              ? formatDateOnly(
                  startOfWeekSaturday(new Date(parsed.workers[0].days[0]!.date + "T00:00:00Z"))
                )
              : parsed.weekStart;
            if (parsed.settlementDate) {
              const s = new Date(parsed.settlementDate + "T00:00:00Z");
              parsed.settlementDate = formatDateOnly(
                new Date(Date.UTC(s.getUTCFullYear() + deltaYears, s.getUTCMonth(), s.getUTCDate()))
              );
            }
          }
        }
      }

      if (parsed.settlementDate) {
        yearHint = Number(parsed.settlementDate.slice(0, 4));
      } else if (parsed.weekStart) {
        yearHint = Number(parsed.weekStart.slice(0, 4));
      }
      if (parsed.weekStart) lastWeekStart = new Date(parsed.weekStart + "T00:00:00Z");
      if (parsed.weekNumber != null) lastWeekNumber = parsed.weekNumber;

      out.push(parsed);
    } catch {
      // skip broken sheets
    }
  }
  return out;
}

function setHoursCell(ws: ExcelJS.Worksheet, row: number, col: number, value: number) {
  ws.getCell(row, col).value = value;
}

/** Update one worker/day inside an existing workbook; creates a week sheet when missing. */
export async function upsertExcelDay(opts: {
  filePath: string;
  projectName: string;
  weekNumber: number;
  weekStart: Date;
  weekTitle?: string;
  worker: {
    displayName: string;
    fullName?: string | null;
    jobTitle?: string | null;
    hourlyRate: number;
    sortOrder: number;
  };
  workDate: Date;
  regularHours: number;
  extraHours: number;
  notes?: string | null;
  otherWorks?: string | null;
}): Promise<void> {
  ensureSiteWorkDirs();
  if (!fs.existsSync(opts.filePath)) {
    await createProjectWorkbookFromTemplate(opts.filePath, opts.projectName, opts.weekNumber);
  }

  const wb = await loadWorkbook(opts.filePath);
  const weekDates = weekDatesFromStart(opts.weekStart);
  const dayIndex = weekDates.findIndex((d) => formatDateOnly(d) === formatDateOnly(opts.workDate));
  if (dayIndex < 0) {
    // Friday or outside Sat-Thu — skip Excel write
    await wb.xlsx.writeFile(opts.filePath);
    return;
  }

  let ws =
    wb.worksheets.find((s) => {
      const n = parseWeekNumber(s.name, cellText(s, 6, 1));
      return n === opts.weekNumber;
    }) || null;

  if (!ws) {
    ws = await cloneOrCreateWeekSheet(wb, opts.projectName, opts.weekNumber, opts.weekStart, opts.weekTitle);
  }

  // Ensure week header/dates
  ws.getCell(6, 1).value = opts.weekTitle || `   الاسبوع ${opts.weekNumber} : `;
  const settlement = addDays(opts.weekStart, 5); // Thursday
  ws.getCell(2, 1).value = `التاريخ : ${settlement.getUTCDate()}/${settlement.getUTCMonth() + 1}/${settlement.getUTCFullYear()}`;

  const key = normalizeWorkerKey(opts.worker.displayName);
  let block = findWorkerBlock(ws, key);

  if (!block) {
    block = appendWorkerBlock(ws, {
      displayName: opts.worker.displayName,
      fullName: opts.worker.fullName || opts.worker.displayName,
      jobTitle: opts.worker.jobTitle || "عامل",
      hourlyRate: opts.worker.hourlyRate || 0,
      sortOrder: opts.worker.sortOrder || 1,
      projectName: opts.projectName,
      weekStart: opts.weekStart,
    });
  }

  const row = block.dayStartRow + dayIndex;
  setHoursCell(ws, row, 5, opts.regularHours);
  setHoursCell(ws, row, 6, opts.extraHours);
  if (opts.otherWorks != null) ws.getCell(row, 8).value = opts.otherWorks || null;
  if (opts.notes != null) ws.getCell(row, 9).value = opts.notes || null;

  // Keep date/day/project labels fresh on first worker block
  for (let i = 0; i < 6; i++) {
    const d = weekDates[i]!;
    const r = block.dayStartRow + i;
    ws.getCell(r, 2).value = formatExcelShortDate(d);
    ws.getCell(r, 3).value = excelDayLabel(d);
    ws.getCell(r, 4).value = opts.projectName;
    const rate = opts.worker.hourlyRate || extractRate(String(ws.getCell(r, 7).value || "")) || 0;
    if (rate) {
      ws.getCell(r, 7).value = { formula: `(E${r}*${rate})+(F${r}*${rate})` };
    }
  }

  // Move sheet to front for newest week feel
  if (wb.worksheets[0] !== ws) {
    wb.views = wb.views; // no-op keep
  }

  await wb.xlsx.writeFile(opts.filePath);
}

function findWorkerBlock(
  ws: ExcelJS.Worksheet,
  key: string
): { headerRow: number; dayStartRow: number } | null {
  const maxRow = ws.rowCount || 800;
  for (let r = 1; r <= maxRow; r++) {
    const a = cellText(ws, r, 1);
    if (!NAME_HEADER_RE.test(a)) continue;
    const parsed = parseWorkerHeader(a);
    if (!parsed) continue;
    if (normalizeWorkerKey(parsed.displayName) === key) {
      return { headerRow: r, dayStartRow: r + 1 };
    }
  }
  return null;
}

function appendWorkerBlock(
  ws: ExcelJS.Worksheet,
  opts: {
    displayName: string;
    fullName: string;
    jobTitle: string;
    hourlyRate: number;
    sortOrder: number;
    projectName: string;
    weekStart: Date;
  }
): { headerRow: number; dayStartRow: number } {
  // Find last used row
  let last = 1;
  ws.eachRow((row) => {
    if (row.number > last) last = row.number;
  });
  const start = last + 3;
  const weekDates = weekDatesFromStart(opts.weekStart);
  const settlement = addDays(opts.weekStart, 5);

  ws.getCell(start, 1).value = "الموضوع : مخالصة مالية";
  ws.getCell(start + 1, 1).value = `التاريخ : ${settlement.getUTCDate()}/${settlement.getUTCMonth() + 1}/${settlement.getUTCFullYear()}`;
  ws.getCell(start + 2, 1).value = `اسم : ${opts.fullName}`;
  ws.getCell(start + 3, 1).value =
    "انا المذكور اعلاه قد استلمت كافة حقوقي المالية و العمالية  بناءا على جدول اليوميات\n الموضح لاحقا وبناءا عليه  لا يحق لي باي مطالبات مالية او عمالية من شركة الوثبة للمقاولات الانشائية ";
  ws.getCell(start + 5, 1).value = cellText(ws, 6, 1) || `   الاسبوع : `;

  const headerRow = start + 6;
  ws.getCell(headerRow, 1).value =
    `الإسم :\n${opts.displayName}\n\n${opts.sortOrder}\n\nالوظيفة\n ${opts.jobTitle}`;
  ws.getCell(headerRow, 2).value = "التاريخ";
  ws.getCell(headerRow, 3).value = "اليوم";
  ws.getCell(headerRow, 4).value = "المشروع";
  ws.getCell(headerRow, 5).value = "ساعات\nالعمل";
  ws.getCell(headerRow, 6).value = "خصم / إضافي";
  ws.getCell(headerRow, 7).value = "المبلغ";
  ws.getCell(headerRow, 8).value = "أعمال أخرى";
  ws.getCell(headerRow, 9).value = "ملاحظات";

  const dayStart = headerRow + 1;
  const rate = opts.hourlyRate || 0;
  for (let i = 0; i < 6; i++) {
    const r = dayStart + i;
    const d = weekDates[i]!;
    ws.getCell(r, 2).value = formatExcelShortDate(d);
    ws.getCell(r, 3).value = excelDayLabel(d);
    ws.getCell(r, 4).value = opts.projectName;
    ws.getCell(r, 5).value = 0;
    ws.getCell(r, 6).value = 0;
    ws.getCell(r, 7).value = { formula: `(E${r}*${rate})+(F${r}*${rate})` };
  }
  const totalRow = dayStart + 6;
  ws.getCell(totalRow, 2).value = "المجموع:";
  ws.getCell(totalRow, 5).value = {
    formula: `G${dayStart}+G${dayStart + 1}+G${dayStart + 2}+G${dayStart + 3}+G${dayStart + 4}+G${dayStart + 5}+I${totalRow}`,
  };
  ws.getCell(totalRow, 9).value = 0;
  ws.getCell(totalRow + 1, 1).value =
    "تم استلام كافة مستحقاتي المالية ولا يحق لي المطالبة بأي حقوق عمالية او مالية من الشركة وعليه اوقع:";

  return { headerRow, dayStartRow: dayStart };
}

async function cloneOrCreateWeekSheet(
  wb: ExcelJS.Workbook,
  projectName: string,
  weekNumber: number,
  weekStart: Date,
  weekTitle?: string
): Promise<ExcelJS.Worksheet> {
  const name = `الاسبوع ${weekNumber} -${projectName}`.slice(0, 31);
  // Prefer cloning first sheet to keep theme/styles
  const source = wb.worksheets[0];
  if (source) {
    const copy = wb.addWorksheet(name);
    // ExcelJS doesn't deep-clone well; duplicate by model values for used range
    source.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        copy.getCell(rowNumber, colNumber).value = cell.value;
        copy.getCell(rowNumber, colNumber).style = { ...cell.style };
      });
      if (row.height) copy.getRow(rowNumber).height = row.height;
    });
    source.columns?.forEach((col, i) => {
      if (col.width) copy.getColumn(i + 1).width = col.width;
    });

    // Clear hours for all worker day rows
    const maxRow = copy.rowCount || 500;
    for (let r = 1; r <= maxRow; r++) {
      const a = cellText(copy, r, 1);
      if (!NAME_HEADER_RE.test(a)) continue;
      for (let i = 1; i <= 6; i++) {
        const row = r + i;
        const b = cellText(copy, row, 2);
        if (b === "المجموع:") break;
        copy.getCell(row, 5).value = 0;
        copy.getCell(row, 6).value = 0;
        copy.getCell(row, 8).value = null;
        copy.getCell(row, 9).value = null;
        const d = weekDatesFromStart(weekStart)[i - 1];
        if (d) {
          copy.getCell(row, 2).value = formatExcelShortDate(d);
          copy.getCell(row, 3).value = excelDayLabel(d);
          copy.getCell(row, 4).value = projectName;
        }
      }
    }
    copy.getCell(6, 1).value = weekTitle || `   الاسبوع ${weekNumber} : `;
    const settlement = addDays(weekStart, 5);
    copy.getCell(2, 1).value = `التاريخ : ${settlement.getUTCDate()}/${settlement.getUTCMonth() + 1}/${settlement.getUTCFullYear()}`;
    return copy;
  }

  const ws = wb.addWorksheet(name);
  ws.getCell(1, 1).value = "الموضوع : مخالصة مالية";
  ws.getCell(6, 1).value = weekTitle || `   الاسبوع ${weekNumber} : `;
  return ws;
}

export async function createProjectWorkbookFromTemplate(
  destPath: string,
  projectName: string,
  weekNumber = 1
): Promise<void> {
  ensureSiteWorkDirs();
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const template = siteWorkTemplatePath();
  if (fs.existsSync(template)) {
    fs.copyFileSync(template, destPath);
  } else {
    // Fallback: empty workbook with one sheet
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`الاسبوع ${weekNumber} -${projectName}`.slice(0, 31));
    ws.getCell(1, 1).value = "الموضوع : مخالصة مالية";
    ws.getCell(6, 1).value = `   الاسبوع ${weekNumber} : `;
    await wb.xlsx.writeFile(destPath);
    return;
  }

  const wb = await loadWorkbook(destPath);
  // Rename first sheet / patch project labels
  const ws = wb.worksheets[0];
  if (ws) {
    ws.name = `الاسبوع ${weekNumber} -${projectName}`.slice(0, 31);
    ws.getCell(6, 1).value = `   الاسبوع ${weekNumber} : `;
    const maxRow = ws.rowCount || 200;
    for (let r = 1; r <= maxRow; r++) {
      const d = cellText(ws, r, 4);
      if (d && d !== "المشروع") ws.getCell(r, 4).value = projectName;
      // zero hours
      const a = cellText(ws, r, 1);
      if (NAME_HEADER_RE.test(a)) {
        for (let i = 1; i <= 6; i++) {
          ws.getCell(r + i, 5).value = 0;
          ws.getCell(r + i, 6).value = 0;
        }
      }
    }
  }
  await wb.xlsx.writeFile(destPath);
}

export async function ensureTemplateFromSource(sourceFile: string) {
  ensureSiteWorkDirs();
  const dest = siteWorkTemplatePath();
  if (fs.existsSync(dest)) return dest;
  if (!fs.existsSync(sourceFile)) throw new Error("Template source missing");
  // Use first sheet only of a small workbook as theme template
  const src = await loadWorkbook(sourceFile);
  const wb = new ExcelJS.Workbook();
  const source = src.worksheets[0];
  if (!source) throw new Error("Empty template source");
  const copy = wb.addWorksheet(source.name.slice(0, 31));
  source.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      copy.getCell(rowNumber, colNumber).value = cell.value;
      copy.getCell(rowNumber, colNumber).style = { ...cell.style };
    });
    if (row.height) copy.getRow(rowNumber).height = row.height;
  });
  source.columns?.forEach((col, i) => {
    if (col.width) copy.getColumn(i + 1).width = col.width;
  });
  // Clear numeric day entries
  const maxRow = copy.rowCount || 200;
  for (let r = 1; r <= maxRow; r++) {
    if (!NAME_HEADER_RE.test(cellText(copy, r, 1))) continue;
    for (let i = 1; i <= 6; i++) {
      copy.getCell(r + i, 5).value = 0;
      copy.getCell(r + i, 6).value = 0;
      copy.getCell(r + i, 8).value = null;
      copy.getCell(r + i, 9).value = null;
    }
  }
  await wb.xlsx.writeFile(dest);
  return dest;
}

export function suggestProjectMetaFromFilename(filename: string): { name: string; code: string | null } {
  const base = path.basename(filename, path.extname(filename));
  let name = base
    .replace(/^عمال\s*مشروع\s*/u, "")
    .replace(/^عمال\s*/u, "")
    .replace(/^مشروع\s*/u, "")
    .trim();
  if (!name) name = base;
  const codeMatch = name.match(/^(\d+)\b/);
  return { name, code: codeMatch ? codeMatch[1]! : null };
}

export type ExcelSheetMeta = {
  index: number;
  name: string;
  weekNumber: number | null;
};

export type ExcelPreviewPayload = {
  filename: string;
  sheetCount: number;
  sheets: ExcelSheetMeta[];
  activeSheetIndex: number;
  sheet: {
    name: string;
    weekNumber: number | null;
    weekTitle: string | null;
    settlementDate: string | null;
    weekStart: string | null;
    workers: Array<{
      name: string;
      fullName: string | null;
      jobTitle: string;
      hourlyRate: number;
      days: Array<{
        date: string;
        dayLabel: string;
        regularHours: number;
        extraHours: number;
        otherWorks: string | null;
        notes: string | null;
      }>;
      totalRegular: number;
      totalExtra: number;
    }>;
  } | null;
};

/** List sheet names without fully parsing worker blocks (fast index). */
export async function listWorkbookSheetMeta(filePath: string): Promise<ExcelSheetMeta[]> {
  const wb = await loadWorkbook(filePath);
  return wb.worksheets.map((ws, index) => {
    const titleCell = cellText(ws, 6, 1) || null;
    return {
      index,
      name: ws.name,
      weekNumber: parseWeekNumber(ws.name, titleCell),
    };
  });
}

/** Secure in-app preview: sheet list + one parsed week sheet (default last / requested). */
export async function buildExcelPreview(
  filePath: string,
  sheetIndexRaw?: number | string | null
): Promise<ExcelPreviewPayload> {
  const sheets = await listWorkbookSheetMeta(filePath);
  const filename = path.basename(filePath);
  if (!sheets.length) {
    return {
      filename,
      sheetCount: 0,
      sheets: [],
      activeSheetIndex: 0,
      sheet: null,
    };
  }

  let active = typeof sheetIndexRaw === "string" ? Number(sheetIndexRaw) : Number(sheetIndexRaw);
  if (!Number.isFinite(active) || active < 0 || active >= sheets.length) {
    active = sheets.length - 1;
  }

  const wb = await loadWorkbook(filePath);
  const ws = wb.worksheets[active];
  if (!ws) {
    return {
      filename,
      sheetCount: sheets.length,
      sheets,
      activeSheetIndex: active,
      sheet: null,
    };
  }

  // Prefer year from neighboring sheets when previewing a single week.
  let yearHint = new Date().getUTCFullYear();
  for (let i = 0; i <= active; i++) {
    const prev = wb.worksheets[i];
    if (!prev) continue;
    const probe = parseWeekSheet(prev, yearHint);
    if (probe.settlementDate) yearHint = Number(probe.settlementDate.slice(0, 4));
    else if (probe.weekStart) yearHint = Number(probe.weekStart.slice(0, 4));
  }
  const parsed = parseWeekSheet(ws, yearHint);
  return {
    filename,
    sheetCount: sheets.length,
    sheets,
    activeSheetIndex: active,
    sheet: {
      name: parsed.sheetName,
      weekNumber: parsed.weekNumber,
      weekTitle: parsed.weekTitle,
      settlementDate: parsed.settlementDate,
      weekStart: parsed.weekStart,
      workers: parsed.workers.map((w) => {
        const totalRegular = w.days.reduce((s, d) => s + d.regularHours, 0);
        const totalExtra = w.days.reduce((s, d) => s + d.extraHours, 0);
        return {
          name: w.displayName,
          fullName: w.fullName,
          jobTitle: w.jobTitle,
          hourlyRate: w.hourlyRate,
          days: w.days,
          totalRegular: Math.round(totalRegular * 100) / 100,
          totalExtra: Math.round(totalExtra * 100) / 100,
        };
      }),
    },
  };
}

export { safeExcelFilename, projectExcelAbsolutePath };

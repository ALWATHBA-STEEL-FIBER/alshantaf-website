import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";

const CBJ_REPI_URL = "https://www.cbj.gov.jo/ebv4.0/root_storage/en/eb_list_page/real_estate.xls";
const CACHE_DIR = path.join(os.tmpdir(), "alshantaf-market-cache");
const CACHE_FILE = path.join(CACHE_DIR, "cbj-repi.json");
const RAW_FILE = path.join(CACHE_DIR, "cbj-repi.xls");
const TTL_MS = 12 * 60 * 60 * 1000;

export type RepiPoint = { period: string; value: number };

export type CbjRepiPayload = {
  retrievedAt: string;
  sourceUrl: string;
  sourceName: string;
  frequency: "quarterly";
  baseYear: 2012;
  series: {
    key: string;
    labelAr: string;
    labelEn: string;
    points: RepiPoint[];
  }[];
  governoratesLatest: {
    key: string;
    labelAr: string;
    labelEn: string;
    value: number;
    period: string;
    /** QoQ % vs prior quarter in the same official workbook (null if unavailable). */
    changePct: number | null;
  }[];
};

const GOV_LABELS: Record<string, { ar: string; en: string }> = {
  عمان: { ar: "عمّان", en: "Amman" },
  إربد: { ar: "إربد", en: "Irbid" },
  اربد: { ar: "إربد", en: "Irbid" },
  الزرقاء: { ar: "الزرقاء", en: "Zarqa" },
  البلقاء: { ar: "البلقاء", en: "Balqa" },
  المفرق: { ar: "المفرق", en: "Mafraq" },
  جرش: { ar: "جرش", en: "Jerash" },
  عجلون: { ar: "عجلون", en: "Ajloun" },
  مادبا: { ar: "مادبا", en: "Madaba" },
  الكرك: { ar: "الكرك", en: "Karak" },
  الطفيلة: { ar: "الطفيلة", en: "Tafilah" },
  معان: { ar: "معان", en: "Ma'an" },
  العقبة: { ar: "العقبة", en: "Aqaba" },
};

type SheetRows = Array<Array<string | number | null | undefined>>;

function cellStr(v: unknown) {
  if (v == null) return "";
  return String(v).trim();
}

function sheetRows(sheet: XLSX.WorkSheet): SheetRows {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as SheetRows;
}

/** Locate header rows — SheetJS drops leading empty columns vs Excel. */
function findHeader(rows: SheetRows) {
  let yearRowIdx = -1;
  let qRowIdx = -1;
  for (let r = 0; r < Math.min(12, rows.length); r++) {
    const row = rows[r] ?? [];
    const hasYear = row.some((v) => typeof v === "number" && v >= 2005 && v <= 2100);
    const hasQ = row.some((v) => /^Q[1-4]$/i.test(cellStr(v)));
    if (hasYear && yearRowIdx < 0) yearRowIdx = r;
    if (hasQ && qRowIdx < 0) qRowIdx = r;
  }
  return { yearRowIdx, qRowIdx };
}

function parseQuarterlyColumns(rows: SheetRows) {
  const { yearRowIdx, qRowIdx } = findHeader(rows);
  if (yearRowIdx < 0 || qRowIdx < 0) return { cols: [] as Array<{ c: number; period: string }>, dataStart: 0 };

  const yearRow = rows[yearRowIdx] ?? [];
  const qRow = rows[qRowIdx] ?? [];
  const cols: Array<{ c: number; period: string }> = [];
  let year = 0;

  // Quarters sit under year labels that only appear on Q1 columns.
  const maxC = Math.max(yearRow.length, qRow.length);
  for (let c = 0; c < maxC; c++) {
    const yRaw = yearRow[c];
    const q = cellStr(qRow[c]);
    if (typeof yRaw === "number" && yRaw >= 2000 && yRaw <= 2100) year = Math.round(yRaw);
    if (!/^Q[1-4]$/i.test(q) || !year) continue;
    cols.push({ c, period: `${year}-${q.toUpperCase()}` });
  }

  return { cols, dataStart: Math.max(yearRowIdx, qRowIdx) + 1 };
}

function pointsFromRow(row: SheetRows[number] | undefined, cols: Array<{ c: number; period: string }>) {
  const points: RepiPoint[] = [];
  if (!row) return points;
  for (const col of cols) {
    const v = row[col.c];
    if (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1000) {
      points.push({ period: col.period, value: Math.round(v * 100) / 100 });
    }
  }
  return points;
}

function labelAt(row: SheetRows[number] | undefined) {
  // Label is usually first non-numeric string cell.
  if (!row) return "";
  for (const cell of row) {
    if (typeof cell === "string" && cell.trim()) return cell.trim();
    if (typeof cell === "number") break;
  }
  return cellStr(row[0]);
}

function extractTypeSeries(sheet: XLSX.WorkSheet) {
  const rows = sheetRows(sheet);
  const { cols, dataStart } = parseQuarterlyColumns(rows);
  const series: CbjRepiPayload["series"] = [];
  let section: "top" | "lands" = "top";

  const push = (key: string, labelAr: string, labelEn: string, row: SheetRows[number] | undefined) => {
    if (series.some((s) => s.key === key)) return;
    const points = pointsFromRow(row, cols);
    if (points.length) series.push({ key, labelAr, labelEn, points });
  };

  for (let r = dataStart; r < rows.length; r++) {
    const label = labelAt(rows[r]).replace(/\s+/g, " ");
    if (!label) continue;
    if (/المصدر|Source|أولية|Preliminary/i.test(label)) break;

    const bare = label.replace(/^\s+/, "");

    if (bare === "أراضي") {
      section = "lands";
      push("lands", "أراضي", "Lands", rows[r]);
      continue;
    }
    if (bare === "الرقم القياسي العام") {
      push("general", "الرقم القياسي العام", "General index", rows[r]);
      continue;
    }

    if (section === "top") {
      if (bare === "سكني") push("residential", "سكني", "Residential", rows[r]);
      else if (bare === "غير سكني") push("non_residential", "غير سكني", "Non-residential", rows[r]);
      else if (bare === "تجاري") push("commercial", "تجاري", "Commercial", rows[r]);
      else if (bare === "صناعي") push("industrial_assets", "صناعي (أصول)", "Industrial assets", rows[r]);
    } else {
      if (bare === "سكني") push("lands_residential", "أراضي سكنية", "Residential land", rows[r]);
      else if (bare === "تجاري") push("lands_commercial", "أراضي تجارية", "Commercial land", rows[r]);
      else if (bare === "صناعي") push("lands_industrial", "أراضي صناعية", "Industrial land", rows[r]);
      else if (/خارج التنظيم|Non-Regul/i.test(bare)) {
        push("lands_unregulated", "خارج التنظيم", "Non-regulated land", rows[r]);
      }
    }
  }
  return series;
}

function extractGovernorates(sheet: XLSX.WorkSheet) {
  const rows = sheetRows(sheet);
  const { cols, dataStart } = parseQuarterlyColumns(rows);
  if (cols.length === 0) return [] as CbjRepiPayload["governoratesLatest"];
  const last = cols[cols.length - 1]!;
  const prev = cols.length >= 2 ? cols[cols.length - 2]! : null;
  const out: CbjRepiPayload["governoratesLatest"] = [];

  for (let r = dataStart; r < rows.length; r++) {
    const label = labelAt(rows[r]).replace(/^\s+/, "");
    if (!label || /المصدر|Source|Period|الفترة|جدول|TABLE/i.test(label)) continue;
    const v = rows[r]?.[last.c];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const names = GOV_LABELS[label] ?? { ar: label, en: label };
    let changePct: number | null = null;
    if (prev) {
      const pv = rows[r]?.[prev.c];
      if (typeof pv === "number" && Number.isFinite(pv) && pv !== 0) {
        changePct = Math.round(((v - pv) / pv) * 1000) / 10;
      }
    }
    out.push({
      key: label,
      labelAr: names.ar,
      labelEn: names.en,
      value: Math.round(v * 100) / 100,
      period: last.period,
      changePct,
    });
  }
  return out.sort((a, b) => b.value - a.value);
}

async function readCache(): Promise<CbjRepiPayload | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as CbjRepiPayload & { cachedAt?: string };
    const cachedAt = parsed.cachedAt ? Date.parse(parsed.cachedAt) : Date.parse(parsed.retrievedAt);
    if (Date.now() - cachedAt < TTL_MS) return parsed;
  } catch {
    /* miss */
  }
  return null;
}

async function writeCache(payload: CbjRepiPayload) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify({ ...payload, cachedAt: new Date().toISOString() }), "utf8");
}

export async function fetchCbjRepi(force = false): Promise<CbjRepiPayload | null> {
  if (!force) {
    const hit = await readCache();
    if (hit) return hit;
  }

  try {
    const res = await fetch(CBJ_REPI_URL, {
      headers: { "User-Agent": "AlshantafMarketBot/1.0 (+https://alshantaf.com)" },
      signal: AbortSignal.timeout(45_000),
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`CBJ REPI HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(RAW_FILE, buf);

    const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
    const typeSheet = wb.Sheets[wb.SheetNames[0]!];
    const govSheet = wb.Sheets[wb.SheetNames[1]!];
    if (!typeSheet || !govSheet) throw new Error("Unexpected REPI workbook shape");

    const series = extractTypeSeries(typeSheet);
    const governoratesLatest = extractGovernorates(govSheet);
    if (series.length === 0) throw new Error("No REPI series parsed");

    const payload: CbjRepiPayload = {
      retrievedAt: new Date().toISOString(),
      sourceUrl: CBJ_REPI_URL,
      sourceName: "Central Bank of Jordan & Department of Lands and Survey — Real Estate Price Index",
      frequency: "quarterly",
      baseYear: 2012,
      series,
      governoratesLatest,
    };
    await writeCache(payload);
    return payload;
  } catch (err) {
    console.warn("[land-market] CBJ REPI fetch failed:", err);
    try {
      const raw = await fs.readFile(CACHE_FILE, "utf8");
      return JSON.parse(raw) as CbjRepiPayload;
    } catch {
      /* use packaged official snapshot */
    }
    try {
      // Packaged parse of the official CBJ XLS (same URL) when live download fails.
      const fallbackPath = path.join(__dirname, "../data/cbj-repi-fallback.json");
      const raw = await fs.readFile(fallbackPath, "utf8");
      const fallback = JSON.parse(raw) as CbjRepiPayload;
      return fallback;
    } catch {
      return null;
    }
  }
}

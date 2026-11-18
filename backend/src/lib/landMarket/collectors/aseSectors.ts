/**
 * Amman Stock Exchange — sector index history (public sector_info pages).
 *
 * These are equity-sector indices (and traded value), NOT parcel / land prices.
 * Individual ASE listings are often delayed, thin, or poorly covered by free
 * streaming feeds; we surface official sector aggregates + curated ticker links.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const ASE_BASE = "https://www.ase.com.jo";
const CACHE_DIR = path.join(os.tmpdir(), "alshantaf-market-cache");
const CACHE_FILE = path.join(CACHE_DIR, "ase-sectors.json");
const TTL_MS = 6 * 60 * 60 * 1000;

export type AseDay = {
  date: string; // YYYY-MM-DD
  index: number;
  changePct: number;
  valueTraded: number;
  transactions: number;
  shares: number;
};

export type AseSectorSeries = {
  key: string;
  slug: string;
  labelEn: string;
  labelAr: string;
  url: string;
  points: AseDay[];
};

/** Curated ASE tickers that touch real estate / construction / investment. */
export type AseTickerLink = {
  symbol: string;
  nameEn: string;
  nameAr: string;
  sectorEn: string;
  sectorAr: string;
  /** TradingView ASE symbol when known (equity chart, not land). */
  tradingView?: string;
  aseSearchUrl: string;
};

export type AseMarketPayload = {
  retrievedAt: string;
  sourceName: string;
  sourceNameAr: string;
  sourceUrl: string;
  frequency: "daily";
  disclaimerEn: string;
  disclaimerAr: string;
  sectors: AseSectorSeries[];
  tickers: AseTickerLink[];
};

const SECTORS: Array<{
  key: string;
  slug: string;
  labelEn: string;
  labelAr: string;
}> = [
  {
    key: "ase_general",
    slug: "general-index",
    labelEn: "ASE General Index",
    labelAr: "المؤشر العام لبورصة عمّان",
  },
  {
    key: "ase_real_estate",
    slug: "real-estate",
    labelEn: "ASE Real Estate sector",
    labelAr: "قطاع العقارات — بورصة عمّان",
  },
  {
    key: "ase_construction",
    slug: "engineering-and-construction",
    labelEn: "ASE Engineering & Construction",
    labelAr: "الهندسة والإنشاءات — بورصة عمّان",
  },
  {
    key: "ase_diversified_finance",
    slug: "diversified-financial-services",
    labelEn: "ASE Diversified Financial Services",
    labelAr: "الخدمات المالية المتنوعة — بورصة عمّان",
  },
];

/**
 * Official ASE symbols (from ASE constituents / sector lists).
 * TradingView does not host ASE equities — `tradingView` omitted on purpose.
 */
const TICKERS: AseTickerLink[] = [
  {
    symbol: "JDPC",
    nameEn: "Jordan Decapolis Properties",
    nameAr: "الأردنية ديكابوليس للعقارات",
    sectorEn: "Real estate",
    sectorAr: "عقارات",
    aseSearchUrl: `${ASE_BASE}/en/stock_screener`,
  },
  {
    symbol: "TAJM",
    nameEn: "Al-Tajamouat for Touristic Projects",
    nameAr: "التجمعات للمشاريع السياحية",
    sectorEn: "Real estate / tourism",
    sectorAr: "عقارات / سياحة",
    aseSearchUrl: `${ASE_BASE}/en/stock_screener`,
  },
  {
    symbol: "REAL",
    nameEn: "Arab East Real Estate Investments",
    nameAr: "العربية الشرقية للاستثمارات العقارية",
    sectorEn: "Real estate",
    sectorAr: "عقارات",
    aseSearchUrl: `${ASE_BASE}/en/stock_screener`,
  },
  {
    symbol: "AQAR",
    nameEn: "Real Estate and Investment Portfolio",
    nameAr: "المحفظة العقارية الاستثمارية",
    sectorEn: "Real estate / investment",
    sectorAr: "عقارات / استثمار",
    aseSearchUrl: `${ASE_BASE}/en/stock_screener`,
  },
  {
    symbol: "COHO",
    nameEn: "Contempro for Housing Projects",
    nameAr: "Contempro للمشاريع الإسكانية",
    sectorEn: "Real estate / housing",
    sectorAr: "عقارات / إسكان",
    aseSearchUrl: `${ASE_BASE}/en/stock_screener`,
  },
  {
    symbol: "AMAD",
    nameEn: "Amad Investment & Real Estate Development",
    nameAr: "عماد للاستثمار والتطوير العقاري",
    sectorEn: "Real estate / investment",
    sectorAr: "عقارات / استثمار",
    aseSearchUrl: `${ASE_BASE}/en/stock_screener`,
  },
  {
    symbol: "PROF",
    nameEn: "The Professional Co for Real Estate Investment",
    nameAr: "المحترفون للاستثمار العقاري",
    sectorEn: "Real estate",
    sectorAr: "عقارات",
    aseSearchUrl: `${ASE_BASE}/en/stock_screener`,
  },
  {
    symbol: "JOEP",
    nameEn: "Jordan Electric Power",
    nameAr: "الكهرباء الأردنية",
    sectorEn: "Services (ASE20 constituent)",
    sectorAr: "خدمات (مكون ASE20)",
    aseSearchUrl: `${ASE_BASE}/en/stock_screener`,
  },
];

function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNum(raw: string) {
  const t = raw.replace(/,/g, "").trim();
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(dmy: string) {
  const m = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseSectorTable(html: string): AseDay[] {
  const rowHtml = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]!);
  let seenHeader = false;
  const out: AseDay[] = [];

  for (const row of rowHtml) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      stripTags(m[1] ?? "")
    );
    if (!cells.length) continue;
    if (!seenHeader) {
      if (cells.some((c) => /date|التاريخ/i.test(c))) {
        seenHeader = true;
      }
      continue;
    }
    const date = toIsoDate(cells[0] ?? "");
    if (!date) continue;
    // Date, Value traded, No. of trans, No. of shares, Index, CHG%
    const valueTraded = parseNum(cells[1] ?? "");
    const transactions = parseNum(cells[2] ?? "");
    const shares = parseNum(cells[3] ?? "");
    const index = parseNum(cells[4] ?? "");
    const changePct = parseNum(cells[5] ?? "");
    if (index == null || changePct == null) continue;
    out.push({
      date,
      index,
      changePct,
      valueTraded: valueTraded ?? 0,
      transactions: transactions ?? 0,
      shares: shares ?? 0,
    });
  }

  // Page lists newest first — chronological for charts.
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** ASE lists ~20 rows per page; pull several pages for timeframe controls. */
const ASE_PAGES = 9; // ≈ 180 trading days when available

async function fetchSector(slug: string): Promise<AseDay[]> {
  const byDate = new Map<string, AseDay>();
  for (let page = 0; page < ASE_PAGES; page++) {
    const url = `${ASE_BASE}/en/sector_info/${slug}${page > 0 ? `?page=${page}` : ""}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "AlshantafMarketBot/1.0 (+https://alshantaf.com)" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      if (page === 0) throw new Error(`ASE ${slug} HTTP ${res.status}`);
      break;
    }
    const batch = parseSectorTable(await res.text());
    if (!batch.length) break;
    for (const d of batch) byDate.set(d.date, d);
    // Last page usually shorter; stop early if we got a repeat-only page.
    if (page > 0 && batch.length < 5) break;
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function readCache(): Promise<AseMarketPayload | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as AseMarketPayload & { cachedAt?: string };
    const t = Date.parse(parsed.cachedAt || parsed.retrievedAt);
    if (Date.now() - t < TTL_MS) return parsed;
  } catch {
    /* miss */
  }
  return null;
}

async function writeCache(payload: AseMarketPayload) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(
    CACHE_FILE,
    JSON.stringify({ ...payload, cachedAt: new Date().toISOString() }),
    "utf8"
  );
}

export async function fetchAseMarket(force = false): Promise<AseMarketPayload | null> {
  if (!force) {
    const hit = await readCache();
    if (hit) return hit;
  }

  try {
    const sectors: AseSectorSeries[] = [];
    for (const s of SECTORS) {
      try {
        const points = await fetchSector(s.slug);
        if (!points.length) continue;
        sectors.push({
          key: s.key,
          slug: s.slug,
          labelEn: s.labelEn,
          labelAr: s.labelAr,
          url: `${ASE_BASE}/en/sector_info/${s.slug}`,
          points,
        });
      } catch (err) {
        console.warn(`[land-market] ASE sector ${s.slug} failed:`, err);
      }
    }
    if (!sectors.length) throw new Error("No ASE sectors parsed");

    const payload: AseMarketPayload = {
      retrievedAt: new Date().toISOString(),
      sourceName: "Amman Stock Exchange — sector indices",
      sourceNameAr: "بورصة عمّان — مؤشرات القطاعات",
      sourceUrl: `${ASE_BASE}/en/Quotes-Market/Indices/Main-Indices`,
      frequency: "daily",
      disclaimerEn:
        "ASE figures are equity-sector indices and trading activity — not parcel or land values. Coverage is thin vs major exchanges; many individual symbols are delayed, low-liquidity, or poorly supported for free live streaming (TradingView/ASE feeds).",
      disclaimerAr:
        "أرقام بورصة عمّان مؤشرات قطاعات أسهم ونشاط تداول — وليست قيم قطع أراضٍ. التغطية أضعف من البورصات الكبرى؛ كثير من الرموز متأخر أو قليل السيولة أو غير مدعوم جيداً للبث المجاني المباشر.",
      sectors,
      tickers: TICKERS,
    };
    await writeCache(payload);
    return payload;
  } catch (err) {
    console.warn("[land-market] ASE fetch failed:", err);
    try {
      const raw = await fs.readFile(CACHE_FILE, "utf8");
      return JSON.parse(raw) as AseMarketPayload;
    } catch {
      return null;
    }
  }
}

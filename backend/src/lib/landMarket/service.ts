import { prisma } from "../../prisma";
import { parseAreaSqm, sqmToDunums } from "../areaParse";
import { toWesternDigits } from "../arabicDigits";
import { fetchAseMarket } from "./collectors/aseSectors";
import { fetchCbjRepi } from "./collectors/cbjRepi";
import { fetchDlsOpenDataResources } from "./collectors/openDataCkan";

export type ChartPoint = {
  key: string;
  labelAr: string;
  labelEn: string;
  value: number;
};

export type TrendPoint = {
  key: string;
  labelAr: string;
  labelEn: string;
  value: number;
};

export type Kpi = {
  key: string;
  value: number;
  displayAr: string;
  displayEn: string;
  labelAr: string;
  labelEn: string;
  hintAr?: string;
  hintEn?: string;
};

function parsePricePerSqm(price: string | null | undefined): number | null {
  if (!price) return null;
  const text = toWesternDigits(price).replace(/,/g, "").trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const per = text.match(
    /([\d.]+)\s*(?:دينار|JOD|JD|jd)?\s*(?:\/|لكل|per)?\s*(?:م²|m²|م2|m2|sq\.?\s*m)/i
  );
  if (!per) return null;
  const n = Number(per[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function fmtInt(n: number, lang: "ar" | "en") {
  return n.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO", { maximumFractionDigits: 0 });
}

function fmtMoney(n: number, lang: "ar" | "en") {
  return n.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO", { maximumFractionDigits: 0 });
}

function fmtDunums(sqm: number, lang: "ar" | "en") {
  const d = sqmToDunums(sqm);
  const n = d.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO", {
    maximumFractionDigits: d >= 10 ? 1 : 2,
  });
  return lang === "ar" ? `${n} دونم` : `${n} dunums`;
}

function fmtIndex(n: number, lang: "ar" | "en") {
  return n.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO", { maximumFractionDigits: 1 });
}

function pctChange(curr: number, prev: number | undefined) {
  if (prev == null || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function isMultiParcel(parcel: string | null | undefined): boolean {
  if (!parcel) return false;
  const t = toWesternDigits(parcel);
  if (t.includes(",") || t.includes("،") || t.includes("/") || t.includes("+")) return true;
  const nums = t.match(/\d+/g);
  return Boolean(nums && nums.length >= 2);
}

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  available: { ar: "متاح", en: "Available" },
  reserved: { ar: "محجوز", en: "Reserved" },
  sold: { ar: "مباع", en: "Sold" },
  rented: { ar: "مؤجّر", en: "Rented" },
};

const DEAL_LABELS: Record<string, { ar: string; en: string }> = {
  sale: { ar: "بيع", en: "Sale" },
  rent: { ar: "إيجار", en: "Rent" },
  sale_or_rent: { ar: "بيع أو إيجار", en: "Sale or rent" },
  partnership: { ar: "شراكة", en: "Partnership" },
};

async function platformSlice() {
  const listings = await prisma.listing.findMany({
    where: { publishStatus: "published", status: { notIn: ["canceled"] } },
    select: {
      area: true,
      size: true,
      price: true,
      status: true,
      dealType: true,
      industryType: true,
      parcel: true,
      featured: true,
      viewCount: true,
      createdAt: true,
      updatedAt: true,
      administrativeValue: true,
    },
  });

  const now = new Date();
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const areas = new Map<string, number>();
  const statuses = new Map<string, number>();
  const deals = new Map<string, number>();
  const dlsByArea = new Map<string, number[]>();
  const areasSqm: number[] = [];
  const rates: number[] = [];
  let multiParcel = 0;
  let featured = 0;
  let added30d = 0;
  const dlsRates: number[] = [];

  for (const l of listings) {
    areas.set(l.area, (areas.get(l.area) ?? 0) + 1);
    statuses.set(l.status, (statuses.get(l.status) ?? 0) + 1);
    deals.set(l.dealType, (deals.get(l.dealType) ?? 0) + 1);
    if (l.featured) featured++;
    if (l.createdAt >= day30) added30d++;
    if (isMultiParcel(l.parcel)) multiParcel++;
    const sqm = parseAreaSqm(l.size);
    if (sqm != null) areasSqm.push(sqm);
    const rate = parsePricePerSqm(l.price);
    if (rate != null) rates.push(rate);
    if (l.administrativeValue != null && l.administrativeValue > 0) {
      dlsRates.push(l.administrativeValue);
      const arr = dlsByArea.get(l.area) ?? [];
      arr.push(l.administrativeValue);
      dlsByArea.set(l.area, arr);
    }
  }

  const totalSqm = areasSqm.reduce((a, b) => a + b, 0);
  const medRate = median(rates);
  const medSize = median(areasSqm);
  const medDls = median(dlsRates);

  const kpis: Kpi[] = [];
  if (listings.length > 0) {
    kpis.push({
      key: "published_offers",
      value: listings.length,
      displayAr: fmtInt(listings.length, "ar"),
      displayEn: fmtInt(listings.length, "en"),
      labelAr: "عروض على المنصة",
      labelEn: "Offers on platform",
    });
  }
  const available = statuses.get("available") ?? 0;
  if (available > 0) {
    kpis.push({
      key: "available",
      value: available,
      displayAr: fmtInt(available, "ar"),
      displayEn: fmtInt(available, "en"),
      labelAr: "متاح الآن",
      labelEn: "Available now",
    });
  }
  if (totalSqm > 0) {
    kpis.push({
      key: "total_land",
      value: totalSqm,
      displayAr: fmtDunums(totalSqm, "ar"),
      displayEn: fmtDunums(totalSqm, "en"),
      labelAr: "مساحة معروضة",
      labelEn: "Land listed",
    });
  }
  if (medRate != null) {
    kpis.push({
      key: "median_ask",
      value: medRate,
      displayAr: `${fmtMoney(Math.round(medRate), "ar")} د/م²`,
      displayEn: `${fmtMoney(Math.round(medRate), "en")} JOD/m²`,
      labelAr: "وسيط طلب السعر",
      labelEn: "Median asking / m²",
    });
  }
  if (medSize != null) {
    kpis.push({
      key: "median_size",
      value: medSize,
      displayAr: fmtDunums(medSize, "ar"),
      displayEn: fmtDunums(medSize, "en"),
      labelAr: "وسيط المساحة",
      labelEn: "Median size",
    });
  }
  if (added30d > 0) {
    kpis.push({
      key: "added_30d",
      value: added30d,
      displayAr: fmtInt(added30d, "ar"),
      displayEn: fmtInt(added30d, "en"),
      labelAr: "جديد خلال ٣٠ يوم",
      labelEn: "New in 30 days",
    });
  }
  if (multiParcel > 0) {
    kpis.push({
      key: "multi_parcel",
      value: multiParcel,
      displayAr: fmtInt(multiParcel, "ar"),
      displayEn: fmtInt(multiParcel, "en"),
      labelAr: "متعدد القطع",
      labelEn: "Multi-parcel",
    });
  }
  if (featured > 0) {
    kpis.push({
      key: "featured",
      value: featured,
      displayAr: fmtInt(featured, "ar"),
      displayEn: fmtInt(featured, "en"),
      labelAr: "مميز",
      labelEn: "Featured",
    });
  }

  const byArea: ChartPoint[] = [...areas.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([key, value]) => ({ key, labelAr: key, labelEn: key, value }));

  const byStatus: ChartPoint[] = [...statuses.entries()]
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      key,
      labelAr: STATUS_LABELS[key]?.ar ?? key,
      labelEn: STATUS_LABELS[key]?.en ?? key,
      value,
    }));

  const byDeal: ChartPoint[] = [...deals.entries()]
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      key,
      labelAr: DEAL_LABELS[key]?.ar ?? key,
      labelEn: DEAL_LABELS[key]?.en ?? key,
      value,
    }));

  const dlsKpis: Kpi[] = [];
  if (medDls != null) {
    dlsKpis.push({
      key: "dls_median_rate",
      value: medDls,
      displayAr: `${fmtMoney(Math.round(medDls), "ar")} د/م²`,
      displayEn: `${fmtMoney(Math.round(medDls), "en")} JOD/m²`,
      labelAr: "وسيط القيمة الإدارية (دائرة الأراضي)",
      labelEn: "Median DLS administrative rate",
      hintAr: "من أداة القيمة الإدارية الرسمية لدائرة الأراضي والمساحة",
      hintEn: "From the official DLS administrative-value service",
    });
  }
  if (dlsRates.length > 0) {
    dlsKpis.push({
      key: "dls_samples",
      value: dlsRates.length,
      displayAr: fmtInt(dlsRates.length, "ar"),
      displayEn: fmtInt(dlsRates.length, "en"),
      labelAr: "قطع بقيمة إدارية موثّقة",
      labelEn: "Parcels with DLS rate",
    });
  }

  const dlsByAreaChart: ChartPoint[] = [...dlsByArea.entries()]
    .map(([area, vals]) => {
      const m = median(vals);
      return m == null
        ? null
        : { key: area, labelAr: area, labelEn: area, value: Math.round(m * 10) / 10 };
    })
    .filter((p): p is ChartPoint => Boolean(p))
    .sort((a, b) => b.value - a.value);

  const monthMap = new Map<string, number>();
  for (const l of listings) {
    const key = `${l.createdAt.getUTCFullYear()}-${String(l.createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
  }
  const listingsByMonth = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ key, labelAr: key, labelEn: key, value }));

  const latestUpdate =
    listings.reduce<Date | null>((acc, l) => (!acc || l.updatedAt > acc ? l.updatedAt : acc), null) ??
    now;

  return {
    updatedAt: latestUpdate.toISOString(),
    offerCount: listings.length,
    kpis,
    charts: { byArea, byStatus, byDeal, listingsByMonth },
    dls: { kpis: dlsKpis, byArea: dlsByAreaChart },
  };
}

function nationalFromRepi(repi: NonNullable<Awaited<ReturnType<typeof fetchCbjRepi>>>) {
  const pick = (key: string) => repi.series.find((s) => s.key === key);
  const lands = pick("lands");
  const industrial = pick("lands_industrial");
  const general = pick("general");
  const residential = pick("residential");

  const kpis: Kpi[] = [];
  const addIndexKpi = (
    key: string,
    series: typeof lands,
    labelAr: string,
    labelEn: string
  ) => {
    if (!series?.points.length) return;
    const last = series.points[series.points.length - 1]!;
    const prev = series.points[series.points.length - 2];
    const chg = pctChange(last.value, prev?.value);
    kpis.push({
      key,
      value: last.value,
      displayAr: fmtIndex(last.value, "ar"),
      displayEn: fmtIndex(last.value, "en"),
      labelAr,
      labelEn,
      hintAr: `أحدث فترة رسمية: ${last.period}${chg != null ? ` · تغيّر ${chg > 0 ? "+" : ""}${chg}%` : ""} · أساس 2012=100`,
      hintEn: `Latest official: ${last.period}${chg != null ? ` · ${chg > 0 ? "+" : ""}${chg}% vs prior` : ""} · base 2012=100`,
    });
  };

  addIndexKpi("repi_lands", lands, "مؤشر أسعار الأراضي", "Land index");
  addIndexKpi("repi_industrial_land", industrial, "مؤشر الأراضي الصناعية", "Industrial land index");
  addIndexKpi("repi_general", general, "المؤشر العقاري العام", "General real-estate index");

  const latestByType: ChartPoint[] = repi.series
    .map((s) => {
      const last = s.points[s.points.length - 1];
      if (!last) return null;
      return { key: s.key, labelAr: s.labelAr, labelEn: s.labelEn, value: last.value };
    })
    .filter((p): p is ChartPoint => Boolean(p))
    .sort((a, b) => b.value - a.value);

  /** ~5 years of quarterly REPI (4×5). Latest available bulletin may end earlier. */
  const FIVE_Y_QUARTERS = 20;

  const toTrend = (s: NonNullable<typeof lands>, n = FIVE_Y_QUARTERS): TrendPoint[] =>
    s.points.slice(-n).map((p) => ({
      key: p.period,
      labelAr: p.period,
      labelEn: p.period,
      value: p.value,
    }));

  const yearlyAvg = (s: NonNullable<typeof lands> | undefined): TrendPoint[] => {
    if (!s?.points.length) return [];
    const window = s.points.slice(-FIVE_Y_QUARTERS);
    const byYear = new Map<string, number[]>();
    for (const p of window) {
      const y = p.period.slice(0, 4);
      const arr = byYear.get(y) ?? [];
      arr.push(p.value);
      byYear.set(y, arr);
    }
    return [...byYear.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, vals]) => {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return {
          key: year,
          labelAr: year,
          labelEn: year,
          value: Math.round(avg * 10) / 10,
        };
      });
  };

  const fiveYearChange = (s: NonNullable<typeof lands> | undefined) => {
    if (!s?.points.length) return null;
    const window = s.points.slice(-FIVE_Y_QUARTERS);
    const first = window[0];
    const last = window[window.length - 1];
    if (!first || !last || first.value === 0) return null;
    return {
      from: first.period,
      to: last.period,
      pct: Math.round(((last.value - first.value) / first.value) * 1000) / 10,
      fromValue: first.value,
      toValue: last.value,
    };
  };

  const landsRes = pick("lands_residential");
  const landsCom = pick("lands_commercial");
  const commercial = pick("commercial");
  const nonResidential = pick("non_residential");

  const landsTrend = lands ? toTrend(lands) : [];
  const industrialTrend = industrial ? toTrend(industrial) : [];
  const generalTrend = general ? toTrend(general) : [];
  const residentialTrend = residential ? toTrend(residential) : [];
  const landsResidentialTrend = landsRes ? toTrend(landsRes) : [];
  const landsCommercialTrend = landsCom ? toTrend(landsCom) : [];
  const commercialTrend = commercial ? toTrend(commercial) : [];
  const nonResidentialTrend = nonResidential ? toTrend(nonResidential) : [];
  const landsYearly = yearlyAvg(lands);
  const industrialYearly = yearlyAvg(industrial);
  const generalYearly = yearlyAvg(general);

  const lands5y = fiveYearChange(lands);
  if (lands5y) {
    kpis.push({
      key: "repi_lands_5y",
      value: lands5y.pct,
      displayAr: `${lands5y.pct > 0 ? "+" : ""}${lands5y.pct}%`,
      displayEn: `${lands5y.pct > 0 ? "+" : ""}${lands5y.pct}%`,
      labelAr: "تغيّر مؤشر الأراضي (٥ سنوات)",
      labelEn: "Land index change (5 years)",
      hintAr: `${lands5y.from} ← ${lands5y.to} · من ${fmtIndex(lands5y.fromValue, "ar")} إلى ${fmtIndex(lands5y.toValue, "ar")}`,
      hintEn: `${lands5y.from} → ${lands5y.to} · ${fmtIndex(lands5y.fromValue, "en")} to ${fmtIndex(lands5y.toValue, "en")}`,
    });
  }

  const byGovernorate: ChartPoint[] = repi.governoratesLatest.map((g) => ({
    key: g.key,
    labelAr: g.labelAr,
    labelEn: g.labelEn,
    value: g.value,
  }));

  const govQoqChange: ChartPoint[] = repi.governoratesLatest
    .filter((g) => g.changePct != null)
    .map((g) => ({
      key: g.key,
      labelAr: g.labelAr,
      labelEn: g.labelEn,
      value: g.changePct as number,
    }))
    .sort((a, b) => b.value - a.value);

  const qoqByType: ChartPoint[] = repi.series
    .map((s) => {
      if (s.points.length < 2) return null;
      const last = s.points[s.points.length - 1]!;
      const prev = s.points[s.points.length - 2]!;
      const chg = pctChange(last.value, prev.value);
      if (chg == null) return null;
      return { key: s.key, labelAr: s.labelAr, labelEn: s.labelEn, value: chg };
    })
    .filter((p): p is ChartPoint => Boolean(p))
    .sort((a, b) => b.value - a.value);

  const landsBreakdown: ChartPoint[] = [
    landsRes,
    landsCom,
    industrial,
    pick("lands_unregulated"),
  ]
    .map((s) => {
      if (!s?.points.length) return null;
      const last = s.points[s.points.length - 1]!;
      return { key: s.key, labelAr: s.labelAr, labelEn: s.labelEn, value: last.value };
    })
    .filter((p): p is ChartPoint => Boolean(p))
    .sort((a, b) => b.value - a.value);

  const coveragePeriod =
    lands?.points.at(-1)?.period ??
    general?.points.at(-1)?.period ??
    repi.governoratesLatest[0]?.period ??
    null;

  return {
    source: {
      name: repi.sourceName,
      nameAr: "البنك المركزي الأردني ودائرة الأراضي والمساحة — الرقم القياسي لأسعار الأصول العقارية",
      url: repi.sourceUrl,
      retrievedAt: repi.retrievedAt,
      frequency: repi.frequency,
      baseYear: repi.baseYear,
      period: coveragePeriod ?? null,
    },
    kpis,
    charts: {
      latestByType,
      landsTrend,
      industrialTrend,
      generalTrend,
      residentialTrend,
      landsResidentialTrend,
      landsCommercialTrend,
      commercialTrend,
      nonResidentialTrend,
      landsYearly,
      industrialYearly,
      generalYearly,
      byGovernorate,
      govQoqChange,
      qoqByType,
      landsBreakdown,
    },
    window: {
      quarters: FIVE_Y_QUARTERS,
      labelEn: "Last 5 years of available quarterly REPI",
      labelAr: "آخر ٥ سنوات متاحة من المؤشر الربعي",
    },
  };
}

function aseFromMarket(ase: NonNullable<Awaited<ReturnType<typeof fetchAseMarket>>>) {
  const toTrend = (points: { date: string; index: number }[]): TrendPoint[] =>
    points.map((p) => ({
      key: p.date,
      labelAr: p.date,
      labelEn: p.date,
      value: p.index,
    }));

  const pick = (key: string) => ase.sectors.find((s) => s.key === key);
  const re = pick("ase_real_estate");
  const cons = pick("ase_construction");
  const gen = pick("ase_general");
  const fin = pick("ase_diversified_finance");

  const kpis: Kpi[] = [];
  const add = (series: typeof re, key: string, labelAr: string, labelEn: string) => {
    if (!series?.points.length) return;
    const last = series.points[series.points.length - 1]!;
    kpis.push({
      key,
      value: last.index,
      displayAr: fmtInt(Math.round(last.index), "ar"),
      displayEn: fmtInt(Math.round(last.index), "en"),
      labelAr,
      labelEn,
      hintAr: `${last.date} · تغيّر ${last.changePct > 0 ? "+" : ""}${last.changePct}% · أسهم وليس أراضي`,
      hintEn: `${last.date} · ${last.changePct > 0 ? "+" : ""}${last.changePct}% · equities, not land`,
    });
  };
  add(re, "ase_re_index", "مؤشر قطاع العقارات (بورصة)", "ASE real-estate sector index");
  add(cons, "ase_cons_index", "مؤشر الهندسة والإنشاءات", "ASE construction sector index");
  add(gen, "ase_general_index", "المؤشر العام لبورصة عمّان", "ASE general index");

  const latestLevels: ChartPoint[] = ase.sectors
    .map((s) => {
      const last = s.points[s.points.length - 1];
      if (!last) return null;
      return { key: s.key, labelAr: s.labelAr, labelEn: s.labelEn, value: last.index };
    })
    .filter((p): p is ChartPoint => Boolean(p))
    .sort((a, b) => b.value - a.value);

  const valueTraded: ChartPoint[] = (re?.points ?? [])
    .slice(-10)
    .map((p) => ({
      key: p.date,
      labelAr: p.date.slice(5),
      labelEn: p.date.slice(5),
      value: Math.round(p.valueTraded),
    }));

  return {
    source: {
      name: ase.sourceName,
      nameAr: ase.sourceNameAr,
      url: ase.sourceUrl,
      retrievedAt: ase.retrievedAt,
      frequency: ase.frequency,
      disclaimerEn: ase.disclaimerEn,
      disclaimerAr: ase.disclaimerAr,
    },
    kpis,
    charts: {
      realEstateTrend: re ? toTrend(re.points) : [],
      constructionTrend: cons ? toTrend(cons.points) : [],
      generalTrend: gen ? toTrend(gen.points) : [],
      financeTrend: fin ? toTrend(fin.points) : [],
      latestLevels,
      realEstateValueTraded: valueTraded,
    },
    tickers: ase.tickers,
  };
}

function emptyPlatformSlice() {
  return {
    updatedAt: new Date().toISOString(),
    offerCount: 0,
    kpis: [] as Kpi[],
    charts: {
      byArea: [] as ChartPoint[],
      byStatus: [] as ChartPoint[],
      byDeal: [] as ChartPoint[],
      listingsByMonth: [] as ChartPoint[],
    },
    dls: { kpis: [] as Kpi[], byArea: [] as ChartPoint[] },
  };
}

/** National Jordan land market + official DLS rates + platform activity. */
export async function getLandMarketSnapshot() {
  const settled = await Promise.allSettled([
    fetchCbjRepi(),
    fetchDlsOpenDataResources(),
    platformSlice(),
    fetchAseMarket(),
  ]);

  const repi = settled[0].status === "fulfilled" ? settled[0].value : null;
  const openData = settled[1].status === "fulfilled" ? settled[1].value : [];
  const platform =
    settled[2].status === "fulfilled" ? settled[2].value : emptyPlatformSlice();
  const aseRaw = settled[3].status === "fulfilled" ? settled[3].value : null;

  for (const [i, result] of settled.entries()) {
    if (result.status === "rejected") {
      console.warn(`[land-market] snapshot source ${i} failed:`, result.reason);
    }
  }

  const national = repi ? nationalFromRepi(repi) : null;
  const ase = aseRaw ? aseFromMarket(aseRaw) : null;

  const sources = [
    ...(national
      ? [
          {
            key: "cbj_dls_repi",
            name: national.source.name,
            nameAr: national.source.nameAr,
            url: national.source.url,
            kind: "official_index" as const,
            frequency: national.source.frequency,
            retrievedAt: national.source.retrievedAt,
            period: national.source.period,
          },
        ]
      : []),
    ...(ase
      ? [
          {
            key: "ase_sectors",
            name: ase.source.name,
            nameAr: ase.source.nameAr,
            url: ase.source.url,
            kind: "equity_index" as const,
            frequency: ase.source.frequency,
            retrievedAt: ase.source.retrievedAt,
            period: ase.charts.realEstateTrend.at(-1)?.key ?? null,
          },
        ]
      : []),
    {
      key: "dls_admin_value",
      name: "Department of Lands and Survey — Administrative Value",
      nameAr: "دائرة الأراضي والمساحة — القيمة الإدارية",
      url: "https://apex-dls.dls.gov.jo/ords/f?p=104:2",
      kind: "official_rate" as const,
      frequency: "on_demand",
      retrievedAt: platform.updatedAt,
      period: null as string | null,
    },
    ...openData.slice(0, 6).map((r) => ({
      key: r.packageName,
      name: r.title,
      nameAr: r.titleAr || r.title,
      url: r.url,
      kind: "open_data" as const,
      frequency: r.format,
      retrievedAt: r.lastModified,
      period: null as string | null,
    })),
  ];

  const updatedAt = [
    national?.source.retrievedAt,
    ase?.source.retrievedAt,
    platform.updatedAt,
  ]
    .filter(Boolean)
    .sort()
    .at(-1) as string;

  return {
    kind: "land_parcels" as const,
    updatedAt,
    generatedAt: new Date().toISOString(),
    national,
    ase,
    dlsRates: platform.dls,
    platform: {
      offerCount: platform.offerCount,
      updatedAt: platform.updatedAt,
      kpis: platform.kpis,
      charts: platform.charts,
    },
    sources,
    // backwards-compatible top-level fields for older UI
    offerCount: platform.offerCount,
    kpis: [...(national?.kpis ?? []), ...platform.dls.kpis, ...platform.kpis].slice(0, 10),
    charts: {
      byArea: platform.charts.byArea,
      byStatus: platform.charts.byStatus,
      byDeal: platform.charts.byDeal,
      byIndustry: [] as ChartPoint[],
      priceByArea: platform.dls.byArea,
      listingsByMonth: platform.charts.listingsByMonth,
      latestByType: national?.charts.latestByType ?? [],
      landsTrend: national?.charts.landsTrend ?? [],
      industrialTrend: national?.charts.industrialTrend ?? [],
      generalTrend: national?.charts.generalTrend ?? [],
      residentialTrend: national?.charts.residentialTrend ?? [],
      landsResidentialTrend: national?.charts.landsResidentialTrend ?? [],
      landsCommercialTrend: national?.charts.landsCommercialTrend ?? [],
      commercialTrend: national?.charts.commercialTrend ?? [],
      nonResidentialTrend: national?.charts.nonResidentialTrend ?? [],
      landsYearly: national?.charts.landsYearly ?? [],
      industrialYearly: national?.charts.industrialYearly ?? [],
      generalYearly: national?.charts.generalYearly ?? [],
      byGovernorate: national?.charts.byGovernorate ?? [],
      govQoqChange: national?.charts.govQoqChange ?? [],
      qoqByType: national?.charts.qoqByType ?? [],
      landsBreakdown: national?.charts.landsBreakdown ?? [],
    },
  };
}

export type LandMarketSnapshot = Awaited<ReturnType<typeof getLandMarketSnapshot>>;

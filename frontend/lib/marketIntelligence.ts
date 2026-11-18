export type LandChartPoint = {
  key: string;
  labelAr: string;
  labelEn: string;
  value: number;
};

export type LandKpi = {
  key: string;
  value: number;
  displayAr: string;
  displayEn: string;
  labelAr: string;
  labelEn: string;
  hintAr?: string;
  hintEn?: string;
};

export type LandSource = {
  key: string;
  name: string;
  nameAr?: string;
  url: string;
  kind: string;
  frequency: string;
  retrievedAt: string | null;
  period: string | null;
};

export type LandMarketSnapshot = {
  kind: "land_parcels";
  updatedAt: string;
  generatedAt: string;
  offerCount: number;
  national: {
    source: {
      name: string;
      nameAr: string;
      url: string;
      retrievedAt: string;
      frequency: string;
      baseYear: number;
      period: string | null;
    };
    kpis: LandKpi[];
    charts: {
      latestByType: LandChartPoint[];
      landsTrend: LandChartPoint[];
      industrialTrend: LandChartPoint[];
      generalTrend: LandChartPoint[];
      residentialTrend: LandChartPoint[];
      landsResidentialTrend: LandChartPoint[];
      landsCommercialTrend: LandChartPoint[];
      commercialTrend: LandChartPoint[];
      nonResidentialTrend: LandChartPoint[];
      landsYearly: LandChartPoint[];
      industrialYearly: LandChartPoint[];
      generalYearly: LandChartPoint[];
      byGovernorate: LandChartPoint[];
      govQoqChange: LandChartPoint[];
      qoqByType: LandChartPoint[];
      landsBreakdown: LandChartPoint[];
    };
    window?: {
      quarters: number;
      labelEn: string;
      labelAr: string;
    };
  } | null;
  ase: {
    source: {
      name: string;
      nameAr: string;
      url: string;
      retrievedAt: string;
      frequency: string;
      disclaimerEn: string;
      disclaimerAr: string;
    };
    kpis: LandKpi[];
    charts: {
      realEstateTrend: LandChartPoint[];
      constructionTrend: LandChartPoint[];
      generalTrend: LandChartPoint[];
      financeTrend: LandChartPoint[];
      latestLevels: LandChartPoint[];
      realEstateValueTraded: LandChartPoint[];
    };
    tickers: Array<{
      symbol: string;
      nameEn: string;
      nameAr: string;
      sectorEn: string;
      sectorAr: string;
      tradingView?: string;
      aseSearchUrl: string;
    }>;
  } | null;
  dlsRates: {
    kpis: LandKpi[];
    byArea: LandChartPoint[];
  };
  platform: {
    offerCount: number;
    updatedAt: string;
    kpis: LandKpi[];
    charts: {
      byArea: LandChartPoint[];
      byStatus: LandChartPoint[];
      byDeal: LandChartPoint[];
      listingsByMonth: LandChartPoint[];
    };
  };
  sources: LandSource[];
  kpis: LandKpi[];
  charts: {
    byArea: LandChartPoint[];
    byStatus: LandChartPoint[];
    byDeal: LandChartPoint[];
    byIndustry: LandChartPoint[];
    priceByArea: LandChartPoint[];
    listingsByMonth: LandChartPoint[];
    latestByType: LandChartPoint[];
    landsTrend: LandChartPoint[];
    industrialTrend: LandChartPoint[];
    generalTrend: LandChartPoint[];
    residentialTrend: LandChartPoint[];
    landsResidentialTrend: LandChartPoint[];
    landsCommercialTrend: LandChartPoint[];
    commercialTrend: LandChartPoint[];
    nonResidentialTrend: LandChartPoint[];
    landsYearly: LandChartPoint[];
    industrialYearly: LandChartPoint[];
    generalYearly: LandChartPoint[];
    byGovernorate: LandChartPoint[];
    govQoqChange: LandChartPoint[];
    qoqByType: LandChartPoint[];
    landsBreakdown: LandChartPoint[];
  };
};

const CLIENT_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

function serverBase() {
  return `${process.env.BACKEND_INTERNAL_URL || "http://localhost:4000"}/api`;
}

function isLandMarketSnapshot(data: unknown): data is LandMarketSnapshot {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (typeof d.updatedAt !== "string" || typeof d.offerCount !== "number") return false;

  const platform = d.platform;
  if (!platform || typeof platform !== "object") return false;
  const p = platform as Record<string, unknown>;
  if (typeof p.offerCount !== "number" || !p.charts || typeof p.charts !== "object") return false;

  const dls = d.dlsRates;
  if (!dls || typeof dls !== "object") return false;
  const dr = dls as Record<string, unknown>;
  if (!Array.isArray(dr.kpis) || !Array.isArray(dr.byArea)) return false;

  // Reject legacy credit-market payloads that lack land fields.
  if (d.kind != null && d.kind !== "land_parcels") return false;
  return true;
}

export async function fetchMarketSnapshotServer(): Promise<LandMarketSnapshot | null> {
  try {
    const res = await fetch(`${serverBase()}/market-intelligence/snapshot`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return isLandMarketSnapshot(data) ? data : null;
  } catch {
    return null;
  }
}

export function chartLabel(p: LandChartPoint, lang: "ar" | "en") {
  return lang === "ar" ? p.labelAr : p.labelEn;
}

export function kpiLabel(k: LandKpi, lang: "ar" | "en") {
  return lang === "ar" ? k.labelAr : k.labelEn;
}

export function kpiDisplay(k: LandKpi, lang: "ar" | "en") {
  return lang === "ar" ? k.displayAr : k.displayEn;
}

export function kpiHint(k: LandKpi, lang: "ar" | "en") {
  return lang === "ar" ? k.hintAr : k.hintEn;
}

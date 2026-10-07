export type MarketMetric = {
  metricKey: string;
  metricName: string;
  category: string;
  value: number | null;
  displayValue: string;
  unit: string;
  currency: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  periodLabel: string;
  frequency: string | null;
  status: string;
  freshness: string;
  isEstimate: boolean;
  isCalculated: boolean;
  confidence: string | null;
  previousValue: number | null;
  changePercent: number | null;
  source: {
    key: string;
    name: string;
    tier: number;
    url: string;
    reliability: string;
  } | null;
  sourceUrl: string | null;
  retrievedAt: string | null;
  sourcePublishedAt: string | null;
  notes: string | null;
  sparkline: Array<{ periodEnd: string; value: number }>;
  available: boolean;
};

export type MarketSnapshot = {
  title: string;
  subtitle: string;
  honestyNote: string;
  lastRefresh: string | null;
  indicatorCount: number;
  trackedIndicatorCount: number;
  sourceCount: number;
  coverage: string;
  metrics: MarketMetric[];
  pulse: MarketMetric[];
  sources: Array<{
    key: string;
    name: string;
    tier: number;
    url: string;
    sourceType: string;
    updateFrequency: string;
    reliability: string;
    lastChecked: string | null;
    lastSuccessAt: string | null;
    notes: string | null;
  }>;
};

export type MarketSeries = {
  metricKey: string;
  range: string;
  points: Array<{
    date: string;
    value: number;
    displayValue: string;
    changePercent: number | null;
    source: string;
    sourceUrl: string;
    status: string;
    isEstimate: boolean;
  }>;
};

const CLIENT_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

function serverBase() {
  return `${process.env.BACKEND_INTERNAL_URL || "http://localhost:4000"}/api`;
}

export async function fetchMarketSnapshotServer(): Promise<MarketSnapshot | null> {
  try {
    const res = await fetch(`${serverBase()}/market-intelligence/snapshot`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchMarketSnapshotClient(): Promise<MarketSnapshot> {
  const res = await fetch(`${CLIENT_BASE}/market-intelligence/snapshot`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load market snapshot");
  return res.json();
}

export async function fetchMarketSeries(metricKey: string, range: string): Promise<MarketSeries> {
  const res = await fetch(
    `${CLIENT_BASE}/market-intelligence/series/${encodeURIComponent(metricKey)}?range=${encodeURIComponent(range)}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error("Failed to load series");
  return res.json();
}

export function freshnessLabel(m: MarketMetric, lang: "ar" | "en"): string {
  if (!m.available) return lang === "ar" ? "غير متاح" : "Unavailable";
  if (m.freshness === "estimate" || m.isEstimate) return lang === "ar" ? "تقدير سوقي" : "Market estimate";
  if (m.freshness === "annual") return lang === "ar" ? `بيانات سنوية — ${m.periodLabel}` : `Annual — ${m.periodLabel}`;
  if (m.freshness === "recent_monthly")
    return lang === "ar" ? `أحدث منشور: ${m.periodLabel}` : `Latest available: ${m.periodLabel}`;
  return lang === "ar" ? `أحدث متاح: ${m.periodLabel}` : `Latest available: ${m.periodLabel}`;
}

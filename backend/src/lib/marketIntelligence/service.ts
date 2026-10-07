import { prisma } from "../../prisma";

const SNAPSHOT_KEYS = [
  "total_credit_facilities",
  "private_sector_credit_resident",
  "private_sector_credit_total",
  "public_sector_credit",
  "credit_growth_rate",
  "cbj_main_rate",
  "rediscount_rate",
  "overdraft_interest_rate",
] as const;

const PULSE_KEYS = [
  "credit_growth_rate",
  "total_credit_facilities",
  "private_sector_credit_resident",
  "private_sector_credit_total",
  "cbj_main_rate",
  "overdraft_interest_rate",
] as const;

export type MetricDto = {
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

function formatDisplay(value: number, unit: string): string {
  if (unit === "percent") return `${value.toLocaleString("en-JO", { maximumFractionDigits: 2 })}%`;
  if (unit === "JOD_million") {
    if (value >= 1000) {
      const b = value / 1000;
      return `JOD ${b.toLocaleString("en-JO", { maximumFractionDigits: 2 })}B`;
    }
    return `JOD ${value.toLocaleString("en-JO", { maximumFractionDigits: 1 })}M`;
  }
  return value.toLocaleString("en-JO");
}

function periodLabel(end: Date, frequency: string): string {
  const y = end.getUTCFullYear();
  const m = end.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  if (frequency === "semi_annual") {
    const half = end.getUTCMonth() <= 5 ? "H1" : "H2";
    return `${half} ${y}`;
  }
  if (frequency === "annual") return String(y);
  if (frequency === "quarterly") {
    const q = Math.floor(end.getUTCMonth() / 3) + 1;
    return `Q${q} ${y}`;
  }
  return `${m} ${y}`;
}

function freshnessBadge(m: {
  periodEnd: Date;
  frequency: string;
  isEstimate: boolean;
  status: string;
}): string {
  if (m.isEstimate || m.status === "estimated") return "estimate";
  const days = (Date.now() - m.periodEnd.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 45 && m.frequency === "monthly") return "recent_monthly";
  if (m.frequency === "annual") return "annual";
  return "latest_available";
}

async function seriesFor(metricKey: string, take = 24) {
  return prisma.marketMetric.findMany({
    where: { metricKey },
    orderBy: { periodEnd: "asc" },
    take,
    select: { periodEnd: true, value: true },
  });
}

async function latestFor(metricKey: string) {
  return prisma.marketMetric.findFirst({
    where: { metricKey },
    orderBy: { periodEnd: "desc" },
    include: { source: true },
  });
}

function toDto(
  row: Awaited<ReturnType<typeof latestFor>>,
  sparkline: Array<{ periodEnd: Date; value: number }>,
  fallbackName: string,
  category: string
): MetricDto {
  if (!row) {
    return {
      metricKey: fallbackName,
      metricName: fallbackName,
      category,
      value: null,
      displayValue: "N/A",
      unit: "",
      currency: null,
      periodStart: null,
      periodEnd: null,
      periodLabel: "Not available from tracked sources",
      frequency: null,
      status: "unavailable",
      freshness: "unavailable",
      isEstimate: false,
      isCalculated: false,
      confidence: null,
      previousValue: null,
      changePercent: null,
      source: null,
      sourceUrl: null,
      retrievedAt: null,
      sourcePublishedAt: null,
      notes: "No verified observation ingested for this indicator yet.",
      sparkline: [],
      available: false,
    };
  }

  return {
    metricKey: row.metricKey,
    metricName: row.metricName,
    category: row.category,
    value: row.value,
    displayValue: formatDisplay(row.value, row.unit),
    unit: row.unit,
    currency: row.currency,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    periodLabel: periodLabel(row.periodEnd, row.frequency),
    frequency: row.frequency,
    status: row.status,
    freshness: freshnessBadge(row),
    isEstimate: row.isEstimate,
    isCalculated: row.isCalculated,
    confidence: row.confidence,
    previousValue: row.previousValue,
    changePercent: row.changePercent,
    source: {
      key: row.source.key,
      name: row.source.name,
      tier: row.source.tier,
      url: row.source.url,
      reliability: row.source.reliability,
    },
    sourceUrl: row.sourceUrl,
    retrievedAt: row.retrievedAt.toISOString(),
    sourcePublishedAt: row.sourcePublishedAt?.toISOString() ?? null,
    notes: row.notes,
    sparkline: sparkline.map((p) => ({
      periodEnd: p.periodEnd.toISOString().slice(0, 10),
      value: p.value,
    })),
    available: true,
  };
}

const NAME_HINTS: Record<string, { name: string; category: string }> = {
  total_credit_facilities: { name: "Total credit facilities", category: "banking_credit" },
  private_sector_credit_resident: { name: "Private-sector credit (resident)", category: "banking_credit" },
  private_sector_credit_total: { name: "Private-sector credit (total)", category: "banking_credit" },
  public_sector_credit: { name: "Public-sector credit", category: "banking_credit" },
  credit_growth_rate: { name: "Credit growth", category: "calculated" },
  cbj_main_rate: { name: "CBJ main policy rate", category: "lending_conditions" },
  rediscount_rate: { name: "Re-discount rate", category: "lending_conditions" },
  overdraft_interest_rate: { name: "Overdraft interest rate", category: "lending_conditions" },
  sme_credit: { name: "SME credit", category: "sme" },
  consumer_credit: { name: "Consumer / household credit", category: "banking_credit" },
  corporate_credit: { name: "Corporate credit", category: "banking_credit" },
  microfinance_portfolio: { name: "Microfinance portfolio", category: "microfinance" },
  new_credit_requested: { name: "New credit requested", category: "financing_demand" },
  new_credit_approved: { name: "New credit approved", category: "financing_demand" },
  credit_applications: { name: "Credit applications", category: "financing_demand" },
  approved_applications: { name: "Approved applications", category: "financing_demand" },
  rejected_applications: { name: "Rejected applications", category: "financing_demand" },
  approval_rate: { name: "Approval rate", category: "calculated" },
  digital_lending_estimate: { name: "Digital lending (market estimate)", category: "digital_lending" },
};

export async function getMetricDto(metricKey: string): Promise<MetricDto> {
  const [latest, spark] = await Promise.all([latestFor(metricKey), seriesFor(metricKey)]);
  const hint = NAME_HINTS[metricKey] ?? { name: metricKey, category: "other" };
  const dto = toDto(latest, spark, hint.name, hint.category);
  if (!latest) dto.metricKey = metricKey;
  return dto;
}

export async function getMarketSnapshot() {
  const keys = [
    ...SNAPSHOT_KEYS,
    "sme_credit",
    "consumer_credit",
    "corporate_credit",
    "microfinance_portfolio",
    "new_credit_requested",
    "new_credit_approved",
    "credit_applications",
    "approved_applications",
    "rejected_applications",
    "approval_rate",
    "digital_lending_estimate",
  ];
  const metrics = await Promise.all(keys.map((k) => getMetricDto(k)));
  const sources = await prisma.marketSource.findMany({ orderBy: [{ tier: "asc" }, { name: "asc" }] });
  const available = metrics.filter((m) => m.available);
  const lastRefresh = available
    .map((m) => m.retrievedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    title: "Jordan Lending Market — Live Intelligence",
    subtitle: "Real-time market indicators, credit activity, financing demand and investment signals across Jordan.",
    honestyNote:
      "Values are latest-available official or cited observations — not intraday ticks. Unavailable indicators show N/A.",
    lastRefresh,
    indicatorCount: available.length,
    trackedIndicatorCount: keys.length,
    sourceCount: sources.length,
    coverage:
      available.length > 0
        ? `${available.map((m) => m.periodEnd).filter(Boolean).sort()[0]?.slice(0, 4) ?? "—"}–${available
            .map((m) => m.periodEnd)
            .filter(Boolean)
            .sort()
            .at(-1)
            ?.slice(0, 7) ?? "—"}`
        : "—",
    metrics,
    pulse: await Promise.all(PULSE_KEYS.map((k) => getMetricDto(k))),
    sources: sources.map((s) => ({
      key: s.key,
      name: s.name,
      tier: s.tier,
      url: s.url,
      sourceType: s.sourceType,
      updateFrequency: s.updateFrequency,
      reliability: s.reliability,
      lastChecked: s.lastChecked?.toISOString() ?? null,
      lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null,
      notes: s.notes,
    })),
  };
}

export async function getMarketSeries(metricKey: string, range: string) {
  const now = Date.now();
  const months: Record<string, number> = {
    "1m": 1,
    "3m": 3,
    "6m": 6,
    "1y": 12,
    "3y": 36,
    "5y": 60,
    max: 600,
  };
  const span = months[range] ?? 36;
  const since = new Date(now - span * 30 * 24 * 60 * 60 * 1000);
  const rows = await prisma.marketMetric.findMany({
    where: {
      metricKey,
      ...(range === "max" ? {} : { periodEnd: { gte: since } }),
    },
    orderBy: { periodEnd: "asc" },
    include: { source: true },
  });

  return {
    metricKey,
    range,
    points: rows.map((r, i) => {
      const prev = i > 0 ? rows[i - 1]!.value : r.previousValue;
      const chg = prev != null && prev !== 0 ? Math.round(((r.value - prev) / prev) * 1000) / 10 : null;
      return {
        date: r.periodEnd.toISOString().slice(0, 10),
        value: r.value,
        displayValue: formatDisplay(r.value, r.unit),
        changePercent: chg,
        source: r.source.name,
        sourceUrl: r.sourceUrl,
        status: r.status,
        isEstimate: r.isEstimate,
      };
    }),
  };
}

export async function getMarketCatalog() {
  const keys = await prisma.marketMetric.findMany({
    distinct: ["metricKey"],
    select: { metricKey: true, metricName: true, category: true },
    orderBy: { metricKey: "asc" },
  });
  return keys;
}

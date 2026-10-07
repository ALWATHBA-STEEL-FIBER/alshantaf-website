import { prisma } from "../../prisma";
import { MARKET_METRICS, MARKET_SOURCES } from "./seedData";
import { validateObservation } from "./validate";

function d(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function changePercent(current: number, previous: number | null | undefined) {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function nextExpectedFromFrequency(frequency: string, periodEnd: Date) {
  const next = new Date(periodEnd);
  if (frequency === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  else if (frequency === "quarterly") next.setUTCMonth(next.getUTCMonth() + 3);
  else if (frequency === "semi_annual") next.setUTCMonth(next.getUTCMonth() + 6);
  else if (frequency === "annual") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCDate(next.getUTCDate() + 30);
  return next;
}

/** Upsert sources + verified metrics; compute previous/change against prior period. */
export async function syncMarketIntelligenceSeed() {
  const sourceIds = new Map<string, string>();

  for (const s of MARKET_SOURCES) {
    const row = await prisma.marketSource.upsert({
      where: { key: s.key },
      create: {
        key: s.key,
        name: s.name,
        tier: s.tier,
        url: s.url,
        sourceType: s.sourceType,
        updateFrequency: s.updateFrequency,
        reliability: s.reliability,
        notes: s.notes,
        lastChecked: new Date(),
        lastSuccessAt: new Date(),
      },
      update: {
        name: s.name,
        tier: s.tier,
        url: s.url,
        sourceType: s.sourceType,
        updateFrequency: s.updateFrequency,
        reliability: s.reliability,
        notes: s.notes,
        lastChecked: new Date(),
        lastSuccessAt: new Date(),
      },
    });
    sourceIds.set(s.key, row.id);
  }

  // Sort so previous values resolve in chronological order.
  const sorted = [...MARKET_METRICS].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const latestByKey = new Map<string, number>();

  for (const m of sorted) {
    const sourceId = sourceIds.get(m.sourceKey);
    if (!sourceId) continue;
    const check = validateObservation({
      metricKey: m.metricKey,
      value: m.value,
      unit: m.unit,
      currency: m.currency,
      periodEnd: m.periodEnd,
      sourceUrl: m.sourceUrl,
      isEstimate: m.isEstimate,
    });
    if (!check.ok) {
      console.warn(`[market-intelligence] rejected ${m.metricKey}@${m.periodEnd}: ${check.reason}`);
      continue;
    }
    const prev = latestByKey.get(m.metricKey) ?? null;
    const chg = changePercent(m.value, prev);

    const existing = await prisma.marketMetric.findUnique({
      where: {
        metricKey_periodEnd_sourceId: {
          metricKey: m.metricKey,
          periodEnd: d(m.periodEnd),
          sourceId,
        },
      },
    });

    let status = m.status;
    if (existing && existing.value !== m.value) {
      await prisma.marketMetricRevision.create({
        data: {
          metricId: existing.id,
          previousValue: existing.value,
          newValue: m.value,
          note: "Seed sync revision",
        },
      });
      status = "revised";
    }

    const nextExpected = nextExpectedFromFrequency(m.frequency, d(m.periodEnd));

    await prisma.marketMetric.upsert({
      where: {
        metricKey_periodEnd_sourceId: {
          metricKey: m.metricKey,
          periodEnd: d(m.periodEnd),
          sourceId,
        },
      },
      create: {
        metricKey: m.metricKey,
        metricName: m.metricName,
        category: m.category,
        value: m.value,
        unit: m.unit,
        currency: m.currency ?? null,
        periodStart: d(m.periodStart),
        periodEnd: d(m.periodEnd),
        frequency: m.frequency,
        sourceId,
        sourceUrl: m.sourceUrl,
        sourcePublishedAt: m.sourcePublishedAt ? d(m.sourcePublishedAt) : null,
        status,
        isEstimate: Boolean(m.isEstimate),
        isCalculated: Boolean(m.isCalculated),
        confidence: m.confidence ?? "high",
        previousValue: prev,
        changePercent: chg,
        notes: m.notes,
      },
      update: {
        metricName: m.metricName,
        category: m.category,
        value: m.value,
        unit: m.unit,
        currency: m.currency ?? null,
        periodStart: d(m.periodStart),
        frequency: m.frequency,
        sourceUrl: m.sourceUrl,
        sourcePublishedAt: m.sourcePublishedAt ? d(m.sourcePublishedAt) : null,
        status,
        isEstimate: Boolean(m.isEstimate),
        isCalculated: Boolean(m.isCalculated),
        confidence: m.confidence ?? "high",
        previousValue: prev,
        changePercent: chg,
        notes: m.notes,
        retrievedAt: new Date(),
      },
    });

    await prisma.marketSource.update({
      where: { id: sourceId },
      data: { nextExpectedAt: nextExpected },
    });

    latestByKey.set(m.metricKey, m.value);
  }

  // Calculated: credit growth latest vs prior total_credit_facilities observation.
  await upsertCalculatedCreditGrowth(sourceIds.get("cbj")!);

  return { sources: MARKET_SOURCES.length, metrics: MARKET_METRICS.length };
}

async function upsertCalculatedCreditGrowth(cbjSourceId: string) {
  const series = await prisma.marketMetric.findMany({
    where: { metricKey: "total_credit_facilities" },
    orderBy: { periodEnd: "asc" },
  });
  if (series.length < 2) return;
  const latest = series[series.length - 1]!;
  const prev = series[series.length - 2]!;
  const growth = changePercent(latest.value, prev.value);
  if (growth == null) return;

  await prisma.marketMetric.upsert({
    where: {
      metricKey_periodEnd_sourceId: {
        metricKey: "credit_growth_rate",
        periodEnd: latest.periodEnd,
        sourceId: cbjSourceId,
      },
    },
    create: {
      metricKey: "credit_growth_rate",
      metricName: "Credit growth (period-over-period)",
      category: "calculated",
      value: growth,
      unit: "percent",
      periodStart: prev.periodEnd,
      periodEnd: latest.periodEnd,
      frequency: latest.frequency,
      sourceId: cbjSourceId,
      sourceUrl: latest.sourceUrl,
      sourcePublishedAt: latest.sourcePublishedAt,
      status: "latest_available",
      isCalculated: true,
      confidence: latest.confidence,
      previousValue: prev.value,
      changePercent: growth,
      notes: `Calculated from total_credit_facilities ${prev.value} → ${latest.value} (${prev.periodEnd.toISOString().slice(0, 10)} → ${latest.periodEnd.toISOString().slice(0, 10)}).`,
    },
    update: {
      value: growth,
      periodStart: prev.periodEnd,
      frequency: latest.frequency,
      sourceUrl: latest.sourceUrl,
      sourcePublishedAt: latest.sourcePublishedAt,
      previousValue: prev.value,
      changePercent: growth,
      retrievedAt: new Date(),
      notes: `Calculated from total_credit_facilities ${prev.value} → ${latest.value}.`,
    },
  });
}

/** Lightweight source health check — records lastChecked without inventing values. */
export async function checkMarketSources() {
  const sources = await prisma.marketSource.findMany();
  let ok = 0;
  for (const s of sources) {
    try {
      const res = await fetch(s.url, {
        method: "HEAD",
        signal: AbortSignal.timeout(12_000),
        redirect: "follow",
        headers: { "User-Agent": "AlshantafMarketBot/1.0 (+https://alshantaf.com)" },
      });
      await prisma.marketSource.update({
        where: { id: s.id },
        data: {
          lastChecked: new Date(),
          lastSuccessAt: res.ok || res.status === 405 ? new Date() : s.lastSuccessAt,
        },
      });
      if (res.ok || res.status === 405) ok++;
    } catch {
      await prisma.marketSource.update({
        where: { id: s.id },
        data: { lastChecked: new Date() },
      });
    }
  }
  return { checked: sources.length, reachable: ok };
}

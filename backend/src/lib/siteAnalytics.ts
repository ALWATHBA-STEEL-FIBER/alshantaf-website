import { prisma } from "../prisma";

/** In-memory guard so heartbeats don't hammer the unique table. */
const seenUniques = new Set<string>();

function utcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Record at most one view per visitor device per UTC day.
 * Heartbeats / path changes on the same day do not inflate the count.
 */
export async function recordPageView(visitorId: string, path: string) {
  const cleanPath = (path || "/").slice(0, 300) || "/";
  const day = utcDay();
  const memKey = `${visitorId}|${dayKey(day)}`;
  if (seenUniques.has(memKey)) return;

  try {
    await prisma.siteVisitorDaily.create({
      data: { day, visitorId, path: cleanPath },
    });
  } catch {
    // Already counted today (unique constraint) — ignore.
    seenUniques.add(memKey);
    return;
  }

  seenUniques.add(memKey);
  if (seenUniques.size > 50_000) seenUniques.clear();

  // Keep path rollup in sync, but only when a new device-day is recorded.
  await prisma.sitePageViewDaily.upsert({
    where: { day_path: { day, path: cleanPath } },
    create: {
      day,
      path: cleanPath,
      views: 1,
      uniqueVisitors: 1,
    },
    update: {
      views: { increment: 1 },
      uniqueVisitors: { increment: 1 },
    },
  });
}

/** Dashboard series: views === unique devices (one per visitor/day). */
export async function getSiteViewSeries(days: number) {
  const end = utcDay();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const rows = await prisma.siteVisitorDaily.groupBy({
    by: ["day"],
    where: { day: { gte: start, lte: end } },
    _count: { _all: true },
  });

  const byDay = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    byDay.set(dayKey(d), 0);
  }
  for (const row of rows) {
    byDay.set(dayKey(new Date(row.day)), row._count._all);
  }

  const points = [...byDay.entries()].map(([date, uniqueDevices]) => ({
    date,
    views: uniqueDevices,
    uniqueVisitors: uniqueDevices,
  }));

  const total = points.reduce((n, p) => n + p.views, 0);
  return {
    days,
    totalViews: total,
    totalUniques: total,
    points,
  };
}

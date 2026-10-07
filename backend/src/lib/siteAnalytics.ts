import { prisma } from "../prisma";

/** In-memory unique visitor keys for the current process day (visitorId|day|path). */
const seenUniques = new Set<string>();

function utcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function recordPageView(visitorId: string, path: string) {
  const cleanPath = (path || "/").slice(0, 300) || "/";
  const day = utcDay();
  const uniqueKey = `${visitorId}|${dayKey(day)}|${cleanPath}`;
  const isUnique = !seenUniques.has(uniqueKey);
  if (isUnique) seenUniques.add(uniqueKey);

  // Bound memory — clear when large.
  if (seenUniques.size > 50_000) seenUniques.clear();

  await prisma.sitePageViewDaily.upsert({
    where: { day_path: { day, path: cleanPath } },
    create: {
      day,
      path: cleanPath,
      views: 1,
      uniqueVisitors: isUnique ? 1 : 0,
    },
    update: {
      views: { increment: 1 },
      ...(isUnique ? { uniqueVisitors: { increment: 1 } } : {}),
    },
  });
}

export async function getSiteViewSeries(days: number) {
  const end = utcDay();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const rows = await prisma.sitePageViewDaily.findMany({
    where: { day: { gte: start, lte: end } },
    orderBy: { day: "asc" },
  });

  const byDay = new Map<string, { views: number; uniqueVisitors: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    byDay.set(dayKey(d), { views: 0, uniqueVisitors: 0 });
  }
  for (const row of rows) {
    const key = dayKey(new Date(row.day));
    const cur = byDay.get(key) ?? { views: 0, uniqueVisitors: 0 };
    cur.views += row.views;
    cur.uniqueVisitors += row.uniqueVisitors;
    byDay.set(key, cur);
  }

  const points = [...byDay.entries()].map(([date, v]) => ({
    date,
    views: v.views,
    uniqueVisitors: v.uniqueVisitors,
  }));

  return {
    days,
    totalViews: points.reduce((n, p) => n + p.views, 0),
    totalUniques: points.reduce((n, p) => n + p.uniqueVisitors, 0),
    points,
  };
}

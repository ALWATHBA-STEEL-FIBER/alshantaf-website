import type { Request } from "express";
import { prisma } from "../prisma";

const EVENT_WRITE_GAP_MS = 45_000;
const lastEventWrite = new Map<string, number>();

function utcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0]!.trim().slice(0, 80);
  }
  if (Array.isArray(xf) && xf[0]) return String(xf[0]).split(",")[0]!.trim().slice(0, 80);
  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real.trim()) return real.trim().slice(0, 80);
  return (req.ip || req.socket?.remoteAddress || "unknown").slice(0, 80);
}

export function clientUserAgent(req: Request): string | null {
  const ua = req.headers["user-agent"];
  if (typeof ua !== "string" || !ua.trim()) return null;
  return ua.trim().slice(0, 500);
}

export type HeartbeatMeta = {
  path?: string;
  platform?: string | null;
  screen?: string | null;
  timezone?: string | null;
  language?: string | null;
  /** Visitor-provided name — only applied when the device has no locked name yet. */
  name?: string | null;
};

export async function trackDeviceHeartbeat(
  req: Request,
  visitorId: string,
  meta: HeartbeatMeta = {}
) {
  const path = (meta.path || "/").slice(0, 300) || "/";
  const ip = clientIp(req);
  const userAgent = clientUserAgent(req);
  const platform = meta.platform?.trim().slice(0, 120) || null;
  const screen = meta.screen?.trim().slice(0, 40) || null;
  const timezone = meta.timezone?.trim().slice(0, 80) || null;
  const language = meta.language?.trim().slice(0, 40) || null;
  const requestedName = meta.name?.trim().replace(/\s+/g, " ").slice(0, 80) || null;
  const now = new Date();

  const existing = await prisma.siteDevice.findUnique({ where: { visitorId } });

  let displayName = existing?.displayName ?? null;
  let nameLocked = existing?.nameLocked ?? false;
  let namedAt = existing?.namedAt ?? null;

  if (requestedName && !nameLocked) {
    displayName = requestedName;
    nameLocked = true;
    namedAt = now;
  }

  const device = existing
    ? await prisma.siteDevice.update({
        where: { id: existing.id },
        data: {
          ip,
          userAgent: userAgent ?? existing.userAgent,
          platform: platform ?? existing.platform,
          screen: screen ?? existing.screen,
          timezone: timezone ?? existing.timezone,
          language: language ?? existing.language,
          lastPath: path,
          lastSeenAt: now,
          requestCount: { increment: 1 },
          displayName,
          nameLocked,
          namedAt,
        },
      })
    : await prisma.siteDevice.create({
        data: {
          visitorId,
          ip,
          userAgent,
          platform,
          screen,
          timezone,
          language,
          lastPath: path,
          lastSeenAt: now,
          firstSeenAt: now,
          requestCount: 1,
          displayName,
          nameLocked,
          namedAt,
        },
      });

  const eventKey = `${device.id}|${path}`;
  const prev = lastEventWrite.get(eventKey) ?? 0;
  if (now.getTime() - prev >= EVENT_WRITE_GAP_MS) {
    lastEventWrite.set(eventKey, now.getTime());
    if (lastEventWrite.size > 80_000) lastEventWrite.clear();
    await prisma.siteDeviceEvent.create({
      data: {
        deviceId: device.id,
        ip,
        path,
        userAgent,
      },
    });
  }

  // Daily IP rollup
  const day = utcDay(now);
  const dayIp = await prisma.siteIpDaily.findUnique({
    where: { day_ip: { day, ip } },
  });
  if (!dayIp) {
    await prisma.siteIpDaily.create({
      data: { day, ip, hits: 1, devices: 1 },
    });
  } else {
    // Approximate unique devices per IP/day: bump devices when this visitor is new today.
    const deviceSeenToday = existing
      ? existing.lastSeenAt >= day && existing.ip === ip
      : false;
    await prisma.siteIpDaily.update({
      where: { id: dayIp.id },
      data: {
        hits: { increment: 1 },
        ...(deviceSeenToday ? {} : { devices: { increment: 1 } }),
      },
    });
  }

  return device;
}

export async function getUniqueIpStats(days: number) {
  const end = utcDay();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const rows = await prisma.siteIpDaily.findMany({
    where: { day: { gte: start, lte: end } },
    select: { day: true, ip: true, hits: true, devices: true },
  });

  const ips = new Set(rows.map((r) => r.ip));
  const byDay = new Map<string, Set<string>>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    byDay.set(dayKey(d), new Set());
  }
  let totalHits = 0;
  for (const row of rows) {
    totalHits += row.hits;
    const key = dayKey(new Date(row.day));
    byDay.get(key)?.add(row.ip);
  }

  return {
    days,
    uniqueIps: ips.size,
    totalHits,
    points: [...byDay.entries()].map(([date, set]) => ({
      date,
      uniqueIps: set.size,
    })),
  };
}

export async function getMonitorSummary() {
  const onlineSince = new Date(Date.now() - 90_000);
  const [
    totalDevices,
    namedDevices,
    onlineDevices,
    day1,
    day7,
    day30,
    recentEvents,
  ] = await Promise.all([
    prisma.siteDevice.count(),
    prisma.siteDevice.count({ where: { displayName: { not: null } } }),
    prisma.siteDevice.count({ where: { lastSeenAt: { gte: onlineSince } } }),
    getUniqueIpStats(1),
    getUniqueIpStats(7),
    getUniqueIpStats(30),
    prisma.siteDeviceEvent.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
  ]);

  return {
    totalDevices,
    namedDevices,
    onlineDevices,
    eventsLast24h: recentEvents,
    uniqueIps: {
      day1: day1.uniqueIps,
      day7: day7.uniqueIps,
      day30: day30.uniqueIps,
      series1: day1,
      series7: day7,
      series30: day30,
    },
  };
}

export async function listMonitorDevices(opts: {
  q?: string;
  ip?: string;
  namedOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const q = opts.q?.trim();
  const where = {
    ...(opts.ip ? { ip: opts.ip } : {}),
    ...(opts.namedOnly ? { displayName: { not: null } } : {}),
    ...(q
      ? {
          OR: [
            { displayName: { contains: q, mode: "insensitive" as const } },
            { ip: { contains: q } },
            { visitorId: { contains: q } },
            { platform: { contains: q, mode: "insensitive" as const } },
            { lastPath: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, devices] = await Promise.all([
    prisma.siteDevice.count({ where }),
    prisma.siteDevice.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

  return { total, limit, offset, devices };
}

export async function getMonitorDeviceDetail(id: string, eventLimit = 80) {
  const device = await prisma.siteDevice.findUnique({ where: { id } });
  if (!device) return null;
  const events = await prisma.siteDeviceEvent.findMany({
    where: { deviceId: id },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(eventLimit, 1), 300),
  });
  const siblingDevices = device.ip
    ? await prisma.siteDevice.findMany({
        where: { ip: device.ip, NOT: { id: device.id } },
        orderBy: { lastSeenAt: "desc" },
        take: 20,
        select: {
          id: true,
          displayName: true,
          visitorId: true,
          lastSeenAt: true,
          requestCount: true,
          lastPath: true,
        },
      })
    : [];
  return { device, events, siblingDevices };
}

export async function listMonitorIps(opts: { days?: number; limit?: number } = {}) {
  const days = Math.min(Math.max(opts.days ?? 30, 1), 90);
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const end = utcDay();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const rows = await prisma.siteIpDaily.findMany({
    where: { day: { gte: start, lte: end } },
  });

  const byIp = new Map<string, { hits: number; devices: number; days: number; lastDay: string }>();
  for (const row of rows) {
    const cur = byIp.get(row.ip) ?? { hits: 0, devices: 0, days: 0, lastDay: dayKey(new Date(row.day)) };
    cur.hits += row.hits;
    cur.devices = Math.max(cur.devices, row.devices);
    cur.days += 1;
    const dk = dayKey(new Date(row.day));
    if (dk > cur.lastDay) cur.lastDay = dk;
    byIp.set(row.ip, cur);
  }

  const ips = [...byIp.entries()]
    .map(([ip, v]) => ({ ip, ...v }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit);

  return { days, totalUniqueIps: byIp.size, ips };
}

export async function adminSetDeviceName(id: string, name: string | null) {
  const trimmed = name?.trim().replace(/\s+/g, " ").slice(0, 80) || null;
  return prisma.siteDevice.update({
    where: { id },
    data: trimmed
      ? { displayName: trimmed, nameLocked: true, namedAt: new Date() }
      : { displayName: null, nameLocked: false, namedAt: null },
  });
}

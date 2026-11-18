/**
 * One-shot backfill for Site Monitor from historical data:
 * - LandCheck + AuditLog → named devices (e.g. bano23@gmail.com → Mohammad Salah)
 * - ListingView → anonymous devices + offer-view events
 * - AuditLog IPs → SiteIpDaily rollups
 *
 * Safe to re-run (idempotent upserts / skip-if-exists for events).
 */
import { prisma } from "../prisma";

const NAME_MAP: Array<{ email: string; displayName: string }> = [
  { email: "bano23@gmail.com", displayName: "Mohammad Salah" },
];

function utcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function bumpIpDaily(ip: string, at: Date, isNewDevice: boolean) {
  if (!ip) return;
  const day = utcDay(at);
  const existing = await prisma.siteIpDaily.findUnique({
    where: { day_ip: { day, ip } },
  });
  if (!existing) {
    await prisma.siteIpDaily.create({
      data: { day, ip, hits: 1, devices: 1 },
    });
    return;
  }
  await prisma.siteIpDaily.update({
    where: { id: existing.id },
    data: {
      hits: { increment: 1 },
      ...(isNewDevice ? { devices: { increment: 1 } } : {}),
    },
  });
}

async function ensureEvent(opts: {
  deviceId: string;
  ip: string | null;
  path: string;
  userAgent: string | null;
  createdAt: Date;
}) {
  const near = await prisma.siteDeviceEvent.findFirst({
    where: {
      deviceId: opts.deviceId,
      path: opts.path,
      createdAt: {
        gte: new Date(opts.createdAt.getTime() - 30_000),
        lte: new Date(opts.createdAt.getTime() + 30_000),
      },
    },
  });
  if (near) return false;
  await prisma.siteDeviceEvent.create({
    data: {
      deviceId: opts.deviceId,
      ip: opts.ip,
      path: opts.path,
      userAgent: opts.userAgent,
      createdAt: opts.createdAt,
    },
  });
  return true;
}

async function backfillNamedFromLandChecks() {
  let devices = 0;
  let events = 0;

  for (const { email, displayName } of NAME_MAP) {
    const checks = await prisma.landCheck.findMany({
      where: { email: { equals: email, mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
    });

    const audits = await prisma.auditLog.findMany({
      where: {
        actorEmail: { equals: email, mode: "insensitive" },
        action: "landcheck.create",
      },
      orderBy: { createdAt: "asc" },
    });
    const ipByTarget = new Map(
      audits
        .filter((a) => a.targetId && a.ip)
        .map((a) => [a.targetId!, a.ip!] as const)
    );

    // Hub device for the email (all activity searchable under one visitor id).
    const hubVisitorId = `email:${email.toLowerCase()}`;
    let hub = await prisma.siteDevice.findUnique({ where: { visitorId: hubVisitorId } });
    const hubFirst = checks[0]?.createdAt ?? audits[0]?.createdAt ?? new Date();
    const hubLast =
      checks.reduce((m, c) => (c.updatedAt > m ? c.updatedAt : m), hubFirst);

    if (!hub) {
      hub = await prisma.siteDevice.create({
        data: {
          visitorId: hubVisitorId,
          displayName,
          nameLocked: true,
          namedAt: hubFirst,
          ip: audits.find((a) => a.ip)?.ip ?? null,
          lastPath: "/land-check",
          requestCount: 0,
          firstSeenAt: hubFirst,
          lastSeenAt: hubLast,
        },
      });
      devices += 1;
      if (hub.ip) await bumpIpDaily(hub.ip, hubFirst, true);
    } else if (!hub.nameLocked || hub.displayName !== displayName) {
      hub = await prisma.siteDevice.update({
        where: { id: hub.id },
        data: {
          displayName,
          nameLocked: true,
          namedAt: hub.namedAt ?? hubFirst,
        },
      });
    }

    for (const check of checks) {
      const clientKey = check.clientKey?.trim();
      const visitorId = clientKey && /^[0-9a-f-]{36}$/i.test(clientKey)
        ? clientKey
        : `landcheck:${check.id}`;
      const ip = ipByTarget.get(check.id) ?? hub.ip ?? null;
      const existing = await prisma.siteDevice.findUnique({ where: { visitorId } });
      const isNew = !existing;

      const device = existing
        ? await prisma.siteDevice.update({
            where: { id: existing.id },
            data: {
              displayName,
              nameLocked: true,
              namedAt: existing.namedAt ?? check.createdAt,
              ip: ip ?? existing.ip,
              lastPath: "/land-check",
              firstSeenAt:
                existing.firstSeenAt < check.createdAt ? existing.firstSeenAt : check.createdAt,
              lastSeenAt:
                existing.lastSeenAt > check.updatedAt ? existing.lastSeenAt : check.updatedAt,
            },
          })
        : await prisma.siteDevice.create({
            data: {
              visitorId,
              displayName,
              nameLocked: true,
              namedAt: check.createdAt,
              ip,
              lastPath: "/land-check",
              requestCount: 0,
              firstSeenAt: check.createdAt,
              lastSeenAt: check.updatedAt,
            },
          });

      if (isNew) {
        devices += 1;
        if (ip) await bumpIpDaily(ip, check.createdAt, true);
      }

      const paths = [
        { at: check.createdAt, path: "/land-check" },
        ...(check.updatedAt.getTime() - check.createdAt.getTime() > 60_000
          ? [{ at: check.updatedAt, path: `/land-check#${check.serialNo}` }]
          : []),
      ];

      for (const p of paths) {
        for (const target of [device, hub]) {
          const created = await ensureEvent({
            deviceId: target.id,
            ip,
            path: p.path,
            userAgent: null,
            createdAt: p.at,
          });
          if (created) {
            events += 1;
            const fresh = await prisma.siteDevice.findUniqueOrThrow({
              where: { id: target.id },
            });
            await prisma.siteDevice.update({
              where: { id: target.id },
              data: {
                requestCount: { increment: 1 },
                lastSeenAt: p.at > fresh.lastSeenAt ? p.at : fresh.lastSeenAt,
                lastPath: "/land-check",
                ...(ip ? { ip } : {}),
              },
            });
            if (ip) await bumpIpDaily(ip, p.at, false);
          }
        }
      }
    }

    // Audit-only creates (in case landcheck row missing)
    for (const audit of audits) {
      const created = await ensureEvent({
        deviceId: hub.id,
        ip: audit.ip,
        path: "/land-check",
        userAgent: null,
        createdAt: audit.createdAt,
      });
      if (created) {
        events += 1;
        await prisma.siteDevice.update({
          where: { id: hub.id },
          data: {
            requestCount: { increment: 1 },
            lastSeenAt: audit.createdAt,
            ip: audit.ip ?? undefined,
          },
        });
        if (audit.ip) await bumpIpDaily(audit.ip, audit.createdAt, false);
      }
    }

    console.log(
      `Named ${displayName} (${email}): ${checks.length} land checks, hub=${hub.id}`
    );
  }

  return { devices, events };
}

async function backfillFromListingViews() {
  const views = await prisma.listingView.findMany({
    orderBy: { viewedAt: "asc" },
    select: { listingId: true, visitorId: true, viewedAt: true },
  });

  let devices = 0;
  let events = 0;
  const seenNew = new Set<string>();

  for (const view of views) {
    let device = await prisma.siteDevice.findUnique({
      where: { visitorId: view.visitorId },
    });
    if (!device) {
      device = await prisma.siteDevice.create({
        data: {
          visitorId: view.visitorId,
          lastPath: `/offers/${view.listingId}`,
          requestCount: 0,
          firstSeenAt: view.viewedAt,
          lastSeenAt: view.viewedAt,
        },
      });
      devices += 1;
      seenNew.add(device.id);
    }

    const path = `/offers/${view.listingId}`;
    const created = await ensureEvent({
      deviceId: device.id,
      ip: device.ip,
      path,
      userAgent: device.userAgent,
      createdAt: view.viewedAt,
    });
    if (created) {
      events += 1;
      await prisma.siteDevice.update({
        where: { id: device.id },
        data: {
          requestCount: { increment: 1 },
          lastPath: path,
          lastSeenAt: view.viewedAt > device.lastSeenAt ? view.viewedAt : device.lastSeenAt,
          firstSeenAt: view.viewedAt < device.firstSeenAt ? view.viewedAt : device.firstSeenAt,
        },
      });
    }
  }

  return { devices, events, views: views.length };
}

async function backfillIpsFromAudit() {
  const rows = await prisma.auditLog.findMany({
    where: { ip: { not: null } },
    select: { ip: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const byKey = new Map<string, { day: Date; ip: string; hits: number }>();
  for (const row of rows) {
    if (!row.ip) continue;
    const day = utcDay(row.createdAt);
    const key = `${day.toISOString().slice(0, 10)}|${row.ip}`;
    const cur = byKey.get(key) ?? { day, ip: row.ip, hits: 0 };
    cur.hits += 1;
    byKey.set(key, cur);
  }

  let upserts = 0;
  for (const { day, ip, hits } of byKey.values()) {
    const existing = await prisma.siteIpDaily.findUnique({
      where: { day_ip: { day, ip } },
    });
    if (!existing) {
      await prisma.siteIpDaily.create({
        data: { day, ip, hits, devices: 1 },
      });
      upserts += 1;
    } else if (existing.hits < hits) {
      await prisma.siteIpDaily.update({
        where: { id: existing.id },
        data: { hits },
      });
      upserts += 1;
    }
  }
  return { upserts, distinctDays: byKey.size };
}

async function main() {
  console.log("Backfilling site monitor…");
  const named = await backfillNamedFromLandChecks();
  const listings = await backfillFromListingViews();
  const ips = await backfillIpsFromAudit();

  const summary = {
    devices: await prisma.siteDevice.count(),
    namedDevices: await prisma.siteDevice.count({
      where: { displayName: { not: null } },
    }),
    events: await prisma.siteDeviceEvent.count(),
    ipDays: await prisma.siteIpDaily.count(),
    mohammad: await prisma.siteDevice.findMany({
      where: { displayName: { equals: "Mohammad Salah", mode: "insensitive" } },
      select: {
        id: true,
        visitorId: true,
        ip: true,
        requestCount: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    }),
  };

  console.log(
    JSON.stringify(
      { named, listings, ips, summary },
      (_k, v) => (v instanceof Date ? v.toISOString() : v),
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

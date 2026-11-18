/**
 * Seed SiteVisitorDaily from known historical visitor ids (devices + listing views).
 */
import { prisma } from "../prisma";

function utcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function main() {
  const devices = await prisma.siteDevice.findMany({
    select: { visitorId: true, firstSeenAt: true, lastPath: true },
  });
  const views = await prisma.listingView.findMany({
    select: { visitorId: true, viewedAt: true, listingId: true },
  });

  let created = 0;
  let skipped = 0;

  async function upsert(visitorId: string, at: Date, path: string) {
    const day = utcDay(at);
    try {
      await prisma.siteVisitorDaily.create({
        data: { day, visitorId, path: path.slice(0, 300) },
      });
      created += 1;
    } catch {
      skipped += 1;
    }
  }

  for (const d of devices) {
    await upsert(d.visitorId, d.firstSeenAt, d.lastPath || "/");
  }
  for (const v of views) {
    await upsert(v.visitorId, v.viewedAt, `/offers/${v.listingId}`);
  }

  console.log(JSON.stringify({ created, skipped, devices: devices.length, views: views.length }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { prisma } from "../prisma";
import { toWesternDigits } from "../lib/arabicDigits";

function parseParcelNumbers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const normalized = toWesternDigits(raw);
  const parts = normalized.match(/\d+/g) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const clean = String(Number(p));
    if (!clean || clean === "0") continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

function canonicalParcel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const values = parseParcelNumbers(raw);
  if (!values.length) return raw.trim() || null;
  if (values.length === 1) return values[0]!;
  return values.join(", ");
}

async function migrate(apply: boolean) {
  const listings = await prisma.listing.findMany({
    select: { id: true, listingNo: true, parcel: true },
  });
  const submissions = await prisma.submission.findMany({
    select: { id: true, serialNo: true, parcel: true, status: true },
  });

  let listingUpdated = 0;
  let listingMulti = 0;
  let submissionUpdated = 0;
  let submissionMulti = 0;

  for (const row of listings) {
    const nextParcel = canonicalParcel(row.parcel);
    if (nextParcel == null || nextParcel === row.parcel) continue;
    if (parseParcelNumbers(nextParcel).length > 1) listingMulti += 1;
    listingUpdated += 1;
    if (apply) {
      await prisma.listing.update({
        where: { id: row.id },
        data: { parcel: nextParcel },
      });
    }
  }

  for (const row of submissions) {
    const nextParcel = canonicalParcel(row.parcel);
    if (nextParcel == null || nextParcel === row.parcel) continue;
    if (parseParcelNumbers(nextParcel).length > 1) submissionMulti += 1;
    submissionUpdated += 1;
    if (apply) {
      await prisma.submission.update({
        where: { id: row.id },
        data: { parcel: nextParcel },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        listings: {
          total: listings.length,
          updated: listingUpdated,
          multiParcelFormatted: listingMulti,
          currentMultiParcelRows: listings.filter((r) => parseParcelNumbers(r.parcel).length > 1).length,
        },
        submissions: {
          total: submissions.length,
          updated: submissionUpdated,
          multiParcelFormatted: submissionMulti,
          currentMultiParcelRows: submissions.filter((r) => parseParcelNumbers(r.parcel).length > 1).length,
        },
      },
      null,
      2
    )
  );
}

async function main() {
  const apply = process.argv.includes("--apply");
  await migrate(apply);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

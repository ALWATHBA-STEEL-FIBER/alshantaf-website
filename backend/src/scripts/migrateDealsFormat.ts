import { prisma } from "../prisma";
import { toWesternDigits } from "../lib/arabicDigits";

const PRICE_PER_SQM_RE = /^\d+(\.\d+)?$/;

function parsePricePerSqm(price: string | null | undefined): number | null {
  if (!price) return null;
  const text = toWesternDigits(price).replace(/,/g, "").trim();
  if (!text) return null;
  if (PRICE_PER_SQM_RE.test(text)) {
    const n = Number(text);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const per = text.match(
    /([\d.]+)\s*(?:دينار|JOD|JD|jd)?\s*(?:\/|لكل|per)?\s*(?:م²|m²|م2|m2|sq\.?\s*m)/i
  );
  if (!per) return null;
  const n = Number(per[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseAreaSqm(label: string | null | undefined): number | null {
  if (!label) return null;
  const text = toWesternDigits(label).replace(/,/g, "").trim();
  if (!text) return null;
  const sqm = text.match(/([\d.]+)\s*(?:m²|م²|m2|م2)/i);
  if (sqm) {
    const n = Number(sqm[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const dunum = text.match(/([\d.]+)\s*(?:dunums?|دونم)/i);
  if (dunum) {
    const n = Number(dunum[1]);
    return Number.isFinite(n) && n > 0 ? n * 1000 : null;
  }
  return null;
}

function stripTrailingZeros(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toString();
}

function formatAreaLabel(sqm: number): string {
  const sqmText = sqm.toLocaleString("en-JO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
  const dunumsText = (sqm / 1000).toLocaleString("en-JO", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  });
  // Store Arabic-unit canonical text; public UI localizes unit labels.
  return `${sqmText} م² · ${dunumsText} دونم`;
}

function normalizePrice(price: string | null): string | null {
  if (!price || !price.trim()) return null;
  const parsed = parsePricePerSqm(price);
  if (parsed == null) return null;
  return stripTrailingZeros(parsed);
}

function normalizeArea(area: string | null): string | null {
  if (!area || !area.trim()) return null;
  const parsedSqm = parseAreaSqm(area);
  if (parsedSqm == null) return null;
  return formatAreaLabel(parsedSqm);
}

async function migrate(apply: boolean) {
  const listings = await prisma.listing.findMany({
    select: { id: true, listingNo: true, price: true, size: true },
  });
  const submissions = await prisma.submission.findMany({
    select: { id: true, serialNo: true, price: true, area: true, status: true },
  });

  let listingUpdates = 0;
  let listingPriceCleared = 0;
  let listingSizeCleared = 0;
  let submissionUpdates = 0;
  let submissionPriceCleared = 0;
  let submissionAreaCleared = 0;

  for (const row of listings) {
    const nextPrice = normalizePrice(row.price);
    const nextSize = normalizeArea(row.size);
    const changed = nextPrice !== row.price || nextSize !== row.size;
    if (!changed) continue;
    listingUpdates += 1;
    if (row.price && nextPrice === null) listingPriceCleared += 1;
    if (row.size && nextSize === null) listingSizeCleared += 1;
    if (apply) {
      await prisma.listing.update({
        where: { id: row.id },
        data: { price: nextPrice, size: nextSize },
      });
    }
  }

  for (const row of submissions) {
    const nextPrice = normalizePrice(row.price);
    const nextArea = normalizeArea(row.area);
    const changed = nextPrice !== row.price || nextArea !== row.area;
    if (!changed) continue;
    submissionUpdates += 1;
    if (row.price && nextPrice === null) submissionPriceCleared += 1;
    if (row.area && nextArea === null) submissionAreaCleared += 1;
    if (apply) {
      await prisma.submission.update({
        where: { id: row.id },
        data: { price: nextPrice, area: nextArea },
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
          updated: listingUpdates,
          clearedInvalidPrice: listingPriceCleared,
          clearedInvalidSize: listingSizeCleared,
        },
        submissions: {
          total: submissions.length,
          updated: submissionUpdates,
          clearedInvalidPrice: submissionPriceCleared,
          clearedInvalidArea: submissionAreaCleared,
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

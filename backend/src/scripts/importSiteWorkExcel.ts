/**
 * Import historical site-work Excel workbooks into Postgres + copy files into projects/.
 *
 *   npx tsx src/scripts/importSiteWorkExcel.ts
 *   npx tsx src/scripts/importSiteWorkExcel.ts --dir=/path/to/source
 */
import { prisma } from "../prisma";
import { importAllSiteWorkSource } from "../lib/siteWorkImport";

async function main() {
  const dirArg = process.argv.find((a) => a.startsWith("--dir="));
  const dir = dirArg ? dirArg.slice(6) : undefined;
  const result = await importAllSiteWorkSource(dir);
  for (const s of result.files) {
    console.log(
      `→ ${s.file}: project=${s.projectName} sheets=${s.sheets} workers=${s.workers} days=${s.dayRowsUpserted} emptySkipped=${s.dayRowsSkippedEmpty} week=${s.weekCounter}`
    );
  }
  console.log(`\nDone. Upserted day rows=${result.totalDayRows} DB records=${result.recordCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

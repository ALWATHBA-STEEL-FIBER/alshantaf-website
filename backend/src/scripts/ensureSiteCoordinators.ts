/**
 * Ensure أحمد + محمد are COORDINATOR accounts and every active project
 * is assigned to one of them.
 *
 *   npx tsx src/scripts/ensureSiteCoordinators.ts
 */
import { prisma } from "../prisma";
import { ensureDefaultCoordinators } from "../lib/siteCoordinators";

async function main() {
  const result = await ensureDefaultCoordinators();
  console.log("Coordinators:");
  for (const c of result.coordinators) {
    console.log(`  - ${c.name} <${c.email}> ${c.created ? "(created)" : "(updated)"}`);
  }
  console.log("\nProject assignments:");
  for (const a of result.assignments) {
    console.log(`  - ${a.projectName} → ${a.coordinatorName}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

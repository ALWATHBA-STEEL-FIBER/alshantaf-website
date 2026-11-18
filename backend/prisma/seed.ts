import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { INDUSTRY_TYPE_CATALOG } from "../src/lib/industryTypeCatalog";
const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the admin user");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, permissions: ["*"] },
    create: { email, passwordHash, name: "Alshantaf Admin", permissions: ["*"] },
  });

  await Promise.all(
    INDUSTRY_TYPE_CATALOG.map((entry) =>
      prisma.industryTypeCatalog.upsert({
        where: { industryType: entry.industryType },
        create: {
          industryType: entry.industryType,
          category: entry.category,
          ammanAutoEligible: entry.ammanAutoEligible,
          rules: entry.rules as never,
        },
        update: {
          category: entry.category,
          ammanAutoEligible: entry.ammanAutoEligible,
          rules: entry.rules as never,
        },
      })
    )
  );

  try {
    const playbook = readFileSync(
      join(__dirname, "../src/knowledge/alshantaf-industrial-master-ar.txt"),
      "utf8"
    )
      .replace(/^\uFEFF/, "")
      .trim();
    if (playbook) {
      const existing = await prisma.setting.findUnique({
        where: { key: "assistantMasterKnowledge" },
      });
      if (!existing) {
        await prisma.setting.create({
          data: { key: "assistantMasterKnowledge", value: playbook },
        });
      }
    }
  } catch {
    /* bundled playbook optional in some environments */
  }

  console.log(`Seeded admin user + industry catalog: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

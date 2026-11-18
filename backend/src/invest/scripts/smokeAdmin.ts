import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { signSession } from "../../lib/jwt";

async function main() {
  const p = new PrismaClient();
  const h = await bcrypt.hash("AdminTest!23", 12);
  const u = await p.user.upsert({
    where: { email: "admin@test.com" },
    update: { passwordHash: h, permissions: ["*"] },
    create: { email: "admin@test.com", passwordHash: h, name: "Admin", permissions: ["*"] },
  });
  const token = signSession({ userId: u.id, email: u.email });
  const projects = await p.invProject.findMany();
  process.stdout.write(JSON.stringify({ token, projectId: projects[0]?.id }) + "\n");
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

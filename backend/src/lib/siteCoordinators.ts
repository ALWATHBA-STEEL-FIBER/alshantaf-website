import bcrypt from "bcryptjs";
import { prisma } from "../prisma";

export const SITE_ROLES = ["ENGINEER", "COORDINATOR"] as const;
export type SiteRole = (typeof SITE_ROLES)[number];

export function isCoordinatorRole(role: string | null | undefined): boolean {
  return (role || "").toUpperCase() === "COORDINATOR";
}

/** Default field coordinators who own / pay for projects. */
export const DEFAULT_COORDINATORS = [
  {
    name: "أحمد",
    email: "ahmad@alshantaf.com",
    /** Keep existing password when account already exists. */
    passcode: "Ahmad@2026",
  },
  {
    name: "محمد",
    email: "mohammed@alshantaf.com",
    passcode: "Mohammed@2026",
  },
] as const;

/**
 * Ensure أحمد + محمد exist as COORDINATOR accounts and every active project
 * is assigned to exactly one of them (even split by name when unassigned).
 */
export async function ensureDefaultCoordinators() {
  const coords: Array<{ id: string; name: string; email: string; created: boolean }> = [];

  for (const spec of DEFAULT_COORDINATORS) {
    let eng = await prisma.siteEngineer.findUnique({ where: { email: spec.email } });
    let created = false;
    if (!eng) {
      // Prefer renaming a loose name match that isn't already the other coordinator.
      eng = await prisma.siteEngineer.findFirst({
        where: {
          OR: [
            { name: { equals: spec.name, mode: "insensitive" } },
            { name: { contains: spec.name, mode: "insensitive" } },
            ...(spec.name === "أحمد"
              ? [{ email: "ahmad@alshantaf.com" }, { name: { equals: "admin", mode: "insensitive" as const } }]
              : []),
          ],
          email: { notIn: DEFAULT_COORDINATORS.map((c) => c.email).filter((e) => e !== spec.email) },
        },
      });
    }

    if (!eng) {
      eng = await prisma.siteEngineer.create({
        data: {
          email: spec.email,
          name: spec.name,
          role: "COORDINATOR",
          passwordHash: await bcrypt.hash(spec.passcode, 12),
          active: true,
        },
      });
      created = true;
    } else {
      eng = await prisma.siteEngineer.update({
        where: { id: eng.id },
        data: {
          name: spec.name,
          email: spec.email,
          role: "COORDINATOR",
          active: true,
        },
      });
    }

    coords.push({ id: eng.id, name: eng.name, email: eng.email, created });
  }

  const ahmad = coords.find((c) => c.email === "ahmad@alshantaf.com")!;
  const mohammed = coords.find((c) => c.email === "mohammed@alshantaf.com")!;

  const projects = await prisma.siteProject.findMany({
    where: { active: true },
    select: { id: true, name: true, coordinatorId: true },
    orderBy: { name: "asc" },
  });

  const assignments: Array<{ projectId: string; projectName: string; coordinatorId: string; coordinatorName: string }> =
    [];

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i]!;
    // Keep existing assignment if already one of the two coordinators.
    let coordinatorId = p.coordinatorId;
    if (coordinatorId !== ahmad.id && coordinatorId !== mohammed.id) {
      coordinatorId = i % 2 === 0 ? ahmad.id : mohammed.id;
      await prisma.siteProject.update({
        where: { id: p.id },
        data: { coordinatorId },
      });
    }
    await prisma.siteProjectEngineer.createMany({
      data: [{ projectId: p.id, engineerId: coordinatorId! }],
      skipDuplicates: true,
    });
    const coord = coordinatorId === ahmad.id ? ahmad : mohammed;
    assignments.push({
      projectId: p.id,
      projectName: p.name,
      coordinatorId: coord.id,
      coordinatorName: coord.name,
    });
  }

  // Demote any other non-system accounts that were incorrectly treated as sole "engineers"
  // but keep them as ENGINEER if they exist for field login later.
  await prisma.siteEngineer.updateMany({
    where: {
      id: { notIn: coords.map((c) => c.id) },
      email: { notIn: ["admin-site@alshantaf.local", "site-import@alshantaf.local"] },
      role: "COORDINATOR",
    },
    data: { role: "ENGINEER" },
  });

  return { coordinators: coords, assignments };
}

import bcrypt from "bcryptjs";
import { prisma } from "../prisma";

export const ADMIN_SITE_EMAIL = "admin-site@alshantaf.local";

/** Stable engineer account used when an admin opens the field portal. */
export async function ensureAdminSiteEngineer() {
  let eng = await prisma.siteEngineer.findUnique({ where: { email: ADMIN_SITE_EMAIL } });
  if (!eng) {
    eng = await prisma.siteEngineer.create({
      data: {
        email: ADMIN_SITE_EMAIL,
        name: "إدارة الموقع",
        passwordHash: await bcrypt.hash(`admin-site-${Date.now()}`, 10),
        active: true,
      },
    });
  } else if (!eng.active) {
    eng = await prisma.siteEngineer.update({
      where: { id: eng.id },
      data: { active: true, name: "إدارة الموقع" },
    });
  }
  return eng;
}

export function isAdminSiteEngineer(email: string | null | undefined): boolean {
  return (email || "").toLowerCase() === ADMIN_SITE_EMAIL;
}

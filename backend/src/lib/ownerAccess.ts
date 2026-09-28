import { generateTrackingCode } from "./submissionCode";
import type { PrismaClient } from "@prisma/client";

export async function nextOwnerAccessCode(prisma: PrismaClient): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateTrackingCode(10);
    const existing = await prisma.listing.findUnique({ where: { ownerAccessCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique owner access code");
}

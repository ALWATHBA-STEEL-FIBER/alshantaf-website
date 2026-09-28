import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export async function nextSubmissionSerial(prisma: PrismaClient): Promise<string> {
  const prefix = "REQ-";
  const existing = await prisma.submission.findMany({
    where: { serialNo: { startsWith: prefix } },
    select: { serialNo: true },
  });
  const max = existing.reduce((n, item) => {
    const match = item.serialNo.match(/^REQ-(\d{5})$/);
    return match ? Math.max(n, Number(match[1])) : n;
  }, 0);
  return `${prefix}${String(max + 1).padStart(5, "0")}`;
}

export async function nextLandCheckSerial(prisma: PrismaClient): Promise<string> {
  const prefix = "CHK-";
  const existing = await prisma.landCheck.findMany({
    where: { serialNo: { startsWith: prefix } },
    select: { serialNo: true },
  });
  const max = existing.reduce((n, item) => {
    const match = item.serialNo.match(/^CHK-(\d{5})$/);
    return match ? Math.max(n, Number(match[1])) : n;
  }, 0);
  return `${prefix}${String(max + 1).padStart(5, "0")}`;
}

export async function nextContactRequestSerial(prisma: PrismaClient): Promise<string> {
  const prefix = "CNT-";
  const existing = await prisma.contactRequest.findMany({
    where: { serialNo: { startsWith: prefix } },
    select: { serialNo: true },
  });
  const max = existing.reduce((n, item) => {
    const match = item.serialNo.match(/^CNT-(\d{5})$/);
    return match ? Math.max(n, Number(match[1])) : n;
  }, 0);
  return `${prefix}${String(max + 1).padStart(5, "0")}`;
}

// Avoid visually-ambiguous characters (0/O, 1/I/L) since this code may be read aloud or typed by hand.
const TRACKING_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateTrackingCode(length = 10): string {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += TRACKING_ALPHABET[bytes[i] % TRACKING_ALPHABET.length];
  }
  return code;
}

export async function nextTrackingCode(prisma: PrismaClient): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateTrackingCode();
    const existing = await prisma.submission.findUnique({ where: { trackingCode: code } });
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique tracking code");
}

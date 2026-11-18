import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { OrderBrand } from "@prisma/client";

export function hashOrderToken(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

/** High-entropy URL-safe token (never stored raw). */
export function generateOrderToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function orderTokenPrefix(raw: string): string {
  return raw.slice(0, 8);
}

export async function nextOrderSerial(prisma: PrismaClient, brand: OrderBrand): Promise<string> {
  const prefix = brand === "steelfiber" ? "WS-ORD-" : "AS-ORD-";
  const existing = await prisma.customerOrder.findMany({
    where: { serialNo: { startsWith: prefix } },
    select: { serialNo: true },
  });
  const max = existing.reduce((n, item) => {
    const match = item.serialNo.match(new RegExp(`^${prefix}(\\d{5})$`));
    return match ? Math.max(n, Number(match[1])) : n;
  }, 0);
  return `${prefix}${String(max + 1).padStart(5, "0")}`;
}

export async function mintOrderAccessToken(prisma: PrismaClient, orderId: string) {
  const raw = generateOrderToken();
  const tokenHash = hashOrderToken(raw);
  const tokenPrefix = orderTokenPrefix(raw);
  await prisma.orderAccessToken.create({
    data: { orderId, tokenHash, tokenPrefix },
  });
  return { raw, tokenPrefix };
}

export async function rotateOrderAccessToken(prisma: PrismaClient, orderId: string) {
  await prisma.orderAccessToken.updateMany({
    where: { orderId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return mintOrderAccessToken(prisma, orderId);
}

import type { PrismaClient } from "@prisma/client";

const AREA_CODES: Record<string, string> = {
  "القسطل": "QAS",
  "الجيزة": "JEZ",
  "الموقر": "MUQ",
  "سحاب": "SAH",
  "البيادر": "BAY",
  "الجشام": "JSH",
  "القنيطرة": "QNT",
  "الذهبية": "DHB",
  "الزرقاء": "ZAR",
  "العقبة": "AQB",
  "السلط": "SAL",
  "المفرق": "MAF",
  "الكرك": "KAR",
  "معان": "MAN",
  "منطقة أخرى": "OTH",
};

export function areaCode(area: string): string {
  return AREA_CODES[area] || "OTH";
}

export function normalize(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, "");
}

export function listingKey(area: string | null | undefined, basin: string | null | undefined, parcel: string | null | undefined): string {
  return [area, basin, parcel].map(normalize).join("|");
}

export async function nextListingNo(prisma: PrismaClient, area: string): Promise<string> {
  const code = areaCode(area);
  const prefix = `SH-${code}-`;
  const existing = await prisma.listing.findMany({
    where: { listingNo: { startsWith: prefix } },
    select: { listingNo: true },
  });
  const max = existing.reduce((n, item) => {
    const match = item.listingNo.match(new RegExp(`^SH-${code}-(\\d{4})$`));
    return match ? Math.max(n, Number(match[1])) : n;
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

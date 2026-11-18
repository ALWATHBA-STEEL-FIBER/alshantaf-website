import { toWesternDigits } from "./arabicDigits";
import { parseAreaSqm } from "./areaParse";

export const AREA_ALIASES: Array<{ area: string; patterns: RegExp[] }> = [
  { area: "سحاب", patterns: [/سحاب/i, /\bsahab\b/i] },
  { area: "القسطل", patterns: [/قسطل/i, /\bqastal\b/i, /\bal-?qastal\b/i] },
  { area: "المشتى", patterns: [/مشتى/i, /مشتا/i, /\bmushta\b/i, /\bal-?mushta\b/i] },
  { area: "الزرقاء", patterns: [/زرقاء/i, /\bzarqa\b/i] },
  { area: "الموقر", patterns: [/موقر/i, /\bmuwaqqar\b/i, /\bmuwaqar\b/i] },
  // Live listings use "الجيزه" (ة→ه); keep both spellings discoverable.
  { area: "الجيزه", patterns: [/جيزه/i, /جيزة/i, /\bjiza\b/i, /\bjizah\b/i, /\bal-?jiza\b/i] },
  { area: "خلدا", patterns: [/خلدا/i, /\bkhalda\b/i] },
  { area: "وادي السير", patterns: [/وادي\s*السير/i, /وادي\s*السّ?ير/i, /\bwadi\s*al-?seer\b/i, /\bwadi\s*al-?sir\b/i] },
  { area: "الطنيب", patterns: [/طنيب/i, /\btanib\b/i, /\bal-?tanib\b/i] },
  { area: "عمان", patterns: [/\bعمّ?ان\b/i, /\bamman\b/i] },
];

export type SizeMode = "approx" | "min";

export type SizeFilter = {
  mode: SizeMode;
  sqm: number;
};

export type OfferIntent = {
  area: string | null;
  size: SizeFilter | null;
  wantsOffers: boolean;
  wantsPublish: boolean;
};

/** Owner/broker asking how to list/post a land — not browsing live offers. */
export function isPublishIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /كيف\s*(?:أ|ا)?(?:قدر\s*)?(?:أنشر|انشر|أضيف|اضيف|أقدم|اقدم)/i.test(t) ||
    /(?:أريد|اريد|بدي|بغى|أبي|ابي)\s*(?:أنشر|انشر|أضيف|اضيف)/i.test(t) ||
    /(?:نشر|تقديم|إضافة|اضافة)\s*(?:أرض|ارض|عرض|فرصة)/i.test(t) ||
    /طلب\s*نشر|صفحة\s*النشر|request[- ]?publish/i.test(t) ||
    /how\s+(?:do|can|to)\s+(?:i\s+)?(?:post|publish|list|submit)/i.test(t) ||
    /(?:want|need|like)\s+to\s+(?:post|publish|list|submit)/i.test(t) ||
    /(?:post|publish|list|submit)\s+(?:a\s+|my\s+|an\s+)?(?:land|offer|listing|property|parcel)/i.test(t) ||
    /(?:list|post)\s+my\s+(?:land|offer|property)/i.test(t)
  );
}

/** Hard service routing for how-to / navigation questions (not browse). */
export function detectNavServiceIntent(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  // Track before publish — phrases like "وين وصل طلب النشر" contain "طلب نشر".
  if (
    /تتبع|tracking|track\s*(?:my\s+)?(?:request|submission|code)?|وين\s*وصل\s*طلب|حالة\s*الطلب|رمز\s*التتبع/i.test(
      t
    )
  ) {
    return "track";
  }
  if (isPublishIntent(t)) return "publish";
  if (
    /فحص\s*(?:الأرض|الارض|أرض|ارض)|land[- ]?check|كيف\s*(?:أ|ا)?(?:فحص|افحص)|تنظيم\s*(?:القطعة|الأرض)/i.test(t)
  ) {
    return "land-check";
  }
  if (/بوابة\s*(?:المالك|العرض)|my[- ]?offer|رمز\s*الوصول|owner\s*portal|أدير\s*عرضي/i.test(t)) {
    return "my-offer";
  }
  if (/قيمة\s*إدارية|administrative\s*value|\bdls\b|دائرة\s*الأراضي/i.test(t)) return "gov-dls";
  if (/غذاء|دواء|\bjfda\b|food\s*and\s*drug/i.test(t)) return "gov-jfda";
  if (/تصريح\s*بيئة|environment\s*permit|\bmoenv\b|وزارة\s*البيئة/i.test(t)) return "gov-env";
  if (/^(?:تواصل|اتصل|contact|واتساب|whatsapp|support|دعم)\b/i.test(t)) return "contact";
  if (/\bservices?\b|صفحة\s*الخدمات|شو\s*خدماتكم/i.test(t)) return "services";
  return null;
}

/** Intents that must never dump live offer cards. */
export function isNonBrowseServiceIntent(text: string): boolean {
  const id = detectNavServiceIntent(text);
  return id === "publish" || id === "track" || id === "land-check" || id === "my-offer";
}

const UNIT = String.raw`(?:دونم|dunums?|dounms?|donums?|م²|م2|m²|m2)`;
const MIN_PREFIX =
  /أكثر من|اكثر من|أكبر من|اكبر من|فوق|على الأقل|على الاقل|at least|above|over|more than|greater than|starting from|\+/i;
const MIN_SUFFIX = /فأكثر|فاكثر|وأكثر|واكثر|or more|\+/i;

function unitToSqm(amount: number, unit: string | undefined): number {
  if (unit && /م²|م2|m²|m2/i.test(unit)) return amount;
  // Bare small numbers in this product are dunums.
  return amount * 1000;
}

export function detectArea(text: string): string | null {
  for (const row of AREA_ALIASES) {
    if (row.patterns.some((p) => p.test(text))) return row.area;
  }
  return null;
}

export function parseSizeFilter(text: string): SizeFilter | null {
  const raw = toWesternDigits(text);

  if (/دونمين/i.test(raw)) {
    const min = MIN_PREFIX.test(raw) || MIN_SUFFIX.test(raw);
    return { mode: min ? "min" : "approx", sqm: 2000 };
  }

  const minMatch =
    raw.match(new RegExp(`(?:${MIN_PREFIX.source})\\s*([\\d.]+)\\s*(${UNIT})?`, "i")) ||
    raw.match(new RegExp(`([\\d.]+)\\s*(${UNIT})?\\s*(?:${MIN_SUFFIX.source})`, "i"));
  if (minMatch) {
    const amount = Number(minMatch[1]);
    if (Number.isFinite(amount) && amount > 0) {
      return { mode: "min", sqm: unitToSqm(amount, minMatch[2]) };
    }
  }

  const approx =
    raw.match(new RegExp(`(?:حوالي|قرابة|قرب|قريب(?:ة)? من|around|about|approx(?:imately)?)\\s*([\\d.]+)\\s*(${UNIT})?`, "i")) ||
    raw.match(new RegExp(`([\\d.]+)\\s*(${UNIT})`, "i"));
  if (approx) {
    const amount = Number(approx[1]);
    if (Number.isFinite(amount) && amount > 0) {
      return { mode: "approx", sqm: unitToSqm(amount, approx[2]) };
    }
  }

  return null;
}

export function parseOfferIntent(text: string): OfferIntent {
  const wantsPublish = isPublishIntent(text);
  const nav = detectNavServiceIntent(text);
  const area = detectArea(text);
  const size = parseSizeFilter(text);
  const looking =
    /أبحث|ابحث|بدور|دور(?:ني)?|ورّ?يني|عرض(?:ي)?\s*لي|أخبرني|احكي|شو\s*عندكم|looking for|show me|find(?:\s+me)?|browse|search for|any (?:land|offers?)|tell me about/i.test(
      text
    );
  // Don't treat navigation / gov / how-to questions as "show me listings".
  const suppressOffers =
    wantsPublish ||
    isNonBrowseServiceIntent(text) ||
    (nav != null && nav !== "opportunities" && nav !== "offers");
  const wantsOffers =
    !suppressOffers &&
    (Boolean(area || size) ||
      looking ||
      /فرص(?:ة)?|عروض|قطعة|قطع|هنجر|أراض|اراض|أرض|ارض|lands?|opportunit|industrial\s+land|parcels?/i.test(
        text
      ));
  return { area, size, wantsOffers, wantsPublish };
}

/** Distance for ranking; Infinity = drop. Approx keeps ~0.7×–1.65× (1.7 and 3 vs 2 dunums). */
export function sizeRank(filter: SizeFilter | null, listingSize: string | null): number {
  if (!filter) return 0;
  const got = parseAreaSqm(listingSize);
  if (!got) return 80;
  if (filter.mode === "min") {
    return got + 1e-6 >= filter.sqm * 0.98 ? Math.max(0, got - filter.sqm) : Number.POSITIVE_INFINITY;
  }
  const ratio = got / filter.sqm;
  if (ratio >= 0.7 && ratio <= 1.65) return Math.abs(got - filter.sqm);
  return Number.POSITIVE_INFINITY;
}

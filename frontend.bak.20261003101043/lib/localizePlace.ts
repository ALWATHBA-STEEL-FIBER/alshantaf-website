import { toWesternDigits } from "@/lib/arabicDigits";
import { GOVERNORATE_EN, DIRECTORATE_EN, COMMON_PLACE_EN } from "@/lib/dlsTranslations";
import { transliterate } from "@/lib/transliterate";

/** Display-only localization for DLS place labels. Stored values stay Arabic. */
export function localizePlaceName(label: string, lang: "ar" | "en"): string {
  if (!label || lang === "ar") return label;
  return GOVERNORATE_EN[label] ?? DIRECTORATE_EN[label] ?? COMMON_PLACE_EN[label] ?? transliterate(label);
}

export function industrialLandTitle(village: string, lang: "ar" | "en" = "ar"): string {
  if (!village) return lang === "ar" ? "عرض عقاري جديد" : "New property listing";
  if (lang === "ar") return `أرض صناعية في ${village}`;
  return `Industrial land in ${localizePlaceName(village, "en")}`;
}

/** Localize auto-generated industrial-land titles; custom titles pass through. */
export function localizeListingTitle(title: string, lang: "ar" | "en"): string {
  const arMatch = title.match(/^أرض صناعية في\s+(.+)$/);
  if (arMatch) return industrialLandTitle(arMatch[1], lang);
  const enMatch = title.match(/^Industrial land in\s+(.+)$/i);
  if (enMatch) return industrialLandTitle(enMatch[1], lang);
  if (title === "عرض عقاري جديد" || title === "New property listing") {
    return lang === "ar" ? "عرض عقاري جديد" : "New property listing";
  }
  return title;
}

export function localizePropertyType(type: string | null | undefined, lang: "ar" | "en", fallback: string): string {
  if (!type) return fallback;
  if (type === "أرض صناعية" || /^industrial land$/i.test(type)) {
    return lang === "ar" ? "أرض صناعية" : "Industrial land";
  }
  return type;
}

/** Swap m²/dunum unit labels between AR and EN without changing the numbers. */
export function localizeSizeLabel(size: string | null | undefined, lang: "ar" | "en"): string {
  if (!size) return "";
  if (lang === "en") return size.replace(/م²/g, "m²").replace(/دونم/g, "dunums");
  return size.replace(/m²/g, "م²").replace(/\bdunums?\b/gi, "دونم");
}

/**
 * Display asking price with localized currency + /m².
 * Bare rates like "60" (how most listings are stored) become "60 دينار / م²" or "60 JOD / m²".
 */
export function localizePriceLabel(price: string | null | undefined, lang: "ar" | "en"): string {
  if (!price?.trim()) return "";
  const raw = toWesternDigits(price.trim()).replace(/\s+/g, " ");
  const currency = lang === "ar" ? "دينار" : "JOD";
  const perSqm = lang === "ar" ? "/ م²" : "/ m²";

  if (/(?:م²|m²|م2|m2|sq\.?\s*m)/i.test(raw)) {
    let s = raw;
    if (lang === "en") {
      s = s.replace(/دينار/g, "JOD").replace(/م²|م2/g, "m²");
    } else {
      s = s.replace(/\bJOD\b|\bJD\b/gi, "دينار").replace(/m²|m2/gi, "م²");
    }
    return s.replace(/\s*\/\s*/g, " / ").trim();
  }

  const bare = raw.match(/^([\d,.]+)\s*(?:دينار|JOD|JD)?\s*$/i);
  if (bare) {
    const n = bare[1]!.replace(/,/g, "");
    return `${n} ${currency} ${perSqm}`;
  }

  if (lang === "en") return raw.replace(/دينار/g, "JOD").replace(/م²/g, "m²");
  return raw.replace(/\bJOD\b|\bJD\b/gi, "دينار").replace(/m²/gi, "م²");
}

export function isAutoIndustrialTitle(title: string): boolean {
  return (
    /^أرض صناعية في\s+/.test(title) ||
    /^Industrial land in\s+/i.test(title) ||
    title === "عرض عقاري جديد" ||
    title === "New property listing" ||
    title === ""
  );
}

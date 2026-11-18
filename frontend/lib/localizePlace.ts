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

export function isAutoIndustrialTitle(title: string): boolean {
  return (
    /^أرض صناعية في\s+/.test(title) ||
    /^Industrial land in\s+/i.test(title) ||
    title === "عرض عقاري جديد" ||
    title === "New property listing" ||
    title === ""
  );
}

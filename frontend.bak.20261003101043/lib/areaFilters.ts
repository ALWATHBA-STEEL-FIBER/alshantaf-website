/**
 * Stable area filter keys shared by the homepage Areas Guide and /offers.
 * Listing.area stays Arabic; URLs use `slug` so AR/EN landing links resolve the same way.
 */

export type AreaFilterDef = {
  slug: string;
  /** Arabic names that may appear on listing.area (exact or contained). */
  aliases: string[];
  labelAr: string;
  labelEn: string;
};

export const AREA_FILTERS: AreaFilterDef[] = [
  {
    slug: "qastal",
    aliases: ["القسطل", "المشتى", "قسطل"],
    labelAr: "القسطل الصناعية والمشتى",
    labelEn: "Al-Qastal Industrial Area & Al-Mushta",
  },
  {
    slug: "sahab",
    aliases: ["سحاب"],
    labelAr: "سحاب الصناعية",
    labelEn: "Sahab Industrial Area",
  },
  {
    slug: "muwaqqar",
    aliases: ["الموقر", "موقر"],
    labelAr: "الموقر الصناعية",
    labelEn: "Al-Muwaqqar Industrial Area",
  },
  {
    slug: "bayader",
    aliases: ["البيادر", "بيادر"],
    labelAr: "البيادر الصناعية",
    labelEn: "Al-Bayader Industrial Area",
  },
  {
    slug: "rujm-shami",
    aliases: ["رجم الشامي", "رجم شامي"],
    labelAr: "رجم الشامي",
    labelEn: "Rujm Al-Shami",
  },
  {
    slug: "jizah",
    aliases: ["الجيزة", "جيزة"],
    labelAr: "الجيزة",
    labelEn: "Al-Jizah",
  },
  {
    slug: "qunaytirah",
    aliases: ["القنيطرة", "قنيطرة"],
    labelAr: "القنيطرة",
    labelEn: "Al-Qunaytirah",
  },
  {
    slug: "dhahabiyah",
    aliases: ["الذهبية", "ذهبية"],
    labelAr: "الذهبية",
    labelEn: "Al-Dhahabiyah",
  },
  {
    slug: "zarqa",
    aliases: ["الزرقاء", "زرقاء"],
    labelAr: "الزرقاء",
    labelEn: "Zarqa",
  },
  {
    slug: "dulail",
    aliases: ["الضليل", "ضليل"],
    labelAr: "الضليل",
    labelEn: "Al-Dulail",
  },
  {
    slug: "rajeeb",
    aliases: ["الرجيب", "رجيب"],
    labelAr: "الرجيب",
    labelEn: "Al-Rajeeb",
  },
  {
    slug: "aqaba",
    aliases: ["العقبة", "عقبة"],
    labelAr: "العقبة",
    labelEn: "Aqaba",
  },
  {
    slug: "salt",
    aliases: ["السلط", "سلط"],
    labelAr: "السلط",
    labelEn: "Al-Salt",
  },
  {
    slug: "irbid",
    aliases: ["إربد", "اربد"],
    labelAr: "إربد",
    labelEn: "Irbid",
  },
  {
    slug: "mafraq",
    aliases: ["المفرق", "مفرق"],
    labelAr: "المفرق",
    labelEn: "Mafraq",
  },
  {
    slug: "karak",
    aliases: ["الكرك", "كرك"],
    labelAr: "الكرك",
    labelEn: "Karak",
  },
  {
    slug: "maan",
    aliases: ["معان"],
    labelAr: "معان",
    labelEn: "Ma'an",
  },
];

/** Main Areas Guide cards — index-aligned with `t.areasGuide.areas`. */
export const AREA_GUIDE_SLUGS = [
  "qastal",
  "sahab",
  "muwaqqar",
  "bayader",
  "rujm-shami",
  "jizah",
  "qunaytirah",
  "dhahabiyah",
] as const;

/** Featured area in the homepage guide (special card treatment). */
export const AREA_GUIDE_FEATURED_SLUG = "qastal" as const;

/** “Other areas” chips on the homepage. */
export const AREA_OTHER_SLUGS = [
  "zarqa",
  "dulail",
  "rajeeb",
  "aqaba",
  "salt",
  "irbid",
  "mafraq",
  "karak",
  "maan",
] as const;

export function areaFilterBySlug(slug: string): AreaFilterDef | undefined {
  return AREA_FILTERS.find((f) => f.slug === slug);
}

export function areaFilterLabel(def: AreaFilterDef, lang: "ar" | "en"): string {
  return lang === "ar" ? def.labelAr : def.labelEn;
}

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True when a stored listing.area belongs to this filter definition. */
export function listingAreaMatchesFilter(listingArea: string, def: AreaFilterDef): boolean {
  const area = listingArea.trim();
  if (!area) return false;
  return def.aliases.some((alias) => {
    if (area === alias) return true;
    return area.includes(alias) || alias.includes(area);
  });
}

/**
 * Resolve a `?area=` query value to either a known slug or a raw listing.area key.
 * Accepts slug, AR/EN guide labels, aliases, or a listing area string.
 */
export function resolveAreaQueryParam(param: string | null | undefined): string | null {
  if (!param) return null;
  let decoded = param.trim();
  try {
    decoded = decodeURIComponent(decoded).trim();
  } catch {
    // already decoded
  }
  if (!decoded || decoded === "__all__") return null;

  const n = norm(decoded);
  const bySlug = AREA_FILTERS.find((f) => f.slug === decoded || norm(f.slug) === n);
  if (bySlug) return bySlug.slug;

  const byLabel = AREA_FILTERS.find(
    (f) =>
      norm(f.labelAr) === n ||
      norm(f.labelEn) === n ||
      f.aliases.some((a) => norm(a) === n || decoded.includes(a) || a.includes(decoded))
  );
  if (byLabel) return byLabel.slug;

  return decoded;
}

export function listingMatchesAreaSelection(listingArea: string | null | undefined, selected: string): boolean {
  if (!selected || selected === "__all__") return true;
  if (!listingArea) return false;
  const def = areaFilterBySlug(selected);
  if (def) return listingAreaMatchesFilter(listingArea, def);
  return listingArea === selected;
}

/** Build chip options: guide filters that have listings, then leftover listing areas. */
export function buildAreaChipOptions(listingAreas: string[]): Array<{ key: string; kind: "slug" | "area" }> {
  const unique = [...new Set(listingAreas.filter(Boolean))];
  const covered = new Set<string>();
  const chips: Array<{ key: string; kind: "slug" | "area" }> = [];

  for (const def of AREA_FILTERS) {
    const hits = unique.filter((a) => listingAreaMatchesFilter(a, def));
    if (hits.length === 0) continue;
    chips.push({ key: def.slug, kind: "slug" });
    hits.forEach((a) => covered.add(a));
  }

  for (const area of unique) {
    if (!covered.has(area)) chips.push({ key: area, kind: "area" });
  }

  return chips;
}

export function offersAreaHref(slugOrArea: string): string {
  return `/offers?area=${encodeURIComponent(slugOrArea)}`;
}

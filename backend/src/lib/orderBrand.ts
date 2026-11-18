import type { OrderBrand } from "@prisma/client";

const ALSHANTAF_HOSTS = new Set(["alshantaf.com", "www.alshantaf.com", "localhost", "127.0.0.1"]);
const STEELFIBER_HOSTS = new Set([
  "alwathbasteelfiber.com",
  "www.alwathbasteelfiber.com",
]);

export function publicSiteUrlForBrand(brand: OrderBrand): string {
  if (brand === "steelfiber") {
    return (process.env.STEELFIBER_PUBLIC_SITE_URL || "https://alwathbasteelfiber.com").replace(/\/$/, "");
  }
  return (process.env.PUBLIC_SITE_URL || "https://alshantaf.com").replace(/\/$/, "");
}

export function shareUrlForOrder(brand: OrderBrand, rawToken: string): string {
  return `${publicSiteUrlForBrand(brand)}/o/${encodeURIComponent(rawToken)}`;
}

export function brandFromHost(hostHeader: string | undefined | null): OrderBrand | null {
  if (!hostHeader) return null;
  const host = hostHeader.split(":")[0].trim().toLowerCase();
  if (STEELFIBER_HOSTS.has(host)) return "steelfiber";
  if (ALSHANTAF_HOSTS.has(host)) return "alshantaf";
  // Local / preview: allow either when ORDER_PUBLIC_BRAND override is set
  const override = process.env.ORDER_PUBLIC_BRAND;
  if (override === "steelfiber" || override === "alshantaf") return override;
  return null;
}

export function brandDisplayName(brand: OrderBrand, lang: "ar" | "en" = "ar"): string {
  if (brand === "steelfiber") {
    return lang === "ar" ? "الوثبة للحديد الليفي" : "Al Wathba Steel Fiber";
  }
  return lang === "ar" ? "الشنتف للاستثمار العقاري" : "Al Shantaf Invest";
}

export type BrandTheme = {
  primary: string;
  accent: string;
  accentSoft: string;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  soft: string;
  headerBg: string;
  headerFg: string;
  fontDisplay: string;
  fontBody: string;
  radius: string;
};

export type BrandLetterhead = {
  id: OrderBrand;
  nameAr: string;
  nameEn: string;
  domain: string;
  /** @deprecated use theme.primary — kept for older clients */
  accent: string;
  logoUrl: string;
  logoPrintUrl: string;
  theme: BrandTheme;
};

export function brandLetterhead(brand: OrderBrand): BrandLetterhead {
  const base = publicSiteUrlForBrand(brand);

  if (brand === "steelfiber") {
    return {
      id: "steelfiber",
      nameAr: "الوثبة للحديد الليفي",
      nameEn: "Al Wathba Steel Fiber",
      domain: "alwathbasteelfiber.com",
      accent: "#0a0a0a",
      logoUrl: `${base}/assets/logo-white.png`,
      logoPrintUrl: `${base}/assets/logo.png`,
      theme: {
        primary: "#0a0a0a",
        accent: "#b8892e",
        accentSoft: "#e8bf6f",
        bg: "#f2f3f5",
        surface: "#ffffff",
        ink: "#0d0d0d",
        muted: "#5a5e64",
        line: "#e2e4e7",
        soft: "#f6f5f1",
        headerBg: "#0a0a0a",
        headerFg: "#ffffff",
        fontDisplay: "Cairo",
        fontBody: "Cairo",
        radius: "10px",
      },
    };
  }

  return {
    id: "alshantaf",
    nameAr: "الشنتف للاستثمار العقاري",
    nameEn: "Al Shantaf Invest",
    domain: "alshantaf.com",
    accent: "#0f342f",
    logoUrl: `${base}/logo-mark.webp`,
    logoPrintUrl: `${base}/logo-mark.png`,
    theme: {
      primary: "#0f342f",
      accent: "#c89a58",
      accentSoft: "#d9b57a",
      bg: "#f3efe6",
      surface: "#ffffff",
      ink: "#142028",
      muted: "#5d6b74",
      line: "rgba(20, 32, 40, 0.12)",
      soft: "#f8f5ef",
      headerBg: "#0f342f",
      headerFg: "#ffffff",
      fontDisplay: "Cairo",
      fontBody: "IBM Plex Sans Arabic",
      radius: "14px",
    },
  };
}

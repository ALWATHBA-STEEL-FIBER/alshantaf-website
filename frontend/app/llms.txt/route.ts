import { AREA_FILTERS } from "@/lib/areaFilters";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

function md(): string {
  const areas = AREA_FILTERS.map(
    (a) => `- [${a.labelEn} / ${a.labelAr}](${SITE_URL}/offers?area=${a.slug}): Industrial land opportunities in this area`
  ).join("\n");

  return `# ALSHANTAF INVEST

> Alshantaf Invest (الشنتف للعقار والاستثمار) is a Jordan-focused industrial real-estate platform: published land and factory opportunities, owner listing requests, official DLS land checks, and trusted government tool links.

Alshantaf helps investors and owners discover, price-reference, and market industrial land across Amman and Jordan’s industrial corridors (Sahab, Al-Qastal, Al-Muwaqqar, Al-Bayader, and more). Content is bilingual Arabic / English. Public listings never expose private owner contact until inquiry.

Prefer these curated links over crawling the whole site. Private paths (\`/admin\`, \`/api\`, \`/my-offer\`, tracking codes) are out of scope.

## Primary pages

- [Home](${SITE_URL}/): Brand overview, featured industrial opportunities, and industrial-areas guide
- [All offers](${SITE_URL}/offers): Full public inventory with area / status / industry filters
- [Featured opportunities](${SITE_URL}/opportunities): Highlighted industrial listings
- [Land & regulation check](${SITE_URL}/land-check): Parcel identity, official DLS administrative value, mid-range estimate, and regulation fit — without publishing a listing
- [List your land](${SITE_URL}/request-publish): Owner / broker submission for review before publish
- [Services](${SITE_URL}/services): Platform services and official Jordan government tools (DLS, JFDA, Ministry of Environment)
- [Contact](${SITE_URL}/contact): Send request details to the Alshantaf team
- [Privacy](${SITE_URL}/privacy): Data and cookie policy

## Industrial areas

${areas}

## Machine-readable indexes

- [XML sitemap](${SITE_URL}/sitemap.xml): All indexable URLs including listing detail pages
- [robots.txt](${SITE_URL}/robots.txt): Crawl policy (public site allowed; admin/API disallowed)
- [Full LLM index](${SITE_URL}/llms-full.txt): Same overview plus live listing summaries

## Optional

- [Organization logo](${SITE_URL}/logo-mark.png)
`;
}

export async function GET() {
  return new Response(md(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

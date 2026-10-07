import { getPublicListingsServer } from "@/lib/api";
import { AREA_FILTERS } from "@/lib/areaFilters";
import { SITE_URL } from "@/lib/site";

export const revalidate = 1800;

export async function GET() {
  const listings = await getPublicListingsServer();
  const areas = AREA_FILTERS.map(
    (a) => `- [${a.labelEn}](${SITE_URL}/offers?area=${a.slug}) — ${a.labelAr}`
  ).join("\n");

  const offers =
    listings.length === 0
      ? "_No published listings at the moment._"
      : listings
          .map((l) => {
            const bits = [
              l.listingNo && `No. ${l.listingNo}`,
              l.area,
              l.size,
              l.price,
              l.industryType,
              l.status,
            ]
              .filter(Boolean)
              .join(" · ");
            return `- [${l.title}](${SITE_URL}/offers/${l.id}): ${bits}`;
          })
          .join("\n");

  const body = `# ALSHANTAF INVEST — full index

> Jordan industrial real-estate platform (الشنتف للعقار والاستثمار): live offers, land checks against official DLS data, and owner submissions.

This file is the expanded companion to [${SITE_URL}/llms.txt](${SITE_URL}/llms.txt). Use it when an agent needs listing-level detail.

## Site map

- [Home](${SITE_URL}/)
- [All offers](${SITE_URL}/offers)
- [Featured opportunities](${SITE_URL}/opportunities)
- [Land check](${SITE_URL}/land-check)
- [Request publish](${SITE_URL}/request-publish)
- [Services & gov tools](${SITE_URL}/services)
- [Contact](${SITE_URL}/contact)
- [Privacy](${SITE_URL}/privacy)
- [XML sitemap](${SITE_URL}/sitemap.xml)

## Areas

${areas}

## Live published offers (${listings.length})

${offers}

## Notes for agents

- Listing detail URLs are canonical at \`/offers/{id}\`.
- Area filters use stable slugs: \`/offers?area={slug}\` (e.g. sahab, qastal, muwaqqar).
- Administrative land values come from Jordan’s Department of Lands & Survey (DLS); treat them as official zone rates, not asking prices.
- Do not invent owner phone numbers or unpublished inventory.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
    },
  });
}

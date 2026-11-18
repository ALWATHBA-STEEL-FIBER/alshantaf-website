import type { MetadataRoute } from "next";
import { getPublicListingsServer } from "@/lib/api";
import { AREA_FILTERS } from "@/lib/areaFilters";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

type Entry = MetadataRoute.Sitemap[number];

function page(
  path: string,
  opts: Omit<Entry, "url"> & { priority: number; changeFrequency: Entry["changeFrequency"] }
): Entry {
  return {
    url: path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`,
    ...opts,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    page("/", { lastModified: now, changeFrequency: "daily", priority: 1 }),
    page("/offers", { lastModified: now, changeFrequency: "hourly", priority: 0.95 }),
    page("/opportunities", { lastModified: now, changeFrequency: "daily", priority: 0.9 }),
    page("/land-check", { lastModified: now, changeFrequency: "weekly", priority: 0.85 }),
    page("/services", { lastModified: now, changeFrequency: "weekly", priority: 0.8 }),
    page("/jordan-land-market", { lastModified: now, changeFrequency: "daily", priority: 0.88 }),
    page("/request-publish", { lastModified: now, changeFrequency: "weekly", priority: 0.75 }),
    page("/contact", { lastModified: now, changeFrequency: "monthly", priority: 0.7 }),
    page("/privacy", { lastModified: now, changeFrequency: "yearly", priority: 0.3 }),
    page("/llms.txt", { lastModified: now, changeFrequency: "weekly", priority: 0.4 }),
    page("/llms-full.txt", { lastModified: now, changeFrequency: "daily", priority: 0.35 }),
  ];

  const areaEntries: MetadataRoute.Sitemap = AREA_FILTERS.map((area) =>
    page(`/offers?area=${encodeURIComponent(area.slug)}`, {
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    })
  );

  const listings = await getPublicListingsServer();
  const listingEntries: MetadataRoute.Sitemap = listings.map((listing) => {
    const images = [listing.mainImage, ...(listing.images ?? [])]
      .filter((src): src is string => Boolean(src))
      .map((src) => (src.startsWith("http") ? src : `${SITE_URL}${src.startsWith("/") ? src : `/${src}`}`));

    return {
      url: `${SITE_URL}/offers/${listing.id}`,
      lastModified: listing.updatedAt ? new Date(listing.updatedAt) : now,
      changeFrequency: "daily" as const,
      priority:
        listing.importance === "titanium" || listing.featured
          ? 0.9
          : listing.importance === "platinum"
            ? 0.82
            : listing.importance === "golden"
              ? 0.78
              : 0.7,
      ...(images.length > 0 ? { images } : {}),
    };
  });

  return [...staticEntries, ...areaEntries, ...listingEntries];
}

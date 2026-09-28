import type { Listing, Media } from "@prisma/client";

export function serializeListing(listing: Listing & { media: Media[] }) {
  const images = listing.media
    .filter((m) => m.kind === "image")
    .sort((a, b) => a.position - b.position)
    .map((m) => m.url);
  const video = listing.media.find((m) => m.kind === "video")?.url ?? null;
  const document = listing.media.find((m) => m.kind === "document")?.url ?? null;

  const { media, ...rest } = listing;
  return {
    ...rest,
    images,
    mainImage: listing.mainImage || images[0] || null,
    video,
    document,
  };
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicListingServer } from "@/lib/api";
import { getServerDict } from "@/lib/serverLang";
import { OfferDetail } from "@/components/OfferDetail";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";

export async function generateMetadata(props: PageProps<"/offers/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const listing = await getPublicListingServer(id);
  if (!listing) return {};

  const description = listing.description?.slice(0, 160) || listing.title;
  return {
    title: listing.title,
    description,
    alternates: { canonical: `/offers/${listing.id}` },
    openGraph: {
      title: listing.title,
      description,
      url: `/offers/${listing.id}`,
      images: listing.mainImage ? [listing.mainImage] : undefined,
    },
  };
}

export default async function OfferPage(props: PageProps<"/offers/[id]">) {
  const { id } = await props.params;
  const listing = await getPublicListingServer(id);
  if (!listing) notFound();
  const { t } = await getServerDict();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: t.nav.home, path: "/" },
          { name: t.nav.opportunities, path: "/opportunities" },
          { name: listing.title, path: `/offers/${listing.id}` },
        ]}
      />
      <OfferDetail listing={listing} />
    </>
  );
}

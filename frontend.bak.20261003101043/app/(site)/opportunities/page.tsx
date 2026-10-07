import type { Metadata } from "next";
import { getPublicListingsServer } from "@/lib/api";
import { getServerDict } from "@/lib/serverLang";
import { PageHeaderSpacer } from "@/components/PageHeaderSpacer";
import { FeaturedOffersSection } from "@/components/FeaturedOffersSection";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDict();
  return {
    title: t.offers.title,
    description: t.offers.subtitle,
    alternates: { canonical: "/opportunities" },
    openGraph: { title: t.offers.title, description: t.offers.subtitle, url: "/opportunities" },
  };
}

export default async function OpportunitiesPage() {
  const listings = await getPublicListingsServer();
  const { t } = await getServerDict();

  return (
    <>
      <PageHeaderSpacer />
      <BreadcrumbJsonLd items={[{ name: t.nav.home, path: "/" }, { name: t.nav.opportunities, path: "/opportunities" }]} />
      <FeaturedOffersSection listings={listings} />
    </>
  );
}

import type { Metadata } from "next";
import { getPublicListingsServer } from "@/lib/api";
import { getServerDict } from "@/lib/serverLang";
import { PageHeaderSpacer } from "@/components/PageHeaderSpacer";
import { AllOffersSection } from "@/components/AllOffersSection";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDict();
  return {
    title: t.offers.allTitle,
    description: t.offers.allSubtitle,
    alternates: { canonical: "/offers" },
    openGraph: { title: t.offers.allTitle, description: t.offers.allSubtitle, url: "/offers" },
  };
}

export default async function AllOffersPage() {
  const listings = await getPublicListingsServer();
  const { t } = await getServerDict();

  return (
    <>
      <PageHeaderSpacer />
      <BreadcrumbJsonLd items={[{ name: t.nav.home, path: "/" }, { name: t.nav.offers, path: "/offers" }]} />
      <AllOffersSection listings={listings} />
    </>
  );
}

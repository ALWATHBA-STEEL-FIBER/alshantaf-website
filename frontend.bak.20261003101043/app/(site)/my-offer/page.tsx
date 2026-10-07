import type { Metadata } from "next";
import { getServerDict } from "@/lib/serverLang";
import { PageHeaderSpacer } from "@/components/PageHeaderSpacer";
import { MyOfferPortal } from "@/components/MyOfferPortal";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDict();
  return {
    title: t.myOffer.title,
    description: t.myOffer.subtitle,
    robots: { index: false, follow: false },
  };
}

export default async function MyOfferPage() {
  const { t } = await getServerDict();
  return (
    <>
      <PageHeaderSpacer />
      <BreadcrumbJsonLd items={[{ name: t.nav.home, path: "/" }, { name: t.myOffer.eyebrow, path: "/my-offer" }]} />
      <MyOfferPortal />
    </>
  );
}

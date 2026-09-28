import type { Metadata } from "next";
import { getServerDict } from "@/lib/serverLang";
import { PageHeaderSpacer } from "@/components/PageHeaderSpacer";
import { MoreServices, ComingSoonBanner } from "@/components/MoreServices";
import { GovTools } from "@/components/GovTools";
import { AdvisorCta } from "@/components/AdvisorCta";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDict();
  return {
    title: t.servicesPage.title,
    description: t.servicesPage.subtitle,
    alternates: { canonical: "/services" },
    openGraph: { title: t.servicesPage.title, description: t.servicesPage.subtitle, url: "/services" },
  };
}

export default async function ServicesPage() {
  const { t } = await getServerDict();

  return (
    <>
      <PageHeaderSpacer />
      <BreadcrumbJsonLd items={[{ name: t.nav.home, path: "/" }, { name: t.nav.services, path: "/services" }]} />
      <MoreServices />
      <GovTools />
      <AdvisorCta />
      <ComingSoonBanner />
    </>
  );
}

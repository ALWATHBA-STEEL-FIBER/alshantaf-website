import type { Metadata } from "next";
import { getPublicListingsServer } from "@/lib/api";
import { getServerDict } from "@/lib/serverLang";
import { PageHeaderSpacer } from "@/components/PageHeaderSpacer";
import { JourneyFlow } from "@/components/journey/JourneyFlow";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDict();
  return {
    title: t.journey.flowTitle,
    description: t.journey.subtitle,
    alternates: { canonical: "/journey" },
    robots: { index: false, follow: true },
  };
}

export default async function JourneyPage() {
  const [{ t }, listings] = await Promise.all([getServerDict(), getPublicListingsServer()]);

  return (
    <>
      <PageHeaderSpacer />
      <BreadcrumbJsonLd
        items={[
          { name: t.nav.home, path: "/" },
          { name: t.journey.title, path: "/journey" },
        ]}
      />
      <JourneyFlow listings={listings} />
    </>
  );
}

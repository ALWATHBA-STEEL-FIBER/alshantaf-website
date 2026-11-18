import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeaderSpacer } from "@/components/PageHeaderSpacer";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { JordanLendingMarketPage } from "@/components/market/JordanLendingMarketPage";
import { fetchMarketSnapshotServer } from "@/lib/marketIntelligence";
import { getServerDict } from "@/lib/serverLang";
import { SITE_URL } from "@/lib/site";

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDict();
  return {
    title: t.landMarket.pageTitle,
    description: t.landMarket.pageSubtitle,
    alternates: { canonical: "/jordan-land-market" },
    keywords: [
      "Jordan land market",
      "Jordan parcels",
      "industrial land Jordan",
      "سوق الأراضي الأردن",
      "قطع أراضي صناعية",
    ],
    openGraph: {
      title: t.landMarket.pageTitle,
      description: t.landMarket.pageSubtitle,
      url: "/jordan-land-market",
      type: "website",
    },
  };
}

export default async function JordanLandMarketRoute() {
  const { t } = await getServerDict();
  let snapshot: Awaited<ReturnType<typeof fetchMarketSnapshotServer>> = null;
  try {
    snapshot = await fetchMarketSnapshotServer();
  } catch {
    snapshot = null;
  }

  if (!snapshot || (!snapshot.national && snapshot.offerCount === 0)) {
    redirect("/offers");
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: t.landMarket.pageTitle,
    description: t.landMarket.pageSubtitle,
    url: `${SITE_URL}/jordan-land-market`,
    creator: { "@type": "Organization", name: "Al Shantaf" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHeaderSpacer />
      <BreadcrumbJsonLd
        items={[
          { name: t.nav.home, path: "/" },
          { name: t.landMarket.pageTitle, path: "/jordan-land-market" },
        ]}
      />
      <JordanLendingMarketPage snapshot={snapshot} />
    </>
  );
}

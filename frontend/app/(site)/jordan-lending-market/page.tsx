import type { Metadata } from "next";
import { PageHeaderSpacer } from "@/components/PageHeaderSpacer";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { JordanLendingMarketPage } from "@/components/market/JordanLendingMarketPage";
import { fetchMarketSnapshotServer } from "@/lib/marketIntelligence";
import { SITE_URL } from "@/lib/site";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Jordan Lending Market Intelligence",
  description:
    "Explore Jordan's lending market through live and latest-available credit, financing, SME, microfinance and digital lending indicators from official and reputable sources.",
  alternates: { canonical: "/jordan-lending-market" },
  keywords: [
    "Jordan lending market",
    "Jordan credit market",
    "Jordan digital lending",
    "Jordan fintech market",
    "Jordan SME financing",
    "Jordan banking statistics",
    "Jordan lending statistics",
    "Central Bank of Jordan lending data",
    "Jordan credit facilities",
    "Jordan financing market",
  ],
  openGraph: {
    title: "Jordan Lending Market Intelligence",
    description:
      "Explore Jordan's lending market through live and latest-available credit, financing, SME, microfinance and digital lending indicators from official and reputable sources.",
    url: "/jordan-lending-market",
    type: "website",
  },
};

export default async function JordanLendingMarketRoute() {
  const snapshot = await fetchMarketSnapshotServer();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Jordan Lending Market Intelligence",
    description:
      "Credit facilities, private-sector credit, lending rates and related financing indicators for Jordan from official and reputable sources.",
    url: `${SITE_URL}/jordan-lending-market`,
    creator: { "@type": "Organization", name: "Al Shantaf" },
    temporalCoverage: snapshot?.coverage ?? undefined,
    variableMeasured: snapshot?.metrics.filter((m) => m.available).map((m) => m.metricName) ?? [],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHeaderSpacer />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Jordan Lending Market Intelligence", path: "/jordan-lending-market" },
        ]}
      />
      {snapshot ? (
        <JordanLendingMarketPage snapshot={snapshot} />
      ) : (
        <div className="mx-auto max-w-[720px] px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-green">Jordan Lending Market Intelligence</h1>
          <p className="mt-3 text-sm text-ink-soft">
            Market data is temporarily unavailable. Please try again shortly — we never invent substitute figures.
          </p>
        </div>
      )}
    </>
  );
}

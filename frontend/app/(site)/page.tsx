import dynamic from "next/dynamic";
import { Hero } from "@/components/Hero";
import { CountUpMetrics } from "@/components/CountUpMetrics";
import { IntentGate } from "@/components/journey/IntentGate";
import { FeaturedOffersSection } from "@/components/FeaturedOffersSection";
import { WhyAlshantaf } from "@/components/journey/WhyAlshantaf";
import { AdvisorCta } from "@/components/AdvisorCta";
import { LendingMarketSnapshot } from "@/components/market/LendingMarketSnapshot";
import { getPublicListingsServer } from "@/lib/api";
import { fetchMarketSnapshotServer } from "@/lib/marketIntelligence";

const AreasGuide = dynamic(() => import("@/components/AreasGuide").then((m) => m.AreasGuide), {
  loading: () => <div className="py-16 md:py-20 bg-surface-2 min-h-[320px]" aria-hidden />,
});

const GovToolsHome = dynamic(() => import("@/components/journey/DecisionToolsHome").then((m) => m.DecisionToolsHome), {
  loading: () => <div className="py-16 md:py-20 bg-surface-2 min-h-[280px]" aria-hidden />,
});

export default async function HomePage() {
  const [listings, marketSnapshot] = await Promise.all([
    getPublicListingsServer(),
    fetchMarketSnapshotServer(),
  ]);

  return (
    <>
      <link
        rel="preload"
        as="image"
        href="/hero-industrial-sunset-mobile.avif"
        type="image/avif"
        media="(max-width: 767px)"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href="/hero-industrial-sunset-mobile.webp"
        type="image/webp"
        media="(max-width: 767px)"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href="/hero-industrial-sunset.avif"
        type="image/avif"
        media="(min-width: 768px)"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href="/hero-industrial-sunset.webp"
        type="image/webp"
        media="(min-width: 768px)"
        fetchPriority="high"
      />
      <Hero />
      <CountUpMetrics />
      <LendingMarketSnapshot snapshot={marketSnapshot} />
      <IntentGate />
      <FeaturedOffersSection listings={listings} />
      <AreasGuide />
      <GovToolsHome />
      <WhyAlshantaf />
      <AdvisorCta />
    </>
  );
}

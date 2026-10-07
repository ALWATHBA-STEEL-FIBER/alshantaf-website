"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { LiveOffersGrid } from "@/components/LiveOffersGrid";
import { EmptyState } from "@/components/admin/EmptyState";
import type { Listing } from "@/lib/types";

export function FeaturedOffersSection({ listings }: { listings: Listing[] }) {
  const { t } = useLanguage();
  const featured = listings.filter((l) => l.featured);

  return (
    <section id="opportunities" className="py-16 md:py-20">
      <div className="mx-auto max-w-[1240px] px-4">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div className="max-w-2xl">
            <span className="text-gold text-xs font-bold tracking-wide">{t.offers.eyebrow}</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-2 text-balance">{t.offers.title}</h2>
            <p className="text-ink-soft mt-3 max-w-xl leading-relaxed">{t.offers.subtitle}</p>
          </div>
          <Link
            href="/offers"
            className="h-11 px-5 rounded-full border border-line bg-white/80 font-bold text-sm flex items-center hover:border-gold/50 hover:bg-white transition-colors"
          >
            {t.offers.viewAllCta}
          </Link>
        </div>

        {featured.length === 0 ? (
          <div className="text-center">
            <EmptyState title={t.offers.noFeaturedTitle} note={t.offers.noFeaturedNote} />
            <Link
              href="/offers"
              className="mt-6 inline-flex h-11 px-6 rounded-full bg-green text-white font-bold items-center hover:bg-green-2 transition-colors"
            >
              {t.offers.viewAllCta}
            </Link>
          </div>
        ) : (
          <LiveOffersGrid listings={featured} hideAreaFilter />
        )}
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { LiveOffersGrid } from "@/components/LiveOffersGrid";
import { EmptyState } from "@/components/admin/EmptyState";
import type { Listing } from "@/lib/types";

export function FeaturedOffersSection({ listings }: { listings: Listing[] }) {
  const { t } = useLanguage();
  // Landing page shows titanium-tier offers only (admin-selected).
  const titanium = listings.filter((l) => l.importance === "titanium" || l.featured);

  return (
    <section id="opportunities" className="py-10 sm:py-16 md:py-20">
      <div className="mx-auto max-w-[1240px] px-3 sm:px-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-10 sm:gap-4">
          <div className="max-w-2xl">
            <span className="text-[10px] font-bold tracking-wide text-gold sm:text-xs">{t.offers.eyebrow}</span>
            <h2 className="mt-1.5 text-balance text-2xl font-bold sm:mt-2 sm:text-3xl md:text-4xl">{t.offers.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft sm:mt-3 sm:text-base">{t.offers.subtitle}</p>
          </div>
          <Link
            href="/offers"
            className="inline-flex h-11 cursor-pointer items-center rounded-full border border-line bg-white/80 px-5 text-sm font-bold transition-colors hover:border-gold/50 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {t.offers.viewAllCta}
          </Link>
        </div>

        {titanium.length === 0 ? (
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
          <LiveOffersGrid listings={titanium} hideAreaFilter />
        )}
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { LiveOffersGrid } from "@/components/LiveOffersGrid";
import type { Listing } from "@/lib/types";

export function AllOffersSection({ listings }: { listings: Listing[] }) {
  const { t } = useLanguage();

  return (
    <section id="offers" className="py-16 md:py-20">
      <div className="mx-auto max-w-[1240px] px-4">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div className="max-w-2xl">
            <span className="text-gold text-xs font-bold tracking-wide">{t.offers.allEyebrow}</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-2 text-balance">{t.offers.allTitle}</h2>
            <p className="text-ink-soft mt-3 max-w-xl leading-relaxed">{t.offers.allSubtitle}</p>
          </div>
          <Link
            href="/request-publish"
            className="h-11 px-5 rounded-full border border-line bg-white/80 font-bold text-sm flex items-center hover:border-gold/50 hover:bg-white transition-colors"
          >
            {t.offers.submitCta}
          </Link>
        </div>
        <LiveOffersGrid listings={listings} />
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { HeroMobileActions } from "@/components/HeroMobileActions";

/** Client hero copy so language toggle updates text immediately. */
export function HeroCopy({ phone }: { phone: string }) {
  const { t } = useLanguage();

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center px-4 pt-[calc(var(--spacing)*28)] pb-10 text-center text-white md:pt-[calc(var(--spacing)*68)] md:pb-16">
      <p className="animate-hero-rise text-xs font-bold uppercase tracking-[0.18em] text-gold md:text-base">
        ALSHANTAF INVEST
      </p>
      <p className="animate-hero-rise mt-3 max-w-3xl text-xl font-bold leading-tight text-white [overflow-wrap:anywhere] md:mt-8 md:text-5xl lg:text-6xl">
        {t.hero.taglinePrefix} <span className="whitespace-nowrap text-gold">{t.hero.taglineEm}</span>
      </p>
      <h1 className="animate-hero-rise delay-1 mt-3 max-w-3xl text-[1.85rem] font-bold leading-[1.15] [overflow-wrap:anywhere] md:mt-8 md:text-6xl lg:text-7xl">
        {t.hero.titleA}{" "}
        <span className="text-gold">{t.hero.titleEm}</span>
        <span className="mt-1.5 block md:mt-3">{t.hero.titleB}</span>
      </h1>
      <p className="animate-hero-rise delay-2 mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/85 md:mt-5 md:line-clamp-none md:text-lg">
        {t.hero.subtitle}
      </p>

      {/* Mobile: iconized service dock so first viewport feels active */}
      <HeroMobileActions />

      <div className="animate-hero-rise delay-3 mt-6 hidden flex-wrap justify-center gap-3 md:mt-9 md:flex">
        <Link href="/offers" className="btn-hero-primary">
          {t.offers.viewAllCta}
          <span aria-hidden className="rtl:rotate-180">
            →
          </span>
        </Link>
        <a href={`tel:${phone}`} className="btn-hero-secondary">
          {t.hero.advisorCta}
        </a>
      </div>

      <a
        href={`tel:${phone}`}
        className="animate-hero-rise delay-3 mt-3 inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-white/40 px-5 text-[11px] font-bold text-white/90 transition-colors active:bg-white/10 md:hidden"
      >
        {t.hero.advisorCta}
      </a>
    </div>
  );
}

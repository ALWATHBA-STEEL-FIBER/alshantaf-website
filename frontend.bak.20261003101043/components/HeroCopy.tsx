"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";

/** Client hero copy so language toggle updates text immediately. */
export function HeroCopy({ phone }: { phone: string }) {
  const { t } = useLanguage();

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pt-[calc(var(--spacing)*32)] pb-16 md:pt-[calc(var(--spacing)*68)] text-white flex flex-col items-center text-center">
      <p className="animate-hero-rise text-gold font-bold tracking-[0.18em] text-sm md:text-base uppercase">
        ALSHANTAF INVEST
      </p>
      <p className="animate-hero-rise mt-6 md:mt-8 text-3xl md:text-5xl lg:text-6xl font-bold leading-tight max-w-3xl text-white [overflow-wrap:anywhere]">
        {t.hero.taglinePrefix} <span className="text-gold whitespace-nowrap">{t.hero.taglineEm}</span>
      </p>
      <h1 className="animate-hero-rise delay-1 mt-6 md:mt-8 text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.12] max-w-3xl [overflow-wrap:anywhere]">
        {t.hero.titleA}{" "}
        <span className="text-gold">{t.hero.titleEm}</span>
        <span className="block mt-2 md:mt-3">{t.hero.titleB}</span>
      </h1>
      <p className="animate-hero-rise delay-2 mt-5 max-w-xl text-white/85 leading-relaxed text-base md:text-lg">
        {t.hero.subtitle}
      </p>
      <div className="animate-hero-rise delay-3 mt-9 flex flex-wrap justify-center gap-3">
        <Link href="/opportunities" className="btn-hero-primary">
          {t.hero.exploreCta}
          <span aria-hidden className="rtl:rotate-180">
            →
          </span>
        </Link>
        <a href={`tel:${phone}`} className="btn-hero-secondary">
          {t.hero.advisorCta}
        </a>
      </div>
    </div>
  );
}

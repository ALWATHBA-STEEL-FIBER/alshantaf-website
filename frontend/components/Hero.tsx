import Link from "next/link";
import { getServerDict } from "@/lib/serverLang";
import { getPublicSettingsServer } from "@/lib/api";

/**
 * Server-rendered LCP hero: one native <picture> (mobile OR desktop),
 * no next/image JS, no dual downloads, high fetch priority.
 */
export async function Hero() {
  const [{ t }, settings] = await Promise.all([getServerDict(), getPublicSettingsServer()]);
  const phone = (settings?.contactPhone1 || "+962799996668").replace(/\s/g, "");

  return (
    <section id="top" className="relative min-h-[100svh] overflow-hidden flex items-start">
      <div className="absolute inset-0 -z-10">
        <picture>
          <source
            media="(max-width: 767px)"
            srcSet="/hero-industrial-sunset-mobile.avif"
            type="image/avif"
            width={720}
            height={1104}
          />
          <source
            media="(max-width: 767px)"
            srcSet="/hero-industrial-sunset-mobile.webp"
            type="image/webp"
            width={720}
            height={1104}
          />
          <source
            media="(min-width: 768px)"
            srcSet="/hero-industrial-sunset.avif"
            type="image/avif"
            width={1400}
            height={788}
          />
          <img
            src="/hero-industrial-sunset.webp"
            alt=""
            width={1400}
            height={788}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-b from-green/85 via-green/35 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(202,160,100,0.22),transparent_55%)]" />
      </div>

      <div className="mx-auto w-full max-w-[1240px] px-4 pt-[calc(var(--spacing)*32)] pb-16 md:pt-[calc(var(--spacing)*68)] text-white flex flex-col items-center text-center">
        <p className="animate-hero-rise text-gold font-bold tracking-[0.18em] text-sm md:text-base uppercase">
          ALSHANTAF INVEST
        </p>
        <p className="animate-hero-rise mt-4 text-3xl md:text-5xl lg:text-6xl font-bold leading-tight max-w-3xl text-white [overflow-wrap:anywhere]">
          {t.hero.taglinePrefix} <span className="text-gold whitespace-nowrap">{t.hero.taglineEm}</span>
        </p>
        <h1 className="animate-hero-rise delay-1 mt-4 text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.08] max-w-3xl [overflow-wrap:anywhere]">
          {t.hero.titleA}{" "}
          <span className="text-gold">{t.hero.titleEm}</span>
          <br />
          {t.hero.titleB}
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
    </section>
  );
}

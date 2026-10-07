"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import {
  AREA_GUIDE_FEATURED_SLUG,
  AREA_GUIDE_SLUGS,
  AREA_OTHER_SLUGS,
  areaFilterBySlug,
  areaFilterLabel,
  offersAreaHref,
} from "@/lib/areaFilters";

export function AreasGuide() {
  const { t, lang } = useLanguage();

  return (
    <section className="py-16 md:py-20 bg-surface-2 content-visibility-auto">
      <div className="mx-auto max-w-[1240px] px-4">
        <div className="max-w-2xl">
          <span className="text-gold text-xs font-bold tracking-wide">{t.areasGuide.eyebrow}</span>
          <h2 className="text-3xl md:text-5xl font-bold mt-3 text-balance">{t.areasGuide.title}</h2>
          <p className="text-ink-soft mt-4 leading-relaxed text-base md:text-lg">{t.areasGuide.subtitle}</p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.areasGuide.areas.map((area, index) => {
            const slug = AREA_GUIDE_SLUGS[index] ?? AREA_GUIDE_SLUGS[0];
            const featured = slug === AREA_GUIDE_FEATURED_SLUG;

            return (
              <details
                key={slug}
                className={
                  featured
                    ? "group relative rounded-3xl sm:col-span-2 lg:col-span-3 border-2 border-gold/70 bg-gradient-to-br from-white via-white to-gold/10 shadow-[0_0_0_1px_rgba(200,154,88,0.25),0_20px_48px_-28px_rgba(200,154,88,0.55)] open:shadow-[0_0_0_1px_rgba(200,154,88,0.35),0_28px_50px_-28px_rgba(15,52,47,0.35)] transition-shadow duration-300"
                    : "group relative rounded-3xl border border-line bg-white/85 open:bg-white transition-colors duration-300 open:shadow-[0_28px_50px_-32px_rgba(15,52,47,0.4)] open:sm:col-span-2 open:lg:col-span-3"
                }
              >
                {featured && (
                  <div
                    className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-gold/40"
                    aria-hidden
                  />
                )}
                <summary className="list-none cursor-pointer p-6 md:p-7 flex items-start gap-4 [&::-webkit-details-marker]:hidden relative">
                  <span
                    className={`shrink-0 font-mono text-xs font-bold pt-1 ${
                      featured ? "text-gold text-sm tracking-wide" : "text-gold"
                    }`}
                  >
                    {area.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`font-bold leading-snug ${featured ? "text-xl md:text-2xl text-green" : "text-lg"}`}>
                        {area.title}
                      </h3>
                      {featured && (
                        <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-gold/20 text-[10px] font-bold text-[#6b4d1f] border border-gold/40">
                          {t.areasGuide.featuredBadge}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm text-ink-soft mt-1.5 leading-relaxed ${featured ? "max-w-3xl" : ""}`}>
                      {area.note}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center transition-transform duration-300 group-open:rotate-45 ${
                      featured
                        ? "border-gold/60 text-gold bg-gold/10 group-open:border-gold group-open:bg-gold/15"
                        : "border-line text-ink-soft group-open:border-gold group-open:text-gold"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </summary>

                <div className={`px-6 pb-7 -mt-1 border-t pt-5 relative ${featured ? "border-gold/25 md:px-7" : "border-line"}`}>
                  <p className="text-sm text-ink-soft leading-relaxed">{area.body}</p>

                  {area.highlights.length > 0 && (
                    <div className="mt-5 grid sm:grid-cols-2 gap-3">
                      {area.highlights.map((h) => (
                        <div
                          key={h.title}
                          className={`rounded-2xl p-3.5 ${
                            featured
                              ? "border border-gold/30 bg-gold/5"
                              : "border border-line bg-surface-2/70"
                          }`}
                        >
                          <b className="block text-sm text-green">{h.title}</b>
                          <span className="block text-xs text-ink-soft mt-1 leading-relaxed">{h.note}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {area.blocks.map((block) => (
                    <div key={block.title} className="mt-5">
                      <h4 className="font-bold text-sm">{block.title}</h4>
                      <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">{block.body}</p>
                      {block.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {block.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gold/15 text-[#6b4d1f]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <Link
                    href={offersAreaHref(slug)}
                    className={`mt-6 inline-flex items-center gap-2 text-sm font-bold transition-colors ${
                      featured ? "text-gold hover:text-green" : "text-green hover:text-gold"
                    }`}
                  >
                    {area.cta}
                    <span aria-hidden className="rtl:rotate-180">
                      →
                    </span>
                  </Link>
                </div>
              </details>
            );
          })}
        </div>

        <div className="mt-6 rounded-3xl border border-line bg-white/70 p-6 md:p-7 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
          <div className="md:max-w-xs shrink-0">
            <h3 className="font-bold text-lg">{t.areasGuide.otherTitle}</h3>
            <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">{t.areasGuide.otherNote}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {AREA_OTHER_SLUGS.map((slug) => {
              const def = areaFilterBySlug(slug);
              if (!def) return null;
              return (
                <Link
                  key={slug}
                  href={offersAreaHref(slug)}
                  className="h-10 px-4 rounded-full border border-line bg-surface-2 text-sm font-semibold flex items-center hover:border-gold/50 hover:text-green transition-colors"
                >
                  {areaFilterLabel(def, lang)}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

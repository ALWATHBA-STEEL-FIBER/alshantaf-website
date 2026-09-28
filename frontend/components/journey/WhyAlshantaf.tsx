"use client";

import { useLanguage } from "@/lib/LanguageProvider";

export function WhyAlshantaf() {
  const { t } = useLanguage();
  const copy = t.journey.why;

  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-[1240px] px-4">
        <div className="max-w-2xl">
          <span className="text-gold text-xs font-bold tracking-wide">{copy.eyebrow}</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-2 text-balance">{copy.title}</h2>
          <p className="text-ink-soft mt-3 leading-relaxed">{copy.subtitle}</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {copy.points.map((point) => (
            <div key={point.title} className="rounded-3xl border border-line bg-white/80 p-6">
              <span className="block w-8 h-[3px] rounded-full bg-gold mb-4" aria-hidden />
              <h3 className="font-bold text-lg">{point.title}</h3>
              <p className="mt-2 text-sm text-ink-soft leading-relaxed">{point.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

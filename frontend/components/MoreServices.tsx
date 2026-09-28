"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";

export function MoreServices() {
  const { t } = useLanguage();

  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-[1240px] px-4">
        <div className="max-w-2xl">
          <span className="text-gold text-xs font-bold tracking-wide">{t.servicesPage.eyebrow}</span>
          <h1 className="text-3xl md:text-5xl font-bold mt-3 text-balance">{t.servicesPage.title}</h1>
          <p className="text-ink-soft mt-4 leading-relaxed text-base md:text-lg">{t.servicesPage.subtitle}</p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {t.servicesPage.items.map((item) => {
            const className =
              "group relative overflow-hidden rounded-3xl border border-line bg-white/85 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-gold/45 hover:shadow-[0_28px_50px_-32px_rgba(15,52,47,0.4)]";
            const body = (
              <>
                <div
                  className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(600px 180px at 0% 0%, rgba(200,154,88,0.12), transparent 55%)",
                  }}
                  aria-hidden
                />
                <span className="relative block w-10 h-[3px] rounded-full bg-gold mb-5" aria-hidden />
                <h2 className="relative text-xl font-bold leading-snug group-hover:text-green transition-colors">
                  {item.title}
                </h2>
                <p className="relative mt-3 text-sm text-ink-soft leading-relaxed">{item.note}</p>
                <span className="relative mt-6 inline-flex items-center gap-2 text-sm font-bold text-green">
                  {item.cta}
                  <span aria-hidden className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180">
                    →
                  </span>
                </span>
              </>
            );

            if (item.href.startsWith("#")) {
              return (
                <a key={item.title} href={item.href} className={className}>
                  {body}
                </a>
              );
            }

            return (
              <Link key={item.title} href={item.href} className={className}>
                {body}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ComingSoonBanner() {
  const { t } = useLanguage();

  return (
    <section className="pb-20">
      <div className="mx-auto max-w-[1240px] px-4">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-green text-white p-10 md:p-12">
          <div className="absolute -top-20 -end-16 w-64 h-64 rounded-full bg-gold/20 blur-3xl pointer-events-none" aria-hidden />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" aria-hidden />
          <div className="relative max-w-xl">
            <h2 className="font-bold text-xl md:text-2xl">{t.servicesPage.comingSoonTitle}</h2>
            <p className="text-white/75 text-sm mt-3 leading-relaxed">{t.servicesPage.comingSoonNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useLanguage } from "@/lib/LanguageProvider";
import { useSettings } from "@/lib/SettingsProvider";

export function AdvisorCta() {
  const { t } = useLanguage();
  const settings = useSettings();

  return (
    <section className="py-14 md:py-20">
      <div className="mx-auto max-w-[1240px] px-4">
        <div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-line bg-green p-7 text-white md:flex-row md:items-center md:justify-between md:p-12">
          <div className="pointer-events-none absolute -end-16 -top-20 h-64 w-64 rounded-full bg-gold/20 blur-3xl" aria-hidden />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" aria-hidden />
          <div className="relative max-w-xl">
            <h2 className="text-xl font-bold md:text-2xl">{t.servicesPage.advisorTitle}</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/75">{t.servicesPage.advisorNote}</p>
          </div>
          <a
            href={`tel:${settings.contactPhone1.replace(/\s/g, "")}`}
            className="relative inline-flex h-12 w-fit shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-7 font-bold text-green transition-colors hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            {t.servicesPage.advisorCta}
          </a>
        </div>
      </div>
    </section>
  );
}

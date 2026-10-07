"use client";

import { useLanguage } from "@/lib/LanguageProvider";
import { useSettings } from "@/lib/SettingsProvider";

export function AdvisorCta() {
  const { t } = useLanguage();
  const settings = useSettings();

  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-[1240px] px-4">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-green text-white p-10 md:p-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="absolute -top-20 -end-16 w-64 h-64 rounded-full bg-gold/20 blur-3xl pointer-events-none" aria-hidden />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" aria-hidden />
          <div className="relative max-w-xl">
            <h2 className="font-bold text-xl md:text-2xl">{t.servicesPage.advisorTitle}</h2>
            <p className="text-white/75 text-sm mt-3 leading-relaxed">{t.servicesPage.advisorNote}</p>
          </div>
          <a
            href={`tel:${settings.contactPhone1.replace(/\s/g, "")}`}
            className="relative shrink-0 h-12 px-7 rounded-full bg-white text-green font-bold flex items-center justify-center gap-2 w-fit hover:bg-white/90 transition-colors"
          >
            {t.servicesPage.advisorCta}
          </a>
        </div>
      </div>
    </section>
  );
}

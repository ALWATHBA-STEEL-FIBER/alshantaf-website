"use client";

import { useLanguage } from "@/lib/LanguageProvider";

/** Official logos mirrored from each agency’s public site (index-aligned with dictionary govTools). */
const GOV_TOOL_LOGOS = [
  { src: "/gov/dls.png", alt: "دائرة الأراضي والمساحة" },
  { src: "/gov/moenv.png", alt: "وزارة البيئة" },
  { src: "/gov/jfda.png", alt: "المؤسسة العامة للغذاء والدواء" },
] as const;

type Props = {
  eyebrow?: string;
  heading?: string;
  subtitle?: string;
};

export function GovTools({ eyebrow, heading, subtitle }: Props) {
  const { t } = useLanguage();

  return (
    <section className="py-16 md:py-20 bg-surface-2">
      <div className="mx-auto max-w-[1240px] px-4">
        <div className="max-w-2xl">
          <span className="text-gold text-xs font-bold tracking-wide">
            {eyebrow ?? t.servicesPage.govToolsTitle}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mt-3 text-balance">
            {heading ?? t.servicesPage.govToolsHeading}
          </h2>
          <p className="text-ink-soft mt-4 leading-relaxed text-base md:text-lg">
            {subtitle ?? t.servicesPage.govToolsSubtitle}
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.servicesPage.govTools.map((tool, index) => {
            const logo = GOV_TOOL_LOGOS[index];
            return (
              <a
                key={tool.title}
                href={tool.href}
                target="_blank"
                rel="noopener"
                className="group relative overflow-hidden rounded-3xl border border-line bg-white/85 p-7 transition-all duration-300 hover:-translate-y-1 hover:border-gold/45 hover:shadow-[0_28px_50px_-32px_rgba(15,52,47,0.4)]"
              >
                <div
                  className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"
                  style={{
                    background: "radial-gradient(600px 180px at 0% 0%, rgba(200,154,88,0.12), transparent 55%)",
                  }}
                  aria-hidden
                />
                {logo && (
                  <div className="relative mb-5 flex h-14 items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo.src}
                      alt={logo.alt}
                      width={160}
                      height={56}
                      className="max-h-14 w-auto max-w-[160px] object-contain object-start"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}
                <h3 className="relative text-xl font-bold leading-snug group-hover:text-green transition-colors">
                  {tool.title}
                </h3>
                {"agency" in tool && tool.agency && (
                  <p className="relative mt-2 text-[11px] font-bold text-gold">
                    {tool.agency}
                    {"service" in tool && tool.service ? ` · ${tool.service}` : ""}
                  </p>
                )}
                <p className="relative mt-3 text-sm text-ink-soft leading-relaxed">{tool.note}</p>
                <span className="relative mt-6 inline-flex items-center gap-2 text-sm font-bold text-green">
                  {tool.cta}
                  <span
                    aria-hidden
                    className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180"
                  >
                    ↗
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useLanguage } from "@/lib/LanguageProvider";
import {
  ColumnChart,
  HorizontalBars,
  MultiSeriesLineChart,
  TrendLineChart,
} from "@/components/market/MarketCharts";
import { LandMarketWidgetBoard } from "@/components/market/LandMarketWidgetBoard";
import { kpiDisplay, kpiHint, kpiLabel, type LandMarketSnapshot } from "@/lib/marketIntelligence";

const GREEN = "#0f342f";
const GOLD = "#c89a58";
const TEAL = "#2a6f66";

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      className="mt-10 sm:mt-14"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.45 }}
    >
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-green">{title}</h2>
      {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}

function KpiGrid({ items, lang }: { items?: LandMarketSnapshot["kpis"] | null; lang: "ar" | "en" }) {
  if (!items?.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
      {items.map((k, i) => (
        <motion.div
          key={k.key}
          className="rounded-2xl border border-line bg-white px-3 py-3.5 sm:p-4"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.03 }}
        >
          <p className="text-[10px] sm:text-[11px] text-ink-soft leading-snug">{kpiLabel(k, lang)}</p>
          <p className="mt-1.5 text-lg sm:text-2xl font-bold tabular-nums text-green">{kpiDisplay(k, lang)}</p>
          {kpiHint(k, lang) && <p className="mt-1 text-[10px] text-ink-soft/80 leading-snug">{kpiHint(k, lang)}</p>}
        </motion.div>
      ))}
    </div>
  );
}

export function JordanLendingMarketPage({ snapshot }: { snapshot: LandMarketSnapshot }) {
  const { lang, t } = useLanguage();
  if (!snapshot?.updatedAt || !snapshot.platform || !snapshot.dlsRates) return null;
  const national = snapshot.national;
  const platform = snapshot.platform;
  const dls = snapshot.dlsRates;
  const charts = national?.charts;
  const updated = typeof snapshot.updatedAt === "string" ? snapshot.updatedAt.slice(0, 10) : "";
  const money = (n: number) =>
    n.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO", { maximumFractionDigits: 0 });

  return (
    <div className="bg-bg text-ink pb-16 sm:pb-24">
      <div className="relative overflow-hidden bg-green text-white">
        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
          <div className="absolute -top-16 -end-10 w-64 h-64 rounded-full bg-gold/20 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-[1240px] px-3 sm:px-4 py-10 sm:py-14">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <p className="text-[10px] sm:text-xs font-bold tracking-[0.18em] text-gold uppercase">
              {t.landMarket.eyebrow}
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-balance">
              {t.landMarket.pageTitle}
            </h1>
            <p className="mt-3 text-sm sm:text-base text-white/75 leading-relaxed">{t.landMarket.pageSubtitle}</p>
            <p className="mt-4 text-[11px] font-mono text-white/50" dir="ltr">
              {t.landMarket.updated} {updated}
              {national?.source.period ? ` · REPI ${national.source.period}` : ""}
              {platform.offerCount ? ` · ${platform.offerCount} ${lang === "ar" ? "عرض على المنصة" : "platform offers"}` : ""}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-[1240px] px-3 sm:px-4">
        {national && (
          <Section title={t.landMarket.sectionBoard} subtitle={t.landMarket.sectionBoardNote}>
            {national.kpis.length > 0 && (
              <div className="mb-6">
                <KpiGrid items={national.kpis} lang={lang} />
              </div>
            )}
            <LandMarketWidgetBoard snapshot={snapshot} />
            <p className="mt-3 text-[11px] text-ink-soft">
              <a
                href={national.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green font-semibold hover:underline"
              >
                {lang === "ar" ? national.source.nameAr : national.source.name}
              </a>
              {" · "}
              {lang === "ar" ? "أحدث نشرة رسمية متاحة" : "Latest available official bulletin"}
              {national.source.period ? ` (${national.source.period})` : ""}
            </p>
            {snapshot.ase && (
              <p className="mt-2 text-[11px] text-ink-soft">
                {t.landMarket.aseNote}{" "}
                <a
                  href={snapshot.ase.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green font-semibold hover:underline"
                >
                  {lang === "ar" ? snapshot.ase.source.nameAr : snapshot.ase.source.name}
                </a>
              </p>
            )}
          </Section>
        )}

        {national && (charts?.landsTrend?.length ?? 0) >= 2 && (
          <Section title={t.landMarket.sectionNational} subtitle={t.landMarket.sectionNationalNote}>
            <MultiSeriesLineChart
              lang={lang}
              title={t.landMarket.chartRepiTrends}
              series={[
                {
                  key: "lands",
                  labelAr: "أراضي",
                  labelEn: "Lands",
                  points: charts?.landsTrend,
                  color: GREEN,
                },
                {
                  key: "industrial",
                  labelAr: "أراضي صناعية",
                  labelEn: "Industrial land",
                  points: charts?.industrialTrend,
                  color: GOLD,
                },
                {
                  key: "general",
                  labelAr: "العام",
                  labelEn: "General",
                  points: charts?.generalTrend,
                  color: TEAL,
                },
              ]}
            />
            {(charts?.landsCommercialTrend?.length ?? 0) >= 2 && (
              <div className="mt-4">
                <MultiSeriesLineChart
                  lang={lang}
                  title={t.landMarket.chartRepiLandTrends}
                  series={[
                    {
                      key: "lands_commercial",
                      labelAr: "أراضي تجارية",
                      labelEn: "Commercial land",
                      points: charts?.landsCommercialTrend,
                      color: GOLD,
                    },
                    {
                      key: "lands_industrial",
                      labelAr: "أراضي صناعية",
                      labelEn: "Industrial land",
                      points: charts?.industrialTrend,
                      color: TEAL,
                    },
                  ]}
                />
              </div>
            )}
          </Section>
        )}

        {((dls.kpis?.length ?? 0) > 0 || (dls.byArea?.length ?? 0) > 0) && (
          <Section title={t.landMarket.sectionDls} subtitle={t.landMarket.sectionDlsNote}>
            <KpiGrid items={dls.kpis} lang={lang} />
            {(dls.byArea?.length ?? 0) > 0 && (
              <div className="mt-4">
                <HorizontalBars
                  points={dls.byArea}
                  lang={lang}
                  title={t.landMarket.chartDlsByArea}
                  unitSuffix={lang === "ar" ? "د/م²" : "JOD/m²"}
                  valueFormat={money}
                />
              </div>
            )}
          </Section>
        )}

        {(platform.offerCount ?? 0) > 0 && (
          <Section title={t.landMarket.sectionPlatform} subtitle={t.landMarket.sectionPlatformNote}>
            <KpiGrid items={platform.kpis} lang={lang} />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <HorizontalBars points={platform.charts?.byArea} lang={lang} title={t.landMarket.chartByArea} />
              <ColumnChart points={platform.charts?.byStatus} lang={lang} title={t.landMarket.chartByStatus} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <ColumnChart points={platform.charts?.byDeal} lang={lang} title={t.landMarket.chartByDeal} />
              {(platform.charts?.listingsByMonth?.length ?? 0) >= 2 && (
                <TrendLineChart
                  points={platform.charts?.listingsByMonth}
                  lang={lang}
                  title={t.landMarket.chartTrend}
                />
              )}
            </div>
          </Section>
        )}

        {(snapshot.sources?.length ?? 0) > 0 && (
          <Section title={t.landMarket.sectionSources}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {(snapshot.sources ?? []).map((s) => (
                <li key={s.key + s.url} className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-green hover:underline"
                  >
                    {lang === "ar" ? s.nameAr || s.name : s.name}
                  </a>
                  <p className="mt-0.5 text-[10px] text-ink-soft">
                    {s.frequency}
                    {s.period ? ` · ${s.period}` : ""}
                    {s.retrievedAt ? ` · ${s.retrievedAt.slice(0, 10)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="mt-12 flex flex-col sm:flex-row gap-3">
          <Link
            href="/offers"
            className="inline-flex h-11 items-center justify-center rounded-full bg-green px-5 text-sm font-bold text-white hover:bg-green-2 transition-colors"
          >
            {t.landMarket.browseOffers}
          </Link>
          <Link
            href="/opportunities"
            className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-white px-5 text-sm font-bold text-green hover:border-gold/50 transition-colors"
          >
            {t.nav.opportunities}
          </Link>
        </div>
      </div>
    </div>
  );
}

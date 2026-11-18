"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useLanguage } from "@/lib/LanguageProvider";
import {
  ColumnChart,
  DivergingChangeBars,
  HorizontalBars,
  MultiSeriesLineChart,
  RadialIndexMix,
  TrendLineChart,
} from "@/components/market/MarketCharts";
import { kpiDisplay, kpiHint, kpiLabel, type LandMarketSnapshot } from "@/lib/marketIntelligence";

const GREEN = "#0f342f";
const GOLD = "#c89a58";
const TEAL = "#2a6f66";

export function LendingMarketSnapshot({ snapshot }: { snapshot: LandMarketSnapshot | null }) {
  const { lang, t } = useLanguage();
  // Guard: API may still return the older credit-market shape without land fields.
  if (!snapshot?.updatedAt || !snapshot.platform || !snapshot.dlsRates) return null;
  if (!snapshot.national && snapshot.offerCount === 0) return null;

  const national = snapshot.national;
  const charts = national?.charts;
  const updated = typeof snapshot.updatedAt === "string" ? snapshot.updatedAt.slice(0, 10) : "";
  const homeKpis = [
    ...(national?.kpis ?? []),
    ...(snapshot.dlsRates.kpis ?? []),
    ...(snapshot.platform.kpis ?? []),
  ].slice(0, 8);

  return (
    <section className="relative overflow-hidden bg-surface-2 py-12 sm:py-16 md:py-20">
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden>
        <div className="absolute -top-20 -end-16 w-72 h-72 rounded-full bg-gold/15 blur-3xl" />
        <div className="absolute bottom-0 start-0 w-80 h-56 bg-[radial-gradient(circle_at_bottom_left,rgba(15,52,47,0.08),transparent_60%)]" />
      </div>

      <div className="relative mx-auto max-w-[1240px] px-3 sm:px-4">
        <motion.div
          className="max-w-2xl"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <p className="text-[10px] sm:text-xs font-bold tracking-[0.16em] text-gold uppercase">
            {t.landMarket.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-green text-balance">
            {t.landMarket.homeTitle}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-ink-soft leading-relaxed">{t.landMarket.homeSubtitle}</p>
          <p className="mt-2 text-[11px] text-ink-soft/80" dir="ltr">
            {t.landMarket.updated} {updated}
            {national?.source.period ? ` · REPI ${national.source.period}` : ""}
          </p>
        </motion.div>

        {homeKpis.length > 0 && (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {homeKpis.map((k, i) => (
              <motion.div
                key={k.key}
                className="rounded-2xl border border-line bg-white px-3 py-3.5 sm:px-4"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.35 }}
              >
                <p className="text-[10px] sm:text-[11px] text-ink-soft leading-snug">{kpiLabel(k, lang)}</p>
                <p className="mt-1.5 text-lg sm:text-xl font-bold tabular-nums text-green tracking-tight">
                  {kpiDisplay(k, lang)}
                </p>
                {kpiHint(k, lang) && (
                  <p className="mt-1 text-[10px] text-ink-soft/75 line-clamp-2">{kpiHint(k, lang)}</p>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {national && charts && (
          <div className="mt-6 space-y-4">
            <MultiSeriesLineChart
              lang={lang}
              title={t.landMarket.chartRepiTrends}
              series={[
                {
                  key: "lands",
                  labelAr: "أراضي",
                  labelEn: "Lands",
                  points: charts.landsTrend,
                  color: GREEN,
                },
                {
                  key: "industrial",
                  labelAr: "أراضي صناعية",
                  labelEn: "Industrial land",
                  points: charts.industrialTrend,
                  color: GOLD,
                },
                {
                  key: "general",
                  labelAr: "العام",
                  labelEn: "General",
                  points: charts.generalTrend,
                  color: TEAL,
                },
              ]}
            />
            <div className="grid gap-4 lg:grid-cols-3">
              <RadialIndexMix
                points={charts.landsBreakdown}
                lang={lang}
                title={t.landMarket.chartLandsBreakdown}
              />
              <HorizontalBars
                points={(charts.byGovernorate ?? []).slice(0, 8)}
                lang={lang}
                title={t.landMarket.chartByGov}
              />
              {(charts.qoqByType?.length ?? 0) > 0 ? (
                <DivergingChangeBars
                  points={(charts.qoqByType ?? []).slice(0, 8)}
                  lang={lang}
                  title={t.landMarket.chartQoqByType}
                />
              ) : (
                <HorizontalBars
                  points={charts.latestByType}
                  lang={lang}
                  title={t.landMarket.chartRepiTypes}
                />
              )}
            </div>
          </div>
        )}

        {(snapshot.platform.offerCount ?? 0) > 0 && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <HorizontalBars
              points={snapshot.platform.charts?.byArea}
              lang={lang}
              title={t.landMarket.chartByArea}
            />
            {(snapshot.platform.charts?.listingsByMonth?.length ?? 0) >= 2 ? (
              <TrendLineChart
                points={snapshot.platform.charts?.listingsByMonth}
                lang={lang}
                title={t.landMarket.chartTrend}
              />
            ) : (
              <ColumnChart
                points={snapshot.platform.charts?.byStatus}
                lang={lang}
                title={t.landMarket.chartByStatus}
              />
            )}
          </div>
        )}

        <motion.div
          className="mt-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 rounded-2xl border border-gold/35 bg-gradient-to-r from-gold/10 via-white to-white p-5 sm:p-6"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="max-w-xl">
            <h3 className="text-lg sm:text-xl font-bold text-green">{t.landMarket.ctaTitle}</h3>
            <p className="mt-2 text-sm text-ink-soft leading-relaxed">{t.landMarket.ctaBody}</p>
          </div>
          <Link
            href="/jordan-land-market"
            className="inline-flex h-11 items-center justify-center rounded-full bg-green px-5 text-sm font-bold text-white hover:bg-green-2 transition-colors shrink-0"
          >
            {t.landMarket.ctaButton}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

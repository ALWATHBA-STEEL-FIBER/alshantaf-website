"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { MetricCard } from "@/components/market/MetricCard";
import type { MarketSnapshot } from "@/lib/marketIntelligence";

const LANDING_KEYS = [
  "total_credit_facilities",
  "private_sector_credit_resident",
  "private_sector_credit_total",
  "credit_growth_rate",
  "cbj_main_rate",
  "overdraft_interest_rate",
  "public_sector_credit",
  "sme_credit",
];

export function LendingMarketSnapshot({ snapshot }: { snapshot: MarketSnapshot | null }) {
  const { lang } = useLanguage();
  if (!snapshot) return null;

  const cards = LANDING_KEYS.map((k) => snapshot.metrics.find((m) => m.metricKey === k)).filter(
    (m): m is NonNullable<typeof m> => Boolean(m)
  );

  return (
    <section className="relative overflow-hidden bg-[#0a1412] text-white py-12 sm:py-16 md:py-20">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-[1240px] px-3 sm:px-4">
        <div className="max-w-3xl">
          <p className="text-[10px] sm:text-xs font-bold tracking-[0.18em] text-gold uppercase">
            {lang === "ar" ? "ذكاء السوق" : "Market intelligence"}
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-balance">
            {lang === "ar" ? "سوق الإقراض في الأردن — نظرة حيّة" : snapshot.title}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/65 leading-relaxed max-w-2xl">
            {lang === "ar"
              ? "مؤشرات ائتمان وتمويل من مصادر رسمية ومعتمدة — بأحدث البيانات المتاحة وليس أرقامًا مخترعة."
              : snapshot.subtitle}
          </p>
          <p className="mt-2 text-[11px] text-white/40">{snapshot.honestyNote}</p>
          <p className="mt-3 text-[11px] font-mono text-white/50" dir="ltr">
            {snapshot.indicatorCount} indicators · {snapshot.sourceCount} sources · coverage {snapshot.coverage}
            {snapshot.lastRefresh ? ` · refreshed ${snapshot.lastRefresh.slice(0, 10)}` : ""}
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((m) => (
            <MetricCard key={m.metricKey} metric={m} lang={lang} />
          ))}
        </div>

        <div className="mt-10">
          <h3 className="text-sm font-bold tracking-wide text-gold">
            {lang === "ar" ? "نبض السوق الأردني" : "Jordan Market Pulse"}
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {snapshot.pulse.map((m) => (
              <div key={m.metricKey} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[10px] text-white/50 line-clamp-2">{m.metricName}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{m.displayValue}</p>
                {m.changePercent != null ? (
                  <p
                    className={`mt-1 text-[11px] font-bold ${
                      m.changePercent > 0 ? "text-emerald-300" : m.changePercent < 0 ? "text-rose-300" : "text-white/50"
                    }`}
                  >
                    {m.changePercent > 0 ? "↑" : m.changePercent < 0 ? "↓" : "→"} {m.changePercent > 0 ? "+" : ""}
                    {m.changePercent}%
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] text-white/35">{m.periodLabel}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/10 to-transparent p-5 sm:p-6">
          <div className="max-w-xl">
            <h3 className="text-lg sm:text-xl font-bold">
              {lang === "ar" ? "استكشف سوق الإقراض الأردني" : "Explore the Jordan Lending Market"}
            </h3>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">
              {lang === "ar"
                ? "اتجاهات تاريخية، تمويل الشركات الصغيرة، تقديرات الإقراض الرقمي، ونشاط الاستثمار — مع مصدر كل رقم."
                : "Explore historical trends, financing demand, SME lending, digital lending estimates, investment activity and the underlying sources behind every metric."}
            </p>
          </div>
          <Link
            href="/jordan-lending-market"
            className="inline-flex h-11 items-center justify-center rounded-full bg-gold px-5 text-sm font-bold text-[#152126] hover:bg-gold-2 transition-colors shrink-0"
          >
            {lang === "ar" ? "افتح ذكاء السوق ←" : "Open Market Intelligence →"}
          </Link>
        </div>
      </div>
    </section>
  );
}

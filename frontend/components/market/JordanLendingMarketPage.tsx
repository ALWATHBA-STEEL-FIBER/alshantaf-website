"use client";

import { MetricCard } from "@/components/market/MetricCard";
import { CreditMarketExplorer } from "@/components/market/CreditMarketExplorer";
import { useLanguage } from "@/lib/LanguageProvider";
import type { MarketMetric, MarketSnapshot } from "@/lib/marketIntelligence";

function byKeys(metrics: MarketMetric[], keys: string[]) {
  return keys.map((k) => metrics.find((m) => m.metricKey === k)).filter((m): m is MarketMetric => Boolean(m));
}

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
    <section className="mt-12 sm:mt-16">
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{title}</h2>
      {subtitle && <p className="mt-2 max-w-2xl text-sm text-white/55 leading-relaxed">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function JordanLendingMarketPage({ snapshot }: { snapshot: MarketSnapshot }) {
  const { lang } = useLanguage();

  const overview = byKeys(snapshot.metrics, [
    "total_credit_facilities",
    "private_sector_credit_resident",
    "private_sector_credit_total",
    "credit_growth_rate",
    "new_credit_requested",
    "new_credit_approved",
    "approval_rate",
    "credit_applications",
    "rejected_applications",
    "public_sector_credit",
  ]);

  const banking = byKeys(snapshot.metrics, [
    "total_credit_facilities",
    "private_sector_credit_resident",
    "private_sector_credit_total",
    "public_sector_credit",
    "corporate_credit",
    "consumer_credit",
    "sme_credit",
  ]);

  const demand = byKeys(snapshot.metrics, [
    "credit_applications",
    "approved_applications",
    "rejected_applications",
    "new_credit_requested",
    "new_credit_approved",
    "approval_rate",
  ]);

  const conditions = byKeys(snapshot.metrics, [
    "cbj_main_rate",
    "rediscount_rate",
    "overdraft_interest_rate",
    "credit_growth_rate",
  ]);

  const sme = byKeys(snapshot.metrics, ["sme_credit"]);
  const micro = byKeys(snapshot.metrics, ["microfinance_portfolio"]);
  const digital = byKeys(snapshot.metrics, ["digital_lending_estimate"]);

  return (
    <div className="relative min-h-screen bg-[#070f0e] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-[1240px] px-3 sm:px-4 pb-20 pt-6 sm:pt-10">
        <header className="max-w-3xl">
          <p className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-gold uppercase">
            {lang === "ar" ? "ذكاء السوق الأردني" : "Jordan market intelligence"}
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-balance">
            {lang === "ar" ? "ذكاء سوق الإقراض في الأردن" : "Jordan Lending Market Intelligence"}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-white/65 leading-relaxed">
            {lang === "ar"
              ? "نظرة محدّثة باستمرار على منظومة الائتمان والتمويل والإقراض في الأردن — من مصادر رسمية ومعتمدة."
              : "A continuously updated view of Jordan's credit, financing and lending ecosystem."}
          </p>
          <p className="mt-4 font-mono text-[11px] text-white/45" dir="ltr">
            {snapshot.indicatorCount} indicators · {snapshot.sourceCount} sources
            {snapshot.lastRefresh ? ` · Updated ${snapshot.lastRefresh.slice(0, 10)}` : ""} · coverage{" "}
            {snapshot.coverage}
          </p>
          <p className="mt-2 text-[11px] text-amber-200/80">{snapshot.honestyNote}</p>
        </header>

        <Section
          title={lang === "ar" ? "نظرة عامة على السوق" : "Market Overview"}
          subtitle="Large KPIs for credit stocks, growth and financing demand. Unavailable figures show N/A — never invented."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {overview.map((m) => (
              <MetricCard key={m.metricKey} metric={m} lang={lang} />
            ))}
          </div>
        </Section>

        <Section
          title={lang === "ar" ? "مستكشف سوق الائتمان" : "Credit Market Explorer"}
          subtitle="Interactive history for banking credit, financing demand and lending conditions."
        >
          <CreditMarketExplorer />
        </Section>

        <Section title="Banking credit" subtitle="Official banking-sector credit facilities where ingested from CBJ bulletins and cited CBJ releases.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {banking.map((m) => (
              <MetricCard key={m.metricKey} metric={m} lang={lang} />
            ))}
          </div>
        </Section>

        <Section
          title="Financing demand"
          subtitle="Application volumes and approval ratios appear only when a verified source is available."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {demand.map((m) => (
              <MetricCard key={m.metricKey} metric={m} lang={lang} />
            ))}
          </div>
        </Section>

        <Section title="Lending conditions" subtitle="Policy and bank lending rates from CBJ statistical bulletins.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {conditions.map((m) => (
              <MetricCard key={m.metricKey} metric={m} lang={lang} />
            ))}
          </div>
        </Section>

        <Section
          title="SME lending"
          subtitle="SME credit figures are shown only from CBJ SME credit tables or other verified official releases."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sme.map((m) => (
              <MetricCard key={m.metricKey} metric={m} lang={lang} />
            ))}
          </div>
          {sme.every((m) => !m.available) && (
            <p className="mt-3 text-sm text-white/45">
              SME stock series is registered for ingestion from the CBJ SME credit facilities page. N/A until a verified
              observation is loaded.
            </p>
          )}
        </Section>

        <Section
          title="Microfinance"
          subtitle="Jordan-specific microfinance portfolio and borrower counts when published by official or institutional sources."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {micro.map((m) => (
              <MetricCard key={m.metricKey} metric={m} lang={lang} />
            ))}
          </div>
        </Section>

        <Section
          title="Digital lending / Fintech"
          subtitle="Market estimates are labeled Estimated and never mixed with official banking credit stocks."
        >
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs text-amber-100/80 mb-4">
            Official statistics (CBJ / regulators) are separate from commercial research TAM or digital-lending estimates.
            Every estimate shows research company, period and original source when available.
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {digital.map((m) => (
              <MetricCard key={m.metricKey} metric={m} lang={lang} />
            ))}
          </div>
        </Section>

        <Section
          title="Investment & funding intelligence"
          subtitle="Announced vs completed funding are tracked separately. No invented investment totals."
        >
          <p className="text-sm text-white/50 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            No verified Jordan fintech/lending funding rounds are currently ingested. When announcements are added, each
            event will show source, announcement date, and whether capital was confirmed as deployed.
          </p>
        </Section>

        <Section title="Data Sources" subtitle="Complete registry of sources behind this page.">
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-white/[0.06] text-white/55">
                <tr>
                  <th className="px-3 py-2 font-semibold">Source</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Tier</th>
                  <th className="px-3 py-2 font-semibold">Frequency</th>
                  <th className="px-3 py-2 font-semibold">Last update</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.sources.map((s) => (
                  <tr key={s.key} className="border-t border-white/10">
                    <td className="px-3 py-2.5">
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline font-semibold">
                        {s.name}
                      </a>
                      {s.notes && <p className="mt-0.5 text-[10px] text-white/40 max-w-xs">{s.notes}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-white/60">{s.sourceType}</td>
                    <td className="px-3 py-2.5 text-white/60">T{s.tier}</td>
                    <td className="px-3 py-2.5 text-white/60">{s.updateFrequency}</td>
                    <td className="px-3 py-2.5 text-white/60 tabular-nums" dir="ltr">
                      {s.lastSuccessAt?.slice(0, 10) ?? s.lastChecked?.slice(0, 10) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Methodology">
          <div className="prose prose-invert prose-sm max-w-none text-white/60 space-y-3 text-sm leading-relaxed">
            <p>
              Data flows Source → scheduled ingestion → normalizer → PostgreSQL → Market Intelligence API → this
              dashboard. The frontend never scrapes official sites.
            </p>
            <ul className="list-disc ps-5 space-y-1.5">
              <li>Publication frequency is respected (monthly / quarterly / annual). Values are labeled latest-available, not live ticks.</li>
              <li>Change % uses the previous comparable observation for the same metric key: (current − previous) / previous × 100.</li>
              <li>Calculated metrics (e.g. credit growth) are labeled Calculated and cite underlying series.</li>
              <li>Estimates are labeled Estimated and never silently fill gaps in official series.</li>
              <li>Missing data shows N/A. Historical revisions are stored with previous and new values.</li>
              <li>Source priority: official Jordanian institutions → IFIs → market research → news citing official data.</li>
              <li>Currency is kept in the source unit (typically JOD millions) and formatted for display.</li>
            </ul>
          </div>
        </Section>
      </div>
    </div>
  );
}

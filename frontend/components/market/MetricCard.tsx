"use client";

import { Sparkline } from "@/components/market/MarketCharts";
import { freshnessLabel, type MarketMetric } from "@/lib/marketIntelligence";

export function MetricCard({
  metric,
  lang,
  compact = false,
}: {
  metric: MarketMetric;
  lang: "ar" | "en";
  compact?: boolean;
}) {
  const chg = metric.changePercent;
  const chgUp = chg != null && chg > 0;
  const chgDown = chg != null && chg < 0;

  return (
    <article
      className={`rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent ${
        compact ? "p-3" : "p-4 sm:p-5"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-bold tracking-tight text-white tabular-nums ${compact ? "text-xl" : "text-2xl sm:text-3xl"}`}>
            {metric.displayValue}
          </p>
          <h3 className={`mt-1 font-semibold text-white/80 ${compact ? "text-xs" : "text-sm"}`}>{metric.metricName}</h3>
        </div>
        {metric.sparkline.length >= 2 && <Sparkline points={metric.sparkline} className="w-20 h-7 shrink-0" />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] sm:text-[11px]">
        {chg != null ? (
          <span
            className={`rounded-full px-2 py-0.5 font-bold ${
              chgUp ? "bg-emerald-500/15 text-emerald-300" : chgDown ? "bg-rose-500/15 text-rose-300" : "bg-white/10 text-white/70"
            }`}
          >
            {chgUp ? "↑" : chgDown ? "↓" : "→"} {chg > 0 ? "+" : ""}
            {chg}%
          </span>
        ) : null}
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/65">{freshnessLabel(metric, lang)}</span>
        {metric.isCalculated && (
          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-300">
            {lang === "ar" ? "محسوب" : "Calculated"}
          </span>
        )}
        {metric.isEstimate && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">
            {lang === "ar" ? "تقدير" : "Estimated"}
          </span>
        )}
        {metric.status === "revised" && (
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-violet-200">
            {lang === "ar" ? "مُراجَع" : "Revised"}
          </span>
        )}
      </div>
      {metric.previousValue != null && metric.available && (
        <p className="mt-2 text-[10px] text-white/40 tabular-nums">
          {lang === "ar" ? "السابق" : "Previous"}: {metric.previousValue.toLocaleString("en-JO")}
          {metric.unit === "percent" ? "%" : metric.unit === "JOD_million" ? " JOD m" : ""}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2 text-[10px] text-white/45">
        <span>
          {lang === "ar" ? "المصدر" : "Source"}:{" "}
          {metric.sourceUrl ? (
            <a href={metric.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
              {metric.source?.name ?? "—"}
            </a>
          ) : (
            metric.source?.name ?? "—"
          )}
        </span>
        {metric.retrievedAt && (
          <span dir="ltr">
            {lang === "ar" ? "استُرجع" : "Retrieved"} {metric.retrievedAt.slice(0, 10)}
          </span>
        )}
      </div>
    </article>
  );
}

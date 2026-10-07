"use client";

import { useEffect, useState } from "react";
import { MarketLineChart } from "@/components/market/MarketCharts";
import { fetchMarketSeries, type MarketSeries } from "@/lib/marketIntelligence";

const METRICS = [
  { key: "total_credit_facilities", label: "Total credit facilities" },
  { key: "private_sector_credit_resident", label: "Private-sector credit" },
  { key: "private_sector_credit_total", label: "Private-sector credit (total)" },
  { key: "public_sector_credit", label: "Public-sector credit" },
  { key: "sme_credit", label: "SME credit" },
  { key: "consumer_credit", label: "Consumer credit" },
  { key: "corporate_credit", label: "Corporate credit" },
  { key: "microfinance_portfolio", label: "Microfinance" },
  { key: "new_credit_applications", label: "New credit applications" },
  { key: "credit_applications", label: "Credit applications" },
  { key: "new_credit_requested", label: "New credit requested" },
  { key: "new_credit_approved", label: "New credit approved" },
  { key: "credit_growth_rate", label: "Credit growth" },
  { key: "cbj_main_rate", label: "CBJ policy rate" },
  { key: "overdraft_interest_rate", label: "Overdraft rate" },
] as const;

const RANGES = [
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "3y", label: "3Y" },
  { key: "5y", label: "5Y" },
  { key: "max", label: "Max" },
] as const;

export function CreditMarketExplorer({
  defaultMetric = "total_credit_facilities",
}: {
  defaultMetric?: string;
}) {
  const [metric, setMetric] = useState(defaultMetric);
  const [range, setRange] = useState<string>("max");
  const [series, setSeries] = useState<MarketSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(false);
    fetchMarketSeries(metric, range)
      .then((s) => {
        if (!ignore) setSeries(s);
      })
      .catch(() => {
        if (!ignore) setError(true);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [metric, range]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-gold tracking-wide">Credit Market Explorer</h3>
          <p className="mt-1 text-xs text-white/50">Select a metric and history range. Tooltips show date, value, change and source.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`h-8 min-w-10 rounded-full px-2.5 text-[11px] font-bold transition-colors ${
                range === r.key ? "bg-gold text-[#152126]" : "bg-white/10 text-white/70 hover:bg-white/15"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max pb-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={`h-9 rounded-full px-3 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                metric === m.key ? "bg-white text-[#0a1412]" : "bg-white/[0.06] text-white/65 hover:bg-white/10"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="h-[220px] animate-pulse rounded-xl bg-white/5" />
        ) : error ? (
          <div className="flex h-[220px] items-center justify-center rounded-xl border border-white/10 text-sm text-white/50">
            Could not load series
          </div>
        ) : (
          <MarketLineChart points={series?.points ?? []} />
        )}
      </div>
    </div>
  );
}

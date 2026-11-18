"use client";

import { useMemo, useState } from "react";
import type { LandChartPoint } from "@/lib/marketIntelligence";

type DailyRange = "5D" | "1W" | "1M" | "3M" | "6M" | "MAX";

const RANGES: Array<{ id: DailyRange; days: number | null; label: string; labelAr: string }> = [
  { id: "5D", days: 5, label: "5D", labelAr: "٥ي" },
  { id: "1W", days: 7, label: "1W", labelAr: "١أ" },
  { id: "1M", days: 22, label: "1M", labelAr: "١ش" },
  { id: "3M", days: 66, label: "3M", labelAr: "٣ش" },
  { id: "6M", days: 132, label: "6M", labelAr: "٦ش" },
  { id: "MAX", days: null, label: "Max", labelAr: "الكل" },
];

export type AsePairSeries = {
  id: string;
  labelEn: string;
  labelAr: string;
  color: string;
  points: LandChartPoint[];
};

function sliceRange(points: LandChartPoint[], range: DailyRange) {
  const def = RANGES.find((r) => r.id === range);
  if (!def?.days) return points;
  return points.slice(-def.days);
}

function pctDelta(points: LandChartPoint[]) {
  if (points.length < 2) return null;
  const a = points[0]!.value;
  const b = points[points.length - 1]!.value;
  if (!a) return null;
  return Math.round(((b - a) / a) * 1000) / 10;
}

function PairChart({
  points,
  color,
  label,
}: {
  points: LandChartPoint[];
  color: string;
  label: string;
}) {
  if (points.length < 2) {
    return (
      <div className="grid h-full place-items-center text-xs text-muted-foreground">
        {label}
      </div>
    );
  }

  const w = 640;
  const h = 220;
  const pad = { t: 16, r: 12, b: 28, l: 44 };
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const coords = points.map((p, i) => ({
    x: pad.l + (i / (points.length - 1)) * innerW,
    y: pad.t + (1 - (p.value - min) / span) * innerH,
    ...p,
  }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area =
    `${line} L${coords[coords.length - 1]!.x.toFixed(1)},${(pad.t + innerH).toFixed(1)}` +
    ` L${coords[0]!.x.toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`;
  const gradId = `asePairFill-${color.replace("#", "")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" role="img" aria-label={label}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t, i) => {
        const y = pad.t + t * innerH;
        const val = max - t * span;
        return (
          <g key={i}>
            <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="rgba(20,32,40,0.08)" />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fill="#5d6b74" fontSize="10">
              {val.toFixed(0)}
            </text>
          </g>
        );
      })}
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords.filter((_, i) => i === 0 || i === coords.length - 1 || i === Math.floor(coords.length / 2)).map((c) => (
        <g key={c.key}>
          <circle cx={c.x} cy={c.y} r="3.5" fill="#fff" stroke={color} strokeWidth="1.75" />
          <text x={c.x} y={h - 8} textAnchor="middle" fill="#5d6b74" fontSize="9">
            {c.key.slice(5)}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * ASE equity-sector pairs chart.
 * TradingView does not list Amman Stock Exchange symbols (ASE:* pages 404),
 * so this renders official ASE daily sector indices we collect ourselves.
 */
export function AseTradingViewChart({
  pairs,
  lang,
}: {
  pairs: AsePairSeries[];
  lang: "ar" | "en";
  /** @deprecated kept for call-site compatibility */
  symbols?: unknown;
}) {
  const available = pairs.filter((p) => p.points.length >= 2);
  const [pairId, setPairId] = useState(() => available[0]?.id ?? "");
  const [range, setRange] = useState<DailyRange>("1M");

  const active = available.find((p) => p.id === pairId) ?? available[0];
  const window = useMemo(
    () => (active ? sliceRange(active.points, range) : []),
    [active, range]
  );
  const delta = pctDelta(window);
  const last = window.at(-1);

  const stopInteractive = (e: React.SyntheticEvent) => e.stopPropagation();
  const fmt = (n: number, d = 1) =>
    n.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO", { maximumFractionDigits: d });

  if (!active) {
    return (
      <div className="grid h-full min-h-[220px] place-items-center p-4 text-center text-xs text-muted-foreground">
        {lang === "ar"
          ? "لا تتوفر سلاسل يومية من بورصة عمّان حالياً."
          : "No ASE daily series available right now."}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        data-widget-drag-handle
        className="flex cursor-grab active:cursor-grabbing flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/80 px-3 py-2"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground" aria-hidden>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <circle cx="3" cy="3" r="1.2" />
              <circle cx="9" cy="3" r="1.2" />
              <circle cx="3" cy="6" r="1.2" />
              <circle cx="9" cy="6" r="1.2" />
              <circle cx="3" cy="9" r="1.2" />
              <circle cx="9" cy="9" r="1.2" />
            </svg>
          </span>
          <label className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="shrink-0 font-bold uppercase tracking-[0.1em]">
              {lang === "ar" ? "الزوج" : "Pair"}
            </span>
            <select
              className="max-w-[200px] truncate rounded-md border border-line bg-white px-1.5 py-1 text-[11px] font-semibold text-foreground"
              value={active.id}
              onChange={(e) => setPairId(e.target.value)}
              onPointerDown={stopInteractive}
              data-widget-interactive
            >
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {lang === "ar" ? p.labelAr : p.labelEn}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          className="flex flex-wrap gap-0.5"
          role="group"
          aria-label={lang === "ar" ? "الإطار الزمني" : "Timeframe"}
          data-widget-interactive
          onPointerDown={stopInteractive}
        >
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums transition-colors ${
                range === r.id
                  ? "bg-green text-white"
                  : "bg-white text-ink-soft hover:bg-green/10 hover:text-green"
              }`}
            >
              {lang === "ar" ? r.labelAr : r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2 px-3 pt-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {lang === "ar" ? active.labelAr : active.labelEn}
          </p>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {last ? fmt(last.value, 0) : "—"}
          </p>
        </div>
        {delta != null && (
          <p className={`text-sm font-bold tabular-nums ${delta >= 0 ? "text-green" : "text-[#8b3a2a]"}`}>
            {delta > 0 ? "+" : ""}
            {fmt(delta)}% · {range}
          </p>
        )}
      </div>

      <p className="px-3 pt-1 text-[9px] leading-snug text-muted-foreground">
        {lang === "ar"
          ? "مؤشرات قطاعات رسمية من بورصة عمّان (يومي) — ليست على TradingView. أسهم ≠ قيم قطع. اسحب من الشريط أعلاه."
          : "Official ASE daily sector indices — ASE equities are not listed on TradingView. Equities ≠ parcel values. Drag from the bar above."}
      </p>

      <div
        data-widget-interactive
        className="relative mt-1 min-h-[200px] flex-1 overflow-hidden bg-white px-1 pb-1"
        onPointerDown={stopInteractive}
      >
        <PairChart
          points={window}
          color={active.color}
          label={lang === "ar" ? active.labelAr : active.labelEn}
        />
        <p className="absolute bottom-1 end-2 text-[9px] tabular-nums text-muted-foreground" dir="ltr">
          {window[0]?.key ?? ""} → {window.at(-1)?.key ?? ""} · {window.length}
        </p>
      </div>
    </div>
  );
}

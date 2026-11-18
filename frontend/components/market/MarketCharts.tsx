"use client";

import { motion } from "motion/react";
import { chartLabel, type LandChartPoint } from "@/lib/marketIntelligence";

const GREEN = "#0f342f";
const GOLD = "#c89a58";
const TEAL = "#2a6f66";

function asPoints(points?: LandChartPoint[] | null): LandChartPoint[] {
  return Array.isArray(points) ? points : [];
}

export function HorizontalBars({
  points: rawPoints,
  lang,
  title,
  unitSuffix,
  valueFormat,
}: {
  points?: LandChartPoint[] | null;
  lang: "ar" | "en";
  title: string;
  unitSuffix?: string;
  valueFormat?: (n: number) => string;
}) {
  const points = asPoints(rawPoints);
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.value));
  const fmt = valueFormat ?? ((n: number) => n.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO"));

  return (
    <motion.div
      className="rounded-2xl border border-line bg-white p-4 sm:p-5 shadow-[0_12px_40px_-28px_rgba(15,52,47,0.35)]"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4 }}
    >
      <h3 className="text-sm font-bold text-green mb-4">{title}</h3>
      <ul className="space-y-3">
        {points.map((p, i) => (
          <li key={p.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-xs text-ink-soft truncate">{chartLabel(p, lang)}</span>
              <span className="text-sm font-bold tabular-nums text-green shrink-0">
                {fmt(p.value)}
                {unitSuffix ? ` ${unitSuffix}` : ""}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <motion.div
                className="h-full w-full rounded-full origin-left"
                style={{
                  background: `linear-gradient(90deg, ${GREEN}, ${GOLD})`,
                  willChange: "transform",
                }}
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: p.value / max }}
                viewport={{ once: true }}
                transition={{ duration: 0.75, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export function ColumnChart({
  points: rawPoints,
  lang,
  title,
  valueFormat,
}: {
  points?: LandChartPoint[] | null;
  lang: "ar" | "en";
  title: string;
  valueFormat?: (n: number) => string;
}) {
  const points = asPoints(rawPoints);
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.value));
  const fmt = valueFormat ?? ((n: number) => n.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO"));

  return (
    <motion.div
      className="rounded-2xl border border-line bg-white p-4 sm:p-5 shadow-[0_12px_40px_-28px_rgba(15,52,47,0.35)]"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4 }}
    >
      <h3 className="text-sm font-bold text-green mb-4">{title}</h3>
      <div className="flex items-end gap-1.5 sm:gap-2.5 h-40 sm:h-48">
        {points.map((p, i) => {
          const hPct = Math.max(10, (p.value / max) * 100);
          return (
            <div key={p.key} className="flex-1 min-w-0 flex flex-col items-center h-full justify-end gap-1">
              <span className="text-[10px] font-bold tabular-nums text-green">{fmt(p.value)}</span>
              <div className="relative w-full flex-1 flex items-end justify-center">
                <motion.div
                  className="w-full max-w-[40px] rounded-t-md bg-green origin-bottom"
                  style={{ height: `${hPct}%`, willChange: "transform" }}
                  initial={{ scaleY: 0, opacity: 0.6 }}
                  whileInView={{ scaleY: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.65, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  title={`${chartLabel(p, lang)}: ${fmt(p.value)}`}
                />
              </div>
              <span className="text-[9px] sm:text-[10px] text-ink-soft text-center leading-tight line-clamp-2 h-8 w-full">
                {chartLabel(p, lang)}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function TrendLineChart({
  points: rawPoints,
  lang,
  title,
}: {
  points?: LandChartPoint[] | null;
  lang: "ar" | "en";
  title: string;
}) {
  const points = asPoints(rawPoints);
  if (points.length < 2) return null;

  const pad = { t: 16, r: 12, b: 28, l: 36 };
  const w = 560;
  const h = 180;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const coords = points.map((p, i) => ({
    ...p,
    x: pad.l + (i / (points.length - 1)) * innerW,
    y: pad.t + (1 - (p.value - min) / span) * innerH,
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area =
    `${path} L${coords[coords.length - 1]!.x.toFixed(1)},${(pad.t + innerH).toFixed(1)}` +
    ` L${coords[0]!.x.toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`;

  return (
    <motion.div
      className="rounded-2xl border border-line bg-white p-4 sm:p-5 shadow-[0_12px_40px_-28px_rgba(15,52,47,0.35)]"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4 }}
    >
      <h3 className="text-sm font-bold text-green mb-3">{title}</h3>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={title}>
        <defs>
          <linearGradient id="landFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.35" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={area}
          fill="url(#landFill)"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.25 }}
        />
        <motion.path
          d={path}
          fill="none"
          stroke={GREEN}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
        {coords.map((c, i) => (
          <motion.circle
            key={c.key}
            cx={c.x}
            cy={c.y}
            r="3.5"
            fill="#fff"
            stroke={GOLD}
            strokeWidth="1.75"
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.45 + i * 0.06, type: "spring", stiffness: 300, damping: 20 }}
          >
            <title>
              {chartLabel(c, lang)}: {c.value}
            </title>
          </motion.circle>
        ))}
        {[0, coords.length - 1].map((i) => {
          const c = coords[i];
          if (!c) return null;
          return (
            <text key={c.key} x={c.x} y={h - 8} textAnchor="middle" fill="#5d6b74" fontSize="9">
              {c.key}
            </text>
          );
        })}
      </svg>
    </motion.div>
  );
}

/** Compare 1–3 official index series on one chart. */
export function MultiSeriesLineChart({
  series,
  lang,
  title,
}: {
  series?: Array<{ key: string; labelAr: string; labelEn: string; points?: LandChartPoint[] | null; color: string }> | null;
  lang: "ar" | "en";
  title: string;
}) {
  const active = (series ?? [])
    .map((s) => ({ ...s, points: asPoints(s.points) }))
    .filter((s) => s.points.length >= 2);
  if (active.length === 0) return null;

  const pad = { t: 16, r: 12, b: 36, l: 36 };
  const w = 640;
  const h = 220;
  const allVals = active.flatMap((s) => s.points.map((p) => p.value));
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const span = max - min || 1;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  // Align on union of periods from the longest series
  const base = active.reduce((a, b) => (b.points.length > a.points.length ? b : a)).points;

  return (
    <motion.div
      className="rounded-2xl border border-line bg-white p-4 sm:p-5 shadow-[0_12px_40px_-28px_rgba(15,52,47,0.35)]"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-green">{title}</h3>
        <div className="flex flex-wrap gap-3">
          {active.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-[10px] text-ink-soft">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {lang === "ar" ? s.labelAr : s.labelEn}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={title}>
        {[0, 0.5, 1].map((t, i) => {
          const y = pad.t + t * innerH;
          const val = max - t * span;
          return (
            <g key={i}>
              <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="rgba(20,32,40,0.08)" />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fill="#5d6b74" fontSize="9">
                {val.toFixed(0)}
              </text>
            </g>
          );
        })}
        {active.map((s) => {
          const coords = s.points.map((p, i) => {
            const x = pad.l + (i / Math.max(1, s.points.length - 1)) * innerW;
            const y = pad.t + (1 - (p.value - min) / span) * innerH;
            return { x, y, ...p };
          });
          const d = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
          return (
            <motion.path
              key={s.key}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}
        {[0, Math.floor((base.length - 1) / 2), base.length - 1].map((i) => {
          const p = base[i];
          if (!p) return null;
          const x = pad.l + (i / Math.max(1, base.length - 1)) * innerW;
          return (
            <text key={p.key} x={x} y={h - 10} textAnchor="middle" fill="#5d6b74" fontSize="9">
              {p.key}
            </text>
          );
        })}
      </svg>
    </motion.div>
  );
}

/** Diverging bars for signed % change (QoQ / YoY from official series). */
export function DivergingChangeBars({
  points: rawPoints,
  lang,
  title,
  unitSuffix = "%",
}: {
  points?: LandChartPoint[] | null;
  lang: "ar" | "en";
  title: string;
  unitSuffix?: string;
}) {
  const points = asPoints(rawPoints);
  if (points.length === 0) return null;
  const maxAbs = Math.max(0.5, ...points.map((p) => Math.abs(p.value)));
  const fmt = (n: number) =>
    `${n > 0 ? "+" : ""}${n.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO", {
      maximumFractionDigits: 1,
    })}${unitSuffix}`;

  return (
    <motion.div
      className="rounded-2xl border border-line bg-white p-4 sm:p-5 shadow-[0_12px_40px_-28px_rgba(15,52,47,0.35)]"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4 }}
    >
      <h3 className="text-sm font-bold text-green mb-4">{title}</h3>
      <ul className="space-y-2.5">
        {points.map((p, i) => {
          const pct = (Math.abs(p.value) / maxAbs) * 50;
          const up = p.value >= 0;
          return (
            <li key={p.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-xs text-ink-soft truncate">{chartLabel(p, lang)}</span>
                <span
                  className={`text-sm font-bold tabular-nums shrink-0 ${up ? "text-green" : "text-[#8b3a2a]"}`}
                >
                  {fmt(p.value)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-0 h-2 rounded-full bg-surface-2 overflow-hidden">
                <div className="flex justify-end">
                  {!up && (
                    <motion.div
                      className="h-full rounded-s-full origin-right"
                      style={{
                        width: `${pct * 2}%`,
                        background: `linear-gradient(270deg, #8b3a2a, ${GOLD})`,
                        willChange: "transform",
                      }}
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                </div>
                <div className="flex justify-start">
                  {up && (
                    <motion.div
                      className="h-full rounded-e-full origin-left"
                      style={{
                        width: `${pct * 2}%`,
                        background: `linear-gradient(90deg, ${TEAL}, ${GREEN})`,
                        willChange: "transform",
                      }}
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}

/** Compact radial mix of index levels (same units — relative comparison only). */
export function RadialIndexMix({
  points: rawPoints,
  lang,
  title,
}: {
  points?: LandChartPoint[] | null;
  lang: "ar" | "en";
  title: string;
}) {
  const points = asPoints(rawPoints);
  if (points.length < 2) return null;
  const colors = [GREEN, GOLD, TEAL, "#5a7d74", "#a67c45", "#3d5a54"];
  const total = points.reduce((a, p) => a + p.value, 0) || 1;
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 72;
  const rInner = 44;
  let angle = -Math.PI / 2;
  const arcs = points.map((p, i) => {
    const sweep = (p.value / total) * Math.PI * 2;
    const a0 = angle;
    const a1 = angle + sweep;
    angle = a1;
    const large = sweep > Math.PI ? 1 : 0;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const xi0 = cx + rInner * Math.cos(a1);
    const yi0 = cy + rInner * Math.sin(a1);
    const xi1 = cx + rInner * Math.cos(a0);
    const yi1 = cy + rInner * Math.sin(a0);
    const d = [
      `M ${x0.toFixed(1)} ${y0.toFixed(1)}`,
      `A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`,
      `L ${xi0.toFixed(1)} ${yi0.toFixed(1)}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${xi1.toFixed(1)} ${yi1.toFixed(1)}`,
      "Z",
    ].join(" ");
    return { ...p, d, color: colors[i % colors.length]! };
  });

  return (
    <motion.div
      className="rounded-2xl border border-line bg-white p-4 sm:p-5 shadow-[0_12px_40px_-28px_rgba(15,52,47,0.35)]"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4 }}
    >
      <h3 className="text-sm font-bold text-green mb-3">{title}</h3>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-40 h-40 shrink-0" role="img" aria-label={title}>
          {arcs.map((a, i) => (
            <motion.path
              key={a.key}
              d={a.d}
              fill={a.color}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
            >
              <title>
                {chartLabel(a, lang)}: {a.value}
              </title>
            </motion.path>
          ))}
        </svg>
        <ul className="flex-1 w-full space-y-1.5">
          {arcs.map((a) => (
            <li key={a.key} className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-ink-soft truncate">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: a.color }} />
                {chartLabel(a, lang)}
              </span>
              <span className="font-bold tabular-nums text-green shrink-0">
                {a.value.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO", { maximumFractionDigits: 1 })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

export function ViewsBarChart({
  points,
  label,
}: {
  points: Array<{ date: string; views: number }>;
  label: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.views));
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-[11px] font-bold text-ink-soft mb-3">{label}</p>
      <div className="flex items-end gap-1 h-28">
        {points.map((p, i) => (
          <div key={p.date} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1">
            <span className="text-[9px] text-ink-soft tabular-nums">{p.views || ""}</span>
            <motion.div
              className="w-full rounded-t bg-green/85 origin-bottom"
              style={{ height: `${Math.max(p.views ? 8 : 2, (p.views / max) * 100)}%`, willChange: "transform" }}
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.015 }}
              title={`${p.date}: ${p.views}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[9px] text-ink-soft">
        <span>{points[0]?.date?.slice(5) ?? ""}</span>
        <span>{points[points.length - 1]?.date?.slice(5) ?? ""}</span>
      </div>
    </div>
  );
}

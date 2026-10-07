"use client";

export function Sparkline({
  points,
  className = "w-24 h-8",
  stroke = "#c89a58",
}: {
  points: Array<{ value: number }>;
  className?: string;
  stroke?: string;
}) {
  if (points.length < 2) {
    return <div className={`${className} opacity-30`} aria-hidden />;
  }
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 96;
  const h = 32;
  const d = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MarketLineChart({
  points,
  height = 220,
}: {
  points: Array<{ date: string; value: number; displayValue: string; changePercent: number | null; source: string }>;
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-white/10 bg-black/20 text-sm text-white/50"
        style={{ height }}
      >
        Not enough historical points yet
      </div>
    );
  }

  const pad = { t: 16, r: 12, b: 28, l: 48 };
  const w = 640;
  const h = height;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const coords = points.map((p, i) => {
    const x = pad.l + (i / (points.length - 1)) * innerW;
    const y = pad.t + (1 - (p.value - min) / span) * innerH;
    return { ...p, x, y };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area =
    `${path} L${coords[coords.length - 1]!.x.toFixed(1)},${(pad.t + innerH).toFixed(1)}` +
    ` L${coords[0]!.x.toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`;

  const yTicks = [0, 0.5, 1].map((t) => min + span * (1 - t));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[320px]" role="img" aria-label="Market time series">
        <defs>
          <linearGradient id="miFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c89a58" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#c89a58" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((v, i) => {
          const y = pad.t + (i / (yTicks.length - 1)) * innerH;
          return (
            <g key={i}>
              <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.45)" fontSize="9">
                {v >= 1000 ? `${(v / 1000).toFixed(1)}B` : v.toFixed(1)}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#miFill)" />
        <path d={path} fill="none" stroke="#c89a58" strokeWidth="2" />
        {coords.map((c) => (
          <g key={c.date}>
            <circle cx={c.x} cy={c.y} r="3.5" fill="#0f342f" stroke="#c89a58" strokeWidth="1.5">
              <title>
                {c.date}: {c.displayValue}
                {c.changePercent != null ? ` (${c.changePercent > 0 ? "+" : ""}${c.changePercent}%)` : ""} — {c.source}
              </title>
            </circle>
          </g>
        ))}
        {[0, Math.floor((coords.length - 1) / 2), coords.length - 1].map((i) => {
          const c = coords[i];
          if (!c) return null;
          return (
            <text key={c.date} x={c.x} y={h - 8} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9">
              {c.date.slice(0, 7)}
            </text>
          );
        })}
      </svg>
    </div>
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
        {points.map((p) => (
          <div key={p.date} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1">
            <span className="text-[9px] text-ink-soft tabular-nums">{p.views || ""}</span>
            <div
              className="w-full rounded-t bg-green/85"
              style={{ height: `${Math.max(p.views ? 8 : 2, (p.views / max) * 100)}%` }}
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

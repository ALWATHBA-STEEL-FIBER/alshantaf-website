"use client";

import type { InvestOwnershipSlice } from "@/lib/investApi";
import { Money } from "./Money";

const PALETTE = ["#1B4332", "#C9A227", "#2D6A4F", "#40916C", "#74C69D", "#52796F", "#84A98C"];

function percentOf(slice: InvestOwnershipSlice): number {
  const p = slice.percent;
  if (p === null || p === undefined || p === "") return 0;
  const n = typeof p === "number" ? p : Number(p);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function OwnershipChart({
  slices,
  emptyLabel = "No ownership data",
}: {
  slices?: InvestOwnershipSlice[] | null;
  emptyLabel?: string;
}) {
  const rows = (slices ?? []).filter((s) => s.label);
  const total = rows.reduce((sum, s) => sum + percentOf(s), 0);
  const normalized = total > 0 ? rows : [];

  if (normalized.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-white p-6 text-sm text-ink-soft text-center">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-white p-4 space-y-4">
      <div className="h-4 w-full rounded-full overflow-hidden flex bg-surface-2">
        {normalized.map((slice, i) => {
          const pct = percentOf(slice);
          if (pct <= 0) return null;
          const width = total > 0 ? (pct / total) * 100 : 0;
          return (
            <div
              key={slice.id || slice.label}
              className="h-full"
              style={{ width: `${width}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
              title={`${slice.label} ${pct}%`}
            />
          );
        })}
      </div>
      <ul className="space-y-2">
        {normalized.map((slice, i) => (
          <li key={slice.id || slice.label} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="font-medium truncate">{slice.label}</span>
              <span className="text-ink-soft tabular-nums">{percentOf(slice)}%</span>
            </div>
            <Money value={slice.amount} className="text-xs" showFinalizedBadge />
          </li>
        ))}
      </ul>
    </div>
  );
}
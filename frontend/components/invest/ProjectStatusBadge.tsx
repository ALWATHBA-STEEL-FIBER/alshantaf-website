"use client";

import type { InvestProjectStatus } from "@/lib/investApi";

const STYLES: Record<string, string> = {
  draft: "bg-surface-2 text-ink-soft border-line",
  fundraising: "bg-amber-50 text-amber-900 border-amber-200",
  active: "bg-green/10 text-green border-green/25",
  development: "bg-sky-50 text-sky-900 border-sky-200",
  operating: "bg-emerald-50 text-emerald-900 border-emerald-200",
  closed: "bg-ink/5 text-ink-soft border-line",
  settled: "bg-gold/15 text-green border-gold/40",
};

export function ProjectStatusBadge({ status }: { status?: InvestProjectStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex text-[11px] font-bold px-2 py-0.5 rounded-lg border border-line text-ink-soft bg-white">
        —
      </span>
    );
  }
  const key = String(status).toLowerCase();
  const style = STYLES[key] || "bg-white text-ink border-line";
  return (
    <span className={`inline-flex text-[11px] font-bold px-2 py-0.5 rounded-lg border uppercase tracking-wide ${style}`}>
      {status}
    </span>
  );
}
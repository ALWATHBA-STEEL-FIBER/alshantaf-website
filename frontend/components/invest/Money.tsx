"use client";

import type { InvestMoneyField } from "@/lib/investApi";

type MoneyProps = {
  value?: InvestMoneyField | string | number | null;
  currency?: string;
  className?: string;
  emptyLabel?: string;
  showFinalizedBadge?: boolean;
};

function resolveAmount(value: MoneyProps["value"]): { amount: number | null; currency: string; finalized: boolean; estimated: boolean } {
  if (value === null || value === undefined || value === "") {
    return { amount: null, currency: "JOD", finalized: false, estimated: false };
  }
  if (typeof value === "number" || typeof value === "string") {
    const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
    return { amount: Number.isFinite(n) ? n : null, currency: "JOD", finalized: true, estimated: false };
  }
  const amountRaw = value.amount;
  const n =
    amountRaw === null || amountRaw === undefined || amountRaw === ""
      ? null
      : typeof amountRaw === "number"
        ? amountRaw
        : Number(String(amountRaw).replace(/,/g, ""));
  return {
    amount: n !== null && Number.isFinite(n) ? n : null,
    currency: value.currency?.trim() || "JOD",
    finalized: value.finalized === true,
    estimated: value.estimated === true || value.finalized === false,
  };
}

export function Money({
  value,
  currency: currencyOverride,
  className = "",
  emptyLabel = "—",
  showFinalizedBadge = false,
}: MoneyProps) {
  const { amount, currency, finalized, estimated } = resolveAmount(value);
  const code = currencyOverride || currency;

  if (amount === null) {
    return <span className={`tabular-nums text-ink-soft ${className}`}>{emptyLabel}</span>;
  }

  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(amount);

  const tone = estimated && !finalized ? "text-amber-800" : "text-ink";
  const decoration = estimated && !finalized ? "underline decoration-dotted decoration-amber-500/60" : "";

  return (
    <span className={`inline-flex items-center gap-1.5 tabular-nums font-medium ${tone} ${decoration} ${className}`}>
      <span>
        {formatted} {code}
      </span>
      {showFinalizedBadge && estimated && !finalized ? (
        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
          Est.
        </span>
      ) : null}
      {showFinalizedBadge && finalized ? (
        <span className="text-[10px] font-bold uppercase tracking-wide text-green bg-green/10 border border-green/20 px-1.5 py-0.5 rounded-md">
          Final
        </span>
      ) : null}
    </span>
  );
}
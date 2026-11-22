"use client";

import type { ProjectMember } from "@/lib/investApi";
import { SPLIT_MODE_LABELS, fmt, toNum, useT } from "./ui";

export type SplitValue = { mode: string; shares: Record<string, string> };

export function splitFromExpense(e: { splitMode?: string; splitShares?: Record<string, string> | null }): SplitValue {
  return { mode: e.splitMode || "ownership", shares: { ...(e.splitShares ?? {}) } };
}

export function splitPayload(v: SplitValue) {
  return v.mode === "custom" ? { splitMode: "custom", splitShares: v.shares } : { splitMode: v.mode, splitShares: null };
}

/** Who carries an expense: by ownership, equally, or custom % per partner — with the amount each one bears. */
export function SplitEditor({
  members,
  amount,
  value,
  onChange,
}: {
  members: ProjectMember[];
  amount: string;
  value: SplitValue;
  onChange: (v: SplitValue) => void;
}) {
  const { t, lang } = useT();
  const total = toNum(amount) ?? 0;
  const ownSum = members.reduce((a, m) => a + (toNum(m.ownershipPercent) ?? 0), 0);
  const pctOf = (m: ProjectMember) =>
    value.mode === "equal"
      ? 100 / Math.max(1, members.length)
      : value.mode === "custom"
        ? toNum(value.shares[m.investorId]) ?? 0
        : ownSum > 0
          ? ((toNum(m.ownershipPercent) ?? 0) * 100) / ownSum
          : 0;
  const customSum = members.reduce((a, m) => a + (toNum(value.shares[m.investorId]) ?? 0), 0);
  const off = value.mode === "custom" && Math.abs(customSum - 100) > 0.01;

  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-ink-soft">{t("من يتحمّل المصروف؟", "Who carries this cost?")}</span>
        <div className="flex rounded-xl border border-line bg-white p-1">
          {Object.entries(SPLIT_MODE_LABELS).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                if (k === "custom" && value.mode !== "custom" && !Object.keys(value.shares).length && members.length) {
                  // Start custom from what the current mode gives, so the admin only tweaks it.
                  const shares: Record<string, string> = {};
                  let used = 0;
                  members.forEach((m, i) => {
                    const v = i === members.length - 1 ? +(100 - used).toFixed(2) : +pctOf(m).toFixed(2);
                    used += v;
                    if (v > 0) shares[m.investorId] = String(v);
                  });
                  onChange({ mode: "custom", shares });
                } else onChange({ mode: k, shares: value.shares });
              }}
              className={`h-8 px-3 rounded-lg text-xs font-bold ${value.mode === k ? "bg-green text-white" : "text-ink-soft"}`}
            >
              {lang === "ar" ? l[0] : l[1]}
            </button>
          ))}
        </div>
        {value.mode === "custom" ? (
          <>
            <button
              type="button"
              className="text-[11px] font-bold text-green underline"
              onClick={() => {
                const each = Math.floor((100 / Math.max(1, members.length)) * 100) / 100;
                const shares: Record<string, string> = {};
                members.forEach((m, i) => (shares[m.investorId] = String(i === 0 ? +(100 - each * (members.length - 1)).toFixed(2) : each)));
                onChange({ mode: "custom", shares });
              }}
            >
              {t("وزّع بالتساوي", "Fill equally")}
            </button>
            <button type="button" className="text-[11px] font-bold text-ink-soft underline" onClick={() => onChange({ mode: "custom", shares: {} })}>
              {t("تصفير", "Clear")}
            </button>
          </>
        ) : null}
      </div>
      <p className="text-[11px] text-ink-soft">{SPLIT_MODE_LABELS[value.mode]?.[lang === "ar" ? 2 : 3]}</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {members.map((m) => {
          const pct = pctOf(m);
          return (
            <div key={m.investorId} className="flex items-center gap-2 rounded-lg bg-white border border-line px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">{m.investorName}</div>
                <div className="text-[11px] text-ink-soft tabular-nums" dir="ltr">
                  {total ? `${fmt((total * pct) / 100, { decimals: 3 })} JOD` : "—"}
                </div>
              </div>
              {value.mode === "custom" ? (
                <div className="relative w-24">
                  <input
                    className="w-full h-9 rounded-lg border border-line px-2 !pr-6 text-sm tabular-nums text-left outline-none focus:border-gold"
                    dir="ltr"
                    inputMode="decimal"
                    value={value.shares[m.investorId] ?? ""}
                    placeholder="0"
                    onChange={(e) =>
                      onChange({ mode: "custom", shares: { ...value.shares, [m.investorId]: e.target.value.replace(/[^0-9.]/g, "") } })
                    }
                  />
                  <span className="absolute inset-y-0 right-2 flex items-center text-[11px] text-ink-soft pointer-events-none">%</span>
                </div>
              ) : (
                <span className="text-xs font-extrabold text-green tabular-nums" dir="ltr">
                  {fmt(pct, { decimals: 2 })}%
                </span>
              )}
            </div>
          );
        })}
      </div>
      {value.mode === "custom" ? (
        <div className={`text-xs font-bold ${off ? "text-red-700" : "text-green"}`}>
          {t("المجموع", "Total")}: <span dir="ltr">{fmt(customSum, { decimals: 2 })}%</span>
          {off ? ` — ${t("يجب أن يكون 100%", "must be 100%")}` : " ✓"}
        </div>
      ) : null}
    </div>
  );
}

/** Compact "who carries it" chips for an expense row. */
export function AllocationChips({
  allocation,
  members,
}: {
  allocation?: { investorId: string; percent: string; amount: string }[];
  members: ProjectMember[];
}) {
  if (!allocation?.length) return null;
  const name = (id: string) => members.find((m) => m.investorId === id)?.investorName ?? "؟";
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {allocation.map((a) => (
        <span key={a.investorId} className="text-[10px] rounded-md bg-surface-2 border border-line px-1.5 py-0.5 whitespace-nowrap">
          {name(a.investorId)} <b dir="ltr">{fmt(a.percent, { decimals: 1 })}%</b> · <span dir="ltr">{fmt(a.amount, { decimals: 0 })}</span>
        </span>
      ))}
    </div>
  );
}

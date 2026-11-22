"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import type { InvestMoneyField } from "@/lib/investApi";

export function useT() {
  const { lang } = useLanguage();
  // Stable per language so it is safe in effect dependency lists.
  const t = useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);
  return { lang, t };
}

type Num = string | number | null | undefined | InvestMoneyField;

export function toNum(v: Num): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "object") return toNum(v.amount as string | number | null | undefined);
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** 12,345.5 — Latin digits, up to 3 decimals (fils), trailing zeros trimmed. */
export function fmt(v: Num, opts: { decimals?: number; empty?: string; sign?: boolean } = {}) {
  const n = toNum(v);
  if (n == null) return opts.empty ?? "—";
  const s = new Intl.NumberFormat("en-US", { maximumFractionDigits: opts.decimals ?? 3 }).format(n);
  return opts.sign && n > 0 ? `+${s}` : s;
}

export function fmtPct(v: Num, decimals = 2) {
  const n = toNum(v);
  if (n == null) return "—";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(n)}%`;
}

export const inputCls =
  "w-full h-11 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:bg-surface-2";

export const btnPrimary =
  "h-11 px-5 rounded-xl bg-green text-white text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-green-2 disabled:opacity-50";
export const btnGhost =
  "h-11 px-4 rounded-xl border border-line bg-white text-green text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-surface-2 disabled:opacity-50";
export const btnGold =
  "h-11 px-5 rounded-xl bg-gold text-green text-sm font-extrabold inline-flex items-center justify-center gap-2 hover:bg-gold-2 disabled:opacity-50";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-bold text-ink-soft block mb-1">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-ink-soft mt-1 block">{hint}</span> : null}
    </label>
  );
}

export function MoneyInput({
  value,
  onChange,
  placeholder,
  currency = "JOD",
  autoFocus,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  currency?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <input
        className={`${inputCls} !pr-14 tabular-nums text-left`}
        dir="ltr"
        inputMode="decimal"
        value={value}
        placeholder={placeholder ?? "0"}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
      />
      <span className="absolute inset-y-0 right-3 flex items-center text-[11px] font-bold text-ink-soft pointer-events-none">
        {currency}
      </span>
    </div>
  );
}

export function Kpi({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "green" | "gold" | "red";
}) {
  const toneCls =
    tone === "green"
      ? "bg-green text-white border-green"
      : tone === "gold"
        ? "bg-gold/15 border-gold/40"
        : tone === "red"
          ? "bg-red-50 border-red-200"
          : "bg-white border-line";
  const subCls = tone === "green" ? "text-white/70" : "text-ink-soft";
  return (
    <div className={`rounded-2xl border p-4 ${toneCls}`}>
      <div className={`text-[11px] font-bold ${subCls}`}>{label}</div>
      <div className="text-xl font-extrabold mt-1 tabular-nums">{value}</div>
      {sub ? <div className={`text-[11px] mt-1 ${subCls}`}>{sub}</div> : null}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-white ${className}`}>
      {title || action ? (
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          {title ? <h2 className="font-extrabold text-green text-sm">{title}</h2> : <span />}
          {action}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-3.5">
          <h3 className="font-extrabold text-green">{title}</h3>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full hover:bg-surface-2 text-ink-soft text-lg" aria-label="Close">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export const STATUS_LABELS: Record<string, [string, string]> = {
  draft: ["مسودة", "Draft"],
  fundraising: ["جمع شركاء", "Fundraising"],
  capital_collection: ["جمع رأس المال", "Collecting capital"],
  acquisition_pending: ["قيد الشراء", "Acquisition pending"],
  acquired: ["تم الشراء", "Acquired"],
  active_management: ["قيد الإدارة", "Holding"],
  listed_for_sale: ["معروض للبيع", "Listed for sale"],
  sale_pending: ["قيد البيع", "Sale pending"],
  sold: ["تم البيع", "Sold"],
  settlement_pending: ["بانتظار التوزيع", "Awaiting payout"],
  settled: ["تم التوزيع", "Settled"],
  closed: ["مغلق", "Closed"],
  cancelled: ["ملغى", "Cancelled"],
};

/** Statuses a user can pick by hand, in lifecycle order (settled is set by closing). */
export const MANUAL_STATUSES = [
  "draft",
  "fundraising",
  "capital_collection",
  "acquisition_pending",
  "acquired",
  "active_management",
  "listed_for_sale",
  "sale_pending",
  "sold",
  "cancelled",
];

const STATUS_TONE: Record<string, string> = {
  draft: "bg-surface-2 text-ink-soft border-line",
  fundraising: "bg-amber-50 text-amber-900 border-amber-200",
  capital_collection: "bg-amber-50 text-amber-900 border-amber-200",
  acquisition_pending: "bg-sky-50 text-sky-900 border-sky-200",
  acquired: "bg-green/10 text-green border-green/25",
  active_management: "bg-green/10 text-green border-green/25",
  listed_for_sale: "bg-violet-50 text-violet-900 border-violet-200",
  sale_pending: "bg-violet-50 text-violet-900 border-violet-200",
  sold: "bg-gold/15 text-green border-gold/40",
  settlement_pending: "bg-gold/15 text-green border-gold/40",
  settled: "bg-green text-white border-green",
  closed: "bg-ink/5 text-ink-soft border-line",
  cancelled: "bg-red-50 text-red-800 border-red-200",
};

export function StatusPill({ status }: { status?: string | null }) {
  const { lang } = useT();
  const s = String(status || "draft");
  const label = STATUS_LABELS[s]?.[lang === "ar" ? 0 : 1] ?? s;
  return (
    <span className={`inline-flex items-center whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-lg border ${STATUS_TONE[s] ?? "bg-white border-line"}`}>
      {label}
    </span>
  );
}

export const EXPENSE_CATEGORY_LABELS: Record<string, [string, string]> = {
  land_purchase_fees: ["رسوم شراء الأرض", "Purchase fees"],
  registration: ["تسجيل وتنظيم", "Registration"],
  survey: ["مساحة", "Survey"],
  legal: ["محاماة وعقود", "Legal"],
  brokerage: ["سمسرة/دلالة", "Brokerage"],
  taxes: ["ضرائب ورسوم", "Taxes & fees"],
  development: ["تطوير وخدمات", "Development"],
  fencing: ["تسوير", "Fencing"],
  maintenance: ["صيانة وتنظيف", "Maintenance"],
  marketing: ["تسويق وإعلان", "Marketing"],
  valuation: ["تقييم/تخمين", "Valuation"],
  transport: ["مواصلات", "Transport"],
  other: ["أخرى", "Other"],
};

export const BASIS_LABELS: Record<string, [string, string, string, string]> = {
  investor_net_profit: [
    "نسبة من ربح كل شريك",
    "% of each partner's profit",
    "يُخصم X% من ربح كل شريك (غير المنسق) ويذهب للمنسق.",
    "X% is taken from every partner's profit (except the coordinator) and paid to the coordinator.",
  ],
  distributable_profit: [
    "نسبة من الربح الكلي",
    "% of total profit",
    "تُخصم X% من ربح المشروع قبل التوزيع، ثم يوزَّع الباقي حسب الحصص (المنسق يتحمل حصته أيضاً).",
    "X% of project profit is taken first, the rest is split by ownership (coordinator shares the cost).",
  ],
  sale_value: ["نسبة من سعر البيع", "% of sale price", "عمولة X% من سعر البيع الكامل.", "X% of the full sale price."],
  fixed: ["مبلغ ثابت", "Fixed fee", "مبلغ ثابت للمنسق من الربح.", "A fixed amount paid to the coordinator."],
  hybrid: ["ثابت + نسبة", "Fixed + %", "مبلغ ثابت + X% من الربح الكلي.", "A fixed amount plus X% of total profit."],
};

export function Avatar({ name, coordinator }: { name: string; coordinator?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span
      className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-extrabold ${
        coordinator ? "bg-gold text-green" : "bg-green/10 text-green"
      }`}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 font-medium">{message}</p>;
}

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

"use client";

import type { ReactNode } from "react";
import type { DistributionLine, DistributionResult } from "@/lib/investApi";
import { Avatar, fmt, fmtPct, toNum, useT } from "./ui";

/** Waterfall summary: sale → costs → capital back → expenses back → profit → coordinator cut → partners. */
export function WaterfallSummary({ r, currency = "JOD" }: { r: DistributionResult; currency?: string }) {
  const { t } = useT();
  const profit = toNum(r.distributableProfitBeforeCommission) ?? 0;
  const rows: [string, string, "plus" | "minus" | "total" | "gold"][] = [
    [t("سعر البيع", "Sale price"), r.saleProceeds, "plus"],
    ...(toNum(r.closingCosts) || toNum(r.unpaidLiabilities)
      ? ([[t("تكاليف البيع والالتزامات", "Selling costs & liabilities"), String((toNum(r.closingCosts) ?? 0) + (toNum(r.unpaidLiabilities) ?? 0)), "minus"]] as [string, string, "minus"][])
      : []),
    [t("إرجاع رأس المال للشركاء", "Capital returned to partners"), r.totalCapitalReturned, "minus"],
    [t("إرجاع المصاريف لمن دفعها", "Expenses refunded to payers"), r.totalExpenseReimbursements, "minus"],
    [profit < 0 ? t("الخسارة (تتوزع حسب الحصص)", "Loss (shared by ownership)") : t("صافي الربح القابل للتوزيع", "Distributable profit"), r.distributableProfitBeforeCommission, "total"],
    [t("حصة المنسق (العمولة)", "Coordinator cut"), r.coordinatorCommission, "gold"],
    [t("الربح الموزع على الشركاء بعد الخصم", "Profit to partners after cut"), r.distributableProfitAfterCommission, "total"],
  ];
  return (
    <div className="rounded-2xl border border-line bg-white divide-y divide-line overflow-hidden">
      {rows.map(([label, v, kind]) => (
        <div
          key={label}
          className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
            kind === "total" ? "bg-surface-2 font-extrabold text-green" : kind === "gold" ? "bg-gold/10 font-bold" : ""
          }`}
        >
          <span>{label}</span>
          <span className={`tabular-nums ${toNum(v)! < 0 ? "text-red-700" : ""}`} dir="ltr">
            {kind === "minus" ? "− " : ""}
            {fmt(v)} <span className="text-[11px] text-ink-soft">{currency}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Cell({ children, strong, className = "" }: { children: ReactNode; strong?: boolean; className?: string }) {
  return <td className={`px-3 py-2.5 tabular-nums whitespace-nowrap ${strong ? "font-extrabold" : ""} ${className}`}>{children}</td>;
}

/**
 * Per-partner breakdown with profit before and after the coordinator's cut.
 * Optional `actions` renders an extra column (e.g. "mark paid").
 */
export function DistributionTable({
  lines,
  actions,
  showPaid,
}: {
  lines: DistributionLine[];
  actions?: (l: DistributionLine) => ReactNode;
  showPaid?: boolean;
}) {
  const { t } = useT();
  const sum = (k: keyof DistributionLine) => lines.reduce((a, l) => a + (toNum(l[k] as string) ?? 0), 0);
  const neg = (v: string | undefined) => ((toNum(v) ?? 0) < 0 ? "text-red-700" : "");

  return (
    <div className="rounded-2xl border border-line bg-white overflow-x-auto">
      <table className="w-full text-sm min-w-[980px]">
        <thead className="bg-surface-2 text-[11px] text-ink-soft">
          <tr>
            <th className="px-3 py-2 text-start font-bold" rowSpan={2}>{t("الشريك", "Partner")}</th>
            <th className="px-3 py-2 text-start font-bold" rowSpan={2}>{t("الحصة", "Share")}</th>
            <th className="px-3 py-2 text-start font-bold border-s border-line" colSpan={2}>{t("يُرجع له", "Returned")}</th>
            <th className="px-3 py-2 text-start font-bold border-s border-line bg-gold/10" colSpan={3}>{t("الربح قبل ← بعد خصم المنسق", "Profit before → after cut")}</th>
            <th className="px-3 py-2 text-start font-bold border-s border-line" rowSpan={2}>{t("عمولة المنسق", "Cut earned")}</th>
            <th className="px-3 py-2 text-start font-bold border-s border-line bg-green/10 text-green" rowSpan={2}>{t("المستحق الكلي", "Total payout")}</th>
            <th className="px-3 py-2 text-start font-bold" rowSpan={2}>{t("العائد", "Return")}</th>
            {showPaid || actions ? <th className="px-3 py-2" rowSpan={2} /> : null}
          </tr>
          <tr>
            <th className="px-3 pb-2 text-start font-bold border-s border-line">{t("رأس المال", "Capital")}</th>
            <th className="px-3 pb-2 text-start font-bold">{t("مصاريف دفعها", "Expenses paid")}</th>
            <th className="px-3 pb-2 text-start font-bold border-s border-line bg-gold/10">{t("قبل الخصم", "Before")}</th>
            <th className="px-3 pb-2 text-start font-bold bg-gold/10">{t("الخصم", "Cut")}</th>
            <th className="px-3 pb-2 text-start font-bold bg-gold/10">{t("بعد الخصم", "After")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {lines.map((l) => {
            const paid = (toNum(l.paidAmount) ?? 0) > 0 && (toNum(l.paidAmount) ?? 0) >= (toNum(l.totalPayout) ?? 0);
            return (
              <tr key={l.partnerId} className={l.isCoordinator ? "bg-gold/5" : ""}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-[150px]">
                    <Avatar name={l.label} coordinator={l.isCoordinator} />
                    <div className="min-w-0">
                      <div className="font-bold truncate">{l.label}</div>
                      <div className="text-[11px] text-ink-soft">
                        {l.code ? `${l.code} · ` : ""}
                        {l.isCoordinator ? t("المنسق", "Coordinator") : t("شريك", "Partner")}
                      </div>
                    </div>
                  </div>
                </td>
                <Cell>
                  <div className="font-bold">{fmtPct(l.ownershipPercent)}</div>
                  {l.profitPercentAfter != null && (toNum(l.grossProfit) ?? 0) > 0 ? (
                    <div className="text-[10px] text-ink-soft">
                      {t("من الربح بعد الخصم", "of profit after cut")}: {fmtPct(l.profitPercentAfter)}
                    </div>
                  ) : null}
                </Cell>
                <Cell className="border-s border-line">{fmt(l.capitalReturned)}</Cell>
                <Cell>{(toNum(l.expenseReimbursement) ?? 0) ? fmt(l.expenseReimbursement) : <span className="text-ink-soft">—</span>}</Cell>
                <Cell className={`border-s border-line bg-gold/5 ${neg(l.grossProfit)}`}>{fmt(l.grossProfit)}</Cell>
                <Cell className="bg-gold/5 text-red-700">
                  {(toNum(l.commissionPaid) ?? 0) ? (
                    <>
                      −{fmt(l.commissionPaid)}
                      {l.commissionRatePercent ? <span className="text-[10px] text-ink-soft ms-1">({fmtPct(l.commissionRatePercent, 1)})</span> : null}
                    </>
                  ) : (
                    <span className="text-ink-soft">0</span>
                  )}
                </Cell>
                <Cell strong className={`bg-gold/5 ${neg(l.profitShare)}`}>{fmt(l.profitShare)}</Cell>
                <Cell className="border-s border-line text-green font-bold">
                  {(toNum(l.commissionEarned) ?? 0) ? `+${fmt(l.commissionEarned)}` : <span className="text-ink-soft font-normal">—</span>}
                </Cell>
                <Cell strong className="border-s border-line bg-green/5 text-green text-base">{fmt(l.totalPayout)}</Cell>
                <Cell className={neg(l.netGain)}>
                  {l.roiPercent != null ? (
                    <>
                      <div className="font-bold">{fmtPct(l.roiPercent, 1)}</div>
                      <div className="text-[10px] text-ink-soft">{fmt(l.netGain, { sign: true })}</div>
                    </>
                  ) : (
                    "—"
                  )}
                </Cell>
                {showPaid || actions ? (
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {showPaid && paid ? (
                      <div className="text-[11px] font-bold text-green">
                        ✓ {t("تم الدفع", "Paid")}
                        {l.paidRef ? <div className="font-normal text-ink-soft">{l.paidRef}</div> : null}
                      </div>
                    ) : null}
                    {actions?.(l)}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-surface-2 font-extrabold text-green">
          <tr>
            <td className="px-3 py-2.5">{t("المجموع", "Total")}</td>
            <Cell>100%</Cell>
            <Cell className="border-s border-line">{fmt(sum("capitalReturned"))}</Cell>
            <Cell>{fmt(sum("expenseReimbursement"))}</Cell>
            <Cell className="border-s border-line">{fmt(sum("grossProfit"))}</Cell>
            <Cell className="text-red-700">−{fmt(sum("commissionPaid"))}</Cell>
            <Cell>{fmt(sum("profitShare"))}</Cell>
            <Cell className="border-s border-line">+{fmt(sum("commissionEarned"))}</Cell>
            <Cell className="border-s border-line text-base">{fmt(sum("totalPayout"))}</Cell>
            <Cell>{""}</Cell>
            {showPaid || actions ? <td /> : null}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Compact phone-friendly cards for the same data. */
export function DistributionCards({ lines }: { lines: DistributionLine[] }) {
  const { t } = useT();
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {lines.map((l) => (
        <div key={l.partnerId} className={`rounded-2xl border p-4 ${l.isCoordinator ? "border-gold/50 bg-gold/5" : "border-line bg-white"}`}>
          <div className="flex items-center gap-2">
            <Avatar name={l.label} coordinator={l.isCoordinator} />
            <div className="min-w-0 flex-1">
              <div className="font-bold truncate">{l.label}</div>
              <div className="text-[11px] text-ink-soft">
                {fmtPct(l.ownershipPercent)} · {l.isCoordinator ? t("المنسق", "Coordinator") : t("شريك", "Partner")}
              </div>
            </div>
            <div className="text-end">
              <div className="text-[10px] text-ink-soft">{t("المستحق", "Payout")}</div>
              <div className="font-extrabold text-green tabular-nums">{fmt(l.totalPayout)}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="rounded-lg bg-surface-2 py-1.5">
              <div className="text-ink-soft">{t("قبل الخصم", "Before cut")}</div>
              <div className="font-bold tabular-nums">{fmt(l.grossProfit)}</div>
            </div>
            <div className="rounded-lg bg-red-50 py-1.5">
              <div className="text-ink-soft">{t("الخصم", "Cut")}</div>
              <div className="font-bold tabular-nums text-red-700">−{fmt(l.commissionPaid)}</div>
            </div>
            <div className="rounded-lg bg-green/10 py-1.5">
              <div className="text-ink-soft">{t("بعد الخصم", "After cut")}</div>
              <div className="font-bold tabular-nums text-green">{fmt(l.profitShare)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

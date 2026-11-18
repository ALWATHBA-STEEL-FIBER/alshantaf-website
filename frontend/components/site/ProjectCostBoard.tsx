"use client";

import Link from "next/link";
import type { SiteProjectCostSummary } from "@/lib/types";

function money(v: string | number | null | undefined) {
  const n = Number(v || 0);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })
    : "0";
}

function L(ar: string, en: string, lang: string) {
  return lang === "ar" ? ar : en;
}

export function ProjectCostBoard({
  cost,
  lang,
  adminLinks = false,
  projectId,
}: {
  cost: SiteProjectCostSummary;
  lang: string;
  adminLinks?: boolean;
  projectId: string;
}) {
  const k = cost.kpis;
  const cards = [
    { label: L("مصاريف المشروع", "Project expenses", lang), value: k.expenses, sub: `${k.expenseCount} ${L("بند", "lines", lang)}` },
    { label: L("أجور العمالة", "Labor payroll", lang), value: k.labor, sub: `${L("غير مدفوع", "unpaid", lang)} ${money(k.laborUnpaid)}` },
    { label: L("الإجمالي", "Grand total", lang), value: k.grandTotal, sub: L("مصاريف + أجور", "expenses + labor", lang), accent: true },
    {
      label: L("الموازنة", "Budget", lang),
      value: k.budget != null ? money(k.budget) : "—",
      sub:
        k.budgetUsedPct != null
          ? `${k.budgetUsedPct}% ${L("مستخدم", "used", lang)} · ${L("متبقي", "left", lang)} ${money(k.budgetRemaining)}`
          : L("غير محددة", "not set", lang),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl border p-4 ${
              c.accent ? "border-green/40 bg-green/5" : "border-line bg-white"
            }`}
          >
            <p className="text-[11px] font-bold text-ink-soft uppercase tracking-wide">{c.label}</p>
            <p className="text-xl font-extrabold text-green mt-1 tabular-nums">{money(c.value)}</p>
            <p className="text-xs text-ink-soft mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-line bg-white p-4 lg:col-span-1">
          <h3 className="font-bold text-green text-sm mb-2">{L("ساعات الحضور", "Attendance hours", lang)}</h3>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-ink-soft">{L("أيام عمل", "Days worked", lang)}</dt>
              <dd className="font-bold tabular-nums">{cost.hours.daysWorked}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-soft">{L("ساعات عادية", "Regular hours", lang)}</dt>
              <dd className="font-bold tabular-nums">{money(cost.hours.totalRegular)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-soft">{L("ساعات إضافية", "Extra hours", lang)}</dt>
              <dd className="font-bold tabular-nums">{money(cost.hours.totalExtra)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-soft">{L("أجور مدفوعة", "Labor paid", lang)}</dt>
              <dd className="font-bold tabular-nums text-green">{money(k.laborPaid)}</dd>
            </div>
          </dl>
          {adminLinks ? (
            <Link
              href={`/admin/site-work?projectId=${projectId}`}
              className="mt-3 inline-flex text-xs font-bold text-green hover:underline"
            >
              {L("إدارة الحضور والدفعات ←", "Manage attendance & payouts →", lang)}
            </Link>
          ) : null}
        </div>

        <div className="rounded-2xl border border-line bg-white p-4 lg:col-span-2">
          <h3 className="font-bold text-green text-sm mb-2">{L("تصنيف المصاريف", "Expense categories", lang)}</h3>
          {!cost.byCategory.length ? (
            <p className="text-sm text-ink-soft">{L("لا مصاريف مسجّلة في الفترة", "No expenses in range", lang)}</p>
          ) : (
            <ul className="space-y-2">
              {cost.byCategory.map((row) => {
                const pct =
                  Number(k.expenses) > 0 ? Math.round((Number(row.amount) / Number(k.expenses)) * 100) : 0;
                return (
                  <li key={row.key}>
                    <div className="flex justify-between text-sm mb-1 gap-2">
                      <span className="font-medium">{row.label}</span>
                      <span className="tabular-nums font-bold">{money(row.amount)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full bg-gold rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-[11px] text-ink-soft mt-3 leading-relaxed">{cost.note}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-white p-4 overflow-x-auto">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-bold text-green text-sm">{L("دفعات العمال", "Worker payouts", lang)}</h3>
            {adminLinks ? (
              <Link href="/admin/site-work/expenses" className="text-[11px] font-bold text-ink-soft hover:text-green">
                {L("لوحة المصاريف", "Expenses board", lang)}
              </Link>
            ) : (
              <Link
                href={`/site/expenses/new?projectId=${projectId}&scope=PROJECT`}
                className="text-[11px] font-bold text-green"
              >
                {L("+ مصروف مشروع", "+ Project expense", lang)}
              </Link>
            )}
          </div>
          {!cost.payouts.length ? (
            <p className="text-sm text-ink-soft">{L("لا دفعات بعد", "No payouts yet", lang)}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-soft border-b border-line">
                  <th className="text-start py-1.5 font-bold">{L("العامل", "Worker", lang)}</th>
                  <th className="text-start py-1.5 font-bold">{L("الأسبوع", "Week", lang)}</th>
                  <th className="text-end py-1.5 font-bold">{L("المبلغ", "Amount", lang)}</th>
                  <th className="text-end py-1.5 font-bold">{L("الحالة", "Status", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {cost.payouts.slice(0, 12).map((p) => (
                  <tr key={p.id} className="border-b border-line/60">
                    <td className="py-1.5">{p.workerName}</td>
                    <td className="py-1.5 text-ink-soft">{p.weekStart}</td>
                    <td className="py-1.5 text-end tabular-nums font-bold">{money(p.amount)}</td>
                    <td className="py-1.5 text-end">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                          p.paid ? "bg-green/10 text-green" : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {p.paid ? L("مدفوع", "Paid", lang) : L("مستحق", "Due", lang)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-white p-4 overflow-x-auto">
          <h3 className="font-bold text-green text-sm mb-2">{L("آخر المصاريف", "Recent expenses", lang)}</h3>
          {!cost.recentExpenses.length ? (
            <p className="text-sm text-ink-soft">{L("لا مصاريف", "No expenses", lang)}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-soft border-b border-line">
                  <th className="text-start py-1.5 font-bold">{L("التاريخ", "Date", lang)}</th>
                  <th className="text-start py-1.5 font-bold">{L("البند", "Item", lang)}</th>
                  <th className="text-end py-1.5 font-bold">{L("المبلغ", "Amount", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {cost.recentExpenses.slice(0, 12).map((e) => (
                  <tr key={e.id} className="border-b border-line/60">
                    <td className="py-1.5 text-ink-soft whitespace-nowrap">{e.expenseDate}</td>
                    <td className="py-1.5">
                      <span className="font-medium">{e.categoryLabel}</span>
                      <span className="block text-[11px] text-ink-soft truncate max-w-[14rem]">{e.description}</span>
                    </td>
                    <td className="py-1.5 text-end tabular-nums font-bold">{money(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

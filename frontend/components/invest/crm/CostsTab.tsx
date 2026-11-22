"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { crmApi, type ProjectFull } from "@/lib/investApi";
import { Avatar, Card, EXPENSE_CATEGORY_LABELS, ErrorNote, Field, Kpi, MoneyInput, btnPrimary, fmt, fmtPct, inputCls, toNum, todayISO, useT } from "./ui";

/** Total cost of the land, how it divides between partners, and what it is worth today. */
export function CostsTab({ p, done }: { p: ProjectFull; done: (msg: string) => Promise<void> }) {
  const { t, lang } = useT();
  const c = p.costs;
  const v = p.valuation;
  const [value, setValue] = useState(p.estimatedValue ? String(toNum(p.estimatedValue)) : "");
  const [date, setDate] = useState(p.estimatedValueDate ?? todayISO());
  const [note, setNote] = useState(p.estimatedValueNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function saveValuation(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await crmApi.updateProject(p.id, { estimatedValue: value || null, estimatedValueDate: value ? date : null, estimatedValueNote: note });
      await done(t("تم تحديث تقدير القيمة", "Valuation updated"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("تعذّر الحفظ", "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  const gain = toNum(v?.gain);
  const maxCat = Math.max(1, ...c.byCategory.map((x) => toNum(x.amount) ?? 0));
  const sum = (k: keyof (typeof c.perPartner)[number]) => c.perPartner.reduce((a, r) => a + (toNum(r[k] as string) ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={t("إجمالي التكلفة", "Total cost")} value={fmt(c.totalCost, { decimals: 0 })} sub={`${t("الأرض", "land")} ${fmt(c.purchasePrice, { decimals: 0 })} + ${t("مصاريف", "expenses")} ${fmt(c.expensesTotal, { decimals: 0 })}`} />
        <Kpi label={t("تكلفة المتر", "Cost per m²")} value={fmt(c.costPerSqm, { decimals: 2 })} sub={p.landAreaSqm ? `${fmt(p.landAreaSqm)} م²` : t("أدخل المساحة في البيانات", "set area in details")} />
        <Kpi
          label={t("آخر تقدير للقيمة", "Latest valuation")}
          value={fmt(v?.value, { decimals: 0 })}
          sub={v ? `${v.date ?? ""}${v.perSqm ? ` · ${fmt(v.perSqm, { decimals: 2 })}/م²` : ""}` : t("لم يُحدد", "not set")}
          tone="gold"
        />
        <Kpi
          label={t("الربح غير المحقق", "Unrealized gain")}
          value={gain != null ? fmt(gain, { decimals: 0, sign: true }) : "—"}
          sub={v?.gainPercent ? `${fmtPct(v.gainPercent, 1)} ${t("على التكلفة", "on cost")}` : "—"}
          tone={gain == null ? "default" : gain < 0 ? "red" : "green"}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title={t("توزيع التكاليف حسب البند", "Cost by item")} className="lg:col-span-1">
          <div className="space-y-2.5 text-sm">
            <CatRow label={t("سعر الأرض", "Land price")} amount={c.purchasePrice} pct={toNum(c.totalCost) ? ((toNum(c.purchasePrice) ?? 0) * 100) / toNum(c.totalCost)! : 0} width={100} strong />
            {c.byCategory.map((x) => (
              <CatRow
                key={x.category}
                label={`${EXPENSE_CATEGORY_LABELS[x.category]?.[lang === "ar" ? 0 : 1] ?? x.category} (${x.count})`}
                amount={x.amount}
                pct={toNum(x.percentOfCost) ?? 0}
                width={((toNum(x.amount) ?? 0) * 100) / maxCat}
              />
            ))}
            {!c.byCategory.length ? <p className="text-ink-soft text-xs">{t("لا مصاريف بعد.", "No expenses yet.")}</p> : null}
            <div className="border-t border-line pt-2 flex justify-between font-extrabold text-green">
              <span>{t("الإجمالي", "Total")}</span>
              <span className="tabular-nums" dir="ltr">{fmt(c.totalCost)}</span>
            </div>
          </div>
        </Card>

        <Card title={t("تقدير القيمة الحالية", "Current value assumption")} className="lg:col-span-2">
          <form onSubmit={saveValuation} className="grid sm:grid-cols-[1fr_auto_1.4fr_auto] gap-3 items-end">
            <Field label={t("القيمة المقدّرة للأرض", "Estimated land value")}>
              <MoneyInput value={value} onChange={setValue} />
            </Field>
            <Field label={t("تاريخ التقدير", "As of")}>
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t("المصدر / ملاحظة", "Source / note")}>
              <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("مثال: تقدير مكتب عقاري، سعر بيع مجاور", "e.g. broker estimate, nearby sale")} />
            </Field>
            <button className={btnPrimary} disabled={busy}>
              {busy ? "…" : t("حفظ", "Save")}
            </button>
          </form>
          <ErrorNote message={error || v?.error || ""} />
          {v?.lines.length ? (
            <div className="mt-4 rounded-xl border border-line overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="bg-surface-2 text-[11px] text-ink-soft">
                  <tr>
                    <th className="px-3 py-2 text-start">{t("الشريك", "Partner")}</th>
                    <th className="px-3 py-2 text-start">{t("قيمة حصته اليوم", "Stake worth today")}</th>
                    <th className="px-3 py-2 text-start">{t("ربحه بعد الخصم", "Profit after cut")}</th>
                    <th className="px-3 py-2 text-start">{t("صافي الربح", "Net gain")}</th>
                    <th className="px-3 py-2 text-start">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {v.lines.map((l) => (
                    <tr key={l.investorId}>
                      <td className="px-3 py-2 font-bold">{l.name}</td>
                      <td className="px-3 py-2 tabular-nums font-bold">{fmt(l.totalPayout, { decimals: 0 })}</td>
                      <td className="px-3 py-2 tabular-nums">{fmt(l.profitShare, { decimals: 0 })}</td>
                      <td className={`px-3 py-2 tabular-nums font-bold ${(toNum(l.netGain) ?? 0) < 0 ? "text-red-700" : "text-green"}`} dir="ltr">
                        {fmt(l.netGain, { decimals: 0, sign: true })}
                      </td>
                      <td className="px-3 py-2 tabular-nums" dir="ltr">{fmtPct(l.roiPercent, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-ink-soft px-3 py-2">
                {t("لو بيعت الأرض اليوم بهذه القيمة — بعد رد رأس المال والمصاريف وخصم المنسق.", "If the land sold today at this value — after returning capital and expenses and the coordinator cut.")}
              </p>
            </div>
          ) : !v ? (
            <p className="text-xs text-ink-soft mt-3">{t("أدخل آخر قيمة مقدّرة لترى قيمة حصة كل شريك اليوم.", "Enter the latest estimated value to see what each stake is worth today.")}</p>
          ) : null}
        </Card>
      </div>

      <Card title={t("تقسيم التكاليف على الشركاء", "Cost division per partner")}>
        <div className="rounded-xl border border-line overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-surface-2 text-[11px] text-ink-soft">
              <tr>
                <th className="px-3 py-2.5 text-start">{t("الشريك", "Partner")}</th>
                <th className="px-3 py-2.5 text-start">{t("الملكية", "Ownership")}</th>
                <th className="px-3 py-2.5 text-start">{t("حصته من الأرض", "Land share")}</th>
                <th className="px-3 py-2.5 text-start">{t("حصته من المصاريف", "Expense share")}</th>
                <th className="px-3 py-2.5 text-start">{t("حصته من التكلفة", "Cost share")}</th>
                <th className="px-3 py-2.5 text-start">{t("دفع رأس مال", "Capital paid")}</th>
                <th className="px-3 py-2.5 text-start">{t("دفع مصاريف", "Expenses paid")}</th>
                <th className="px-3 py-2.5 text-start">{t("الرصيد", "Balance")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {c.perPartner.map((r) => {
                const bal = toNum(r.balance) ?? 0;
                return (
                  <tr key={r.investorId}>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <Avatar name={r.name} coordinator={r.isCoordinator} />
                        <span>
                          <b className="block">{r.name}</b>
                          <span className="text-[11px] text-ink-soft">{r.code}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-bold text-green" dir="ltr">{fmtPct(r.ownershipPercent)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmt(r.landShare, { decimals: 0 })}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {fmt(r.expenseShare, { decimals: 0 })}
                      <span className="block text-[11px] text-ink-soft" dir="ltr">{fmtPct(r.expenseSharePercent)}</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-bold">
                      {fmt(r.costShare, { decimals: 0 })}
                      <span className="block text-[11px] text-ink-soft font-normal" dir="ltr">{fmtPct(r.costSharePercent)}</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{fmt(r.capital, { decimals: 0 })}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmt(r.expensesPaid, { decimals: 0 })}</td>
                    <td className={`px-3 py-2.5 tabular-nums font-bold ${bal < -0.5 ? "text-red-700" : bal > 0.5 ? "text-green" : ""}`}>
                      <span dir="ltr">{fmt(bal, { decimals: 0, sign: true })}</span>
                      <span className="block text-[10px] font-normal text-ink-soft">
                        {bal > 0.5 ? t("دفع أكثر من حصته", "paid more than share") : bal < -0.5 ? t("عليه", "owes") : t("متوازن", "even")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-surface-2 font-extrabold text-sm">
              <tr>
                <td className="px-3 py-2.5">{t("المجموع", "Total")}</td>
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5 tabular-nums">{fmt(sum("landShare"), { decimals: 0 })}</td>
                <td className="px-3 py-2.5 tabular-nums">{fmt(sum("expenseShare"), { decimals: 0 })}</td>
                <td className="px-3 py-2.5 tabular-nums">{fmt(sum("costShare"), { decimals: 0 })}</td>
                <td className="px-3 py-2.5 tabular-nums">{fmt(sum("capital"), { decimals: 0 })}</td>
                <td className="px-3 py-2.5 tabular-nums">{fmt(sum("expensesPaid"), { decimals: 0 })}</td>
                <td className="px-3 py-2.5 tabular-nums" dir="ltr">{fmt(sum("balance"), { decimals: 0, sign: true })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[11px] text-ink-soft mt-2">
          {t(
            "حصة المصاريف تتبع طريقة تقسيم كل مصروف (حسب الملكية، بالتساوي، أو نسب مخصصة). الرصيد = ما دفعه الشريك − حصته من التكلفة؛ يُسوّى تلقائياً عند البيع.",
            "Expense share follows each expense's split (ownership, equal or custom). Balance = what the partner paid − their share of cost; it settles automatically at sale."
          )}
        </p>
      </Card>
    </div>
  );
}

function CatRow({ label, amount, pct, width, strong }: { label: string; amount: string; pct: number; width: number; strong?: boolean }) {
  return (
    <div>
      <div className="flex justify-between gap-2">
        <span className={strong ? "font-bold" : ""}>{label}</span>
        <span className="tabular-nums" dir="ltr">
          {fmt(amount, { decimals: 0 })} <span className="text-ink-soft text-[11px]">({fmt(pct, { decimals: 1 })}%)</span>
        </span>
      </div>
      <div className="h-1.5 mt-1 rounded-full bg-surface-2 overflow-hidden">
        <div className={`h-full ${strong ? "bg-green" : "bg-gold"}`} style={{ width: `${Math.max(2, Math.min(100, width))}%` }} />
      </div>
    </div>
  );
}

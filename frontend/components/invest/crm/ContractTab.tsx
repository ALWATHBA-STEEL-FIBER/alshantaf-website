"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { crmApi, type ContractDetails, type ProjectFull, type SellerInstallment } from "@/lib/investApi";
import { Card, ErrorNote, Field, Kpi, MoneyInput, btnGhost, btnPrimary, fmt, fmtPct, inputCls, toNum, useT } from "./ui";

const EMPTY: ContractDetails = {
  contractNo: null,
  contractDate: null,
  sellerName: null,
  sellerIdNo: null,
  sellerPhone: null,
  registeredTo: null,
  deedNo: null,
  registryOffice: null,
  village: null,
  basin: null,
  plotNo: null,
  brokerName: null,
  brokerFee: null,
  contractPrice: null,
  downPayment: null,
  downPaymentDate: null,
  paymentTerms: null,
  transferDate: null,
  notes: null,
  installments: [],
};

type Draft = { [K in keyof Omit<ContractDetails, "installments">]: string } & { installments: SellerInstallment[] };

function toDraft(c: ContractDetails | null, purchasePrice: string | null): Draft {
  const src = c ?? { ...EMPTY, contractPrice: purchasePrice };
  const out = {} as Draft;
  for (const k of Object.keys(EMPTY) as (keyof ContractDetails)[]) {
    if (k === "installments") continue;
    (out as unknown as Record<string, string>)[k] = (src[k] as string | null) ?? "";
  }
  out.installments = (src.installments ?? []).map((i) => ({ ...i }));
  return out;
}

/** Purchase contract: seller, deed and registry, price, down payment and the seller payment schedule. */
export function ContractTab({ p, done }: { p: ProjectFull; done: (msg: string) => Promise<void> }) {
  const { t } = useT();
  const [d, setD] = useState<Draft>(() => toDraft(p.contract, p.stats.purchasePrice));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof Omit<Draft, "installments">) => (v: string) => setD((x) => ({ ...x, [k]: v }));
  const setInst = (i: number, k: keyof SellerInstallment, v: string | null) =>
    setD((x) => ({ ...x, installments: x.installments.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));

  const price = toNum(d.contractPrice) ?? 0;
  const scheduled = (toNum(d.downPayment) ?? 0) + d.installments.reduce((a, r) => a + (toNum(r.amount) ?? 0), 0);
  const paid = (toNum(d.downPayment) ?? 0) + d.installments.filter((r) => r.paidDate).reduce((a, r) => a + (toNum(r.amount) ?? 0), 0);
  const today = new Date().toISOString().slice(0, 10);

  async function save() {
    setBusy(true);
    setError("");
    try {
      await crmApi.updateProject(p.id, { contract: d });
      await done(t("تم حفظ بيانات العقد", "Contract saved"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("تعذّر الحفظ", "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  const text = (k: keyof Omit<Draft, "installments">, label: string, opts: { ltr?: boolean; span?: string } = {}) => (
    <Field label={label} className={opts.span}>
      <input className={inputCls} dir={opts.ltr ? "ltr" : undefined} value={d[k]} onChange={(e) => set(k)(e.target.value)} />
    </Field>
  );
  const date = (k: keyof Omit<Draft, "installments">, label: string) => (
    <Field label={label}>
      <input type="date" className={inputCls} value={d[k]} onChange={(e) => set(k)(e.target.value)} />
    </Field>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={t("سعر العقد", "Contract price")} value={fmt(price, { decimals: 0 })} sub="JOD" />
        <Kpi label={t("المدفوع للبائع", "Paid to seller")} value={fmt(paid, { decimals: 0 })} sub={price ? fmtPct((paid * 100) / price, 1) : "—"} tone="green" />
        <Kpi label={t("المتبقي للبائع", "Still owed to seller")} value={fmt(Math.max(0, price - paid), { decimals: 0 })} sub="JOD" tone={price - paid > 0 ? "gold" : "default"} />
        {(() => {
          const overdue = d.installments.filter((r) => !r.paidDate && r.dueDate && r.dueDate < today).reduce((a, r) => a + (toNum(r.amount) ?? 0), 0);
          return overdue > 0 ? (
            <Kpi label={t("دفعات متأخرة", "Overdue payments")} value={fmt(overdue, { decimals: 0 })} sub={t("تجاوزت تاريخ الاستحقاق", "past due date")} tone="red" />
          ) : (
            <Kpi label={t("غير مجدول", "Not scheduled")} value={fmt(Math.max(0, price - scheduled), { decimals: 0 })} sub={t("السعر − (العربون + الدفعات)", "price − (deposit + installments)")} />
          );
        })()}
      </div>

      <Card title={t("عقد الشراء", "Purchase contract")}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {text("contractNo", t("رقم العقد", "Contract no."))}
          {date("contractDate", t("تاريخ العقد", "Contract date"))}
          <Field label={t("سعر الأرض في العقد", "Contract price")}>
            <MoneyInput value={d.contractPrice} onChange={set("contractPrice")} />
          </Field>
          {date("transferDate", t("تاريخ نقل الملكية", "Title transfer date"))}
          {text("sellerName", t("اسم البائع", "Seller name"))}
          {text("sellerIdNo", t("رقم هوية البائع", "Seller ID no."), { ltr: true })}
          {text("sellerPhone", t("هاتف البائع", "Seller phone"), { ltr: true })}
          {text("registeredTo", t("مسجلة باسم", "Registered to"))}
        </div>
      </Card>

      <Card title={t("بيانات السند والتسجيل", "Deed & registry")}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {text("deedNo", t("رقم سند التسجيل", "Deed no."), { ltr: true })}
          {text("registryOffice", t("مديرية التسجيل", "Land registry office"))}
          {text("village", t("القرية / الأراضي", "Village"))}
          {text("basin", t("الحوض", "Basin"))}
          {text("plotNo", t("رقم القطعة", "Plot no."), { ltr: true })}
          {text("brokerName", t("الوسيط / المكتب", "Broker"))}
          <Field label={t("عمولة الوسيط", "Broker fee")}>
            <MoneyInput value={d.brokerFee} onChange={set("brokerFee")} />
          </Field>
        </div>
        <p className="text-[11px] text-ink-soft mt-2">
          {t("سجّل الرسوم والعمولات المدفوعة فعلياً كمصاريف ليدخلوا في التكلفة والتوزيع.", "Record fees actually paid as expenses so they count in cost and the split.")}
        </p>
      </Card>

      <Card
        title={t("الدفعات للبائع", "Payments to the seller")}
        action={
          <button
            type="button"
            className="text-xs font-bold text-green"
            onClick={() =>
              setD((x) => ({
                ...x,
                installments: [
                  ...x.installments,
                  { id: `n${Date.now().toString(36)}`, label: t(`دفعة ${x.installments.length + 2}`, `Payment ${x.installments.length + 2}`), amount: "", dueDate: null, paidDate: null, note: null },
                ],
              }))
            }
          >
            + {t("إضافة دفعة", "Add payment")}
          </button>
        }
      >
        <div className="grid sm:grid-cols-3 gap-3 mb-3">
          <Field label={t("العربون / الدفعة الأولى", "Deposit / first payment")}>
            <MoneyInput value={d.downPayment} onChange={set("downPayment")} />
          </Field>
          {date("downPaymentDate", t("تاريخ العربون", "Deposit date"))}
        </div>
        {d.installments.length ? (
          <div className="rounded-xl border border-line overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-surface-2 text-[11px] text-ink-soft">
                <tr>
                  <th className="px-2 py-2 text-start">{t("الدفعة", "Payment")}</th>
                  <th className="px-2 py-2 text-start">{t("المبلغ", "Amount")}</th>
                  <th className="px-2 py-2 text-start">{t("تاريخ الاستحقاق", "Due")}</th>
                  <th className="px-2 py-2 text-start">{t("تاريخ الدفع", "Paid on")}</th>
                  <th className="px-2 py-2 text-start">{t("ملاحظة", "Note")}</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.installments.map((r, i) => {
                  const late = !r.paidDate && r.dueDate && r.dueDate < today;
                  return (
                    <tr key={r.id} className={late ? "bg-red-50/60" : r.paidDate ? "bg-green/5" : ""}>
                      <td className="px-2 py-1.5">
                        <input className={`${inputCls} h-9`} value={r.label} onChange={(e) => setInst(i, "label", e.target.value)} />
                      </td>
                      <td className="px-2 py-1.5 w-40">
                        <MoneyInput value={r.amount} onChange={(v) => setInst(i, "amount", v)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="date" className={`${inputCls} h-9`} value={r.dueDate ?? ""} onChange={(e) => setInst(i, "dueDate", e.target.value || null)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="date" className={`${inputCls} h-9`} value={r.paidDate ?? ""} onChange={(e) => setInst(i, "paidDate", e.target.value || null)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input className={`${inputCls} h-9`} value={r.note ?? ""} onChange={(e) => setInst(i, "note", e.target.value || null)} />
                      </td>
                      <td className="px-2 py-1.5 text-end whitespace-nowrap">
                        {!r.paidDate ? (
                          <button type="button" className="text-[11px] font-bold text-green px-1" onClick={() => setInst(i, "paidDate", today)}>
                            {t("دُفعت", "Paid")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="text-[11px] font-bold text-red-700 px-1"
                          onClick={() => setD((x) => ({ ...x, installments: x.installments.filter((_, j) => j !== i) }))}
                        >
                          {t("حذف", "Remove")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">{t("لا دفعات مجدولة بعد العربون.", "No installments after the deposit.")}</p>
        )}
      </Card>

      <Card title={t("شروط الدفع والملاحظات", "Payment terms & notes")}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={t("شروط الدفع", "Payment terms")}>
            <textarea className={`${inputCls} h-24 py-2`} value={d.paymentTerms} onChange={(e) => set("paymentTerms")(e.target.value)} />
          </Field>
          <Field label={t("ملاحظات العقد", "Contract notes")}>
            <textarea className={`${inputCls} h-24 py-2`} value={d.notes} onChange={(e) => set("notes")(e.target.value)} />
          </Field>
        </div>
      </Card>

      <ErrorNote message={error} />
      <div className="sticky bottom-3 z-20 flex gap-2 rounded-2xl border border-line bg-white/95 backdrop-blur p-2 shadow-lg w-fit">
        <button className={btnPrimary} onClick={save} disabled={busy}>
          {busy ? "…" : t("حفظ بيانات العقد", "Save contract")}
        </button>
        <button className={btnGhost} onClick={() => setD(toDraft(p.contract, p.stats.purchasePrice))} disabled={busy}>
          {t("تراجع", "Reset")}
        </button>
      </div>
    </div>
  );
}

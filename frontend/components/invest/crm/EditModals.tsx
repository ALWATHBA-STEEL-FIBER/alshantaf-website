"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { crmApi, type ProjectContribution, type ProjectExpense, type ProjectMember } from "@/lib/investApi";
import { SplitEditor, splitFromExpense, splitPayload, type SplitValue } from "./SplitEditor";
import {
  EXPENSE_CATEGORY_LABELS,
  ErrorNote,
  Field,
  Modal,
  MoneyInput,
  PAYMENT_METHOD_LABELS,
  btnGhost,
  btnPrimary,
  inputCls,
  toNum,
  useT,
} from "./ui";

export const KIND_LABELS: Record<string, [string, string]> = {
  initial: ["دفعة أولى", "Initial"],
  additional: ["دفعة إضافية", "Additional"],
  capital_call: ["طلب تمويل", "Capital call"],
  adjustment: ["تسوية", "Adjustment"],
  withdrawal: ["سحب", "Withdrawal"],
};

/** Edit a partner payment (amount, type, partner, date, method, reference, note). */
export function ContributionEditModal({
  c,
  members,
  onClose,
  onSaved,
}: {
  c: ProjectContribution;
  members: ProjectMember[];
  onClose: () => void;
  onSaved: (msg: string) => Promise<void>;
}) {
  const { t, lang } = useT();
  const [d, setD] = useState({
    investorId: c.investorId,
    amount: String(toNum(c.amount) ?? ""),
    kind: c.kind,
    contributedAt: c.contributedAt,
    paymentMethod: c.paymentMethod ?? "",
    paymentRef: c.paymentRef ?? "",
    notes: c.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof d) => (v: string) => setD((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await crmApi.updateContribution(c.id, { ...d, paymentMethod: d.paymentMethod || null });
      await onSaved(t("تم تعديل الدفعة", "Payment updated"));
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("تعذّر الحفظ", "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t("تعديل دفعة", "Edit payment")}>
      <form onSubmit={save} className="space-y-3">
        <Field label={t("الشريك", "Partner")}>
          <select className={inputCls} value={d.investorId} onChange={(e) => set("investorId")(e.target.value)}>
            {members.map((m) => (
              <option key={m.investorId} value={m.investorId}>
                {m.investorName} ({m.code})
              </option>
            ))}
          </select>
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={t("المبلغ", "Amount")}>
            <MoneyInput value={d.amount} onChange={set("amount")} />
          </Field>
          <Field label={t("النوع", "Type")}>
            <select className={inputCls} value={d.kind} onChange={(e) => set("kind")(e.target.value)}>
              {Object.entries(KIND_LABELS).map(([k, [ar, en]]) => (
                <option key={k} value={k}>
                  {lang === "ar" ? ar : en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("التاريخ", "Date")}>
            <input type="date" className={inputCls} value={d.contributedAt} onChange={(e) => set("contributedAt")(e.target.value)} />
          </Field>
          <Field label={t("طريقة الدفع", "Method")}>
            <select className={inputCls} value={d.paymentMethod} onChange={(e) => set("paymentMethod")(e.target.value)}>
              <option value="">—</option>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, [ar, en]]) => (
                <option key={k} value={k}>
                  {lang === "ar" ? ar : en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("رقم الحوالة / الشيك / الوصل", "Transfer / cheque / receipt no.")} className="sm:col-span-2">
            <input className={inputCls} dir="ltr" value={d.paymentRef} onChange={(e) => set("paymentRef")(e.target.value)} />
          </Field>
        </div>
        <Field label={t("ملاحظة", "Note")}>
          <input className={inputCls} value={d.notes} onChange={(e) => set("notes")(e.target.value)} />
        </Field>
        <p className="text-[11px] text-ink-soft">
          {t(
            "تغيير المبلغ أو النوع أو الشريك يعكس القيد القديم ويسجّل قيداً جديداً، وتتحدّث نسب الملكية تلقائياً.",
            "Changing amount, type or partner reverses the old entry and posts a new one; ownership updates automatically."
          )}
        </p>
        <ErrorNote message={error} />
        <div className="flex gap-2">
          <button className={`${btnPrimary} flex-1`} disabled={busy || !d.amount}>
            {busy ? "…" : t("حفظ التعديل", "Save changes")}
          </button>
          <button type="button" className={btnGhost} onClick={onClose}>
            {t("إلغاء", "Cancel")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Edit an expense: text, category, date, amount, who paid, and who carries it. */
export function ExpenseEditModal({
  e,
  members,
  onClose,
  onSaved,
}: {
  e: ProjectExpense;
  members: ProjectMember[];
  onClose: () => void;
  onSaved: (msg: string) => Promise<void>;
}) {
  const { t, lang } = useT();
  const [d, setD] = useState({
    title: e.title,
    amount: String(toNum(e.amount) ?? ""),
    category: e.category ?? "other",
    expenseDate: e.expenseDate,
    description: e.description ?? "",
    fundedBy: e.fundedBy,
    payerInvestorId: e.payerInvestorId ?? members.find((m) => m.isCoordinator)?.investorId ?? members[0]?.investorId ?? "",
  });
  const [split, setSplit] = useState<SplitValue>(splitFromExpense(e));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof d) => (v: string) => setD((x) => ({ ...x, [k]: v }));

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    try {
      await crmApi.updateExpense(e.id, {
        title: d.title,
        amount: d.amount,
        category: d.category,
        expenseDate: d.expenseDate,
        description: d.description,
        fundedBy: d.fundedBy,
        payerInvestorId: d.fundedBy === "partner" ? d.payerInvestorId : null,
        ...splitPayload(split),
      });
      await onSaved(t("تم تعديل المصروف", "Expense updated"));
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("تعذّر الحفظ", "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t("تعديل مصروف", "Edit expense")} wide>
      <form onSubmit={save} className="space-y-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label={t("الوصف *", "Description *")} className="sm:col-span-2">
            <input className={inputCls} value={d.title} onChange={(x) => set("title")(x.target.value)} />
          </Field>
          <Field label={t("المبلغ", "Amount")}>
            <MoneyInput value={d.amount} onChange={set("amount")} />
          </Field>
          <Field label={t("التاريخ", "Date")}>
            <input type="date" className={inputCls} value={d.expenseDate} onChange={(x) => set("expenseDate")(x.target.value)} />
          </Field>
          <Field label={t("التصنيف", "Category")}>
            <select className={inputCls} value={d.category} onChange={(x) => set("category")(x.target.value)}>
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, [ar, en]]) => (
                <option key={k} value={k}>
                  {lang === "ar" ? ar : en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("مصدر الدفع", "Paid from")}>
            <select className={inputCls} value={d.fundedBy} onChange={(x) => set("fundedBy")(x.target.value)}>
              <option value="partner">{t("دفعه شريك (يُرجع له)", "A partner (refunded)")}</option>
              <option value="project">{t("صندوق المشروع", "Project pool")}</option>
            </select>
          </Field>
          {d.fundedBy === "partner" ? (
            <Field label={t("من دفع؟", "Who paid?")}>
              <select className={inputCls} value={d.payerInvestorId} onChange={(x) => set("payerInvestorId")(x.target.value)}>
                {members.map((m) => (
                  <option key={m.investorId} value={m.investorId}>
                    {m.investorName}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label={t("تفاصيل / المورد / رقم الفاتورة", "Details / vendor / invoice")} className={d.fundedBy === "partner" ? "" : "sm:col-span-2"}>
            <input className={inputCls} value={d.description} onChange={(x) => set("description")(x.target.value)} />
          </Field>
        </div>
        <SplitEditor members={members} amount={d.amount} value={split} onChange={setSplit} />
        <ErrorNote message={error} />
        <div className="flex gap-2">
          <button className={`${btnPrimary} flex-1`} disabled={busy || !d.title || !d.amount}>
            {busy ? "…" : t("حفظ التعديل", "Save changes")}
          </button>
          <button type="button" className={btnGhost} onClick={onClose}>
            {t("إلغاء", "Cancel")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

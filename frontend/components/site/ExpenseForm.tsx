"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { SiteExpense, SiteExpenseInput, SiteExpenseMeta, SiteExpenseScope } from "@/lib/types";
import { todayLocalISO, addDaysISO } from "@/lib/siteDates";
import { categoryColor, categoryIcon, jod } from "./expenseUi";

const field =
  "w-full h-12 rounded-xl border border-[#d9d2c4] bg-[#f7f4ee] px-3 text-[15px] outline-none focus:border-[#d4a84b] focus:bg-white";
const label = "text-xs font-bold text-[#5a6b66] mb-1.5 block";

type Props = {
  meta: SiteExpenseMeta;
  initial?: SiteExpense | null;
  defaultScope?: SiteExpenseScope;
  defaultProjectId?: string | null;
  onSaved: (saved: SiteExpense, again: boolean) => void;
  onDelete?: () => void;
};

export function ExpenseForm({ meta, initial, defaultScope: _defaultScope, defaultProjectId, onSaved, onDelete }: Props) {
  const today = todayLocalISO();
  // Engineers record project expenses only; company expenses are admin-created.
  const scope: SiteExpenseScope = "PROJECT";
  const [projectId, setProjectId] = useState<string>(
    initial?.projectId || defaultProjectId || (meta.projects.length === 1 ? meta.projects[0]!.id : "")
  );
  const [amount, setAmount] = useState(initial ? String(Number(initial.amount)) : "");
  const [category, setCategory] = useState(initial?.category || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [expenseDate, setExpenseDate] = useState(initial?.expenseDate || today);
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod || "cash");
  const [vendor, setVendor] = useState(initial?.vendor || "");
  const [invoiceNo, setInvoiceNo] = useState(initial?.invoiceNo || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [receipt, setReceipt] = useState<{ file: string; mime: string } | null>(null);
  const [hadReceipt, setHadReceipt] = useState(Boolean(initial?.hasReceipt));
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showMore, setShowMore] = useState(Boolean(initial?.vendor || initial?.invoiceNo || initial?.notes));
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(
    () => meta.categories.filter((c) => c.scopes.includes(scope)),
    [meta.categories, scope]
  );

  useEffect(() => {
    return () => {
      if (receiptPreview?.startsWith("blob:")) URL.revokeObjectURL(receiptPreview);
    };
  }, [receiptPreview]);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const stored = await api.uploadSiteExpenseReceipt(file);
      setReceipt(stored);
      setHadReceipt(false);
      setReceiptPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : "pdf");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر رفع الإيصال");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function validate(): string | null {
    const n = Number(amount);
    if (!amount || !Number.isFinite(n) || n <= 0) return "أدخل المبلغ";
    if (scope === "PROJECT" && !projectId) return "اختر المشروع";
    if (!category) return "اختر التصنيف";
    if (!description.trim()) return "اكتب وصفاً قصيراً للمصروف";
    return null;
  }

  async function submit(again: boolean) {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError("");
    const payload: SiteExpenseInput = {
      scope,
      projectId: scope === "PROJECT" ? projectId : null,
      category,
      description: description.trim(),
      amount: Number(amount),
      expenseDate,
      paymentMethod: paymentMethod || null,
      vendor: vendor.trim() || null,
      invoiceNo: invoiceNo.trim() || null,
      notes: notes.trim() || null,
      // undefined = keep the existing receipt, null = remove it.
      receiptFile: receipt?.file ?? (hadReceipt && initial ? undefined : null),
      receiptMime: receipt?.mime ?? null,
    };
    try {
      let saved: SiteExpense;
      if (initial) {
        saved = await api.updateSiteExpense(initial.id, payload);
      } else {
        saved = await api.createSiteExpense(payload);
      }
      if (again) {
        setAmount("");
        setDescription("");
        setVendor("");
        setInvoiceNo("");
        setNotes("");
        setReceipt(null);
        setReceiptPreview(null);
      }
      onSaved(saved, again);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  const selectedProject = meta.projects.find((p) => p.id === projectId);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-[#0f342f] text-white px-4 py-3">
        <div className="text-sm font-extrabold">مصروف مشروع</div>
        <div className="text-[11px] text-white/70 mt-0.5">
          المهندس يسجّل المصروف على المشروع · المنسق (أحمد / محمد) يتحمّل التكلفة
        </div>
      </div>

      {/* Project picker */}
      <div>
        <span className={label}>المشروع</span>
        {meta.projects.length === 0 ? (
          <p className="text-sm text-[#5a6b66]">لا توجد مشاريع مخصصة لك.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
            {meta.projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProjectId(p.id)}
                className={`snap-start shrink-0 min-w-[8.5rem] rounded-xl border px-3 py-2.5 text-start transition ${
                  projectId === p.id
                    ? "bg-[#0f342f] border-[#0f342f] text-white"
                    : "bg-white border-[#e4ddd0] text-[#0f342f]"
                }`}
              >
                <div className="text-sm font-bold truncate">{p.name}</div>
                <div className={`text-[10px] mt-0.5 truncate ${projectId === p.id ? "text-white/70" : "text-[#5a6b66]"}`}>
                  {p.isCoordinator
                    ? "أنت المنسق · تدفع أنت"
                    : p.coordinator
                      ? `يدفع: ${p.coordinator.name}`
                      : p.code || "—"}
                </div>
              </button>
            ))}
          </div>
        )}
        {selectedProject?.coordinator && !selectedProject.isCoordinator ? (
          <p className="text-[11px] text-[#5a6b66] mt-2">
            يُسجَّل باسمك ويُحسب على ميزانية المنسق {selectedProject.coordinator.name}.
          </p>
        ) : null}
      </div>

      {/* Amount */}
      <div>
        <span className={label}>المبلغ</span>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full h-16 rounded-2xl border-2 border-[#d9d2c4] bg-white pl-4 pr-14 text-3xl font-extrabold text-[#0f342f] outline-none focus:border-[#d4a84b]"
            style={{ fontFamily: "var(--font-brand), sans-serif" }}
            dir="ltr"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#5a6b66] pointer-events-none">
            د.أ
          </span>
        </div>
      </div>

      {/* Category */}
      <div>
        <span className={label}>التصنيف</span>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const active = category === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`h-10 px-3.5 rounded-full text-[13px] font-bold border transition ${
                  active ? "text-white border-transparent" : "bg-white text-[#0f342f] border-[#e4ddd0]"
                }`}
                style={active ? { backgroundColor: categoryColor(c.key) } : undefined}
              >
                <span aria-hidden className="me-1">{categoryIcon(c.key)}</span>
                {c.ar}
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={label} htmlFor="exp-desc">
          الوصف
        </label>
        <input
          id="exp-desc"
          className={field}
          placeholder={scope === "PROJECT" ? "مثال: 20 كيس إسمنت + نقل" : "مثال: صيانة سيارة الشركة"}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
        />
      </div>

      {/* Date */}
      <div>
        <span className={label}>التاريخ</span>
        <div className="flex gap-2">
          {[
            [today, "اليوم"],
            [addDaysISO(today, -1), "أمس"],
          ].map(([d, l]) => (
            <button
              key={d}
              type="button"
              onClick={() => setExpenseDate(d!)}
              className={`h-12 px-4 rounded-xl text-sm font-bold border ${
                expenseDate === d ? "bg-[#0f342f] text-white border-[#0f342f]" : "bg-white border-[#e4ddd0] text-[#0f342f]"
              }`}
            >
              {l}
            </button>
          ))}
          <input
            type="date"
            value={expenseDate}
            max={today}
            onChange={(e) => e.target.value && setExpenseDate(e.target.value)}
            className={`${field} flex-1 min-w-0`}
          />
        </div>
      </div>

      {/* Payment */}
      <div>
        <span className={label}>طريقة الدفع</span>
        <div className="flex flex-wrap gap-2">
          {meta.paymentMethods.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPaymentMethod(p.key)}
              className={`h-10 px-3.5 rounded-full text-[13px] font-bold border ${
                paymentMethod === p.key
                  ? "bg-[#d4a84b] text-[#0f342f] border-[#d4a84b]"
                  : "bg-white text-[#0f342f] border-[#e4ddd0]"
              }`}
            >
              {p.ar}
            </button>
          ))}
        </div>
      </div>

      {/* Receipt */}
      <div>
        <span className={label}>صورة الفاتورة / الإيصال (اختياري)</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        {receiptPreview || hadReceipt ? (
          <div className="flex items-center gap-3 rounded-xl border border-[#e4ddd0] bg-white p-2.5">
            {receiptPreview && receiptPreview !== "pdf" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={receiptPreview} alt="" className="h-14 w-14 rounded-lg object-cover" />
            ) : hadReceipt && initial ? (
              <a
                href={api.siteExpenseReceiptUrl(initial.id)}
                target="_blank"
                rel="noreferrer"
                className="h-14 w-14 rounded-lg bg-[#f3f1eb] flex items-center justify-center text-xs font-bold text-[#0f342f]"
              >
                عرض
              </a>
            ) : (
              <div className="h-14 w-14 rounded-lg bg-[#f3f1eb] flex items-center justify-center text-xs font-bold">PDF</div>
            )}
            <div className="flex-1 text-sm font-bold text-[#0f342f]">تم إرفاق الإيصال ✓</div>
            <button
              type="button"
              className="text-xs font-bold text-[#5a6b66] px-2"
              onClick={() => fileRef.current?.click()}
            >
              تغيير
            </button>
            <button
              type="button"
              className="text-xs font-bold text-red-700 px-2"
              onClick={() => {
                setReceipt(null);
                setReceiptPreview(null);
                setHadReceipt(false);
              }}
            >
              حذف
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="w-full h-14 rounded-xl border-2 border-dashed border-[#d9d2c4] bg-white/60 text-sm font-bold text-[#0f342f] disabled:opacity-60"
          >
            {uploading ? "جاري الرفع…" : "📷  التقط صورة أو اختر ملفاً"}
          </button>
        )}
      </div>

      {/* More details */}
      <div className="rounded-2xl border border-[#e4ddd0] bg-white">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="w-full flex items-center justify-between px-4 h-12 text-sm font-bold text-[#0f342f]"
        >
          تفاصيل إضافية (المورّد، رقم الفاتورة، ملاحظات)
          <span className="text-[#5a6b66]">{showMore ? "−" : "+"}</span>
        </button>
        {showMore ? (
          <div className="px-4 pb-4 space-y-3">
            <div>
              <label className={label} htmlFor="exp-vendor">
                المورّد / الجهة
              </label>
              <input id="exp-vendor" className={field} value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="exp-inv">
                رقم الفاتورة
              </label>
              <input id="exp-inv" className={field} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="exp-notes">
                ملاحظات
              </label>
              <textarea
                id="exp-notes"
                className={`${field} h-24 py-2`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm font-bold text-red-700">{error}</div>
      ) : null}

      {/* Actions */}
      <div className="space-y-2">
        <div className="sticky bottom-0 z-10 -mx-4 px-4 pt-3 pb-3 bg-gradient-to-t from-[#f3f1eb] via-[#f3f1eb] to-transparent">
        <button
          type="button"
          disabled={saving || uploading}
          onClick={() => submit(false)}
          className="w-full h-14 rounded-2xl bg-[#0f342f] text-white font-extrabold text-base disabled:opacity-60 shadow-[0_12px_30px_-12px_rgba(15,52,47,0.7)]"
        >
          {saving
            ? "جاري الحفظ…"
            : `حفظ${Number(amount) > 0 ? ` ${jod(amount)} د.أ` : ""}${
                selectedProject ? ` · ${selectedProject.name}` : ""
              }`}
        </button>
        </div>
        {!initial ? (
          <button
            type="button"
            disabled={saving || uploading}
            onClick={() => submit(true)}
            className="w-full h-11 rounded-2xl bg-white border border-[#e4ddd0] text-[#0f342f] font-bold text-sm disabled:opacity-60"
          >
            حفظ وإضافة مصروف آخر
          </button>
        ) : onDelete ? (
          <button
            type="button"
            disabled={saving}
            onClick={onDelete}
            className="w-full h-11 rounded-2xl bg-white border border-red-200 text-red-700 font-bold text-sm"
          >
            حذف المصروف
          </button>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";

type Props = {
  lang: string;
  /** null = every project. */
  project: { id: string; name: string } | null;
  onClose: () => void;
  onDone: (msg: string) => Promise<void> | void;
  onError: (msg: string) => void;
};

/** Confirm dialog: clear attendance + weekly payouts (optionally project expenses); projects & workers stay. */
export function ClearRecordsDialog({ lang, project, onClose, onDone, onError }: Props) {
  const ar = lang === "ar";
  const [word, setWord] = useState("");
  const [includeExpenses, setIncludeExpenses] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const r = await api.purgeSiteRecords({ confirm: word, projectId: project?.id ?? null, includeExpenses });
      await onDone(
        ar
          ? `تم الحذف: ${r.records} سجل حضور · ${r.payouts} دفعة أسبوعية${includeExpenses ? ` · ${r.expenses} مصروف` : ""}`
          : `Deleted ${r.records} attendance rows · ${r.payouts} weekly payouts${includeExpenses ? ` · ${r.expenses} expenses` : ""}`
      );
      onClose();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : ar ? "تعذّر الحذف" : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-extrabold text-red-700">
          {project
            ? ar
              ? `مسح سجلات «${project.name}»`
              : `Clear records of “${project.name}”`
            : ar
              ? "مسح كل السجلات لكل المشاريع"
              : "Clear all records for all projects"}
        </h3>
        <div className="text-sm text-ink-soft space-y-1">
          <p>
            {ar
              ? "سيُحذف نهائياً: كل سجلات الحضور والساعات، وكل الدفعات الأسبوعية (المدفوعة وغير المدفوعة)."
              : "Permanently deletes all attendance/hours rows and all weekly payouts (paid and unpaid)."}
          </p>
          <p>
            {ar
              ? "يبقى: المشاريع، العمال وأجورهم، المهندسون، وتعيين العمال على المشاريع. ملف Excel الحالي يُنقل لأرشيف على السيرفر ويبدأ ملف جديد فارغ."
              : "Kept: projects, workers and their rates, engineers and assignments. The current Excel file moves to an archive folder on the server and a fresh one starts."}
          </p>
          <p className="text-[11px]">
            {ar
              ? "تنبيه: زر «إعادة استيراد Excel» يعيد السجلات القديمة من ملفات المصدر، فلا تضغطه بعد المسح."
              : "Note: “Re-import Excel” brings old records back from the source files; don't use it after clearing."}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={includeExpenses} onChange={(e) => setIncludeExpenses(e.target.checked)} />
          {ar ? "احذف أيضاً مصاريف المشاريع وإيصالاتها" : "Also delete project expenses and receipts"}
        </label>
        <div>
          <label className="text-xs font-bold text-ink-soft mb-1 block">
            {ar ? "اكتب «حذف» للتأكيد" : "Type «حذف» to confirm"}
          </label>
          <input
            className="w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-red-500"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || word.trim() !== "حذف"}
            onClick={run}
            className="flex-1 h-11 rounded-xl bg-red-700 text-white text-sm font-bold disabled:opacity-40"
          >
            {busy ? "…" : ar ? "حذف السجلات" : "Delete records"}
          </button>
          <button type="button" onClick={onClose} className="h-11 px-4 rounded-xl border border-line text-sm font-bold">
            {ar ? "إلغاء" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

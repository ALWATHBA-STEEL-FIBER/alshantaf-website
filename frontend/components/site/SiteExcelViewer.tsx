"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import type { SiteExcelPreview } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  loadPreview: (sheetIndex?: number) => Promise<SiteExcelPreview>;
  onDownload?: () => Promise<void>;
  lang?: "ar" | "en";
};

export function SiteExcelViewer({
  open,
  onClose,
  title,
  loadPreview,
  onDownload,
  lang = "ar",
}: Props) {
  const [data, setData] = useState<SiteExcelPreview | null>(null);
  const [sheetIndex, setSheetIndex] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(
    async (idx?: number) => {
      setLoading(true);
      setError("");
      try {
        const preview = await loadPreview(idx);
        setData(preview);
        setSheetIndex(preview.activeSheetIndex);
      } catch (err) {
        setData(null);
        setError(err instanceof ApiError ? err.message : lang === "ar" ? "تعذّر فتح Excel" : "Failed to open Excel");
      } finally {
        setLoading(false);
      }
    },
    [loadPreview, lang]
  );

  useEffect(() => {
    if (!open) return;
    void refresh(undefined);
  }, [open, refresh]);

  if (!open) return null;

  const sheet = data?.sheet;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white border border-[#e4ddd0] shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[#e4ddd0]">
          <div className="min-w-0">
            <div className="font-extrabold text-[#0f342f] truncate">
              {title || data?.project.name || "Excel"}
            </div>
            <div className="text-[11px] text-[#5a6b66] truncate">
              {data?.filename || "…"}
              {data ? ` · ${data.sheetCount} ${lang === "ar" ? "ورقة" : "sheets"}` : ""}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {onDownload ? (
              <button
                type="button"
                disabled={busy}
                className="h-9 px-3 rounded-xl bg-[#0f342f] text-white text-xs font-bold disabled:opacity-50"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onDownload();
                  } catch (err) {
                    setError(
                      err instanceof ApiError
                        ? err.message
                        : lang === "ar"
                          ? "تعذّر التحميل"
                          : "Download failed"
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {lang === "ar" ? "تحميل" : "Download"}
              </button>
            ) : null}
            <button
              type="button"
              className="h-9 px-3 rounded-xl border border-[#e4ddd0] text-xs font-bold"
              onClick={onClose}
            >
              {lang === "ar" ? "إغلاق" : "Close"}
            </button>
          </div>
        </div>

        <div className="px-4 py-2 border-b border-[#e4ddd0] flex flex-wrap gap-2 items-center">
          <label className="text-xs font-bold text-[#5a6b66]">
            {lang === "ar" ? "الورقة" : "Sheet"}
          </label>
          <select
            className="h-9 min-w-[220px] max-w-full rounded-xl border border-[#e4ddd0] bg-[#f3f1eb] px-2 text-xs font-bold"
            value={sheetIndex ?? 0}
            disabled={loading || !data?.sheets.length}
            onChange={(e) => {
              const idx = Number(e.target.value);
              setSheetIndex(idx);
              void refresh(idx);
            }}
          >
            {(data?.sheets || []).map((s) => (
              <option key={s.index} value={s.index}>
                {s.name}
                {s.weekNumber != null ? ` (#${s.weekNumber})` : ""}
              </option>
            ))}
          </select>
          {sheet?.weekStart ? (
            <span className="text-[11px] text-[#5a6b66] font-medium">
              {sheet.weekStart}
              {sheet.settlementDate ? ` · ${lang === "ar" ? "تسوية" : "settle"} ${sheet.settlementDate}` : ""}
            </span>
          ) : null}
        </div>

        <div className="flex-1 overflow-auto p-3">
          {loading ? (
            <div className="text-sm text-[#5a6b66] p-4">
              {lang === "ar" ? "جاري قراءة الملف على السيرفر…" : "Reading file on server…"}
            </div>
          ) : error ? (
            <div className="text-sm text-red-700 font-bold p-4">{error}</div>
          ) : !sheet || sheet.workers.length === 0 ? (
            <div className="text-sm text-[#5a6b66] p-4">
              {lang === "ar" ? "لا توجد بيانات عمال في هذه الورقة." : "No worker data on this sheet."}
            </div>
          ) : (
            <div className="overflow-auto rounded-xl border border-[#e4ddd0]">
              <table className="min-w-full text-[11px]">
                <thead>
                  <tr className="bg-[#f3f1eb] border-b border-[#e4ddd0]">
                    <th className="text-start p-2 font-bold sticky start-0 bg-[#f3f1eb]">
                      {lang === "ar" ? "العامل" : "Worker"}
                    </th>
                    <th className="p-2 font-bold">{lang === "ar" ? "الوظيفة" : "Job"}</th>
                    {(sheet.workers[0]?.days || []).map((d) => (
                      <th key={d.date} className="p-2 font-bold whitespace-nowrap">
                        {d.dayLabel}
                        <div className="font-medium text-[#5a6b66]">{d.date.slice(5)}</div>
                      </th>
                    ))}
                    <th className="p-2 font-bold">{lang === "ar" ? "ساعات" : "Hrs"}</th>
                    <th className="p-2 font-bold">{lang === "ar" ? "إضافي" : "OT"}</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.workers.map((w) => (
                    <tr key={`${w.name}-${w.jobTitle}`} className="border-b border-[#eee8dc] align-top">
                      <td className="p-2 font-bold sticky start-0 bg-white whitespace-nowrap">
                        {w.name}
                        {w.fullName ? (
                          <div className="text-[10px] font-medium text-[#5a6b66]">{w.fullName}</div>
                        ) : null}
                      </td>
                      <td className="p-2 text-[#5a6b66] whitespace-nowrap">{w.jobTitle || "—"}</td>
                      {w.days.map((d) => (
                        <td key={d.date} className="p-2 text-center whitespace-nowrap">
                          <div className="font-bold">{d.regularHours || "—"}</div>
                          {d.extraHours ? (
                            <div className="text-[10px] text-[#b7791f]">+{d.extraHours}</div>
                          ) : null}
                        </td>
                      ))}
                      <td className="p-2 text-center font-bold">{w.totalRegular}</td>
                      <td className="p-2 text-center font-bold">{w.totalExtra}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

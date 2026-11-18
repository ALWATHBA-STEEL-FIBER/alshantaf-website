"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { SiteDayPayload } from "@/lib/types";
import { SiteAuthGateWithName } from "@/components/site/SiteAuthGate";
import { SiteShell } from "@/components/site/SiteShell";
import { SiteExcelViewer } from "@/components/site/SiteExcelViewer";
import {
  AR_MONTHS,
  AR_WEEKDAY_SHORT,
  addDaysISO,
  monthMatrix,
  saturdayOf,
  todayLocalISO,
} from "@/lib/siteDates";

type RowDraft = {
  workerId: string;
  name: string;
  employeeCode: string | null;
  jobTitle?: string | null;
  regularHours: string;
  extraHours: string;
  notes: string;
};

function ProjectDayPage({ engineerName }: { engineerName: string }) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = String(params.id || "");
  const initialDate = searchParams.get("date") || todayLocalISO();

  const [date, setDate] = useState(initialDate);
  const [payload, setPayload] = useState<SiteDayPayload | null>(null);
  const [rows, setRows] = useState<RowDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [showCal, setShowCal] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");

  const calCursor = useMemo(() => {
    const [y, m] = date.split("-").map(Number);
    return { year: y!, month: m! - 1 };
  }, [date]);
  const [viewYear, setViewYear] = useState(calCursor.year);
  const [viewMonth, setViewMonth] = useState(calCursor.month);

  useEffect(() => {
    setViewYear(calCursor.year);
    setViewMonth(calCursor.month);
  }, [calCursor.year, calCursor.month]);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError("");
    setSavedMsg("");
    try {
      const data = await api.siteProjectDay(projectId, d);
      setPayload(data);
      setRows(
        data.workers.map((w) => ({
          workerId: w.workerId,
          name: w.name,
          employeeCode: w.employeeCode,
          jobTitle: w.jobTitle,
          regularHours: w.record?.regularHours ?? "0",
          extraHours: w.record?.extraHours ?? "0",
          notes: w.record?.notes ?? "",
        }))
      );
      setAddQuery("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر التحميل");
      setPayload(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) load(date);
  }, [projectId, date, load]);

  function selectDate(next: string) {
    setDate(next);
    setShowCal(false);
    router.replace(`/site/projects/${projectId}?date=${next}`);
  }

  async function save() {
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      await api.siteSaveDay(projectId, {
        date,
        rows: rows.map((r) => ({
          workerId: r.workerId,
          regularHours: Number(r.regularHours) || 0,
          extraHours: Number(r.extraHours) || 0,
          notes: r.notes.trim() || null,
        })),
      });
      setSavedMsg("تم الحفظ");
      await load(date);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  const matrix = monthMatrix(viewYear, viewMonth);
  const weekStart = saturdayOf(date);
  const roster = payload?.roster || [];
  const addMatches = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    const present = new Set(rows.map((r) => r.workerId));
    return roster
      .filter((w) => !present.has(w.workerId))
      .filter(
        (w) =>
          !q ||
          w.name.toLowerCase().includes(q) ||
          (w.employeeCode || "").toLowerCase().includes(q) ||
          (w.jobTitle || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [addQuery, roster, rows]);

  return (
    <SiteShell
      title={payload?.project.name || "المشروع"}
      subtitle={`${engineerName} · ${payload?.dayName || ""} ${date}`}
      backHref="/site"
      showLogout
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => selectDate(addDaysISO(date, -1))}
          className="h-10 px-3 rounded-xl bg-white border border-[#e4ddd0] text-sm font-bold"
        >
          اليوم السابق
        </button>
        <button
          type="button"
          onClick={() => setShowCal((v) => !v)}
          className="h-10 px-3 rounded-xl bg-[#0f342f] text-white text-sm font-bold"
        >
          التقويم
        </button>
        <button
          type="button"
          onClick={() => selectDate(addDaysISO(date, 1))}
          className="h-10 px-3 rounded-xl bg-white border border-[#e4ddd0] text-sm font-bold"
        >
          اليوم التالي
        </button>
        <Link
          href={`/site/projects/${projectId}/week?weekStart=${weekStart}`}
          className="h-10 px-3 rounded-xl bg-[#d4a84b] text-[#0f342f] text-sm font-bold inline-flex items-center"
        >
          الجدول الأسبوعي
        </Link>
        <button
          type="button"
          onClick={() => setExcelOpen(true)}
          className="h-10 px-3 rounded-xl bg-white border border-[#e4ddd0] text-sm font-bold"
        >
          عرض Excel
        </button>
        <Link
          href={`/site/expenses?projectId=${projectId}&month=all`}
          className="h-10 px-3 rounded-xl bg-white border border-[#e4ddd0] text-sm font-bold inline-flex items-center"
        >
          مصاريف المشروع
        </Link>
        <Link
          href={`/site/expenses/new?scope=PROJECT&projectId=${projectId}&back=${encodeURIComponent(`/site/projects/${projectId}?date=${date}`)}`}
          className="h-10 px-3 rounded-xl bg-[#0f342f]/10 text-[#0f342f] text-sm font-bold inline-flex items-center"
        >
          + مصروف
        </Link>
      </div>

      <SiteExcelViewer
        open={excelOpen}
        onClose={() => setExcelOpen(false)}
        title={payload?.project.name}
        lang="ar"
        loadPreview={(sheet) => api.siteProjectExcelPreview(projectId, sheet)}
        onDownload={async () => {
          const blob = await api.downloadSiteProjectExcelPortal(projectId);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `عمال مشروع ${payload?.project.name || projectId}.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      />

      {showCal && (
        <div className="mb-4 rounded-2xl bg-white border border-[#e4ddd0] p-3">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              className="h-9 w-9 rounded-full bg-[#f3f1eb] font-bold"
              onClick={() => {
                const m = viewMonth - 1;
                if (m < 0) {
                  setViewMonth(11);
                  setViewYear((y) => y - 1);
                } else setViewMonth(m);
              }}
            >
              →
            </button>
            <div className="font-bold text-[#0f342f]">
              {AR_MONTHS[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              className="h-9 w-9 rounded-full bg-[#f3f1eb] font-bold"
              onClick={() => {
                const m = viewMonth + 1;
                if (m > 11) {
                  setViewMonth(0);
                  setViewYear((y) => y + 1);
                } else setViewMonth(m);
              }}
            >
              ←
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[#5a6b66] mb-1">
            {AR_WEEKDAY_SHORT.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {matrix.flat().map((cell, i) =>
              cell ? (
                <button
                  key={cell}
                  type="button"
                  onClick={() => selectDate(cell)}
                  className={`h-10 rounded-xl text-sm font-bold ${
                    cell === date
                      ? "bg-[#0f342f] text-white"
                      : cell === todayLocalISO()
                        ? "bg-[#d4a84b]/30 text-[#0f342f]"
                        : "bg-[#f3f1eb] text-[#0f342f]"
                  }`}
                >
                  {Number(cell.slice(8))}
                </button>
              ) : (
                <div key={`e-${i}`} />
              )
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-[#5a6b66]">جاري التحميل…</div>
      ) : error && !payload ? (
        <div className="text-sm text-red-700 font-bold">{error}</div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <input
              className="w-full h-11 rounded-xl border border-[#d9d2c4] bg-white px-3 text-sm"
              placeholder="بحث لإضافة عامل لهذا اليوم…"
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
            />
            {addQuery.trim() && addMatches.length > 0 ? (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-[#e4ddd0] bg-white shadow-lg overflow-hidden">
                {addMatches.map((w) => (
                  <button
                    key={w.workerId}
                    type="button"
                    className="w-full text-start px-3 py-2.5 text-sm border-b border-[#eee8dc] last:border-0 hover:bg-[#f3f1eb]"
                    onClick={() => {
                      setRows((prev) => [
                        ...prev,
                        {
                          workerId: w.workerId,
                          name: w.name,
                          employeeCode: w.employeeCode,
                          jobTitle: w.jobTitle,
                          regularHours: "8",
                          extraHours: "0",
                          notes: "",
                        },
                      ]);
                      setAddQuery("");
                    }}
                  >
                    <span className="font-bold text-[#0f342f]">{w.name}</span>
                    {w.jobTitle ? <span className="text-[#5a6b66] text-xs ms-2">{w.jobTitle}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <p className="text-[11px] text-[#5a6b66]">
            يظهر فقط من سجّلت حضورهم اليوم
            {roster.length ? ` · ${rows.length}/${roster.length}` : ""}
          </p>

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d9d2c4] bg-white/60 p-6 text-sm text-[#5a6b66]">
              لا حضور لهذا اليوم — ابحث بالاسم لإضافة عامل.
            </div>
          ) : (
            rows.map((row, idx) => (
              <div key={row.workerId} className="rounded-2xl bg-white border border-[#e4ddd0] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-[#0f342f] min-w-0">
                    {row.name}
                    {row.employeeCode ? (
                      <span className="text-[#5a6b66] font-medium ms-2">#{row.employeeCode}</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="text-[11px] font-bold text-red-700 shrink-0"
                    onClick={() => setRows((prev) => prev.filter((r) => r.workerId !== row.workerId))}
                  >
                    إزالة
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#5a6b66] mb-1 block">ساعات العمل</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="0"
                      max="24"
                      className="w-full h-11 rounded-xl border border-[#d9d2c4] bg-[#f7f4ee] px-3 text-sm"
                      value={row.regularHours}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, regularHours: v } : r)));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#5a6b66] mb-1 block">ساعات إضافية</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="0"
                      max="24"
                      className="w-full h-11 rounded-xl border border-[#d9d2c4] bg-[#f7f4ee] px-3 text-sm"
                      value={row.extraHours}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, extraHours: v } : r)));
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#5a6b66] mb-1 block">ملاحظات</label>
                  <input
                    className="w-full h-11 rounded-xl border border-[#d9d2c4] bg-[#f7f4ee] px-3 text-sm"
                    value={row.notes}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, notes: v } : r)));
                    }}
                  />
                </div>
              </div>
            ))
          )}

          {error ? <p className="text-sm text-red-700 font-bold">{error}</p> : null}
          {savedMsg ? <p className="text-sm text-[#0f342f] font-bold">{savedMsg}</p> : null}

          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="w-full h-12 rounded-2xl bg-[#0f342f] text-white font-bold text-sm disabled:opacity-60 sticky bottom-3"
          >
            {saving ? "جاري الحفظ…" : "حفظ يوم " + date}
          </button>
        </div>
      )}
    </SiteShell>
  );
}

export default function SiteProjectDayRoute() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-[#5a6b66]">
          جاري التحميل…
        </div>
      }
    >
      <SiteAuthGateWithName>{({ name }) => <ProjectDayPage engineerName={name} />}</SiteAuthGateWithName>
    </Suspense>
  );
}

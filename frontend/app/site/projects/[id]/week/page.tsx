"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { SiteWeekSheet } from "@/lib/types";
import { SiteAuthGateWithName } from "@/components/site/SiteAuthGate";
import { SiteShell } from "@/components/site/SiteShell";
import { SiteExcelViewer } from "@/components/site/SiteExcelViewer";
import { addDaysISO, saturdayOf, todayLocalISO } from "@/lib/siteDates";

function WeekSheet({ engineerName }: { engineerName: string }) {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = String(params.id || "");
  const initial = saturdayOf(searchParams.get("weekStart") || todayLocalISO());
  const [weekStart, setWeekStart] = useState(initial);
  const [sheet, setSheet] = useState<SiteWeekSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [excelOpen, setExcelOpen] = useState(false);
  const [q, setQ] = useState("");

  const workers = useMemo(() => {
    const list = sheet?.workers || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (w) =>
        w.name.toLowerCase().includes(needle) ||
        (w.employeeCode || "").toLowerCase().includes(needle)
    );
  }, [sheet, q]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    api
      .siteProjectWeek(projectId, weekStart)
      .then((data) => {
        if (!ignore) setSheet(data);
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof ApiError ? err.message : "تعذّر التحميل");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [projectId, weekStart]);

  return (
    <SiteShell
      title={sheet?.project.name || "الجدول الأسبوعي"}
          subtitle={`${engineerName} · ${weekStart} → ${addDaysISO(weekStart, 5)}`}
      backHref={`/site/projects/${projectId}?date=${weekStart}`}
      showLogout
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          className="h-10 px-3 rounded-xl bg-white border border-[#e4ddd0] text-sm font-bold"
          onClick={() => setWeekStart(addDaysISO(weekStart, -7))}
        >
          الأسبوع السابق
        </button>
        <button
          type="button"
          className="h-10 px-3 rounded-xl bg-white border border-[#e4ddd0] text-sm font-bold"
          onClick={() => setWeekStart(addDaysISO(weekStart, 7))}
        >
          الأسبوع التالي
        </button>
        <button
          type="button"
          className="h-10 px-3 rounded-xl bg-[#0f342f] text-white text-sm font-bold"
          onClick={() => setExcelOpen(true)}
        >
          عرض Excel
        </button>
      </div>

      <SiteExcelViewer
        open={excelOpen}
        onClose={() => setExcelOpen(false)}
        title={sheet?.project.name}
        lang="ar"
        loadPreview={(sheetIdx) => api.siteProjectExcelPreview(projectId, sheetIdx)}
        onDownload={async () => {
          const blob = await api.downloadSiteProjectExcelPortal(projectId);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `عمال مشروع ${sheet?.project.name || projectId}.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      />

      {loading ? (
        <div className="text-sm text-[#5a6b66]">جاري التحميل…</div>
      ) : error ? (
        <div className="text-sm text-red-700 font-bold">{error}</div>
      ) : !sheet || sheet.workers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d9d2c4] bg-white/60 p-6 text-sm text-[#5a6b66]">
          لا حضور مسجّل لهذا الأسبوع.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="flex-1 min-w-[180px] h-10 rounded-xl border border-[#e4ddd0] bg-white px-3 text-sm"
              placeholder="بحث عامل…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <span className="text-[11px] text-[#5a6b66] font-bold">
              {workers.length}
              {sheet.rosterCount != null ? ` / ${sheet.rosterCount}` : ""} عامل بحضور
            </span>
          </div>
          <div className="overflow-x-auto rounded-2xl bg-white border border-[#e4ddd0]">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#e4ddd0] bg-[#f3f1eb]">
                  <th className="text-start p-3 font-bold sticky start-0 bg-[#f3f1eb]">العامل</th>
                  {sheet.days.map((d) => (
                    <th key={d.date} className="p-2 font-bold whitespace-nowrap">
                      <Link href={`/site/projects/${projectId}?date=${d.date}`} className="hover:underline">
                        <div>{d.dayName}</div>
                        <div className="text-[#5a6b66] font-medium">{d.date.slice(5)}</div>
                      </Link>
                    </th>
                  ))}
                  <th className="p-2 font-bold">ساعات</th>
                  <th className="p-2 font-bold text-[#b8860b]">إضافي</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.workerId} className="border-b border-[#e4ddd0]">
                    <td className="p-3 font-bold sticky start-0 bg-white whitespace-nowrap">{w.name}</td>
                    {w.days.map((day) => (
                      <td key={day.date} className="p-2 text-center">
                        {day.regularHours != null ? (
                          <>
                            <div>{day.regularHours}</div>
                            {Number(day.extraHours) > 0 ? (
                              <div className="text-[#b8860b]">+{day.extraHours}</div>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-[#a8a094]">—</span>
                        )}
                      </td>
                    ))}
                    <td className="p-2 text-center font-bold">{w.totalRegular}</td>
                    <td className="p-2 text-center font-bold text-[#b8860b]">{w.totalExtra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SiteShell>
  );
}

export default function SiteWeekPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-[#5a6b66]">
          جاري التحميل…
        </div>
      }
    >
      <SiteAuthGateWithName>{({ name }) => <WeekSheet engineerName={name} />}</SiteAuthGateWithName>
    </Suspense>
  );
}

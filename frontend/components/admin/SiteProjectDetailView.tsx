"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import type { SiteProjectDetail } from "@/lib/types";
import { useToast } from "./Toast";
import { EmptyState, Spinner, SkeletonBlock } from "./EmptyState";
import { SiteExcelViewer } from "@/components/site/SiteExcelViewer";
import { ProjectCostBoard } from "@/components/site/ProjectCostBoard";

const inputClass =
  "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";
const labelClass = "text-xs font-bold text-ink-soft mb-1 block";

function money(v: string | number | null | undefined) {
  const n = Number(v || 0);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 3 })
    : "0";
}

export function SiteProjectDetailView({ projectId }: { projectId: string }) {
  const { t, lang } = useLanguage();
  const { showSuccess, showError } = useToast();
  const [data, setData] = useState<SiteProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const [tab, setTab] = useState<"cost" | "setup" | "roster" | "activity">("cost");
  const [meta, setMeta] = useState({ name: "", code: "", notes: "", active: true, budget: "" });
  const [existingId, setExistingId] = useState("");
  const [newWorker, setNewWorker] = useState({
    name: "",
    employeeCode: "",
    dailyPay: "",
    extraHourPay: "",
    jobTitle: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await api.siteProject(projectId);
      setData(p);
      setMeta({
        name: p.name,
        code: p.code || "",
        notes: p.notes || "",
        active: p.active,
        budget: p.budget != null ? String(p.budget) : "",
      });
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, showError, t.admin.saveFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.updateSiteProject(projectId, {
        name: meta.name.trim(),
        code: meta.code.trim() || null,
        notes: meta.notes.trim() || null,
        active: meta.active,
        budget: meta.budget.trim() === "" ? null : Number(meta.budget),
      });
      showSuccess(lang === "ar" ? "تم حفظ المشروع" : "Project saved");
      await load();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function addExisting(e: React.FormEvent) {
    e.preventDefault();
    if (!existingId) return;
    setBusy(true);
    try {
      await api.assignSiteProjectWorker(projectId, { workerId: existingId });
      showSuccess(lang === "ar" ? "تمت إضافة العامل" : "Worker added");
      setExistingId("");
      await load();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function createAndAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.assignSiteProjectWorker(projectId, {
        name: newWorker.name.trim(),
        employeeCode: newWorker.employeeCode.trim() || null,
        dailyPay: Number(newWorker.dailyPay) || 0,
        extraHourPay: Number(newWorker.extraHourPay) || 0,
        jobTitle: newWorker.jobTitle.trim() || null,
      });
      showSuccess(lang === "ar" ? "تم إنشاء العامل وإضافته" : "Worker created & assigned");
      setNewWorker({ name: "", employeeCode: "", dailyPay: "", extraHourPay: "", jobTitle: "" });
      await load();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function removeWorker(workerId: string) {
    setBusy(true);
    try {
      await api.unassignSiteProjectWorker(projectId, workerId);
      showSuccess(lang === "ar" ? "تمت إزالة العامل" : "Worker removed");
      await load();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl">
        <SkeletonBlock className="h-10 w-64" />
        <SkeletonBlock className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return <EmptyState title={lang === "ar" ? "المشروع غير موجود" : "Project not found"} />;
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/site-work" className="text-xs font-bold text-green">
            ← {lang === "ar" ? "حضور الموقع" : "Site work"}
          </Link>
          <h1 className="text-2xl font-extrabold text-green mt-1" style={{ fontFamily: "var(--font-brand), sans-serif" }}>
            {data.name}
          </h1>
          <p className="text-sm text-ink-soft mt-1">
            {data.code ? `${data.code} · ` : ""}
            {data.roster.length} {lang === "ar" ? "عامل" : "workers"} · {data.recordCount}{" "}
            {lang === "ar" ? "سجل" : "records"} · {lang === "ar" ? "أسبوع" : "week"} #
            {data.weekCounter || 0}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/site-work/expenses?projectId=${projectId}`}
            className="h-10 px-3 rounded-xl border border-line text-xs font-bold inline-flex items-center"
          >
            {lang === "ar" ? "مصاريف المشروع" : "Project expenses"}
          </Link>
          <Link
            href="/admin/site-work"
            className="h-10 px-3 rounded-xl border border-line text-xs font-bold inline-flex items-center"
          >
            {lang === "ar" ? "اليوم والتقويم" : "Day & calendar"}
          </Link>
          <button
            type="button"
            className="h-10 px-3 rounded-xl bg-ink text-white text-xs font-bold"
            onClick={() => setExcelOpen(true)}
          >
            {lang === "ar" ? "عرض Excel" : "View Excel"}
          </button>
          <button
            type="button"
            className="h-10 px-3 rounded-xl bg-green text-white text-xs font-bold"
            onClick={async () => {
              try {
                const blob = await api.downloadSiteProjectExcel(projectId);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = data.excelFilename || `عمال مشروع ${data.name}.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (err) {
                showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
              }
            }}
          >
            {lang === "ar" ? "تحميل" : "Download"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-line pb-1">
        {(
          [
            { id: "cost" as const, ar: "التكاليف والمؤشرات", en: "Costs & KPIs" },
            { id: "setup" as const, ar: "إعداد المشروع", en: "Project setup" },
            { id: "roster" as const, ar: "العمال", en: "Roster" },
            { id: "activity" as const, ar: "الحضور والدفعات", en: "Attendance & payouts" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`h-9 px-3 rounded-xl text-xs font-bold ${
              tab === t.id ? "bg-green text-white" : "text-ink-soft hover:bg-surface-2"
            }`}
          >
            {lang === "ar" ? t.ar : t.en}
          </button>
        ))}
      </div>

      {tab === "cost" && data.costSummary ? (
        <ProjectCostBoard cost={data.costSummary} lang={lang} adminLinks projectId={projectId} />
      ) : null}
      {tab === "cost" && !data.costSummary ? (
        <EmptyState title={lang === "ar" ? "لا ملخص تكاليف" : "No cost summary"} />
      ) : null}

      {tab === "setup" ? (
      <div className="grid lg:grid-cols-2 gap-4">
        <form onSubmit={saveMeta} className="bg-white rounded-2xl border border-line p-4 space-y-3">
          <h2 className="font-bold text-green">{lang === "ar" ? "تفاصيل المشروع" : "Project details"}</h2>
          <div>
            <label className={labelClass}>{t.admin.siteWorkName}</label>
            <input
              className={inputClass}
              required
              value={meta.name}
              onChange={(e) => setMeta((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>{t.admin.siteWorkCode}</label>
            <input
              className={inputClass}
              value={meta.code}
              onChange={(e) => setMeta((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>{lang === "ar" ? "الموازنة (د.أ)" : "Budget (JOD)"}</label>
            <input
              className={inputClass}
              type="number"
              min="0"
              step="0.001"
              value={meta.budget}
              onChange={(e) => setMeta((f) => ({ ...f, budget: e.target.value }))}
              placeholder="—"
            />
          </div>
          <div>
            <label className={labelClass}>{t.admin.siteWorkNotes}</label>
            <textarea
              className={`${inputClass} h-20 py-2`}
              value={meta.notes}
              onChange={(e) => setMeta((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              className="accent-green"
              checked={meta.active}
              onChange={(e) => setMeta((f) => ({ ...f, active: e.target.checked }))}
            />
            {t.admin.siteWorkActive}
          </label>
          <div className="text-xs text-ink-soft">
            {lang === "ar" ? "المهندسون" : "Engineers"}:{" "}
            {data.engineers.map((e) => e.name).join(" · ") || "—"}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="h-11 px-4 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-50"
          >
            {busy ? <Spinner className="w-4 h-4" /> : t.admin.siteWorkSave}
          </button>
        </form>

        <div className="space-y-4">
          <form onSubmit={addExisting} className="bg-white rounded-2xl border border-line p-4 space-y-3">
            <h2 className="font-bold text-green">
              {lang === "ar" ? "إضافة عامل موجود" : "Add existing worker"}
            </h2>
            <select
              className={inputClass}
              value={existingId}
              onChange={(e) => setExistingId(e.target.value)}
              required
            >
              <option value="">{lang === "ar" ? "اختر عاملاً…" : "Select worker…"}</option>
              {data.availableWorkers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.employeeCode ? ` #${w.employeeCode}` : ""}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy || !existingId}
              className="h-11 px-4 rounded-xl bg-ink text-white text-sm font-bold disabled:opacity-40"
            >
              {lang === "ar" ? "إضافة للمشروع" : "Add to project"}
            </button>
          </form>

          <form onSubmit={createAndAdd} className="bg-white rounded-2xl border border-line p-4 space-y-3">
            <h2 className="font-bold text-green">
              {lang === "ar" ? "عامل جديد لهذا المشروع" : "New worker for this project"}
            </h2>
            <div>
              <label className={labelClass}>{t.admin.siteWorkName}</label>
              <input
                className={inputClass}
                required
                value={newWorker.name}
                onChange={(e) => setNewWorker((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>{t.admin.siteWorkDailyPay}</label>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.001"
                  required
                  value={newWorker.dailyPay}
                  onChange={(e) => setNewWorker((f) => ({ ...f, dailyPay: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>{t.admin.siteWorkExtraHourPay}</label>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.001"
                  required
                  value={newWorker.extraHourPay}
                  onChange={(e) => setNewWorker((f) => ({ ...f, extraHourPay: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>{t.admin.siteWorkEmployeeCode}</label>
                <input
                  className={inputClass}
                  value={newWorker.employeeCode}
                  onChange={(e) => setNewWorker((f) => ({ ...f, employeeCode: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>{lang === "ar" ? "الوظيفة" : "Job title"}</label>
                <input
                  className={inputClass}
                  value={newWorker.jobTitle}
                  onChange={(e) => setNewWorker((f) => ({ ...f, jobTitle: e.target.value }))}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="h-11 px-4 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-50"
            >
              {lang === "ar" ? "إنشاء وإضافة" : "Create & add"}
            </button>
          </form>
        </div>
      </div>
      ) : null}

      {tab === "roster" ? (
      <div className="bg-white rounded-2xl border border-line p-4">
        <h2 className="font-bold text-green mb-3">
          {lang === "ar" ? "قائمة العمال" : "Worker roster"} ({data.roster.length})
        </h2>
        {data.roster.length === 0 ? (
          <EmptyState title={lang === "ar" ? "لا عمال على المشروع" : "No workers on project"} />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-xs text-ink-soft border-b border-line">
                  <th className="text-start py-2 pe-2">{t.admin.siteWorkWorker}</th>
                  <th className="text-start py-2 px-2">{lang === "ar" ? "الوظيفة" : "Job"}</th>
                  <th className="py-2 px-2">{t.admin.siteWorkDailyPay}</th>
                  <th className="py-2 px-2">{lang === "ar" ? "سجلات" : "Records"}</th>
                  <th className="py-2 px-2">{t.admin.siteWorkHours}</th>
                  <th className="py-2 ps-2" />
                </tr>
              </thead>
              <tbody>
                {data.roster.map((w) => (
                  <tr key={w.workerId} className="border-b border-line/60">
                    <td className="py-2.5 pe-2">
                      <Link
                        href={`/admin/site-work/workers/${w.workerId}`}
                        className="font-bold text-green"
                      >
                        {w.name}
                      </Link>
                      {w.employeeCode ? (
                        <span className="text-ink-soft text-xs ms-1">#{w.employeeCode}</span>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-2 text-ink-soft">{w.jobTitle || "—"}</td>
                    <td className="py-2.5 px-2 text-center">
                      {money(w.dailyPay)}
                      <span className="text-ink-soft"> / </span>
                      {money(w.extraHourPay)}
                    </td>
                    <td className="py-2.5 px-2 text-center">{w.recordCount}</td>
                    <td className="py-2.5 px-2 text-center">
                      {money(w.totalRegular)}
                      <span className="text-ink-soft"> / </span>
                      {money(w.totalExtra)}
                    </td>
                    <td className="py-2.5 ps-2 text-end">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeWorker(w.workerId)}
                        className="text-[11px] font-bold text-red-700"
                      >
                        {lang === "ar" ? "إزالة" : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      ) : null}

      {tab === "activity" ? (
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-line p-4">
          <h2 className="font-bold text-green mb-3">
            {lang === "ar" ? "آخر الحضور" : "Recent attendance"}
          </h2>
          <div className="space-y-2 max-h-[40vh] overflow-auto">
            {data.recentDays.length === 0 ? (
              <EmptyState title={t.admin.siteWorkEmpty} />
            ) : (
              data.recentDays.map((d) => (
                <div key={d.id} className="flex justify-between gap-2 text-sm border-b border-line/50 pb-2">
                  <div>
                    <Link
                      href={`/admin/site-work/workers/${d.workerId}`}
                      className="font-bold text-green"
                    >
                      {d.worker.name}
                    </Link>
                    <div className="text-[11px] text-ink-soft">
                      {d.dayName} {d.workDate}
                    </div>
                  </div>
                  <div className="text-xs font-bold whitespace-nowrap">
                    {money(d.regularHours)} / +{money(d.extraHours)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-line p-4">
          <h2 className="font-bold text-green mb-3">{t.admin.siteWorkWeekPay}</h2>
          <div className="space-y-2 max-h-[40vh] overflow-auto">
            {data.payouts.length === 0 ? (
              <EmptyState title={lang === "ar" ? "لا دفعات مسجّلة بعد" : "No payouts marked yet"} />
            ) : (
              data.payouts.map((p) => (
                <div key={p.id} className="flex justify-between gap-2 text-sm border-b border-line/50 pb-2">
                  <div>
                    <Link
                      href={`/admin/site-work/workers/${p.workerId}`}
                      className="font-bold text-green"
                    >
                      {p.workerName}
                    </Link>
                    <div className="text-[11px] text-ink-soft">
                      {p.weekStart} · {p.daysWorked} {lang === "ar" ? "يوم" : "days"}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="font-bold">{money(p.amount)}</div>
                    <div className={`text-[10px] font-bold ${p.paid ? "text-green" : "text-ink-soft"}`}>
                      {p.paid ? t.admin.siteWorkPaid : t.admin.siteWorkUnpaid}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      ) : null}

      <SiteExcelViewer
        open={excelOpen}
        onClose={() => setExcelOpen(false)}
        title={data.name}
        lang={lang === "ar" ? "ar" : "en"}
        loadPreview={(sheet) => api.siteProjectExcelPreviewAdmin(projectId, sheet)}
        onDownload={async () => {
          const blob = await api.downloadSiteProjectExcel(projectId);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = data.excelFilename || `عمال مشروع ${data.name}.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      />
    </div>
  );
}

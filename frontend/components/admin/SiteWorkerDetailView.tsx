"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import type { SiteProject, SiteWorkerDetail } from "@/lib/types";
import { useToast } from "./Toast";
import { EmptyState, Spinner, SkeletonBlock } from "./EmptyState";

const inputClass =
  "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";
const labelClass = "text-xs font-bold text-ink-soft mb-1 block";

function money(v: string | number | null | undefined) {
  const n = Number(v || 0);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 3 })
    : "0";
}

export function SiteWorkerDetailView({ workerId }: { workerId: string }) {
  const { t, lang } = useLanguage();
  const { showSuccess, showError } = useToast();
  const [data, setData] = useState<SiteWorkerDetail | null>(null);
  const [projects, setProjects] = useState<SiteProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    employeeCode: "",
    notes: "",
    dailyPay: "",
    extraHourPay: "",
    active: true,
  });
  const [assignProjectId, setAssignProjectId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, p] = await Promise.all([api.siteWorker(workerId), api.siteProjects()]);
      setData(w);
      setProjects(p);
      setForm({
        name: w.name,
        employeeCode: w.employeeCode || "",
        notes: w.notes || "",
        dailyPay: String(Number(w.dailyPay) || 0),
        extraHourPay: String(Number(w.extraHourPay) || 0),
        active: w.active,
      });
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [workerId, showError, t.admin.saveFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.updateSiteWorker(workerId, {
        name: form.name.trim(),
        employeeCode: form.employeeCode.trim() || null,
        notes: form.notes.trim() || null,
        dailyPay: Number(form.dailyPay) || 0,
        extraHourPay: Number(form.extraHourPay) || 0,
        active: form.active,
      });
      showSuccess(lang === "ar" ? "تم حفظ العامل" : "Worker saved");
      await load();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function assignToProject() {
    if (!assignProjectId) return;
    setBusy(true);
    try {
      await api.assignSiteProjectWorker(assignProjectId, { workerId });
      showSuccess(lang === "ar" ? "تمت إضافة العامل للمشروع" : "Worker added to project");
      setAssignProjectId("");
      await load();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function unassign(projectId: string) {
    setBusy(true);
    try {
      await api.unassignSiteProjectWorker(projectId, workerId);
      showSuccess(lang === "ar" ? "تمت إزالة العامل من المشروع" : "Worker removed from project");
      await load();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <SkeletonBlock className="h-10 w-64" />
        <SkeletonBlock className="h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return <EmptyState title={lang === "ar" ? "العامل غير موجود" : "Worker not found"} />;
  }

  const assignedIds = new Set(data.assignments.map((a) => a.projectId));
  const availableProjects = projects.filter((p) => p.active && !assignedIds.has(p.id));

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/site-work" className="text-xs font-bold text-green">
            ← {lang === "ar" ? "حضور الموقع" : "Site work"}
          </Link>
          <h1 className="text-2xl font-bold text-ink mt-1">{data.name}</h1>
          <p className="text-sm text-ink-soft">
            {data.employeeCode ? `#${data.employeeCode} · ` : ""}
            {lang === "ar" ? "المستحق" : "Owed"}: <strong>{money(data.owedAmount)}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="px-3 py-1.5 rounded-xl bg-surface-2">
            {data.totals.daysWorked} {lang === "ar" ? "يوم" : "days"}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-surface-2">
            {money(data.totals.totalRegular)} {lang === "ar" ? "ساعة" : "hrs"}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-surface-2">
            +{money(data.totals.totalExtra)} {lang === "ar" ? "إضافي" : "OT"}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <form onSubmit={save} className="bg-white rounded-2xl border border-line p-4 space-y-3">
          <h2 className="font-bold text-green">{lang === "ar" ? "بيانات العامل" : "Worker details"}</h2>
          <div>
            <label className={labelClass}>{t.admin.siteWorkName}</label>
            <input
              className={inputClass}
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>{t.admin.siteWorkEmployeeCode}</label>
            <input
              className={inputClass}
              value={form.employeeCode}
              onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))}
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
                value={form.dailyPay}
                onChange={(e) => setForm((f) => ({ ...f, dailyPay: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>{t.admin.siteWorkExtraHourPay}</label>
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.001"
                value={form.extraHourPay}
                onChange={(e) => setForm((f) => ({ ...f, extraHourPay: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t.admin.siteWorkNotes}</label>
            <textarea
              className={`${inputClass} h-20 py-2`}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              className="accent-green"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            {t.admin.siteWorkActive}
          </label>
          <button
            type="submit"
            disabled={busy}
            className="h-11 px-4 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-50"
          >
            {busy ? <Spinner className="w-4 h-4" /> : t.admin.siteWorkSave}
          </button>
        </form>

        <div className="bg-white rounded-2xl border border-line p-4 space-y-3">
          <h2 className="font-bold text-green">{lang === "ar" ? "المشاريع" : "Projects"}</h2>
          <div className="flex gap-2">
            <select
              className={inputClass}
              value={assignProjectId}
              onChange={(e) => setAssignProjectId(e.target.value)}
            >
              <option value="">{lang === "ar" ? "إضافة لمشروع…" : "Add to project…"}</option>
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !assignProjectId}
              onClick={assignToProject}
              className="h-11 px-3 rounded-xl bg-ink text-white text-xs font-bold whitespace-nowrap disabled:opacity-40"
            >
              {lang === "ar" ? "إضافة" : "Add"}
            </button>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-auto">
            {data.assignments.length === 0 ? (
              <EmptyState title={lang === "ar" ? "غير معيّن لأي مشروع" : "Not on any project"} />
            ) : (
              data.assignments.map((a) => (
                <div key={a.projectId} className="rounded-xl border border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/admin/site-work/projects/${a.projectId}`}
                        className="font-bold text-sm text-green"
                      >
                        {a.project.name}
                      </Link>
                      <div className="text-[11px] text-ink-soft mt-0.5">
                        {a.jobTitle || "—"} · {a.daysWorked} {lang === "ar" ? "يوم" : "days"} ·{" "}
                        {money(a.totalRegular)}/{money(a.totalExtra)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => unassign(a.projectId)}
                      className="text-[11px] font-bold text-red-700"
                    >
                      {lang === "ar" ? "إزالة" : "Remove"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-line p-4">
        <h2 className="font-bold text-green mb-3">
          {lang === "ar" ? "آخر أيام الحضور" : "Recent attendance"}
        </h2>
        {data.recentDays.length === 0 ? (
          <EmptyState title={t.admin.siteWorkEmpty} />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-xs text-ink-soft border-b border-line">
                  <th className="text-start py-2 pe-2">{t.admin.siteWorkDate}</th>
                  <th className="text-start py-2 px-2">{t.admin.siteWorkProject}</th>
                  <th className="py-2 px-2">{t.admin.siteWorkHours}</th>
                  <th className="py-2 px-2">{t.admin.siteWorkExtra}</th>
                </tr>
              </thead>
              <tbody>
                {data.recentDays.map((d) => (
                  <tr key={d.id} className="border-b border-line/60">
                    <td className="py-2 pe-2 whitespace-nowrap">
                      {d.dayName} {d.workDate}
                    </td>
                    <td className="py-2 px-2">
                      <Link href={`/admin/site-work/projects/${d.projectId}`} className="font-bold text-green">
                        {d.project.name}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center">{money(d.regularHours)}</td>
                    <td className="py-2 px-2 text-center">{money(d.extraHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

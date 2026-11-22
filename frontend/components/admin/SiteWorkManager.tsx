"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { useToast } from "./Toast";
import { EmptyState, Spinner, SkeletonBlock } from "./EmptyState";
import { HardHatIcon } from "@/components/icons";
import type { SiteDayPayload, SiteEngineer, SiteProject, SiteWeekPayoutSheet, SiteWorker } from "@/lib/types";
import {
  AR_MONTHS,
  AR_WEEKDAY_SHORT,
  addDaysISO,
  monthMatrix,
  saturdayOf,
  todayLocalISO,
} from "@/lib/siteDates";
import { SiteExcelViewer } from "@/components/site/SiteExcelViewer";
import { ClearRecordsDialog } from "./SiteRecordsCleanup";

type Panel = "workspace" | "engineers" | "workers" | "new-project";

function formatMoney(value: string | number | null | undefined) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

const inputClass =
  "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";
const labelClass = "text-xs font-bold text-ink-soft mb-1 block";

type DayRow = {
  workerId: string;
  name: string;
  jobTitle?: string | null;
  regularHours: string;
  extraHours: string;
  notes: string;
};

export function SiteWorkManager() {
  const { t, lang } = useLanguage();
  const { showSuccess, showError } = useToast();
  const [panel, setPanel] = useState<Panel>("workspace");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [projects, setProjects] = useState<SiteProject[]>([]);
  const [engineers, setEngineers] = useState<SiteEngineer[]>([]);
  const [workers, setWorkers] = useState<SiteWorker[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [date, setDate] = useState(todayLocalISO());
  const [dayPayload, setDayPayload] = useState<SiteDayPayload | null>(null);
  const [rows, setRows] = useState<DayRow[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [showCal, setShowCal] = useState(true);

  const [projectForm, setProjectForm] = useState({
    name: "",
    code: "",
    notes: "",
    workerIds: [] as string[],
    engineerIds: [] as string[],
    coordinatorId: "",
    budget: "",
  });

  const [engForm, setEngForm] = useState({
    name: "",
    email: "",
    passcode: "",
    role: "ENGINEER" as "ENGINEER" | "COORDINATOR",
    projectIds: [] as string[],
  });
  const [workerForm, setWorkerForm] = useState({
    name: "",
    employeeCode: "",
    notes: "",
    dailyPay: "",
    extraHourPay: "",
    projectIds: [] as string[],
  });
  const [payouts, setPayouts] = useState<SiteWeekPayoutSheet | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [editRates, setEditRates] = useState({ dailyPay: "", extraHourPay: "" });
  const [excelOpen, setExcelOpen] = useState(false);
  const [assignWorkerId, setAssignWorkerId] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [workerSearch, setWorkerSearch] = useState("");
  const [dayAddQuery, setDayAddQuery] = useState("");
  const [payoutSearch, setPayoutSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  /** "all" = every project; otherwise the project being cleared. */
  const [clearTarget, setClearTarget] = useState<"all" | { id: string; name: string } | null>(null);

  const selected = projects.find((p) => p.id === selectedId) || null;
  /** Archived projects are closed in the site portal, so skip loading their day sheet. */
  const selectedActive = selected?.active !== false;
  const weekStart = useMemo(() => saturdayOf(date), [date]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    const pool = showArchived ? projects : projects.filter((p) => p.active);
    if (!q) return pool;
    return pool.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code || "").toLowerCase().includes(q) ||
        p.workers.some((w) => w.name.toLowerCase().includes(q))
    );
  }, [projects, projectSearch, showArchived]);
  const archivedCount = projects.filter((p) => !p.active).length;

  async function setProjectArchived(p: SiteProject, archived: boolean) {
    setBusy(true);
    try {
      await api.updateSiteProject(p.id, { active: !archived });
      showSuccess(
        archived
          ? lang === "ar" ? "تمت أرشفة المشروع (مخفي عن المهندسين)" : "Project archived (hidden from engineers)"
          : lang === "ar" ? "تمت استعادة المشروع" : "Project restored"
      );
      if (archived && !showArchived) setSelectedId(projects.find((x) => x.active && x.id !== p.id)?.id ?? null);
      await loadAll();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function purgeProject(p: SiteProject) {
    const typed = window.prompt(
      lang === "ar"
        ? `حذف نهائي للمشروع «${p.name}» مع كل سجلات الحضور والدفعات والمصاريف. لا يمكن التراجع.\nاكتب اسم المشروع للتأكيد:`
        : `Permanently delete “${p.name}” with all attendance, payouts and expenses. This cannot be undone.\nType the project name to confirm:`
    );
    if (typed == null) return;
    if (typed.trim() !== p.name.trim()) {
      showError(lang === "ar" ? "الاسم غير مطابق، لم يُحذف شيء" : "Name didn't match; nothing deleted");
      return;
    }
    setBusy(true);
    try {
      const r = await api.purgeSiteProject(p.id, typed);
      showSuccess(
        lang === "ar"
          ? `حُذف المشروع (${r.records} سجل · ${r.payouts} دفعة · ${r.expenses} مصروف)`
          : `Project deleted (${r.records} rows · ${r.payouts} payouts · ${r.expenses} expenses)`
      );
      setSelectedId(projects.find((x) => x.id !== p.id && (showArchived || x.active))?.id ?? null);
      await loadAll();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  const filteredWorkers = useMemo(() => {
    const q = workerSearch.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.employeeCode || "").toLowerCase().includes(q) ||
        w.projects.some((p) => p.name.toLowerCase().includes(q))
    );
  }, [workers, workerSearch]);

  const dayRoster = dayPayload?.roster || [];
  const dayAddMatches = useMemo(() => {
    const q = dayAddQuery.trim().toLowerCase();
    const present = new Set(rows.map((r) => r.workerId));
    return dayRoster
      .filter((w) => !present.has(w.workerId))
      .filter(
        (w) =>
          !q ||
          w.name.toLowerCase().includes(q) ||
          (w.employeeCode || "").toLowerCase().includes(q) ||
          (w.jobTitle || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [dayAddQuery, dayRoster, rows]);

  const visiblePayouts = useMemo(() => {
    if (!payouts) return [];
    const q = payoutSearch.trim().toLowerCase();
    return payouts.workers.filter((w) => {
      if (w.daysWorked <= 0 && Number(w.amount) <= 0) return false;
      if (!q) return true;
      return (
        w.name.toLowerCase().includes(q) ||
        (w.employeeCode || "").toLowerCase().includes(q)
      );
    });
  }, [payouts, payoutSearch]);

  const calCursor = useMemo(() => {
    const [y, m] = date.split("-").map(Number);
    return { year: y!, month: (m || 1) - 1 };
  }, [date]);
  const [viewYear, setViewYear] = useState(calCursor.year);
  const [viewMonth, setViewMonth] = useState(calCursor.month);

  useEffect(() => {
    setViewYear(calCursor.year);
    setViewMonth(calCursor.month);
  }, [calCursor.year, calCursor.month]);

  async function loadAll() {
    setLoading(true);
    try {
      const [p, e, w] = await Promise.all([
        api.siteProjects(),
        api.siteEngineers(),
        api.siteWorkers(),
      ]);
      setProjects(p);
      setEngineers(e);
      setWorkers(w);
      if (!selectedId && p.length) setSelectedId((p.find((x) => x.active) ?? p[0]!).id);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureSiteSession = useCallback(async () => {
    try {
      await api.siteMe();
    } catch {
      await api.siteAdminEnter();
    }
  }, []);

  const loadDay = useCallback(
    async (projectId: string, d: string) => {
      setDayLoading(true);
      try {
        await ensureSiteSession();
        const data = await api.siteProjectDay(projectId, d);
        setDayPayload(data);
        setRows(
          data.workers.map((w) => ({
            workerId: w.workerId,
            name: w.name,
            jobTitle: w.jobTitle,
            regularHours: w.record?.regularHours ?? "0",
            extraHours: w.record?.extraHours ?? "0",
            notes: w.record?.notes ?? "",
          }))
        );
        setDayAddQuery("");
      } catch (err) {
        setDayPayload(null);
        setRows([]);
        showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
      } finally {
        setDayLoading(false);
      }
    },
    [ensureSiteSession, showError, t.admin.saveFailed]
  );

  useEffect(() => {
    if (selectedId && selectedActive && panel === "workspace") void loadDay(selectedId, date);
  }, [selectedId, selectedActive, date, panel, loadDay]);

  const loadPayouts = useCallback(
    async (projectId: string, week: string) => {
      setPayoutLoading(true);
      try {
        const data = await api.siteWeekPayouts(projectId, week);
        setPayouts(data);
      } catch (err) {
        setPayouts(null);
        showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
      } finally {
        setPayoutLoading(false);
      }
    },
    [showError, t.admin.saveFailed]
  );

  useEffect(() => {
    if (selectedId && selectedActive && panel === "workspace") void loadPayouts(selectedId, weekStart);
  }, [selectedId, selectedActive, weekStart, panel, loadPayouts]);

  async function saveDay() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await ensureSiteSession();
      await api.siteSaveDay(selectedId, {
        date,
        rows: rows.map((r) => ({
          workerId: r.workerId,
          regularHours: Number(r.regularHours) || 0,
          extraHours: Number(r.extraHours) || 0,
          notes: r.notes.trim() || null,
        })),
      });
      showSuccess(lang === "ar" ? "تم حفظ اليوم في النظام وExcel" : "Day saved to system & Excel");
      await loadDay(selectedId, date);
      await loadPayouts(selectedId, weekStart);
      await loadAll();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function togglePaid(workerId: string, paid: boolean) {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api.markSitePayoutPaid({
        workerId,
        projectId: selectedId,
        weekStart,
        paid,
      });
      showSuccess(
        paid
          ? lang === "ar"
            ? "تم تسجيل الدفع"
            : "Marked as paid"
          : lang === "ar"
            ? "تم إلغاء الدفع"
            : "Marked unpaid"
      );
      await loadPayouts(selectedId, weekStart);
      await loadAll();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function saveWorkerRates(workerId: string) {
    setBusy(true);
    try {
      const updated = await api.updateSiteWorker(workerId, {
        dailyPay: Number(editRates.dailyPay) || 0,
        extraHourPay: Number(editRates.extraHourPay) || 0,
      });
      setWorkers((prev) =>
        prev.map((w) => (w.id === workerId ? updated : w)).sort((a, b) => a.name.localeCompare(b.name, "ar"))
      );
      setEditingWorkerId(null);
      showSuccess(lang === "ar" ? "تم تحديث الأجور" : "Pay rates updated");
      if (selectedId) await loadPayouts(selectedId, weekStart);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function openAsEngineer() {
    setBusy(true);
    try {
      await api.siteAdminEnter();
      window.open("/site", "_blank", "noopener,noreferrer");
      showSuccess(lang === "ar" ? "تم فتح بوابة المهندس بكل المشاريع" : "Engineer portal opened");
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await api.createSiteProject({
        name: projectForm.name.trim(),
        code: projectForm.code.trim() || null,
        notes: projectForm.notes.trim() || null,
        workerIds: projectForm.workerIds,
        engineerIds: projectForm.engineerIds,
        coordinatorId: projectForm.coordinatorId || null,
        budget: projectForm.budget.trim() ? Number(projectForm.budget) : null,
      });
      setProjects((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "ar")));
      setSelectedId(created.id);
      setProjectForm({ name: "", code: "", notes: "", workerIds: [], engineerIds: [], coordinatorId: "", budget: "" });
      setPanel("workspace");
      showSuccess(lang === "ar" ? "تم إنشاء المشروع وملف Excel" : "Project + Excel created");
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function createEngineer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await api.createSiteEngineer({
        name: engForm.name.trim(),
        email: engForm.email.trim() || null,
        passcode: engForm.passcode,
        role: engForm.role,
        projectIds: engForm.projectIds,
      });
      setEngineers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "ar")));
      setEngForm({ name: "", email: "", passcode: "", role: "ENGINEER", projectIds: [] });
      showSuccess(
        engForm.role === "COORDINATOR"
          ? lang === "ar"
            ? "تمت إضافة المنسق"
            : "Coordinator added"
          : lang === "ar"
            ? "تمت إضافة المهندس"
            : "Engineer added"
      );
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function createWorker(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await api.createSiteWorker({
        name: workerForm.name.trim(),
        employeeCode: workerForm.employeeCode.trim() || null,
        notes: workerForm.notes.trim() || null,
        dailyPay: Number(workerForm.dailyPay) || 0,
        extraHourPay: Number(workerForm.extraHourPay) || 0,
        projectIds: workerForm.projectIds,
      });
      setWorkers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "ar")));
      setWorkerForm({
        name: "",
        employeeCode: "",
        notes: "",
        dailyPay: "",
        extraHourPay: "",
        projectIds: [],
      });
      if (workerForm.projectIds.length) await loadAll();
      showSuccess(lang === "ar" ? "تمت إضافة العامل" : "Worker added");
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  function toggleId(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  const matrix = monthMatrix(viewYear, viewMonth);

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonBlock className="h-10 w-64" />
        <SkeletonBlock className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
            <HardHatIcon className="w-6 h-6 text-gold" />
            {t.admin.siteWorkTitle}
          </h1>
          <p className="text-sm text-ink-soft mt-1">{t.admin.siteWorkNote}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/site-work/expenses"
            className="h-10 px-4 rounded-xl bg-gold text-ink text-sm font-bold inline-flex items-center"
          >
            {lang === "ar" ? "المصاريف والمنسقون" : "Expenses & coordinators"}
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={openAsEngineer}
            className="h-10 px-4 rounded-xl bg-green text-white text-sm font-bold"
          >
            {lang === "ar" ? "فتح كمهندس (كل المشاريع)" : "Open as engineer (all projects)"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await api.reimportSiteExcel();
                showSuccess(
                  lang === "ar"
                    ? `تم الاستيراد: ${result.totalDayRows} يوم · المجموع في القاعدة ${result.recordCount}`
                    : `Imported ${result.totalDayRows} day rows · DB ${result.recordCount}`
                );
                await loadAll();
              } catch (err) {
                showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
              } finally {
                setBusy(false);
              }
            }}
            className="h-10 px-3 rounded-xl border border-line text-sm font-bold"
          >
            {lang === "ar" ? "إعادة استيراد Excel" : "Re-import Excel"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setClearTarget("all")}
            className="h-10 px-3 rounded-xl border border-red-300 text-red-700 text-sm font-bold"
          >
            {lang === "ar" ? "مسح كل السجلات" : "Clear all records"}
          </button>
          <button
            type="button"
            onClick={() => setPanel("workspace")}
            className={`h-10 px-3 rounded-xl text-sm font-bold ${panel === "workspace" ? "bg-ink text-white" : "bg-white border border-line"}`}
          >
            {lang === "ar" ? "المشاريع واليوم" : "Projects & day"}
          </button>
          <button
            type="button"
            onClick={() => setPanel("engineers")}
            className={`h-10 px-3 rounded-xl text-sm font-bold ${panel === "engineers" ? "bg-ink text-white" : "bg-white border border-line"}`}
          >
            {t.admin.siteWorkTabEngineers}
          </button>
          <button
            type="button"
            onClick={() => setPanel("workers")}
            className={`h-10 px-3 rounded-xl text-sm font-bold ${panel === "workers" ? "bg-ink text-white" : "bg-white border border-line"}`}
          >
            {t.admin.siteWorkTabWorkers}
          </button>
          <button
            type="button"
            onClick={() => setPanel("new-project")}
            className={`h-10 px-3 rounded-xl text-sm font-bold ${panel === "new-project" ? "bg-ink text-white" : "bg-white border border-line"}`}
          >
            {t.admin.siteWorkNewProject}
          </button>
        </div>
      </header>

      {clearTarget ? (
        <ClearRecordsDialog
          lang={lang}
          project={clearTarget === "all" ? null : clearTarget}
          onClose={() => setClearTarget(null)}
          onError={showError}
          onDone={async (msg) => {
            showSuccess(msg);
            await loadAll();
            if (selectedId && selectedActive && panel === "workspace") {
              await loadDay(selectedId, date);
              await loadPayouts(selectedId, weekStart);
            }
          }}
        />
      ) : null}

      {panel === "workspace" && (
        <div className="grid lg:grid-cols-[280px_1fr] gap-4 items-start">
          <aside className="bg-white rounded-2xl border border-line overflow-hidden">
            <div className="px-3 py-2 border-b border-line space-y-2">
              <div className="text-xs font-bold text-ink-soft">
                {lang === "ar" ? `المشاريع (${filteredProjects.length})` : `Projects (${filteredProjects.length})`}
              </div>
              <input
                className="w-full h-9 rounded-lg border border-line bg-surface-2 px-3 text-xs outline-none focus:border-gold"
                placeholder={lang === "ar" ? "بحث مشروع أو عامل…" : "Search project or worker…"}
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
              />
              {archivedCount ? (
                <label className="flex items-center gap-2 text-[11px] font-bold text-ink-soft">
                  <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                  {lang === "ar" ? `عرض المؤرشفة (${archivedCount})` : `Show archived (${archivedCount})`}
                </label>
              ) : null}
            </div>
            <div className="max-h-[70vh] overflow-auto">
              {filteredProjects.length === 0 ? (
                <div className="p-4">
                  <EmptyState title={t.admin.siteWorkEmpty} />
                </div>
              ) : (
                filteredProjects.map((p) => (
                  <div
                    key={p.id}
                    className={`border-b border-line ${selectedId === p.id ? "bg-green/10" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className="w-full text-start px-3 pt-3 pb-1 hover:bg-surface-2/60 transition-colors"
                    >
                      <div className="font-bold text-sm text-ink">{p.name}</div>
                      <div className="text-[11px] text-ink-soft mt-0.5">
                        {p.code ? `${p.code} · ` : ""}
                        {p.workers.length} {lang === "ar" ? "عامل" : "workers"} ·{" "}
                        {lang === "ar" ? "أسبوع" : "wk"} {p.weekCounter || "—"}
                        {p.hasExcel ? " · Excel" : ""}
                        {!p.active ? ` · ${t.admin.siteWorkInactive}` : ""}
                      </div>
                    </button>
                    <div className="px-3 pb-2">
                      <Link
                        href={`/admin/site-work/projects/${p.id}`}
                        className="text-[11px] font-bold text-green"
                      >
                        {lang === "ar" ? "تفاصيل المشروع →" : "Project details →"}
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>

          <section className="space-y-4 min-w-0">
            {!selected ? (
              <EmptyState title={lang === "ar" ? "اختر مشروعاً" : "Select a project"} />
            ) : (
              <>
                <div className="bg-white rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2
                        className="text-xl font-extrabold text-green"
                        style={{ fontFamily: "var(--font-brand), sans-serif" }}
                      >
                        <Link href={`/admin/site-work/projects/${selected.id}`} className="hover:underline">
                          {selected.name}
                        </Link>
                      </h2>
                      <div className="text-sm text-ink-soft mt-1 space-y-0.5">
                        {selected.code ? <div>{lang === "ar" ? "الرمز" : "Code"}: {selected.code}</div> : null}
                        <div>
                          {selected.workers.length} {lang === "ar" ? "عامل" : "workers"} ·{" "}
                          {selected.engineers.length} {lang === "ar" ? "مهندس" : "engineers"} ·{" "}
                          {selected.recordCount} {lang === "ar" ? "سجل" : "records"} ·{" "}
                          {lang === "ar" ? "الأسبوع الحالي" : "week"} #{selected.weekCounter || 0}
                        </div>
                        {selected.notes ? <div className="mt-1">{selected.notes}</div> : null}
                        {selected.excelFilename ? (
                          <div className="text-xs font-bold text-gold mt-1">{selected.excelFilename}</div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                            const blob = await api.downloadSiteProjectExcel(selected.id);
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = selected.excelFilename || `عمال مشروع ${selected.name}.xlsx`;
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch (err) {
                            showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
                          }
                        }}
                      >
                        {lang === "ar" ? "تحميل" : "Download"}
                      </button>
                      <a
                        href={`/site/projects/${selected.id}?date=${date}`}
                        target="_blank"
                        rel="noreferrer"
                        className="h-10 px-3 rounded-xl border border-line text-xs font-bold inline-flex items-center"
                        onClick={async (e) => {
                          e.preventDefault();
                          try {
                            await api.siteAdminEnter();
                            window.open(`/site/projects/${selected.id}?date=${date}`, "_blank");
                          } catch (err) {
                            showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
                          }
                        }}
                      >
                        {lang === "ar" ? "فتح في بوابة الموقع" : "Open in portal"}
                      </a>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setProjectArchived(selected, selected.active)}
                        className="h-10 px-3 rounded-xl border border-line text-xs font-bold"
                      >
                        {selected.active
                          ? lang === "ar" ? "أرشفة" : "Archive"
                          : lang === "ar" ? "استعادة من الأرشيف" : "Restore"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setClearTarget({ id: selected.id, name: selected.name })}
                        className="h-10 px-3 rounded-xl border border-red-300 text-red-700 text-xs font-bold"
                      >
                        {lang === "ar" ? "مسح السجلات" : "Clear records"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => purgeProject(selected)}
                        className="h-10 px-3 rounded-xl bg-red-700 text-white text-xs font-bold"
                      >
                        {lang === "ar" ? "حذف نهائي" : "Delete"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs items-center">
                    <span className="font-bold text-ink-soft">{lang === "ar" ? "العمال:" : "Workers:"}</span>
                    {selected.workers.slice(0, 12).map((w) => (
                      <Link
                        key={w.id}
                        href={`/admin/site-work/workers/${w.id}`}
                        className="px-2 py-1 rounded-lg bg-surface-2 font-medium hover:bg-green/10"
                      >
                        {w.name}
                      </Link>
                    ))}
                    {selected.workers.length > 12 ? (
                      <span className="text-ink-soft">+{selected.workers.length - 12}</span>
                    ) : null}
                  </div>

                  <form
                    className="mt-4 flex flex-wrap gap-2 items-end"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!assignWorkerId || !selectedId) return;
                      setBusy(true);
                      try {
                        await api.assignSiteProjectWorker(selectedId, { workerId: assignWorkerId });
                        showSuccess(lang === "ar" ? "تمت إضافة العامل للمشروع" : "Worker added to project");
                        setAssignWorkerId("");
                        await loadAll();
                        await loadDay(selectedId, date);
                        await loadPayouts(selectedId, weekStart);
                      } catch (err) {
                        showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <div className="flex-1 min-w-[180px]">
                      <label className={labelClass}>
                        {lang === "ar" ? "إضافة عامل للمشروع" : "Add worker to project"}
                      </label>
                      <select
                        className={inputClass}
                        value={assignWorkerId}
                        onChange={(e) => setAssignWorkerId(e.target.value)}
                      >
                        <option value="">{lang === "ar" ? "اختر…" : "Select…"}</option>
                        {workers
                          .filter((w) => w.active && !selected.workerIds.includes(w.id))
                          .map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={busy || !assignWorkerId}
                      className="h-11 px-3 rounded-xl bg-ink text-white text-xs font-bold disabled:opacity-40"
                    >
                      {lang === "ar" ? "إضافة" : "Add"}
                    </button>
                    <Link
                      href={`/admin/site-work/projects/${selected.id}`}
                      className="h-11 px-3 rounded-xl border border-line text-xs font-bold inline-flex items-center"
                    >
                      {lang === "ar" ? "تفاصيل / عامل جديد" : "Details / new worker"}
                    </Link>
                  </form>
                </div>

                <div className="grid md:grid-cols-[300px_1fr] gap-4">
                  <div className="bg-white rounded-2xl border border-line p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold text-sm">{lang === "ar" ? "التقويم" : "Calendar"}</div>
                      <button
                        type="button"
                        className="text-xs font-bold text-green"
                        onClick={() => setShowCal((v) => !v)}
                      >
                        {showCal ? (lang === "ar" ? "إخفاء" : "Hide") : lang === "ar" ? "إظهار" : "Show"}
                      </button>
                    </div>
                    {showCal && (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full bg-surface-2 font-bold"
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
                          <div className="text-sm font-bold">
                            {AR_MONTHS[viewMonth]} {viewYear}
                          </div>
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full bg-surface-2 font-bold"
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
                        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-ink-soft mb-1">
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
                                onClick={() => setDate(cell)}
                                className={`h-9 rounded-lg text-xs font-bold ${
                                  cell === date
                                    ? "bg-green text-white"
                                    : cell === todayLocalISO()
                                      ? "bg-gold/30"
                                      : "bg-surface-2"
                                }`}
                              >
                                {Number(cell.slice(8))}
                              </button>
                            ) : (
                              <div key={`e-${i}`} />
                            )
                          )}
                        </div>
                      </>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        className="h-9 px-2 rounded-xl border border-line text-xs font-bold flex-1"
                        onClick={() => setDate(addDaysISO(date, -1))}
                      >
                        {lang === "ar" ? "السابق" : "Prev"}
                      </button>
                      <button
                        type="button"
                        className="h-9 px-2 rounded-xl border border-line text-xs font-bold flex-1"
                        onClick={() => setDate(todayLocalISO())}
                      >
                        {lang === "ar" ? "اليوم" : "Today"}
                      </button>
                      <button
                        type="button"
                        className="h-9 px-2 rounded-xl border border-line text-xs font-bold flex-1"
                        onClick={() => setDate(addDaysISO(date, 1))}
                      >
                        {lang === "ar" ? "التالي" : "Next"}
                      </button>
                    </div>
                    <div className="mt-2 text-center text-sm font-bold text-green">
                      {dayPayload?.dayName || ""} {date}
                    </div>
                    <a
                      className="mt-2 block text-center text-xs font-bold text-gold"
                      href={`/site/projects/${selected.id}/week?weekStart=${saturdayOf(date)}`}
                      onClick={async (e) => {
                        e.preventDefault();
                        try {
                          await api.siteAdminEnter();
                          window.open(
                            `/site/projects/${selected.id}/week?weekStart=${saturdayOf(date)}`,
                            "_blank"
                          );
                        } catch (err) {
                          showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
                        }
                      }}
                    >
                      {lang === "ar" ? "الجدول الأسبوعي" : "Weekly sheet"}
                    </a>
                  </div>

                  <div className="bg-white rounded-2xl border border-line p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-bold">
                          {lang === "ar" ? "تسجيل اليوم" : "Day entry"} — {date}
                        </h3>
                        <p className="text-[11px] text-ink-soft mt-0.5">
                          {lang === "ar"
                            ? "يظهر فقط من سجّلت حضورهم — أضف عامل بالبحث"
                            : "Only workers with attendance — add more via search"}
                          {dayRoster.length
                            ? ` · ${rows.length}/${dayRoster.length}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy || dayLoading}
                        onClick={saveDay}
                        className="h-10 px-4 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-50"
                      >
                        {busy ? <Spinner className="w-4 h-4" /> : t.admin.siteWorkSave}
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        className={inputClass}
                        placeholder={
                          lang === "ar"
                            ? "بحث لإضافة عامل لهذا اليوم…"
                            : "Search to add a worker for this day…"
                        }
                        value={dayAddQuery}
                        onChange={(e) => setDayAddQuery(e.target.value)}
                        disabled={dayLoading}
                      />
                      {dayAddQuery.trim() && dayAddMatches.length > 0 ? (
                        <div className="absolute z-20 mt-1 w-full rounded-xl border border-line bg-white shadow-lg overflow-hidden">
                          {dayAddMatches.map((w) => (
                            <button
                              key={w.workerId}
                              type="button"
                              className="w-full text-start px-3 py-2 text-sm hover:bg-surface-2 border-b border-line last:border-0"
                              onClick={() => {
                                setRows((prev) => [
                                  ...prev,
                                  {
                                    workerId: w.workerId,
                                    name: w.name,
                                    jobTitle: w.jobTitle,
                                    regularHours: "8",
                                    extraHours: "0",
                                    notes: "",
                                  },
                                ]);
                                setDayAddQuery("");
                              }}
                            >
                              <span className="font-bold">{w.name}</span>
                              {w.jobTitle ? (
                                <span className="text-ink-soft text-xs ms-2">{w.jobTitle}</span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {dayLoading ? (
                      <div className="text-sm text-ink-soft">{lang === "ar" ? "جاري التحميل…" : "Loading…"}</div>
                    ) : rows.length === 0 ? (
                      <EmptyState
                        title={
                          lang === "ar"
                            ? "لا حضور لهذا اليوم — ابحث لإضافة عامل"
                            : "No attendance yet — search to add a worker"
                        }
                      />
                    ) : (
                      <div className="space-y-2 max-h-[60vh] overflow-auto pe-1">
                        {rows.map((row, idx) => (
                          <div key={row.workerId} className="rounded-xl border border-line p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-bold text-sm min-w-0">
                                <Link
                                  href={`/admin/site-work/workers/${row.workerId}`}
                                  className="text-green hover:underline"
                                >
                                  {row.name}
                                </Link>
                                {row.jobTitle ? (
                                  <span className="text-ink-soft font-medium ms-2">· {row.jobTitle}</span>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                className="text-[11px] font-bold text-red-700 shrink-0"
                                onClick={() =>
                                  setRows((prev) => prev.filter((r) => r.workerId !== row.workerId))
                                }
                              >
                                {lang === "ar" ? "إزالة" : "Remove"}
                              </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              <div>
                                <label className={labelClass}>{t.admin.siteWorkHours}</label>
                                <input
                                  className={inputClass}
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="24"
                                  value={row.regularHours}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, regularHours: v } : r))
                                    );
                                  }}
                                />
                              </div>
                              <div>
                                <label className={labelClass}>{t.admin.siteWorkExtra}</label>
                                <input
                                  className={inputClass}
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="24"
                                  value={row.extraHours}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, extraHours: v } : r))
                                    );
                                  }}
                                />
                              </div>
                              <div className="col-span-2 sm:col-span-1">
                                <label className={labelClass}>{t.admin.siteWorkNotes}</label>
                                <input
                                  className={inputClass}
                                  value={row.notes}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, notes: v } : r))
                                    );
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-line p-4 space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-green">{t.admin.siteWorkWeekPay}</h3>
                      <p className="text-xs text-ink-soft mt-1">
                        {weekStart} → {addDaysISO(weekStart, 5)} ·{" "}
                        {lang === "ar" ? "فقط من لديهم أيام هذا الأسبوع" : "Only workers with days this week"}
                      </p>
                    </div>
                    <div className="text-sm text-end">
                      <div className="font-bold">
                        {lang === "ar" ? "إجمالي الأسبوع" : "Week total"}: {formatMoney(payouts?.weekTotal)}{" "}
                        {lang === "ar" ? "د.أ" : "JOD"}
                      </div>
                      <div className="text-xs text-ink-soft">
                        {t.admin.siteWorkWeekUnpaidTotal}: {formatMoney(payouts?.weekUnpaidTotal)}
                      </div>
                    </div>
                  </div>

                  <input
                    className={inputClass}
                    placeholder={lang === "ar" ? "بحث في الرواتب…" : "Search paychecks…"}
                    value={payoutSearch}
                    onChange={(e) => setPayoutSearch(e.target.value)}
                  />

                  {payoutLoading ? (
                    <div className="text-sm text-ink-soft">{lang === "ar" ? "جاري التحميل…" : "Loading…"}</div>
                  ) : visiblePayouts.length === 0 ? (
                    <EmptyState
                      title={lang === "ar" ? "لا حضور محسوب لهذا الأسبوع" : "No worked days this week"}
                    />
                  ) : (
                    <div className="overflow-auto">
                      <table className="w-full text-sm min-w-[720px]">
                        <thead>
                          <tr className="text-start text-xs text-ink-soft border-b border-line">
                            <th className="py-2 pe-2 font-bold">{t.admin.siteWorkWorker}</th>
                            <th className="py-2 px-2 font-bold">{t.admin.siteWorkDailyPay}</th>
                            <th className="py-2 px-2 font-bold">{t.admin.siteWorkDaysWorked}</th>
                            <th className="py-2 px-2 font-bold">{t.admin.siteWorkExtra}</th>
                            <th className="py-2 px-2 font-bold">{t.admin.siteWorkPayAmount}</th>
                            <th className="py-2 px-2 font-bold">{t.admin.siteWorkOwed}</th>
                            <th className="py-2 ps-2 font-bold">{lang === "ar" ? "الحالة" : "Status"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visiblePayouts.map((w) => (
                            <tr key={w.workerId} className="border-b border-line/70 align-middle">
                              <td className="py-2.5 pe-2 font-bold">
                                {w.name}
                                {w.employeeCode ? (
                                  <span className="text-ink-soft font-medium ms-1">#{w.employeeCode}</span>
                                ) : null}
                              </td>
                              <td className="py-2.5 px-2 text-xs">
                                {formatMoney(w.dailyPay)}
                                <span className="text-ink-soft"> / </span>
                                {formatMoney(w.extraHourPay)}
                              </td>
                              <td className="py-2.5 px-2">
                                <div className="font-bold tabular-nums">
                                  {w.dayUnits ?? w.daysWorked}
                                  <span className="text-[11px] font-medium text-ink-soft">
                                    {" "}
                                    {lang === "ar" ? "يوم مدفوع" : "paid days"}
                                  </span>
                                </div>
                                {w.partialDays || w.extraOnlyDays ? (
                                  <div className="text-[10px] text-ink-soft leading-tight">
                                    {w.fullDays ?? 0} {lang === "ar" ? "كامل" : "full"}
                                    {w.partialDays ? ` · ${w.partialDays} ${lang === "ar" ? "جزئي" : "partial"}` : ""}
                                    {w.extraOnlyDays ? ` · ${w.extraOnlyDays} ${lang === "ar" ? "إضافي فقط" : "extra only"}` : ""}
                                  </div>
                                ) : null}
                                <div className="text-[10px] text-ink-soft">{formatMoney(w.dayPayTotal)}</div>
                              </td>
                              <td className="py-2.5 px-2">
                                <div className="font-bold tabular-nums">{formatMoney(w.totalExtraHours)}</div>
                                <div className="text-[10px] text-ink-soft">{formatMoney(w.extraPayTotal)}</div>
                              </td>
                              <td className="py-2.5 px-2 font-bold">{formatMoney(w.amount)}</td>
                              <td className="py-2.5 px-2">{formatMoney(w.owedAmount)}</td>
                              <td className="py-2.5 ps-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                                      w.paid ? "bg-green/15 text-green" : "bg-surface-2 text-ink-soft"
                                    }`}
                                  >
                                    {w.paid ? t.admin.siteWorkPaid : t.admin.siteWorkUnpaid}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={busy || Number(w.amount) <= 0}
                                    onClick={() => togglePaid(w.workerId, !w.paid)}
                                    className="h-8 px-2 rounded-lg border border-line text-[11px] font-bold disabled:opacity-40"
                                  >
                                    {w.paid ? t.admin.siteWorkMarkUnpaid : t.admin.siteWorkMarkPaid}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {panel === "new-project" && (
        <form onSubmit={createProject} className="bg-white rounded-2xl border border-line p-4 space-y-3 max-w-xl">
          <h2 className="font-bold text-green">{t.admin.siteWorkNewProject}</h2>
          <p className="text-xs text-ink-soft">
            {lang === "ar"
              ? "يُنشأ تلقائياً ملف Excel بنفس القالب والهيكل."
              : "Creates a matching Excel workbook automatically."}
          </p>
          <div>
            <label className={labelClass}>{t.admin.siteWorkName}</label>
            <input
              className={inputClass}
              required
              value={projectForm.name}
              onChange={(e) => setProjectForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>{t.admin.siteWorkCode}</label>
            <input
              className={inputClass}
              value={projectForm.code}
              onChange={(e) => setProjectForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>{t.admin.siteWorkNotes}</label>
            <textarea
              className={`${inputClass} h-20 py-2`}
              value={projectForm.notes}
              onChange={(e) => setProjectForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>{t.admin.siteWorkAssignWorkers}</label>
            <div className="max-h-40 overflow-auto rounded-xl border border-line p-2 space-y-1">
              {workers.filter((w) => w.active).map((w) => (
                <label key={w.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-green"
                    checked={projectForm.workerIds.includes(w.id)}
                    onChange={() =>
                      setProjectForm((f) => ({ ...f, workerIds: toggleId(f.workerIds, w.id) }))
                    }
                  />
                  {w.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>{t.admin.siteWorkAssignEngineers}</label>
            <div className="max-h-32 overflow-auto rounded-xl border border-line p-2 space-y-1">
              {engineers.filter((e) => e.active).map((eng) => (
                <label key={eng.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-green"
                    checked={projectForm.engineerIds.includes(eng.id)}
                    onChange={() =>
                      setProjectForm((f) => ({
                        ...f,
                        engineerIds: toggleId(f.engineerIds, eng.id),
                      }))
                    }
                  />
                  {eng.name}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{lang === "ar" ? "المنسق المسؤول" : "Coordinator"}</label>
              <select
                className={inputClass}
                value={projectForm.coordinatorId}
                onChange={(e) => setProjectForm((f) => ({ ...f, coordinatorId: e.target.value }))}
              >
                <option value="">{lang === "ar" ? "— بدون —" : "— none —"}</option>
                {engineers.filter((e) => e.active).map((eng) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{lang === "ar" ? "الميزانية (د.أ، اختياري)" : "Budget (JOD, optional)"}</label>
              <input
                className={inputClass}
                type="number"
                min="0"
                value={projectForm.budget}
                onChange={(e) => setProjectForm((f) => ({ ...f, budget: e.target.value }))}
              />
            </div>
          </div>
          <button type="submit" disabled={busy} className="h-11 px-4 rounded-xl bg-green text-white text-sm font-bold">
            {busy ? <Spinner className="w-4 h-4" /> : t.admin.siteWorkSave}
          </button>
        </form>
      )}

      {panel === "engineers" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <form onSubmit={createEngineer} className="bg-white rounded-2xl border border-line p-4 space-y-3">
            <h2 className="font-bold text-green">
              {lang === "ar" ? "مهندس / منسق جديد" : "New engineer / coordinator"}
            </h2>
            <p className="text-xs text-ink-soft">
              {lang === "ar"
                ? "المنسق (أحمد / محمد) يدفع مصاريف مشاريعه. المهندس يسجّل الحضور فقط."
                : "Coordinators (Ahmad / Mohammed) pay for their projects. Engineers only log attendance."}
            </p>
            <div>
              <label className={labelClass}>{t.admin.siteWorkName}</label>
              <input
                className={inputClass}
                required
                value={engForm.name}
                onChange={(e) => setEngForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t.admin.siteWorkEmail} ({lang === "ar" ? "اختياري" : "optional"})
              </label>
              <input
                className={inputClass}
                type="email"
                value={engForm.email}
                onChange={(e) => setEngForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>{lang === "ar" ? "الدور" : "Role"}</label>
              <select
                className={inputClass}
                value={engForm.role}
                onChange={(e) =>
                  setEngForm((f) => ({
                    ...f,
                    role: e.target.value === "COORDINATOR" ? "COORDINATOR" : "ENGINEER",
                  }))
                }
              >
                <option value="ENGINEER">{lang === "ar" ? "مهندس موقع" : "Site engineer"}</option>
                <option value="COORDINATOR">{lang === "ar" ? "منسق (يدفع للمصاريق)" : "Coordinator (pays expenses)"}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{lang === "ar" ? "رمز الدخول" : "Passcode"}</label>
              <input
                className={inputClass}
                type="password"
                required
                minLength={4}
                value={engForm.passcode}
                onChange={(e) => setEngForm((f) => ({ ...f, passcode: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>{lang === "ar" ? "المشاريع" : "Projects"}</label>
              <div className="max-h-36 overflow-auto rounded-xl border border-line p-2 space-y-1">
                {projects.filter((p) => p.active).map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-green"
                      checked={engForm.projectIds.includes(p.id)}
                      onChange={() =>
                        setEngForm((f) => ({ ...f, projectIds: toggleId(f.projectIds, p.id) }))
                      }
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" disabled={busy} className="h-11 px-4 rounded-xl bg-green text-white text-sm font-bold">
              {t.admin.siteWorkSave}
            </button>
          </form>
          <div className="space-y-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await api.ensureSiteCoordinators();
                  showSuccess(
                    lang === "ar"
                      ? `تم تجهيز المنسقين: ${res.coordinators.map((c) => c.name).join(" · ")} — ${res.assignments.length} مشروع`
                      : `Coordinators ready: ${res.coordinators.map((c) => c.name).join(" · ")} — ${res.assignments.length} projects`
                  );
                  await loadAll();
                } catch (err) {
                  showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full h-10 rounded-xl border border-gold text-sm font-bold text-ink"
            >
              {lang === "ar" ? "تأكيد أحمد ومحمد كمنسقين + توزيع المشاريع" : "Ensure Ahmad & Mohammed coordinators + split projects"}
            </button>
            {engineers.map((eng) => (
              <div key={eng.id} className="bg-white rounded-2xl border border-line p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-bold">{eng.name}</div>
                  {eng.role === "COORDINATOR" || eng.isCoordinator ? (
                    <span className="text-[10px] font-bold rounded-full bg-gold/20 text-ink px-2 py-0.5">
                      {lang === "ar" ? "منسق" : "Coordinator"}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold rounded-full bg-surface-2 text-ink-soft px-2 py-0.5">
                      {lang === "ar" ? "مهندس" : "Engineer"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-ink-soft">{eng.email}</div>
                <div className="text-xs text-ink-soft mt-1">
                  {(eng.coordinatedProjects && eng.coordinatedProjects.length
                    ? eng.coordinatedProjects
                    : eng.projects
                  )
                    .map((p) => p.name)
                    .join(" · ") || (lang === "ar" ? "بلا مشاريع" : "No projects")}
                </div>
              </div>
            ))}
            {engineers.length === 0 && (
              <EmptyState
                title={
                  lang === "ar"
                    ? "اضغط تأكيد أحمد ومحمد أعلاه أو أضف منسقاً"
                    : "Use ensure coordinators above, or add one"
                }
              />
            )}
          </div>
        </div>
      )}

      {selected ? (
        <SiteExcelViewer
          open={excelOpen}
          onClose={() => setExcelOpen(false)}
          title={selected.name}
          lang={lang === "ar" ? "ar" : "en"}
          loadPreview={(sheet) => api.siteProjectExcelPreviewAdmin(selected.id, sheet)}
          onDownload={async () => {
            const blob = await api.downloadSiteProjectExcel(selected.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = selected.excelFilename || `عمال مشروع ${selected.name}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        />
      ) : null}

      {panel === "workers" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <form onSubmit={createWorker} className="bg-white rounded-2xl border border-line p-4 space-y-3">
            <h2 className="font-bold text-green">{t.admin.siteWorkNewWorker}</h2>
            <div>
              <label className={labelClass}>{t.admin.siteWorkName}</label>
              <input
                className={inputClass}
                required
                value={workerForm.name}
                onChange={(e) => setWorkerForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>{t.admin.siteWorkEmployeeCode}</label>
              <input
                className={inputClass}
                value={workerForm.employeeCode}
                onChange={(e) => setWorkerForm((f) => ({ ...f, employeeCode: e.target.value }))}
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
                  value={workerForm.dailyPay}
                  onChange={(e) => setWorkerForm((f) => ({ ...f, dailyPay: e.target.value }))}
                  placeholder="0"
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
                  value={workerForm.extraHourPay}
                  onChange={(e) => setWorkerForm((f) => ({ ...f, extraHourPay: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>
                {lang === "ar" ? "تعيين لمشاريع" : "Assign to projects"}
              </label>
              <div className="max-h-32 overflow-auto rounded-xl border border-line p-2 space-y-1">
                {projects.filter((p) => p.active).map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-green"
                      checked={workerForm.projectIds.includes(p.id)}
                      onChange={() =>
                        setWorkerForm((f) => ({ ...f, projectIds: toggleId(f.projectIds, p.id) }))
                      }
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>{t.admin.siteWorkNotes}</label>
              <textarea
                className={`${inputClass} h-20 py-2`}
                value={workerForm.notes}
                onChange={(e) => setWorkerForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <button type="submit" disabled={busy} className="h-11 px-4 rounded-xl bg-green text-white text-sm font-bold">
              {t.admin.siteWorkSave}
            </button>
          </form>
          <div className="space-y-2 max-h-[70vh] overflow-auto">
            <input
              className={inputClass}
              placeholder={lang === "ar" ? "بحث عامل…" : "Search workers…"}
              value={workerSearch}
              onChange={(e) => setWorkerSearch(e.target.value)}
            />
            {filteredWorkers.map((w) => (
              <div key={w.id} className="bg-white rounded-2xl border border-line p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/admin/site-work/workers/${w.id}`} className="font-bold text-sm text-green hover:underline">
                      {w.name}{" "}
                      {w.employeeCode ? <span className="text-ink-soft">#{w.employeeCode}</span> : null}
                      {!w.active ? (
                        <span className="ms-2 text-[10px] text-ink-soft">{t.admin.siteWorkInactive}</span>
                      ) : null}
                    </Link>
                    <div className="text-[11px] text-ink-soft mt-0.5">
                      {w.projects.map((p) => p.name).join(" · ") || (lang === "ar" ? "بدون مشروع" : "No project")}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-[11px] font-bold text-green"
                    onClick={() => {
                      setEditingWorkerId(editingWorkerId === w.id ? null : w.id);
                      setEditRates({
                        dailyPay: String(Number(w.dailyPay) || 0),
                        extraHourPay: String(Number(w.extraHourPay) || 0),
                      });
                    }}
                  >
                    {lang === "ar" ? "تعديل الأجر" : "Edit pay"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span>
                    {t.admin.siteWorkDailyPay}: <strong>{formatMoney(w.dailyPay)}</strong>
                  </span>
                  <span>
                    {t.admin.siteWorkExtraHourPay}: <strong>{formatMoney(w.extraHourPay)}</strong>
                  </span>
                  <span className="text-green">
                    {t.admin.siteWorkOwed}: <strong>{formatMoney(w.owedAmount)}</strong>
                  </span>
                </div>
                {editingWorkerId === w.id ? (
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 pt-1">
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="0.001"
                      value={editRates.dailyPay}
                      onChange={(e) => setEditRates((f) => ({ ...f, dailyPay: e.target.value }))}
                    />
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="0.001"
                      value={editRates.extraHourPay}
                      onChange={(e) => setEditRates((f) => ({ ...f, extraHourPay: e.target.value }))}
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => saveWorkerRates(w.id)}
                      className="h-11 px-3 rounded-xl bg-green text-white text-xs font-bold"
                    >
                      {t.admin.siteWorkSave}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

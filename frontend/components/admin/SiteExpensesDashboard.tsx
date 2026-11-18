"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { useToast } from "./Toast";
import { EmptyState, SkeletonBlock, Spinner } from "./EmptyState";
import type {
  SiteExpense,
  SiteExpenseCategory,
  SiteExpenseOverview,
  SiteExpenseOverviewGroup,
  SiteExpenseSummary,
  SiteProject,
} from "@/lib/types";
import { todayLocalISO } from "@/lib/siteDates";
import { AR_MONTH_NAMES, monthLabel, monthRange, shiftMonth } from "@/components/site/expenseUi";

/** Validated 2-series palette (light surface): project vs company. */
const C_PROJECT = "#00826a";
const C_COMPANY = "#b7741a";

type Tab = "coordinators" | "expenses" | "split";
type Preset = "month" | "last" | "year" | "all" | "custom";

function money(v: string | number | null | undefined, decimals = 0) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

const inputClass =
  "h-10 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";

export function SiteExpensesDashboard() {
  const { lang } = useLanguage();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const { showSuccess, showError } = useToast();
  const today = todayLocalISO();

  const [tab, setTab] = useState<Tab>("coordinators");
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(monthRange(today.slice(0, 7)).from);
  const [to, setTo] = useState(monthRange(today.slice(0, 7)).to);

  const [overview, setOverview] = useState<SiteExpenseOverview | null>(null);
  const [loading, setLoading] = useState(true);

  // Expenses list state
  const [filters, setFilters] = useState({
    scope: "",
    coordinatorId: "",
    projectId: "",
    category: "",
    engineerId: "",
    q: "",
  });
  const [items, setItems] = useState<SiteExpense[]>([]);
  const [summary, setSummary] = useState<SiteExpenseSummary | null>(null);
  const [categories, setCategories] = useState<SiteExpenseCategory[]>([]);
  const [payMethods, setPayMethods] = useState<Array<{ key: string; ar: string; en: string }>>([]);
  const [listLoading, setListLoading] = useState(false);
  const [editing, setEditing] = useState<SiteExpense | null>(null);
  const [creating, setCreating] = useState(false);

  // Split state
  const [projects, setProjects] = useState<SiteProject[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function applyPreset(p: Preset) {
    setPreset(p);
    const ym = today.slice(0, 7);
    if (p === "month") {
      const r = monthRange(ym);
      setFrom(r.from);
      setTo(r.to);
    } else if (p === "last") {
      const r = monthRange(shiftMonth(ym, -1));
      setFrom(r.from);
      setTo(r.to);
    } else if (p === "year") {
      setFrom(`${ym.slice(0, 4)}-01-01`);
      setTo(`${ym.slice(0, 4)}-12-31`);
    } else if (p === "all") {
      setFrom("");
      setTo("");
    }
  }

  const range = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await api.siteExpenseOverview(range));
    } catch (err) {
      showError(err instanceof ApiError ? err.message : L("تعذّر التحميل", "Failed to load"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const listParams = useMemo(
    () => ({
      ...range,
      scope: filters.scope || undefined,
      coordinatorId: filters.coordinatorId || undefined,
      projectId: filters.projectId || undefined,
      category: filters.category || undefined,
      engineerId: filters.engineerId || undefined,
      q: filters.q.trim() || undefined,
    }),
    [range, filters]
  );

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await api.siteExpensesAdmin(listParams);
      setItems(res.items);
      setSummary(res.summary);
      setCategories(res.categories);
      setPayMethods(res.paymentMethods);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : L("تعذّر التحميل", "Failed to load"));
    } finally {
      setListLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listParams]);

  const loadProjects = useCallback(async () => {
    try {
      setProjects(await api.siteProjects());
    } catch {
      /* shown elsewhere */
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (tab !== "expenses") return;
    const t = setTimeout(loadList, filters.q ? 300 : 0);
    return () => clearTimeout(t);
  }, [tab, loadList, filters.q]);

  useEffect(() => {
    if (tab === "split" || tab === "coordinators" || creating) loadProjects();
  }, [tab, loadProjects, creating]);

  useEffect(() => {
    if (!creating) return;
    if (categories.length && payMethods.length) return;
    void api
      .siteExpensesAdmin({ ...range })
      .then((res) => {
        setCategories(res.categories);
        setPayMethods(res.paymentMethods);
      })
      .catch(() => undefined);
  }, [creating, categories.length, payMethods.length, range]);

  function openProjectExpenses(projectId: string) {
    setFilters((f) => ({ ...f, projectId, coordinatorId: "", scope: "" }));
    setTab("expenses");
  }
  function openCoordinatorExpenses(coordinatorId: string) {
    setFilters((f) => ({ ...f, coordinatorId, projectId: "", scope: "" }));
    setTab("expenses");
  }

  async function exportExcel() {
    try {
      const blob = await api.downloadSiteExpensesExcel(tab === "expenses" ? listParams : range);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `مصاريف-${today}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : L("تعذّر التصدير", "Export failed"));
    }
  }

  async function assign(coordinatorId: string | null, projectIds: string[]) {
    if (!projectIds.length) return;
    setBusy(true);
    try {
      await api.assignSiteCoordinator(coordinatorId, projectIds);
      showSuccess(L(`تم تحديث ${projectIds.length} مشروع`, `Updated ${projectIds.length} project(s)`));
      setSelectedProjects([]);
      await Promise.all([loadProjects(), loadOverview()]);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : L("تعذّر الحفظ", "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  async function saveBudget(p: SiteProject, raw: string) {
    const next = raw.trim() === "" ? null : Number(raw);
    const current = p.budget != null ? Number(p.budget) : null;
    if (next === current || (next != null && !Number.isFinite(next))) return;
    try {
      await api.updateSiteProject(p.id, { budget: next });
      showSuccess(L("تم حفظ الميزانية", "Budget saved"));
      await Promise.all([loadProjects(), loadOverview()]);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : L("تعذّر الحفظ", "Save failed"));
    }
  }

  async function removeExpense(e: SiteExpense) {
    if (!window.confirm(L(`حذف مصروف ${money(e.amount, 3)} د.أ؟`, `Delete expense ${money(e.amount, 3)} JOD?`))) return;
    try {
      await api.deleteSiteExpenseAdmin(e.id);
      showSuccess(L("تم الحذف", "Deleted"));
      await Promise.all([loadList(), loadOverview()]);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : L("تعذّر الحذف", "Delete failed"));
    }
  }

  const engineers = overview?.engineers || [];
  const coordinators = overview?.coordinators || [];
  const activeProjects = projects.filter((p) => p.active);
  const allOverviewProjects = useMemo(
    () => [
      ...(overview?.coordinators.flatMap((c) => c.projects) || []),
      ...(overview?.unassigned.projects || []),
    ],
    [overview]
  );

  const rangeLabel =
    preset === "month"
      ? monthLabel(today.slice(0, 7))
      : preset === "last"
        ? monthLabel(shiftMonth(today.slice(0, 7), -1))
        : preset === "year"
          ? today.slice(0, 4)
          : preset === "all"
            ? L("كل الفترات", "All time")
            : `${from || "…"} → ${to || "…"}`;

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/admin/site-work" className="text-xs font-bold text-green">
            {L("→ حضور الموقع", "← Site work")}
          </Link>
          <h1 className="text-2xl font-bold text-ink mt-1">{L("المصاريف والمنسقون", "Expenses & coordinators")}</h1>
          <p className="text-sm text-ink-soft mt-1">
            {L(
              "كل مصاريف المشاريع والشركة وأجور العمال — مقسّمة حسب المنسق المسؤول.",
              "All project & company expenses plus labor — split by responsible coordinator."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="h-10 px-4 rounded-xl bg-ink text-white text-sm font-bold"
          >
            {L("+ مصروف شركة / مشروع", "+ Company / project expense")}
          </button>
          <button type="button" onClick={exportExcel} className="h-10 px-4 rounded-xl bg-green text-white text-sm font-bold">
            {L("تصدير Excel", "Export Excel")}
          </button>
        </div>
      </header>

      {/* Range filter row */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-2xl border border-line p-2">
        {(
          [
            ["month", L("هذا الشهر", "This month")],
            ["last", L("الشهر الماضي", "Last month")],
            ["year", L("هذه السنة", "This year")],
            ["all", L("الكل", "All")],
            ["custom", L("مخصص", "Custom")],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => applyPreset(k)}
            className={`h-9 px-3 rounded-lg text-sm font-bold ${preset === k ? "bg-ink text-white" : "text-ink hover:bg-surface-2"}`}
          >
            {l}
          </button>
        ))}
        {preset === "custom" ? (
          <div className="flex items-center gap-2">
            <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-ink-soft">→</span>
            <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        ) : null}
        <span className="ms-auto text-xs font-bold text-ink-soft px-2">{rangeLabel}</span>
      </div>

      {/* KPI tiles */}
      {loading && !overview ? (
        <SkeletonBlock className="h-28 w-full" />
      ) : overview ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="col-span-2 lg:col-span-1 rounded-2xl bg-green text-white p-4">
            <div className="text-xs font-bold text-white/70">{L("إجمالي التكلفة", "Total cost")}</div>
            <div className="text-3xl font-bold mt-1">{money(overview.totals.grand)}</div>
            <div className="text-[11px] text-white/70 mt-1">{L("د.أ · مصاريف + أجور", "JOD · expenses + labor")}</div>
          </div>
          <Kpi label={L("مصاريف المشاريع", "Project expenses")} value={overview.totals.projectExpenses} swatch={C_PROJECT} />
          <Kpi label={L("مصاريف الشركة", "Company expenses")} value={overview.totals.companyExpenses} swatch={C_COMPANY} />
          <Kpi
            label={L("أجور العمال", "Labor")}
            value={overview.totals.labor}
            note={
              Number(overview.totals.laborUnpaid) > 0
                ? L(`غير مدفوع: ${money(overview.totals.laborUnpaid)}`, `Unpaid: ${money(overview.totals.laborUnpaid)}`)
                : L("كله مدفوع", "All paid")
            }
          />
          <Kpi label={L("عدد الإدخالات", "Entries")} value={String(overview.totals.expenseCount)} raw />
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-line">
        {(
          [
            ["coordinators", L("حسب المنسق", "By coordinator")],
            ["expenses", L("كل المصاريف", "All expenses")],
            ["split", L("توزيع المشاريع والميزانيات", "Assign projects & budgets")],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`h-11 px-4 text-sm font-bold border-b-2 -mb-px ${
              tab === k ? "border-green text-green" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* ── Coordinators ── */}
      {tab === "coordinators" && overview ? (
        <div className="space-y-5">
          {coordinators.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gold bg-gold/10 p-5 text-sm">
              <div className="font-bold text-ink">{L("لم يتم تحديد منسقين بعد", "No coordinators assigned yet")}</div>
              <p className="text-ink-soft mt-1">
                {L(
                  "افتح «توزيع المشاريع والميزانيات» واختر لكل مشروع منسقه (مثلاً م. أحمد أو م. محمد). إذا لم يكن لديهم حساب، أضفهم من تبويب المهندسين في حضور الموقع.",
                  "Open “Assign projects & budgets” and pick each project's coordinator. Create engineer accounts first from Site work → Engineers if needed."
                )}
              </p>
              <button type="button" onClick={() => setTab("split")} className="mt-3 h-9 px-4 rounded-xl bg-green text-white text-sm font-bold">
                {L("توزيع المشاريع الآن", "Assign projects now")}
              </button>
            </div>
          ) : (
            <div className={`grid gap-4 ${coordinators.length > 1 ? "xl:grid-cols-2" : ""}`}>
              {coordinators.map((c) => (
                <CoordinatorCard
                  key={c.id}
                  title={`${L("م.", "Eng.")} ${c.name}`}
                  group={c}
                  L={L}
                  onProject={openProjectExpenses}
                  onAll={() => openCoordinatorExpenses(c.id)}
                />
              ))}
            </div>
          )}

          {overview.unassigned.projectCount > 0 ? (
            <CoordinatorCard
              title={L("مشاريع بلا منسق", "Projects without coordinator")}
              warn
              group={overview.unassigned}
              L={L}
              onProject={openProjectExpenses}
              onAll={() => setTab("split")}
              allLabel={L("تعيين منسق ←", "Assign coordinator →")}
            />
          ) : null}

          <div className="grid lg:grid-cols-2 gap-4">
            <MonthlyChart months={overview.months} L={L} />
            <CategoryBars rows={overview.byCategory} L={L} />
          </div>

          <div className="bg-white rounded-2xl border border-line p-4">
            <h3 className="font-bold text-ink mb-3">{L("حسب من أدخل المصروف", "By engineer who entered")}</h3>
            {overview.byEngineer.length === 0 ? (
              <p className="text-sm text-ink-soft">{L("لا مصاريف في هذه الفترة", "No expenses in range")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="text-start text-xs text-ink-soft border-b border-line">
                      <th className="py-2 text-start font-bold">{L("المهندس", "Engineer")}</th>
                      <th className="py-2 text-start font-bold">{L("مشاريع", "Projects")}</th>
                      <th className="py-2 text-start font-bold">{L("شركة", "Company")}</th>
                      <th className="py-2 text-start font-bold">{L("الإجمالي", "Total")}</th>
                      <th className="py-2 text-start font-bold">{L("إدخالات", "Entries")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.byEngineer.map((e) => (
                      <tr key={e.id} className="border-b border-line last:border-0">
                        <td className="py-2.5">
                          <button
                            type="button"
                            className="font-bold text-green hover:underline"
                            onClick={() => {
                              setFilters((f) => ({ ...f, engineerId: e.id, projectId: "", coordinatorId: "" }));
                              setTab("expenses");
                            }}
                          >
                            {e.name}
                          </button>
                          {e.isCoordinator ? (
                            <span className="ms-2 text-[10px] font-bold rounded-full bg-gold/20 px-2 py-0.5">{L("منسق", "Coordinator")}</span>
                          ) : null}
                        </td>
                        <td className="py-2.5 tabular-nums">{money(e.projectExpenses)}</td>
                        <td className="py-2.5 tabular-nums">{money(e.companyExpenses)}</td>
                        <td className="py-2.5 font-bold tabular-nums">{money(e.total)}</td>
                        <td className="py-2.5 tabular-nums">{e.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ── All expenses ── */}
      {tab === "expenses" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 bg-white rounded-2xl border border-line p-3">
            <select className={inputClass} value={filters.scope} onChange={(e) => setFilters((f) => ({ ...f, scope: e.target.value }))}>
              <option value="">{L("مشاريع + شركة", "Project + company")}</option>
              <option value="PROJECT">{L("مصاريف المشاريع", "Project only")}</option>
              <option value="COMPANY">{L("مصاريف الشركة", "Company only")}</option>
            </select>
            <select
              className={inputClass}
              value={filters.coordinatorId}
              onChange={(e) => setFilters((f) => ({ ...f, coordinatorId: e.target.value, projectId: "" }))}
            >
              <option value="">{L("كل المنسقين", "All coordinators")}</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="none">{L("بلا منسق", "No coordinator")}</option>
            </select>
            <select className={inputClass} value={filters.projectId} onChange={(e) => setFilters((f) => ({ ...f, projectId: e.target.value }))}>
              <option value="">{L("كل المشاريع", "All projects")}</option>
              {allOverviewProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select className={inputClass} value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
              <option value="">{L("كل التصنيفات", "All categories")}</option>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {lang === "ar" ? c.ar : c.en}
                </option>
              ))}
            </select>
            <select className={inputClass} value={filters.engineerId} onChange={(e) => setFilters((f) => ({ ...f, engineerId: e.target.value }))}>
              <option value="">{L("كل المهندسين", "All engineers")}</option>
              {engineers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <input
              className={`${inputClass} flex-1 min-w-[180px]`}
              placeholder={L("بحث: وصف، مورّد، فاتورة…", "Search: description, vendor, invoice…")}
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
            {Object.values(filters).some(Boolean) ? (
              <button
                type="button"
                className="h-10 px-3 rounded-xl text-sm font-bold text-ink-soft hover:text-ink"
                onClick={() => setFilters({ scope: "", coordinatorId: "", projectId: "", category: "", engineerId: "", q: "" })}
              >
                {L("مسح الفلاتر", "Clear")}
              </button>
            ) : null}
          </div>

          {summary ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1 px-1 text-sm">
              <span>
                <b className="tabular-nums">{money(summary.total, 3)}</b> {L("د.أ إجمالي", "JOD total")}
              </span>
              <span className="text-ink-soft">
                <i className="inline-block w-2.5 h-2.5 rounded-sm me-1 align-middle" style={{ background: C_PROJECT }} />
                {L("مشاريع", "Projects")} {money(summary.projectTotal, 3)}
              </span>
              <span className="text-ink-soft">
                <i className="inline-block w-2.5 h-2.5 rounded-sm me-1 align-middle" style={{ background: C_COMPANY }} />
                {L("شركة", "Company")} {money(summary.companyTotal, 3)}
              </span>
              <span className="text-ink-soft">
                {summary.count} {L("إدخال", "entries")}
              </span>
            </div>
          ) : null}

          <div className="bg-white rounded-2xl border border-line overflow-hidden">
            {listLoading && items.length === 0 ? (
              <div className="p-6 flex justify-center">
                <Spinner className="w-5 h-5" />
              </div>
            ) : items.length === 0 ? (
              <EmptyState title={L("لا مصاريف مطابقة", "No matching expenses")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[980px]">
                  <thead className="bg-surface-2">
                    <tr className="text-xs text-ink-soft">
                      <th className="py-2.5 px-3 text-start font-bold">{L("التاريخ", "Date")}</th>
                      <th className="py-2.5 px-3 text-start font-bold">{L("المشروع / الشركة", "Project / company")}</th>
                      <th className="py-2.5 px-3 text-start font-bold">{L("التصنيف", "Category")}</th>
                      <th className="py-2.5 px-3 text-start font-bold">{L("الوصف", "Description")}</th>
                      <th className="py-2.5 px-3 text-start font-bold">{L("المورّد / الدفع", "Vendor / payment")}</th>
                      <th className="py-2.5 px-3 text-start font-bold">{L("أدخله", "By")}</th>
                      <th className="py-2.5 px-3 text-end font-bold">{L("المبلغ", "Amount")}</th>
                      <th className="py-2.5 px-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((e) => (
                      <tr key={e.id} className="border-t border-line align-top hover:bg-surface-2/60">
                        <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">{e.expenseDate}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className="inline-block w-2 h-2 rounded-full me-1.5 align-middle"
                            style={{ background: e.scope === "COMPANY" ? C_COMPANY : C_PROJECT }}
                          />
                          {e.scope === "COMPANY" ? (
                            <span className="font-bold">{L("الشركة", "Company")}</span>
                          ) : (
                            <button type="button" className="font-bold text-green hover:underline" onClick={() => e.projectId && setFilters((f) => ({ ...f, projectId: e.projectId! }))}>
                              {e.project?.name}
                            </button>
                          )}
                          {e.project?.coordinator ? (
                            <div className="text-[11px] text-ink-soft">{L("المنسق", "Coord.")}: {e.project.coordinator.name}</div>
                          ) : null}
                        </td>
                        <td className="py-2.5 px-3">{e.categoryLabel}</td>
                        <td className="py-2.5 px-3 max-w-[260px]">
                          <div>{e.description}</div>
                          {e.notes ? <div className="text-[11px] text-ink-soft mt-0.5">{e.notes}</div> : null}
                        </td>
                        <td className="py-2.5 px-3 text-xs">
                          <div>{e.vendor || "—"}</div>
                          <div className="text-ink-soft">
                            {e.paymentLabel}
                            {e.invoiceNo ? ` · #${e.invoiceNo}` : ""}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-xs">{e.engineer.name}</td>
                        <td className="py-2.5 px-3 text-end font-bold tabular-nums whitespace-nowrap">{money(e.amount, 3)}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-xs">
                          {e.hasReceipt ? (
                            <a href={api.siteExpenseReceiptUrlAdmin(e.id)} target="_blank" rel="noreferrer" className="font-bold text-green me-3">
                              {L("الإيصال", "Receipt")}
                            </a>
                          ) : null}
                          <button type="button" className="font-bold text-ink me-3" onClick={() => setEditing(e)}>
                            {L("تعديل", "Edit")}
                          </button>
                          <button type="button" className="font-bold text-red-700" onClick={() => removeExpense(e)}>
                            {L("حذف", "Delete")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Split projects ── */}
      {tab === "split" ? (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white border border-line p-4 text-sm text-ink-soft">
            {L(
              "اختر المنسق المسؤول لكل مشروع. المنسق يُضاف تلقائياً لمهندسي المشروع ويرى مصاريفه في بوابته. يمكنك تحديد عدة مشاريع ونقلها دفعة واحدة.",
              "Pick the responsible coordinator per project. They're auto-added to the project and see its expenses in their portal. Select several to move them at once."
            )}
          </div>

          {selectedProjects.length > 0 ? (
            <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl bg-ink text-white p-3">
              <span className="text-sm font-bold me-2">
                {selectedProjects.length} {L("محدد — نقل إلى:", "selected — move to:")}
              </span>
              {(engineers as Array<{
                id: string;
                name: string;
                active: boolean;
                role?: string;
                isCoordinator?: boolean;
              }>)
                .filter((e) => e.active)
                .sort(
                  (a, b) =>
                    Number(Boolean(b.isCoordinator || b.role === "COORDINATOR")) -
                    Number(Boolean(a.isCoordinator || a.role === "COORDINATOR"))
                )
                .map((e) => (
                <button
                  key={e.id}
                  type="button"
                  disabled={busy}
                  onClick={() => assign(e.id, selectedProjects)}
                  className="h-9 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-bold"
                >
                  {e.name}
                  {e.role === "COORDINATOR" || e.isCoordinator ? ` · ${L("منسق", "Coord.")}` : ""}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => assign(null, selectedProjects)}
                className="h-9 px-3 rounded-lg bg-white/5 text-sm font-bold text-white/70"
              >
                {L("بلا منسق", "None")}
              </button>
              <button type="button" onClick={() => setSelectedProjects([])} className="ms-auto text-xs font-bold text-white/70">
                {L("إلغاء", "Cancel")}
              </button>
            </div>
          ) : null}

          {engineers.length === 0 ? (
            <EmptyState
              title={L("لا يوجد مهندسون", "No engineers")}
              note={L("أضف م. أحمد و م. محمد من حضور الموقع ← المهندسون.", "Add engineers from Site work → Engineers.")}
            />
          ) : null}

          <div className="bg-white rounded-2xl border border-line overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-surface-2">
                <tr className="text-xs text-ink-soft">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      className="accent-green"
                      checked={activeProjects.length > 0 && selectedProjects.length === activeProjects.length}
                      onChange={(e) => setSelectedProjects(e.target.checked ? activeProjects.map((p) => p.id) : [])}
                      aria-label={L("تحديد الكل", "Select all")}
                    />
                  </th>
                  <th className="py-2.5 px-3 text-start font-bold">{L("المشروع", "Project")}</th>
                  <th className="py-2.5 px-3 text-start font-bold">{L("المنسق", "Coordinator")}</th>
                  <th className="py-2.5 px-3 text-start font-bold">{L("الميزانية (د.أ)", "Budget (JOD)")}</th>
                  <th className="py-2.5 px-3 text-end font-bold">{L("التكلفة حتى الآن", "Cost so far")}</th>
                </tr>
              </thead>
              <tbody>
                {activeProjects.map((p) => {
                  const ov = allOverviewProjects.find((x) => x.id === p.id);
                  return (
                    <tr key={p.id} className="border-t border-line">
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          className="accent-green"
                          checked={selectedProjects.includes(p.id)}
                          onChange={() =>
                            setSelectedProjects((list) => (list.includes(p.id) ? list.filter((x) => x !== p.id) : [...list, p.id]))
                          }
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Link href={`/admin/site-work/projects/${p.id}`} className="font-bold text-green hover:underline">
                          {p.name}
                        </Link>
                        {p.code ? <span className="text-xs text-ink-soft ms-2">{p.code}</span> : null}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {engineers.map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              disabled={busy}
                              onClick={() => p.coordinatorId !== e.id && assign(e.id, [p.id])}
                              className={`h-8 px-3 rounded-full text-xs font-bold border transition ${
                                p.coordinatorId === e.id
                                  ? "bg-green text-white border-green"
                                  : "bg-white text-ink border-line hover:border-green"
                              }`}
                            >
                              {e.name}
                            </button>
                          ))}
                          {p.coordinatorId && !engineers.some((e) => e.id === p.coordinatorId) ? (
                            <span className="h-8 px-3 inline-flex items-center rounded-full text-xs font-bold bg-gold/20 text-ink">
                              {p.coordinator?.name} {L("(حساب معطّل)", "(inactive)")}
                            </span>
                          ) : null}
                          {!p.coordinatorId ? (
                            <span className="h-8 px-2 inline-flex items-center text-[11px] font-bold text-gold">{L("⚠ بلا منسق", "⚠ none")}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          key={`${p.id}-${p.budget ?? ""}`}
                          type="number"
                          min="0"
                          step="100"
                          inputMode="decimal"
                          placeholder="—"
                          defaultValue={p.budget != null ? Number(p.budget) : ""}
                          onBlur={(e) => saveBudget(p, e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          className={`${inputClass} w-36 tabular-nums`}
                        />
                      </td>
                      <td className="py-2 px-3 text-end tabular-nums font-bold">{ov ? money(ov.total) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {editing ? (
        <EditExpenseModal
          expense={editing}
          categories={categories}
          payMethods={payMethods}
          projects={
            projects.length
              ? projects.map((p) => ({ id: p.id, name: p.name }))
              : allOverviewProjects.map((p) => ({ id: p.id, name: p.name }))
          }
          lang={lang}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            showSuccess(L("تم الحفظ", "Saved"));
            await Promise.all([loadList(), loadOverview()]);
          }}
          onError={(m) => showError(m)}
        />
      ) : null}

      {creating ? (
        <CreateExpenseModal
          categories={categories}
          payMethods={payMethods}
          projects={
            projects.length
              ? projects.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }))
              : allOverviewProjects.map((p) => ({ id: p.id, name: p.name }))
          }
          engineers={engineers}
          lang={lang}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            showSuccess(L("تم تسجيل المصروف", "Expense recorded"));
            await Promise.all([loadOverview(), tab === "expenses" ? loadList() : Promise.resolve()]);
          }}
          onError={(m) => showError(m)}
        />
      ) : null}
    </div>
  );
}

function Kpi({ label, value, note, swatch, raw }: { label: string; value: string; note?: string; swatch?: string; raw?: boolean }) {
  return (
    <div className="rounded-2xl bg-white border border-line p-4">
      <div className="text-xs font-bold text-ink-soft flex items-center gap-1.5">
        {swatch ? <i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: swatch }} /> : null}
        {label}
      </div>
      <div className="text-2xl font-bold text-ink mt-1 tabular-nums">{raw ? value : money(value)}</div>
      {note ? <div className="text-[11px] text-ink-soft mt-1">{note}</div> : null}
    </div>
  );
}

function CoordinatorCard({
  title,
  group,
  L,
  onProject,
  onAll,
  warn,
  allLabel,
}: {
  title: string;
  group: SiteExpenseOverviewGroup;
  L: (ar: string, en: string) => string;
  onProject: (id: string) => void;
  onAll: () => void;
  warn?: boolean;
  allLabel?: string;
}) {
  return (
    <section className={`bg-white rounded-2xl border overflow-hidden ${warn ? "border-gold" : "border-line"}`}>
      <div className={`px-4 py-3 flex flex-wrap items-center justify-between gap-2 ${warn ? "bg-gold/10" : "bg-surface-2"}`}>
        <div>
          <h2 className="font-bold text-ink text-lg">{title}</h2>
          <div className="text-xs text-ink-soft">
            {group.projectCount} {L("مشروع", "projects")}
          </div>
        </div>
        <div className="text-end">
          <div className="text-[11px] font-bold text-ink-soft">{L("الإجمالي", "Total")}</div>
          <div className="text-2xl font-bold text-ink tabular-nums">{money(group.total)}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 border-b border-line text-center">
        <div className="py-2.5 border-e border-line">
          <div className="text-[11px] text-ink-soft">{L("مصاريف المشاريع", "Project exp.")}</div>
          <div className="font-bold tabular-nums">{money(group.projectExpenses)}</div>
        </div>
        <div className="py-2.5 border-e border-line">
          <div className="text-[11px] text-ink-soft">{L("أجور العمال", "Labor")}</div>
          <div className="font-bold tabular-nums">{money(group.labor)}</div>
          {Number(group.laborUnpaid) > 0 ? (
            <div className="text-[10px] text-ink-soft">
              {L("غير مدفوع", "unpaid")} {money(group.laborUnpaid)}
            </div>
          ) : null}
        </div>
        <div className="py-2.5">
          <div className="text-[11px] text-ink-soft">{L("مصاريف شركة أدخلها", "Company exp. entered")}</div>
          <div className="font-bold tabular-nums">{warn ? "—" : money(group.companyExpenses)}</div>
        </div>
      </div>
      {group.projects.length === 0 ? (
        <p className="p-4 text-sm text-ink-soft">{L("لا مشاريع", "No projects")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-xs text-ink-soft">
                <th className="py-2 px-4 text-start font-bold">{L("المشروع", "Project")}</th>
                <th className="py-2 px-2 text-end font-bold">{L("مصاريف", "Expenses")}</th>
                <th className="py-2 px-2 text-end font-bold">{L("أجور", "Labor")}</th>
                <th className="py-2 px-2 text-end font-bold">{L("الإجمالي", "Total")}</th>
                <th className="py-2 px-4 text-start font-bold w-36">{L("الميزانية", "Budget")}</th>
              </tr>
            </thead>
            <tbody>
              {group.projects.map((p) => (
                <tr key={p.id} className="border-t border-line hover:bg-surface-2/60">
                  <td className="py-2.5 px-4">
                    <button type="button" onClick={() => onProject(p.id)} className="font-bold text-green hover:underline text-start">
                      {p.name}
                    </button>
                    <div className="text-[11px] text-ink-soft">
                      {p.expenseCount} {L("إدخال", "entries")}
                      {p.lastExpenseDate ? ` · ${L("آخر", "last")} ${p.lastExpenseDate}` : ""}
                      {!p.active ? ` · ${L("مؤرشف", "archived")}` : ""}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-end tabular-nums">{money(p.expenses)}</td>
                  <td className="py-2.5 px-2 text-end tabular-nums">{money(p.labor)}</td>
                  <td className="py-2.5 px-2 text-end tabular-nums font-bold">{money(p.total)}</td>
                  <td className="py-2.5 px-4">
                    {p.budgetUsedPct != null ? (
                      <div title={`${money(p.total)} / ${money(p.budget)}`}>
                        <div className="flex justify-between text-[10px] font-bold text-ink-soft mb-1">
                          <span>{money(p.budget)}</span>
                          <span className={p.budgetUsedPct > 100 ? "text-red-700" : ""}>
                            {p.budgetUsedPct > 100 ? "⚠ " : ""}
                            {p.budgetUsedPct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${p.budgetUsedPct > 100 ? "bg-red-600" : "bg-green"}`}
                            style={{ width: `${Math.min(100, p.budgetUsedPct)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-ink-soft">{L("بلا ميزانية", "no budget")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" onClick={onAll} className="w-full h-10 border-t border-line text-xs font-bold text-green hover:bg-surface-2">
        {allLabel || L("عرض كل مصاريفه ←", "View all expenses →")}
      </button>
    </section>
  );
}

function MonthlyChart({
  months,
  L,
}: {
  months: SiteExpenseOverview["months"];
  L: (ar: string, en: string) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...months.map((m) => Number(m.total)));
  return (
    <div className="bg-white rounded-2xl border border-line p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-ink">{L("آخر 6 أشهر", "Last 6 months")}</h3>
        <div className="flex gap-3 text-[11px] font-bold text-ink-soft">
          <span className="flex items-center gap-1">
            <i className="w-2.5 h-2.5 rounded-sm" style={{ background: C_PROJECT }} />
            {L("مشاريع", "Projects")}
          </span>
          <span className="flex items-center gap-1">
            <i className="w-2.5 h-2.5 rounded-sm" style={{ background: C_COMPANY }} />
            {L("شركة", "Company")}
          </span>
        </div>
      </div>
      <div className="relative h-44 flex items-end gap-3 border-b border-line" dir="ltr">
        {months.map((m, i) => {
          const p = Number(m.project);
          const c = Number(m.company);
          return (
            <div
              key={m.month}
              className="relative flex-1 h-full flex flex-col justify-end items-center cursor-default"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${monthLabel(m.month)}: ${money(m.total)}`}
            >
              <div className="w-full max-w-10 flex flex-col justify-end gap-[2px]" style={{ height: `${(Number(m.total) / max) * 100}%` }}>
                {c > 0 ? (
                  <div className="w-full rounded-t-[4px]" style={{ flexGrow: c, background: C_COMPANY, opacity: hover == null || hover === i ? 1 : 0.45 }} />
                ) : null}
                {p > 0 ? (
                  <div
                    className={`w-full ${c > 0 ? "" : "rounded-t-[4px]"}`}
                    style={{ flexGrow: p, background: C_PROJECT, opacity: hover == null || hover === i ? 1 : 0.45 }}
                  />
                ) : null}
              </div>
              {hover === i ? (
                <div className="absolute bottom-full mb-1 z-10 whitespace-nowrap rounded-lg bg-ink text-white text-[11px] px-2.5 py-1.5 shadow-lg" dir="rtl">
                  <div className="font-bold">{monthLabel(m.month)}</div>
                  <div>
                    {L("مشاريع", "Projects")}: {money(m.project)}
                  </div>
                  <div>
                    {L("شركة", "Company")}: {money(m.company)}
                  </div>
                  <div className="font-bold">
                    {L("المجموع", "Total")}: {money(m.total)}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-1.5" dir="ltr">
        {months.map((m) => (
          <div key={m.month} className="flex-1 text-center text-[10px] text-ink-soft truncate" dir="rtl">
            {AR_MONTH_NAMES[Number(m.month.slice(5, 7)) - 1]}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryBars({
  rows,
  L,
}: {
  rows: SiteExpenseOverview["byCategory"];
  L: (ar: string, en: string) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => Number(r.amount)));
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  return (
    <div className="bg-white rounded-2xl border border-line p-4">
      <h3 className="font-bold text-ink mb-3">{L("حسب التصنيف", "By category")}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-soft">{L("لا مصاريف في هذه الفترة", "No expenses in range")}</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.key} title={`${r.label}: ${money(r.amount, 3)}`}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-ink">{r.label}</span>
                <span className="text-ink-soft tabular-nums">
                  {money(r.amount)} · {total ? Math.round((Number(r.amount) / total) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full rounded-e-[4px] bg-green" style={{ width: `${(Number(r.amount) / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateExpenseModal({
  categories,
  payMethods,
  projects,
  engineers,
  lang,
  onClose,
  onSaved,
  onError,
}: {
  categories: SiteExpenseCategory[];
  payMethods: Array<{ key: string; ar: string; en: string }>;
  projects: Array<{ id: string; name: string }>;
  engineers: Array<{ id: string; name: string }>;
  lang: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const today = todayLocalISO();
  const companyCats = categories.filter((c) => c.scopes.includes("COMPANY"));
  const projectCats = categories.filter((c) => c.scopes.includes("PROJECT"));
  const [form, setForm] = useState({
    scope: "COMPANY" as "PROJECT" | "COMPANY",
    projectId: projects[0]?.id || "",
    category: companyCats[0]?.key || categories[0]?.key || "other",
    description: "",
    amount: "",
    expenseDate: today,
    vendor: "",
    paymentMethod: "cash",
    invoiceNo: "",
    notes: "",
    engineerId: "",
  });
  const [saving, setSaving] = useState(false);
  const cls = "w-full h-10 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";
  const lbl = "text-xs font-bold text-ink-soft mb-1 block";
  const cats = form.scope === "COMPANY" ? companyCats : projectCats;

  async function save() {
    const amount = Number(form.amount);
    if (!form.description.trim()) {
      onError(L("الوصف مطلوب", "Description required"));
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      onError(L("أدخل مبلغاً صحيحاً", "Enter a valid amount"));
      return;
    }
    if (form.scope === "PROJECT" && !form.projectId) {
      onError(L("اختر المشروع", "Pick a project"));
      return;
    }
    setSaving(true);
    try {
      await api.createSiteExpenseAdmin({
        scope: form.scope,
        projectId: form.scope === "PROJECT" ? form.projectId : null,
        category: form.category,
        description: form.description.trim(),
        amount,
        expenseDate: form.expenseDate,
        vendor: form.vendor.trim() || null,
        paymentMethod: form.paymentMethod || null,
        invoiceNo: form.invoiceNo.trim() || null,
        notes: form.notes.trim() || null,
        engineerId: form.engineerId || null,
      });
      onSaved();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : L("تعذّر الحفظ", "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-ink text-lg">{L("تسجيل مصروف", "Record expense")}</h3>
          <button type="button" onClick={onClose} className="text-ink-soft text-xl leading-none" aria-label="close">
            ×
          </button>
        </div>
        <p className="text-xs text-ink-soft">
          {L(
            "مصاريف الشركة من هنا؛ مصاريف المشاريع يمكن للمهندسين إدخالها أيضاً من بوابة الموقع.",
            "Company expenses go here; engineers can also log project expenses from the site portal."
          )}
        </p>
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface-2">
          {(
            [
              ["COMPANY", L("شركة", "Company")],
              ["PROJECT", L("مشروع", "Project")],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                const nextCats = key === "COMPANY" ? companyCats : projectCats;
                setForm((f) => ({
                  ...f,
                  scope: key,
                  category: nextCats.some((c) => c.key === f.category) ? f.category : nextCats[0]?.key || "other",
                }));
              }}
              className={`h-10 rounded-lg text-sm font-bold ${
                form.scope === key ? "bg-ink text-white" : "text-ink-soft"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {form.scope === "PROJECT" ? (
            <div className="col-span-2">
              <span className={lbl}>{L("المشروع", "Project")}</span>
              <select className={cls} value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}>
                <option value="">{L("اختر…", "Select…")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <span className={lbl}>{L("المبلغ (د.أ)", "Amount (JOD)")}</span>
            <input className={cls} type="number" step="0.001" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <span className={lbl}>{L("التاريخ", "Date")}</span>
            <input className={cls} type="date" value={form.expenseDate} onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))} />
          </div>
          <div>
            <span className={lbl}>{L("التصنيف", "Category")}</span>
            <select className={cls} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {cats.map((c) => (
                <option key={c.key} value={c.key}>
                  {lang === "ar" ? c.ar : c.en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={lbl}>{L("طريقة الدفع", "Payment")}</span>
            <select className={cls} value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
              <option value="">—</option>
              {payMethods.map((p) => (
                <option key={p.key} value={p.key}>
                  {lang === "ar" ? p.ar : p.en}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <span className={lbl}>{L("الوصف", "Description")}</span>
          <input className={cls} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={lbl}>{L("المورّد", "Vendor")}</span>
            <input className={cls} value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} />
          </div>
          <div>
            <span className={lbl}>{L("رقم الفاتورة", "Invoice #")}</span>
            <input className={cls} value={form.invoiceNo} onChange={(e) => setForm((f) => ({ ...f, invoiceNo: e.target.value }))} />
          </div>
        </div>
        {engineers.length ? (
          <div>
            <span className={lbl}>{L("نسب الإدخال لمهندس (اختياري)", "Attribute to engineer (optional)")}</span>
            <select className={cls} value={form.engineerId} onChange={(e) => setForm((f) => ({ ...f, engineerId: e.target.value }))}>
              <option value="">{L("حساب الإدارة", "Admin account")}</option>
              {engineers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <span className={lbl}>{L("ملاحظات", "Notes")}</span>
          <textarea className={`${cls} h-20 py-2`} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" disabled={saving} onClick={save} className="flex-1 h-11 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-60">
            {saving ? L("جاري الحفظ…", "Saving…") : L("حفظ", "Save")}
          </button>
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-xl border border-line text-sm font-bold">
            {L("إلغاء", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditExpenseModal({
  expense,
  categories,
  payMethods,
  projects,
  lang,
  onClose,
  onSaved,
  onError,
}: {
  expense: SiteExpense;
  categories: SiteExpenseCategory[];
  payMethods: Array<{ key: string; ar: string; en: string }>;
  projects: Array<{ id: string; name: string }>;
  lang: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [form, setForm] = useState({
    scope: expense.scope,
    projectId: expense.projectId || "",
    category: expense.category,
    description: expense.description,
    amount: String(Number(expense.amount)),
    expenseDate: expense.expenseDate,
    vendor: expense.vendor || "",
    paymentMethod: expense.paymentMethod || "",
    invoiceNo: expense.invoiceNo || "",
    notes: expense.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const cls = "w-full h-10 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";
  const lbl = "text-xs font-bold text-ink-soft mb-1 block";

  async function save() {
    setSaving(true);
    try {
      await api.updateSiteExpenseAdmin(expense.id, {
        ...form,
        amount: Number(form.amount),
        projectId: form.scope === "PROJECT" ? form.projectId || null : null,
        paymentMethod: form.paymentMethod || null,
      });
      onSaved();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : L("تعذّر الحفظ", "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-ink text-lg">{L("تعديل مصروف", "Edit expense")}</h3>
          <button type="button" onClick={onClose} className="text-ink-soft text-xl leading-none" aria-label="close">
            ×
          </button>
        </div>
        <p className="text-xs text-ink-soft">
          {L("أدخله", "Entered by")} {expense.engineer.name} · {expense.createdAt.slice(0, 10)}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={lbl}>{L("النوع", "Type")}</span>
            <select className={cls} value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as "PROJECT" | "COMPANY" }))}>
              <option value="PROJECT">{L("مشروع", "Project")}</option>
              <option value="COMPANY">{L("شركة", "Company")}</option>
            </select>
          </div>
          {form.scope === "PROJECT" ? (
            <div>
              <span className={lbl}>{L("المشروع", "Project")}</span>
              <select className={cls} value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div />
          )}
          <div>
            <span className={lbl}>{L("المبلغ (د.أ)", "Amount (JOD)")}</span>
            <input className={cls} type="number" step="0.001" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <span className={lbl}>{L("التاريخ", "Date")}</span>
            <input className={cls} type="date" value={form.expenseDate} onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))} />
          </div>
          <div>
            <span className={lbl}>{L("التصنيف", "Category")}</span>
            <select className={cls} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {lang === "ar" ? c.ar : c.en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={lbl}>{L("طريقة الدفع", "Payment")}</span>
            <select className={cls} value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
              <option value="">—</option>
              {payMethods.map((p) => (
                <option key={p.key} value={p.key}>
                  {lang === "ar" ? p.ar : p.en}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <span className={lbl}>{L("الوصف", "Description")}</span>
          <input className={cls} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={lbl}>{L("المورّد", "Vendor")}</span>
            <input className={cls} value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} />
          </div>
          <div>
            <span className={lbl}>{L("رقم الفاتورة", "Invoice #")}</span>
            <input className={cls} value={form.invoiceNo} onChange={(e) => setForm((f) => ({ ...f, invoiceNo: e.target.value }))} />
          </div>
        </div>
        <div>
          <span className={lbl}>{L("ملاحظات", "Notes")}</span>
          <textarea className={`${cls} h-20 py-2`} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" disabled={saving} onClick={save} className="flex-1 h-11 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-60">
            {saving ? L("جاري الحفظ…", "Saving…") : L("حفظ", "Save")}
          </button>
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-xl border border-line text-sm font-bold">
            {L("إلغاء", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

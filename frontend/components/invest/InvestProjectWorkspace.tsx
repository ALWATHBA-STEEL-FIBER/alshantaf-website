"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import {
  investApi,
  type InvestExpense,
  type InvestProjectDetail,
  type InvestProjectStatus,
} from "@/lib/investApi";
import { ApiError } from "@/lib/api";
import { EmptyState, SkeletonBlock, Spinner } from "@/components/admin/EmptyState";
import { Money } from "./Money";
import { OwnershipChart } from "./OwnershipChart";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { SettlementSimulator } from "./SettlementSimulator";

const inputClass =
  "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";

const TABS = [
  { id: "overview", ar: "نظرة عامة", en: "Overview" },
  { id: "members", ar: "الشركاء", en: "Members" },
  { id: "capital", ar: "رأس المال", en: "Capital" },
  { id: "expenses", ar: "المصاريف", en: "Expenses" },
  { id: "documents", ar: "المستندات", en: "Documents" },
  { id: "simulator", ar: "المحاكي", en: "Simulator" },
  { id: "settlement", ar: "التسوية", en: "Settlement" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function L(ar: string, en: string, lang: string) {
  return lang === "ar" ? ar : en;
}

export function InvestProjectWorkspace({ projectId }: { projectId: string }) {
  const { lang } = useLanguage();
  const [tab, setTab] = useState<TabId>("overview");
  const [project, setProject] = useState<InvestProjectDetail | null>(null);
  const [expenses, setExpenses] = useState<InvestExpense[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusDraft, setStatusDraft] = useState<InvestProjectStatus>("active");
  const [statusBusy, setStatusBusy] = useState(false);
  const [memberInvestorId, setMemberInvestorId] = useState("");
  const [memberPercent, setMemberPercent] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);
  const [contribInvestorId, setContribInvestorId] = useState("");
  const [contribAmount, setContribAmount] = useState("");
  const [contribBusy, setContribBusy] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [settlementBusy, setSettlementBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    investApi
      .project(projectId)
      .then((p) => {
        setProject(p);
        if (p.status) setStatusDraft(p.status);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [projectId]);

  const loadExpenses = useCallback(() => {
    investApi
      .projectExpenses(projectId)
      .then(setExpenses)
      .catch(() => setExpenses([]));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "expenses") loadExpenses();
  }, [tab, loadExpenses]);

  async function applyStatus() {
    setActionError("");
    setStatusBusy(true);
    try {
      const updated = await investApi.setProjectStatus(projectId, { status: statusDraft });
      setProject(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Status update failed");
    } finally {
      setStatusBusy(false);
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setActionError("");
    setMemberBusy(true);
    try {
      await investApi.addProjectMember(projectId, {
        investorId: memberInvestorId.trim(),
        ownershipPercent: memberPercent.trim() ? memberPercent.trim() : undefined,
      });
      setMemberInvestorId("");
      setMemberPercent("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setMemberBusy(false);
    }
  }

  async function addContribution(e: React.FormEvent) {
    e.preventDefault();
    setActionError("");
    setContribBusy(true);
    try {
      await investApi.createProjectContribution(projectId, {
        investorId: contribInvestorId.trim() || undefined,
        amount: contribAmount.trim() || undefined,
      });
      setContribInvestorId("");
      setContribAmount("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setContribBusy(false);
    }
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setActionError("");
    setExpenseBusy(true);
    try {
      await investApi.createProjectExpense(projectId, {
        title: expenseTitle.trim(),
        amount: expenseAmount.trim() || undefined,
      });
      setExpenseTitle("");
      setExpenseAmount("");
      loadExpenses();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setExpenseBusy(false);
    }
  }

  async function reviewExpense(id: string, approve: boolean) {
    setActionError("");
    try {
      if (approve) await investApi.approveExpense(id);
      else await investApi.rejectExpense(id);
      loadExpenses();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed");
    }
  }

  async function runSettlement() {
    setActionError("");
    setSettlementBusy(true);
    try {
      await investApi.createSettlement(projectId);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setSettlementBusy(false);
    }
  }

  const totals = project?.totals;

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <Link href="/admin/invest/projects" className="text-xs font-bold text-ink-soft hover:text-green">
          ← {L("المشاريع", "Projects", lang)}
        </Link>
        {loading ? (
          <SkeletonBlock className="h-8 w-64 mt-2 rounded-lg" />
        ) : (
          <ProjectTitle name={project?.name} status={project?.status} />
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-line pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`h-9 px-3 rounded-lg text-xs font-bold transition-colors ${
              tab === t.id ? "bg-green text-white" : "text-ink-soft hover:bg-surface-2"
            }`}
          >
            {L(t.ar, t.en, lang)}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}

      {loading ? (
        <SkeletonBlock className="h-48 rounded-xl" />
      ) : !project ? (
        <EmptyState title={L("المشروع غير موجود", "Project not found", lang)} />
      ) : (
        <>
          {tab === "overview" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-line bg-white p-4 grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-ink-soft text-xs font-bold">{L("الموقع", "Location", lang)}</span>
                  <p className="font-medium">{project.location || "—"}</p>
                </div>
                <div>
                  <span className="text-ink-soft text-xs font-bold">{L("الوصف", "Description", lang)}</span>
                  <p>{project.description || "—"}</p>
                </div>
              </div>
              {totals && Object.keys(totals).length > 0 ? (
                <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(totals).map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-line bg-white p-3">
                      <dt className="text-[11px] font-bold text-ink-soft uppercase">{k}</dt>
                      <dd className="mt-1">
                        <Money value={v} showFinalizedBadge />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <EmptyState title={L("لا إجماليات", "No totals", lang)} />
              )}
              <OwnershipChart slices={project.ownership} emptyLabel={L("لا بيانات ملكية", "No ownership data", lang)} />
              <StatusDraftPanel
                lang={lang}
                statusDraft={statusDraft}
                setStatusDraft={setStatusDraft}
                statusBusy={statusBusy}
                onApply={applyStatus}
              />
            </div>
          )}

          {tab === "members" && (
            <div className="space-y-4">
              <form onSubmit={addMember} className="rounded-xl border border-line bg-white p-4 grid sm:grid-cols-3 gap-3">
                <input
                  className={inputClass}
                  placeholder={L("معرّف المستثمر", "Investor ID", lang)}
                  value={memberInvestorId}
                  onChange={(e) => setMemberInvestorId(e.target.value)}
                  required
                />
                <input
                  className={inputClass}
                  placeholder={L("نسبة الملكية %", "Ownership %", lang)}
                  value={memberPercent}
                  onChange={(e) => setMemberPercent(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={memberBusy}
                  className="h-11 rounded-xl bg-green text-white text-sm font-bold inline-flex justify-center items-center gap-2"
                >
                  {memberBusy ? <Spinner className="w-4 h-4" /> : null}
                  {L("إضافة", "Add", lang)}
                </button>
              </form>
              {project.members?.length ? (
                <table className="w-full text-sm rounded-xl border border-line bg-white overflow-hidden">
                  <thead>
                    <tr className="border-b border-line text-ink-soft">
                      <th className="py-2 px-4 text-start">{L("المستثمر", "Investor", lang)}</th>
                      <th className="py-2 px-4 text-start">%</th>
                      <th className="py-2 px-4 text-start">{L("الدور", "Role", lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.members.map((m) => (
                      <tr key={m.id} className="border-b border-line/50">
                        <td className="py-2 px-4">
                          {m.investorName || m.investorId}
                        </td>
                        <td className="py-2 px-4 tabular-nums">{m.ownershipPercent ?? "—"}</td>
                        <td className="py-2 px-4 text-ink-soft">{m.role || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState title={L("لا أعضاء", "No members", lang)} />
              )}
            </div>
          )}

          {tab === "capital" && (
            <div className="space-y-4">
              <form onSubmit={addContribution} className="rounded-xl border border-line bg-white p-4 grid sm:grid-cols-3 gap-3">
                <input
                  className={inputClass}
                  placeholder={L("معرّف المستثمر", "Investor ID", lang)}
                  value={contribInvestorId}
                  onChange={(e) => setContribInvestorId(e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder={L("المبلغ", "Amount", lang)}
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={contribBusy}
                  className="h-11 rounded-xl bg-green text-white text-sm font-bold inline-flex justify-center items-center gap-2"
                >
                  {contribBusy ? <Spinner className="w-4 h-4" /> : null}
                  {L("تسجيل مساهمة", "Record", lang)}
                </button>
              </form>
              {project.contributions?.length ? (
                <table className="w-full text-sm rounded-xl border border-line bg-white">
                  <thead>
                    <tr className="border-b border-line text-ink-soft">
                      <th className="py-2 px-4 text-start">{L("المستثمر", "Investor", lang)}</th>
                      <th className="py-2 px-4 text-start">{L("المبلغ", "Amount", lang)}</th>
                      <th className="py-2 px-4 text-start">{L("الحالة", "Status", lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.contributions.map((c) => (
                      <tr key={c.id} className="border-b border-line/50">
                        <td className="py-2 px-4">{c.investorName || c.investorId || "—"}</td>
                        <td className="py-2 px-4">
                          <Money value={c.amount} showFinalizedBadge />
                        </td>
                        <td className="py-2 px-4 text-ink-soft">{c.status || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState title={L("لا مساهمات", "No contributions", lang)} />
              )}
            </div>
          )}

          {tab === "expenses" && (
            <div className="space-y-4">
              <form onSubmit={addExpense} className="rounded-xl border border-line bg-white p-4 grid sm:grid-cols-3 gap-3">
                <input
                  className={inputClass}
                  placeholder={L("البيان", "Title", lang)}
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  required
                />
                <input
                  className={inputClass}
                  placeholder={L("المبلغ", "Amount", lang)}
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={expenseBusy}
                  className="h-11 rounded-xl bg-green text-white text-sm font-bold inline-flex justify-center items-center gap-2"
                >
                  {expenseBusy ? <Spinner className="w-4 h-4" /> : null}
                  {L("إضافة مصروف", "Add expense", lang)}
                </button>
              </form>
              {expenses === null ? (
                <Spinner className="w-5 h-5" />
              ) : expenses.length === 0 ? (
                <EmptyState title={L("لا مصاريف", "No expenses", lang)} />
              ) : (
                <table className="w-full text-sm rounded-xl border border-line bg-white">
                  <thead>
                    <tr className="border-b border-line text-ink-soft">
                      <th className="py-2 px-4 text-start">{L("البيان", "Title", lang)}</th>
                      <th className="py-2 px-4 text-start">{L("المبلغ", "Amount", lang)}</th>
                      <th className="py-2 px-4 text-start">{L("الحالة", "Status", lang)}</th>
                      <th className="py-2 px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((ex) => (
                      <tr key={ex.id} className="border-b border-line/50">
                        <td className="py-2 px-4">{ex.title || "—"}</td>
                        <td className="py-2 px-4">
                          <Money value={ex.amount} showFinalizedBadge />
                        </td>
                        <td className="py-2 px-4 text-ink-soft">{ex.status || "—"}</td>
                        <td className="py-2 px-4 text-end space-x-2">
                          {ex.status === "pending" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => reviewExpense(ex.id, true)}
                                className="text-xs font-bold text-green"
                              >
                                {L("موافقة", "Approve", lang)}
                              </button>
                              <button
                                type="button"
                                onClick={() => reviewExpense(ex.id, false)}
                                className="text-xs font-bold text-red-600"
                              >
                                {L("رفض", "Reject", lang)}
                              </button>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "documents" && (
            <div>
              {project.documents?.length ? (
                <ul className="rounded-xl border border-line bg-white divide-y divide-line">
                  {project.documents.map((d) => (
                    <li key={d.id} className="px-4 py-3 flex justify-between gap-3 text-sm">
                      <span className="font-medium">{d.name || d.id}</span>
                      {d.url ? (
                        <a href={d.url} className="text-green font-bold text-xs" target="_blank" rel="noreferrer">
                          {L("فتح", "Open", lang)}
                        </a>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title={L("لا مستندات", "No documents", lang)} />
              )}
            </div>
          )}

          {tab === "simulator" && <SettlementSimulator projectId={projectId} />}

          {tab === "settlement" && (
            <div className="space-y-4">
              <button
                type="button"
                disabled={settlementBusy}
                onClick={runSettlement}
                className="h-11 px-5 rounded-xl bg-gold text-green text-sm font-bold inline-flex items-center gap-2"
              >
                {settlementBusy ? <Spinner className="w-4 h-4" /> : null}
                {L("إنشاء تسوية", "Create settlement", lang)}
              </button>
              {project.settlements?.length ? (
                <table className="w-full text-sm rounded-xl border border-line bg-white">
                  <thead>
                    <tr className="border-b border-line text-ink-soft">
                      <th className="py-2 px-4 text-start">ID</th>
                      <th className="py-2 px-4 text-start">{L("الحالة", "Status", lang)}</th>
                      <th className="py-2 px-4 text-start">{L("التاريخ", "Date", lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.settlements.map((s) => (
                      <tr key={s.id} className="border-b border-line/50">
                        <td className="py-2 px-4 font-mono text-xs">{s.id}</td>
                        <td className="py-2 px-4">{s.status || "—"}</td>
                        <td className="py-2 px-4 text-ink-soft">{s.createdAt || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState title={L("لا تسويات", "No settlements", lang)} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProjectTitle({ name, status }: { name?: string; status?: InvestProjectStatus | null }) {
  return (
    <div className="flex flex-wrap items-center gap-3 mt-2">
      <h1 className="text-xl font-bold text-green">{name || "—"}</h1>
      <ProjectStatusBadge status={status} />
    </div>
  );
}

function StatusDraftPanel({
  lang,
  statusDraft,
  setStatusDraft,
  statusBusy,
  onApply,
}: {
  lang: string;
  statusDraft: InvestProjectStatus;
  setStatusDraft: (s: InvestProjectStatus) => void;
  statusBusy: boolean;
  onApply: () => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 flex flex-wrap gap-3 items-end">
      <p className="text-xs font-bold text-ink-soft w-full">{L("تحديث الحالة", "Update status", lang)}</p>
      <input
        className={inputClass}
        value={String(statusDraft)}
        onChange={(e) => setStatusDraft(e.target.value as InvestProjectStatus)}
      />
      <button
        type="button"
        onClick={onApply}
        disabled={statusBusy}
        className="h-11 px-4 rounded-xl border border-green text-green text-sm font-bold inline-flex items-center gap-2"
      >
        {statusBusy ? <Spinner className="w-4 h-4" /> : null}
        {L("حفظ", "Save", lang)}
      </button>
    </div>
  );
}
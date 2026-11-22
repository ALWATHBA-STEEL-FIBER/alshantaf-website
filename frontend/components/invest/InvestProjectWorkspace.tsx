"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import {
  crmApi,
  type CommissionRule,
  type DistributionResult,
  type PostedSettlement,
  type ProjectFull,
  type ProjectMember,
} from "@/lib/investApi";
import { SkeletonBlock } from "@/components/admin/EmptyState";
import { CommissionEditor } from "./crm/CommissionEditor";
import { DistributionTable, WaterfallSummary } from "./crm/DistributionTable";
import { PartnerPicker, type PickedPartner } from "./crm/PartnerPicker";
import {
  Avatar,
  BASIS_LABELS,
  Card,
  EXPENSE_CATEGORY_LABELS,
  ErrorNote,
  Field,
  Kpi,
  MANUAL_STATUSES,
  Modal,
  MoneyInput,
  STATUS_LABELS,
  StatusPill,
  btnGhost,
  btnGold,
  btnPrimary,
  fmt,
  fmtPct,
  inputCls,
  todayISO,
  toNum,
  useT,
} from "./crm/ui";

type TabId = "overview" | "partners" | "capital" | "expenses" | "payout" | "details";

export function InvestProjectWorkspace({ projectId }: { projectId: string }) {
  const { t } = useT();
  const [tab, setTab] = useState<TabId>("overview");
  const [p, setP] = useState<ProjectFull | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const load = useCallback(() => {
    return crmApi
      .project(projectId)
      .then((x) => {
        setP(x);
        setError("");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed"));
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(""), 3500);
    return () => clearTimeout(id);
  }, [flash]);

  const done = useCallback(
    async (msg: string) => {
      await load();
      setFlash(msg);
    },
    [load]
  );

  if (!p) {
    return (
      <div className="max-w-6xl space-y-3">
        {error ? <ErrorNote message={error} /> : <SkeletonBlock className="h-40 rounded-2xl" />}
      </div>
    );
  }

  const s = p.stats;
  const tabs: [TabId, string, string?][] = [
    ["overview", t("الملخص", "Overview")],
    ["partners", t("الشركاء", "Partners"), String(p.members.length)],
    ["capital", t("رأس المال", "Capital")],
    ["expenses", t("المصاريف", "Expenses"), s.expensesPendingCount ? `${s.expensesPendingCount}!` : undefined],
    ["payout", p.closed ? t("التوزيع النهائي", "Final payout") : t("البيع والتوزيع", "Sale & payout")],
    ["details", t("البيانات والسجل", "Details & log")],
  ];

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <Link href="/admin/invest/projects" className="text-xs font-bold text-ink-soft hover:text-green">
          ← {t("المشاريع", "Projects")}
        </Link>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <h1 className="text-2xl font-extrabold text-green">{p.name}</h1>
          <StatusPill status={p.status} />
        </div>
        <div className="text-xs text-ink-soft mt-1">
          {[p.code, p.location, p.plotParcelNo, p.landAreaSqm ? `${fmt(p.landAreaSqm)} م²` : null].filter(Boolean).join(" · ")}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi
          label={t("رأس المال", "Capital")}
          value={fmt(s.capital, { decimals: 0 })}
          sub={s.fundingPercent ? `${fmtPct(s.fundingPercent, 0)} ${t("من سعر الشراء", "of purchase")} ${fmt(s.purchasePrice, { decimals: 0 })}` : "JOD"}
        />
        <Kpi
          label={t("المصاريف المعتمدة", "Approved expenses")}
          value={fmt(s.expensesApproved, { decimals: 0 })}
          sub={s.expensesPendingCount ? `${s.expensesPendingCount} ${t("بانتظار الاعتماد", "pending")} (${fmt(s.expensesPending, { decimals: 0 })})` : `${t("دفعها الشركاء", "partner-paid")} ${fmt(s.expensesPartnerPaid, { decimals: 0 })}`}
          tone={s.expensesPendingCount ? "gold" : "default"}
        />
        <Kpi label={t("إجمالي المستثمر", "Total invested")} value={fmt(s.totalInvested, { decimals: 0 })} sub={t("رأس المال + مصاريف الشركاء", "capital + partner expenses")} />
        <Kpi
          label={s.actualSalePrice ? t("سعر البيع", "Sale price") : t("سعر البيع المستهدف", "Target sale")}
          value={fmt(s.actualSalePrice ?? s.targetSalePrice, { decimals: 0 })}
          sub="JOD"
        />
        <Kpi
          tone={toNum(s.projectedProfit) != null && toNum(s.projectedProfit)! < 0 ? "red" : "green"}
          label={s.actualSalePrice ? t("صافي الربح", "Net profit") : t("الربح المتوقع", "Projected profit")}
          value={fmt(s.projectedProfit, { decimals: 0 })}
          sub={s.projectedRoiPercent ? `ROI ${fmtPct(s.projectedRoiPercent, 1)}` : t("حدد سعر البيع", "set a sale price")}
        />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line pb-1 -mx-1 px-1">
        {tabs.map(([id, label, badge]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`h-10 px-4 rounded-xl text-sm font-bold whitespace-nowrap ${tab === id ? "bg-green text-white" : "text-ink-soft hover:bg-surface-2"}`}
          >
            {label}
            {badge ? (
              <span className={`ms-1.5 text-[10px] px-1.5 py-0.5 rounded-md ${tab === id ? "bg-white/20" : badge.endsWith("!") ? "bg-amber-100 text-amber-900" : "bg-surface-2"}`}>
                {badge.replace("!", "")}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {flash ? <div className="rounded-xl bg-green text-white px-4 py-2.5 text-sm font-bold">✓ {flash}</div> : null}
      <ErrorNote message={error} />

      {tab === "overview" && <Overview p={p} go={setTab} />}
      {tab === "partners" && <PartnersTab p={p} done={done} />}
      {tab === "capital" && <CapitalTab p={p} done={done} />}
      {tab === "expenses" && <ExpensesTab p={p} done={done} />}
      {tab === "payout" && <PayoutTab p={p} done={done} />}
      {tab === "details" && <DetailsTab p={p} done={done} />}
    </div>
  );
}

type TabProps = { p: ProjectFull; done: (msg: string) => Promise<void> };

// ── Overview ───────────────────────────────────────────────
function Overview({ p, go }: { p: ProjectFull; go: (t: TabId) => void }) {
  const { t, lang } = useT();
  const rule = p.commissionRule;
  const basis = BASIS_LABELS[rule.basis];
  const steps: { done: boolean; label: string; tab: TabId }[] = [
    { done: p.members.length > 0, label: t("إضافة الشركاء", "Add partners"), tab: "partners" },
    {
      done: toNum(p.stats.capital)! > 0 && (!p.stats.purchasePrice || toNum(p.stats.fundingPercent)! >= 100),
      label: t("جمع رأس المال", "Collect capital"),
      tab: "capital",
    },
    { done: p.stats.expensesPendingCount === 0, label: t("اعتماد المصاريف", "Approve expenses"), tab: "expenses" },
    { done: p.closed, label: t("البيع وتوزيع الأرباح", "Sell & distribute"), tab: "payout" },
  ];
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card title={t("الشركاء وحصصهم", "Partners & shares")} action={<button className="text-xs font-bold text-green" onClick={() => go("partners")}>{t("إدارة", "Manage")} ←</button>}>
          {p.members.length ? (
            <div className="space-y-2.5">
              {p.members.map((m) => (
                <div key={m.investorId}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <Avatar name={m.investorName} coordinator={m.isCoordinator} />
                      <span className="min-w-0">
                        <span className="font-bold block truncate">{m.investorName}</span>
                        <span className="text-[11px] text-ink-soft">
                          {m.code} · {m.isCoordinator ? t("المنسق", "Coordinator") : t("شريك", "Partner")}
                          {m.effectiveCommissionPercent != null && !m.isCoordinator ? ` · ${t("خصم", "cut")} ${fmtPct(m.effectiveCommissionPercent, 2)}` : ""}
                        </span>
                      </span>
                    </span>
                    <span className="text-end tabular-nums shrink-0">
                      <span className="font-extrabold text-green">{fmtPct(m.ownershipPercent)}</span>
                      <span className="block text-[11px] text-ink-soft">{fmt(m.capital)} JOD</span>
                    </span>
                  </div>
                  <div className="h-1.5 mt-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div className={`h-full ${m.isCoordinator ? "bg-gold" : "bg-green"}`} style={{ width: `${toNum(m.ownershipPercent) ?? 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-soft">{t("لا شركاء بعد.", "No partners yet.")}</p>
          )}
        </Card>
        <Card title={t("آخر المصاريف", "Latest expenses")} action={<button className="text-xs font-bold text-green" onClick={() => go("expenses")}>{t("الكل", "All")} ←</button>}>
          {p.expenses.length ? (
            <div className="divide-y divide-line">
              {p.expenses.slice(0, 5).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-bold block truncate">{e.title}</span>
                    <span className="text-[11px] text-ink-soft">
                      {e.expenseDate} · {e.fundedBy === "project" ? t("من صندوق المشروع", "from project pool") : `${t("دفعها", "paid by")} ${e.payerName}`}
                    </span>
                  </span>
                  <span className="text-end shrink-0">
                    <span className="font-bold tabular-nums">{fmt(e.amount)}</span>
                    <ExpenseStatus s={e.status} />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-soft">{t("لا مصاريف.", "No expenses.")}</p>
          )}
        </Card>
      </div>
      <div className="space-y-4">
        <Card title={t("خطوات المشروع", "Project steps")}>
          <ol className="space-y-2">
            {steps.map((st, i) => (
              <li key={st.label}>
                <button type="button" onClick={() => go(st.tab)} className="w-full flex items-center gap-3 text-start text-sm">
                  <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-extrabold ${st.done ? "bg-green text-white" : "bg-surface-2 text-ink-soft"}`}>
                    {st.done ? "✓" : i + 1}
                  </span>
                  <span className={st.done ? "text-ink-soft line-through" : "font-bold"}>{st.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </Card>
        <Card title={t("حصة المنسق", "Coordinator cut")}>
          <div className="text-sm">
            <div className="font-extrabold text-green text-lg">
              {rule.basis === "fixed" ? `${fmt(rule.fixedAmount)} JOD` : fmtPct(rule.percent)}
              {rule.basis === "hybrid" ? ` + ${fmt(rule.fixedAmount)} JOD` : ""}
            </div>
            <div className="font-bold">{basis?.[lang === "ar" ? 0 : 1]}</div>
            <div className="text-[11px] text-ink-soft mt-1">{basis?.[lang === "ar" ? 2 : 3]}</div>
            <div className="text-[11px] text-ink-soft mt-2">
              {t("المنسق", "Coordinator")}: <b className="text-ink">{p.stats.coordinator?.name ?? "—"}</b>
            </div>
          </div>
        </Card>
        <Card title={t("صندوق المشروع", "Project pool")}>
          <dl className="text-sm space-y-1.5">
            <Row label={t("رأس المال المجموع", "Capital collected")} v={p.stats.capital} />
            <Row label={t("سعر الشراء", "Purchase price")} v={p.stats.purchasePrice} minus />
            <Row label={t("مصاريف من الصندوق", "Pool-paid expenses")} v={p.stats.expensesPoolPaid} minus />
            <div className="border-t border-line pt-1.5">
              <Row label={t("الرصيد المتبقي", "Remaining cash")} v={p.stats.poolCash} bold />
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, v, minus, bold }: { label: string; v: string | null; minus?: boolean; bold?: boolean }) {
  const n = toNum(v);
  return (
    <div className={`flex justify-between gap-2 ${bold ? "font-extrabold text-green" : ""}`}>
      <dt className={bold ? "" : "text-ink-soft"}>{label}</dt>
      <dd className={`tabular-nums ${n != null && n < 0 ? "text-red-700" : ""}`} dir="ltr">
        {minus && n ? "− " : ""}
        {fmt(v)}
      </dd>
    </div>
  );
}

function ExpenseStatus({ s }: { s: string }) {
  const { t } = useT();
  const map: Record<string, [string, string, string]> = {
    pending: ["بانتظار الاعتماد", "Pending", "bg-amber-50 text-amber-900 border-amber-200"],
    approved: ["معتمد", "Approved", "bg-green/10 text-green border-green/20"],
    reimbursed: ["مسترد", "Reimbursed", "bg-gold/15 text-green border-gold/30"],
    rejected: ["مرفوض", "Rejected", "bg-red-50 text-red-800 border-red-200"],
    written_off: ["ملغى", "Voided", "bg-surface-2 text-ink-soft border-line line-through"],
  };
  const [ar, en, cls] = map[s] ?? [s, s, "bg-white border-line"];
  return <span className={`block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border w-fit ms-auto ${cls}`}>{t(ar, en)}</span>;
}

// ── Partners ───────────────────────────────────────────────
function PartnersTab({ p, done }: TabProps) {
  const { t } = useT();
  const [adding, setAdding] = useState<PickedPartner | null>(null);
  const [capital, setCapital] = useState("");
  const [asCoord, setAsCoord] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ProjectMember | null>(null);
  const perPartner = p.commissionRule.basis === "investor_net_profit";

  async function add() {
    if (!adding) return;
    setBusy(true);
    setError("");
    try {
      await crmApi.addMember(p.id, { investorId: adding.id, capital: capital || 0, isCoordinator: asCoord });
      setAdding(null);
      setCapital("");
      setAsCoord(false);
      await done(t("تمت إضافة الشريك", "Partner added"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: ProjectMember) {
    if (!confirm(t(`إزالة ${m.investorName} من المشروع؟`, `Remove ${m.investorName}?`))) return;
    setError("");
    try {
      await crmApi.removeMember(p.id, m.investorId);
      await done(t("تمت الإزالة", "Removed"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      {!p.closed ? (
        <Card title={t("إضافة شريك للمشروع", "Add a partner")}>
          {!adding ? (
            <PartnerPicker excludeIds={p.members.map((m) => m.investorId)} onPick={setAdding} />
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                <Avatar name={adding.name} />
                <div>
                  <div className="font-bold">{adding.name}</div>
                  <div className="text-[11px] text-ink-soft">{adding.code}</div>
                </div>
              </div>
              <Field label={t("رأس مال الدخول", "Opening capital")} className="w-48">
                <MoneyInput value={capital} onChange={setCapital} autoFocus />
              </Field>
              <label className="flex items-center gap-1.5 text-sm font-bold h-11">
                <input type="checkbox" checked={asCoord} onChange={(e) => setAsCoord(e.target.checked)} className="accent-[var(--color-green)]" />
                {t("المنسق", "Coordinator")}
              </label>
              <button className={btnPrimary} disabled={busy} onClick={add}>
                {t("إضافة", "Add")}
              </button>
              <button className={btnGhost} onClick={() => setAdding(null)}>
                {t("إلغاء", "Cancel")}
              </button>
            </div>
          )}
          <ErrorNote message={error} />
        </Card>
      ) : null}

      <div className="rounded-2xl border border-line bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-surface-2 text-[11px] text-ink-soft">
            <tr>
              <th className="px-3 py-2.5 text-start">{t("الشريك", "Partner")}</th>
              <th className="px-3 py-2.5 text-start">{t("رأس المال", "Capital")}</th>
              <th className="px-3 py-2.5 text-start">{t("الحصة", "Share")}</th>
              <th className="px-3 py-2.5 text-start">{t("مصاريف دفعها", "Expenses paid")}</th>
              <th className="px-3 py-2.5 text-start">{t("خصم المنسق من ربحه", "Coordinator cut on profit")}</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {p.members.map((m) => (
              <tr key={m.investorId} className={m.isCoordinator ? "bg-gold/5" : ""}>
                <td className="px-3 py-2.5">
                  <Link href={`/admin/invest/investors/${m.investorId}`} className="flex items-center gap-2 hover:underline">
                    <Avatar name={m.investorName} coordinator={m.isCoordinator} />
                    <span>
                      <span className="font-bold block">{m.investorName}</span>
                      <span className="text-[11px] text-ink-soft" dir="ltr">
                        {m.code}
                        {m.phone ? ` · ${m.phone}` : ""}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 tabular-nums font-bold">{fmt(m.capital)}</td>
                <td className="px-3 py-2.5 tabular-nums font-extrabold text-green">{fmtPct(m.ownershipPercent)}</td>
                <td className="px-3 py-2.5 tabular-nums">
                  {fmt(m.expensesOutstanding)}
                  {toNum(m.expensesPending) ? <div className="text-[10px] text-amber-700">+{fmt(m.expensesPending)} {t("معلق", "pending")}</div> : null}
                </td>
                <td className="px-3 py-2.5">
                  {m.isCoordinator ? (
                    <span className="text-[11px] font-bold text-gold bg-gold/10 rounded px-2 py-1">{t("يستلم العمولة", "Receives the cut")}</span>
                  ) : perPartner ? (
                    <span className="tabular-nums">
                      {fmtPct(m.effectiveCommissionPercent, 2)}
                      {m.commissionPercent != null ? <span className="text-[10px] text-gold ms-1">{t("(خاص)", "(custom)")}</span> : null}
                    </span>
                  ) : (
                    <span className="text-[11px] text-ink-soft">{t("حسب الحصة", "pro-rata")}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-end whitespace-nowrap">
                  {!p.closed ? (
                    <>
                      <button className="text-xs font-bold text-green px-2" onClick={() => setEditing(m)}>
                        {t("تعديل", "Edit")}
                      </button>
                      <button className="text-xs font-bold text-red-700 px-2" onClick={() => remove(m)}>
                        {t("إزالة", "Remove")}
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-ink-soft">
        {t(
          "الحصص تُحسب تلقائياً من رأس المال المدفوع. المصاريف التي يدفعها شريك لا تزيد حصته — تُرجع له عند البيع قبل توزيع الربح.",
          "Shares come from paid-in capital. Expenses a partner pays don't raise his share — they are refunded at sale before profit is split."
        )}
      </p>
      {editing ? <MemberModal p={p} m={editing} onClose={() => setEditing(null)} done={done} /> : null}
    </div>
  );
}

function MemberModal({ p, m, onClose, done }: { p: ProjectFull; m: ProjectMember; onClose: () => void; done: TabProps["done"] }) {
  const { t } = useT();
  const [cut, setCut] = useState(m.commissionPercent ?? "");
  const [coord, setCoord] = useState(m.isCoordinator);
  const [notes, setNotes] = useState(m.notes ?? "");
  const [error, setError] = useState("");
  const perPartner = p.commissionRule.basis === "investor_net_profit";
  async function save() {
    setError("");
    try {
      await crmApi.updateMember(p.id, m.investorId, {
        commissionPercent: cut === "" ? null : cut,
        isCoordinator: coord,
        notes,
      });
      onClose();
      await done(t("تم الحفظ", "Saved"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    }
  }
  return (
    <Modal open onClose={onClose} title={m.investorName}>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={coord} onChange={(e) => setCoord(e.target.checked)} className="accent-[var(--color-green)]" />
          {t("هذا الشريك هو منسق المشروع", "This partner is the coordinator")}
        </label>
        {perPartner && !coord ? (
          <Field
            label={t("نسبة خصم المنسق من ربح هذا الشريك %", "Coordinator cut on this partner's profit %")}
            hint={t(`اتركها فارغة لاستخدام نسبة المشروع (${p.commissionRule.percent}%). ضع 0 لإعفائه.`, `Empty = project default (${p.commissionRule.percent}%). 0 = exempt.`)}
          >
            <input className={inputCls} dir="ltr" inputMode="decimal" value={cut} onChange={(e) => setCut(e.target.value.replace(/[^0-9.]/g, ""))} />
          </Field>
        ) : null}
        <Field label={t("ملاحظات", "Notes")}>
          <textarea className={`${inputCls} h-20 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <ErrorNote message={error} />
        <button className={`${btnPrimary} w-full`} onClick={save}>
          {t("حفظ", "Save")}
        </button>
      </div>
    </Modal>
  );
}

// ── Capital ────────────────────────────────────────────────
const KIND_LABELS: Record<string, [string, string]> = {
  initial: ["دفعة أولى", "Initial"],
  additional: ["دفعة إضافية", "Additional"],
  capital_call: ["طلب تمويل", "Capital call"],
  adjustment: ["تسوية", "Adjustment"],
  withdrawal: ["سحب", "Withdrawal"],
};

function CapitalTab({ p, done }: TabProps) {
  const { t, lang } = useT();
  const [investorId, setInvestorId] = useState(p.members[0]?.investorId ?? "");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState("additional");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await crmApi.addContribution(p.id, { investorId, amount, kind, contributedAt: date, notes });
      setAmount("");
      setNotes("");
      await done(t("تم تسجيل الدفعة", "Payment recorded"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function reverse(id: string) {
    const reason = prompt(t("سبب العكس؟", "Reason for reversal?"));
    if (reason == null) return;
    try {
      await crmApi.reverseContribution(id, reason);
      await done(t("تم عكس الدفعة", "Payment reversed"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      {!p.closed && p.members.length ? (
        <Card title={t("تسجيل دفعة رأس مال", "Record a capital payment")}>
          <form onSubmit={add} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <Field label={t("الشريك", "Partner")}>
              <select className={inputCls} value={investorId} onChange={(e) => setInvestorId(e.target.value)}>
                {p.members.map((m) => (
                  <option key={m.investorId} value={m.investorId}>
                    {m.investorName} ({m.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("المبلغ", "Amount")}>
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
            <Field label={t("النوع", "Type")}>
              <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>
                {Object.entries(KIND_LABELS).map(([k, [ar, en]]) => (
                  <option key={k} value={k}>
                    {lang === "ar" ? ar : en}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("التاريخ", "Date")}>
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <button className={btnPrimary} disabled={busy || !amount}>
              {t("تسجيل", "Record")}
            </button>
            <Field label={t("ملاحظة / رقم الحوالة", "Note / transfer ref")} className="sm:col-span-2 lg:col-span-5">
              <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </form>
          <ErrorNote message={error} />
        </Card>
      ) : null}

      <div className="rounded-2xl border border-line bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-surface-2 text-[11px] text-ink-soft">
            <tr>
              <th className="px-3 py-2.5 text-start">{t("التاريخ", "Date")}</th>
              <th className="px-3 py-2.5 text-start">{t("الشريك", "Partner")}</th>
              <th className="px-3 py-2.5 text-start">{t("النوع", "Type")}</th>
              <th className="px-3 py-2.5 text-start">{t("المبلغ", "Amount")}</th>
              <th className="px-3 py-2.5 text-start">{t("ملاحظة", "Note")}</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {p.contributions.map((c) => {
              const reversed = c.status !== "approved";
              return (
                <tr key={c.id} className={reversed ? "opacity-50" : ""}>
                  <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{c.contributedAt}</td>
                  <td className="px-3 py-2.5 font-bold">{c.investorName}</td>
                  <td className="px-3 py-2.5">{KIND_LABELS[c.kind]?.[lang === "ar" ? 0 : 1] ?? c.kind}</td>
                  <td className={`px-3 py-2.5 tabular-nums font-bold ${reversed ? "line-through" : ""} ${c.kind === "withdrawal" ? "text-red-700" : ""}`}>
                    {c.kind === "withdrawal" ? "−" : ""}
                    {fmt(c.amount)}
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">{reversed ? t("معكوسة", "Reversed") : c.notes}</td>
                  <td className="px-3 py-2.5 text-end">
                    {!reversed && !p.closed ? (
                      <button className="text-xs font-bold text-red-700" onClick={() => reverse(c.id)}>
                        {t("عكس", "Reverse")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {!p.contributions.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-ink-soft">
                  {t("لا دفعات بعد", "No payments yet")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Expenses ───────────────────────────────────────────────
function ExpensesTab({ p, done }: TabProps) {
  const { t, lang } = useT();
  const coord = p.members.find((m) => m.isCoordinator);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("registration");
  const [fundedBy, setFundedBy] = useState<"partner" | "project">("partner");
  const [payer, setPayer] = useState(coord?.investorId ?? p.members[0]?.investorId ?? "");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [approveNow, setApproveNow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await crmApi.addExpense(p.id, {
        title,
        amount,
        category,
        fundedBy,
        payerInvestorId: fundedBy === "partner" ? payer : undefined,
        expenseDate: date,
        description,
        approveNow,
      });
      setTitle("");
      setAmount("");
      setDescription("");
      await done(t("تمت إضافة المصروف", "Expense added"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "approve" | "void") {
    setError("");
    try {
      if (action === "approve") await crmApi.approveExpense(id);
      else {
        const reason = prompt(t("سبب الإلغاء؟", "Reason?"));
        if (reason == null) return;
        await crmApi.reverseExpense(id, reason);
      }
      await done(action === "approve" ? t("تم الاعتماد", "Approved") : t("تم الإلغاء", "Voided"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    }
  }

  const list = p.expenses.filter((e) => {
    if (filter === "pending" && e.status !== "pending") return false;
    if (filter === "project" && e.fundedBy !== "project") return false;
    if (filter !== "all" && filter !== "pending" && filter !== "project" && e.payerInvestorId !== filter) return false;
    const s = q.trim().toLowerCase();
    if (s && !`${e.title} ${e.description ?? ""} ${e.payerName ?? ""}`.toLowerCase().includes(s)) return false;
    return true;
  });
  const total = list.filter((e) => ["approved", "reimbursed", "pending"].includes(e.status)).reduce((a, e) => a + (toNum(e.amount) ?? 0), 0);

  const byPayer = useMemo(() => {
    const m = new Map<string, { name: string; amount: number }>();
    for (const e of p.expenses) {
      if (!["approved", "reimbursed", "pending"].includes(e.status)) continue;
      const key = e.fundedBy === "project" ? "project" : e.payerInvestorId ?? "?";
      const name = e.fundedBy === "project" ? t("صندوق المشروع", "Project pool") : e.payerName ?? "?";
      const row = m.get(key) ?? { name, amount: 0 };
      row.amount += toNum(e.amount) ?? 0;
      m.set(key, row);
    }
    return [...m.entries()];
  }, [p.expenses, t]);

  return (
    <div className="space-y-4">
      {!p.closed ? (
        <Card title={t("إضافة مصروف", "Add expense")}>
          <form onSubmit={add} className="space-y-3">
            <div className="flex rounded-xl border border-line bg-surface-2 p-1 w-fit">
              {(
                [
                  ["partner", t("دفعه شريك (يُرجع له عند البيع)", "Paid by a partner (refunded at sale)")],
                  ["project", t("من صندوق المشروع", "From project pool")],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFundedBy(k)}
                  className={`h-9 px-3 rounded-lg text-xs font-bold ${fundedBy === k ? "bg-white text-green shadow-sm" : "text-ink-soft"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label={t("الوصف *", "Description *")} className="lg:col-span-2">
                <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("مثال: رسوم نقل ملكية", "e.g. transfer fees")} />
              </Field>
              <Field label={t("المبلغ *", "Amount *")}>
                <MoneyInput value={amount} onChange={setAmount} />
              </Field>
              <Field label={t("التاريخ", "Date")}>
                <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label={t("التصنيف", "Category")}>
                <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, [ar, en]]) => (
                    <option key={k} value={k}>
                      {lang === "ar" ? ar : en}
                    </option>
                  ))}
                </select>
              </Field>
              {fundedBy === "partner" ? (
                <Field label={t("من دفع؟", "Who paid?")}>
                  <select className={inputCls} value={payer} onChange={(e) => setPayer(e.target.value)}>
                    {p.members.map((m) => (
                      <option key={m.investorId} value={m.investorId}>
                        {m.investorName}
                        {m.isCoordinator ? ` (${t("المنسق", "coordinator")})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field label={t("تفاصيل / المورد / رقم الفاتورة", "Details / vendor / invoice")} className={fundedBy === "partner" ? "lg:col-span-2" : "lg:col-span-3"}>
                <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm font-bold">
                <input type="checkbox" checked={approveNow} onChange={(e) => setApproveNow(e.target.checked)} className="accent-[var(--color-green)]" />
                {t("اعتماد مباشر", "Approve now")}
              </label>
              <button className={btnPrimary} disabled={busy || !title || !amount}>
                {t("حفظ المصروف", "Save expense")}
              </button>
            </div>
          </form>
          <ErrorNote message={error} />
        </Card>
      ) : null}

      {byPayer.length ? (
        <div className="flex flex-wrap gap-2">
          {byPayer.map(([k, v]) => (
            <div key={k} className="rounded-xl border border-line bg-white px-3 py-2 text-xs">
              <span className="text-ink-soft">{v.name}: </span>
              <b className="tabular-nums">{fmt(v.amount)}</b>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <select className={`${inputCls} !w-auto`} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">{t("كل المصاريف", "All expenses")}</option>
          <option value="pending">{t("بانتظار الاعتماد", "Pending")}</option>
          <option value="project">{t("من صندوق المشروع", "Project pool")}</option>
          {p.members.map((m) => (
            <option key={m.investorId} value={m.investorId}>
              {t("دفعها", "Paid by")} {m.investorName}
            </option>
          ))}
        </select>
        <input className={`${inputCls} flex-1 min-w-[200px]`} placeholder={t("بحث…", "Search…")} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="h-11 px-4 rounded-xl bg-green text-white text-sm font-bold flex items-center tabular-nums">
          {t("المجموع", "Total")}: {fmt(total)}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-surface-2 text-[11px] text-ink-soft">
            <tr>
              <th className="px-3 py-2.5 text-start">{t("التاريخ", "Date")}</th>
              <th className="px-3 py-2.5 text-start">{t("الوصف", "Description")}</th>
              <th className="px-3 py-2.5 text-start">{t("التصنيف", "Category")}</th>
              <th className="px-3 py-2.5 text-start">{t("الدفع", "Paid by")}</th>
              <th className="px-3 py-2.5 text-start">{t("المبلغ", "Amount")}</th>
              <th className="px-3 py-2.5 text-start">{t("الحالة", "Status")}</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((e) => (
              <tr key={e.id} className={["rejected", "written_off"].includes(e.status) ? "opacity-50" : ""}>
                <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{e.expenseDate}</td>
                <td className="px-3 py-2.5">
                  <div className="font-bold">{e.title}</div>
                  {e.description ? <div className="text-[11px] text-ink-soft">{e.description}</div> : null}
                  {e.rejectedReason ? <div className="text-[11px] text-red-700">{e.rejectedReason}</div> : null}
                </td>
                <td className="px-3 py-2.5 text-xs">{EXPENSE_CATEGORY_LABELS[e.category ?? ""]?.[lang === "ar" ? 0 : 1] ?? e.category ?? "—"}</td>
                <td className="px-3 py-2.5 text-xs">
                  {e.fundedBy === "project" ? (
                    <span className="text-ink-soft">{t("صندوق المشروع", "Project pool")}</span>
                  ) : (
                    <>
                      <b>{e.payerName}</b>
                      <div className="text-[10px] text-gold">{t("يُرجع عند البيع", "Refunded at sale")}</div>
                    </>
                  )}
                </td>
                <td className="px-3 py-2.5 tabular-nums font-bold">{fmt(e.amount)}</td>
                <td className="px-3 py-2.5">
                  <ExpenseStatus s={e.status} />
                </td>
                <td className="px-3 py-2.5 text-end whitespace-nowrap">
                  {!p.closed && e.status === "pending" ? (
                    <button className="text-xs font-bold text-green px-2" onClick={() => act(e.id, "approve")}>
                      {t("اعتماد", "Approve")}
                    </button>
                  ) : null}
                  {!p.closed && ["pending", "approved"].includes(e.status) ? (
                    <button className="text-xs font-bold text-red-700 px-2" onClick={() => act(e.id, "void")}>
                      {t("إلغاء", "Void")}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!list.length ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-ink-soft">
                  {t("لا مصاريف", "No expenses")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sale & payout ──────────────────────────────────────────
function PayoutTab({ p, done }: TabProps) {
  const { t } = useT();
  const [sale, setSale] = useState(String(toNum(p.actualSalePrice) ?? toNum(p.targetSalePrice) ?? ""));
  const [closing, setClosing] = useState("");
  const [saleDate, setSaleDate] = useState(todayISO());
  const [ruleDraft, setRuleDraft] = useState<CommissionRule | null>(null);
  const [sim, setSim] = useState<DistributionResult | null>(null);
  const [posted, setPosted] = useState<PostedSettlement | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    crmApi
      .settlement(p.id)
      .then((r) => setPosted(r.settlement))
      .catch(() => setPosted(null));
  }, [p.id, p.status]);

  useEffect(() => {
    if (p.closed || !(toNum(sale) ?? 0) || !p.members.length) {
      setSim(null);
      return;
    }
    let ignore = false;
    const id = setTimeout(() => {
      crmApi
        .simulate(p.id, { saleProceeds: sale, closingCosts: closing || 0, commissionRule: ruleDraft ?? undefined })
        .then((r) => !ignore && (setSim(r), setError("")))
        .catch((err) => !ignore && setError(err instanceof ApiError ? err.message : "Failed"));
    }, 250);
    return () => {
      ignore = true;
      clearTimeout(id);
    };
  }, [p.id, p.closed, p.members.length, sale, closing, ruleDraft]);

  async function saveRule() {
    if (!ruleDraft) return;
    try {
      await crmApi.updateProject(p.id, { commissionRule: ruleDraft });
      setRuleDraft(null);
      await done(t("تم حفظ نسبة المنسق", "Coordinator cut saved"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    }
  }

  async function close() {
    setBusy(true);
    setError("");
    try {
      const s = await crmApi.settle(p.id, { saleProceeds: sale, closingCosts: closing || 0, saleDate });
      setPosted(s);
      setConfirming(false);
      await done(t("تم إغلاق المشروع وتوزيع الأرباح", "Project closed and profits distributed"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  async function togglePaid(partnerId: string, paid: boolean) {
    if (!posted) return;
    const ref = paid ? prompt(t("رقم الحوالة / الشيك (اختياري)", "Transfer / cheque ref (optional)")) : "";
    if (ref === null) return;
    try {
      setPosted(await crmApi.markPayout(p.id, posted.id, partnerId, { paid, paidRef: ref || undefined }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    }
  }

  if (p.closed) {
    if (posted === undefined) return <SkeletonBlock className="h-40 rounded-2xl" />;
    if (!posted) return <p className="text-sm text-ink-soft">{t("لا توجد تسوية مسجلة.", "No settlement recorded.")}</p>;
    const paid = toNum(posted.totals.totalPaid) ?? 0;
    const total = toNum(posted.totals.totalPayouts) ?? 0;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi tone="green" label={t("سعر البيع", "Sale price")} value={fmt(posted.totals.saleProceeds, { decimals: 0 })} sub={p.actualSaleDate ?? ""} />
          <Kpi label={t("الربح الموزع", "Profit distributed")} value={fmt(posted.summary?.distributableProfitBeforeCommission, { decimals: 0 })} />
          <Kpi tone="gold" label={t("حصة المنسق", "Coordinator cut")} value={fmt(posted.summary?.coordinatorCommission, { decimals: 0 })} />
          <Kpi
            tone={paid >= total ? "green" : "default"}
            label={t("تم دفعه للشركاء", "Paid out")}
            value={<span dir="ltr">{fmt(paid, { decimals: 0 })} / {fmt(total, { decimals: 0 })}</span>}
            sub={paid >= total ? t("اكتمل الدفع", "All paid") : t("بانتظار الدفع", "Awaiting payment")}
          />
        </div>
        {posted.summary ? <WaterfallSummary r={posted.summary} /> : null}
        <DistributionTable
          lines={posted.lines}
          showPaid
          actions={(l) => {
            const isPaid = (toNum(l.paidAmount) ?? 0) > 0;
            return (
              <button
                className={`text-xs font-bold px-2 py-1 rounded-lg ${isPaid ? "text-ink-soft" : "bg-green text-white"}`}
                onClick={() => togglePaid(l.partnerId, !isPaid)}
              >
                {isPaid ? t("تراجع", "Undo") : t("تم الدفع", "Mark paid")}
              </button>
            );
          }}
        />
        <button className={btnGhost} onClick={() => window.print()}>
          {t("طباعة كشف التوزيع", "Print statement")}
        </button>
        <ErrorNote message={error} />
      </div>
    );
  }

  const rule = ruleDraft ?? p.commissionRule;
  return (
    <div className="space-y-4">
      <Card title={t("حاسبة البيع والتوزيع", "Sale & split calculator")}>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label={t("سعر البيع", "Sale price")}>
            <MoneyInput value={sale} onChange={setSale} />
          </Field>
          <Field label={t("تكاليف البيع (سمسرة، رسوم…)", "Selling costs (brokerage, fees…)")}>
            <MoneyInput value={closing} onChange={setClosing} />
          </Field>
          <Field label={t("تاريخ البيع", "Sale date")}>
            <input type="date" className={inputCls} value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          </Field>
        </div>
        {p.stats.expensesPendingCount ? (
          <p className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
            {t(
              `يوجد ${p.stats.expensesPendingCount} مصروف بانتظار الاعتماد — محسوبة في المعاينة، ويجب اعتمادها أو إلغاؤها قبل الإغلاق.`,
              `${p.stats.expensesPendingCount} pending expenses are included in this preview and must be approved or voided before closing.`
            )}
          </p>
        ) : null}
      </Card>

      <details className="rounded-2xl border border-line bg-white" open={Boolean(ruleDraft)}>
        <summary className="px-4 py-3 cursor-pointer text-sm font-extrabold text-green">
          {t("حصة المنسق", "Coordinator cut")}: {rule.basis === "fixed" ? `${fmt(rule.fixedAmount)} JOD` : fmtPct(rule.percent)} — {t("جرّب نسباً أخرى", "try other rates")}
        </summary>
        <div className="px-4 pb-4 space-y-3">
          <CommissionEditor
            rule={rule}
            onChange={setRuleDraft}
            shareLosses={p.shareLossesByOwnership}
            onShareLosses={async (v) => {
              await crmApi.updateProject(p.id, { shareLossesByOwnership: v });
              await done(t("تم الحفظ", "Saved"));
            }}
            coordinatorParticipates={p.coordinatorParticipatesInProfit}
            onCoordinatorParticipates={async (v) => {
              await crmApi.updateProject(p.id, { coordinatorParticipatesInProfit: v });
              await done(t("تم الحفظ", "Saved"));
            }}
          />
          {ruleDraft ? (
            <div className="flex gap-2">
              <button className={btnPrimary} onClick={saveRule}>
                {t("اعتماد هذه النسبة للمشروع", "Use this for the project")}
              </button>
              <button className={btnGhost} onClick={() => setRuleDraft(null)}>
                {t("رجوع للنسبة المحفوظة", "Back to saved")}
              </button>
            </div>
          ) : null}
        </div>
      </details>

      <ErrorNote message={error} />

      {sim ? (
        <>
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <WaterfallSummary r={sim} />
            </div>
            <div className="lg:col-span-2 grid grid-cols-2 gap-3 content-start">
              <Kpi tone="green" label={t("صافي الربح", "Net profit")} value={fmt(sim.distributableProfitBeforeCommission, { decimals: 0 })} sub="JOD" />
              <Kpi tone="gold" label={t("حصة المنسق", "Coordinator cut")} value={fmt(sim.coordinatorCommission, { decimals: 0 })} sub="JOD" />
              <Kpi label={t("يُرجع كرأس مال", "Capital returned")} value={fmt(sim.totalCapitalReturned, { decimals: 0 })} />
              <Kpi label={t("يُرجع كمصاريف", "Expenses refunded")} value={fmt(sim.totalExpenseReimbursements, { decimals: 0 })} />
              {sim.lossShared ? (
                <p className="col-span-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                  {t("البيع لا يغطي رأس المال والمصاريف — الخسارة موزعة على الجميع حسب الحصص.", "Sale doesn't cover capital + expenses — the loss is shared by ownership.")}
                </p>
              ) : null}
            </div>
          </div>
          <DistributionTable lines={sim.lines} />
          <div className="rounded-2xl border-2 border-dashed border-gold/60 bg-gold/5 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-extrabold text-green">{t("جاهز للبيع؟", "Ready to sell?")}</div>
              <div className="text-ink-soft text-xs">
                {t(
                  "الإغلاق يثبّت سعر البيع والتوزيع أعلاه نهائياً ويقفل المشروع. بعدها تسجّل دفع كل شريك.",
                  "Closing locks the sale price and split above and closes the project. Then you mark each partner as paid."
                )}
              </div>
            </div>
            <button className={btnGold} disabled={Boolean(p.stats.expensesPendingCount) || Boolean(ruleDraft)} onClick={() => setConfirming(true)}>
              {t("إغلاق المشروع وتوزيع الأرباح", "Close project & distribute")}
            </button>
          </div>
          {ruleDraft ? <p className="text-xs text-amber-800">{t("احفظ النسبة الجديدة أو ارجع للمحفوظة قبل الإغلاق.", "Save or discard the new rate before closing.")}</p> : null}
        </>
      ) : (
        <p className="text-sm text-ink-soft">{t("أدخل سعر البيع لرؤية التوزيع.", "Enter a sale price to see the split.")}</p>
      )}

      {confirming && sim ? (
        <Modal open onClose={() => setConfirming(false)} title={t("تأكيد الإغلاق والتوزيع", "Confirm close & payout")}>
          <div className="space-y-3 text-sm">
            <p>
              {t("سعر البيع", "Sale price")}: <b className="tabular-nums">{fmt(sim.saleProceeds)} JOD</b>
            </p>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {sim.lines.map((l) => (
                <li key={l.partnerId} className="flex justify-between px-3 py-2">
                  <span>{l.label}</span>
                  <b className="tabular-nums">{fmt(l.totalPayout)}</b>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-soft">{t("لا يمكن التراجع عن هذه الخطوة.", "This cannot be undone.")}</p>
            <button className={`${btnGold} w-full`} disabled={busy} onClick={close}>
              {busy ? "…" : t("نعم، أغلق ووزّع", "Yes, close & distribute")}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

// ── Details & log ──────────────────────────────────────────
function DetailsTab({ p, done }: TabProps) {
  const { t, lang } = useT();
  const [d, setD] = useState({
    name: p.name,
    code: p.code ?? "",
    landLocation: p.landLocation ?? "",
    city: p.city ?? "",
    plotParcelNo: p.plotParcelNo ?? "",
    landAreaSqm: p.landAreaSqm ?? "",
    purchasePrice: String(toNum(p.purchasePrice) ?? ""),
    purchaseDate: p.purchaseDate ?? "",
    targetSalePrice: String(toNum(p.targetSalePrice) ?? ""),
    expectedSaleDate: p.expectedSaleDate ?? "",
    description: p.description ?? "",
  });
  const [status, setStatus] = useState(p.status ?? "draft");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const set = (k: keyof typeof d) => (v: string) => setD((x) => ({ ...x, [k]: v }));

  async function save() {
    setError("");
    try {
      await crmApi.updateProject(p.id, d);
      await done(t("تم حفظ البيانات", "Details saved"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    }
  }
  async function changeStatus() {
    setError("");
    try {
      await crmApi.setStatus(p.id, status, note || undefined);
      setNote("");
      await done(t("تم تحديث الحالة", "Status updated"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title={t("بيانات المشروع", "Project details")} className="lg:col-span-2">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={t("الاسم", "Name")}>
            <input className={inputCls} value={d.name} onChange={(e) => set("name")(e.target.value)} />
          </Field>
          <Field label={t("الرمز", "Code")}>
            <input className={inputCls} dir="ltr" value={d.code} onChange={(e) => set("code")(e.target.value)} />
          </Field>
          <Field label={t("الموقع", "Location")}>
            <input className={inputCls} value={d.landLocation} onChange={(e) => set("landLocation")(e.target.value)} />
          </Field>
          <Field label={t("المدينة", "City")}>
            <input className={inputCls} value={d.city} onChange={(e) => set("city")(e.target.value)} />
          </Field>
          <Field label={t("القطعة / الحوض", "Plot / basin")}>
            <input className={inputCls} value={d.plotParcelNo} onChange={(e) => set("plotParcelNo")(e.target.value)} />
          </Field>
          <Field label={t("المساحة م²", "Area m²")}>
            <input className={inputCls} dir="ltr" value={d.landAreaSqm} onChange={(e) => set("landAreaSqm")(e.target.value)} />
          </Field>
          <Field label={t("سعر الشراء", "Purchase price")}>
            <MoneyInput value={d.purchasePrice} onChange={set("purchasePrice")} />
          </Field>
          <Field label={t("تاريخ الشراء", "Purchase date")}>
            <input type="date" className={inputCls} value={d.purchaseDate} onChange={(e) => set("purchaseDate")(e.target.value)} />
          </Field>
          <Field label={t("سعر البيع المستهدف", "Target sale price")}>
            <MoneyInput value={d.targetSalePrice} onChange={set("targetSalePrice")} />
          </Field>
          <Field label={t("تاريخ البيع المتوقع", "Expected sale date")}>
            <input type="date" className={inputCls} value={d.expectedSaleDate} onChange={(e) => set("expectedSaleDate")(e.target.value)} />
          </Field>
          <Field label={t("ملاحظات / اتفاق الشراكة", "Notes / agreement")} className="sm:col-span-2">
            <textarea className={`${inputCls} h-20 py-2`} value={d.description} onChange={(e) => set("description")(e.target.value)} />
          </Field>
        </div>
        <button className={`${btnPrimary} mt-3`} onClick={save}>
          {t("حفظ", "Save")}
        </button>
        <ErrorNote message={error} />
      </Card>
      <div className="space-y-4">
        {!p.closed ? (
          <Card title={t("مرحلة المشروع", "Project stage")}>
            <div className="space-y-2">
              <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                {MANUAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s][lang === "ar" ? 0 : 1]}
                  </option>
                ))}
              </select>
              <input className={inputCls} placeholder={t("ملاحظة (اختياري)", "Note (optional)")} value={note} onChange={(e) => setNote(e.target.value)} />
              <button className={`${btnGhost} w-full`} onClick={changeStatus} disabled={status === p.status}>
                {t("تحديث المرحلة", "Update stage")}
              </button>
            </div>
          </Card>
        ) : null}
        <Card title={t("سجل المشروع", "Project log")}>
          <ol className="space-y-3">
            {p.statusHistory.map((h) => (
              <li key={h.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <StatusPill status={h.to} />
                  <span className="text-ink-soft tabular-nums">{h.at.slice(0, 10)}</span>
                </div>
                {h.note ? <div className="mt-1">{h.note}</div> : null}
                {h.actor ? <div className="text-ink-soft">{h.actor}</div> : null}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

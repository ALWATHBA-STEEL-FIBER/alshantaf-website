"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { crmApi, type PartnerFull } from "@/lib/investApi";
import { SkeletonBlock } from "@/components/admin/EmptyState";
import { PartnerFormModal } from "./crm/PartnerForm";
import { Avatar, Card, ErrorNote, Kpi, StatusPill, btnGhost, fmt, fmtPct, toNum, useT } from "./crm/ui";

export function InvestInvestorDetail({ investorId }: { investorId: string }) {
  const { t } = useT();
  const [p, setP] = useState<PartnerFull | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [showId, setShowId] = useState(false);

  const load = useCallback(
    () =>
      crmApi
        .partner(investorId)
        .then(setP)
        .catch((err) => setError(err instanceof ApiError ? err.message : "Failed")),
    [investorId]
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (!p) return error ? <ErrorNote message={error} /> : <SkeletonBlock className="h-48 rounded-2xl max-w-5xl" />;

  async function toggleActive() {
    if (!p) return;
    await crmApi.updatePartner(p.id, { active: !p.active }).catch(() => undefined);
    await load();
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <Link href="/admin/invest/investors" className="text-xs font-bold text-ink-soft hover:text-green">
          ← {t("سجل الشركاء", "Partners")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
          <div className="flex items-center gap-3">
            <Avatar name={p.name} coordinator={p.projects.some((x) => x.role === "coordinator")} />
            <div>
              <h1 className="text-2xl font-extrabold text-green">{p.name}</h1>
              <div className="text-xs text-ink-soft">
                {p.code} · {p.kind === "company" ? t("شركة", "Company") : t("فرد", "Individual")}
                {!p.active ? ` · ${t("مؤرشف", "Archived")}` : ""}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className={btnGhost} onClick={() => setEditing(true)}>
              {t("تعديل البيانات", "Edit")}
            </button>
            <button className={btnGhost} onClick={toggleActive}>
              {p.active ? t("أرشفة", "Archive") : t("تفعيل", "Activate")}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi tone="green" label={t("رأس المال المستثمر", "Capital invested")} value={fmt(p.totals.contributedCapital, { decimals: 0 })} sub="JOD" />
        <Kpi label={t("مصاريف دفعها (مستحقة)", "Expenses to refund")} value={fmt(p.totals.outstandingReimbursements, { decimals: 0 })} />
        <Kpi tone="gold" label={t("الأرباح المحققة", "Realized profit")} value={fmt(p.totals.realizedProfit, { decimals: 0 })} sub={t("بعد خصم المنسق", "after coordinator cut")} />
        <Kpi label={t("تم استلامه", "Received")} value={fmt(p.totals.paidOut, { decimals: 0 })} />
        <Kpi tone={toNum(p.totals.toReceive) ? "red" : "default"} label={t("مستحق لم يُدفع", "Owed, unpaid")} value={fmt(p.totals.toReceive, { decimals: 0 })} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title={t("بيانات الاتصال", "Contact")}>
          <dl className="text-sm space-y-2">
            {[
              [t("الهاتف", "Phone"), p.phone],
              [t("البريد", "Email"), p.email],
              [t("المدينة", "City"), p.city],
              [t("العنوان", "Address"), p.address],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-ink-soft">{k}</dt>
                <dd className="font-medium text-end" dir="auto">{v || "—"}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-2">
              <dt className="text-ink-soft">{t("الرقم الوطني", "National ID")}</dt>
              <dd className="font-medium tabular-nums" dir="ltr">
                {p.nationalId ? (showId ? p.nationalId : `••••${p.nationalIdLast4 ?? ""}`) : "—"}
                {p.nationalId ? (
                  <button className="ms-2 text-[11px] text-green font-bold" onClick={() => setShowId((s) => !s)}>
                    {showId ? t("إخفاء", "Hide") : t("إظهار", "Show")}
                  </button>
                ) : null}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-soft">{t("الحساب البنكي", "Bank")}</dt>
              <dd className="font-medium tabular-nums" dir="ltr">{p.bankDetails ? (showId ? p.bankDetails : "••••") : "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-soft">{t("بوابة المستثمر", "Portal")}</dt>
              <dd className="font-medium" dir="ltr">{p.portal?.email ?? "—"}</dd>
            </div>
          </dl>
          {p.notes ? <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm whitespace-pre-wrap">{p.notes}</p> : null}
        </Card>

        <Card title={`${t("المشاريع", "Projects")} (${p.projects.length})`} className="lg:col-span-2">
          {p.projects.length ? (
            <div className="space-y-3">
              {p.projects.map((x) => (
                <Link key={x.id} href={`/admin/invest/projects/${x.id}`} className="block rounded-xl border border-line p-3 hover:border-gold/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-green">
                      {x.name} <span className="text-[11px] text-ink-soft font-medium">{x.code}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {x.role === "coordinator" ? (
                        <span className="text-[10px] font-bold bg-gold/15 text-green rounded px-1.5 py-0.5">{t("المنسق", "Coordinator")}</span>
                      ) : null}
                      <StatusPill status={x.status} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-center text-[11px]">
                    <div className="rounded-lg bg-surface-2 py-1.5">
                      <div className="text-ink-soft">{t("رأس المال", "Capital")}</div>
                      <div className="font-bold tabular-nums">{fmt(x.capital)}</div>
                    </div>
                    <div className="rounded-lg bg-surface-2 py-1.5">
                      <div className="text-ink-soft">{t("الحصة", "Share")}</div>
                      <div className="font-bold">{fmtPct(x.ownershipPercent)}</div>
                    </div>
                    {x.settlement ? (
                      <>
                        <div className="rounded-lg bg-gold/10 py-1.5">
                          <div className="text-ink-soft">{t("الربح قبل ← بعد الخصم", "Profit before → after")}</div>
                          <div className="font-bold tabular-nums">
                            {fmt(x.settlement.grossProfit, { decimals: 0 })} ← {fmt(x.settlement.profitShare, { decimals: 0 })}
                          </div>
                        </div>
                        <div className="rounded-lg bg-green/10 py-1.5">
                          <div className="text-ink-soft">{t("المستحق", "Payout")}</div>
                          <div className="font-bold tabular-nums text-green">
                            {fmt(x.settlement.totalPayout, { decimals: 0 })}
                            {toNum(x.settlement.paidAmount) ? " ✓" : ""}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="rounded-lg bg-surface-2 py-1.5">
                          <div className="text-ink-soft">{t("مصاريف دفعها", "Expenses paid")}</div>
                          <div className="font-bold tabular-nums">{fmt(x.expensesOutstanding)}</div>
                        </div>
                        <div className="rounded-lg bg-surface-2 py-1.5">
                          <div className="text-ink-soft">{t("خصم المنسق", "Coord. cut")}</div>
                          <div className="font-bold">{x.role === "coordinator" ? "—" : x.commissionPercent != null ? fmtPct(x.commissionPercent) : t("حسب المشروع", "project default")}</div>
                        </div>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-soft">{t("لم يشارك في أي مشروع بعد.", "Not in any project yet.")}</p>
          )}
        </Card>
      </div>

      <Card title={t("سجل الحركات المالية", "Money movements")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="text-[11px] text-ink-soft">
              <tr>
                <th className="py-2 text-start">{t("التاريخ", "Date")}</th>
                <th className="py-2 text-start">{t("المشروع", "Project")}</th>
                <th className="py-2 text-start">{t("الحركة", "Movement")}</th>
                <th className="py-2 text-start">{t("المبلغ", "Amount")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[
                ...p.contributions.map((c) => ({
                  key: c.id,
                  date: c.contributedAt,
                  project: c.projectName,
                  label: c.status !== "approved" ? t("دفعة رأس مال (معكوسة)", "Capital (reversed)") : c.kind === "withdrawal" ? t("سحب رأس مال", "Capital withdrawal") : t("دفعة رأس مال", "Capital payment"),
                  amount: c.kind === "withdrawal" ? -Number(c.amount) : Number(c.amount),
                  muted: c.status !== "approved",
                })),
                ...p.expenses.map((e) => ({
                  key: e.id,
                  date: e.expenseDate,
                  project: e.projectName,
                  label: `${t("مصروف دفعه", "Expense paid")}: ${e.title}`,
                  amount: Number(e.amount),
                  muted: e.status === "pending",
                })),
              ]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((r) => (
                  <tr key={r.key} className={r.muted ? "opacity-50" : ""}>
                    <td className="py-2 tabular-nums">{r.date}</td>
                    <td className="py-2">{r.project}</td>
                    <td className="py-2">{r.label}</td>
                    <td className={`py-2 tabular-nums font-bold ${r.amount < 0 ? "text-red-700" : ""}`}>{fmt(r.amount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing ? (
        <PartnerFormModal
          open
          partner={p}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

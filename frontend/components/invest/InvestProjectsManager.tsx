"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { crmApi, type ProjectListRow } from "@/lib/investApi";
import { SkeletonBlock } from "@/components/admin/EmptyState";
import { ErrorNote, Kpi, StatusPill, btnPrimary, fmt, fmtPct, inputCls, toNum, useT } from "./crm/ui";

export function InvestProjectsManager() {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("open");
  const [rows, setRows] = useState<ProjectListRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    const id = setTimeout(() => {
      crmApi
        .projects(q.trim() || undefined, status || undefined)
        .then((r) => !ignore && (setRows(r), setError("")))
        .catch((err) => !ignore && setError(err instanceof ApiError ? err.message : "Failed"));
    }, 200);
    return () => {
      ignore = true;
      clearTimeout(id);
    };
  }, [q, status]);

  const sum = (k: "capital" | "expensesApproved" | "projectedProfit") =>
    (rows ?? []).reduce((a, r) => a + (toNum(r.stats[k]) ?? 0), 0);

  return (
    <div className="space-y-5 max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/invest" className="text-xs font-bold text-ink-soft hover:text-green">
            ← {t("المحفظة", "Portfolio")}
          </Link>
          <h1 className="text-2xl font-extrabold text-green mt-1">{t("مشاريع الشراكة", "Partnership projects")}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/invest/investors" className="h-11 px-4 rounded-xl border border-line bg-white text-green text-sm font-bold inline-flex items-center">
            {t("سجل الشركاء", "Partners")}
          </Link>
          <Link href="/admin/invest/projects/new" className={btnPrimary}>
            + {t("مشروع جديد", "New project")}
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi tone="green" label={t("عدد المشاريع", "Projects")} value={rows?.length ?? "—"} />
        <Kpi label={t("رأس المال المستثمر", "Capital invested")} value={fmt(sum("capital"), { decimals: 0 })} sub="JOD" />
        <Kpi label={t("المصاريف المعتمدة", "Approved expenses")} value={fmt(sum("expensesApproved"), { decimals: 0 })} sub="JOD" />
        <Kpi tone="gold" label={t("الربح المتوقع", "Projected profit")} value={fmt(sum("projectedProfit"), { decimals: 0 })} sub={t("حسب سعر البيع المستهدف/الفعلي", "at target/actual sale")} />
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className={`${inputCls} flex-1 min-w-[220px]`}
          placeholder={t("ابحث باسم المشروع، الرمز، الموقع، القطعة أو اسم شريك…", "Search project, code, location, plot or partner name…")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex rounded-xl border border-line bg-white p-1">
          {[
            ["open", t("الجارية", "Open")],
            ["closed", t("المنتهية", "Closed")],
            ["", t("الكل", "All")],
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setStatus(k)}
              className={`h-9 px-4 rounded-lg text-xs font-bold ${status === k ? "bg-green text-white" : "text-ink-soft"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <ErrorNote message={error} />

      {!rows ? (
        <SkeletonBlock className="h-48 rounded-2xl" />
      ) : !rows.length ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
          <div className="text-sm text-ink-soft mb-4">{q ? t("لا نتائج", "No matches") : t("لا مشاريع بعد", "No projects yet")}</div>
          <Link href="/admin/invest/projects/new" className={btnPrimary}>
            + {t("ابدأ أول مشروع", "Start the first project")}
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {rows.map((p) => {
            const s = p.stats;
            const funded = toNum(s.fundingPercent);
            const profit = toNum(s.projectedProfit);
            return (
              <Link
                key={p.id}
                href={`/admin/invest/projects/${p.id}`}
                className="rounded-2xl border border-line bg-white p-4 hover:border-gold/60 hover:shadow-md transition block"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-extrabold text-green truncate">{p.name}</div>
                    <div className="text-[11px] text-ink-soft truncate">
                      {[p.code, p.location, p.plotParcelNo].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <StatusPill status={p.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="rounded-lg bg-surface-2 py-2">
                    <div className="text-[10px] text-ink-soft">{t("رأس المال", "Capital")}</div>
                    <div className="text-sm font-bold tabular-nums">{fmt(s.capital, { decimals: 0 })}</div>
                  </div>
                  <div className="rounded-lg bg-surface-2 py-2">
                    <div className="text-[10px] text-ink-soft">{t("المصاريف", "Expenses")}</div>
                    <div className="text-sm font-bold tabular-nums">
                      {fmt(s.expensesApproved, { decimals: 0 })}
                      {s.expensesPendingCount ? <span className="text-amber-700 text-[10px] ms-1">+{s.expensesPendingCount}</span> : null}
                    </div>
                  </div>
                  <div className={`rounded-lg py-2 ${profit != null && profit < 0 ? "bg-red-50" : "bg-green/10"}`}>
                    <div className="text-[10px] text-ink-soft">{s.actualSalePrice ? t("الربح", "Profit") : t("الربح المتوقع", "Exp. profit")}</div>
                    <div className={`text-sm font-bold tabular-nums ${profit != null && profit < 0 ? "text-red-700" : "text-green"}`}>
                      {fmt(s.projectedProfit, { decimals: 0 })}
                    </div>
                  </div>
                </div>
                {funded != null ? (
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] font-bold text-ink-soft mb-1">
                      <span>
                        {t("التمويل من سعر الشراء", "Funded of purchase")} {fmt(s.purchasePrice, { decimals: 0 })}
                      </span>
                      <span>{fmtPct(funded, 0)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div className={`h-full ${funded >= 100 ? "bg-green" : "bg-gold"}`} style={{ width: `${Math.min(100, funded)}%` }} />
                    </div>
                  </div>
                ) : null}
                <div className="mt-3 flex items-center justify-between text-[11px] text-ink-soft">
                  <span>
                    {s.partnerCount} {t("شركاء", "partners")}
                    {s.coordinator ? ` · ${t("المنسق", "Coordinator")}: ${s.coordinator.name}` : ""}
                  </span>
                  {s.projectedRoiPercent ? <span className="font-bold text-green">ROI {fmtPct(s.projectedRoiPercent, 1)}</span> : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { crmApi, type PartnerRow } from "@/lib/investApi";
import { SkeletonBlock } from "@/components/admin/EmptyState";
import { PartnerFormModal } from "./crm/PartnerForm";
import { Avatar, ErrorNote, Kpi, btnPrimary, fmt, inputCls, toNum, useT } from "./crm/ui";

export function InvestInvestorsManager() {
  const { t } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState("1");
  const [rows, setRows] = useState<PartnerRow[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let ignore = false;
    const id = setTimeout(() => {
      crmApi
        .partners(q.trim() || undefined, active || undefined)
        .then((r) => !ignore && (setRows(r), setError("")))
        .catch((err) => !ignore && setError(err instanceof ApiError ? err.message : "Failed"));
    }, 200);
    return () => {
      ignore = true;
      clearTimeout(id);
    };
  }, [q, active]);

  const totalCapital = (rows ?? []).reduce((a, r) => a + (toNum(r.totals.contributedCapital) ?? 0), 0);

  return (
    <div className="space-y-5 max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/invest" className="text-xs font-bold text-ink-soft hover:text-green">
            ← {t("المحفظة", "Portfolio")}
          </Link>
          <h1 className="text-2xl font-extrabold text-green mt-1">{t("سجل الشركاء والمستثمرين", "Partners & investors")}</h1>
        </div>
        <button className={btnPrimary} onClick={() => setCreating(true)}>
          + {t("شريك جديد", "New partner")}
        </button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Kpi tone="green" label={t("عدد الشركاء", "Partners")} value={rows?.length ?? "—"} />
        <Kpi label={t("رأس المال المستثمر", "Capital invested")} value={fmt(totalCapital, { decimals: 0 })} sub="JOD" />
        <Kpi label={t("لديهم مشاريع جارية", "With open projects")} value={(rows ?? []).filter((r) => r.openProjectCount > 0).length} />
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className={`${inputCls} flex-1 min-w-[240px]`}
          autoFocus
          placeholder={t("ابحث بالاسم، رقم الشريك (P-0007)، الهاتف، الرقم الوطني أو آخر 4 أرقام منه، البريد…", "Search name, partner no., phone, national ID (or last 4), email…")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={`${inputCls} !w-auto`} value={active} onChange={(e) => setActive(e.target.value)}>
          <option value="1">{t("النشطون", "Active")}</option>
          <option value="0">{t("المؤرشفون", "Archived")}</option>
          <option value="">{t("الكل", "All")}</option>
        </select>
      </div>

      <ErrorNote message={error} />

      {!rows ? (
        <SkeletonBlock className="h-48 rounded-2xl" />
      ) : (
        <div className="rounded-2xl border border-line bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-surface-2 text-[11px] text-ink-soft">
              <tr>
                <th className="px-3 py-2.5 text-start">{t("الشريك", "Partner")}</th>
                <th className="px-3 py-2.5 text-start">{t("الهاتف", "Phone")}</th>
                <th className="px-3 py-2.5 text-start">{t("الرقم الوطني", "National ID")}</th>
                <th className="px-3 py-2.5 text-start">{t("المشاريع", "Projects")}</th>
                <th className="px-3 py-2.5 text-start">{t("رأس المال", "Capital")}</th>
                <th className="px-3 py-2.5 text-start">{t("البوابة", "Portal")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2 cursor-pointer" onClick={() => router.push(`/admin/invest/investors/${r.id}`)}>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.name} coordinator={r.coordinatorOf > 0} />
                      <div>
                        <div className="font-bold">{r.name}</div>
                        <div className="text-[11px] text-ink-soft">
                          {r.code}
                          {r.kind === "company" ? ` · ${t("شركة", "Company")}` : ""}
                          {r.city ? ` · ${r.city}` : ""}
                          {r.coordinatorOf ? ` · ${t("منسق", "Coordinator")} ×${r.coordinatorOf}` : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums" dir="ltr">{r.phone ?? "—"}</td>
                  <td className="px-3 py-2.5 tabular-nums text-ink-soft" dir="ltr">{r.nationalIdLast4 ? `••••${r.nationalIdLast4}` : "—"}</td>
                  <td className="px-3 py-2.5">
                    {r.projectCount}
                    {r.openProjectCount ? <span className="text-[11px] text-green ms-1">({r.openProjectCount} {t("جارية", "open")})</span> : null}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums font-bold">{fmt(r.totals.contributedCapital, { decimals: 0 })}</td>
                  <td className="px-3 py-2.5 text-xs">{r.portal ? <span className="text-green font-bold">✓</span> : <span className="text-ink-soft">—</span>}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-ink-soft">
                    {q ? t("لا نتائج — أضفه كشريك جديد", "No matches — add as a new partner") : t("لا شركاء بعد", "No partners yet")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {creating ? (
        <PartnerFormModal
          open
          initialName={/\d/.test(q) ? "" : q}
          onClose={() => setCreating(false)}
          onSaved={(p) => router.push(`/admin/invest/investors/${p.id}`)}
          onPickExisting={(p) => router.push(`/admin/invest/investors/${p.id}`)}
        />
      ) : null}
    </div>
  );
}

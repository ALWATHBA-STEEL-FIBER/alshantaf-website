"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { investApi, type InvestDashboard, type InvestProjectSummary } from "@/lib/investApi";
import { ApiError } from "@/lib/api";
import { EmptyState, SkeletonBlock, Spinner } from "@/components/admin/EmptyState";
import { Money } from "./Money";
import { ProjectStatusBadge } from "./ProjectStatusBadge";

function L(ar: string, en: string, lang: string) {
  return lang === "ar" ? ar : en;
}

export function InvestAdminDashboard() {
  const { lang } = useLanguage();
  const [data, setData] = useState<InvestDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    investApi
      .dashboard()
      .then((d) => {
        if (!ignore) setData(d);
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof ApiError ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const projects = (data?.projects ?? []) as InvestProjectSummary[];
  const totalKeys = data?.totals ? Object.keys(data.totals) : [];
  const countKeys = data?.counts ? Object.keys(data.counts) : [];

  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <h1 className="text-xl font-bold text-green">
          {L("شراكات الاستثمار", "Investor partnerships", lang)}
        </h1>
        <p className="text-sm text-ink-soft mt-1">
          {L("مشاريع الأراضي مع الشركاء: رأس المال، المصاريف، وتوزيع الأرباح", "Land projects with partners: capital, expenses and profit split", lang)}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/invest/projects/new"
          className="h-10 px-4 rounded-xl bg-gold text-green text-sm font-extrabold inline-flex items-center"
        >
          + {L("مشروع جديد", "New project", lang)}
        </Link>
        <Link
          href="/admin/invest/projects"
          className="h-10 px-4 rounded-xl bg-green text-white text-sm font-bold inline-flex items-center"
        >
          {L("المشاريع", "Projects", lang)}
        </Link>
        <Link
          href="/admin/invest/investors"
          className="h-10 px-4 rounded-xl border border-line bg-white text-sm font-bold inline-flex items-center"
        >
          {L("سجل الشركاء", "Partners", lang)}
        </Link>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : !data ? (
        <EmptyState title={L("لا توجد بيانات", "No data", lang)} />
      ) : (
        <>
          {totalKeys.length > 0 ? (
            <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {totalKeys.map((key) => (
                <div key={key} className="rounded-xl border border-line bg-white p-4">
                  <p className="text-[11px] font-bold text-ink-soft uppercase">{key}</p>
                  <p className="mt-2 text-lg">
                    <Money value={data.totals?.[key]} showFinalizedBadge />
                  </p>
                </div>
              ))}
            </section>
          ) : countKeys.length > 0 ? (
            <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {countKeys.map((key) => (
                <div key={key} className="rounded-xl border border-line bg-white p-4">
                  <p className="text-[11px] font-bold text-ink-soft uppercase">{key}</p>
                  <p className="mt-2 text-2xl font-bold text-green tabular-nums">{data.counts?.[key] ?? "—"}</p>
                </div>
              ))}
            </section>
          ) : (
            <EmptyState title={L("لا توجد إجماليات بعد", "No portfolio totals yet", lang)} />
          )}

          <section className="rounded-xl border border-line bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <h2 className="font-bold text-green">{L("المشاريع", "Projects", lang)}</h2>
              {loading ? <Spinner className="w-4 h-4" /> : null}
            </div>
            {projects.length === 0 ? (
              <div className="p-6">
                <EmptyState title={L("لا مشاريع", "No projects", lang)} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-start text-ink-soft border-b border-line">
                      <th className="py-2.5 px-4 font-bold">{L("الاسم", "Name", lang)}</th>
                      <th className="py-2.5 px-4 font-bold">{L("الحالة", "Status", lang)}</th>
                      <th className="py-2.5 px-4 font-bold" />
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.id} className="border-b border-line/60 last:border-0">
                        <td className="py-2.5 px-4 font-medium">{p.name}</td>
                        <td className="py-2.5 px-4">
                          <ProjectStatusBadge status={p.status} />
                        </td>
                        <td className="py-2.5 px-4 text-end">
                          <Link
                            href={`/admin/invest/projects/${p.id}`}
                            className="text-green font-bold text-xs hover:underline"
                          >
                            {L("فتح", "Open", lang)}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
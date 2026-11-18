"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageProvider";
import { investApi, type InvestPortalProject } from "@/lib/investApi";
import { ApiError } from "@/lib/api";
import { EmptyState, SkeletonBlock } from "@/components/admin/EmptyState";
import { Money } from "./Money";
import { OwnershipChart } from "./OwnershipChart";
import { ProjectStatusBadge } from "./ProjectStatusBadge";

function L(ar: string, en: string, lang: string) {
  return lang === "ar" ? ar : en;
}

export function InvestorPortalProject({ projectId }: { projectId: string }) {
  const { lang } = useLanguage();
  const router = useRouter();
  const [data, setData] = useState<InvestPortalProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    investApi
      .portalProject(projectId)
      .then((d) => {
        if (!ignore) setData(d);
      })
      .catch((err) => {
        if (!ignore) {
          if (err instanceof ApiError && err.status === 401) {
            router.replace("/investor/login");
            return;
          }
          setError(err instanceof ApiError ? err.message : "Failed");
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [projectId, router]);

  const p = data?.project;
  const totalKeys = data?.totals ? Object.keys(data.totals) : [];

  return (
    <div className="space-y-6">
      <Link href="/investor" className="text-xs font-bold text-ink-soft hover:text-green">
        ← {L("اللوحة", "Dashboard", lang)}
      </Link>

      {loading ? (
        <SkeletonBlock className="h-32 rounded-xl" />
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : !data || !p ? (
        <EmptyState title={L("لا وصول لهذا المشروع", "No access to this project", lang)} />
      ) : (
        <>
          <header className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-green">{p.name}</h1>
            <ProjectStatusBadge status={p.status} />
          </header>

          {data.membership ? (
            <div className="rounded-xl border border-line bg-white p-4 text-sm grid sm:grid-cols-2 gap-2">
              <div>
                <span className="text-xs font-bold text-ink-soft">{L("نسبتك", "Your share", lang)}</span>
                <p className="font-bold tabular-nums">{data.membership.ownershipPercent ?? "—"}%</p>
              </div>
              <div>
                <span className="text-xs font-bold text-ink-soft">{L("الدور", "Role", lang)}</span>
                <p>{data.membership.role || "—"}</p>
              </div>
            </div>
          ) : null}

          {totalKeys.length > 0 ? (
            <dl className="grid sm:grid-cols-2 gap-3">
              {totalKeys.map((key) => (
                <div key={key} className="rounded-xl border border-line bg-white p-3">
                  <dt className="text-[11px] font-bold text-ink-soft uppercase">{key}</dt>
                  <dd className="mt-1">
                    <Money value={data.totals?.[key]} showFinalizedBadge />
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <EmptyState title={L("لا إجماليات", "No totals", lang)} />
          )}

          <OwnershipChart slices={data.ownership} emptyLabel={L("لا بيانات ملكية", "No ownership data", lang)} />

          {data.contributions?.length ? (
            <section className="rounded-xl border border-line bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-line font-bold text-green text-sm">
                {L("مساهماتي", "My contributions", lang)}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-ink-soft">
                    <th className="py-2 px-4 text-start">{L("المبلغ", "Amount", lang)}</th>
                    <th className="py-2 px-4 text-start">{L("الحالة", "Status", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.contributions.map((c) => (
                    <tr key={c.id} className="border-b border-line/50">
                      <td className="py-2 px-4">
                        <Money value={c.amount} showFinalizedBadge />
                      </td>
                      <td className="py-2 px-4 text-ink-soft">{c.status || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : (
            <EmptyState title={L("لا مساهمات مسجّلة", "No contributions on file", lang)} />
          )}
        </>
      )}
    </div>
  );
}
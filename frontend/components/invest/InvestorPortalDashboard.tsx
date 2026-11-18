"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageProvider";
import { investApi, type InvestPortalDashboard, type InvestProjectSummary } from "@/lib/investApi";
import { ApiError } from "@/lib/api";
import { EmptyState, SkeletonBlock } from "@/components/admin/EmptyState";
import { Money } from "./Money";
import { ProjectStatusBadge } from "./ProjectStatusBadge";

function L(ar: string, en: string, lang: string) {
  return lang === "ar" ? ar : en;
}

export function InvestorPortalDashboard() {
  const { lang } = useLanguage();
  const router = useRouter();
  const [data, setData] = useState<InvestPortalDashboard | null>(null);
  const [projects, setProjects] = useState<InvestProjectSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    Promise.all([investApi.portalMe(), investApi.portalDashboard(), investApi.portalProjects()])
      .then(([, dash, list]) => {
        if (!ignore) {
          setData(dash);
          setProjects(list);
        }
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
  }, [router]);

  const totalKeys = data?.totals ? Object.keys(data.totals) : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-green">{L("لوحتي", "My dashboard", lang)}</h1>
        <p className="text-sm text-ink-soft mt-1">
          {L("بياناتك فقط — من واجهة بوابة المستثمر", "Your data only — from investor portal API", lang)}
        </p>
      </header>

      {loading ? (
        <SkeletonBlock className="h-28 rounded-xl" />
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : (
        <>
          {totalKeys.length > 0 ? (
            <section className="grid sm:grid-cols-2 gap-3">
              {totalKeys.map((key) => (
                <div key={key} className="rounded-xl border border-line bg-white p-4">
                  <p className="text-[11px] font-bold text-ink-soft uppercase">{key}</p>
                  <p className="mt-2">
                    <Money value={data?.totals?.[key]} showFinalizedBadge />
                  </p>
                </div>
              ))}
            </section>
          ) : (
            <EmptyState title={L("لا إجماليات بعد", "No totals yet", lang)} />
          )}

          <section className="rounded-xl border border-line bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-line">
              <h2 className="font-bold text-green">{L("مشاريعي", "My projects", lang)}</h2>
            </div>
            {!projects?.length ? (
              <div className="p-6">
                <EmptyState title={L("لا مشاريع مرتبطة", "No linked projects", lang)} />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-ink-soft">
                    <th className="py-2 px-4 text-start">{L("المشروع", "Project", lang)}</th>
                    <th className="py-2 px-4 text-start">{L("الحالة", "Status", lang)}</th>
                    <th className="py-2 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id} className="border-b border-line/50">
                      <td className="py-2 px-4 font-medium">{p.name}</td>
                      <td className="py-2 px-4">
                        <ProjectStatusBadge status={p.status} />
                      </td>
                      <td className="py-2 px-4 text-end">
                        <Link href={`/investor/projects/${p.id}`} className="text-green font-bold text-xs">
                          {L("عرض", "View", lang)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
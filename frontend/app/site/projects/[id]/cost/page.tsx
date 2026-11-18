"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { SiteProjectCostSummary } from "@/lib/types";
import { SiteAuthGateWithName } from "@/components/site/SiteAuthGate";
import { SiteShell } from "@/components/site/SiteShell";
import { ProjectCostBoard } from "@/components/site/ProjectCostBoard";

function CostInner() {
  const params = useParams();
  const projectId = String(params.id || "");
  const [cost, setCost] = useState<SiteProjectCostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCost(await api.sitePortalProjectCostSummary(projectId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر التحميل");
      setCost(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SiteShell
      title={cost?.project.name || "تكاليف المشروع"}
      subtitle="مصاريف + أجور الحضور + الموازنة"
      backHref={`/site/projects/${projectId}`}
      showLogout
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href={`/site/projects/${projectId}`}
          className="h-10 px-3 rounded-xl bg-white border border-[#e4ddd0] text-sm font-bold inline-flex items-center"
        >
          الحضور اليومي
        </Link>
        <Link
          href={`/site/expenses/new?scope=PROJECT&projectId=${projectId}&back=${encodeURIComponent(`/site/projects/${projectId}/cost`)}`}
          className="h-10 px-3 rounded-xl bg-[#0f342f] text-white text-sm font-bold inline-flex items-center"
        >
          + مصروف مشروع
        </Link>
        <Link
          href={`/site/expenses?projectId=${projectId}&month=all`}
          className="h-10 px-3 rounded-xl bg-white border border-[#e4ddd0] text-sm font-bold inline-flex items-center"
        >
          كل المصاريف
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-[#5a6b66]">جاري التحميل…</div>
      ) : error ? (
        <div className="text-sm text-red-700 font-bold">{error}</div>
      ) : cost ? (
        <ProjectCostBoard cost={cost} lang="ar" projectId={projectId} />
      ) : null}
    </SiteShell>
  );
}

export default function SiteProjectCostPage() {
  return (
    <SiteAuthGateWithName>{() => <CostInner />}</SiteAuthGateWithName>
  );
}

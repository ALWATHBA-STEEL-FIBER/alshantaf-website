"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { SiteEngineerExpenseSummary, SiteProjectSummary } from "@/lib/types";
import { SiteAuthGateWithName } from "@/components/site/SiteAuthGate";
import { SiteShell } from "@/components/site/SiteShell";
import { todayLocalISO } from "@/lib/siteDates";
import { jod, monthLabel } from "@/components/site/expenseUi";

function ProjectsHome({ engineerName }: { engineerName: string }) {
  const [projects, setProjects] = useState<SiteProjectSummary[]>([]);
  const [summary, setSummary] = useState<SiteEngineerExpenseSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const today = todayLocalISO();

  useEffect(() => {
    let ignore = false;
    Promise.all([api.siteMyProjects(), api.siteExpenseSummary().catch(() => null)])
      .then(([rows, s]) => {
        if (ignore) return;
        setProjects(rows);
        setSummary(s);
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof ApiError ? err.message : "تعذّر تحميل المشاريع");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const spend = new Map(summary?.projects.map((p) => [p.id, p]) || []);
  const led = projects.filter((p) => p.isCoordinator);
  const others = projects.filter((p) => !p.isCoordinator);

  const card = (p: SiteProjectSummary) => {
    const s = spend.get(p.id);
    const pct = s?.budgetUsedPct ?? null;
    return (
      <div
        key={p.id}
        className="rounded-2xl bg-white border border-[#e4ddd0] shadow-[0_10px_30px_-24px_rgba(15,52,47,0.45)] overflow-hidden"
      >
        <Link href={`/site/projects/${p.id}?date=${today}`} className="block p-4 active:bg-[#f7f4ee]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-extrabold text-[#0f342f] truncate" style={{ fontFamily: "var(--font-brand), sans-serif" }}>
                {p.name}
              </div>
              <div className="text-xs text-[#5a6b66] mt-0.5">
                {p.code ? `${p.code} · ` : ""}
                {p.workerCount} عامل
                {p.coordinator && !p.isCoordinator ? ` · المنسق: ${p.coordinator.name}` : ""}
              </div>
            </div>
            {s ? (
              <div className="text-end shrink-0">
                <div className="text-[10px] text-[#5a6b66]">التكلفة الكلية</div>
                <div className="text-sm font-extrabold text-[#0f342f]">{jod(s.grandTotal, { decimals: false })}</div>
              </div>
            ) : null}
          </div>
          {s ? (
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div className="rounded-lg bg-[#f7f4ee] py-1.5">
                <div className="text-[10px] text-[#5a6b66]">مصاريف الشهر</div>
                <div className="text-xs font-bold">{jod(s.expensesMonth, { decimals: false })}</div>
              </div>
              <div className="rounded-lg bg-[#f7f4ee] py-1.5">
                <div className="text-[10px] text-[#5a6b66]">كل المصاريف</div>
                <div className="text-xs font-bold">{jod(s.expensesTotal, { decimals: false })}</div>
              </div>
              <div className="rounded-lg bg-[#f7f4ee] py-1.5">
                <div className="text-[10px] text-[#5a6b66]">أجور العمال</div>
                <div className="text-xs font-bold">{jod(s.laborTotal, { decimals: false })}</div>
              </div>
            </div>
          ) : null}
          {pct != null ? (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] font-bold text-[#5a6b66] mb-1">
                <span>من الميزانية {jod(s?.budget, { decimals: false })}</span>
                <span className={pct > 100 ? "text-red-700" : ""}>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#f3f1eb] overflow-hidden">
                <div
                  className={`h-full rounded-full ${pct > 100 ? "bg-red-600" : pct > 85 ? "bg-[#d4a84b]" : "bg-[#0f342f]"}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          ) : null}
        </Link>
        <div className="grid grid-cols-2 border-t border-[#eee8dc] text-xs font-bold">
          <Link href={`/site/projects/${p.id}?date=${today}`} className="h-11 flex items-center justify-center text-[#0f342f] border-e border-[#eee8dc]">
            تسجيل الحضور
          </Link>
          <Link
            href={`/site/expenses/new?scope=PROJECT&projectId=${p.id}&back=${encodeURIComponent("/site")}`}
            className="h-11 flex items-center justify-center text-[#0f342f] bg-[#d4a84b]/15"
          >
            + مصروف للمشروع
          </Link>
        </div>
      </div>
    );
  };

  return (
    <SiteShell title="بوابة المهندس" subtitle={engineerName} showLogout nav="home">
      <div className="mb-4">
        <div className="text-xs font-bold text-[#5a6b66]">أهلاً {engineerName}</div>
        <div className="text-2xl font-extrabold text-[#0f342f] mt-1" style={{ fontFamily: "var(--font-brand), sans-serif" }}>
          {today}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link
          href={`/site/expenses/new?scope=PROJECT&back=${encodeURIComponent("/site")}`}
          className="rounded-2xl bg-[#0f342f] text-white p-4 active:scale-[0.98] transition"
        >
          <div className="text-2xl leading-none">＋</div>
          <div className="font-extrabold mt-2 text-sm">مصروف مشروع</div>
          <div className="text-[10px] text-white/70 mt-0.5">مواد، معدات، نقل…</div>
        </Link>
        <Link
          href={`/site/expenses/new?scope=COMPANY&back=${encodeURIComponent("/site")}`}
          className="rounded-2xl bg-[#d4a84b] text-[#0f342f] p-4 active:scale-[0.98] transition"
        >
          <div className="text-2xl leading-none">＋</div>
          <div className="font-extrabold mt-2 text-sm">مصروف شركة</div>
          <div className="text-[10px] text-[#0f342f]/70 mt-0.5">مكتب، سيارات، رواتب…</div>
        </Link>
      </div>

      {summary ? (
        <Link href="/site/expenses" className="block rounded-2xl bg-white border border-[#e4ddd0] p-4 mb-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-[#5a6b66]">{monthLabel(summary.month)}</div>
            <div className="text-xs font-bold text-[#0f342f]">عرض الكل ←</div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div>
              <div className="text-[10px] text-[#5a6b66]">مصاريف مشاريعي</div>
              <div className="font-extrabold text-[#0f342f]">{jod(summary.monthProjects, { decimals: false })}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#5a6b66]">مصاريف الشركة</div>
              <div className="font-extrabold text-[#0f342f]">{jod(summary.monthCompanyMine, { decimals: false })}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#5a6b66]">إدخالاتي</div>
              <div className="font-extrabold text-[#0f342f]">{jod(summary.monthMine, { decimals: false })}</div>
            </div>
          </div>
        </Link>
      ) : null}

      {loading ? (
        <div className="text-sm text-[#5a6b66]">جاري التحميل…</div>
      ) : error ? (
        <div className="text-sm text-red-700 font-bold">{error}</div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d9d2c4] bg-white/60 p-6 text-sm text-[#5a6b66]">
          لا توجد مشاريع معيّنة لك بعد. يمكنك تسجيل مصاريف الشركة، وتواصل مع الإدارة لتخصيص المشاريع.
        </div>
      ) : (
        <div className="space-y-6">
          {led.length > 0 ? (
            <section>
              <h2 className="text-sm font-extrabold text-[#0f342f] mb-2">مشاريعي كمنسق ({led.length})</h2>
              <div className="flex flex-col gap-3">{led.map(card)}</div>
            </section>
          ) : null}
          {others.length > 0 ? (
            <section>
              <h2 className="text-sm font-extrabold text-[#0f342f] mb-2">
                {led.length ? `مشاريع أخرى (${others.length})` : `المشاريع (${others.length})`}
              </h2>
              <div className="flex flex-col gap-3">{others.map(card)}</div>
            </section>
          ) : null}
        </div>
      )}
    </SiteShell>
  );
}

export default function SiteHomePage() {
  return (
    <SiteAuthGateWithName>{({ name }) => <ProjectsHome engineerName={name} />}</SiteAuthGateWithName>
  );
}

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { SiteExpense, SiteExpenseMeta, SiteExpenseSummary } from "@/lib/types";
import { SiteAuthGateWithName } from "@/components/site/SiteAuthGate";
import { SiteShell } from "@/components/site/SiteShell";
import { todayLocalISO } from "@/lib/siteDates";
import { categoryColor, categoryIcon, dayHeading, jod, monthLabel, monthRange, shiftMonth } from "@/components/site/expenseUi";

type Tab = "all" | "PROJECT" | "COMPANY" | "mine";

function ExpensesList({ engineerName }: { engineerName: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const today = todayLocalISO();
  const [meta, setMeta] = useState<SiteExpenseMeta | null>(null);
  const [items, setItems] = useState<SiteExpense[]>([]);
  const [summary, setSummary] = useState<SiteExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>((sp.get("tab") as Tab) || "all");
  const [projectId, setProjectId] = useState(sp.get("projectId") || "");
  const [month, setMonth] = useState<string>(sp.get("month") || today.slice(0, 7));
  const [q, setQ] = useState("");
  const [savedId] = useState(sp.get("saved"));

  useEffect(() => {
    api.siteExpenseMeta().then(setMeta).catch(() => undefined);
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    const range = month === "all" ? { from: undefined, to: undefined } : monthRange(month);
    api
      .siteExpenses({
        scope: tab === "PROJECT" || tab === "COMPANY" ? tab : undefined,
        mine: tab === "mine" ? "1" : undefined,
        projectId: projectId || undefined,
        from: range.from,
        to: range.to,
      })
      .then((res) => {
        if (ignore) return;
        setItems(res.items);
        setSummary(res.summary);
        setError("");
      })
      .catch((err) => !ignore && setError(err instanceof ApiError ? err.message : "تعذّر التحميل"))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [tab, projectId, month]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (tab !== "all") params.set("tab", tab);
    if (projectId) params.set("projectId", projectId);
    if (month !== today.slice(0, 7)) params.set("month", month);
    const qs = params.toString();
    router.replace(`/site/expenses${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [tab, projectId, month, router, today]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (e) =>
        e.description.toLowerCase().includes(s) ||
        (e.vendor || "").toLowerCase().includes(s) ||
        (e.project?.name || "").toLowerCase().includes(s) ||
        e.categoryLabel.includes(s)
    );
  }, [items, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, { items: SiteExpense[]; total: number }>();
    for (const e of visible) {
      const g = map.get(e.expenseDate) || { items: [], total: 0 };
      g.items.push(e);
      g.total += Number(e.amount);
      map.set(e.expenseDate, g);
    }
    return [...map.entries()];
  }, [visible]);

  const newHref = `/site/expenses/new?${new URLSearchParams({
    ...(tab === "COMPANY" ? { scope: "COMPANY" } : {}),
    ...(projectId ? { scope: "PROJECT", projectId } : {}),
  }).toString()}`;

  const maxCat = Math.max(1, ...(summary?.byCategory.map((c) => Number(c.amount)) || [1]));

  return (
    <SiteShell title="المصاريف" subtitle={engineerName} showLogout nav="expenses">
      {savedId ? (
        <div className="mb-4 rounded-xl bg-[#0f342f] text-white px-4 py-3 text-sm font-bold">تم حفظ المصروف ✓</div>
      ) : null}

      {/* Month switcher */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          className="h-10 w-10 rounded-full bg-white border border-[#e4ddd0] font-bold"
          onClick={() => setMonth((m) => (m === "all" ? today.slice(0, 7) : shiftMonth(m, -1)))}
          aria-label="الشهر السابق"
        >
          →
        </button>
        <button
          type="button"
          className="text-center"
          onClick={() => setMonth((m) => (m === "all" ? today.slice(0, 7) : "all"))}
        >
          <div className="font-extrabold text-[#0f342f]" style={{ fontFamily: "var(--font-brand), sans-serif" }}>
            {month === "all" ? "كل الفترات" : monthLabel(month)}
          </div>
          <div className="text-[10px] text-[#5a6b66]">{month === "all" ? "اضغط لهذا الشهر" : "اضغط لعرض الكل"}</div>
        </button>
        <button
          type="button"
          className="h-10 w-10 rounded-full bg-white border border-[#e4ddd0] font-bold disabled:opacity-30"
          disabled={month === "all" || month >= today.slice(0, 7)}
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          aria-label="الشهر التالي"
        >
          ←
        </button>
      </div>

      {/* Totals */}
      <div className="rounded-2xl bg-[#0f342f] text-white p-4 mb-3">
        <div className="text-xs text-white/70 font-bold">الإجمالي</div>
        <div className="text-3xl font-extrabold mt-0.5" style={{ fontFamily: "var(--font-brand), sans-serif" }}>
          {jod(summary?.total)} <span className="text-sm text-white/70">د.أ</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="rounded-xl bg-white/10 py-2">
            <div className="text-[10px] text-white/70">مشاريع</div>
            <div className="text-sm font-bold">{jod(summary?.projectTotal)}</div>
          </div>
          <div className="rounded-xl bg-white/10 py-2">
            <div className="text-[10px] text-white/70">شركة</div>
            <div className="text-sm font-bold">{jod(summary?.companyTotal)}</div>
          </div>
          <div className="rounded-xl bg-white/10 py-2">
            <div className="text-[10px] text-white/70">عدد</div>
            <div className="text-sm font-bold">{summary?.count ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2 -mx-1 px-1">
        {(
          [
            ["all", "الكل"],
            ["PROJECT", "المشاريع"],
            ["COMPANY", "الشركة"],
            ["mine", "إدخالاتي"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setTab(k);
              if (k === "COMPANY") setProjectId("");
            }}
            className={`h-9 px-4 rounded-full text-[13px] font-bold shrink-0 border ${
              tab === k ? "bg-[#0f342f] text-white border-[#0f342f]" : "bg-white text-[#0f342f] border-[#e4ddd0]"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab !== "COMPANY" && meta && meta.projects.length > 1 ? (
        <select
          className="w-full h-11 rounded-xl border border-[#d9d2c4] bg-white px-3 text-sm mb-2"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">كل المشاريع</option>
          {meta.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isCoordinator ? " (منسق)" : ""}
            </option>
          ))}
        </select>
      ) : null}
      <input
        className="w-full h-11 rounded-xl border border-[#d9d2c4] bg-white px-3 text-sm mb-4"
        placeholder="بحث بالوصف، المورّد، المشروع…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {/* Category breakdown */}
      {summary && summary.byCategory.length > 0 ? (
        <details className="mb-4 rounded-2xl bg-white border border-[#e4ddd0]">
          <summary className="px-4 h-11 flex items-center text-sm font-bold text-[#0f342f] cursor-pointer">
            توزيع حسب التصنيف
          </summary>
          <div className="px-4 pb-4 space-y-2">
            {summary.byCategory.map((c) => (
              <div key={c.key}>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>{c.label}</span>
                  <span>{jod(c.amount)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#f3f1eb] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(Number(c.amount) / maxCat) * 100}%`, backgroundColor: categoryColor(c.key) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {loading ? (
        <div className="text-sm text-[#5a6b66]">جاري التحميل…</div>
      ) : error ? (
        <div className="text-sm text-red-700 font-bold">{error}</div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d9d2c4] bg-white/60 p-8 text-center">
          <div className="text-sm text-[#5a6b66] mb-4">لا توجد مصاريف في هذه الفترة.</div>
          <Link href={newHref} className="inline-flex h-11 px-5 items-center rounded-xl bg-[#0f342f] text-white text-sm font-bold">
            + إضافة مصروف
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, g]) => (
            <section key={date}>
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="text-xs font-extrabold text-[#5a6b66]">{dayHeading(date, today)}</div>
                <div className="text-xs font-bold text-[#5a6b66]">{jod(g.total)} د.أ</div>
              </div>
              <div className="rounded-2xl bg-white border border-[#e4ddd0] divide-y divide-[#eee8dc] overflow-hidden">
                {g.items.map((e) => (
                  <Link
                    key={e.id}
                    href={`/site/expenses/${e.id}`}
                    className={`flex items-center gap-3 px-3.5 py-3 active:bg-[#f7f4ee] ${
                      e.id === savedId ? "bg-[#d4a84b]/15" : ""
                    }`}
                  >
                    <span
                      className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center text-lg"
                      style={{ backgroundColor: `${categoryColor(e.category)}1f` }}
                      aria-hidden
                    >
                      {categoryIcon(e.category)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[#0f342f] truncate">{e.description}</div>
                      <div className="text-[11px] text-[#5a6b66] truncate">
                        {e.scope === "COMPANY" ? "🏢 الشركة" : e.project?.name}
                        {" · "}
                        {e.categoryLabel}
                        {e.engineerId !== meta?.me.id ? ` · ${e.engineer.name}` : ""}
                        {e.hasReceipt ? " · 📎" : ""}
                      </div>
                    </div>
                    <div className="text-sm font-extrabold text-[#0f342f] shrink-0" dir="ltr">
                      {jod(e.amount)}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </SiteShell>
  );
}

export default function SiteExpensesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-[#5a6b66]">جاري التحميل…</div>}>
      <SiteAuthGateWithName>{({ name }) => <ExpensesList engineerName={name} />}</SiteAuthGateWithName>
    </Suspense>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { investApi, type InvestProjectSummary } from "@/lib/investApi";
import { ApiError } from "@/lib/api";
import { EmptyState, SkeletonBlock, Spinner } from "@/components/admin/EmptyState";
import { ProjectStatusBadge } from "./ProjectStatusBadge";

const inputClass =
  "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";

function L(ar: string, en: string, lang: string) {
  return lang === "ar" ? ar : en;
}

export function InvestProjectsManager() {
  const { lang } = useLanguage();
  const [projects, setProjects] = useState<InvestProjectSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [location, setLocation] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  function reload() {
    setLoading(true);
    investApi
      .projects()
      .then(setProjects)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!name.trim()) {
      setFormError(L("الاسم مطلوب", "Name is required", lang));
      return;
    }
    setCreating(true);
    try {
      await investApi.createProject({
        name: name.trim(),
        code: code.trim() || undefined,
        location: location.trim() || undefined,
      });
      setName("");
      setCode("");
      setLocation("");
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/invest" className="text-xs font-bold text-ink-soft hover:text-green">
            ← {L("المحفظة", "Portfolio", lang)}
          </Link>
          <h1 className="text-xl font-bold text-green mt-1">{L("مشاريع الشراكة", "Partnership projects", lang)}</h1>
        </div>
      </header>

      <form onSubmit={handleCreate} className="rounded-xl border border-line bg-white p-4 space-y-3">
        <h2 className="font-bold text-green text-sm">{L("مشروع جديد", "New project", lang)}</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-ink-soft block mb-1">{L("الاسم", "Name", lang)}</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-bold text-ink-soft block mb-1">{L("الرمز", "Code", lang)}</label>
            <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold text-ink-soft block mb-1">{L("الموقع", "Location", lang)}</label>
            <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>
        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        <button
          type="submit"
          disabled={creating}
          className="h-11 px-5 rounded-xl bg-green text-white text-sm font-bold inline-flex items-center gap-2"
        >
          {creating ? <Spinner className="w-4 h-4" /> : null}
          {L("إنشاء", "Create", lang)}
        </button>
      </form>

      {loading ? (
        <SkeletonBlock className="h-40 rounded-xl" />
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : !projects?.length ? (
        <EmptyState title={L("لا مشاريع بعد", "No projects yet", lang)} />
      ) : (
        <div className="rounded-xl border border-line bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-ink-soft">
                <th className="py-2.5 px-4 text-start font-bold">{L("الاسم", "Name", lang)}</th>
                <th className="py-2.5 px-4 text-start font-bold">{L("الرمز", "Code", lang)}</th>
                <th className="py-2.5 px-4 text-start font-bold">{L("الحالة", "Status", lang)}</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-line/60">
                  <td className="py-2.5 px-4 font-medium">{p.name}</td>
                  <td className="py-2.5 px-4 text-ink-soft">{p.code || "—"}</td>
                  <td className="py-2.5 px-4">
                    <ProjectStatusBadge status={p.status} />
                  </td>
                  <td className="py-2.5 px-4 text-end">
                    <Link href={`/admin/invest/projects/${p.id}`} className="text-green font-bold text-xs">
                      {L("مساحة العمل", "Workspace", lang)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
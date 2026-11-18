"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { investApi, type InvestInvestor } from "@/lib/investApi";
import { ApiError } from "@/lib/api";
import { EmptyState, SkeletonBlock, Spinner } from "@/components/admin/EmptyState";

const inputClass =
  "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";

function L(ar: string, en: string, lang: string) {
  return lang === "ar" ? ar : en;
}

export function InvestInvestorsManager() {
  const { lang } = useLanguage();
  const [investors, setInvestors] = useState<InvestInvestor[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  function reload() {
    setLoading(true);
    investApi
      .investors()
      .then(setInvestors)
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
      await investApi.createInvestor({ name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined });
      setName("");
      setEmail("");
      setPhone("");
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <Link href="/admin/invest" className="text-xs font-bold text-ink-soft hover:text-green">
          ← {L("المحفظة", "Portfolio", lang)}
        </Link>
        <h1 className="text-xl font-bold text-green mt-1">{L("سجل المستثمرين", "Investor register", lang)}</h1>
      </header>

      <form onSubmit={handleCreate} className="rounded-xl border border-line bg-white p-4 space-y-3">
        <h2 className="font-bold text-green text-sm">{L("مستثمر جديد", "New investor", lang)}</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <input className={inputClass} placeholder={L("الاسم", "Name", lang)} value={name} onChange={(e) => setName(e.target.value)} required />
          <input className={inputClass} placeholder={L("البريد", "Email", lang)} value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={inputClass} placeholder={L("الهاتف", "Phone", lang)} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        <button type="submit" disabled={creating} className="h-11 px-5 rounded-xl bg-green text-white text-sm font-bold inline-flex gap-2 items-center">
          {creating ? <Spinner className="w-4 h-4" /> : null}
          {L("إنشاء", "Create", lang)}
        </button>
      </form>

      {loading ? (
        <SkeletonBlock className="h-40 rounded-xl" />
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : !investors?.length ? (
        <EmptyState title={L("لا مستثمرين", "No investors", lang)} />
      ) : (
        <table className="w-full text-sm rounded-xl border border-line bg-white overflow-x-auto">
          <thead>
            <tr className="border-b border-line text-ink-soft">
              <th className="py-2.5 px-4 text-start font-bold">{L("الاسم", "Name", lang)}</th>
              <th className="py-2.5 px-4 text-start font-bold">{L("البريد", "Email", lang)}</th>
              <th className="py-2.5 px-4 text-start font-bold">{L("الهاتف", "Phone", lang)}</th>
              <th className="py-2.5 px-4" />
            </tr>
          </thead>
          <tbody>
            {investors.map((inv) => (
              <tr key={inv.id} className="border-b border-line/50">
                <td className="py-2.5 px-4 font-medium">{inv.name}</td>
                <td className="py-2.5 px-4 text-ink-soft">{inv.email || "—"}</td>
                <td className="py-2.5 px-4 text-ink-soft">{inv.phone || "—"}</td>
                <td className="py-2.5 px-4 text-end">
                  <Link href={`/admin/invest/investors/${inv.id}`} className="text-green font-bold text-xs">
                    {L("الملف", "Profile", lang)}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
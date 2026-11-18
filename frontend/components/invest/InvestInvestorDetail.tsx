"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { investApi, type InvestInvestor } from "@/lib/investApi";
import { ApiError } from "@/lib/api";
import { EmptyState, SkeletonBlock, Spinner } from "@/components/admin/EmptyState";
import { Money } from "./Money";

const inputClass =
  "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";

function L(ar: string, en: string, lang: string) {
  return lang === "ar" ? ar : en;
}

export function InvestInvestorDetail({ investorId }: { investorId: string }) {
  const { lang } = useLanguage();
  const [investor, setInvestor] = useState<InvestInvestor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    investApi
      .investor(investorId)
      .then((inv) => {
        if (!ignore) {
          setInvestor(inv);
          setNotes(inv.notes || "");
          setPhone(inv.phone || "");
        }
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof ApiError ? err.message : "Failed");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [investorId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    setSaving(true);
    try {
      const updated = await investApi.updateInvestor(investorId, {
        notes: notes.trim() || null,
        phone: phone.trim() || null,
      });
      setInvestor(updated);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const totalKeys = investor?.totals ? Object.keys(investor.totals) : [];

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/admin/invest/investors" className="text-xs font-bold text-ink-soft hover:text-green">
        ← {L("المستثمرون", "Investors", lang)}
      </Link>

      {loading ? (
        <SkeletonBlock className="h-32 rounded-xl" />
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : !investor ? (
        <EmptyState title={L("غير موجود", "Not found", lang)} />
      ) : (
        <>
          <header>
            <h1 className="text-xl font-bold text-green">{investor.name}</h1>
            <p className="text-sm text-ink-soft mt-1">{investor.email || "—"}</p>
          </header>

          {totalKeys.length > 0 ? (
            <dl className="grid sm:grid-cols-2 gap-3">
              {totalKeys.map((key) => (
                <div key={key} className="rounded-xl border border-line bg-white p-3">
                  <dt className="text-[11px] font-bold text-ink-soft uppercase">{key}</dt>
                  <dd className="mt-1">
                    <Money value={investor.totals?.[key]} showFinalizedBadge />
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <EmptyState title={L("لا إجماليات للمستثمر", "No investor totals", lang)} />
          )}

          <form onSubmit={save} className="rounded-xl border border-line bg-white p-4 space-y-3">
            <h2 className="font-bold text-green text-sm">{L("تحديث الملف", "Update profile", lang)}</h2>
            <FieldInput label={L("الهاتف", "Phone", lang)} value={phone} onChange={setPhone} />
            <FieldInput label={L("ملاحظات", "Notes", lang)} value={notes} onChange={setNotes} multiline />
            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
            <button type="submit" disabled={saving} className="h-11 px-5 rounded-xl bg-green text-white text-sm font-bold inline-flex gap-2 items-center">
              {saving ? <Spinner className="w-4 h-4" /> : null}
              {L("حفظ", "Save", lang)}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-ink-soft block mb-1">{label}</label>
      {multiline ? (
        <textarea className={`${inputClass} h-24 py-2 resize-y`} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
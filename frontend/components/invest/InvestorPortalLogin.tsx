"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageProvider";
import { investApi } from "@/lib/investApi";
import { ApiError } from "@/lib/api";
import { Spinner } from "@/components/admin/EmptyState";

const inputClass =
  "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";

function L(ar: string, en: string, lang: string) {
  return lang === "ar" ? ar : en;
}

export function InvestorPortalLogin() {
  const { lang } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let ignore = false;
    investApi
      .portalMe()
      .then(() => {
        if (!ignore) router.replace("/investor");
      })
      .catch(() => {
        if (!ignore) setChecking(false);
      });
    return () => {
      ignore = true;
    };
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await investApi.portalLogin(email.trim(), password);
      router.push("/investor");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : L("فشل تسجيل الدخول", "Login failed", lang));
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-ink-soft">
        <Spinner className="w-5 h-5" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-green">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl space-y-4">
        <h1 className="text-lg font-bold text-green text-center">
          {L("تسجيل دخول المستثمر", "Investor sign in", lang)}
        </h1>
        <input
          className={inputClass}
          type="email"
          autoComplete="email"
          placeholder={L("البريد", "Email", lang)}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={inputClass}
          type="password"
          autoComplete="current-password"
          placeholder={L("كلمة المرور", "Password", lang)}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? <p className="text-sm text-red-600 text-center">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl bg-green text-white font-bold text-sm inline-flex justify-center items-center gap-2"
        >
          {loading ? <Spinner className="w-4 h-4" /> : null}
          {L("دخول", "Sign in", lang)}
        </button>
      </form>
    </div>
  );
}
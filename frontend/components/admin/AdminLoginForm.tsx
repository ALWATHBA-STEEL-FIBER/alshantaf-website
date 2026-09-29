"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { ShieldIcon } from "@/components/icons";

export function AdminLoginForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let ignore = false;
    api
      .me()
      .then(() => {
        if (!ignore) {
          const next = searchParams.get("next");
          router.replace(next && next.startsWith("/admin") ? next : "/admin");
          router.refresh();
        }
      })
      .catch(() => {
        if (!ignore) setChecking(false);
      });
    return () => {
      ignore = true;
    };
  }, [router, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.login(email, password);
      const next = searchParams.get("next");
      router.push(next && next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? t.admin.loginError : t.admin.networkError);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green text-white/80 text-sm">
        {t.admin.verifyingSession}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-green px-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -top-24 -end-20 w-80 h-80 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute bottom-0 start-0 w-[28rem] h-64 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="film-grain opacity-[0.08]" />
      </div>
      <form
        onSubmit={handleSubmit}
        className="relative bg-white rounded-3xl p-8 w-full max-w-sm flex flex-col gap-4 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.55)]"
      >
        <div>
          <div className="w-10 h-10 rounded-2xl bg-green/10 text-green flex items-center justify-center mb-3">
            <ShieldIcon className="w-5 h-5" />
          </div>
          <p className="text-gold text-xs font-bold tracking-[0.16em]">ALSHANTAF</p>
          <h1 className="text-xl font-bold text-green mt-1">{t.admin.loginTitle}</h1>
          <p className="text-xs text-ink-soft mt-1">{t.admin.loginSubtitle}</p>
        </div>
        <div>
          <label className="text-xs font-bold text-ink-soft mb-1 block">{t.admin.email}</label>
          <input
            type="email"
            className="w-full h-11 rounded-xl border border-line px-3 text-sm outline-none focus:border-gold"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="username"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-ink-soft mb-1 block">{t.admin.password}</label>
          <input
            type="password"
            className="w-full h-11 rounded-xl border border-line px-3 text-sm outline-none focus:border-gold"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
        <button type="submit" disabled={loading} className="h-11 rounded-full bg-green text-white font-bold disabled:opacity-60 hover:bg-green-2 transition-colors">
          {loading ? t.admin.loading : t.admin.login}
        </button>
        <div className="rounded-2xl border border-line bg-surface-2/80 px-3.5 py-3">
          <p className="text-[11px] font-bold text-green">{t.admin.installAdminApp}</p>
          <p className="text-[11px] text-ink-soft mt-1.5 leading-relaxed">{t.admin.installAdminAppHint}</p>
        </div>
      </form>
    </div>
  );
}

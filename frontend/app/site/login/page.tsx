"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { HardHatIcon } from "@/components/icons";

export default function SiteLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let ignore = false;
    api
      .siteMe()
      .then(() => {
        if (!ignore) {
          router.replace("/site");
          router.refresh();
        }
      })
      .catch(() => {
        if (!ignore) setChecking(false);
      });
    return () => {
      ignore = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.siteLogin(identifier.trim(), passcode);
      router.push("/site");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر الاتصال");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f342f] text-white/80 text-sm">
        جاري التحقق…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f342f] px-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
      <form
        onSubmit={handleSubmit}
        className="bg-[#f7f4ee] rounded-3xl p-7 w-full max-w-sm flex flex-col gap-4 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-[#0f342f] text-[#d4a84b] flex items-center justify-center">
            <HardHatIcon className="w-5 h-5" />
          </div>
          <div>
            <div
              className="font-extrabold text-lg text-[#0f342f]"
              style={{ fontFamily: "var(--font-brand), sans-serif" }}
            >
              حضور الموقع
            </div>
            <div className="text-xs text-[#5a6b66]">الاسم أو البريد + رمز الدخول</div>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-[#5a6b66] mb-1 block">الاسم أو البريد</label>
          <input
            type="text"
            required
            autoComplete="username"
            inputMode="text"
            className="w-full h-12 rounded-xl border border-[#d9d2c4] bg-white px-3 text-sm outline-none focus:border-[#d4a84b]"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="مثال: أحمد أو name@…"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[#5a6b66] mb-1 block">رمز الدخول</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            className="w-full h-12 rounded-xl border border-[#d9d2c4] bg-white px-3 text-sm outline-none focus:border-[#d4a84b]"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="••••"
          />
        </div>

        {error ? <p className="text-sm text-red-700 font-bold">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="h-12 rounded-xl bg-[#0f342f] text-white font-bold text-sm disabled:opacity-60"
        >
          {loading ? "جاري الدخول…" : "دخول"}
        </button>
      </form>
    </div>
  );
}

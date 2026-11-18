"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { useAnalyticsAllowed } from "@/components/CookieConsent";
import { api } from "@/lib/api";

const NAME_KEY = "alshantaf_visitor_name";
const DISMISS_KEY = "alshantaf_visitor_name_dismissed";

export function VisitorNamePrompt() {
  const { lang } = useLanguage();
  const allowed = useAnalyticsAllowed();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!allowed) return;
    let ignore = false;
    (async () => {
      try {
        if (localStorage.getItem(DISMISS_KEY) === "1") return;
        if (localStorage.getItem(NAME_KEY)?.trim()) return;
      } catch {
        return;
      }
      const me = await api.presenceMe();
      if (ignore) return;
      if (me?.named || me?.nameLocked) {
        if (me.displayName) {
          try {
            localStorage.setItem(NAME_KEY, me.displayName);
          } catch {
            /* ignore */
          }
        }
        return;
      }
      // Soft delay so it doesn't compete with cookie banner
      window.setTimeout(() => {
        if (!ignore) setOpen(true);
      }, 2500);
    })();
    return () => {
      ignore = true;
    };
  }, [allowed]);

  if (!open || !allowed) return null;

  const copy = lang === "ar"
    ? {
        title: "عرّف جهازك باسمك",
        note: "مرة واحدة واحدة فقط — نربط زيارات هذا الجهاز باسمك في لوحة المراقبة. يمكنك التخطي.",
        placeholder: "اسمك",
        save: "حفظ",
        skip: "تخطي",
        err: "أدخل اسماً صالحاً",
      }
    : {
        title: "Put your name on this device",
        note: "Once only — we tag this device’s visits under your name in the site monitor. You can skip.",
        placeholder: "Your name",
        save: "Save",
        skip: "Skip",
        err: "Enter a valid name",
      };

  async function save() {
    const trimmed = name.trim().replace(/\s+/g, " ").slice(0, 80);
    if (trimmed.length < 2) {
      setError(copy.err);
      return;
    }
    setSaving(true);
    setError("");
    try {
      localStorage.setItem(NAME_KEY, trimmed);
      await api.heartbeat({
        path: typeof window !== "undefined" ? window.location.pathname : "/",
        platform: navigator.platform || null,
        language: navigator.language || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        screen: `${screen.width}x${screen.height}`,
        name: trimmed,
      });
      setOpen(false);
    } catch {
      setError(lang === "ar" ? "تعذّر الحفظ" : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  return (
    <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] inset-x-3 z-[55] sm:inset-x-auto sm:end-4 sm:w-[22rem]">
      <div className="rounded-2xl border border-line bg-white/95 backdrop-blur shadow-[0_18px_40px_-24px_rgba(15,52,47,0.55)] p-4">
        <p className="text-sm font-bold text-green">{copy.title}</p>
        <p className="text-xs text-ink-soft mt-1 leading-relaxed">{copy.note}</p>
        <input
          className="mt-3 w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={copy.placeholder}
          maxLength={80}
          autoComplete="name"
        />
        {error ? <p className="text-[11px] text-red-600 mt-1.5">{error}</p> : null}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="h-10 flex-1 rounded-full bg-green text-white text-xs font-bold disabled:opacity-60"
          >
            {copy.save}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="h-10 px-4 rounded-full border border-line text-xs font-bold text-ink-soft"
          >
            {copy.skip}
          </button>
        </div>
      </div>
    </div>
  );
}

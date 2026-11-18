"use client";

import Script from "next/script";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { useLanguage } from "@/lib/LanguageProvider";

type Mode = "local" | "turnstile" | "loading";

export type BotGuardPayload = {
  captchaId?: string;
  captchaAnswer?: string;
  turnstileToken?: string;
  website: string;
};

export type BotGuardHandle = {
  getPayload: () => BotGuardPayload | null;
  reset: () => void;
};

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    }
  ) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type Props = {
  action: string;
  className?: string;
};

export const BotGuard = forwardRef<BotGuardHandle, Props>(function BotGuard(
  { action, className = "" },
  ref
) {
  const { lang, t } = useLanguage();
  const [mode, setMode] = useState<Mode>("loading");
  const [question, setQuestion] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [answer, setAnswer] = useState("");
  const [siteKey, setSiteKey] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const turnstileEl = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const honeypot = useRef("");

  const loadLocal = useCallback(async () => {
    setError("");
    setAnswer("");
    const res = await fetch(`/api/captcha/challenge?lang=${lang}`, { credentials: "include" });
    if (!res.ok) {
      setError(lang === "ar" ? "تعذّر تحميل التحقق" : "Could not load captcha");
      return;
    }
    const data = await res.json();
    if (data.mode === "turnstile" && data.siteKey) {
      setMode("turnstile");
      setSiteKey(data.siteKey);
      return;
    }
    setMode("local");
    setCaptchaId(data.id);
    setQuestion(data.question);
  }, [lang]);

  useEffect(() => {
    void loadLocal();
  }, [loadLocal]);

  const renderTurnstile = useCallback(() => {
    if (!turnstileEl.current || !siteKey || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(turnstileEl.current, {
      sitekey: siteKey,
      action,
      theme: "light",
      callback: (token) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(""),
    });
  }, [action, siteKey]);

  useEffect(() => {
    if (mode === "turnstile" && siteKey) renderTurnstile();
  }, [mode, siteKey, renderTurnstile]);

  useImperativeHandle(
    ref,
    () => ({
      getPayload: () => {
        if (honeypot.current.trim()) return null;
        if (mode === "turnstile") {
          if (!turnstileToken) return null;
          return { turnstileToken, website: "" };
        }
        if (mode === "local") {
          if (!captchaId || !answer.trim()) return null;
          return { captchaId, captchaAnswer: answer.trim(), website: "" };
        }
        return null;
      },
      reset: () => {
        setTurnstileToken("");
        setAnswer("");
        if (widgetId.current && window.turnstile) {
          window.turnstile.reset(widgetId.current);
        } else {
          void loadLocal();
        }
      },
    }),
    [mode, turnstileToken, captchaId, answer, loadLocal]
  );

  const label = t.botGuard.label;

  return (
    <div className={`rounded-xl border border-line bg-surface-2/80 p-3 ${className}`}>
      <p className="text-[11px] font-bold text-ink-soft mb-2">{label}</p>

      {/* Honeypot — hidden from humans */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        onChange={(e) => {
          honeypot.current = e.target.value;
        }}
      />

      {mode === "loading" && (
        <p className="text-xs text-ink-soft">{lang === "ar" ? "جارٍ التحميل…" : "Loading…"}</p>
      )}

      {mode === "local" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-green" dir="ltr">
            {question}
          </span>
          <input
            className="h-10 w-24 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-gold"
            inputMode="numeric"
            dir="ltr"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={lang === "ar" ? "الإجابة" : "Answer"}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => void loadLocal()}
            className="text-[11px] font-bold text-green hover:text-gold"
          >
            {lang === "ar" ? "تجديد" : "Refresh"}
          </button>
        </div>
      )}

      {mode === "turnstile" && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
            onReady={renderTurnstile}
          />
          <div ref={turnstileEl} />
        </>
      )}

      {error ? <p className="text-[11px] text-red-600 mt-1.5">{error}</p> : null}
    </div>
  );
});

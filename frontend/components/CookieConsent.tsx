"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import {
  COOKIE_CONSENT_KEY,
  hasAnalyticsConsent,
  readConsentFromStorage,
  writeConsent,
  type CookieConsentLevel,
} from "@/lib/cookieConsent";

export function CookieConsent() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(COOKIE_CONSENT_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function choose(level: CookieConsentLevel) {
    writeConsent(level);
    setVisible(false);
    window.dispatchEvent(new CustomEvent("alshantaf:cookie-consent", { detail: level }));
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto max-w-2xl bg-green text-white rounded-2xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] p-4 sm:p-5 flex flex-col gap-3">
        <p className="text-sm leading-relaxed">
          {t.cookieConsent.text}{" "}
          <Link href="/privacy" className="underline hover:text-gold transition-colors">
            {t.cookieConsent.learnMore}
          </Link>
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => choose("essential")}
            className="h-10 px-5 rounded-full border border-white/35 text-white font-bold text-sm hover:bg-white/10 transition-colors"
          >
            {t.cookieConsent.essentialOnly}
          </button>
          <button
            type="button"
            onClick={() => choose("all")}
            className="h-10 px-6 rounded-full bg-white text-green font-bold text-sm hover:bg-white/90 transition-colors"
          >
            {t.cookieConsent.acceptAll}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useAnalyticsAllowed() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(hasAnalyticsConsent(readConsentFromStorage()));
    sync();
    const onCustom = () => sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === COOKIE_CONSENT_KEY) sync();
    };
    window.addEventListener("alshantaf:cookie-consent", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("alshantaf:cookie-consent", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return allowed;
}

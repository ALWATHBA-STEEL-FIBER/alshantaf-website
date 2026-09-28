"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dictionary, type Lang } from "./dictionary";

interface LanguageContextValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: (typeof dictionary)[Lang];
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: React.ReactNode;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dictionary[lang].dir;
  }, [lang]);

  const toggleLanguage = useCallback(() => {
    const next: Lang = lang === "ar" ? "en" : "ar";
    setLang(next);
    document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
    try {
      window.localStorage.setItem("alshantaf-language", next);
    } catch {
      // ignore storage failures (private browsing, etc.)
    }
  }, [lang]);

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, dir: dictionary[lang].dir, t: dictionary[lang], toggleLanguage }),
    [lang, toggleLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

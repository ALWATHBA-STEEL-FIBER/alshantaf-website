"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageProvider";
import { toWesternDigits } from "@/lib/arabicDigits";

export function TrackForm({ initialCode = "" }: { initialCode?: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [code, setCode] = useState(initialCode);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = toWesternDigits(code.trim()).toUpperCase();
    if (trimmed) router.push(`/track/${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1">
        <label className="text-xs font-bold text-ink-soft mb-1 block" htmlFor="tracking-code">
          {t.trackPage.inputLabel}
        </label>
        <input
          id="tracking-code"
          dir="ltr"
          className="w-full h-12 rounded-xl border border-line bg-surface-2 px-4 text-sm font-mono outline-none focus:border-gold"
          value={code}
          onChange={(e) => setCode(toWesternDigits(e.target.value))}
          placeholder={t.trackPage.inputPlaceholder}
          required
        />
      </div>
      <button type="submit" className="h-12 mt-5 sm:mt-6 px-8 rounded-full bg-green text-white font-bold hover:bg-green-2 transition-colors shrink-0">
        {t.trackPage.submitCta}
      </button>
    </form>
  );
}

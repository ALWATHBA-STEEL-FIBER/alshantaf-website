"use client";

import { useLanguage } from "@/lib/LanguageProvider";
import { importanceBadgeClass, isPremiumImportance } from "@/lib/offerImportance";
import type { OfferImportance } from "@/lib/types";

export function OfferImportanceBadge({
  importance,
  className = "",
}: {
  importance: OfferImportance | null | undefined;
  className?: string;
}) {
  const { t } = useLanguage();
  if (!isPremiumImportance(importance)) return null;
  return (
    <span
      className={`inline-flex items-center text-[9px] sm:text-[10px] font-bold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full tracking-wide ${importanceBadgeClass(importance)} ${className}`}
    >
      {t.offers.importance[importance]}
    </span>
  );
}

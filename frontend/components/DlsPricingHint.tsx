"use client";

import { useLanguage } from "@/lib/LanguageProvider";
import { adminMedianEstimate, formatAreaSqm, formatMoney, parseAreaSqm } from "@/lib/adminPricing";

type Props = {
  ratePerSqm: number;
  /** Cadastral area in m² when known from DLS; falls back to parsing `sizeLabel`. */
  areaSqm?: number | null;
  sizeLabel?: string | null;
  source?: string | null;
  retrievedAt?: string | null;
  className?: string;
  /** When false, hide the mid-range (rate × area) total on public offers. */
  showMedian?: boolean;
};

/** Official DLS rate + optional median estimate (rate × area). */
export function DlsPricingHint({
  ratePerSqm,
  areaSqm,
  sizeLabel,
  source,
  retrievedAt,
  className,
  showMedian = true,
}: Props) {
  const { t, lang } = useLanguage();
  const effectiveArea = areaSqm && areaSqm > 0 ? areaSqm : parseAreaSqm(sizeLabel);
  const median = showMedian && effectiveArea ? adminMedianEstimate(ratePerSqm, effectiveArea) : null;
  const currency = t.owners.dlsHintCurrency;

  return (
    <div className={className ?? "mt-2 rounded-xl bg-gold/10 border border-gold/30 px-3 py-2.5 text-[11px] text-ink-soft leading-relaxed"}>
      <p className="font-bold text-ink">
        {t.owners.dlsHintPrefix}{" "}
        <span className="tabular-nums" dir="ltr">
          {formatMoney(ratePerSqm, lang)} {currency}
        </span>{" "}
        {t.owners.dlsHintPerSqm}
      </p>
      {showMedian ? (
        median != null && effectiveArea != null ? (
          <p className="font-bold text-green mt-1.5">
            {t.owners.dlsHintMedianPrefix}{" "}
            <span className="tabular-nums" dir="ltr">
              {formatMoney(median, lang)} {currency}
            </span>
            <span className="font-normal text-ink-soft">
              {" "}
              ({formatAreaSqm(effectiveArea, lang)} × {formatMoney(ratePerSqm, lang)})
            </span>
          </p>
        ) : (
          <p className="mt-1.5">{t.owners.dlsHintMedianWaiting}</p>
        )
      ) : null}
      <p className="mt-1.5">{t.owners.dlsHintNote}</p>
      {(source || retrievedAt) && (
        <p className="mt-1 text-[10px]" dir="ltr">
          {[source, retrievedAt ? new Date(retrievedAt).toLocaleDateString() : null].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

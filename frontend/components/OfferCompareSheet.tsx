"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { formatPricePerSqmLabel } from "@/lib/adminPricing";
import {
  localizeListingTitle,
  localizePlaceName,
  localizePropertyType,
  localizeSizeLabel,
} from "@/lib/localizePlace";
import { CloseIcon } from "@/components/icons";
import type { Listing } from "@/lib/types";

type Row = { label: string; a: string; b: string };

export function OfferCompareSheet({
  left,
  right,
  onClose,
  onClear,
}: {
  left: Listing;
  right: Listing;
  onClose: () => void;
  onClear: () => void;
}) {
  const { t, lang } = useLanguage();

  const cell = (offer: Listing) => ({
    title: localizeListingTitle(offer.title, lang),
    area: offer.area ? localizePlaceName(offer.area, lang) : t.offers.areaFallback,
    size: localizeSizeLabel(offer.size, lang) || t.offers.onRequest,
    price: formatPricePerSqmLabel(offer.price, lang) || t.offers.onRequest,
    industry: t.offers.industry[offer.industryType] || "—",
    status: t.offers.status[offer.status] || "—",
    type: localizePropertyType(offer.propertyType, lang, t.offers.propertyTypeFallback),
    deal: offer.dealType || t.offers.dealTypeFallback,
    listingNo: offer.listingNo,
    admin:
      offer.administrativeValue != null
        ? `${offer.administrativeValue.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO")} ${t.offers.administrativeValueCurrency}${t.offers.administrativeValuePerSqm}`
        : t.offers.onRequest,
  });

  const A = cell(left);
  const B = cell(right);
  const rows: Row[] = [
    { label: t.offers.compareRef, a: A.listingNo, b: B.listingNo },
    { label: t.offers.filterArea, a: A.area, b: B.area },
    { label: t.offers.size, a: A.size, b: B.size },
    { label: t.offers.price, a: A.price, b: B.price },
    { label: t.offers.industryLabel, a: A.industry, b: B.industry },
    { label: t.offers.statusLabel, a: A.status, b: B.status },
    { label: t.offers.type, a: A.type, b: B.type },
    { label: t.offers.compareDeal, a: A.deal, b: B.deal },
    { label: t.offers.administrativeValueLabel, a: A.admin, b: B.admin },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/50" role="dialog" aria-modal="true" aria-label={t.offers.compareTitle}>
      <button type="button" className="absolute inset-0" aria-label={t.offers.compareClose} onClick={onClose} />
      <div className="relative mt-auto max-h-[92dvh] w-full overflow-hidden rounded-t-3xl bg-[#f7f5f0] shadow-2xl sm:mx-auto sm:mb-6 sm:mt-auto sm:max-w-3xl sm:rounded-3xl flex flex-col">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-green px-4 py-3.5 text-white pt-[max(0.875rem,env(safe-area-inset-top,0px))]">
          <div className="min-w-0">
            <p className="text-sm font-bold">{t.offers.compareTitle}</p>
            <p className="mt-0.5 text-[11px] text-white/75">{t.offers.compareSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-full p-1.5 text-white/85 hover:bg-white/10"
            aria-label={t.offers.compareClose}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <div className="mb-3 grid grid-cols-2 gap-2">
            {[left, right].map((offer) => {
              const title = localizeListingTitle(offer.title, lang);
              return (
                <article key={offer.id} className="overflow-hidden rounded-2xl border border-line bg-white">
                  <div className="relative h-24 bg-surface-2 sm:h-28">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={offer.mainImage || "/industrial-clean-wide.webp"}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="space-y-1 p-2.5">
                    <p dir="ltr" className="font-mono text-[10px] text-ink-soft">
                      {offer.listingNo}
                    </p>
                    <h3 className="text-xs font-bold leading-snug text-green line-clamp-2 sm:text-sm">{title}</h3>
                    <Link
                      href={`/offers/${offer.id}`}
                      className="mt-1 inline-flex min-h-9 items-center text-[11px] font-bold text-green"
                    >
                      {t.offers.details}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {rows.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-[5.5rem_1fr_1fr] gap-1.5 px-2.5 py-2.5 text-[11px] leading-snug sm:grid-cols-[8rem_1fr_1fr] sm:gap-3 sm:px-3 sm:text-xs ${
                  i > 0 ? "border-t border-line" : ""
                }`}
              >
                <span className="font-bold text-ink-soft">{row.label}</span>
                <span className="font-semibold text-ink [overflow-wrap:anywhere]">{row.a}</span>
                <span className="font-semibold text-ink [overflow-wrap:anywhere]">{row.b}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onClear}
              className="h-11 flex-1 rounded-full border border-line bg-white text-xs font-bold"
            >
              {t.offers.compareClear}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-full bg-green text-xs font-bold text-white"
            >
              {t.offers.compareClose}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

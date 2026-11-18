"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { useSettings } from "@/lib/SettingsProvider";
import { offerWhatsappLink } from "@/lib/whatsapp";
import { buildSrcSet } from "@/lib/imageSrcSet";
import { formatPricePerSqmLabel } from "@/lib/adminPricing";
import {
  localizeListingTitle,
  localizePlaceName,
  localizePropertyType,
  localizeSizeLabel,
} from "@/lib/localizePlace";
import {
  areaFilterBySlug,
  areaFilterLabel,
  buildAreaChipOptions,
  listingMatchesAreaSelection,
  resolveAreaQueryParam,
} from "@/lib/areaFilters";
import { INDUSTRIAL_ORDER } from "@/lib/regulations";
import {
  importanceRank,
  isPremiumImportance,
  listingSizeCategory,
  OFFER_IMPORTANCE_ORDER,
  OFFER_SIZE_ORDER,
  type OfferSizeCategory,
  type PremiumImportance,
} from "@/lib/offerImportance";
import { OfferCompareSheet } from "@/components/OfferCompareSheet";
import { OfferImportanceBadge } from "@/components/OfferImportanceBadge";
import type { IndustryType, Listing, PropertyStatus } from "@/lib/types";

const PUBLIC_STATUSES: PropertyStatus[] = ["available", "reserved", "sold", "rented"];
const COMPARE_MAX = 2;

function syncOffersUrl(
  area: string,
  status: string,
  industry: string,
  importance: string,
  size: string
) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (area && area !== "__all__") url.searchParams.set("area", area);
  else url.searchParams.delete("area");
  if (status && status !== "__all__") url.searchParams.set("status", status);
  else url.searchParams.delete("status");
  if (industry && industry !== "__all__") url.searchParams.set("industry", industry);
  else url.searchParams.delete("industry");
  if (importance && importance !== "__all__") url.searchParams.set("importance", importance);
  else url.searchParams.delete("importance");
  if (size && size !== "__all__") url.searchParams.set("size", size);
  else url.searchParams.delete("size");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

export function LiveOffersGrid({
  listings,
  hideAreaFilter = false,
  emptyMessage,
}: {
  listings: Listing[];
  hideAreaFilter?: boolean;
  emptyMessage?: string;
}) {
  const { t, lang } = useLanguage();
  const settings = useSettings();
  const listingAreas = useMemo(
    () => [...new Set(listings.map((o) => o.area).filter(Boolean))] as string[],
    [listings]
  );
  const areaChips = useMemo(() => buildAreaChipOptions(listingAreas), [listingAreas]);

  const [selectedArea, setSelectedArea] = useState<string>("__all__");
  const [selectedStatus, setSelectedStatus] = useState<string>("__all__");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("__all__");
  const [selectedImportance, setSelectedImportance] = useState<string>("__all__");
  const [selectedSize, setSelectedSize] = useState<string>("__all__");
  const [urlReady, setUrlReady] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    if (hideAreaFilter) {
      setUrlReady(true);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const area = resolveAreaQueryParam(params.get("area"));
    const status = params.get("status");
    const industry = params.get("industry");
    const importance = params.get("importance");
    const size = params.get("size");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (area) setSelectedArea(area);
    if (status && (PUBLIC_STATUSES as string[]).includes(status)) setSelectedStatus(status);
    if (industry && (INDUSTRIAL_ORDER as readonly string[]).includes(industry)) setSelectedIndustry(industry);
    if (importance && isPremiumImportance(importance)) setSelectedImportance(importance);
    if (size && (OFFER_SIZE_ORDER as readonly string[]).includes(size)) setSelectedSize(size);
    setUrlReady(true);
  }, [hideAreaFilter]);

  useEffect(() => {
    if (!urlReady || hideAreaFilter) return;
    syncOffersUrl(selectedArea, selectedStatus, selectedIndustry, selectedImportance, selectedSize);
  }, [selectedArea, selectedStatus, selectedIndustry, selectedImportance, selectedSize, urlReady, hideAreaFilter]);

  const filtered = listings.filter((o) => {
    if (!listingMatchesAreaSelection(o.area, selectedArea)) return false;
    if (selectedStatus !== "__all__" && o.status !== selectedStatus) return false;
    if (selectedIndustry !== "__all__" && o.industryType !== selectedIndustry) return false;
    if (selectedImportance !== "__all__" && (o.importance ?? "none") !== selectedImportance) return false;
    if (selectedSize !== "__all__") {
      const cat = listingSizeCategory(o.size);
      if (cat !== selectedSize) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) =>
      importanceRank(b.importance) - importanceRank(a.importance) ||
      Number(b.featured) - Number(a.featured) ||
      b.updatedAt.localeCompare(a.updatedAt)
  );

  const comparePair = useMemo(() => {
    if (compareIds.length !== COMPARE_MAX) return null;
    const left = listings.find((l) => l.id === compareIds[0]);
    const right = listings.find((l) => l.id === compareIds[1]);
    return left && right ? ([left, right] as const) : null;
  }, [compareIds, listings]);

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        if (next.length < COMPARE_MAX) setCompareOpen(false);
        return next;
      }
      if (prev.length >= COMPARE_MAX) return [prev[1]!, id];
      return [...prev, id];
    });
  }

  function chipLabel(key: string, kind: "slug" | "area"): string {
    if (kind === "slug") {
      const def = areaFilterBySlug(key);
      return def ? areaFilterLabel(def, lang) : key;
    }
    return localizePlaceName(key, lang);
  }

  const chip = (active: boolean) =>
    `h-8 sm:h-10 px-3 sm:px-4 rounded-full text-[11px] sm:text-sm font-semibold border transition-all ${
      active
        ? "bg-green text-white border-green shadow-[0_10px_24px_-14px_rgba(15,52,47,0.9)]"
        : "bg-white/80 text-ink border-line hover:border-green/40"
    }`;

  return (
    <div className={compareIds.length ? "pb-24 sm:pb-20" : undefined}>
      <div className="flex flex-col gap-3 sm:gap-4 mb-5 sm:mb-8">
        {!hideAreaFilter && (
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-ink-soft mb-1.5 sm:mb-2">{t.offers.filterArea}</p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <button type="button" onClick={() => setSelectedArea("__all__")} className={chip(selectedArea === "__all__")}>
                {t.offers.all}
              </button>
              {areaChips.map((chipOpt) => (
                <button
                  key={`${chipOpt.kind}:${chipOpt.key}`}
                  type="button"
                  onClick={() => setSelectedArea(chipOpt.key)}
                  className={chip(selectedArea === chipOpt.key)}
                >
                  {chipLabel(chipOpt.key, chipOpt.kind)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div>
            <label className="text-[10px] sm:text-[11px] font-bold text-ink-soft mb-1 block">{t.offers.filterStatus}</label>
            <select
              className="w-full h-9 sm:h-11 rounded-lg sm:rounded-xl border border-line bg-white px-2.5 sm:px-3 text-xs sm:text-sm outline-none focus:border-gold"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="__all__">{t.offers.filterAllStatuses}</option>
              {PUBLIC_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.offers.status[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] sm:text-[11px] font-bold text-ink-soft mb-1 block">{t.offers.filterIndustry}</label>
            <select
              className="w-full h-9 sm:h-11 rounded-lg sm:rounded-xl border border-line bg-white px-2.5 sm:px-3 text-xs sm:text-sm outline-none focus:border-gold"
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
            >
              <option value="__all__">{t.offers.filterAllIndustries}</option>
              {INDUSTRIAL_ORDER.map((key: IndustryType) => (
                <option key={key} value={key}>
                  {t.offers.industry[key]}
                </option>
              ))}
            </select>
          </div>
          {!hideAreaFilter && (
            <>
              <div>
                <label className="text-[10px] sm:text-[11px] font-bold text-ink-soft mb-1 block">
                  {t.offers.filterImportance}
                </label>
                <select
                  className="w-full h-9 sm:h-11 rounded-lg sm:rounded-xl border border-line bg-white px-2.5 sm:px-3 text-xs sm:text-sm outline-none focus:border-gold"
                  value={selectedImportance}
                  onChange={(e) => setSelectedImportance(e.target.value)}
                >
                  <option value="__all__">{t.offers.filterAllImportance}</option>
                  {OFFER_IMPORTANCE_ORDER.map((key: PremiumImportance) => (
                    <option key={key} value={key}>
                      {t.offers.importance[key]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] sm:text-[11px] font-bold text-ink-soft mb-1 block">
                  {t.offers.filterSize}
                </label>
                <select
                  className="w-full h-9 sm:h-11 rounded-lg sm:rounded-xl border border-line bg-white px-2.5 sm:px-3 text-xs sm:text-sm outline-none focus:border-gold"
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                >
                  <option value="__all__">{t.offers.filterAllSizes}</option>
                  {OFFER_SIZE_ORDER.map((key: OfferSizeCategory) => (
                    <option key={key} value={key}>
                      {t.offers.sizeCategory[key]}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] sm:text-xs text-ink-soft">
            {t.offers.resultsCount}: <b className="text-ink">{sorted.length}</b>
          </p>
          <p className="text-[10px] sm:text-[11px] text-ink-soft">{t.offers.compareHint}</p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl sm:rounded-3xl border border-dashed border-line bg-white/70 p-8 sm:p-12 text-center text-sm text-ink-soft">
          {emptyMessage ?? t.offers.empty}
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((offer) => {
            const industryLabel = t.offers.industry[offer.industryType];
            const statusLabel = t.offers.status[offer.status];
            const title = localizeListingTitle(offer.title, lang);
            const areaLabel = offer.area ? localizePlaceName(offer.area, lang) : t.offers.areaFallback;
            const propertyType = localizePropertyType(offer.propertyType, lang, t.offers.propertyTypeFallback);
            const sizeLabel = localizeSizeLabel(offer.size, lang);
            const priceLabel = formatPricePerSqmLabel(offer.price, lang);
            const sold = offer.status === "sold";
            const selected = compareIds.includes(offer.id);
            const compareDisabled = !selected && compareIds.length >= COMPARE_MAX;
            const sizeCat = listingSizeCategory(offer.size);
            return (
              <article
                key={offer.id}
                className={`group overflow-hidden flex flex-col rounded-2xl sm:rounded-3xl border bg-white transition-all duration-300 sm:hover:-translate-y-1 ${
                  selected
                    ? "border-green ring-2 ring-green/20"
                    : "border-line sm:hover:border-green/25 sm:hover:shadow-[0_28px_50px_-28px_rgba(15,52,47,0.45)]"
                } ${sold ? "opacity-90" : ""}`}
              >
                <div className="relative overflow-hidden h-36 sm:h-52">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={offer.mainImage || "/industrial-clean-wide.webp"}
                    srcSet={buildSrcSet(offer.mainImage)}
                    alt={title}
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${sold ? "grayscale-[35%]" : ""}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  <div className="absolute top-2 inset-x-2 sm:top-3 sm:inset-x-3 flex justify-between gap-1.5">
                    <span className="bg-white/92 backdrop-blur text-[9px] sm:text-[10px] font-bold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full">
                      {areaLabel}
                    </span>
                    <span
                      className={`backdrop-blur text-[9px] sm:text-[10px] font-bold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full ${
                        sold ? "bg-amber-100 text-amber-900" : "bg-white/92"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div className="absolute bottom-2 start-2 sm:bottom-3 sm:start-3 flex flex-wrap gap-1.5 max-w-[70%]">
                    {!sold && <OfferImportanceBadge importance={offer.importance} />}
                    {sizeCat && (
                      <span className="bg-white/92 backdrop-blur text-[9px] sm:text-[10px] font-bold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full text-ink">
                        {t.offers.sizeCategoryShort[sizeCat]}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCompare(offer.id)}
                    disabled={compareDisabled}
                    aria-pressed={selected}
                    className={`absolute bottom-2 end-2 sm:bottom-3 sm:end-3 min-h-9 min-w-9 rounded-full border px-2.5 text-[10px] sm:text-[11px] font-bold backdrop-blur transition-colors disabled:opacity-40 ${
                      selected
                        ? "border-green bg-green text-white"
                        : "border-white/70 bg-white/92 text-green"
                    }`}
                  >
                    {selected ? t.offers.compareSelected : t.offers.compareAdd}
                  </button>
                </div>
                <div className="p-3 sm:p-5 flex flex-col gap-1.5 sm:gap-2 flex-1">
                  <div className="flex justify-between text-[10px] sm:text-[11px] text-ink-soft gap-2">
                    <span className="truncate">
                      {propertyType} • {offer.dealType || t.offers.dealTypeFallback}
                    </span>
                    <span dir="ltr" className="font-mono text-green shrink-0">
                      {offer.listingNo}
                    </span>
                  </div>
                  {industryLabel && (
                    <span className="text-[9px] sm:text-[10px] font-bold text-gold tracking-wide">{industryLabel}</span>
                  )}
                  <h3 className="font-bold leading-snug text-base sm:text-lg group-hover:text-green transition-colors line-clamp-2">
                    {title}
                  </h3>
                  <p className="text-xs sm:text-sm text-ink-soft line-clamp-2 sm:line-clamp-3">{offer.description}</p>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-1 sm:mt-2 pt-2 sm:pt-3 border-t border-line">
                    <div className="min-w-0">
                      <small className="block text-[9px] sm:text-[10px] text-ink-soft">{t.offers.size}</small>
                      <b className="block text-xs sm:text-sm [overflow-wrap:anywhere]">{sizeLabel || t.offers.onRequest}</b>
                    </div>
                    <div className="min-w-0">
                      <small className="block text-[9px] sm:text-[10px] text-ink-soft">{t.offers.price}</small>
                      <b className="block text-xs sm:text-sm [overflow-wrap:anywhere]">{priceLabel || t.offers.onRequest}</b>
                    </div>
                  </div>
                  <div className="mt-auto pt-2.5 sm:pt-4 grid grid-cols-2 gap-1.5 sm:gap-2">
                    <Link
                      href={`/offers/${offer.id}`}
                      className="h-9 sm:h-11 rounded-full bg-surface-2 text-[11px] sm:text-xs font-bold flex items-center justify-center hover:bg-line/50 transition-colors"
                    >
                      {t.offers.details}
                    </Link>
                    {!sold ? (
                      <a
                        href={offerWhatsappLink(offer.phone, offer.listingNo, title, settings.whatsappNumber)}
                        target="_blank"
                        rel="noopener"
                        className="h-9 sm:h-11 rounded-full bg-green text-white text-[11px] sm:text-xs font-bold flex items-center justify-center hover:bg-green-2 transition-colors"
                      >
                        {t.offers.whatsapp}
                      </a>
                    ) : (
                      <span className="h-9 sm:h-11 rounded-full bg-amber-50 text-amber-800 text-[11px] sm:text-xs font-bold flex items-center justify-center">
                        {t.offers.soldBadge}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {compareIds.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pe-[4.75rem] sm:pe-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-line bg-white/95 p-2 shadow-[0_18px_40px_-18px_rgba(15,52,47,0.55)] backdrop-blur">
            <div className="min-w-0 flex-1 px-1">
              <p className="text-[11px] font-bold text-green">
                {t.offers.compareBarTitle.replace("{n}", String(compareIds.length))}
              </p>
              <p className="text-[10px] text-ink-soft truncate">
                {compareIds.length < COMPARE_MAX ? t.offers.comparePickOneMore : t.offers.compareReady}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="h-10 shrink-0 rounded-full border border-line px-3 text-[11px] font-bold"
            >
              {t.offers.compareClear}
            </button>
            <button
              type="button"
              disabled={compareIds.length !== COMPARE_MAX}
              onClick={() => setCompareOpen(true)}
              className="h-10 shrink-0 rounded-full bg-green px-3.5 text-[11px] font-bold text-white disabled:opacity-40"
            >
              {t.offers.compareAction}
            </button>
          </div>
        </div>
      )}

      {compareOpen && comparePair && (
        <OfferCompareSheet
          left={comparePair[0]}
          right={comparePair[1]}
          onClose={() => setCompareOpen(false)}
          onClear={() => {
            setCompareIds([]);
            setCompareOpen(false);
          }}
        />
      )}
    </div>
  );
}

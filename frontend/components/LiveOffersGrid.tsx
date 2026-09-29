"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { useSettings } from "@/lib/SettingsProvider";
import { offerWhatsappLink } from "@/lib/whatsapp";
import { buildSrcSet } from "@/lib/imageSrcSet";
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
import type { IndustryType, Listing, PropertyStatus } from "@/lib/types";

const PUBLIC_STATUSES: PropertyStatus[] = ["available", "reserved", "sold", "rented"];

function syncOffersUrl(area: string, status: string, industry: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (area && area !== "__all__") url.searchParams.set("area", area);
  else url.searchParams.delete("area");
  if (status && status !== "__all__") url.searchParams.set("status", status);
  else url.searchParams.delete("status");
  if (industry && industry !== "__all__") url.searchParams.set("industry", industry);
  else url.searchParams.delete("industry");
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
  const [urlReady, setUrlReady] = useState(false);

  useEffect(() => {
    if (hideAreaFilter) {
      setUrlReady(true);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const area = resolveAreaQueryParam(params.get("area"));
    const status = params.get("status");
    const industry = params.get("industry");
    // One-time hydrate from the URL (external source).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (area) setSelectedArea(area);
    if (status && (PUBLIC_STATUSES as string[]).includes(status)) setSelectedStatus(status);
    if (industry && (INDUSTRIAL_ORDER as readonly string[]).includes(industry)) setSelectedIndustry(industry);
    setUrlReady(true);
  }, [hideAreaFilter]);

  useEffect(() => {
    if (!urlReady || hideAreaFilter) return;
    syncOffersUrl(selectedArea, selectedStatus, selectedIndustry);
  }, [selectedArea, selectedStatus, selectedIndustry, urlReady, hideAreaFilter]);

  const filtered = listings.filter((o) => {
    if (!listingMatchesAreaSelection(o.area, selectedArea)) return false;
    if (selectedStatus !== "__all__" && o.status !== selectedStatus) return false;
    if (selectedIndustry !== "__all__" && o.industryType !== selectedIndustry) return false;
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => Number(b.featured) - Number(a.featured) || b.updatedAt.localeCompare(a.updatedAt)
  );

  function chipLabel(key: string, kind: "slug" | "area"): string {
    if (kind === "slug") {
      const def = areaFilterBySlug(key);
      return def ? areaFilterLabel(def, lang) : key;
    }
    return localizePlaceName(key, lang);
  }

  const chip = (active: boolean) =>
    `h-10 px-4 rounded-full text-sm font-semibold border transition-all ${
      active
        ? "bg-green text-white border-green shadow-[0_10px_24px_-14px_rgba(15,52,47,0.9)]"
        : "bg-white/80 text-ink border-line hover:border-green/40"
    }`;

  return (
    <div>
      <div className="flex flex-col gap-4 mb-8">
        {!hideAreaFilter && (
          <div>
            <p className="text-[11px] font-bold text-ink-soft mb-2">{t.offers.filterArea}</p>
            <div className="flex flex-wrap gap-2">
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

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-ink-soft mb-1.5 block">{t.offers.filterStatus}</label>
            <select
              className="w-full h-11 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-gold"
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
            <label className="text-[11px] font-bold text-ink-soft mb-1.5 block">{t.offers.filterIndustry}</label>
            <select
              className="w-full h-11 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-gold"
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
        </div>

        <p className="text-xs text-ink-soft">
          {t.offers.resultsCount}: <b className="text-ink">{sorted.length}</b>
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-white/70 p-12 text-center text-ink-soft">
          {emptyMessage ?? t.offers.empty}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((offer) => {
            const industryLabel = t.offers.industry[offer.industryType];
            const statusLabel = t.offers.status[offer.status];
            const title = localizeListingTitle(offer.title, lang);
            const areaLabel = offer.area ? localizePlaceName(offer.area, lang) : t.offers.areaFallback;
            const propertyType = localizePropertyType(offer.propertyType, lang, t.offers.propertyTypeFallback);
            const sizeLabel = localizeSizeLabel(offer.size, lang);
            const sold = offer.status === "sold";
            return (
              <article
                key={offer.id}
                className={`group overflow-hidden flex flex-col rounded-3xl border bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_50px_-28px_rgba(15,52,47,0.45)] ${
                  offer.featured ? "border-gold/60" : "border-line hover:border-green/25"
                } ${sold ? "opacity-90" : ""}`}
              >
                <div className="relative overflow-hidden h-52">
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
                  <div className="absolute top-3 inset-x-3 flex justify-between gap-2">
                    <span className="bg-white/92 backdrop-blur text-[10px] font-bold px-2.5 py-1.5 rounded-full">{areaLabel}</span>
                    <span
                      className={`backdrop-blur text-[10px] font-bold px-2.5 py-1.5 rounded-full ${
                        sold ? "bg-amber-100 text-amber-900" : "bg-white/92"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  {offer.featured && !sold && (
                    <span className="absolute bottom-3 start-3 bg-gold text-[#152126] text-[10px] font-bold px-2.5 py-1.5 rounded-full">
                      {t.offers.featured}
                    </span>
                  )}
                </div>
                <div className="p-5 flex flex-col gap-2 flex-1">
                  <div className="flex justify-between text-[11px] text-ink-soft gap-3">
                    <span>
                      {propertyType} • {offer.dealType || t.offers.dealTypeFallback}
                    </span>
                    <span dir="ltr" className="font-mono text-green shrink-0">
                      {offer.listingNo}
                    </span>
                  </div>
                  {industryLabel && <span className="text-[10px] font-bold text-gold tracking-wide">{industryLabel}</span>}
                  <h3 className="font-bold leading-snug text-lg group-hover:text-green transition-colors">{title}</h3>
                  <p className="text-sm text-ink-soft line-clamp-3">{offer.description}</p>
                  <div className="grid grid-cols-2 gap-3 mt-2 pt-3 border-t border-line">
                    <div className="min-w-0">
                      <small className="block text-[10px] text-ink-soft">{t.offers.size}</small>
                      <b className="block text-sm [overflow-wrap:anywhere]">{sizeLabel || t.offers.onRequest}</b>
                    </div>
                    <div className="min-w-0">
                      <small className="block text-[10px] text-ink-soft">{t.offers.price}</small>
                      <b className="block text-sm [overflow-wrap:anywhere]">{offer.price || t.offers.onRequest}</b>
                    </div>
                  </div>
                  <div className="mt-auto pt-4 grid grid-cols-2 gap-2">
                    <Link
                      href={`/offers/${offer.id}`}
                      className="h-11 rounded-full bg-surface-2 text-xs font-bold flex items-center justify-center hover:bg-line/50 transition-colors"
                    >
                      {t.offers.details}
                    </Link>
                    {!sold ? (
                      <a
                        href={offerWhatsappLink(offer.phone, offer.listingNo, title, settings.whatsappNumber)}
                        target="_blank"
                        rel="noopener"
                        className="h-11 rounded-full bg-green text-white text-xs font-bold flex items-center justify-center hover:bg-green-2 transition-colors"
                      >
                        {t.offers.whatsapp}
                      </a>
                    ) : (
                      <span className="h-11 rounded-full bg-amber-50 text-amber-800 text-xs font-bold flex items-center justify-center">
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
    </div>
  );
}

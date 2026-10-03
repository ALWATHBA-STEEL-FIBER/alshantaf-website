"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/lib/LanguageProvider";
import { useSettings } from "@/lib/SettingsProvider";
import { offerWhatsappLink } from "@/lib/whatsapp";
import { api } from "@/lib/api";
import { buildSrcSet } from "@/lib/imageSrcSet";
import { coordsToString, formatDlsArea, parseCoords } from "@/lib/mapCoords";
import { codesForSelection, loadDlsLocations } from "@/lib/dlsLocations";
import { fetchMergedParcelLocation } from "@/lib/fetchParcelLocations";
import {
  adminMedianEstimate,
  formatAreaSqm,
  formatMoney,
  parseAreaSqm,
  parsePricePerSqm,
} from "@/lib/adminPricing";
import {
  localizeListingTitle,
  localizePlaceName,
  localizePriceLabel,
  localizePropertyType,
  localizeSizeLabel,
} from "@/lib/localizePlace";
import type { Listing } from "@/lib/types";
import { LocationInput } from "@/components/LocationInput";
import { DlsPricingHint } from "@/components/DlsPricingHint";
import { RegulationGuide } from "@/components/RegulationGuide";
import { useAnalyticsAllowed } from "@/components/CookieConsent";
import { ShareIcon } from "@/components/icons";

export function OfferDetail({ listing }: { listing: Listing }) {
  const { t, lang } = useLanguage();
  const settings = useSettings();
  const analyticsAllowed = useAnalyticsAllowed();
  const [parcelPolygon, setParcelPolygon] = useState<[number, number][][] | null>(null);
  const [perimeterM, setPerimeterM] = useState<number | null>(null);
  const [areaSqm, setAreaSqm] = useState<number | null>(() => parseAreaSqm(listing.size));
  const [activePhoto, setActivePhoto] = useState(0);
  const [photoFsOpen, setPhotoFsOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const expectsParcel = Boolean(
    listing.governorate &&
      listing.directorate &&
      listing.village &&
      listing.basin &&
      listing.neighborhood &&
      listing.parcel?.trim()
  );
  const expectsMap = Boolean(
    (listing.latitude !== null && listing.longitude !== null) ||
      parseCoords(listing.locationUrl) ||
      expectsParcel
  );
  const [geoLoading, setGeoLoading] = useState(expectsParcel);
  const [mapReady, setMapReady] = useState(!expectsMap);
  const [topoReady, setTopoReady] = useState(!expectsParcel);
  const thumbRailRef = useRef<HTMLDivElement>(null);
  const stageRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!analyticsAllowed) return;
    api.recordView(listing.id);
  }, [listing.id, analyticsAllowed]);

  useEffect(() => {
    let cancelled = false;
    if (!expectsParcel) {
      setParcelPolygon(null);
      setPerimeterM(null);
      setGeoLoading(false);
      setTopoReady(true);
      return;
    }
    setGeoLoading(true);
    setTopoReady(false);
    const timer = window.setTimeout(async () => {
      try {
        const data = await loadDlsLocations();
        const codes = codesForSelection(
          data,
          listing.governorate!,
          listing.directorate!,
          listing.village!,
          listing.basin!,
          listing.neighborhood!
        );
        if (!codes || cancelled) {
          if (!cancelled) setTopoReady(true);
          return;
        }
        const location = await fetchMergedParcelLocation(codes, listing.parcel!.trim(), (q) =>
          api.dlsParcelLocationPublic(q)
        );
        if (cancelled) return;
        setParcelPolygon(location.rings);
        setPerimeterM(location.perimeterM);
        if (location.areaSqm != null) setAreaSqm(location.areaSqm);
        setTopoReady(!(location.rings?.[0]?.length));
      } catch {
        if (!cancelled) {
          setParcelPolygon(null);
          setPerimeterM(null);
          setTopoReady(true);
        }
      } finally {
        if (!cancelled) setGeoLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    expectsParcel,
    listing.governorate,
    listing.directorate,
    listing.village,
    listing.basin,
    listing.neighborhood,
    listing.parcel,
  ]);

  useEffect(() => {
    if (!expectsMap) setMapReady(true);
  }, [expectsMap]);

  useEffect(() => {
    if (!photoFsOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhotoFsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [photoFsOpen]);

  const images = listing.images.length
    ? listing.images
    : [listing.mainImage].filter((x): x is string => Boolean(x));
  const gallery = images.length ? images : ["/industrial-clean-wide.webp"];
  const mapCoords =
    listing.latitude !== null && listing.longitude !== null
      ? { lat: listing.latitude, lng: listing.longitude }
      : parseCoords(listing.locationUrl);
  const title = localizeListingTitle(listing.title, lang);
  const areaLabel = listing.area ? localizePlaceName(listing.area, lang) : "";
  const propertyType = localizePropertyType(listing.propertyType, lang, t.offers.propertyTypeFallback);
  const sizeLabel = localizeSizeLabel(
    areaSqm != null && areaSqm > 0 ? formatDlsArea(areaSqm, lang) : listing.size,
    lang
  );
  const priceLabel = localizePriceLabel(listing.price, lang);
  const basinLabel = listing.basin ? localizePlaceName(listing.basin, lang) : "";
  const presenter =
    listing.showPresenter && (listing.presenterRole || listing.presenterName)
      ? [listing.presenterRole ? t.offers.presenterRole[listing.presenterRole] : null, listing.presenterName]
          .filter(Boolean)
          .join(" — ")
      : "";
  const whatsappHref = offerWhatsappLink(listing.phone, listing.listingNo, title, settings.whatsappNumber);
  const showOfficialEst = listing.showEstimatedValue !== false;
  const hasFiles = Boolean(listing.video || listing.document);
  const hasParcelOutline = Boolean(parcelPolygon?.[0]?.length);
  const pricePerSqm = parsePricePerSqm(listing.price);
  const effectiveArea = areaSqm && areaSqm > 0 ? areaSqm : parseAreaSqm(listing.size);
  const requestedTotal =
    !showOfficialEst && pricePerSqm != null && effectiveArea != null
      ? adminMedianEstimate(pricePerSqm, effectiveArea)
      : null;
  const currency = t.owners.dlsHintCurrency;
  const spatialLoading =
    geoLoading || (expectsMap && !mapReady) || (hasParcelOutline && !topoReady);
  const spatialLoadingLabel =
    geoLoading || (expectsMap && !mapReady && hasParcelOutline && !topoReady)
      ? t.offers.mapTopoLoading
      : expectsMap && !mapReady
        ? t.offers.mapLoading
        : t.offers.topoLoading;

  useEffect(() => {
    if (!spatialLoading) return;
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [spatialLoading]);

  const locationShared = {
    value: mapCoords ? coordsToString(mapCoords) : "",
    onChange: () => undefined,
    address: listing.address ?? "",
    readOnly: true as const,
    polygon: parcelPolygon,
    lockEditing: hasParcelOutline,
    perimeterM,
    areaSqm,
    areaLabel: sizeLabel || listing.size,
    showDimensions: true,
    blueprint: {
      governorate: listing.governorate ?? undefined,
      directorate: listing.directorate ?? undefined,
      village: listing.village ?? undefined,
      basin: listing.basin ?? undefined,
      neighborhood: listing.neighborhood ?? undefined,
      parcel: listing.parcel ?? undefined,
      industryLabel: t.offers.industryLabel,
      industryValue: t.offers.industry[listing.industryType],
    },
  };

  function selectPhoto(index: number, opts?: { openFullscreen?: boolean }) {
    setActivePhoto(index);
    if (opts?.openFullscreen) setPhotoFsOpen(true);
    const stage = stageRailRef.current;
    if (stage) {
      const slide = stage.children[index] as HTMLElement | undefined;
      slide?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
    const thumb = thumbRailRef.current?.children[index] as HTMLElement | undefined;
    thumb?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  async function shareOffer() {
    const url = window.location.href;
    const shareData = { title, text: title, url };
    try {
      if (typeof navigator.share === "function") {
        await navigator.share(shareData);
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      /* ignore — no clipboard permission */
    }
  }

  function onStageScroll() {
    const stage = stageRailRef.current;
    if (!stage || stage.children.length === 0) return;
    const mid = stage.scrollLeft + stage.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < stage.children.length; i++) {
      const el = stage.children[i] as HTMLElement;
      const center = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    setActivePhoto(best);
  }

  const pricingBlock =
    showOfficialEst && listing.administrativeValue !== null ? (
      <DlsPricingHint
        ratePerSqm={listing.administrativeValue}
        sizeLabel={listing.size}
        areaSqm={areaSqm}
        source={listing.administrativeValueSource}
        retrievedAt={listing.administrativeValueAt}
        showMedian
        className="mt-3 rounded-2xl border border-gold/40 bg-gold/10 p-3.5 text-[11px] text-ink-soft leading-relaxed"
      />
    ) : requestedTotal != null && pricePerSqm != null && effectiveArea != null ? (
      <div className="mt-3 rounded-2xl border border-green/25 bg-green/5 p-3.5 text-[11px] text-ink-soft leading-relaxed">
        <p className="font-bold text-green">
          {t.offers.requestedTotalLabel}:{" "}
          <span className="tabular-nums" dir="ltr">
            {formatMoney(requestedTotal, lang)} {currency}
          </span>
          <span className="font-normal text-ink-soft">
            {" "}
            ({formatAreaSqm(effectiveArea, lang)} × {formatMoney(pricePerSqm, lang)})
          </span>
        </p>
        <p className="mt-1.5">{t.offers.requestedTotalNote}</p>
      </div>
    ) : null;

  const pageLoader =
    spatialLoading && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[9000] flex flex-col items-center justify-center gap-4 bg-[#f3efe6]/96 backdrop-blur-[2px] px-6"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <span
              className="inline-block h-10 w-10 rounded-full border-[3px] border-green/20 border-t-green animate-spin"
              aria-hidden
            />
            <p className="text-sm md:text-base font-bold text-green text-center max-w-sm">
              {t.offers.pageLoading}
            </p>
            <p className="text-xs text-ink-soft text-center max-w-sm">{spatialLoadingLabel}</p>
          </div>,
          document.body
        )
      : null;

  const photoLightbox =
    photoFsOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="offer-photo-fs" role="dialog" aria-modal="true" aria-label={t.offers.openFullscreenPhoto}>
            <div className="offer-photo-fs-toolbar">
              <button
                type="button"
                onClick={() => setPhotoFsOpen(false)}
                className="h-9 px-4 rounded-full border border-gold bg-gold text-[#0a1f1c] text-[11px] font-bold"
              >
                {t.offers.closeFullscreen}
              </button>
            </div>
            <div className="offer-photo-fs-stage" onClick={() => setPhotoFsOpen(false)}>
              <img
                src={gallery[activePhoto]}
                srcSet={buildSrcSet(gallery[activePhoto])}
                sizes="100vw"
                alt={title}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-12 md:py-16">
      {pageLoader}
      {photoLightbox}

      <section className="mb-8 min-w-0">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-[11px] font-bold text-gold tracking-wide">{t.offers.galleryLabel}</h2>
          {gallery.length > 1 && (
            <span className="text-[11px] tabular-nums text-ink-soft" dir="ltr">
              {activePhoto + 1} {t.offers.photoOf} {gallery.length}
            </span>
          )}
        </div>
        {gallery.length === 1 ? (
          <button
            type="button"
            onClick={() => selectPhoto(0, { openFullscreen: true })}
            className="relative aspect-[4/3] sm:aspect-[16/10] w-full overflow-hidden rounded-[1.25rem] border border-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
            aria-label={t.offers.openFullscreenPhoto}
          >
            <img
              src={gallery[0]}
              srcSet={buildSrcSet(gallery[0])}
              sizes="(min-width: 1100px) 1100px, 100vw"
              alt={title}
              loading="eager"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </button>
        ) : (
          <>
            <div
              ref={stageRailRef}
              onScroll={onStageScroll}
              className="offer-media-rail rounded-[1.25rem] border border-line bg-white/50"
            >
              {gallery.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => selectPhoto(i, { openFullscreen: true })}
                  className="relative aspect-[4/3] sm:aspect-[16/10] w-[min(88vw,720px)] overflow-hidden rounded-[1.1rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                  aria-label={t.offers.openFullscreenPhoto}
                >
                  <img
                    src={src}
                    srcSet={buildSrcSet(src)}
                    sizes="(min-width: 1100px) 720px, 88vw"
                    alt={title}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
            <div ref={thumbRailRef} className="offer-media-rail mt-3">
              {gallery.map((src, i) => (
                <button
                  key={`thumb-${src}-${i}`}
                  type="button"
                  onClick={() => selectPhoto(i)}
                  aria-current={i === activePhoto}
                  className={`relative h-14 w-20 sm:h-16 sm:w-24 overflow-hidden rounded-xl border-2 transition-colors ${
                    i === activePhoto ? "border-gold" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={src}
                    srcSet={buildSrcSet(src)}
                    sizes="96px"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </>
        )}
        {hasFiles && (
          <div className="mt-4">
            <h2 className="text-[11px] font-bold text-gold tracking-wide mb-3">{t.offers.filesLabel}</h2>
            <div className="offer-media-rail">
              {listing.video && (
                <div className="w-[min(88vw,420px)] rounded-2xl border border-line bg-white overflow-hidden">
                  <div className="px-3 py-2 border-b border-line text-[11px] font-bold text-green">
                    {t.offers.videoLabel}
                  </div>
                  <video controls className="w-full aspect-video bg-black" preload="metadata">
                    <source src={listing.video} />
                  </video>
                </div>
              )}
              {listing.document && (
                <a
                  href={listing.document}
                  target="_blank"
                  rel="noopener"
                  className="w-[min(70vw,260px)] rounded-2xl border border-line bg-white p-4 flex flex-col justify-between gap-5 hover:border-gold/50 transition-colors"
                >
                  <div>
                    <p className="text-[11px] font-bold text-gold tracking-wide">{t.offers.documentLabel}</p>
                    <p className="mt-2 text-sm font-bold text-green leading-snug">{t.offers.viewDocument}</p>
                  </div>
                  <span className="inline-flex h-9 items-center justify-center rounded-full bg-green text-white text-xs font-bold px-4">
                    {t.offers.openFile}
                  </span>
                </a>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="grid lg:grid-cols-[1.4fr_0.8fr] gap-8 items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {areaLabel && <span className="text-gold text-xs font-bold tracking-wide">{areaLabel}</span>}
            <span dir="ltr" className="text-xs font-mono text-green bg-surface-2 px-2.5 py-1 rounded-full">
              {listing.listingNo}
            </span>
            {listing.featured && (
              <span className="text-[10px] font-bold bg-gold text-[#152126] px-2.5 py-1 rounded-full">
                {t.offers.featured}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mt-3 text-balance">{title}</h1>
          <p className="text-ink-soft mt-4 leading-relaxed text-base md:text-lg">{listing.description}</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-8">
            {listing.propertyType && <Fact k={t.offers.type} v={propertyType} />}
            {sizeLabel && <Fact k={t.offers.size} v={sizeLabel} />}
            {priceLabel && <Fact k={t.offers.price} v={priceLabel} />}
            {(listing.basin || listing.parcel) && (
              <Fact k={t.offers.basinParcel} v={`${basinLabel || "—"} / ${listing.parcel || "—"}`} />
            )}
            <Fact k={t.offers.industryLabel} v={t.offers.industry[listing.industryType]} />
            <Fact k={t.offers.statusLabel} v={t.offers.status[listing.status]} />
          </div>

          {pricingBlock}

          {presenter && (
            <div className="mt-5 rounded-2xl border border-line bg-surface-2/80 p-4 text-sm text-green">
              {presenter}
            </div>
          )}

          <div className="mt-6">
            <h2 className="text-[11px] font-bold text-gold tracking-wide mb-3">{t.offers.mapTitle}</h2>
            {expectsMap ? (
              <LocationInput
                {...locationShared}
                showMap
                showTopo={false}
                loading={geoLoading || !mapReady}
                loadingLabel={spatialLoadingLabel}
                onMapReadyChange={setMapReady}
              />
            ) : null}
          </div>
        </div>

        <aside className="min-w-0 flex flex-col gap-5 lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
          <div className="rounded-3xl border border-line bg-white p-6 shadow-[0_24px_50px_-36px_rgba(15,52,47,0.35)]">
            <p className="text-xs font-bold text-ink-soft">{t.offers.price}</p>
            <p className="text-2xl font-bold text-green mt-1 [overflow-wrap:anywhere]">
              {priceLabel || t.offers.onRequest}
            </p>
            {sizeLabel && (
              <p className="text-sm text-ink-soft mt-2 [overflow-wrap:anywhere]">
                {t.offers.size}: <span className="font-bold text-ink">{sizeLabel}</span>
              </p>
            )}
            {requestedTotal != null && (
              <p className="text-sm text-ink-soft mt-2 [overflow-wrap:anywhere]">
                {t.offers.requestedTotalLabel}:{" "}
                <span className="font-bold text-ink tabular-nums" dir="ltr">
                  {formatMoney(requestedTotal, lang)} {currency}
                </span>
              </p>
            )}
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener"
              className="mt-6 flex h-12 rounded-full bg-green text-white font-bold items-center justify-center hover:bg-green-2 transition-colors shadow-[0_14px_28px_-16px_rgba(15,52,47,0.7)]"
            >
              {t.offers.whatsapp}
            </a>
            <button
              type="button"
              onClick={() => void shareOffer()}
              className="mt-3 flex h-12 w-full rounded-full border border-line bg-white text-green font-bold items-center justify-center gap-2 hover:bg-surface-2 transition-colors"
            >
              <ShareIcon className="w-4 h-4" />
              {shareCopied ? t.offers.shareCopied : t.offers.share}
            </button>
          </div>

          <RegulationGuide
            value={listing.industryType}
            readOnly
            className="rounded-2xl border border-line bg-white/90 p-4"
          />

          {(geoLoading && expectsParcel) || hasParcelOutline ? (
            <div>
              {geoLoading && !hasParcelOutline ? (
                <div
                  className="rounded-2xl border-2 border-white bg-gradient-to-br from-[#0a1f1c] via-[#0f342f] to-[#0a1f1c] p-6 min-h-[280px] flex flex-col items-center justify-center gap-3 text-gold"
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className="inline-block h-6 w-6 rounded-full border-2 border-gold/25 border-t-gold animate-spin"
                    aria-hidden
                  />
                  <p className="text-xs font-bold text-center px-2">{t.offers.topoLoading}</p>
                </div>
              ) : (
                <LocationInput
                  {...locationShared}
                  showMap={false}
                  showTopo
                  onTopoSettledChange={() => setTopoReady(true)}
                />
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/90 p-3.5 min-w-0">
      <small className="block text-[10px] text-ink-soft">{k}</small>
      <b className="block text-sm [overflow-wrap:anywhere]">{v}</b>
    </div>
  );
}

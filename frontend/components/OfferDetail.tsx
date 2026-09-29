"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { useSettings } from "@/lib/SettingsProvider";
import { offerWhatsappLink } from "@/lib/whatsapp";
import { api } from "@/lib/api";
import { buildSrcSet } from "@/lib/imageSrcSet";
import { coordsToString, parseCoords } from "@/lib/mapCoords";
import { codesForSelection, loadDlsLocations } from "@/lib/dlsLocations";
import { parseAreaSqm } from "@/lib/adminPricing";
import {
  localizeListingTitle,
  localizePlaceName,
  localizePropertyType,
  localizeSizeLabel,
} from "@/lib/localizePlace";
import type { Listing } from "@/lib/types";
import { LocationInput } from "@/components/LocationInput";
import { DlsPricingHint } from "@/components/DlsPricingHint";
import { RegulationGuide } from "@/components/RegulationGuide";
import { useAnalyticsAllowed } from "@/components/CookieConsent";

export function OfferDetail({ listing }: { listing: Listing }) {
  const { t, lang } = useLanguage();
  const settings = useSettings();
  const analyticsAllowed = useAnalyticsAllowed();
  const [parcelPolygon, setParcelPolygon] = useState<[number, number][][] | null>(null);
  const [perimeterM, setPerimeterM] = useState<number | null>(null);
  const [areaSqm, setAreaSqm] = useState<number | null>(() => parseAreaSqm(listing.size));
  const [activePhoto, setActivePhoto] = useState(0);
  const thumbRailRef = useRef<HTMLDivElement>(null);
  const stageRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!analyticsAllowed) return;
    api.recordView(listing.id);
  }, [listing.id, analyticsAllowed]);

  useEffect(() => {
    let cancelled = false;
    const { governorate, directorate, village, basin, neighborhood, parcel } = listing;
    if (!governorate || !directorate || !village || !basin || !neighborhood || !parcel?.trim()) {
      setParcelPolygon(null);
      setPerimeterM(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const data = await loadDlsLocations();
        const codes = codesForSelection(data, governorate, directorate, village, basin, neighborhood);
        if (!codes || cancelled) return;
        const location = await api.dlsParcelLocationPublic({
          ...codes,
          parcelNumber: parcel.trim(),
        });
        if (cancelled) return;
        setParcelPolygon(location.rings);
        setPerimeterM(location.perimeterM);
        if (location.areaSqm != null) setAreaSqm(location.areaSqm);
      } catch {
        if (!cancelled) {
          setParcelPolygon(null);
          setPerimeterM(null);
        }
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    listing.governorate,
    listing.directorate,
    listing.village,
    listing.basin,
    listing.neighborhood,
    listing.parcel,
  ]);

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
  const sizeLabel = localizeSizeLabel(listing.size, lang);
  const basinLabel = listing.basin ? localizePlaceName(listing.basin, lang) : "";
  const presenter =
    listing.showPresenter && (listing.presenterRole || listing.presenterName)
      ? [listing.presenterRole ? t.offers.presenterRole[listing.presenterRole] : null, listing.presenterName]
          .filter(Boolean)
          .join(" — ")
      : "";
  const whatsappHref = offerWhatsappLink(listing.phone, listing.listingNo, title, settings.whatsappNumber);
  const showEstimated = listing.showEstimatedValue !== false;
  const hasFiles = Boolean(listing.video || listing.document);
  const hasParcelOutline = Boolean(parcelPolygon?.[0]?.length);

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

  function selectPhoto(index: number) {
    setActivePhoto(index);
    const stage = stageRailRef.current;
    if (stage) {
      const slide = stage.children[index] as HTMLElement | undefined;
      slide?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
    const thumb = thumbRailRef.current?.children[index] as HTMLElement | undefined;
    thumb?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
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

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-12 md:py-16">
      {/* Photo + file rails — full width above the two columns */}
      <section className="mb-8 min-w-0">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-[11px] font-bold text-gold tracking-wide">{t.offers.galleryLabel}</h2>
          <span className="text-[11px] tabular-nums text-ink-soft" dir="ltr">
            {activePhoto + 1} {t.offers.photoOf} {gallery.length}
          </span>
        </div>
        <div
          ref={stageRailRef}
          onScroll={onStageScroll}
          className="offer-media-rail rounded-[1.25rem] border border-line bg-white/50"
        >
          {gallery.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => selectPhoto(i)}
              className="relative aspect-[4/3] sm:aspect-[16/10] w-[min(88vw,720px)] overflow-hidden rounded-[1.1rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
              aria-label={`${i + 1} / ${gallery.length}`}
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
        {gallery.length > 1 && (
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
        {/* Left: listing dossier + 2D map */}
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
            {listing.price && <Fact k={t.offers.price} v={listing.price} />}
            {(listing.basin || listing.parcel) && (
              <Fact k={t.offers.basinParcel} v={`${basinLabel || "—"} / ${listing.parcel || "—"}`} />
            )}
            <Fact k={t.offers.industryLabel} v={t.offers.industry[listing.industryType]} />
            <Fact k={t.offers.statusLabel} v={t.offers.status[listing.status]} />
          </div>

          {listing.administrativeValue !== null && (
            <DlsPricingHint
              ratePerSqm={listing.administrativeValue}
              sizeLabel={listing.size}
              areaSqm={areaSqm}
              source={listing.administrativeValueSource}
              retrievedAt={listing.administrativeValueAt}
              showMedian={showEstimated}
              className="mt-3 rounded-2xl border border-gold/40 bg-gold/10 p-3.5 text-[11px] text-ink-soft leading-relaxed"
            />
          )}

          {presenter && (
            <div className="mt-5 rounded-2xl border border-line bg-surface-2/80 p-4 text-sm text-green">
              {presenter}
            </div>
          )}

          <div className="mt-6">
            <h2 className="text-[11px] font-bold text-gold tracking-wide mb-3">{t.offers.mapTitle}</h2>
            <LocationInput {...locationShared} showMap showTopo={false} />
          </div>
        </div>

        {/* Right: contact + regulation + 3D */}
        <aside className="min-w-0 flex flex-col gap-5 lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
          <div className="rounded-3xl border border-line bg-white p-6 shadow-[0_24px_50px_-36px_rgba(15,52,47,0.35)]">
            <p className="text-xs font-bold text-ink-soft">{t.offers.price}</p>
            <p className="text-2xl font-bold text-green mt-1 [overflow-wrap:anywhere]">
              {listing.price || t.offers.onRequest}
            </p>
            {sizeLabel && (
              <p className="text-sm text-ink-soft mt-2 [overflow-wrap:anywhere]">
                {t.offers.size}: <span className="font-bold text-ink">{sizeLabel}</span>
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
          </div>

          <RegulationGuide
            value={listing.industryType}
            readOnly
            className="rounded-2xl border border-line bg-white/90 p-4"
          />

          {hasParcelOutline && (
            <div>
              <LocationInput {...locationShared} showMap={false} showTopo />
            </div>
          )}
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

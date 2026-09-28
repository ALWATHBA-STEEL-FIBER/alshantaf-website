"use client";

import { useEffect } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { useSettings } from "@/lib/SettingsProvider";
import { offerWhatsappLink } from "@/lib/whatsapp";
import { api } from "@/lib/api";
import { buildSrcSet } from "@/lib/imageSrcSet";
import { coordsToString, parseCoords } from "@/lib/mapCoords";
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

  useEffect(() => {
    if (!analyticsAllowed) return;
    api.recordView(listing.id);
  }, [listing.id, analyticsAllowed]);
  const images = listing.images.length ? listing.images : [listing.mainImage].filter((x): x is string => Boolean(x));
  const gallery = (images.length ? images : ["/industrial-clean-wide.webp"]).slice(0, 4);
  const mapCoords = listing.latitude !== null && listing.longitude !== null ? { lat: listing.latitude, lng: listing.longitude } : parseCoords(listing.locationUrl);
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

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-12 md:py-16">
      {/* Mobile: simple full-width vertical stack — never underflows since each
          image just takes its own row at a fixed aspect ratio. */}
      <div className="sm:hidden grid gap-2 rounded-[1.75rem] overflow-hidden mb-8">
        {gallery.map((src, i) => (
          <div key={src + i} className="relative aspect-[4/3] overflow-hidden">
            <img
              src={src}
              srcSet={buildSrcSet(src)}
              sizes="100vw"
              alt={title}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        ))}
      </div>

      {/* Desktop/tablet: a fixed-height hero + side column that always fills
          the full width/height, whether there are 1, 2, 3 or 4 photos — the
          side column divides evenly by flex instead of a grid col/row-span
          that only tiled correctly for exactly 3 images. */}
      <div className="hidden sm:block rounded-[1.75rem] overflow-hidden mb-8">
        {gallery.length === 1 ? (
          <div className="relative h-[420px] lg:h-[500px]">
            <img
              src={gallery[0]}
              srcSet={buildSrcSet(gallery[0])}
              sizes="100vw"
              alt={title}
              loading="eager"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="grid grid-cols-[1.6fr_1fr] gap-2 h-[420px] lg:h-[500px]">
            <div className="relative overflow-hidden">
              <img
                src={gallery[0]}
                srcSet={buildSrcSet(gallery[0])}
                sizes="60vw"
                alt={title}
                loading="eager"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
            </div>
            <div className="flex flex-col gap-2">
              {gallery.slice(1).map((src, i) => (
                <div key={src + i} className="relative flex-1 overflow-hidden">
                  <img
                    src={src}
                    srcSet={buildSrcSet(src)}
                    sizes="33vw"
                    alt={title}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[1.4fr_0.8fr] gap-8 items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            {areaLabel && <span className="text-gold text-xs font-bold tracking-wide">{areaLabel}</span>}
            <span dir="ltr" className="text-xs font-mono text-green bg-surface-2 px-2.5 py-1 rounded-full">
              {listing.listingNo}
            </span>
            {listing.featured && (
              <span className="text-[10px] font-bold bg-gold text-[#152126] px-2.5 py-1 rounded-full">{t.offers.featured}</span>
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
              source={listing.administrativeValueSource}
              retrievedAt={listing.administrativeValueAt}
              className="mt-3 rounded-2xl border border-gold/40 bg-gold/10 p-3.5 text-[11px] text-ink-soft leading-relaxed"
            />
          )}

          <RegulationGuide value={listing.industryType} readOnly className="mt-3 rounded-2xl border border-line bg-white/90 p-4" />

          {presenter && (
            <div className="mt-5 rounded-2xl border border-line bg-surface-2/80 p-4 text-sm text-green">{presenter}</div>
          )}

          <div className="mt-6">
            <LocationInput
              value={mapCoords ? coordsToString(mapCoords) : ""}
              onChange={() => undefined}
              address={listing.address ?? ""}
              readOnly
            />
          </div>

          {listing.video && (
            <video controls className="w-full rounded-2xl mt-6 border border-line">
              <source src={listing.video} />
            </video>
          )}

          {listing.document && (
            <a
              href={listing.document}
              target="_blank"
              rel="noopener"
              className="inline-flex mt-4 text-sm font-bold text-green underline underline-offset-4 hover:text-gold transition-colors"
            >
              {t.offers.viewDocument}
            </a>
          )}
        </div>

        <aside className="lg:sticky lg:top-[calc(var(--header-h)+1rem)] rounded-3xl border border-line bg-white p-6 shadow-[0_24px_50px_-36px_rgba(15,52,47,0.35)] min-w-0">
          <p className="text-xs font-bold text-ink-soft">{t.offers.price}</p>
          <p className="text-2xl font-bold text-green mt-1 [overflow-wrap:anywhere]">{listing.price || t.offers.onRequest}</p>
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/lib/LanguageProvider";
import { useSettings } from "@/lib/SettingsProvider";
import { offerWhatsappLink } from "@/lib/whatsapp";
import { api } from "@/lib/api";
import { buildSrcSet } from "@/lib/imageSrcSet";
import { coordsToString, formatDlsArea, parseCoords } from "@/lib/mapCoords";
import { codesForSelection, loadDlsLocations } from "@/lib/dlsLocations";
import {
  adminMedianEstimate,
  formatAreaSqm,
  formatMoney,
  parseAreaSqm,
  parsePricePerSqm,
} from "@/lib/adminPricing";
import { parseParcelNumbers } from "@/lib/multiParcel";
import { fetchAndMergeParcelLocations } from "@/lib/multiParcelFetch";
import {
  localizeListingTitle,
  localizePlaceName,
  localizePropertyType,
  localizeSizeLabel,
} from "@/lib/localizePlace";
import type { Listing } from "@/lib/types";
import { LocationInput, type LocationInputHandle } from "@/components/LocationInput";
import { DlsPricingHint } from "@/components/DlsPricingHint";
import { RegulationGuide } from "@/components/RegulationGuide";
import { OfferImportanceBadge } from "@/components/OfferImportanceBadge";
import { useAnalyticsAllowed } from "@/components/CookieConsent";

function OfferVideo({ src, label }: { src: string; label: string }) {
  const [buffering, setBuffering] = useState(true);

  return (
    <div className="w-full sm:w-[min(88vw,420px)] rounded-2xl border border-line bg-white overflow-hidden">
      <div className="px-3 py-2 border-b border-line text-[11px] font-bold text-green">{label}</div>
      <div className="relative bg-black">
        <video
          key={src}
          src={src}
          controls
          playsInline
          preload="metadata"
          className="w-full aspect-video object-contain"
          onLoadStart={() => setBuffering(true)}
          onWaiting={() => setBuffering(true)}
          onCanPlay={() => setBuffering(false)}
          onPlaying={() => setBuffering(false)}
        />
        {buffering && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="h-11 w-11 rounded-full border-2 border-white/25 border-t-gold animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

export function OfferDetail({ listing }: { listing: Listing }) {
  const { t, lang } = useLanguage();
  const settings = useSettings();
  const analyticsAllowed = useAnalyticsAllowed();
  const [parcelPolygons, setParcelPolygons] = useState<
    Array<{
      parcelNo: string;
      rings: [number, number][][];
      areaSqm: number | null;
      perimeterM: number | null;
      adjacentRoads: Array<{
        id: string;
        name: string;
        side: "north" | "south" | "east" | "west";
        widthM: number | null;
        source: "osm-overpass" | "google-maps" | "dls-neighbor";
        path: [number, number][];
      }>;
    }>
  >([]);
  const [selectedParcelNos, setSelectedParcelNos] = useState<string[]>([]);
  const [areaSqm, setAreaSqm] = useState<number | null>(() => parseAreaSqm(listing.size));
  const [activePhoto, setActivePhoto] = useState(0);
  const [photoFsOpen, setPhotoFsOpen] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [blueprintReady, setBlueprintReady] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");
  const expectsParcel = Boolean(
    listing.governorate &&
      listing.directorate &&
      listing.village &&
      listing.basin &&
      listing.neighborhood &&
      listing.parcel?.trim()
  );
  const parcelCandidates = useMemo(() => parseParcelNumbers(listing.parcel), [listing.parcel]);
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
  const printLocationRef = useRef<LocationInputHandle>(null);
  const mapLocationRef = useRef<LocationInputHandle>(null);

  useEffect(() => {
    if (!analyticsAllowed) return;
    api.recordView(listing.id);
  }, [listing.id, analyticsAllowed]);

  useEffect(() => {
    let cancelled = false;
    const normalizeParcelId = (parcelId: string | null | undefined) => {
      const cleaned = (parcelId ?? "").replace(/\D/g, "");
      if (!cleaned) return "";
      return String(Number(cleaned));
    };
    const fallbackByPoint = async () => {
      if (!mapCoords) return false;
      try {
        const point = await api.dlsParcelByPointPublic({ latitude: mapCoords.lat, longitude: mapCoords.lng });
        if (cancelled || !point.rings?.[0]?.length) return false;
        const parcelNo = normalizeParcelId(point.parcelId) || (listing.parcel?.trim() ?? "");
        const fallbackItem = {
          parcelNo,
          rings: point.rings,
          areaSqm: point.areaSqm ?? null,
          perimeterM: point.perimeterM ?? null,
          adjacentRoads: point.adjacentRoads ?? [],
        };
        setParcelPolygons([fallbackItem]);
        setSelectedParcelNos(parcelNo ? [parcelNo] : []);
        if ((point.areaSqm ?? 0) > 0) setAreaSqm(point.areaSqm ?? null);
        setTopoReady(false);
        return true;
      } catch {
        return false;
      }
    };

    if (!expectsParcel) {
      setParcelPolygons([]);
      setSelectedParcelNos([]);
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
          const usedPointFallback = await fallbackByPoint();
          if (!usedPointFallback && !cancelled) {
            setParcelPolygons([]);
            setSelectedParcelNos([]);
            setTopoReady(true);
          }
          return;
        }
        const parcelNos = parcelCandidates.length
          ? parcelCandidates
          : [listing.parcel!.trim()];
        const merged = await fetchAndMergeParcelLocations(
          parcelNos,
          codes,
          (payload) => api.dlsParcelLocationPublic(payload)
        );
        if (cancelled) return;
        const normalized = merged.items
          .map(({ parcelNo, rings, areaSqm, perimeterM, adjacentRoads }) => ({
            parcelNo,
            rings,
            areaSqm,
            perimeterM,
            adjacentRoads: adjacentRoads ?? [],
          }))
          .filter((p: { parcelNo: string; rings: [number, number][][] }) => p.rings?.[0]?.length);
        if (!normalized.length) {
          const usedPointFallback = await fallbackByPoint();
          if (!usedPointFallback && !cancelled) {
            setParcelPolygons([]);
            setSelectedParcelNos([]);
            setTopoReady(true);
          }
          return;
        }
        setParcelPolygons(normalized);
        setSelectedParcelNos(normalized.map((p) => p.parcelNo));
        const totalSqm = normalized.reduce((sum, p) => sum + (p.areaSqm ?? 0), 0);
        if (totalSqm > 0) setAreaSqm(totalSqm);
        setTopoReady(!normalized.length);
      } catch {
        if (!cancelled) {
          setParcelPolygons([]);
          setSelectedParcelNos([]);
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
    parcelCandidates,
    listing.latitude,
    listing.longitude,
    listing.locationUrl,
  ]);

  useEffect(() => {
    if (!expectsMap) setMapReady(true);
  }, [expectsMap]);

  useEffect(() => {
    if (!photoFsOpen && !pdfViewerOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPhotoFsOpen(false);
        setPdfViewerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [photoFsOpen, pdfViewerOpen]);

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
  const pricePerSqmLabelValue = parsePricePerSqm(listing.price);
  const priceLabel =
    pricePerSqmLabelValue != null
      ? `${formatMoney(pricePerSqmLabelValue, lang)} ${lang === "ar" ? "د.أ / م²" : "JOD / m²"}`
      : "";
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
  const documentPdfUrl = useMemo(() => {
    if (!listing.document) return null;
    const [base, query = ""] = listing.document.split("?");
    const cacheBust = "pdfv=2";
    const mergedQuery = query ? `${query}&${cacheBust}` : cacheBust;
    return `${base}?${mergedQuery}`;
  }, [listing.document]);
  const documentPdfEmbedUrl = useMemo(() => {
    if (!documentPdfUrl) return null;
    return `${documentPdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`;
  }, [documentPdfUrl]);
  const selectedParcels = useMemo(() => {
    if (!parcelPolygons.length) return [];
    if (!selectedParcelNos.length) return parcelPolygons;
    const selectedSet = new Set(selectedParcelNos);
    const matched = parcelPolygons.filter((p) => selectedSet.has(p.parcelNo));
    // If selection state drifts (e.g. stale parcelNos), never collapse to a partial/empty map.
    return matched.length ? matched : parcelPolygons;
  }, [parcelPolygons, selectedParcelNos]);
  const displayParcelRings = useMemo(
    () =>
      selectedParcels.flatMap((parcel) =>
        (parcel.rings ?? [])
          .filter((ring) => ring.length >= 3)
          .map((ring) => ({ ring, parcelNo: parcel.parcelNo }))
      ),
    [selectedParcels]
  );
  const displayRings = useMemo(() => displayParcelRings.map((item) => item.ring), [displayParcelRings]);
  const displayParcelNumbers = useMemo(
    () => displayParcelRings.map((item) => item.parcelNo),
    [displayParcelRings]
  );
  const hasParcelOutline = Boolean(displayRings[0]?.length);
  const perimeterM = useMemo(() => {
    const total = selectedParcels.reduce((sum, p) => sum + (p.perimeterM ?? 0), 0);
    return total > 0 ? total : null;
  }, [selectedParcels]);
  const selectedAreaSqm = useMemo(() => {
    const total = selectedParcels.reduce((sum, p) => sum + (p.areaSqm ?? 0), 0);
    return total > 0 ? total : null;
  }, [selectedParcels]);
  const selectedRoads = useMemo(
    () =>
      selectedParcels
        .flatMap((parcel) => parcel.adjacentRoads ?? [])
        .filter((road, idx, arr) => arr.findIndex((x) => x.id === road.id && x.side === road.side) === idx),
    [selectedParcels]
  );
  const effectiveArea =
    (selectedAreaSqm && selectedAreaSqm > 0 ? selectedAreaSqm : null) ??
    (areaSqm && areaSqm > 0 ? areaSqm : parseAreaSqm(listing.size));
  const computedSizeLabel = effectiveArea ? formatDlsArea(effectiveArea, lang) : sizeLabel;
  const pricePerSqm = parsePricePerSqm(listing.price);
  const requestedTotal =
    pricePerSqm != null && effectiveArea != null ? adminMedianEstimate(pricePerSqm, effectiveArea) : null;
  const currency = t.owners.dlsHintCurrency;
  const offerPrintRows = useMemo(
    () => {
      const rows = [
        { label: lang === "ar" ? "رقم العرض" : "Offer no.", value: listing.listingNo },
        { label: lang === "ar" ? "عنوان العرض" : "Offer title", value: title },
        { label: t.offers.type, value: propertyType },
        { label: t.offers.size, value: computedSizeLabel || listing.size || "" },
        { label: lang === "ar" ? "السعر لكل متر" : "Price per m²", value: priceLabel || t.offers.onRequest },
        { label: t.offers.statusLabel, value: t.offers.status[listing.status] },
      ];
      if (listing.administrativeValue != null) {
        rows.push({
          label: lang === "ar" ? "القيمة الاسترشادية (تجارية)" : "Commercial valuation (guide)",
          value: `${formatMoney(listing.administrativeValue, lang)} ${lang === "ar" ? "د.أ / م²" : "JOD / m²"}`,
        });
      }
      if (requestedTotal != null) {
        rows.push({
          label: t.offers.requestedTotalLabel,
          value: `${formatMoney(requestedTotal, lang)} ${currency}`,
        });
      }
      rows.push({ label: lang === "ar" ? "هاتف التواصل" : "Contact phone", value: listing.phone || "" });
      return rows;
    },
    [
      lang,
      listing.listingNo,
      title,
      t.offers.type,
      propertyType,
      t.offers.size,
      computedSizeLabel,
      listing.size,
      t.offers.price,
      priceLabel,
      t.offers.onRequest,
      t.offers.statusLabel,
      t.offers.status,
      listing.status,
      listing.administrativeValue,
      t.offers.requestedTotalLabel,
      requestedTotal,
      currency,
      listing.phone,
    ]
  );
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
    polygon: displayRings,
    lockEditing: hasParcelOutline,
    perimeterM,
    areaSqm: effectiveArea,
    areaLabel: computedSizeLabel || listing.size,
    parcelNumbers: displayParcelNumbers,
    adjacentRoads: selectedRoads,
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
      extraRows: offerPrintRows,
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

  async function shareOffer() {
    const url = typeof window !== "undefined" ? window.location.href : listing.document ?? "";
    if (!url) return;
    const shareText = `${title} — ${listing.listingNo}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: shareText, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 1800);
      } catch {
        // Ignore clipboard/share failures silently.
      }
    }
  }

  function handlePrint() {
    setPrintError("");
    setPrinting(true);
    const run = async () => {
      const mapSnapshot = await mapLocationRef.current?.captureMapSnapshot?.();
      if (!mapSnapshot) {
        throw new Error("live-map-snapshot-unavailable");
      }
      if (printLocationRef.current?.printBlueprintWithSnapshot) {
        await printLocationRef.current.printBlueprintWithSnapshot(mapSnapshot);
        return;
      }
      await printLocationRef.current?.printBlueprint();
    };
    if (!printLocationRef.current) {
      setPrintError(t.locationPicker.sideViewPrintError);
      setPrinting(false);
      return;
    }
    void run()
      .catch((err: unknown) => {
        const code = err instanceof Error ? err.message : "";
        if (code === "popup-blocked") {
          setPrintError(
            lang === "ar"
              ? "المتصفح منع النافذة. اسمح بالنوافذ المنبثقة لهذه الصفحة وحاول مجددًا."
              : "The browser blocked the print window. Allow popups for this site and try again."
          );
        } else if (code === "satellite-unavailable" || code.startsWith("sat-")) {
          setPrintError(
            lang === "ar"
              ? "تعذر تحميل صورة القمر الصناعي. تحقق من الاتصال وحاول مرة أخرى."
              : "Could not load satellite imagery. Check your connection and try again."
          );
        } else if (code === "live-map-snapshot-unavailable") {
          setPrintError(
            lang === "ar"
              ? "تعذر التقاط لقطة الخريطة الحالية للطباعة. حرّك/كبّر الخريطة قليلًا وانتظر اكتمال تحميلها ثم أعد المحاولة."
              : "Could not capture the current live map view for print. Pan/zoom slightly, wait for tiles to load, then try again."
          );
        } else {
          setPrintError(t.locationPicker.sideViewPrintError);
        }
      })
      .finally(() => setPrinting(false));
  }

  const pricingBlock =
    showOfficialEst && listing.administrativeValue !== null ? (
      <DlsPricingHint
        ratePerSqm={listing.administrativeValue}
        sizeLabel={computedSizeLabel || listing.size}
        areaSqm={effectiveArea}
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

  const pdfViewer =
    pdfViewerOpen && listing.document && typeof document !== "undefined"
      ? createPortal(
          <div className="offer-photo-fs offer-photo-fs--pdf" role="dialog" aria-modal="true" aria-label={t.offers.documentLabel}>
            <div className="offer-photo-fs-toolbar offer-photo-fs-toolbar--pdf flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPdfViewerOpen(false)}
                className="h-9 px-4 rounded-full border border-gold bg-gold text-[#0a1f1c] text-[11px] font-bold"
              >
                {lang === "ar" ? "رجوع" : "Back"}
              </button>
              <a
                href={listing.document}
                target="_blank"
                rel="noopener"
                className="h-9 px-4 rounded-full border border-gold/50 text-gold text-[11px] font-bold inline-flex items-center"
              >
                {t.offers.openFile}
              </a>
            </div>
            <div className="offer-photo-fs-stage offer-photo-fs-stage--pdf !p-0" onClick={() => setPdfViewerOpen(false)}>
              <div
                className="w-[min(96vw,1100px)] h-[min(90vh,980px)] bg-white rounded-xl overflow-hidden border border-line"
                onClick={(e) => e.stopPropagation()}
              >
                {documentPdfEmbedUrl ? (
                  <object data={documentPdfEmbedUrl} type="application/pdf" className="w-full h-full">
                    <iframe title={t.offers.documentLabel} src={documentPdfEmbedUrl} className="w-full h-full" />
                  </object>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <p className="text-sm text-ink-soft">
                      {lang === "ar"
                        ? "تعذّر عرض PDF داخل الصفحة. يمكنك فتح الملف مباشرة."
                        : "Unable to render this PDF in-page. Open it directly."}
                    </p>
                    <a
                      href={listing.document}
                      target="_blank"
                      rel="noopener"
                      className="h-10 px-4 rounded-full border border-gold bg-gold text-[#0a1f1c] text-xs font-bold inline-flex items-center"
                    >
                      {t.offers.openFile}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:py-16">
      {pageLoader}
      {photoLightbox}
      {pdfViewer}

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
          <div className="mt-5">
            <h2 className="text-[11px] font-bold text-gold tracking-wide mb-3">{t.offers.filesLabel}</h2>
            <div className="flex flex-col gap-3 sm:offer-media-rail">
              {listing.video && <OfferVideo src={listing.video} label={t.offers.videoLabel} />}
              {listing.document && (
                <button
                  type="button"
                  onClick={() => setPdfViewerOpen(true)}
                  className="w-full sm:w-[min(70vw,260px)] rounded-2xl border border-line bg-white p-4 flex flex-col justify-between gap-5 hover:border-gold/50 transition-colors text-start"
                >
                  <div>
                    <p className="text-[11px] font-bold text-gold tracking-wide">{t.offers.documentLabel}</p>
                    <p className="mt-2 text-sm font-bold text-green leading-snug">{t.offers.viewDocument}</p>
                  </div>
                  <span className="inline-flex h-9 items-center justify-center rounded-full bg-green text-white text-xs font-bold px-4">
                    {t.offers.openFile}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="grid lg:grid-cols-[1.4fr_0.8fr] gap-6 lg:gap-8 items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {areaLabel && <span className="text-gold text-xs font-bold tracking-wide">{areaLabel}</span>}
            <span dir="ltr" className="text-xs font-mono text-green bg-surface-2 px-2.5 py-1 rounded-full">
              {listing.listingNo}
            </span>
            <OfferImportanceBadge importance={listing.importance ?? (listing.featured ? "titanium" : "none")} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-balance">{title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={shareOffer}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-line bg-white text-xs sm:text-sm font-bold text-green hover:border-gold/60"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M15 8a3 3 0 1 0-2.8-4H12a3 3 0 0 0 .2 1.1L8.9 7A3 3 0 0 0 6 6a3 3 0 1 0 2.9 3.8l3.3 1.9a3 3 0 0 0 .8 4.9 3 3 0 1 0 .9-1.6l-3.5-2a3 3 0 0 0 0-1.6l3.3-1.9A3 3 0 0 0 15 8Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {shareCopied ? (lang === "ar" ? "تم النسخ" : "Copied") : lang === "ar" ? "مشاركة" : "Share"}
              </button>
              {hasParcelOutline && (
                <button
                  type="button"
                  disabled={!blueprintReady || printing || geoLoading || !mapReady}
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-gold text-[#0a1f1c] text-xs sm:text-sm font-bold hover:bg-gold-2 transition-colors disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M7 8V4h10v4M6 18h12v2H6v-2Zm-2-8h16v6H4v-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {printing ? t.locationPicker.sideViewPrinting : t.locationPicker.sideViewPrint}
                </button>
              )}
            </div>
          </div>
          <p className="text-ink-soft mt-3 leading-relaxed text-sm sm:text-base md:text-lg">{listing.description}</p>
          {printError && <p className="mt-2 text-sm text-red-600">{printError}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 mt-6">
            {listing.propertyType && <Fact k={t.offers.type} v={propertyType} />}
            {computedSizeLabel && <Fact k={t.offers.size} v={computedSizeLabel} />}
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
            {parcelPolygons.length > 1 && (
              <div className="mb-3 rounded-2xl border border-line bg-white/90 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedParcelNos(parcelPolygons.map((p) => p.parcelNo))}
                    className="h-8 px-3 rounded-full border border-line bg-surface-2 text-[11px] font-bold"
                  >
                    {lang === "ar" ? "إظهار الكل" : "Show all"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedParcelNos([])}
                    className="h-8 px-3 rounded-full border border-line bg-surface-2 text-[11px] font-bold"
                  >
                    {lang === "ar" ? "إخفاء الكل" : "Hide all"}
                  </button>
                  {parcelPolygons.map((parcel) => {
                    const active = selectedParcelNos.includes(parcel.parcelNo);
                    return (
                      <button
                        key={parcel.parcelNo}
                        type="button"
                        onClick={() =>
                          setSelectedParcelNos((prev) =>
                            prev.includes(parcel.parcelNo)
                              ? prev.filter((p) => p !== parcel.parcelNo)
                              : [...prev, parcel.parcelNo]
                          )
                        }
                        className={`h-8 px-3 rounded-full text-[11px] font-bold border ${
                          active
                            ? "bg-green text-white border-green"
                            : "bg-white text-ink-soft border-line"
                        }`}
                      >
                        {lang === "ar" ? `قطعة ${parcel.parcelNo}` : `Parcel ${parcel.parcelNo}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {expectsMap ? (
              <LocationInput
                ref={mapLocationRef}
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

        <aside className="min-w-0 flex flex-col gap-4 sm:gap-5 lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
          <div className="rounded-3xl border border-line bg-white p-6 shadow-[0_24px_50px_-36px_rgba(15,52,47,0.35)]">
            <p className="text-xs font-bold text-ink-soft">{t.offers.price}</p>
            <p className="text-2xl font-bold text-green mt-1 [overflow-wrap:anywhere]">
              {priceLabel || t.offers.onRequest}
            </p>
            {computedSizeLabel && (
              <p className="text-sm text-ink-soft mt-2 [overflow-wrap:anywhere]">
                {t.offers.size}: <span className="font-bold text-ink">{computedSizeLabel}</span>
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
                  ref={printLocationRef}
                  {...locationShared}
                  showMap={false}
                  showTopo
                  onBlueprintReadyChange={setBlueprintReady}
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
      <b className="block text-[13px] sm:text-sm [overflow-wrap:anywhere]">{v}</b>
    </div>
  );
}

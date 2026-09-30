"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatMeters, type Coords } from "@/lib/mapCoords";
import { createParcelCanvasLayer, type ParcelCanvasOpts } from "@/lib/parcelCanvasLayer";
import {
  attachMeasureTool,
  parcelSnapTargets,
  type MeasureMode,
  type MeasureSnapshot,
  type MeasureTool,
} from "@/lib/measureDraw";
import { MeasureToolbar } from "@/components/MeasureToolbar";
import type { ParcelRing } from "@/components/LocationInput";
import "leaflet/dist/leaflet.css";

type Basemap = "map" | "satellite";

type Extents = { lengthM: number; widthM: number } | null;

type Labels = {
  basemapLabel: string;
  basemapMap: string;
  basemapSatellite: string;
  dimensionsOnMap: string;
  dimensionsTitle: string;
  dimensionsArea: string;
  dimensionsPerimeter: string;
  dimensionsExtent: string;
  exitFullscreen: string;
  measureEnter: string;
  measureExit: string;
  measureLabel: string;
  measureDistance: string;
  measureArea: string;
  measureTotal: string;
  measureClear: string;
  measureFinish: string;
  measureUndo: string;
  measureNewLine: string;
  measureThreads: string;
  measureSnapOn: string;
  measureEdgeSnap: string;
  measureLineColor: string;
  measureHintDistance: string;
  measureHintArea: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  basemap: Basemap;
  onBasemapChange: (b: Basemap) => void;
  drawDimensions: boolean;
  onDrawDimensionsChange: (v: boolean) => void;
  showDimensions: boolean;
  measureMode: MeasureMode;
  onMeasureModeChange: (m: MeasureMode) => void;
  edgeSnap: boolean;
  onEdgeSnapChange: (v: boolean) => void;
  lineColor: string;
  onLineColorChange: (hex: string) => void;
  polygon: ParcelRing[] | null | undefined;
  selected: Coords | null;
  perimeterM: number | null;
  areaLabel: string | null;
  areaSqm: number | null;
  extents: Extents;
  parcelNumber?: string | null;
  parcelLabel?: string;
  lang: "ar" | "en";
  labels: Labels;
};

const DEFAULT_CENTER: [number, number] = [31.9539, 35.9106];
const MAP_MAX_ZOOM = 19;
const MEASURE_MAX_ZOOM = 22;

/**
 * Independent fullscreen map: mounts a brand-new Leaflet instance in a body portal.
 * The inline map is never resized — this avoids the blank-tile bug after fullscreen.
 */
export function MapFullscreenPortal({
  open,
  onClose,
  basemap,
  onBasemapChange,
  drawDimensions,
  onDrawDimensionsChange,
  showDimensions,
  measureMode,
  onMeasureModeChange,
  edgeSnap,
  onEdgeSnapChange,
  lineColor,
  onLineColorChange,
  polygon,
  selected,
  perimeterM,
  areaLabel,
  areaSqm,
  extents,
  parcelNumber = null,
  parcelLabel = "",
  lang,
  labels: lp,
}: Props) {
  const paneRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const osmRef = useRef<import("leaflet").TileLayer | null>(null);
  const satRef = useRef<import("leaflet").TileLayer | null>(null);
  const polyRef = useRef<import("leaflet").Polygon | null>(null);
  const dimsRef = useRef<import("leaflet").LayerGroup | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const measureToolRef = useRef<MeasureTool | null>(null);
  const [measureSnap, setMeasureSnap] = useState<MeasureSnapshot | null>(null);
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;
  const measureModeRef = useRef(measureMode);
  measureModeRef.current = measureMode;

  const snapTargets = useMemo(
    () => parcelSnapTargets(polygon as [number, number][][] | null | undefined),
    [polygon]
  );
  const measuring = measureMode !== "off";
  const dimsOnCanvas = Boolean(drawDimensions && showDimensions && !measuring);

  // Body scroll lock + Escape; block iOS rubber-band scroll outside the map pane
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (measureModeRef.current !== "off") {
          measureToolRef.current?.clear();
          onMeasureModeChange("off");
          return;
        }
        onClose();
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.(".map-fs-portal-pane, .map-fs-portal-toolbar")) return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
      document.documentElement.style.overflow = prevHtmlOverflow;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, [open, onClose, onMeasureModeChange]);

  // Boot a fresh map only while the portal is open; tear down on close.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    const boot = async () => {
      const L = await import("leaflet");
      for (let i = 0; i < 20 && !cancelled; i++) {
        const el = paneRef.current;
        if (el && el.clientWidth > 40 && el.clientHeight > 40) break;
        await new Promise((r) => window.setTimeout(r, 40));
      }
      if (cancelled || !paneRef.current) return;

      const start = selected
        ? ([selected.lat, selected.lng] as [number, number])
        : DEFAULT_CENTER;
      map = L.map(paneRef.current, {
        zoomControl: true,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: false,
        boxZoom: false,
        maxZoom: measureModeRef.current !== "off" ? MEASURE_MAX_ZOOM : MAP_MAX_ZOOM,
      }).setView(start, selected ? 16 : 8);

      const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxNativeZoom: MAP_MAX_ZOOM,
        maxZoom: MEASURE_MAX_ZOOM,
        crossOrigin: true,
      });
      const sat = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "© Esri",
          maxNativeZoom: MAP_MAX_ZOOM,
          maxZoom: MEASURE_MAX_ZOOM,
          crossOrigin: true,
        }
      );
      osmRef.current = osm;
      satRef.current = sat;
      (basemapRef.current === "satellite" ? sat : osm).addTo(map);
      mapRef.current = map;

      if (polygon && polygon.length > 0) {
        const opts: ParcelCanvasOpts = {
          rings: polygon as [number, number][][],
          showDimensions: Boolean(
            drawDimensions && showDimensions && measureModeRef.current === "off"
          ),
          perimeterM,
          lang,
          parcelNumber,
          parcelLabel,
        };
        const layer = createParcelCanvasLayer(L, opts);
        layer.addTo(map);
        polyRef.current = layer as unknown as import("leaflet").Polygon;
        try {
          map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 19, animate: false });
        } catch {
          /* ignore */
        }
      } else if (selected) {
        const icon = L.divIcon({
          className: "",
          html: '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;background:#113a34;border:2px solid #caa064;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,.25)"></span>',
          iconSize: [22, 22],
          iconAnchor: [11, 22],
        });
        markerRef.current = L.marker([selected.lat, selected.lng], {
          icon,
          interactive: false,
        }).addTo(map);
      }

      measureToolRef.current = attachMeasureTool(L, map, {
        lang,
        onChange: setMeasureSnap,
      });
      measureToolRef.current.setSnapTargets(
        parcelSnapTargets(polygon as [number, number][][] | null | undefined)
      );
      measureToolRef.current.setEdgeSnap(edgeSnap);
      measureToolRef.current.setLineColor(lineColor);
      if (measureModeRef.current !== "off") {
        measureToolRef.current.setMode(measureModeRef.current);
      }

      requestAnimationFrame(() => {
        map?.invalidateSize({ animate: false });
        window.setTimeout(() => map?.invalidateSize({ animate: false }), 120);
        window.setTimeout(() => map?.invalidateSize({ animate: false }), 400);
      });
    };

    void boot();

    return () => {
      cancelled = true;
      measureToolRef.current?.destroy();
      measureToolRef.current = null;
      map?.remove();
      mapRef.current = null;
      osmRef.current = null;
      satRef.current = null;
      polyRef.current = null;
      dimsRef.current = null;
      markerRef.current = null;
      setMeasureSnap(null);
    };
    // Intentionally only when open flips — polygon/selected snapshotted at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const map = mapRef.current;
    const osm = osmRef.current;
    const sat = satRef.current;
    if (!map || !osm || !sat) return;
    const active = basemap === "satellite" ? sat : osm;
    const idle = basemap === "satellite" ? osm : sat;
    if (map.hasLayer(idle)) map.removeLayer(idle);
    if (!map.hasLayer(active)) active.addTo(map);
  }, [basemap, open]);

  useEffect(() => {
    if (!open) return;
    measureToolRef.current?.setMode(measureMode);
    if (measureMode === "off") setMeasureSnap(null);
    const map = mapRef.current;
    if (map) {
      const nextMax = measureMode !== "off" ? MEASURE_MAX_ZOOM : MAP_MAX_ZOOM;
      map.setMaxZoom(nextMax);
      if (measureMode === "off" && map.getZoom() > MAP_MAX_ZOOM) {
        map.setZoom(MAP_MAX_ZOOM, { animate: false });
      }
    }
  }, [open, measureMode]);

  useEffect(() => {
    if (!open) return;
    measureToolRef.current?.setSnapTargets(snapTargets);
  }, [open, snapTargets]);

  useEffect(() => {
    if (!open) return;
    measureToolRef.current?.setEdgeSnap(edgeSnap);
  }, [open, edgeSnap]);

  useEffect(() => {
    if (!open) return;
    measureToolRef.current?.setLineColor(lineColor);
  }, [open, lineColor]);

  useEffect(() => {
    if (!open || !measureSnap) return;
    if (measureSnap.lineColor && measureSnap.lineColor !== lineColor) {
      onLineColorChange(measureSnap.lineColor);
    }
    if (measureSnap.mode !== "off" && measureSnap.mode !== measureMode) {
      onMeasureModeChange(measureSnap.mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, measureSnap?.lineColor, measureSnap?.mode]);

  useEffect(() => {
    if (!open) return;
    const layer = polyRef.current as unknown as
      | { setParcelOptions?: (o: ParcelCanvasOpts) => void }
      | null;
    if (!layer?.setParcelOptions || !polygon?.[0]?.length) return;
    layer.setParcelOptions({
      rings: polygon as [number, number][][],
      showDimensions: dimsOnCanvas,
      perimeterM,
      lang,
      parcelNumber,
      parcelLabel,
    });
  }, [open, dimsOnCanvas, polygon, perimeterM, lang, parcelNumber, parcelLabel]);

  if (!open || typeof document === "undefined") return null;

  const hasInfo =
    Boolean(areaLabel || areaSqm != null || (perimeterM != null && perimeterM > 0) || extents);

  const measureLabels = {
    measureEnter: lp.measureEnter,
    measureExit: lp.measureExit,
    measureLabel: lp.measureLabel,
    measureDistance: lp.measureDistance,
    measureArea: lp.measureArea,
    measureTotal: lp.measureTotal,
    measureClear: lp.measureClear,
    measureFinish: lp.measureFinish,
    measureUndo: lp.measureUndo,
    measureNewLine: lp.measureNewLine,
    measureThreads: lp.measureThreads,
    measureSnapOn: lp.measureSnapOn,
    measureEdgeSnap: lp.measureEdgeSnap,
    measureLineColor: lp.measureLineColor,
    measureHintDistance: lp.measureHintDistance,
    measureHintArea: lp.measureHintArea,
    dimensionsArea: lp.dimensionsArea,
  };

  return createPortal(
    <div
      className="map-fs-portal fixed inset-0 z-[10000] flex flex-col gap-2 bg-[#0a1f1c] p-2 sm:p-3 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={lp.exitFullscreen}
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="map-fs-portal-toolbar shrink-0 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-gold/40 bg-[#0f342f] px-2 py-2">
        <div
          className="inline-flex rounded-full border border-gold/35 bg-[#0a1f1c] p-0.5"
          role="group"
          aria-label={lp.basemapLabel}
        >
          <button
            type="button"
            onClick={() => onBasemapChange("map")}
            className={`min-h-11 h-8 px-3 rounded-full text-[11px] font-bold transition-colors ${
              basemap === "map" ? "bg-green text-white" : "text-gold/80 hover:text-gold"
            }`}
          >
            {lp.basemapMap}
          </button>
          <button
            type="button"
            onClick={() => onBasemapChange("satellite")}
            className={`min-h-11 h-8 px-3 rounded-full text-[11px] font-bold transition-colors ${
              basemap === "satellite" ? "bg-green text-white" : "text-gold/80 hover:text-gold"
            }`}
          >
            {lp.basemapSatellite}
          </button>
        </div>
        {Boolean(polygon?.[0]?.length) && showDimensions && !measuring && (
          <button
            type="button"
            onClick={() => onDrawDimensionsChange(!drawDimensions)}
            className={`min-h-11 h-8 px-3 rounded-full text-[11px] font-bold border transition-colors ${
              drawDimensions
                ? "bg-gold/15 border-gold text-gold"
                : "border-gold/35 text-gold/80 hover:text-gold bg-[#0a1f1c]"
            }`}
            aria-pressed={drawDimensions}
          >
            {lp.dimensionsOnMap}
          </button>
        )}
        {!measuring && (
          <MeasureToolbar
            mode={measureMode}
            snap={measureSnap}
            hasParcelSnap={snapTargets.length > 0}
            edgeSnap={edgeSnap}
            onEdgeSnapChange={onEdgeSnapChange}
            lineColor={lineColor}
            onLineColorChange={onLineColorChange}
            lang={lang}
            variant="dark"
            labels={measureLabels}
            onEnter={() => onMeasureModeChange("distance")}
            onExit={() => {
              measureToolRef.current?.clear();
              onMeasureModeChange("off");
            }}
            onModeChange={(m) => onMeasureModeChange(m)}
            onUndo={() => measureToolRef.current?.undo()}
            onClear={() => measureToolRef.current?.clear()}
            onFinish={() => measureToolRef.current?.finish()}
            onNewLine={() => measureToolRef.current?.newThread()}
            onRemoveThread={(id) => measureToolRef.current?.removeThread(id)}
          />
        )}
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 h-8 px-3 rounded-full border border-gold bg-gold text-[#0a1f1c] text-[11px] font-bold"
        >
          {lp.exitFullscreen}
        </button>
      </div>

      {measuring && (
        <div className="map-fs-portal-toolbar shrink-0">
          <MeasureToolbar
            mode={measureMode}
            snap={measureSnap}
            hasParcelSnap={snapTargets.length > 0}
            edgeSnap={edgeSnap}
            onEdgeSnapChange={onEdgeSnapChange}
            lineColor={lineColor}
            onLineColorChange={onLineColorChange}
            lang={lang}
            variant="dark"
            labels={measureLabels}
            onEnter={() => onMeasureModeChange("distance")}
            onExit={() => {
              measureToolRef.current?.clear();
              onMeasureModeChange("off");
            }}
            onModeChange={(m) => onMeasureModeChange(m)}
            onUndo={() => measureToolRef.current?.undo()}
            onClear={() => measureToolRef.current?.clear()}
            onFinish={() => measureToolRef.current?.finish()}
            onNewLine={() => measureToolRef.current?.newThread()}
            onRemoveThread={(id) => measureToolRef.current?.removeThread(id)}
          />
        </div>
      )}

      <div
        ref={paneRef}
        className="map-fs-portal-pane relative min-h-0 flex-1 w-full overflow-hidden rounded-xl border border-line bg-surface-2 touch-none"
      />

      {hasInfo && !measuring && (
        <div className="shrink-0 rounded-xl border border-gold/35 bg-[#0f342f] px-3 py-2 text-gold-2">
          <p className="text-[10px] font-bold tracking-wide mb-1 text-gold">{lp.dimensionsTitle}</p>
          <ul className="space-y-0.5 text-[11px] leading-snug">
            {parcelNumber && (
              <li>
                <span className="text-gold/70">{parcelLabel}: </span>
                <b>{parcelNumber}</b>
              </li>
            )}
            {(areaLabel || areaSqm != null) && (
              <li>
                <span className="text-gold/70">{lp.dimensionsArea}: </span>
                <b>{areaLabel || `${areaSqm!.toLocaleString("en-JO")} m²`}</b>
              </li>
            )}
            {perimeterM != null && perimeterM > 0 && (
              <li>
                <span className="text-gold/70">{lp.dimensionsPerimeter}: </span>
                <b>{formatMeters(perimeterM, lang)}</b>
              </li>
            )}
            {extents && (
              <li>
                <span className="text-gold/70">{lp.dimensionsExtent}: </span>
                <b>
                  {formatMeters(extents.lengthM, lang)} × {formatMeters(extents.widthM, lang)}
                </b>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>,
    document.body
  );
}

"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  formatMeters,
  ringEdgeDimensions,
  type Coords,
} from "@/lib/mapCoords";
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
};

type Props = {
  open: boolean;
  onClose: () => void;
  basemap: Basemap;
  onBasemapChange: (b: Basemap) => void;
  drawDimensions: boolean;
  onDrawDimensionsChange: (v: boolean) => void;
  showDimensions: boolean;
  polygon: ParcelRing[] | null | undefined;
  selected: Coords | null;
  perimeterM: number | null;
  areaLabel: string | null;
  areaSqm: number | null;
  extents: Extents;
  lang: "ar" | "en";
  labels: Labels;
};

const DEFAULT_CENTER: [number, number] = [31.9539, 35.9106];

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
  polygon,
  selected,
  perimeterM,
  areaLabel,
  areaSqm,
  extents,
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
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;

  // Body scroll lock + Escape
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Boot a fresh map only while the portal is open; tear down on close.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    const boot = async () => {
      const L = await import("leaflet");
      // Wait until the portal pane has a real size
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
      }).setView(start, selected ? 16 : 8);

      const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
        crossOrigin: true,
      });
      const sat = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "© Esri", maxZoom: 19, crossOrigin: true }
      );
      osmRef.current = osm;
      satRef.current = sat;
      (basemapRef.current === "satellite" ? sat : osm).addTo(map);
      mapRef.current = map;

      if (polygon && polygon.length > 0) {
        const layer = L.polygon(polygon, {
          color: "#113a34",
          weight: 2.5,
          fillColor: "#caa064",
          fillOpacity: 0.28,
          interactive: false,
        }).addTo(map);
        polyRef.current = layer;
        map.fitBounds(layer.getBounds(), { padding: [36, 36], maxZoom: 18, animate: false });
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

      // Size passes after first paint
      requestAnimationFrame(() => {
        map?.invalidateSize({ animate: false });
        window.setTimeout(() => map?.invalidateSize({ animate: false }), 120);
        window.setTimeout(() => map?.invalidateSize({ animate: false }), 400);
      });
    };

    void boot();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      osmRef.current = null;
      satRef.current = null;
      polyRef.current = null;
      dimsRef.current = null;
      markerRef.current = null;
    };
    // Intentionally only when open flips — polygon/selected snapshotted at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Basemap switch on the overlay instance
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

  // Dimension labels on the overlay instance
  useEffect(() => {
    if (!open) return;
    void import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;
      if (dimsRef.current) {
        map.removeLayer(dimsRef.current);
        dimsRef.current = null;
      }
      if (!drawDimensions || !showDimensions || !polygon?.[0]?.length) return;
      const rawEdges = ringEdgeDimensions(polygon[0]);
      const sum = rawEdges.reduce((s, e) => s + e.lengthM, 0);
      const scale =
        perimeterM != null &&
        perimeterM > 0 &&
        sum > 0 &&
        Math.abs(perimeterM - sum) / perimeterM <= 0.05
          ? perimeterM / sum
          : 1;
      const group = L.layerGroup().addTo(map);
      for (const edge of rawEdges) {
        const label = formatMeters(edge.lengthM * scale, lang);
        const icon = L.divIcon({
          className: "parcel-dim-label",
          html: `<span style="display:inline-block;padding:2px 6px;border-radius:6px;background:rgba(17,58,52,.92);color:#fff;font:700 10px/1.2 system-ui,sans-serif;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.25);border:1px solid #caa064;transform:translate(-50%,-50%)">${label}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        L.marker([edge.label.lat, edge.label.lng], {
          icon,
          interactive: false,
          keyboard: false,
        }).addTo(group);
      }
      dimsRef.current = group;
    });
  }, [open, drawDimensions, showDimensions, polygon, perimeterM, lang]);

  if (!open || typeof document === "undefined") return null;

  const hasInfo =
    Boolean(areaLabel || areaSqm != null || (perimeterM != null && perimeterM > 0) || extents);

  return createPortal(
    <div
      className="map-fs-portal fixed inset-0 z-[10000] flex flex-col gap-2 bg-[#0a1f1c] p-3"
      role="dialog"
      aria-modal="true"
      aria-label={lp.exitFullscreen}
    >
      <div className="shrink-0 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-gold/40 bg-[#0f342f] px-2 py-2">
        <div
          className="inline-flex rounded-full border border-gold/35 bg-[#0a1f1c] p-0.5"
          role="group"
          aria-label={lp.basemapLabel}
        >
          <button
            type="button"
            onClick={() => onBasemapChange("map")}
            className={`h-8 px-3 rounded-full text-[11px] font-bold transition-colors ${
              basemap === "map" ? "bg-green text-white" : "text-gold/80 hover:text-gold"
            }`}
          >
            {lp.basemapMap}
          </button>
          <button
            type="button"
            onClick={() => onBasemapChange("satellite")}
            className={`h-8 px-3 rounded-full text-[11px] font-bold transition-colors ${
              basemap === "satellite" ? "bg-green text-white" : "text-gold/80 hover:text-gold"
            }`}
          >
            {lp.basemapSatellite}
          </button>
        </div>
        {Boolean(polygon?.[0]?.length) && showDimensions && (
          <button
            type="button"
            onClick={() => onDrawDimensionsChange(!drawDimensions)}
            className={`h-8 px-3 rounded-full text-[11px] font-bold border transition-colors ${
              drawDimensions
                ? "bg-gold/15 border-gold text-gold"
                : "border-gold/35 text-gold/80 hover:text-gold bg-[#0a1f1c]"
            }`}
            aria-pressed={drawDimensions}
          >
            {lp.dimensionsOnMap}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="h-8 px-3 rounded-full border border-gold bg-gold text-[#0a1f1c] text-[11px] font-bold"
        >
          {lp.exitFullscreen}
        </button>
      </div>

      <div
        ref={paneRef}
        className="map-fs-portal-pane relative min-h-0 flex-1 w-full overflow-hidden rounded-xl border border-line bg-surface-2"
      />

      {hasInfo && (
        <div className="shrink-0 rounded-xl border border-gold/35 bg-[#0f342f] px-3 py-2 text-gold-2">
          <p className="text-[10px] font-bold tracking-wide mb-1 text-gold">{lp.dimensionsTitle}</p>
          <ul className="space-y-0.5 text-[11px] leading-snug">
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

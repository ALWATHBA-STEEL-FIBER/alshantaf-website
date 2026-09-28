"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import {
  coordsToString,
  formatMeters,
  mapsLinkFromCoords,
  parseCoords,
  ringEdgeDimensions,
  ringOrientedExtents,
  type Coords,
} from "@/lib/mapCoords";
import { ParcelSideView, type ParcelSideViewHandle } from "@/components/ParcelSideView";
import { MapFullscreenPortal } from "@/components/MapFullscreenPortal";
import type { BlueprintMeta } from "@/lib/parcelBlueprint";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [31.9539, 35.9106];
type SearchResult = { latitude: number; longitude: number; address: string };
/** Leaflet-ready ring: [lat, lng][]. */
export type ParcelRing = [number, number][];
type Basemap = "map" | "satellite";

export type LocationInputHandle = {
  printBlueprint: () => Promise<void>;
  canPrintBlueprint: () => boolean;
};

interface Props {
  /** Legacy canonical coordinate string, retained for existing records. */
  value: string;
  onChange: (value: string) => void;
  address?: string;
  onAddressChange?: (address: string) => void;
  readOnly?: boolean;
  /** Official DLS cadastral outline — when set with lockEditing, drawn and not editable. */
  polygon?: ParcelRing[] | null;
  /** Disallow pin/search edits (used when DLS geometry is authoritative). */
  lockEditing?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  statusNote?: string;
  idleNote?: string;
  /** Official / calculated area label (already localized). */
  areaLabel?: string | null;
  areaSqm?: number | null;
  perimeterM?: number | null;
  showDimensions?: boolean;
  /** Optional cadastral fields for the A4 blueprint PDF. */
  blueprint?: {
    governorate?: string;
    directorate?: string;
    village?: string;
    basin?: string;
    neighborhood?: string;
    parcel?: string;
    notes?: string;
    industryLabel?: string;
    industryValue?: string;
    industryUserChoseNote?: string;
  } | null;
  onBlueprintReadyChange?: (ready: boolean) => void;
}

function Spinner({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-green/25 border-t-green animate-spin ${className}`}
      aria-hidden
    />
  );
}

/** Shared location map. Search is routed through the application API so
 * providers and rate limits stay server-owned. */
export const LocationInput = forwardRef<LocationInputHandle, Props>(function LocationInput(
  {
  value,
  onChange,
  address = "",
  onAddressChange,
  readOnly = false,
  polygon = null,
  lockEditing = false,
  loading = false,
  loadingLabel,
  statusNote,
  idleNote,
  areaLabel = null,
  areaSqm = null,
  perimeterM = null,
  showDimensions = true,
  blueprint = null,
  onBlueprintReadyChange,
}: Props,
  ref
) {
  const { t, lang } = useLanguage();
  const lp = t.locationPicker;
  const sideViewRef = useRef<ParcelSideViewHandle>(null);
  const [blueprintReady, setBlueprintReady] = useState(false);

  useImperativeHandle(ref, () => ({
    canPrintBlueprint: () => blueprintReady && !!sideViewRef.current?.isReady(),
    printBlueprint: async () => {
      const mapSnapshot = await captureMapForBlueprint();
      await sideViewRef.current?.printBlueprint({ mapSnapshot });
    },
  }));

  /** Snapshot the live Leaflet map (prefer satellite basemap) for print fallback. */
  async function captureMapForBlueprint(): Promise<string | null> {
    const map = mapRef.current;
    const sat = satLayerRef.current;
    const osm = osmLayerRef.current;
    if (!map || !sat) return null;

    const prevBasemap = basemap;
    const ring = polygon?.[0];

    try {
      // Show satellite tiles that are already cacheable in the map view
      if (osm && map.hasLayer(osm)) map.removeLayer(osm);
      if (!map.hasLayer(sat)) sat.addTo(map);
      setBasemap("satellite");

      if (ring && ring.length >= 3) {
        const L = await import("leaflet");
        const latlngs = ring.map(([lat, lng]) => L.latLng(lat, lng));
        const bounds = L.latLngBounds(latlngs);
        map.fitBounds(bounds.pad(0.18), { animate: false, maxZoom: 18 });
      }
      map.invalidateSize();

      await new Promise<void>((resolve) => {
        const done = () => resolve();
        sat.once("load", done);
        window.setTimeout(done, 1800);
      });
      await new Promise((r) => window.setTimeout(r, 250));

      const size = map.getSize();
      const scale = Math.min(2.5, (window.devicePixelRatio || 1) * 1.5);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(size.x * scale));
      canvas.height = Math.max(1, Math.round(size.y * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.scale(scale, scale);
      ctx.fillStyle = "#0a1f1c";
      ctx.fillRect(0, 0, size.x, size.y);

      const container = map.getContainer();
      const origin = container.getBoundingClientRect();
      const tileImgs = Array.from(
        container.querySelectorAll<HTMLImageElement>(".leaflet-tile-pane img.leaflet-tile")
      );
      for (const img of tileImgs) {
        if (!img.complete || img.naturalWidth < 2) continue;
        const r = img.getBoundingClientRect();
        try {
          ctx.drawImage(img, r.left - origin.left, r.top - origin.top, r.width, r.height);
        } catch {
          /* CORS-tainted tile — skip */
        }
      }

      // Redraw parcel + edge dims in map screen space (reliable, no SVG CORS)
      if (ring && ring.length >= 3) {
        ctx.beginPath();
        ring.forEach(([lat, lng], i) => {
          const p = map.latLngToContainerPoint([lat, lng]);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = "rgba(200,154,88,0.22)";
        ctx.fill();
        ctx.strokeStyle = "#e8c98a";
        ctx.lineWidth = 3;
        ctx.stroke();

        if (drawDimensions || showDimensions) {
          const edges = ringEdgeDimensions(ring);
          const sum = edges.reduce((s, e) => s + e.lengthM, 0);
          const scaleLen =
            perimeterM != null &&
            perimeterM > 0 &&
            sum > 0 &&
            Math.abs(perimeterM - sum) / perimeterM <= 0.05
              ? perimeterM / sum
              : 1;
          for (const edge of edges) {
            const p = map.latLngToContainerPoint([edge.label.lat, edge.label.lng]);
            const text = formatMeters(edge.lengthM * scaleLen, lang);
            ctx.font = 'bold 15px "IBM Plex Sans Arabic",system-ui,sans-serif';
            const tw = ctx.measureText(text).width;
            ctx.fillStyle = "rgba(15,52,47,0.92)";
            ctx.fillRect(p.x - tw / 2 - 5, p.y - 10, tw + 10, 20);
            ctx.strokeStyle = "#c89a58";
            ctx.lineWidth = 1.2;
            ctx.strokeRect(p.x - tw / 2 - 5, p.y - 10, tw + 10, 20);
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, p.x, p.y);
          }
        }
      }

      try {
        return canvas.toDataURL("image/jpeg", 0.9);
      } catch {
        return null;
      }
    } catch {
      return null;
    } finally {
      // Restore previous basemap selection
      setBasemap(prevBasemap);
      const layers = { map: osm, satellite: sat } as const;
      const active = layers[prevBasemap];
      for (const layer of Object.values(layers)) {
        if (!layer) continue;
        if (layer === active) {
          if (!map.hasLayer(layer)) layer.addTo(map);
        } else if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      }
    }
  }

  function handleReadyChange(ready: boolean) {
    setBlueprintReady(ready);
    onBlueprintReadyChange?.(ready);
  }
  const locked = readOnly || lockEditing;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const initial = parseCoords(value);
  const [draft, setDraft] = useState(initial ? coordsToString(initial) : "");
  const [selected, setSelected] = useState<Coords | null>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "locating" | "error">("idle");
  const [message, setMessage] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [basemap, setBasemap] = useState<Basemap>("map");
  const [drawDimensions, setDrawDimensions] = useState(true);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [dimsEpoch, setDimsEpoch] = useState(0);
  const mapShellRef = useRef<HTMLDivElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const polygonRef = useRef<import("leaflet").Polygon | null>(null);
  const dimensionLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const osmLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const satLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const basemapRef = useRef<Basemap>(basemap);
  basemapRef.current = basemap;

  const extents = useMemo(() => {
    if (!polygon?.[0]?.length) return null;
    return ringOrientedExtents(polygon[0]);
  }, [polygon]);

  useEffect(() => {
    const parsed = parseCoords(value);
    const current = selected ? coordsToString(selected) : "";
    const next = parsed ? coordsToString(parsed) : "";
    if (next === current) return;
    setSelected(parsed);
    setDraft(parsed ? coordsToString(parsed) : "");
    // Sync from parent only (e.g. DLS auto-locate).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit(coords: Coords, nextAddress?: string) {
    if (lockedRef.current) return;
    setSelected(coords);
    setDraft(coordsToString(coords));
    onChange(coordsToString(coords));
    if (nextAddress !== undefined) onAddressChange?.(nextAddress);
    setMessage("");
    setStatus("idle");
  }

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    let cancelled = false;
    let clickHandler: ((event: import("leaflet").LeafletMouseEvent) => void) | null = null;

    const boot = async () => {
      const L = await import("leaflet");
      if (cancelled || !mapDivRef.current) return;

      // Wait until the container has a real size — init with 0×0 is a common blank-map cause.
      for (let i = 0; i < 12 && !cancelled; i++) {
        const el = mapDivRef.current;
        if (el && el.clientWidth > 20 && el.clientHeight > 20) break;
        await new Promise((r) => window.setTimeout(r, 50));
      }
      if (cancelled || !mapDivRef.current || mapRef.current) return;

      const start = selected ? ([selected.lat, selected.lng] as [number, number]) : DEFAULT_CENTER;
      const map = L.map(mapDivRef.current, {
        zoomControl: true,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: !locked,
        boxZoom: !locked,
      }).setView(start, selected ? 16 : 8);

      const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
        crossOrigin: true,
      });
      const sat = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "© Esri",
          maxZoom: 19,
          crossOrigin: true,
        }
      );
      osm.addTo(map);
      osmLayerRef.current = osm;
      satLayerRef.current = sat;
      mapRef.current = map;

      clickHandler = (event) => {
        if (lockedRef.current) return;
        placeMarker(L, map, event.latlng.lat, event.latlng.lng, true);
        commit({ lat: event.latlng.lat, lng: event.latlng.lng });
      };
      map.on("click", clickHandler);

      // Extra invalidate passes after layout / fonts / sibling UI settle
      requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
        window.setTimeout(() => map.invalidateSize({ animate: false }), 120);
        window.setTimeout(() => map.invalidateSize({ animate: false }), 400);
      });
      setMapReady(true);
    };

    boot().catch(() => {
      setStatus("error");
      setMessage(lp.loading);
    });
    return () => {
      cancelled = true;
      setMapReady(false);
      const map = mapRef.current;
      if (map && clickHandler) map.off("click", clickHandler);
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
      polygonRef.current = null;
      dimensionLayerRef.current = null;
      osmLayerRef.current = null;
      satLayerRef.current = null;
    };
    // Leaflet must be initialized once per container; lockEditing toggles via effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep interaction mode in sync without remounting (remounts caused intermittent blank maps).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (locked) {
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
      if (markerRef.current?.dragging) markerRef.current.dragging.disable();
    } else {
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
      if (markerRef.current?.dragging) markerRef.current.dragging.enable();
    }
  }, [locked, mapReady]);

  useEffect(() => {
    // Force tile redraw after basemap switch / container reveal
    const map = mapRef.current;
    const osm = osmLayerRef.current;
    const sat = satLayerRef.current;
    if (!map || !osm || !sat) return;

    const layers = { map: osm, satellite: sat } as const;
    const active = layers[basemap];
    for (const layer of Object.values(layers)) {
      if (layer === active) {
        if (!map.hasLayer(layer)) layer.addTo(map);
      } else if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    }
    window.setTimeout(() => map.invalidateSize({ animate: false }), 40);
  }, [basemap, mapReady]);

  // Inline map never enters fullscreen — portal mounts a separate Leaflet instance.

  function placeMarker(
    L: typeof import("leaflet"),
    map: import("leaflet").Map,
    lat: number,
    lng: number,
    draggable: boolean
  ) {
    const icon = L.divIcon({
      className: "",
      html: '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;background:#113a34;border:2px solid #caa064;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,.25)"></span>',
      iconSize: [22, 22],
      iconAnchor: [11, 22],
    });
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { icon, draggable }).addTo(map);
      if (draggable) {
        markerRef.current.on("dragend", () => {
          const point = markerRef.current!.getLatLng();
          commit({ lat: point.lat, lng: point.lng });
        });
      }
    } else {
      markerRef.current.setLatLng([lat, lng]);
      if (markerRef.current.dragging) {
        if (draggable) markerRef.current.dragging.enable();
        else markerRef.current.dragging.disable();
      }
    }
  }

  // Sync pin + polygon whenever selection or outline changes.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    void import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;

      if (polygonRef.current) {
        map.removeLayer(polygonRef.current);
        polygonRef.current = null;
      }
      // Do not clear dimension labels here — that races the dimensions effect and
      // leaves the "on by default" toggle with nothing drawn on the map.

      if (polygon && polygon.length > 0) {
        const layer = L.polygon(polygon, {
          color: "#113a34",
          weight: 2.5,
          fillColor: "#caa064",
          fillOpacity: 0.28,
          interactive: false,
        }).addTo(map);
        polygonRef.current = layer;
        map.fitBounds(layer.getBounds(), { padding: [28, 28], maxZoom: 18 });
        if (markerRef.current) {
          map.removeLayer(markerRef.current);
          markerRef.current = null;
        }
        // Re-run dimensions after polygon settles (avoids async race wiping labels)
        window.setTimeout(() => setDimsEpoch((n) => n + 1), 0);
        return;
      }

      if (selected) {
        placeMarker(L, map, selected.lat, selected.lng, !locked);
        map.setView([selected.lat, selected.lng], Math.max(map.getZoom(), 15));
      } else if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, polygon, locked, mapReady]);

  // Draw edge length labels on the parcel outline when enabled.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    void import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;
      if (dimensionLayerRef.current) {
        map.removeLayer(dimensionLayerRef.current);
        dimensionLayerRef.current = null;
      }
      if (!drawDimensions || !showDimensions || !polygon?.[0]?.length) return;
      const rawEdges = ringEdgeDimensions(polygon[0]);
      const sum = rawEdges.reduce((s, e) => s + e.lengthM, 0);
      // Nudge edge labels to match official DLS perimeter when we're already close
      // (Cassini SHAPE.LEN vs WGS84 local plane — typically within a couple percent).
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
        L.marker([edge.label.lat, edge.label.lng], { icon, interactive: false, keyboard: false }).addTo(group);
      }
      dimensionLayerRef.current = group;
    });
  }, [drawDimensions, showDimensions, polygon, mapReady, lang, perimeterM, dimsEpoch]);

  useEffect(() => {
    const map = mapRef.current;
    const el = mapDivRef.current;
    if (!map || !el) return;

    const refresh = () => {
      map.invalidateSize({ animate: false });
      osmLayerRef.current?.redraw();
      satLayerRef.current?.redraw();
    };

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => refresh()) : null;
    ro?.observe(el);
    const t1 = window.setTimeout(refresh, 80);
    const t2 = window.setTimeout(refresh, 320);
    // After loading overlay clears, tiles often need a second size pass
    const t3 = !loading ? window.setTimeout(refresh, 160) : 0;
    return () => {
      ro?.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (t3) window.clearTimeout(t3);
    };
  }, [loading, basemap, mapReady, polygon]);

  async function search() {
    if (locked || query.trim().length < 2) return;
    setStatus("loading");
    setMessage("");
    setResults([]);
    try {
      const response = await fetch(`/api/location/search?q=${encodeURIComponent(query.trim())}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setResults(body.results);
      setStatus("idle");
    } catch {
      setStatus("error");
      setMessage(lp.searchUnavailable);
    }
  }

  function applyManual() {
    if (locked) return;
    const parsed = parseCoords(draft);
    if (!parsed) {
      setStatus("error");
      setMessage(lp.invalidCoords);
      return;
    }
    commit(parsed);
  }

  function useMyLocation() {
    if (locked) return;
    if (!navigator.geolocation) {
      setStatus("error");
      setMessage(lp.unavailable);
      return;
    }
    setStatus("locating");
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => commit({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => {
        setStatus("error");
        setMessage(lp.unavailable);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function clear() {
    if (locked) return;
    setSelected(null);
    setDraft("");
    setQuery("");
    setResults([]);
    onChange("");
    onAddressChange?.("");
    if (markerRef.current && mapRef.current) {
      mapRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    if (polygonRef.current && mapRef.current) {
      mapRef.current.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }
    if (dimensionLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(dimensionLayerRef.current);
      dimensionLayerRef.current = null;
    }
  }

  const showEmptyReadonly = readOnly && !selected && !polygon && !loading;
  if (showEmptyReadonly) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface-2/55 p-4 text-sm text-ink-soft text-center">
        {lp.noLocation}
      </div>
    );
  }

  const hint =
    loading && loadingLabel
      ? loadingLabel
      : locked
        ? statusNote || lp.lockedHint
        : status === "locating"
          ? lp.locating
          : idleNote && !selected && !polygon
            ? idleNote
            : lp.mapHint;

  const hasDimensions =
    showDimensions &&
    (areaLabel || areaSqm != null || perimeterM != null || extents);

  return (
    <section
      className="rounded-2xl border border-line bg-surface-2/55 p-3 sm:p-4"
      aria-label={locked ? lp.viewLabel : lp.pickingLabel}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {!locked && (
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
            className="min-w-0 flex-1 h-10 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-gold"
            placeholder={lp.search}
          />
          <button
            type="button"
            onClick={search}
            disabled={status === "loading"}
            className="h-10 px-4 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-60"
          >
            {lp.find}
          </button>
        </div>
      )}
      {!locked && results.length > 0 && (
        <div className="mt-2 max-h-32 overflow-auto rounded-xl border border-line bg-white divide-y divide-line">
          {results.map((result) => (
            <button
              key={`${result.latitude}:${result.longitude}`}
              type="button"
              onClick={() => {
                commit({ lat: result.latitude, lng: result.longitude }, result.address);
                setResults([]);
              }}
              className="block w-full px-3 py-2 text-start text-xs hover:bg-surface-2"
            >
              {result.address}
            </button>
          ))}
        </div>
      )}
      {!locked && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
          <input
            dir="ltr"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={applyManual}
            className="h-10 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-gold"
            placeholder={lp.coords}
          />
          <button
            type="button"
            onClick={useMyLocation}
            disabled={status === "locating"}
            className="h-10 px-3 rounded-xl border border-line text-xs font-bold disabled:opacity-60"
          >
            {lp.use}
          </button>
          <button type="button" onClick={clear} className="h-10 px-3 rounded-xl text-xs font-bold text-red-700">
            {lp.clear}
          </button>
        </div>
      )}

      <div className={`${locked ? "" : "mt-3"} flex flex-wrap items-center justify-between gap-3`}>
        <p className="text-[11px] text-ink-soft leading-snug flex-1 min-w-[12rem]">{hint}</p>
      </div>

      <div ref={mapShellRef} className="location-map-shell mt-2 flex flex-col gap-2">
        <div className="location-map-toolbar shrink-0 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-line bg-white px-2 py-2">
          <div
            className="inline-flex rounded-full border border-line bg-surface-2 p-0.5"
            role="group"
            aria-label={lp.basemapLabel}
          >
            <button
              type="button"
              onClick={() => setBasemap("map")}
              className={`h-8 px-3 rounded-full text-[11px] font-bold transition-colors ${
                basemap === "map" ? "bg-green text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {lp.basemapMap}
            </button>
            <button
              type="button"
              onClick={() => setBasemap("satellite")}
              className={`h-8 px-3 rounded-full text-[11px] font-bold transition-colors ${
                basemap === "satellite" ? "bg-green text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {lp.basemapSatellite}
            </button>
          </div>
          {Boolean(polygon?.[0]?.length) && showDimensions && (
            <button
              type="button"
              onClick={() => setDrawDimensions((v) => !v)}
              className={`h-8 px-3 rounded-full text-[11px] font-bold border transition-colors ${
                drawDimensions
                  ? "bg-green/10 border-green text-green"
                  : "border-line text-ink-soft hover:text-ink bg-surface-2"
              }`}
              aria-pressed={drawDimensions}
            >
              {lp.dimensionsOnMap}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMapFullscreen(true)}
            className="h-8 px-3 rounded-full border border-line bg-surface-2 text-[11px] font-bold text-ink-soft hover:text-ink transition-colors"
            aria-pressed={mapFullscreen}
          >
            {lp.fullscreen}
          </button>
        </div>

        <div className="relative">
          <div
            ref={mapDivRef}
            className="location-map-pane relative z-0 w-full h-64 sm:h-80 overflow-hidden rounded-xl border border-line bg-surface-2"
          />
          {loading && (
            <div className="absolute inset-0 z-30 rounded-xl bg-white/75 flex flex-col items-center justify-center gap-3 px-4 text-center">
              <Spinner className="w-7 h-7" />
              <p className="text-sm font-bold text-ink">{loadingLabel || lp.loading}</p>
            </div>
          )}
        </div>

        {hasDimensions && !loading && (
          <div className="shrink-0 rounded-xl border border-line bg-white px-3 py-2">
            <p className="text-[10px] font-bold tracking-wide mb-1 text-green">{lp.dimensionsTitle}</p>
            <ul className="space-y-0.5 text-[11px] leading-snug text-ink">
              {(areaLabel || areaSqm != null) && (
                <li>
                  <span className="text-ink-soft">{lp.dimensionsArea}: </span>
                  <b>{areaLabel || `${areaSqm!.toLocaleString("en-JO")} m²`}</b>
                </li>
              )}
              {perimeterM != null && perimeterM > 0 && (
                <li>
                  <span className="text-ink-soft">{lp.dimensionsPerimeter}: </span>
                  <b>{formatMeters(perimeterM, lang)}</b>
                </li>
              )}
              {extents && (
                <li>
                  <span className="text-ink-soft">{lp.dimensionsExtent}: </span>
                  <b>
                    {formatMeters(extents.lengthM, lang)} × {formatMeters(extents.widthM, lang)}
                  </b>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <MapFullscreenPortal
        open={mapFullscreen}
        onClose={() => setMapFullscreen(false)}
        basemap={basemap}
        onBasemapChange={setBasemap}
        drawDimensions={drawDimensions}
        onDrawDimensionsChange={setDrawDimensions}
        showDimensions={showDimensions}
        polygon={polygon}
        selected={selected}
        perimeterM={perimeterM}
        areaLabel={areaLabel}
        areaSqm={areaSqm}
        extents={extents}
        lang={lang}
        labels={{
          basemapLabel: lp.basemapLabel,
          basemapMap: lp.basemapMap,
          basemapSatellite: lp.basemapSatellite,
          dimensionsOnMap: lp.dimensionsOnMap,
          dimensionsTitle: lp.dimensionsTitle,
          dimensionsArea: lp.dimensionsArea,
          dimensionsPerimeter: lp.dimensionsPerimeter,
          dimensionsExtent: lp.dimensionsExtent,
          exitFullscreen: lp.exitFullscreen,
        }}
      />

      <p className="mt-2 text-[10px] text-ink-soft">
        {basemap === "map" ? "© OpenStreetMap" : "© Esri"} · {lp.osmNote}
      </p>
      {Boolean(polygon?.[0]?.length) && !loading && (
        <ParcelSideView
          ref={sideViewRef}
          polygon={polygon}
          title={lp.sideViewTitle}
          note={lp.sideViewNote}
          lengthLabel={lp.sideViewLength}
          widthLabel={lp.sideViewWidth}
          schematicNote={lp.sideViewSchematic}
          disclaimer={lp.sideViewDisclaimer}
          googleEarthCta={lp.sideViewGoogleEarth}
          googleMapsCta={lp.sideViewGoogleMaps}
          loadingLabel={lp.sideViewLoading}
          fullscreenLabel={lp.fullscreen}
          exitFullscreenLabel={lp.exitFullscreen}
          lang={lang}
          onReadyChange={handleReadyChange}
          blueprintMeta={{
            lang,
            brandName: lp.blueprintBrand,
            sheetTitle: lp.blueprintSheetTitle,
            topViewLabel: lp.blueprintTopView,
            sideViewLabel: lp.blueprintSideView,
            paramsLabel: lp.blueprintParams,
            elevRangeLabel: lp.blueprintElevRange,
            contourStepLabel: lp.blueprintContourStep,
            approxNote: lp.blueprintApproxNote,
            footerNote: lp.blueprintFooter,
            governorate: blueprint?.governorate,
            directorate: blueprint?.directorate,
            village: blueprint?.village,
            basin: blueprint?.basin,
            neighborhood: blueprint?.neighborhood,
            parcel: blueprint?.parcel,
            address: address || undefined,
            coordinates: value || undefined,
            areaLabel,
            areaSqm,
            perimeterM,
            notes: blueprint?.notes,
            notesLabel: lp.blueprintNotes,
            industryLabel: blueprint?.industryLabel,
            industryValue: blueprint?.industryValue,
            industryUserChoseNote: blueprint?.industryUserChoseNote ?? lp.blueprintZoningUserChose,
            labels: {
              governorate: lp.blueprintGovernorate,
              directorate: lp.blueprintDirectorate,
              village: lp.blueprintVillage,
              basin: lp.blueprintBasin,
              neighborhood: lp.blueprintNeighborhood,
              parcel: lp.blueprintParcel,
              address: lp.blueprintAddress,
              coordinates: lp.blueprintCoordinates,
              area: lp.blueprintArea,
              perimeter: lp.blueprintPerimeter,
              extent: lp.blueprintExtent,
            },
          } satisfies BlueprintMeta}
        />
      )}
      {message && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {message}
        </p>
      )}
      {(selected || polygon) && !loading && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white px-3 py-2 text-xs">
          {!locked && <b className="text-green">✓ {lp.confirm}</b>}
          {selected && (
            <span dir="ltr" className="tabular-nums">
              {coordsToString(selected)}
            </span>
          )}
          {address && (
            <span className="text-ink-soft">
              {lp.address}: {address}
            </span>
          )}
          {selected && (
            <a
              href={mapsLinkFromCoords(selected)}
              target="_blank"
              rel="noopener"
              className="font-bold text-green hover:text-gold transition-colors"
            >
              {lp.external}
            </a>
          )}
        </div>
      )}
    </section>
  );
});

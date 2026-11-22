"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { DlsMapControls, type EditTool, type SurfaceView } from "@/components/DlsMapControls";
import { useParcelMapHeaderActions } from "@/components/ParcelMapWorkspace";
import {
  coordsToString,
  formatMeters,
  formatSideMeters,
  mapsLinkFromCoords,
  parseCoords,
  ringEdgeDimensions,
  ringInteriorCentroid,
  ringOrientedExtents,
  type Coords,
} from "@/lib/mapCoords";
import { ParcelSideView, type ParcelSideViewHandle } from "@/components/ParcelSideView";
import { MapFullscreenPortal } from "@/components/MapFullscreenPortal";
import type { BlueprintMeta } from "@/lib/parcelBlueprint";
import { createParcelCanvasLayer, type ParcelCanvasOpts } from "@/lib/parcelCanvasLayer";
import {
  attachMeasureTool,
  DEFAULT_MEASURE_LINE_COLOR,
  parcelSnapTargets,
  type FixedSnapMeters,
  type MeasureMode,
  type MeasureSnapshot,
  type MeasureTool,
} from "@/lib/measureDraw";
import { MeasureToolbar } from "@/components/MeasureToolbar";
import { MeasureThreadsOverlay } from "@/components/MeasureThreadsOverlay";
import { downloadParcelCadDxf } from "@/lib/parcelCadExport";
import { localizePlaceName } from "@/lib/localizePlace";
import {
  ESRI_SAT_TILE_URL,
  MAP_MAX_ZOOM,
  MEASURE_MAX_ZOOM,
  OSM_TILE_URL,
  PARCEL_FIT_MAX_ZOOM,
  parcelFitBoundsOptions,
  osmTileOptions,
  satTileOptions,
} from "@/lib/mapTiles";
import { attachDlsLodController, DLS_LOD } from "@/lib/dlsMapLod";
import {
  fetchDlsContextByPointClient,
  fetchDlsParcelsByBboxClient,
  parcelRecordLimitForZoom,
  parcelSimplifyOffsetForZoom,
} from "@/lib/dlsClientMap";
import { viewportDedupeKey } from "@/lib/dlsMapCache";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [31.9539, 35.9106];
type SearchResult = { latitude: number; longitude: number; address: string };
/** Leaflet-ready ring: [lat, lng][]. */
export type ParcelRing = [number, number][];
export type AdjacentRoad = {
  id: string;
  name: string;
  side: "north" | "south" | "east" | "west";
  widthM: number | null;
  source: "osm-overpass" | "google-maps" | "dls-neighbor";
  path: [number, number][];
};
export type ContextParcel = {
  dlsKey: string | null;
  parcelNo: string | null;
  rings: [number, number][][];
  isSubject: boolean;
};
type Basemap = "map" | "satellite";

export type LocationInputHandle = {
  printBlueprint: () => Promise<void>;
  printBlueprintWithSnapshot: (mapSnapshot: string | null) => Promise<void>;
  captureMapSnapshot: () => Promise<string | null>;
  canPrintBlueprint: () => boolean;
};

interface Props {
  /** Legacy canonical coordinate string, retained for existing records. */
  value: string;
  onChange: (value: string) => void;
  address?: string;
  onAddressChange?: (address: string) => void;
  onPinDrop?: (coords: Coords) => void | Promise<void>;
  readOnly?: boolean;
  /** Official DLS cadastral outline — when set with lockEditing, drawn and not editable. */
  polygon?: ParcelRing[] | null;
  /** Disallow pin/search edits (e.g. while a DLS fetch is in flight). */
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
  /** Official DLS_KEY — shown in fullscreen identity next to dimensions. */
  dlsKey?: string | null;
  /** Optional per-ring parcel numbers (for multi-parcel offers). */
  parcelNumbers?: string[] | null;
  adjacentRoads?: AdjacentRoad[] | null;
  onBlueprintReadyChange?: (ready: boolean) => void;
  /** Fires when 3D topo load finishes (success or failure). */
  onTopoSettledChange?: () => void;
  /** Fires when the Leaflet map instance is ready (or torn down). */
  onMapReadyChange?: (ready: boolean) => void;
  /** When false, omit the 2D map block (offer page can place map/topo in separate columns). */
  showMap?: boolean;
  /** When false, omit the 3D topography block. */
  showTopo?: boolean;
  /**
   * Desktop only: grow the map to fill leftover column height (parent must be a flex column).
   * Mobile heights stay unchanged.
   */
  fillColumn?: boolean;
  /**
   * DLS-style full-bleed map: no card chrome, floating toolbar, fills parent.
   * Parent should be a positioned box (e.g. ParcelMapWorkspace map slot).
   */
  variant?: "default" | "workspace";
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
  onPinDrop,
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
  dlsKey = null,
  parcelNumbers = null,
  adjacentRoads = null,
  onBlueprintReadyChange,
  onTopoSettledChange,
  onMapReadyChange,
  showMap = true,
  showTopo = true,
  fillColumn = false,
  variant = "default",
}: Props,
  ref
) {
  const workspace = variant === "workspace";
  const workspaceChrome = useParcelMapHeaderActions();
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
    printBlueprintWithSnapshot: async (mapSnapshot: string | null) => {
      await sideViewRef.current?.printBlueprint({ mapSnapshot });
    },
    captureMapSnapshot: async () => captureMapForBlueprint(),
  }));

  /** Snapshot the live Leaflet map exactly as currently shown to the user. */
  async function captureMapForBlueprint(): Promise<string | null> {
    const map = mapRef.current;
    if (!map) return null;
    const ring = polygon?.[0];

    try {
      map.invalidateSize();
      await new Promise((r) => window.setTimeout(r, 180));

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
        if (showContextGridEffective) {
          for (const parcel of contextParcels) {
            if (parcel.isSubject) continue;
            for (const ctxRing of parcel.rings ?? []) {
              if (!ctxRing?.length) continue;
              ctx.beginPath();
              ctxRing.forEach(([lat, lng], i) => {
                const p = map.latLngToContainerPoint([lat, lng]);
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
              });
              ctx.closePath();
              ctx.strokeStyle = "#e31c1c";
              ctx.lineWidth = 1.6;
              ctx.stroke();
            }
          }
        }

        ctx.beginPath();
        ring.forEach(([lat, lng], i) => {
          const p = map.latLngToContainerPoint([lat, lng]);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = "rgba(227,28,28,0.12)";
        ctx.fill();
        ctx.strokeStyle = "#e31c1c";
        ctx.lineWidth = 3.75;
        ctx.stroke();

        if (parcelNumbers?.length) {
          const parcelRings = (polygon ?? [ring]).filter((r): r is ParcelRing => Boolean(r?.length));
          for (let i = 0; i < parcelRings.length; i++) {
            const parcelNo = parcelNumbers[i] || parcelNumbers[0];
            const currRing = parcelRings[i];
            if (!parcelNo || !currRing?.length) continue;
            const center = ringInteriorCentroid(currRing);
            if (!center) continue;
            const c = map.latLngToContainerPoint([center.lat, center.lng]);
            ctx.font = '800 14px system-ui, "IBM Plex Sans Arabic", sans-serif';
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.strokeText(parcelNo, c.x, c.y);
            ctx.fillStyle = "#111111";
            ctx.fillText(parcelNo, c.x, c.y);
          }
        } else {
          const parcelNo = blueprint?.parcel?.trim();
          if (parcelNo) {
            const center = ringInteriorCentroid(ring);
            if (center) {
              const c = map.latLngToContainerPoint([center.lat, center.lng]);
              ctx.font = '800 14px system-ui, "IBM Plex Sans Arabic", sans-serif';
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.lineWidth = 3.5;
              ctx.strokeStyle = "rgba(255,255,255,0.95)";
              ctx.strokeText(parcelNo, c.x, c.y);
              ctx.fillStyle = "#111111";
              ctx.fillText(parcelNo, c.x, c.y);
            }
          }
        }

        if (showContextGridEffective) {
          for (const parcel of contextParcels) {
            if (parcel.isSubject || !parcel.parcelNo) continue;
            const ctxRing = parcel.rings?.[0];
            if (!ctxRing?.length) continue;
            const center = ringInteriorCentroid(ctxRing);
            if (!center) continue;
            const c = map.latLngToContainerPoint([center.lat, center.lng]);
            ctx.font = '700 12px system-ui, "IBM Plex Sans Arabic", sans-serif';
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.strokeText(parcel.parcelNo, c.x, c.y);
            ctx.fillStyle = "#111111";
            ctx.fillText(parcel.parcelNo, c.x, c.y);
          }
        }

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
            const text = formatSideMeters(edge.lengthM * scaleLen, lang, edge.kind);
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

        // Corner markers on snapshot (DLS-style red vertices)
        for (const [lat, lng] of ring) {
          const p = map.latLngToContainerPoint([lat, lng]);
          ctx.fillStyle = "#e31c1c";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }
      }

      try {
        return canvas.toDataURL("image/jpeg", 0.9);
      } catch {
        return null;
      }
    } catch {
      return null;
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
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [surfaceView, setSurfaceView] = useState<SurfaceView>("map");
  const [drawDimensions, setDrawDimensions] = useState(true);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [measureMode, setMeasureMode] = useState<MeasureMode>("off");
  const [measureSnap, setMeasureSnap] = useState<MeasureSnapshot | null>(null);
  const [edgeSnap, setEdgeSnap] = useState(true);
  const [lineSnap, setLineSnap] = useState(true);
  const [fixedSnapM, setFixedSnapM] = useState<FixedSnapMeters>(0);
  const [lineColor, setLineColor] = useState(DEFAULT_MEASURE_LINE_COLOR);
  const [contextParcels, setContextParcels] = useState<ContextParcel[]>([]);
  const [showContextGrid, setShowContextGrid] = useState(true);
  /** Parcel grid only after DLS-close zoom — admin LOD handles farther views. */
  const [parcelGridAllowed, setParcelGridAllowed] = useState(false);
  const measureToolRef = useRef<MeasureTool | null>(null);
  const measureModeRef = useRef<MeasureMode>("off");
  measureModeRef.current = measureMode;
  const mapShellRef = useRef<HTMLDivElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const polygonRef = useRef<import("leaflet").Layer | null>(null);
  const roadsLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const dimensionLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const osmLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const satLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const lodRef = useRef<ReturnType<typeof attachDlsLodController> | null>(null);
  const showContextGridEffective = showContextGrid && parcelGridAllowed;
  const basemapRef = useRef<Basemap>(basemap);
  basemapRef.current = basemap;
  const prevSurfaceRef = useRef<SurfaceView>(surfaceView);
  const onMapReadyChangeRef = useRef(onMapReadyChange);
  onMapReadyChangeRef.current = onMapReadyChange;
  const onPinDropRef = useRef(onPinDrop);
  onPinDropRef.current = onPinDrop;

  const extents = useMemo(() => {
    if (!polygon?.[0]?.length) return null;
    return ringOrientedExtents(polygon[0]);
  }, [polygon]);

  const roads = useMemo(
    () => {
      const valid = (adjacentRoads ?? []).filter(
        (road) =>
          Array.isArray(road.path) &&
          road.path.length >= 2 &&
          road.path.every(
            (point) =>
              Array.isArray(point) &&
              point.length === 2 &&
              Number.isFinite(point[0]) &&
              Number.isFinite(point[1])
          )
      );
      // Keep one strongest street per side to avoid conflicting duplicates.
      const bestBySide = new Map<AdjacentRoad["side"], AdjacentRoad>();
      for (const road of valid) {
        const prev = bestBySide.get(road.side);
        const score = road.widthM ?? 0;
        const prevScore = prev?.widthM ?? 0;
        if (!prev || score > prevScore) bestBySide.set(road.side, road);
      }
      return Array.from(bestBySide.values());
    },
    [adjacentRoads]
  );

  const sideLabel = (side: AdjacentRoad["side"]) =>
    side === "north"
      ? lp.streetSideNorth
      : side === "south"
        ? lp.streetSideSouth
        : side === "east"
          ? lp.streetSideEast
          : lp.streetSideWest;

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
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: !locked,
        boxZoom: !locked,
        maxZoom: MAP_MAX_ZOOM,
      }).setView(start, selected ? PARCEL_FIT_MAX_ZOOM : 8);

      leafletRef.current = L;
      const osm = L.tileLayer(OSM_TILE_URL, osmTileOptions());
      const sat = L.tileLayer(ESRI_SAT_TILE_URL, satTileOptions());
      sat.addTo(map);
      osmLayerRef.current = osm;
      satLayerRef.current = sat;
      mapRef.current = map;

      clickHandler = (event) => {
        if (lockedRef.current || measureModeRef.current !== "off") return;
        const coords = { lat: event.latlng.lat, lng: event.latlng.lng };
        placeMarker(L, map, coords.lat, coords.lng, true);
        commit(coords);
        void onPinDropRef.current?.(coords);
      };
      map.on("click", clickHandler);

      lodRef.current?.destroy();
      lodRef.current = attachDlsLodController({
        L,
        map,
        lang,
        onParcelZoomChange: (show) => setParcelGridAllowed(show),
      });
      setParcelGridAllowed(map.getZoom() >= DLS_LOD.parcelsMinZoom);

      // Extra invalidate passes after layout / fonts / sibling UI settle
      requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
        window.setTimeout(() => map.invalidateSize({ animate: false }), 120);
        window.setTimeout(() => map.invalidateSize({ animate: false }), 400);
      });
      setMapReady(true);
      onMapReadyChangeRef.current?.(true);
    };

    boot().catch(() => {
      setStatus("error");
      setMessage(lp.loading);
      // Unblock parents waiting on map readiness even if boot failed.
      setMapReady(true);
      onMapReadyChangeRef.current?.(true);
    });
    return () => {
      cancelled = true;
      setMapReady(false);
      onMapReadyChangeRef.current?.(false);
      lodRef.current?.destroy();
      lodRef.current = null;
      const map = mapRef.current;
      if (map && clickHandler) map.off("click", clickHandler);
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
      polygonRef.current = null;
      roadsLayerRef.current = null;
      dimensionLayerRef.current = null;
      osmLayerRef.current = null;
      satLayerRef.current = null;
      measureToolRef.current?.destroy();
      measureToolRef.current = null;
    };
    // Leaflet must be initialized once per container; lockEditing toggles via effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snapTargets = useMemo(
    () => parcelSnapTargets(polygon as [number, number][][] | null | undefined),
    [polygon]
  );
  const measuring = measureMode !== "off";
  const dimsOnCanvas = Boolean(drawDimensions && showDimensions && !measuring);
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
    measureLineSnap: lp.measureLineSnap,
    measureFixed1m: lp.measureFixed1m,
    measureFixed5m: lp.measureFixed5m,
    measureLineColor: lp.measureLineColor,
    measureHintDistance: lp.measureHintDistance,
    measureHintArea: lp.measureHintArea,
    measureExportCad: lp.measureExportCad,
    measureExportCadHint: lp.measureExportCadHint,
    dimensionsArea: lp.dimensionsArea,
  };

  function exportArchitectureCad() {
    const rings = polygon?.filter((r) => r.length >= 2) ?? [];
    if (!rings.length) return;
    try {
      downloadParcelCadDxf({
        rings,
        ring: rings[0],
        parcelNumber: blueprint?.parcel,
        parcelNumbers: parcelNumbers ?? null,
        areaSqm,
        perimeterM,
        measure: measureSnap,
      });
    } catch {
      // ignore empty ring
    }
  }

  // Attach measure tool once the map is ready.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !mapRef.current || measureToolRef.current) return;
      measureToolRef.current = attachMeasureTool(L, mapRef.current, {
        lang,
        onChange: setMeasureSnap,
      });
      measureToolRef.current.setSnapTargets(snapTargets);
      measureToolRef.current.setEdgeSnap(edgeSnap);
      measureToolRef.current.setLineSnap(lineSnap);
      measureToolRef.current.setFixedSnapM(fixedSnapM);
      measureToolRef.current.setLineColor(lineColor);
      if (measureModeRef.current !== "off") {
        measureToolRef.current.setMode(measureModeRef.current);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, lang]);

  useEffect(() => {
    // Prefer restore when turning tools on so we don't wipe threads (mirrors fullscreen).
    if (measureMode === "off") {
      measureToolRef.current?.setMode("off");
    } else if (measureToolRef.current) {
      const cur = measureSnap;
      if (cur && (cur.threads.length > 0 || cur.points.length > 0)) {
        measureToolRef.current.restoreSnapshot({ ...cur, mode: measureMode });
      } else {
        measureToolRef.current.setMode(measureMode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureMode]);

  useEffect(() => {
    measureToolRef.current?.setSnapTargets(snapTargets);
  }, [snapTargets]);

  useEffect(() => {
    measureToolRef.current?.setEdgeSnap(edgeSnap);
  }, [edgeSnap]);

  useEffect(() => {
    measureToolRef.current?.setLineSnap(lineSnap);
  }, [lineSnap]);

  useEffect(() => {
    measureToolRef.current?.setFixedSnapM(fixedSnapM);
  }, [fixedSnapM]);

  useEffect(() => {
    measureToolRef.current?.setLineColor(lineColor);
  }, [lineColor]);

  // Whenever a parcel outline is available, default dimensions back on.
  // This avoids stale hidden-state regressions after hot reloads/navigation.
  useEffect(() => {
    if (polygon?.[0]?.length && showDimensions) {
      setDrawDimensions(true);
    }
  }, [polygon, showDimensions]);

  // Keep React chrome in sync when the tool auto-advances color / restores a thread.
  useEffect(() => {
    if (!measureSnap) return;
    if (measureSnap.lineColor && measureSnap.lineColor !== lineColor) {
      setLineColor(measureSnap.lineColor);
    }
    if (measureSnap.mode !== "off" && measureSnap.mode !== measureMode) {
      setMeasureMode(measureSnap.mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureSnap?.lineColor, measureSnap?.mode]);

  // Allow deeper overzoom only while architecture-measuring.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const nextMax = measuring ? MEASURE_MAX_ZOOM : MAP_MAX_ZOOM;
    map.setMaxZoom(nextMax);
    if (!measuring && map.getZoom() > MAP_MAX_ZOOM) {
      map.setZoom(MAP_MAX_ZOOM, { animate: false });
    }
  }, [measuring, mapReady]);

  // Keep interaction mode in sync without remounting (remounts caused intermittent blank maps).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (locked) {
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
      if (markerRef.current?.dragging) markerRef.current.dragging.disable();
    } else if (measuring) {
      // Architecture mode: keep the location pin movable; disable map dbl-zoom (used to finish).
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
      if (markerRef.current?.dragging) markerRef.current.dragging.enable();
    } else {
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
      if (markerRef.current?.dragging) markerRef.current.dragging.enable();
    }
  }, [locked, mapReady, measuring]);

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

  /** Tear down covered/stale tile layers and attach fresh ones — only reliable fix after topo. */
  const reviveMapTiles = useCallback(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    const el = map.getContainer();
    el.style.visibility = "visible";
    el.style.opacity = "1";
    el.style.pointerEvents = "";
    el.removeAttribute("aria-hidden");

    for (const ref of [osmLayerRef, satLayerRef]) {
      const layer = ref.current;
      if (!layer) continue;
      try {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      } catch {
        /* ignore */
      }
      ref.current = null;
    }

    const osm = L.tileLayer(OSM_TILE_URL, {
      ...osmTileOptions(),
      updateWhenIdle: false,
      updateWhenZooming: true,
    });
    const sat = L.tileLayer(ESRI_SAT_TILE_URL, {
      ...satTileOptions(),
      updateWhenIdle: false,
      updateWhenZooming: true,
    });
    osmLayerRef.current = osm;
    satLayerRef.current = sat;
    (basemapRef.current === "satellite" ? sat : osm).addTo(map);

    map.invalidateSize({ animate: false });
    try {
      const c = map.getCenter();
      const z = map.getZoom();
      map.setView([c.lat, c.lng], z, { animate: false });
      // Force the tile grid to request again.
      map.fire("viewreset");
      map.fire("zoomend");
      map.fire("moveend");
    } catch {
      /* ignore */
    }
  }, []);

  // Leaving topography → rebuild tiles after the overlay unmounts.
  useEffect(() => {
    const prev = prevSurfaceRef.current;
    prevSurfaceRef.current = surfaceView;
    if (!mapReady || surfaceView !== "map" || prev !== "topo") return;

    const run = () => reviveMapTiles();
    const raf = window.requestAnimationFrame(run);
    const t1 = window.setTimeout(run, 60);
    const t2 = window.setTimeout(run, 250);
    const t3 = window.setTimeout(run, 600);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [surfaceView, mapReady, reviveMapTiles]);

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
          const coords = { lat: point.lat, lng: point.lng };
          commit(coords);
          void onPinDropRef.current?.(coords);
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

  // Sync pin + DLS polygon overlay (native Leaflet path + label canvas).
  // Fit bounds only when the ring geometry actually changes — not on every render/zoom.
  const polygonKey = useMemo(() => {
    if (!polygon?.length) return "";
    return polygon
      .map((ring) => ring.map(([lat, lng]) => `${lat.toFixed(7)},${lng.toFixed(7)}`).join("|"))
      .join("||");
  }, [polygon]);

  // Viewport parcel grid — settle-only (moveend/zoomend). Paused while fullscreen
  // owns the live map so we never double-hit DLS.
  useEffect(() => {
    if (!showMap || !showContextGrid || !parcelGridAllowed || !mapReady || mapFullscreen) {
      if (!parcelGridAllowed || !showContextGrid || !showMap) setContextParcels([]);
      return;
    }
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    let abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastKey = "";

    const load = () => {
      if (cancelled) return;
      abort.abort();
      abort = new AbortController();
      const signal = abort.signal;
      const zoom = map.getZoom();
      const b = map.getBounds();
      const view = {
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      };
      const key = viewportDedupeKey(zoom, view);
      if (key === lastKey) return;

      void (async () => {
        const apply = (parcels: ContextParcel[]) => {
          if (signal.aborted || cancelled) return;
          setContextParcels(parcels);
          lastKey = key;
        };
        try {
          apply(
            await fetchDlsParcelsByBboxClient({
              ...view,
              zoom,
              maxAllowableOffset: parcelSimplifyOffsetForZoom(zoom),
              resultRecordCount: parcelRecordLimitForZoom(zoom),
              subjectDlsKey: dlsKey,
              subjectParcelNo: blueprint?.parcel ?? null,
              signal,
            })
          );
          return;
        } catch (err) {
          if (signal.aborted || cancelled) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
        // Soft fallback only when the live viewport query truly failed.
        const fallbackFromRing = polygon?.[0]?.length
          ? (() => {
              const ring = polygon[0]!;
              const sum = ring.reduce(
                (acc, p) => ({ lat: acc.lat + p[0], lng: acc.lng + p[1] }),
                { lat: 0, lng: 0 }
              );
              return { lat: sum.lat / ring.length, lng: sum.lng / ring.length };
            })()
          : null;
        const coords = selected ?? parseCoords(value) ?? fallbackFromRing;
        if (!coords) return;
        try {
          apply(
            await fetchDlsContextByPointClient({
              latitude: coords.lat,
              longitude: coords.lng,
              signal,
            })
          );
        } catch {
          /* keep previous grid — avoid hammering our server proxy */
        }
      })();
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        load();
      }, 420);
    };

    map.on("moveend", schedule);
    map.on("zoomend", schedule);
    schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      abort.abort();
      map.off("moveend", schedule);
      map.off("zoomend", schedule);
    };
  }, [
    showMap,
    showContextGrid,
    parcelGridAllowed,
    mapReady,
    mapFullscreen,
    dlsKey,
    blueprint?.parcel,
    selected,
    value,
    polygon,
  ]);

  const appliedPolygonKeyRef = useRef("");

  // Mount / replace parcel overlay. fitBounds only when the *subject* ring changes —
  // never when the neighbor grid refreshes (that used to yank the view back).
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    void import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;

      const hasSubject = Boolean(polygon && polygon.length > 0 && polygonKey);
      const hasContext = showContextGridEffective && contextParcels.length > 0;
      if (!hasSubject && !hasContext) {
        if (polygonRef.current) {
          map.removeLayer(polygonRef.current);
          polygonRef.current = null;
        }
        appliedPolygonKeyRef.current = "";
        if (selected) {
          placeMarker(L, map, selected.lat, selected.lng, !locked);
        } else if (markerRef.current) {
          map.removeLayer(markerRef.current);
          markerRef.current = null;
        }
        return;
      }

      const canRepick = !locked && measureModeRef.current === "off" && showContextGridEffective;
      const opts: ParcelCanvasOpts = {
        rings: (hasSubject ? polygon : []) as [number, number][][],
        contextParcels,
        showContextGrid: showContextGridEffective,
        showDimensions: Boolean(
          hasSubject && drawDimensions && showDimensions && measureModeRef.current === "off"
        ),
        perimeterM,
        lang,
        parcelNumber: blueprint?.parcel?.trim() || null,
        parcelNumbers: parcelNumbers && parcelNumbers.length ? parcelNumbers : null,
        parcelLabel: lp.blueprintParcel,
        contextInteractive: canRepick,
        onContextParcelClick: canRepick
          ? (coords) => {
              if (lockedRef.current || measureModeRef.current !== "off") return;
              placeMarker(L, map, coords.lat, coords.lng, true);
              commit(coords);
              void onPinDropRef.current?.(coords);
            }
          : undefined,
      };

      const geometryChanged = hasSubject && appliedPolygonKeyRef.current !== polygonKey;
      const existing = polygonRef.current as
        | (import("leaflet").Layer & { setParcelOptions?: (o: ParcelCanvasOpts) => void })
        | null;

      if (existing?.setParcelOptions) {
        existing.setParcelOptions(opts);
      } else {
        if (polygonRef.current) {
          map.removeLayer(polygonRef.current);
          polygonRef.current = null;
        }
        const layer = createParcelCanvasLayer(L, opts);
        layer.addTo(map);
        polygonRef.current = layer;
      }

      // Once the cadastral ring is on the map, never keep the drop-pin on top of it.
      if (hasSubject && markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }

      if (geometryChanged) {
        appliedPolygonKeyRef.current = polygonKey;
        try {
          const boundsLayer = polygonRef.current as unknown as {
            getBounds?: () => import("leaflet").LatLngBounds;
          };
          const bounds = boundsLayer?.getBounds?.();
          if (bounds?.isValid?.()) {
            map.fitBounds(bounds, parcelFitBoundsOptions(false));
          }
        } catch {
          /* ignore */
        }
      } else if (!hasSubject && selected) {
        placeMarker(L, map, selected.lat, selected.lng, !locked);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, polygonKey, locked, mapReady, contextParcels, showContextGridEffective]);

  // Keep dimensions / labels in sync without remounting.
  useEffect(() => {
    const layer = polygonRef.current as
      | (import("leaflet").Layer & { setParcelOptions?: (o: ParcelCanvasOpts) => void })
      | null;
    if (!layer?.setParcelOptions) return;
    const hasSubject = Boolean(polygon?.[0]?.length);
    if (!hasSubject && !(showContextGridEffective && contextParcels.length)) return;
    const canRepick = !locked && !measuring && showContextGridEffective;
    layer.setParcelOptions({
      rings: (hasSubject ? polygon : []) as [number, number][][],
      contextParcels,
      showContextGrid: showContextGridEffective,
      showDimensions: hasSubject && dimsOnCanvas,
      perimeterM,
      lang,
      parcelNumber: blueprint?.parcel?.trim() || null,
      parcelNumbers: parcelNumbers && parcelNumbers.length ? parcelNumbers : null,
      parcelLabel: lp.blueprintParcel,
      contextInteractive: canRepick,
      onContextParcelClick: canRepick
        ? (coords) => {
            if (lockedRef.current || measureModeRef.current !== "off") return;
            const map = mapRef.current;
            const L = leafletRef.current;
            if (!map || !L) return;
            placeMarker(L, map, coords.lat, coords.lng, true);
            commit(coords);
            void onPinDropRef.current?.(coords);
          }
        : undefined,
    });
  }, [dimsOnCanvas, perimeterM, lang, blueprint?.parcel, parcelNumbers, polygon, lp.blueprintParcel, contextParcels, showContextGridEffective, locked, measuring]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady) {
      lodRef.current?.refresh();
      return;
    }
    lodRef.current?.destroy();
    lodRef.current = attachDlsLodController({
      L,
      map,
      lang,
      onParcelZoomChange: (show) => setParcelGridAllowed(show),
    });
    setParcelGridAllowed(map.getZoom() >= DLS_LOD.parcelsMinZoom);
    return () => {
      // Boot effect owns final teardown; only replace instance here.
    };
  }, [lang, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    void import("leaflet").then(() => {
      const map = mapRef.current;
      if (!map) return;
      if (roadsLayerRef.current) {
        map.removeLayer(roadsLayerRef.current);
        roadsLayerRef.current = null;
      }
      // Info-only mode: keep adjacent street data in cards, do not draw road overlays.
    });
  }, [mapReady]);

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
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        commit(coords);
        const map = mapRef.current;
        if (map) {
          map.setView(
            [coords.lat, coords.lng],
            Math.max(map.getZoom(), PARCEL_FIT_MAX_ZOOM),
            { animate: true }
          );
        }
      },
      () => {
        setStatus("error");
        setMessage(lp.unavailable);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function zoomBy(delta: number) {
    const map = mapRef.current;
    if (!map) return;
    if (delta > 0) map.zoomIn();
    else map.zoomOut();
  }

  function goHomeView() {
    const map = mapRef.current;
    if (!map) return;
    try {
      const layer = polygonRef.current as unknown as { getBounds?: () => import("leaflet").LatLngBounds } | null;
      const bounds = layer?.getBounds?.();
      if (bounds?.isValid?.()) {
        map.fitBounds(bounds, parcelFitBoundsOptions(true));
        return;
      }
    } catch {
      /* ignore */
    }
    if (selected) {
      map.setView([selected.lat, selected.lng], PARCEL_FIT_MAX_ZOOM, { animate: true });
      return;
    }
    map.setView(DEFAULT_CENTER, 8, { animate: true });
  }

  function resetNorth() {
    const map = mapRef.current;
    if (!map) return;
    // Leaflet maps are always north-up; nudge a soft re-center as the compass affordance.
    const c = map.getCenter();
    map.setView(c, map.getZoom(), { animate: true });
  }

  const editTool: EditTool | null =
    measureMode === "distance" ? "lines" : measureMode === "area" ? "space" : null;

  function setEditTool(tool: EditTool | null) {
    if (tool === "lines") setMeasureMode("distance");
    else if (tool === "space") setMeasureMode("area");
    else setMeasureMode("off");
  }

  function setSurface(view: SurfaceView) {
    if (view === "topo") setMeasureMode("off");
    setSurfaceView(view);
  }

  const dlsCtrlLabels = {
    zoomIn: lp.ctrlZoomIn,
    zoomOut: lp.ctrlZoomOut,
    tools: lp.ctrlTools,
    toolsClose: lp.ctrlToolsClose,
    edit: lp.ctrlEdit,
    editLines: lp.ctrlEditLines,
    editSpace: lp.ctrlEditSpace,
    topo: lp.ctrlTopo,
    topoMap: lp.ctrlTopoMap,
    draw: lp.ctrlDraw,
    measure: lp.ctrlMeasure,
    locate: lp.ctrlLocate,
    locating: lp.locating,
    home: lp.ctrlHome,
    layers: lp.ctrlLayers,
    layersMap: lp.basemapMap,
    layersSatellite: lp.basemapSatellite,
    compass: lp.ctrlCompass,
  };

  const parcelIdentity = useMemo(
    () => ({
      governorate: blueprint?.governorate
        ? localizePlaceName(blueprint.governorate, lang)
        : null,
      directorate: blueprint?.directorate
        ? localizePlaceName(blueprint.directorate, lang)
        : null,
      basin: blueprint?.basin
        ? localizePlaceName(blueprint.basin, lang)
        : null,
      neighborhood: blueprint?.neighborhood
        ? localizePlaceName(blueprint.neighborhood, lang)
        : null,
      parcel: blueprint?.parcel?.trim() || null,
      dlsKey: dlsKey?.trim() || null,
    }),
    [
      blueprint?.governorate,
      blueprint?.directorate,
      blueprint?.basin,
      blueprint?.neighborhood,
      blueprint?.parcel,
      dlsKey,
      lang,
    ]
  );

  const fullscreenLabels = {
    basemapLabel: lp.basemapLabel,
    basemapMap: lp.basemapMap,
    basemapSatellite: lp.basemapSatellite,
    dimensionsOnMap: lp.dimensionsOnMap,
    identityTitle: lp.identityTitle,
    identityGovernorate: lp.identityGovernorate,
    identityDirectorate: lp.identityDirectorate,
    identityBasin: lp.identityBasin,
    identityNeighborhood: lp.identityNeighborhood,
    identityParcel: lp.identityParcel,
    identityDlsKey: lp.identityDlsKey,
    dimensionsTitle: lp.dimensionsTitle,
    dimensionsArea: lp.dimensionsArea,
    dimensionsPerimeter: lp.dimensionsPerimeter,
    dimensionsExtent: lp.dimensionsExtent,
    streetInfoTitle: lp.streetInfoTitle,
    streetWidthLabel: lp.streetWidthLabel,
    streetWidthUnknown: lp.streetWidthUnknown,
    streetUnnamed: lp.streetUnnamed,
    streetSideNorth: lp.streetSideNorth,
    streetSideSouth: lp.streetSideSouth,
    streetSideEast: lp.streetSideEast,
    streetSideWest: lp.streetSideWest,
    exitFullscreen: lp.exitFullscreen,
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
    measureLineSnap: lp.measureLineSnap,
    measureFixed1m: lp.measureFixed1m,
    measureFixed5m: lp.measureFixed5m,
    measureLineColor: lp.measureLineColor,
    measureHintDistance: lp.measureHintDistance,
    measureHintArea: lp.measureHintArea,
    measureExportCad: lp.measureExportCad,
    measureExportCadHint: lp.measureExportCadHint,
    useLocation: lp.use,
    locating: lp.locating,
    locationUnavailable: lp.unavailable,
    ctrlZoomIn: lp.ctrlZoomIn,
    ctrlZoomOut: lp.ctrlZoomOut,
    ctrlDraw: lp.ctrlDraw,
    ctrlMeasure: lp.ctrlMeasure,
    ctrlTools: lp.ctrlTools,
    ctrlToolsClose: lp.ctrlToolsClose,
    ctrlEdit: lp.ctrlEdit,
    ctrlEditLines: lp.ctrlEditLines,
    ctrlEditSpace: lp.ctrlEditSpace,
    ctrlTopo: lp.ctrlTopo,
    ctrlTopoMap: lp.ctrlTopoMap,
    ctrlLocate: lp.ctrlLocate,
    ctrlHome: lp.ctrlHome,
    ctrlLayers: lp.ctrlLayers,
    ctrlCompass: lp.ctrlCompass,
  };

  const dlsControls = (
    <DlsMapControls
      labels={dlsCtrlLabels}
      basemap={basemap}
      editTool={editTool}
      surfaceView={surfaceView}
      locating={status === "locating"}
      locateDisabled={locked}
      topoDisabled={!showTopo}
      onZoomIn={() => zoomBy(1)}
      onZoomOut={() => zoomBy(-1)}
      onEditToolChange={setEditTool}
      onSurfaceViewChange={setSurface}
      onLocate={useMyLocation}
      onHome={goHomeView}
      onToggleLayers={() => setBasemap((b) => (b === "satellite" ? "map" : "satellite"))}
      onCompass={resetNorth}
    />
  );

  const showTopoSurface = surfaceView === "topo" && showTopo;
  const measuringOnMap = measuring && !showTopoSurface;

  // Park fullscreen / exit-measure / back-to-map in the workspace header.
  useLayoutEffect(() => {
    if (!workspace || !workspaceChrome) return;
    workspaceChrome.setHeaderHandlers({
      onFullscreen: () => setMapFullscreen(true),
      onExitMeasure: () => {
        measureToolRef.current?.clear();
        setMeasureMode("off");
      },
      onBackToMap: () => setSurface("map"),
    });
    workspaceChrome.setHeaderChrome({
      fullscreenLabel: lp.fullscreen,
      measureExitLabel: lp.measureExit,
      showExitMeasure: measuringOnMap,
      showBackToMap: showTopoSurface,
      backToMapLabel: lp.ctrlTopoMap,
    });
  }, [
    workspace,
    workspaceChrome,
    measuringOnMap,
    showTopoSurface,
    lp.fullscreen,
    lp.measureExit,
    lp.ctrlTopoMap,
  ]);

  useLayoutEffect(() => {
    if (!workspace || !workspaceChrome) return;
    return () => workspaceChrome.setHeaderChrome(null);
  }, [workspace, workspaceChrome]);

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
    (Boolean(blueprint?.parcel?.trim()) ||
      areaLabel ||
      areaSqm != null ||
      perimeterM != null ||
      extents);

  const topoBlueprintMeta = {
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
  } satisfies BlueprintMeta;

  const topoViewPane = showTopo ? (
    <ParcelSideView
      ref={sideViewRef}
      polygon={polygon}
      title={lp.sideViewTitle}
      note={lp.sideViewNote}
      lengthLabel={lp.sideViewLength}
      widthLabel={lp.sideViewWidth}
      schematicNote={lp.sideViewSchematic}
      disclaimer={lp.sideViewDisclaimer}
      googleEarthCta={lp.sideViewGoogleEarthShort}
      googleMapsCta={lp.sideViewGoogleMapsShort}
      loadingLabel={lp.sideViewLoading}
      fullscreenLabel={lp.fullscreen}
      exitFullscreenLabel={lp.exitFullscreen}
      lang={lang}
      onReadyChange={handleReadyChange}
      onSettledChange={onTopoSettledChange}
      embedded
      fillSurface={showTopoSurface}
      adjacentRoads={roads}
      blueprintMeta={topoBlueprintMeta}
    />
  ) : null;

  if (workspace) {
    return (
      <div className="absolute inset-0 flex flex-col overflow-hidden" dir={lang === "ar" ? "rtl" : "ltr"}>
        {showMap && (
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {/* Hide map widget stack while topography owns the stage — avoids control collisions.
                Keep tools inside the map stage (below the mobile sheet stacking context). */}
            {!showTopoSurface ? (
              <div className="pointer-events-auto absolute left-1.5 top-1.5 z-20 max-h-[calc(100%-0.75rem)] overflow-y-auto overscroll-contain sm:left-3 sm:top-3">
                {dlsControls}
              </div>
            ) : null}
            {measuringOnMap && (
              <div className="absolute inset-x-2 bottom-14 z-20 sm:inset-x-3 sm:bottom-16">
                <div className="overflow-x-auto rounded-lg border border-white/20 bg-green/90 p-1.5 shadow-lg backdrop-blur-sm">
                  <MeasureToolbar
                    mode={measureMode}
                    snap={measureSnap}
                    hasParcelSnap={snapTargets.length > 0}
                    edgeSnap={edgeSnap}
                    onEdgeSnapChange={setEdgeSnap}
                    lineSnap={lineSnap}
                    onLineSnapChange={setLineSnap}
                    fixedSnapM={fixedSnapM}
                    onFixedSnapMChange={setFixedSnapM}
                    lineColor={lineColor}
                    onLineColorChange={setLineColor}
                    lang={lang}
                    variant="dark"
                    compact
                    labels={measureLabels}
                    onEnter={() => setMeasureMode("distance")}
                    onModeChange={(m) => setMeasureMode(m)}
                    onUndo={() => measureToolRef.current?.undo()}
                    onClear={() => measureToolRef.current?.clear()}
                    onFinish={() => measureToolRef.current?.finish()}
                    onNewLine={() => measureToolRef.current?.newThread()}
                    onExportCad={exportArchitectureCad}
                    canExportCad={Boolean(polygon?.[0]?.length)}
                  />
                </div>
              </div>
            )}
            {(loading || hint) && !showTopoSurface && (
              <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 sm:inset-x-3 sm:bottom-3">
                <p className="inline-flex max-w-[min(100%,24rem)] rounded-lg border border-white/15 bg-green/85 px-2.5 py-1.5 text-[10px] font-semibold leading-snug text-white/90 shadow-lg backdrop-blur-sm">
                  {loading && loadingLabel ? loadingLabel : hint}
                </p>
              </div>
            )}

            <div className="absolute inset-0 z-0 overflow-hidden">
              <div
                ref={mapDivRef}
                className="location-map-pane absolute inset-0 z-0 h-full w-full bg-[#071816]"
                style={
                  showTopoSurface
                    ? { visibility: "hidden", pointerEvents: "none" }
                    : { visibility: "visible" }
                }
              />
              {/* Topo replaces the map stage in place — edge-to-edge, no nested frames. */}
              {showTopoSurface ? (
                <div className="absolute inset-0 z-[5] overflow-hidden bg-[#071816]">
                  {Boolean(polygon?.[0]?.length) && !loading ? (
                    topoViewPane
                  ) : (
                    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 px-4 text-center">
                      <p className="max-w-xs text-[12px] font-bold leading-relaxed text-gold-2">
                        {loading
                          ? loadingLabel || lp.sideViewLoading
                          : lang === "ar"
                            ? "اختر القطعة من النموذج أو الخريطة لعرض الطبوغرافيا ثلاثية الأبعاد."
                            : "Select a parcel from the form or map to load the 3D topography."}
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
              {/* Print/blueprint target when map is showing (keeps owner print working). */}
              {showTopo && !showTopoSurface ? (
                <div className="pointer-events-none fixed -left-[120vw] top-0 z-0 h-[70vh] w-[70vw] overflow-hidden opacity-0" aria-hidden>
                  {topoViewPane}
                </div>
              ) : null}
              {measuring && !showTopoSurface && (
                <MeasureThreadsOverlay
                  snap={measureSnap}
                  lang={lang}
                  variant="dark"
                  labels={{
                    measureThreads: lp.measureThreads,
                    measureDistance: lp.measureDistance,
                    measureArea: lp.measureArea,
                    measureTotal: lp.measureTotal,
                    measureClear: lp.measureClear,
                    dimensionsArea: lp.dimensionsArea,
                  }}
                  onRemoveThread={(id) => measureToolRef.current?.removeThread(id)}
                />
              )}
              {loading && !showTopoSurface && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/35 px-4 text-center">
                  <Spinner className="h-7 w-7 border-white/25 border-t-gold" />
                  <p className="text-sm font-bold text-white">{loadingLabel || lp.loading}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <MapFullscreenPortal
          open={mapFullscreen}
          onClose={() => {
            setMapFullscreen(false);
            const snap = measureSnap;
            if (snap && measureToolRef.current) {
              window.setTimeout(() => {
                measureToolRef.current?.restoreSnapshot(snap);
              }, 0);
            }
          }}
          locked={locked}
          onPickLocation={async (coords) => {
            if (locked) return;
            commit(coords);
            await onPinDropRef.current?.(coords);
          }}
          basemap={basemap}
          onBasemapChange={setBasemap}
          drawDimensions={drawDimensions}
          onDrawDimensionsChange={setDrawDimensions}
          showDimensions={showDimensions}
          measureMode={measureMode}
          onMeasureModeChange={setMeasureMode}
          measureSnapshot={measureSnap}
          onMeasureSnapshotChange={setMeasureSnap}
          edgeSnap={edgeSnap}
          onEdgeSnapChange={setEdgeSnap}
          lineSnap={lineSnap}
          onLineSnapChange={setLineSnap}
          fixedSnapM={fixedSnapM}
          onFixedSnapMChange={setFixedSnapM}
          lineColor={lineColor}
          onLineColorChange={setLineColor}
          polygon={polygon}
          selected={selected}
          perimeterM={perimeterM}
          areaLabel={areaLabel}
          areaSqm={areaSqm}
          extents={extents}
          parcelNumber={blueprint?.parcel?.trim() || null}
          parcelNumbers={parcelNumbers}
          parcelIdentity={parcelIdentity}
          adjacentRoads={roads}
          contextParcels={contextParcels}
          showContextGrid={showContextGrid}
          onToggleContextGrid={() => setShowContextGrid((v) => !v)}
          parcelLabel={lp.blueprintParcel}
          lang={lang}
          labels={fullscreenLabels}
          surfaceView={surfaceView}
          onSurfaceViewChange={setSurface}
          showTopo={showTopo}
        />
      </div>
    );
  }

  return (
    <div
      className={fillColumn ? "space-y-4 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:gap-3 xl:space-y-0" : "space-y-4"}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {(showMap || !locked) && (
      <section
        className={`rounded-2xl border border-line bg-surface-2/55 p-3 sm:p-4 ${fillColumn ? "xl:shrink-0" : ""}`}
        aria-label={locked ? lp.viewLabel : lp.pickingLabel}
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
      </section>
      )}

      {showMap && (
      <section
        className={`location-map-section w-full rounded-2xl border-2 border-green bg-white p-3 sm:p-4 shadow-sm ${
          fillColumn ? "xl:flex xl:min-h-0 xl:flex-1 xl:flex-col" : ""
        }`}
        aria-label={lp.mapSectionTitle}
      >
        <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 ${fillColumn ? "xl:mb-2 xl:shrink-0" : ""}`}>
          <h3 className="text-sm font-bold text-green tracking-wide">{lp.mapSectionTitle}</h3>
          {blueprint?.parcel?.trim() && (
            <p className="text-xs font-bold text-ink tabular-nums">
              <span className="text-ink-soft font-medium">{lp.blueprintParcel}: </span>
              {blueprint.parcel.trim()}
            </p>
          )}
        </div>

      <div
        ref={mapShellRef}
        className={`location-map-shell flex flex-col gap-2 ${fillColumn ? "xl:min-h-0 xl:flex-1" : ""}`}
      >
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
          {Boolean(polygon?.[0]?.length) && showDimensions && !measuring && (
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
          {Boolean(polygon?.[0]?.length) && (
            <button
              type="button"
              onClick={() => setShowContextGrid((v) => !v)}
              className={`h-8 px-3 rounded-full text-[11px] font-bold border transition-colors ${
                showContextGrid
                  ? "bg-green/10 border-green text-green"
                  : "border-line text-ink-soft hover:text-ink bg-surface-2"
              }`}
              aria-pressed={showContextGrid}
            >
              {lang === "ar" ? (showContextGrid ? "إخفاء شبكة القطع" : "إظهار شبكة القطع") : showContextGrid ? "Hide Parcel Grid" : "Show Parcel Grid"}
            </button>
          )}
          {!measuring && (
            <MeasureToolbar
              mode={measureMode}
              snap={measureSnap}
              hasParcelSnap={snapTargets.length > 0}
              edgeSnap={edgeSnap}
              onEdgeSnapChange={setEdgeSnap}
              lineSnap={lineSnap}
              onLineSnapChange={setLineSnap}
              fixedSnapM={fixedSnapM}
              onFixedSnapMChange={setFixedSnapM}
              lineColor={lineColor}
              onLineColorChange={setLineColor}
              lang={lang}
              variant="light"
              labels={measureLabels}
              onEnter={() => setMeasureMode("distance")}
              onModeChange={(m) => setMeasureMode(m)}
              onUndo={() => measureToolRef.current?.undo()}
              onClear={() => measureToolRef.current?.clear()}
              onFinish={() => measureToolRef.current?.finish()}
              onNewLine={() => measureToolRef.current?.newThread()}
              onExportCad={exportArchitectureCad}
              canExportCad={Boolean(polygon?.[0]?.length)}
            />
          )}
          {measuring && (
            <button
              type="button"
              onClick={() => {
                measureToolRef.current?.clear();
                setMeasureMode("off");
              }}
              className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full border text-[12px] font-bold border-green bg-green text-white"
              aria-label={lp.measureExit}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>{lp.measureExit}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setMapFullscreen(true)}
            className="min-h-11 h-8 px-3 rounded-full border border-line bg-surface-2 text-[11px] font-bold text-ink-soft hover:text-ink transition-colors"
            aria-pressed={mapFullscreen}
          >
            {lp.fullscreen}
          </button>
        </div>

        {measuring && (
          <MeasureToolbar
            mode={measureMode}
            snap={measureSnap}
            hasParcelSnap={snapTargets.length > 0}
            edgeSnap={edgeSnap}
            onEdgeSnapChange={setEdgeSnap}
            lineSnap={lineSnap}
            onLineSnapChange={setLineSnap}
            fixedSnapM={fixedSnapM}
            onFixedSnapMChange={setFixedSnapM}
            lineColor={lineColor}
            onLineColorChange={setLineColor}
            lang={lang}
            variant="light"
            labels={measureLabels}
            onEnter={() => setMeasureMode("distance")}
            onModeChange={(m) => setMeasureMode(m)}
            onUndo={() => measureToolRef.current?.undo()}
            onClear={() => measureToolRef.current?.clear()}
            onFinish={() => measureToolRef.current?.finish()}
            onNewLine={() => measureToolRef.current?.newThread()}
            onExportCad={exportArchitectureCad}
            canExportCad={Boolean(polygon?.[0]?.length)}
          />
        )}

        <div
          className={`relative z-0 isolate overflow-hidden rounded-xl border border-line ${
            fillColumn
              ? "h-72 sm:h-[28rem] xl:h-auto xl:min-h-[14rem] xl:flex-1"
              : "h-72 sm:h-[28rem]"
          }`}
        >
          {!(surfaceView === "topo" && showTopo) ? (
            <div className="absolute left-2 top-2 z-50">{dlsControls}</div>
          ) : (
            <button
              type="button"
              onClick={() => setSurface("map")}
              className="absolute right-2 top-2 z-50 inline-flex h-9 items-center gap-1.5 rounded-md bg-gold px-3 text-[11px] font-bold text-green shadow-sm"
              aria-label={lp.ctrlTopoMap}
            >
              {lp.ctrlTopoMap}
            </button>
          )}
          <div
            ref={mapDivRef}
            className="location-map-pane absolute inset-0 z-0 h-full w-full overflow-hidden bg-[#e8eef0]"
            style={
              surfaceView === "topo" && showTopo
                ? { visibility: "hidden", pointerEvents: "none" }
                : { visibility: "visible" }
            }
          />
          {surfaceView === "topo" && showTopo ? (
            <div className="absolute inset-0 z-[5] overflow-hidden bg-[#071816]">
              {Boolean(polygon?.[0]?.length) && !loading ? (
                topoViewPane
              ) : (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 px-4 text-center">
                  <p className="max-w-xs text-[12px] font-bold leading-relaxed text-gold-2">
                    {loading
                      ? loadingLabel || lp.sideViewLoading
                      : lang === "ar"
                        ? "اختر القطعة من النموذج أو الخريطة لعرض الطبوغرافيا ثلاثية الأبعاد."
                        : "Select a parcel from the form or map to load the 3D topography."}
                  </p>
                </div>
              )}
            </div>
          ) : null}
          {measuring && surfaceView !== "topo" && (
            <MeasureThreadsOverlay
              snap={measureSnap}
              lang={lang}
              variant="light"
              labels={{
                measureThreads: lp.measureThreads,
                measureDistance: lp.measureDistance,
                measureArea: lp.measureArea,
                measureTotal: lp.measureTotal,
                measureClear: lp.measureClear,
                dimensionsArea: lp.dimensionsArea,
              }}
              onRemoveThread={(id) => measureToolRef.current?.removeThread(id)}
            />
          )}
          {loading && surfaceView !== "topo" && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-white/55 px-4 text-center">
              <Spinner className="h-7 w-7" />
              <p className="text-sm font-bold text-green">{loadingLabel || lp.loading}</p>
            </div>
          )}
          <p className="pointer-events-none absolute bottom-1.5 right-2 z-[20] rounded bg-black/55 px-2 py-0.5 text-[10px] text-white/95">
            {basemap === "map" ? "© OpenStreetMap" : "© Esri"}
          </p>
        </div>
      </div>

      <MapFullscreenPortal
        open={mapFullscreen}
        onClose={() => {
          setMapFullscreen(false);
          const snap = measureSnap;
          if (snap && measureToolRef.current) {
            window.setTimeout(() => {
              measureToolRef.current?.restoreSnapshot(snap);
            }, 0);
          }
        }}
        locked={locked}
        onPickLocation={async (coords) => {
          if (locked) return;
          commit(coords);
          await onPinDropRef.current?.(coords);
        }}
        basemap={basemap}
        onBasemapChange={setBasemap}
        drawDimensions={drawDimensions}
        onDrawDimensionsChange={setDrawDimensions}
        showDimensions={showDimensions}
        measureMode={measureMode}
        onMeasureModeChange={setMeasureMode}
        measureSnapshot={measureSnap}
        onMeasureSnapshotChange={setMeasureSnap}
        edgeSnap={edgeSnap}
        onEdgeSnapChange={setEdgeSnap}
        lineSnap={lineSnap}
        onLineSnapChange={setLineSnap}
        fixedSnapM={fixedSnapM}
        onFixedSnapMChange={setFixedSnapM}
        lineColor={lineColor}
        onLineColorChange={setLineColor}
        polygon={polygon}
        selected={selected}
        perimeterM={perimeterM}
        areaLabel={areaLabel}
        areaSqm={areaSqm}
        extents={extents}
        parcelNumber={blueprint?.parcel?.trim() || null}
        parcelNumbers={parcelNumbers}
        parcelIdentity={parcelIdentity}
        adjacentRoads={roads}
        contextParcels={contextParcels}
        showContextGrid={showContextGrid}
        onToggleContextGrid={() => setShowContextGrid((v) => !v)}
        parcelLabel={lp.blueprintParcel}
        lang={lang}
        labels={fullscreenLabels}
        surfaceView={surfaceView}
        onSurfaceViewChange={setSurface}
        showTopo={showTopo}
      />

      <p className="mt-2 text-[10px] text-ink-soft">
        {basemap === "map" ? "© OpenStreetMap" : "© Esri"} · {lp.osmNote}
        {basemap === "satellite" &&
          (lang === "ar"
            ? " · قد تظهر صورة القمر الصناعي بانزياح بصري بسيط عن حدود الكادستر الرسمية."
            : " · Satellite imagery can have slight visual offset from official cadastral boundaries.")}
      </p>
      </section>
      )}

      {showTopo && surfaceView !== "topo" && (
        <section
          className={`location-topo-section w-full rounded-2xl border-2 border-white bg-gradient-to-br from-[#0a1f1c] via-[#0f342f] to-[#0a1f1c] p-3 sm:p-4 shadow-sm ring-1 ring-black/10 ${
            fillColumn ? "xl:shrink-0" : ""
          }`}
          aria-label={lp.topoSectionTitle}
        >
          <h3 className="text-sm font-bold text-gold tracking-wide mb-1 px-1">{lp.topoSectionTitle}</h3>
          {Boolean(polygon?.[0]?.length) && !loading ? (
            topoViewPane
          ) : (
            <div className="mt-2 flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-lg border border-gold/25 bg-[#071816] px-4 py-8 text-center">
              <div className="relative h-16 w-28 opacity-70" aria-hidden>
                <span className="absolute inset-x-4 bottom-2 h-8 rounded-sm bg-gradient-to-t from-gold/35 to-gold/5" />
                <span className="absolute inset-x-6 bottom-5 h-6 rounded-sm bg-gradient-to-t from-gold/45 to-transparent" />
                <span className="absolute left-8 right-10 bottom-8 h-5 rounded-sm bg-gradient-to-t from-gold/55 to-transparent" />
              </div>
              <p className="max-w-xs text-[12px] font-bold leading-relaxed text-gold-2">
                {loading
                  ? loadingLabel || lp.sideViewLoading
                  : lang === "ar"
                    ? "اختر القطعة من النموذج أو الخريطة لعرض الطبوغرافيا ثلاثية الأبعاد."
                    : "Select a parcel from the form or map to load the 3D topography."}
              </p>
            </div>
          )}
        </section>
      )}
      {message && (
        <p role="alert" className="text-xs text-red-700 px-1">
          {message}
        </p>
      )}
      {(selected || polygon) && !loading && showMap && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-white px-3 py-2 text-xs">
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
              className="inline-flex items-center gap-1 font-bold text-green underline underline-offset-4 decoration-green/60 hover:text-gold hover:decoration-gold transition-colors"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M8 16 16 8M10 8h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              {lp.external}
            </a>
          )}
        </div>
      )}
      {roads.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2">
          <p className="text-[10px] font-bold tracking-wide text-blue-900">{lp.streetInfoTitle}</p>
          <p className="mb-1 text-[10px] text-blue-900/80">
            {lang === "ar"
              ? `تم رصد ${roads.length} شارع/شوارع محيطة وعرضها التقريبي.`
              : `Detected ${roads.length} adjacent street(s) with approximate width.`}
          </p>
          <ul className="grid gap-1 text-[11px] text-ink">
            {roads.map((road) => (
              <li key={road.id} className="flex flex-wrap items-center gap-1.5">
                <b>{road.name || lp.streetUnnamed}</b>
                {!(road.source === "dls-neighbor" && road.id.startsWith("dls-line-nearest-")) && (
                  <span className="text-ink-soft">({sideLabel(road.side)})</span>
                )}
                <span className="text-ink-soft">
                  {lp.streetWidthLabel}:{" "}
                  <b>{road.widthM != null ? `${Math.round(road.widthM * 10) / 10} ${lang === "ar" ? "م" : "m"}` : lp.streetWidthUnknown}</b>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatMeters, type Coords } from "@/lib/mapCoords";
import { createParcelCanvasLayer, type ParcelCanvasOpts } from "@/lib/parcelCanvasLayer";
import {
  attachMeasureTool,
  parcelSnapTargets,
  type FixedSnapMeters,
  type MeasureMode,
  type MeasureSnapshot,
  type MeasureTool,
} from "@/lib/measureDraw";
import { MeasureToolbar } from "@/components/MeasureToolbar";
import { MeasureThreadsOverlay } from "@/components/MeasureThreadsOverlay";
import { DlsMapControls, type EditTool, type SurfaceView } from "@/components/DlsMapControls";
import { downloadParcelCadDxf } from "@/lib/parcelCadExport";
import {
  ESRI_SAT_TILE_URL,
  MAP_MAX_ZOOM,
  MEASURE_MAX_ZOOM,
  OSM_TILE_URL,
  parcelFitBoundsOptions,
  osmTileOptions,
  satTileOptions,
} from "@/lib/mapTiles";
import { attachDlsLodController, DLS_LOD } from "@/lib/dlsMapLod";
import {
  fetchDlsParcelsByBboxClient,
  parcelRecordLimitForZoom,
  parcelSimplifyOffsetForZoom,
} from "@/lib/dlsClientMap";
import { viewportDedupeKey } from "@/lib/dlsMapCache";
import { dictionary } from "@/lib/dictionary";
import { Logo } from "@/components/Logo";
import type { AdjacentRoad, ContextParcel, ParcelRing } from "@/components/LocationInput";
import "leaflet/dist/leaflet.css";

type Basemap = "map" | "satellite";

type Extents = { lengthM: number; widthM: number } | null;

export type ParcelIdentityInfo = {
  governorate?: string | null;
  directorate?: string | null;
  basin?: string | null;
  neighborhood?: string | null;
  parcel?: string | null;
  dlsKey?: string | null;
};

type Labels = {
  basemapLabel: string;
  basemapMap: string;
  basemapSatellite: string;
  dimensionsOnMap: string;
  identityTitle: string;
  identityGovernorate: string;
  identityDirectorate: string;
  identityBasin: string;
  identityNeighborhood: string;
  identityParcel: string;
  identityDlsKey: string;
  dimensionsTitle: string;
  dimensionsArea: string;
  dimensionsPerimeter: string;
  dimensionsExtent: string;
  streetInfoTitle: string;
  streetWidthLabel: string;
  streetWidthUnknown: string;
  streetUnnamed: string;
  streetSideNorth: string;
  streetSideSouth: string;
  streetSideEast: string;
  streetSideWest: string;
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
  measureLineSnap: string;
  measureFixed1m: string;
  measureFixed5m: string;
  measureLineColor: string;
  measureHintDistance: string;
  measureHintArea: string;
  measureExportCad: string;
  measureExportCadHint: string;
  useLocation: string;
  locating: string;
  locationUnavailable: string;
  ctrlZoomIn: string;
  ctrlZoomOut: string;
  ctrlDraw: string;
  ctrlMeasure: string;
  ctrlTools: string;
  ctrlToolsClose: string;
  ctrlEdit: string;
  ctrlEditLines: string;
  ctrlEditSpace: string;
  ctrlTopo: string;
  ctrlTopoMap: string;
  ctrlLocate: string;
  ctrlHome: string;
  ctrlLayers: string;
  ctrlCompass: string;
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
  /** Shared architecture measurements — restored on open, synced while drawing. */
  measureSnapshot?: MeasureSnapshot | null;
  onMeasureSnapshotChange?: (snap: MeasureSnapshot) => void;
  edgeSnap: boolean;
  onEdgeSnapChange: (v: boolean) => void;
  lineSnap: boolean;
  onLineSnapChange: (v: boolean) => void;
  fixedSnapM: FixedSnapMeters;
  onFixedSnapMChange: (v: FixedSnapMeters) => void;
  lineColor: string;
  onLineColorChange: (hex: string) => void;
  polygon: ParcelRing[] | null | undefined;
  selected: Coords | null;
  perimeterM: number | null;
  areaLabel: string | null;
  areaSqm: number | null;
  extents: Extents;
  parcelNumber?: string | null;
  parcelNumbers?: string[] | null;
  /** Cadastral identity shown beside dimensions in the fullscreen info strip. */
  parcelIdentity?: ParcelIdentityInfo | null;
  adjacentRoads?: AdjacentRoad[] | null;
  contextParcels?: ContextParcel[] | null;
  showContextGrid?: boolean;
  onToggleContextGrid?: () => void;
  parcelLabel?: string;
  lang: "ar" | "en";
  labels: Labels;
  locked?: boolean;
  onPickLocation?: (coords: Coords) => void | Promise<void>;
  surfaceView?: SurfaceView;
  onSurfaceViewChange?: (view: SurfaceView) => void;
  showTopo?: boolean;
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
  measureMode,
  onMeasureModeChange,
  measureSnapshot = null,
  onMeasureSnapshotChange,
  edgeSnap,
  onEdgeSnapChange,
  lineSnap,
  onLineSnapChange,
  fixedSnapM,
  onFixedSnapMChange,
  lineColor,
  onLineColorChange,
  polygon,
  selected,
  perimeterM,
  areaLabel,
  areaSqm,
  extents,
  parcelNumber = null,
  parcelNumbers = null,
  parcelIdentity = null,
  adjacentRoads = null,
  contextParcels = null,
  showContextGrid = true,
  onToggleContextGrid,
  parcelLabel = "",
  lang,
  labels: lp,
  locked = false,
  onPickLocation,
  surfaceView = "map",
  onSurfaceViewChange,
  showTopo = true,
}: Props) {
  const paneRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const osmRef = useRef<import("leaflet").TileLayer | null>(null);
  const satRef = useRef<import("leaflet").TileLayer | null>(null);
  const polyRef = useRef<import("leaflet").Polygon | null>(null);
  const dimsRef = useRef<import("leaflet").LayerGroup | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const roadsLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const lodRef = useRef<ReturnType<typeof attachDlsLodController> | null>(null);
  const measureToolRef = useRef<MeasureTool | null>(null);
  const [measureSnap, setMeasureSnap] = useState<MeasureSnapshot | null>(measureSnapshot ?? null);
  const [parcelGridAllowed, setParcelGridAllowed] = useState(false);
  const [viewportParcels, setViewportParcels] = useState<ContextParcel[] | null>(null);
  const showContextGridEffective = showContextGrid && parcelGridAllowed;
  const effectiveContextParcels = viewportParcels ?? contextParcels;
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;
  const measureModeRef = useRef(measureMode);
  measureModeRef.current = measureMode;
  const measureSeedRef = useRef(measureSnapshot);
  measureSeedRef.current = measureSnapshot;

  // Portal stays mounted while closed — seed local snap when opening so the
  // threads panel has data before/while the Leaflet measure tool boots.
  useEffect(() => {
    if (!open) return;
    if (measureSnapshot) setMeasureSnap(measureSnapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const onMeasureSnapshotChangeRef = useRef(onMeasureSnapshotChange);
  onMeasureSnapshotChangeRef.current = onMeasureSnapshotChange;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "error">("idle");
  const [geoMessage, setGeoMessage] = useState("");
  const [mapReady, setMapReady] = useState(false);

  const snapTargets = useMemo(
    () => parcelSnapTargets(polygon as [number, number][][] | null | undefined),
    [polygon]
  );
  const measuring = measureMode !== "off";
  const dimsOnCanvas = Boolean(drawDimensions && showDimensions && !measuring);
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
        parcelNumber,
        parcelNumbers: parcelNumbers ?? null,
        areaSqm,
        perimeterM,
        measure: measureSnap,
      });
    } catch {
      // ignore
    }
  }

  function upsertMarker(
    L: typeof import("leaflet"),
    map: import("leaflet").Map,
    coords: Coords
  ) {
    const draggable = !lockedRef.current && measureModeRef.current === "off";
    const icon = L.divIcon({
      className: "",
      html: '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;background:#113a34;border:2px solid #caa064;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,.25)"></span>',
      iconSize: [22, 22],
      iconAnchor: [11, 22],
    });
    if (!markerRef.current) {
      markerRef.current = L.marker([coords.lat, coords.lng], { icon, draggable }).addTo(map);
      if (markerRef.current.dragging && !draggable) markerRef.current.dragging.disable();
      markerRef.current.on("dragend", () => {
        const p = markerRef.current?.getLatLng();
        if (!p) return;
        void onPickLocation?.({ lat: p.lat, lng: p.lng });
      });
    } else {
      markerRef.current.setLatLng([coords.lat, coords.lng]);
      if (markerRef.current.dragging) {
        if (draggable) markerRef.current.dragging.enable();
        else markerRef.current.dragging.disable();
      }
    }
  }

  async function useCurrentLocationInFullscreen() {
    setGeoMessage("");
    if (!navigator.geolocation) {
      setGeoStatus("error");
      setGeoMessage(lp.locationUnavailable);
      return;
    }
    setGeoStatus("locating");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 30000,
        });
      });
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      const map = mapRef.current;
      if (map) {
        const L = await import("leaflet");
        upsertMarker(L, map, coords);
        map.setView([coords.lat, coords.lng], Math.max(map.getZoom(), 16), { animate: true });
      }
      await onPickLocation?.(coords);
      setGeoStatus("idle");
    } catch {
      setGeoStatus("error");
      setGeoMessage(lp.locationUnavailable);
    }
  }

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
          // Exit architecture mode without wiping finished measurements.
          measureToolRef.current?.setMode("off");
          onMeasureModeChange("off");
          return;
        }
        onClose();
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.(".map-fs-portal-pane, .map-fs-portal-toolbar, .map-measure-overlay")) return;
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
    let clickHandler: ((event: import("leaflet").LeafletMouseEvent) => void) | null = null;

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
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: false,
        boxZoom: false,
        maxZoom: measureModeRef.current !== "off" ? MEASURE_MAX_ZOOM : MAP_MAX_ZOOM,
      }).setView(start, selected ? 16 : 8);

      const osm = L.tileLayer(OSM_TILE_URL, osmTileOptions());
      const sat = L.tileLayer(ESRI_SAT_TILE_URL, satTileOptions());
      osmRef.current = osm;
      satRef.current = sat;
      (basemapRef.current === "satellite" ? sat : osm).addTo(map);
      mapRef.current = map;

      clickHandler = (event) => {
        if (lockedRef.current || measureModeRef.current !== "off") return;
        const coords = { lat: event.latlng.lat, lng: event.latlng.lng };
        upsertMarker(L, map!, coords);
        void onPickLocation?.(coords);
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

      // Parcel outline is applied by the polygon sync effect once mapReady flips.
      if (selected && !(polygon && polygon.length > 0)) {
        upsertMarker(L, map, selected);
      }

      measureToolRef.current = attachMeasureTool(L, map, {
        lang,
        onChange: (snap) => {
          setMeasureSnap(snap);
          onMeasureSnapshotChangeRef.current?.(snap);
        },
      });
      measureToolRef.current.setSnapTargets(
        parcelSnapTargets(polygon as [number, number][][] | null | undefined)
      );
      measureToolRef.current.setEdgeSnap(edgeSnap);
      measureToolRef.current.setLineSnap(lineSnap);
      measureToolRef.current.setFixedSnapM(fixedSnapM);
      measureToolRef.current.setLineColor(lineColor);
      const seed = measureSeedRef.current;
      if (seed && (seed.threads.length > 0 || seed.points.length > 0 || seed.mode !== "off")) {
        measureToolRef.current.restoreSnapshot({
          ...seed,
          mode: seed.mode !== "off" ? seed.mode : measureModeRef.current !== "off" ? measureModeRef.current : "distance",
        });
      } else if (measureModeRef.current !== "off") {
        measureToolRef.current.setMode(measureModeRef.current);
      }

      if (!cancelled) setMapReady(true);

      requestAnimationFrame(() => {
        map?.invalidateSize({ animate: false });
        window.setTimeout(() => map?.invalidateSize({ animate: false }), 120);
        window.setTimeout(() => map?.invalidateSize({ animate: false }), 400);
      });
    };

    void boot();

    return () => {
      cancelled = true;
      setMapReady(false);
      lodRef.current?.destroy();
      lodRef.current = null;
      if (map && clickHandler) map.off("click", clickHandler);
      measureToolRef.current?.destroy();
      measureToolRef.current = null;
      map?.remove();
      mapRef.current = null;
      osmRef.current = null;
      satRef.current = null;
      polyRef.current = null;
      roadsLayerRef.current = null;
      dimsRef.current = null;
      markerRef.current = null;
    };
    // Intentionally only when open flips — parcel rings sync via mapReady + polygonKey.
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
    // Prefer restore when turning tools on so we don't wipe threads (setMode("off") used to).
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
    const map = mapRef.current;
    if (map) {
      const nextMax = measureMode !== "off" ? MEASURE_MAX_ZOOM : MAP_MAX_ZOOM;
      map.setMaxZoom(nextMax);
      if (measureMode === "off" && map.getZoom() > MAP_MAX_ZOOM) {
        map.setZoom(MAP_MAX_ZOOM, { animate: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, measureMode]);

  useEffect(() => {
    if (!open) return;
    const marker = markerRef.current;
    if (!marker?.dragging) return;
    if (!locked && measureMode === "off") marker.dragging.enable();
    else marker.dragging.disable();
  }, [open, locked, measureMode]);

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
    measureToolRef.current?.setLineSnap(lineSnap);
  }, [open, lineSnap]);

  useEffect(() => {
    if (!open) return;
    measureToolRef.current?.setFixedSnapM(fixedSnapM);
  }, [open, fixedSnapM]);

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

  // Re-pick / refetch: create or replace the parcel layer while fullscreen stays open.
  const polygonKey = useMemo(() => {
    if (!polygon?.length) return "";
    return polygon
      .map((ring) => ring.map(([lat, lng]) => `${lat.toFixed(7)},${lng.toFixed(7)}`).join("|"))
      .join("||");
  }, [polygon]);
  const appliedPolygonKeyRef = useRef("");

  useEffect(() => {
    if (!open || !mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    void import("leaflet").then((L) => {
      const liveMap = mapRef.current;
      if (!liveMap) return;

      const hasSubject = Boolean(polygon?.[0]?.length);
      const ctxList = effectiveContextParcels ?? [];
      const hasContext = showContextGridEffective && ctxList.length > 0;
      if (!hasSubject && !hasContext) {
        if (polyRef.current) {
          liveMap.removeLayer(polyRef.current);
          polyRef.current = null;
        }
        appliedPolygonKeyRef.current = "";
        measureToolRef.current?.setSnapTargets([]);
        return;
      }

      const canRepick =
        !lockedRef.current && measureModeRef.current === "off" && showContextGridEffective;
      const opts: ParcelCanvasOpts = {
        rings: (hasSubject ? polygon : []) as [number, number][][],
        contextParcels: ctxList,
        showContextGrid: showContextGridEffective,
        showDimensions: hasSubject && dimsOnCanvas,
        perimeterM,
        lang,
        parcelNumber,
        parcelNumbers,
        parcelLabel,
        contextInteractive: canRepick,
        onContextParcelClick: canRepick
          ? (coords) => {
              if (lockedRef.current || measureModeRef.current !== "off") return;
              upsertMarker(L, liveMap, coords);
              void onPickLocation?.(coords);
            }
          : undefined,
      };

      const geometryChanged = hasSubject && appliedPolygonKeyRef.current !== polygonKey;
      const existing = polyRef.current as unknown as
        | (import("leaflet").Layer & { setParcelOptions?: (o: ParcelCanvasOpts) => void })
        | null;

      if (existing?.setParcelOptions) {
        existing.setParcelOptions(opts);
      } else {
        if (polyRef.current) {
          liveMap.removeLayer(polyRef.current);
          polyRef.current = null;
        }
        const layer = createParcelCanvasLayer(L, opts);
        layer.addTo(liveMap);
        polyRef.current = layer as unknown as import("leaflet").Polygon;
      }

      measureToolRef.current?.setSnapTargets(
        parcelSnapTargets(hasSubject ? (polygon as [number, number][][] | null | undefined) : null)
      );

      // Parcel outline replaces the pin — keep it hidden while a subject ring is shown.
      if (hasSubject && markerRef.current) {
        liveMap.removeLayer(markerRef.current);
        markerRef.current = null;
      }

      if (geometryChanged) {
        appliedPolygonKeyRef.current = polygonKey;
        try {
          const boundsLayer = polyRef.current as unknown as {
            getBounds?: () => import("leaflet").LatLngBounds;
          };
          const bounds = boundsLayer?.getBounds?.();
          if (bounds) {
            liveMap.fitBounds(bounds, parcelFitBoundsOptions(true));
          }
        } catch {
          /* ignore */
        }
      } else if (!hasSubject && selected) {
        upsertMarker(L, liveMap, selected);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    mapReady,
    polygonKey,
    dimsOnCanvas,
    perimeterM,
    lang,
    parcelNumber,
    parcelNumbers,
    parcelLabel,
    effectiveContextParcels,
    showContextGridEffective,
    locked,
    measuring,
  ]);

  useEffect(() => {
    lodRef.current?.refresh();
  }, [lang, open]);

  // Fullscreen has its own map — load the parcel grid for the visible viewport.
  useEffect(() => {
    if (!open || !mapReady || !showContextGridEffective) {
      setViewportParcels(null);
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
          if (cancelled || signal.aborted) return;
          setViewportParcels(parcels);
          lastKey = key;
        };
        try {
          apply(
            await fetchDlsParcelsByBboxClient({
              ...view,
              zoom,
              maxAllowableOffset: parcelSimplifyOffsetForZoom(zoom),
              resultRecordCount: parcelRecordLimitForZoom(zoom),
              subjectDlsKey: parcelIdentity?.dlsKey ?? null,
              subjectParcelNo: parcelNumber,
              signal,
            })
          );
        } catch {
          /* keep previous — client cache/gate handles retries; avoid proxy flood */
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
    open,
    mapReady,
    showContextGridEffective,
    parcelIdentity?.dlsKey,
    parcelNumber,
  ]);

  useEffect(() => {
    if (!open) appliedPolygonKeyRef.current = "";
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void import("leaflet").then(() => {
      const map = mapRef.current;
      if (!map) return;
      if (roadsLayerRef.current) {
        map.removeLayer(roadsLayerRef.current);
        roadsLayerRef.current = null;
      }
      // Info-only mode: keep adjacent street data in cards, do not draw road overlays.
    });
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const hasInfo =
    Boolean(areaLabel || areaSqm != null || (perimeterM != null && perimeterM > 0) || extents);
  const identityRows: Array<{ label: string; value: string }> = [];
  const pushIdentity = (label: string, value?: string | null) => {
    const trimmed = (value || "").trim();
    if (trimmed) identityRows.push({ label, value: trimmed });
  };
  pushIdentity(lp.identityGovernorate, parcelIdentity?.governorate);
  pushIdentity(lp.identityDirectorate, parcelIdentity?.directorate);
  pushIdentity(lp.identityBasin, parcelIdentity?.basin);
  pushIdentity(lp.identityNeighborhood, parcelIdentity?.neighborhood);
  pushIdentity(lp.identityParcel, parcelIdentity?.parcel || parcelNumber);
  pushIdentity(lp.identityDlsKey, parcelIdentity?.dlsKey);
  const hasIdentity = identityRows.length > 0;

  return createPortal(
    <div
      className="map-fs-portal fixed inset-0 z-[10000] flex flex-col gap-1.5 bg-[#0a1f1c] p-1.5 sm:gap-2 sm:p-2 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={lp.exitFullscreen}
      style={{ paddingTop: "max(0.35rem, env(safe-area-inset-top))", paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
    >
      <div className="map-fs-portal-toolbar shrink-0 flex flex-wrap items-center justify-end gap-1 rounded-md border border-gold/35 bg-[#0f342f] px-1.5 py-1.5 sm:gap-1.5 sm:px-2">
        <div
          className="inline-flex rounded-md border border-gold/35 bg-[#0a1f1c] p-0.5"
          role="group"
          aria-label={lp.basemapLabel}
        >
          <button
            type="button"
            onClick={() => onBasemapChange("map")}
            className={`h-7 px-2.5 rounded-md text-[10px] font-bold transition-colors sm:h-8 sm:px-3 sm:text-[11px] ${
              basemap === "map" ? "bg-green text-white" : "text-gold/80 hover:text-gold"
            }`}
          >
            {lp.basemapMap}
          </button>
          <button
            type="button"
            onClick={() => onBasemapChange("satellite")}
            className={`h-7 px-2.5 rounded-md text-[10px] font-bold transition-colors sm:h-8 sm:px-3 sm:text-[11px] ${
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
            className={`h-7 px-2.5 rounded-md text-[10px] font-bold border transition-colors sm:h-8 sm:px-3 sm:text-[11px] ${
              drawDimensions
                ? "bg-gold/15 border-gold text-gold"
                : "border-gold/35 text-gold/80 hover:text-gold bg-[#0a1f1c]"
            }`}
            aria-pressed={drawDimensions}
          >
            {lp.dimensionsOnMap}
          </button>
        )}
        {Boolean(polygon?.[0]?.length) && (
          <button
            type="button"
            onClick={onToggleContextGrid}
            className={`h-7 px-2.5 rounded-md text-[10px] font-bold border transition-colors sm:h-8 sm:px-3 sm:text-[11px] ${
              showContextGrid
                ? "bg-gold/15 border-gold text-gold"
                : "border-gold/35 text-gold/80 hover:text-gold bg-[#0a1f1c]"
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
            onEdgeSnapChange={onEdgeSnapChange}
            lineSnap={lineSnap}
            onLineSnapChange={onLineSnapChange}
            fixedSnapM={fixedSnapM}
            onFixedSnapMChange={onFixedSnapMChange}
            lineColor={lineColor}
            onLineColorChange={onLineColorChange}
            lang={lang}
            variant="dark"
            compact
            labels={measureLabels}
            onEnter={() => onMeasureModeChange("distance")}
            onModeChange={(m) => onMeasureModeChange(m)}
            onUndo={() => measureToolRef.current?.undo()}
            onClear={() => measureToolRef.current?.clear()}
            onFinish={() => measureToolRef.current?.finish()}
            onNewLine={() => measureToolRef.current?.newThread()}
            onExportCad={exportArchitectureCad}
            canExportCad={Boolean(polygon?.[0]?.length)}
          />
        )}
        {!locked && (
          <button
            type="button"
            onClick={useCurrentLocationInFullscreen}
            disabled={geoStatus === "locating"}
            className="h-7 px-2.5 rounded-md border border-gold/35 bg-[#0a1f1c] text-gold text-[10px] font-bold disabled:opacity-60 sm:h-8 sm:px-3 sm:text-[11px]"
            title={lp.useLocation}
          >
            {geoStatus === "locating" ? lp.locating : lp.useLocation}
          </button>
        )}
        {measuring && (
          <button
            type="button"
            onClick={() => {
              measureToolRef.current?.clear();
              onMeasureModeChange("off");
            }}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-[10px] font-bold border-gold bg-gold text-[#0a1f1c] sm:h-8 sm:gap-1.5 sm:px-3 sm:text-[11px]"
            aria-label={lp.measureExit}
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>{lp.measureExit}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="h-7 px-2.5 rounded-md border border-gold bg-gold text-[#0a1f1c] text-[10px] font-bold sm:h-8 sm:px-3 sm:text-[11px]"
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
            lineSnap={lineSnap}
            onLineSnapChange={onLineSnapChange}
            fixedSnapM={fixedSnapM}
            onFixedSnapMChange={onFixedSnapMChange}
            lineColor={lineColor}
            onLineColorChange={onLineColorChange}
            lang={lang}
            variant="dark"
            compact
            labels={measureLabels}
            onEnter={() => onMeasureModeChange("distance")}
            onModeChange={(m) => onMeasureModeChange(m)}
            onUndo={() => measureToolRef.current?.undo()}
            onClear={() => measureToolRef.current?.clear()}
            onFinish={() => measureToolRef.current?.finish()}
            onNewLine={() => measureToolRef.current?.newThread()}
            onExportCad={exportArchitectureCad}
            canExportCad={Boolean(polygon?.[0]?.length)}
          />
        </div>
      )}
      {!measuring && geoMessage ? (
        <div className="shrink-0 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-200">
          {geoMessage}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 w-full overflow-hidden rounded-md border border-line bg-surface-2">
        <div
          ref={paneRef}
          className="map-fs-portal-pane absolute inset-0 z-0 touch-none"
        />
        <div className="absolute left-2 top-2 z-[1200] sm:left-3 sm:top-3">
          <DlsMapControls
            labels={{
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
            }}
            basemap={basemap}
            editTool={
              measureMode === "distance" ? "lines" : measureMode === "area" ? "space" : null
            }
            surfaceView={surfaceView}
            locating={geoStatus === "locating"}
            locateDisabled={locked}
            topoDisabled={!showTopo || !onSurfaceViewChange}
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onEditToolChange={(tool: EditTool | null) => {
              if (tool === "lines") onMeasureModeChange("distance");
              else if (tool === "space") onMeasureModeChange("area");
              else onMeasureModeChange("off");
            }}
            onSurfaceViewChange={(view) => {
              onSurfaceViewChange?.(view);
              if (view === "topo") onClose();
            }}
            onLocate={useCurrentLocationInFullscreen}
            onHome={() => {
              const map = mapRef.current;
              if (!map) return;
              try {
                const layer = polyRef.current as unknown as {
                  getBounds?: () => import("leaflet").LatLngBounds;
                } | null;
                const bounds = layer?.getBounds?.();
                if (bounds?.isValid?.()) {
                  map.fitBounds(bounds, parcelFitBoundsOptions(true));
                  return;
                }
              } catch {
                /* ignore */
              }
              if (selected) {
                map.setView([selected.lat, selected.lng], 16, { animate: true });
                return;
              }
              map.setView(DEFAULT_CENTER, 8, { animate: true });
            }}
            onToggleLayers={() => onBasemapChange(basemap === "satellite" ? "map" : "satellite")}
            onCompass={() => {
              const map = mapRef.current;
              if (!map) return;
              const c = map.getCenter();
              map.setView(c, map.getZoom(), { animate: true });
            }}
          />
        </div>
        <p className="pointer-events-none absolute bottom-1.5 right-2 z-[20] rounded bg-black/55 px-2 py-0.5 text-[10px] text-white/95">
          © OpenStreetMap · © Esri
        </p>
        {/* Above Leaflet panes/controls (z≤1000). Show whenever threads/draft exist. */}
        {((measureSnap?.threads.length ?? 0) > 0 ||
          (measureSnap?.points.length ?? 0) > 0 ||
          measuring) && (
          <div className="map-fs-measure-overlay-layer pointer-events-none absolute inset-0 z-[1100]">
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
          </div>
        )}
      </div>

      {(hasIdentity || hasInfo || roads.length > 0) && !measuring && (
        <div className="shrink-0 max-h-[32svh] overflow-y-auto overscroll-contain rounded-md border border-gold/35 bg-[#0f342f] px-2.5 py-2 text-gold-2 sm:max-h-none sm:px-3 sm:py-2.5">
          {(hasIdentity || hasInfo) && (
            <div
              className={
                hasIdentity && hasInfo
                  ? "grid grid-cols-2 gap-x-0"
                  : "grid grid-cols-1"
              }
            >
              {/* AR RTL: first cell = right (أبعاد). EN LTR: second cell = right. */}
              {hasInfo ? (
                <div
                  className={
                    hasIdentity && hasInfo
                      ? lang === "ar"
                        ? "min-w-0 border-e border-gold/25 pe-4"
                        : "min-w-0 order-2 border-s border-gold/25 ps-4"
                      : "min-w-0"
                  }
                >
                  <p className="mb-1 text-[10px] font-bold tracking-wide text-gold">{lp.dimensionsTitle}</p>
                  <ul className="space-y-0.5 text-[11px] leading-snug">
                    {!hasIdentity && parcelNumber ? (
                      <li>
                        <span className="text-gold/70">{parcelLabel}: </span>
                        <b>{parcelNumber}</b>
                      </li>
                    ) : null}
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
                  {/* Brand signature under أبعاد القطعة when a land is selected */}
                  <div className="mt-2 flex items-center gap-1.5 border-t border-gold/20 pt-1.5">
                    <Logo light className="h-5 w-auto shrink-0" />
                    <span className="font-brand flex min-w-0 flex-col leading-tight text-[9px] font-bold tracking-wide text-gold sm:text-[10px]">
                      <span className="truncate">{dictionary[lang].brand.line1}</span>
                      <span className="truncate opacity-85">{dictionary[lang].brand.line2}</span>
                    </span>
                  </div>
                </div>
              ) : null}
              {hasIdentity ? (
                <div
                  className={
                    hasInfo
                      ? lang === "ar"
                        ? "min-w-0 ps-4"
                        : "min-w-0 order-1 pe-4"
                      : "min-w-0"
                  }
                >
                  <p className="mb-1 text-[10px] font-bold tracking-wide text-gold">{lp.identityTitle}</p>
                  <ul className="space-y-0.5 text-[11px] leading-snug">
                    {identityRows.map((row) => (
                      <li key={`${row.label}-${row.value}`}>
                        <span className="text-gold/70">{row.label}: </span>
                        <b dir={row.label === lp.identityDlsKey ? "ltr" : undefined}>{row.value}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
          {roads.length > 0 ? (
            <div className={hasIdentity || hasInfo ? "mt-2 border-t border-gold/20 pt-2" : undefined}>
              <p className="mb-1 text-[10px] font-bold tracking-wide text-gold">{lp.streetInfoTitle}</p>
              <ul className="grid gap-1 text-[11px]">
                {roads.map((road) => (
                  <li key={road.id} className="flex flex-wrap items-center gap-1.5">
                    <b>{road.name || lp.streetUnnamed}</b>
                    {!(road.source === "dls-neighbor" && road.id.startsWith("dls-line-nearest-")) && (
                      <span className="text-gold/70">({sideLabel(road.side)})</span>
                    )}
                    <span className="text-gold/70">
                      {lp.streetWidthLabel}:{" "}
                      <b>
                        {road.widthM != null
                          ? `${Math.round(road.widthM * 10) / 10} ${lang === "ar" ? "م" : "m"}`
                          : lp.streetWidthUnknown}
                      </b>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>,
    document.body
  );
}

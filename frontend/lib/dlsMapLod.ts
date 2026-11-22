"use client";

/**
 * Progressive DLS-style map LOD (level of detail):
 *   far  → country silhouette via governorate edges
 *   mid  → land directorates / villages
 *   near → basins (optional bridge)
 *   close → parcel grid (handled separately)
 *
 * Loads are debounced and geometry is simplified so phones can keep up.
 */

export type DlsLodLevel = "country" | "governorates" | "villages" | "basins" | "parcels";

export type DlsAdminFeature = {
  id: string;
  layer: "governorates" | "directorates" | "basins";
  nameAr: string | null;
  nameEn: string | null;
  rings: [number, number][][];
};

/** Zoom thresholds aligned with DLS MapServer min/maxScale behaviour. */
export const DLS_LOD = {
  /** Below this: thick country/governorate silhouette. */
  countryMaxZoom: 7.5,
  /** Governorates visible through this zoom. */
  governoratesMaxZoom: 10.5,
  /** Directorates (lands / villages) appear. */
  villagesMinZoom: 9,
  villagesMaxZoom: 13.75,
  /** Basins bridge into the parcel grid. */
  basinsMinZoom: 12.5,
  basinsMaxZoom: 14.75,
  /** Parcel cadastral grid. */
  parcelsMinZoom: 14,
  /** Debounce after pan/zoom settles — slower = kinder to weak devices. */
  debounceMs: 550,
} as const;

export function lodLevelForZoom(zoom: number): DlsLodLevel {
  if (zoom >= DLS_LOD.parcelsMinZoom) return "parcels";
  if (zoom >= DLS_LOD.basinsMinZoom) return "basins";
  if (zoom >= DLS_LOD.villagesMinZoom) return "villages";
  if (zoom >= DLS_LOD.countryMaxZoom) return "governorates";
  return "country";
}

export function adminLayerForLod(level: DlsLodLevel): "governorates" | "directorates" | "basins" | null {
  if (level === "country" || level === "governorates") return "governorates";
  if (level === "villages") return "directorates";
  if (level === "basins") return "basins";
  return null;
}

export function maxOffsetForZoom(zoom: number): number {
  if (zoom < 7) return 0.02;
  if (zoom < 9) return 0.01;
  if (zoom < 11) return 0.004;
  if (zoom < 13) return 0.0015;
  return 0.0006;
}

export function recordLimitForLayer(layer: "governorates" | "directorates" | "basins"): number {
  if (layer === "governorates") return 30;
  if (layer === "directorates") return 70;
  return 100;
}

type LeafletMap = import("leaflet").Map;
type LeafletNS = typeof import("leaflet");

type LodController = {
  destroy: () => void;
  refresh: () => void;
};

type AttachOpts = {
  L: LeafletNS;
  map: LeafletMap;
  lang: "ar" | "en";
  /** When false, skip admin overlays entirely. */
  enabled?: boolean;
  /** Fired when LOD crosses into/out of parcel zoom. */
  onParcelZoomChange?: (showParcels: boolean) => void;
};

const STYLE = {
  country: { color: "#4a5560", weight: 2.4, fillOpacity: 0, opacity: 0.95 },
  governorates: { color: "#5c6770", weight: 1.7, fillOpacity: 0, opacity: 0.92 },
  villages: { color: "#a83800", weight: 2.1, fillOpacity: 0, opacity: 0.95 },
  basins: { color: "#828282", weight: 1.5, fillOpacity: 0, opacity: 0.9 },
} as const;

function bboxKey(bounds: import("leaflet").LatLngBounds, zoom: number, layer: string): string {
  const pad = (n: number) => n.toFixed(3);
  return `${layer}|${zoom.toFixed(1)}|${pad(bounds.getWest())},${pad(bounds.getSouth())},${pad(bounds.getEast())},${pad(bounds.getNorth())}`;
}

function centroidOfRing(ring: [number, number][]): { lat: number; lng: number } | null {
  if (!ring.length) return null;
  let lat = 0;
  let lng = 0;
  for (const [a, b] of ring) {
    lat += a;
    lng += b;
  }
  return { lat: lat / ring.length, lng: lng / ring.length };
}

/**
 * Attach progressive DLS admin boundaries to a Leaflet map.
 * Returns a controller — call destroy() on unmount.
 */
export function attachDlsLodController(opts: AttachOpts): LodController {
  const { L, map, lang } = opts;
  const enabled = opts.enabled !== false;
  const group = L.layerGroup().addTo(map);
  const labelGroup = L.layerGroup().addTo(map);

  let destroyed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let abort: AbortController | null = null;
  let lastKey = "";
  let lastParcelShow: boolean | null = null;

  function clearDrawn() {
    group.clearLayers();
    labelGroup.clearLayers();
  }

  function paint(level: DlsLodLevel, features: DlsAdminFeature[]) {
    clearDrawn();
    const style =
      level === "country"
        ? STYLE.country
        : level === "governorates"
          ? STYLE.governorates
          : level === "villages"
            ? STYLE.villages
            : STYLE.basins;

    for (const feature of features) {
      for (const ring of feature.rings) {
        if (ring.length < 3) continue;
        L.polygon(
          ring.map(([lat, lng]) => L.latLng(lat, lng)),
          {
            ...style,
            lineJoin: "round",
            lineCap: "round",
            interactive: false,
            className: `dls-lod-${level}`,
          }
        ).addTo(group);
      }

      const name = (lang === "ar" ? feature.nameAr : feature.nameEn) || feature.nameAr || feature.nameEn;
      if (!name) continue;
      const center = centroidOfRing(feature.rings[0] ?? []);
      if (!center) continue;
      const label = L.marker([center.lat, center.lng], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "dls-lod-label",
          html: `<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:rgba(10,31,28,.72);color:#fff;font:700 11px/1.2 system-ui,'IBM Plex Sans Arabic',sans-serif;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.28)">${name}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
      });
      label.addTo(labelGroup);
    }
  }

  async function load() {
    if (destroyed || !enabled) return;
    const zoom = map.getZoom();
    const level = lodLevelForZoom(zoom);
    const showParcels = zoom >= DLS_LOD.parcelsMinZoom;
    if (lastParcelShow !== showParcels) {
      lastParcelShow = showParcels;
      opts.onParcelZoomChange?.(showParcels);
    }

    const adminLayer = adminLayerForLod(level);
    if (!adminLayer) {
      clearDrawn();
      lastKey = `parcels|${zoom.toFixed(1)}`;
      return;
    }

    const bounds = map.getBounds().pad(0.08);
    const key = bboxKey(bounds, zoom, adminLayer);
    if (key === lastKey && group.getLayers().length > 0) return;

    abort?.abort();
    abort = new AbortController();
    const signal = abort.signal;

    try {
      const res = await fetch("/api/submissions/dls-admin-by-bbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          layer: adminLayer,
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
          maxAllowableOffset: maxOffsetForZoom(zoom),
          resultRecordCount: recordLimitForLayer(adminLayer),
        }),
      });
      if (!res.ok) throw new Error(`admin-${res.status}`);
      const body = (await res.json()) as { features?: DlsAdminFeature[] };
      if (signal.aborted || destroyed) return;
      const features = Array.isArray(body.features) ? body.features : [];
      paint(level, features);
      lastKey = key;
    } catch (err) {
      if (signal.aborted || destroyed) return;
      // Keep previous draw on transient failures — don't blank the map.
      if (process.env.NODE_ENV !== "production") {
        console.warn("[dls-lod]", err);
      }
    }
  }

  function schedule() {
    if (destroyed || !enabled) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void load();
    }, DLS_LOD.debounceMs);
  }

  if (enabled) {
    map.on("moveend", schedule);
    map.on("zoomend", schedule);
    // First paint after a short settle so the container has a real size.
    timer = setTimeout(() => {
      timer = null;
      void load();
    }, 200);
  }

  return {
    destroy() {
      destroyed = true;
      if (timer) clearTimeout(timer);
      abort?.abort();
      map.off("moveend", schedule);
      map.off("zoomend", schedule);
      clearDrawn();
      group.remove();
      labelGroup.remove();
    },
    refresh() {
      lastKey = "";
      schedule();
    },
  };
}

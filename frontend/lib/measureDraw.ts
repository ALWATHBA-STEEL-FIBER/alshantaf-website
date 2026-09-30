import type { Coords } from "@/lib/mapCoords";
import { formatMeters, planarMeters, ringAreaSqm, ringPerimeterMeters } from "@/lib/mapCoords";

export type MeasureMode = "off" | "distance" | "area";

export type MeasureSnapshot = {
  mode: MeasureMode;
  points: Coords[];
  /** Live total for distance, or perimeter while drawing an area. */
  lengthM: number;
  areaSqm: number | null;
  closed: boolean;
};

export type MeasureLabels = {
  distance: string;
  area: string;
  total: string;
  clear: string;
  finish: string;
  hintDistance: string;
  hintArea: string;
};

type LeafletNS = typeof import("leaflet");
type LeafletMap = import("leaflet").Map;

const VERTEX_HTML =
  '<span style="display:block;width:12px;height:12px;border-radius:50%;background:#caa064;border:2px solid #0f342f;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>';

/**
 * Interactive measure overlay (distance polyline / area polygon), styled like
 * DLS edge labels. Independent of parcel lockEditing.
 */
export function attachMeasureTool(
  L: LeafletNS,
  map: LeafletMap,
  opts: {
    lang: "ar" | "en";
    onChange: (snap: MeasureSnapshot) => void;
  }
) {
  const group = L.layerGroup().addTo(map);
  let mode: MeasureMode = "off";
  let points: Coords[] = [];
  let closed = false;
  let clickHandler: ((e: import("leaflet").LeafletMouseEvent) => void) | null = null;
  let dblHandler: ((e: import("leaflet").LeafletMouseEvent) => void) | null = null;

  function emit() {
    const lengthM =
      mode === "area" && points.length >= 2
        ? closed
          ? ringPerimeterMeters(points.map((p) => [p.lat, p.lng] as [number, number]))
          : pathLength(points)
        : pathLength(points);
    const areaSqm =
      mode === "area" && closed && points.length >= 3
        ? ringAreaSqm(points.map((p) => [p.lat, p.lng] as [number, number]))
        : null;
    opts.onChange({ mode, points: [...points], lengthM, areaSqm, closed });
  }

  function pathLength(pts: Coords[]) {
    let sum = 0;
    for (let i = 1; i < pts.length; i++) sum += planarMeters(pts[i - 1]!, pts[i]!);
    return sum;
  }

  function redraw() {
    group.clearLayers();
    if (points.length === 0) return;

    const latlngs = points.map((p) => L.latLng(p.lat, p.lng));
    if (mode === "area" && (closed || points.length >= 2)) {
      const ring = closed ? latlngs : latlngs;
      L.polygon(ring, {
        color: "#caa064",
        weight: 2,
        fillColor: "#caa064",
        fillOpacity: closed ? 0.18 : 0.08,
        dashArray: closed ? undefined : "6 4",
        interactive: false,
      }).addTo(group);
    } else if (points.length >= 2) {
      L.polyline(latlngs, {
        color: "#caa064",
        weight: 3,
        interactive: false,
      }).addTo(group);
    }

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      const mid = L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);
      const label = formatMeters(planarMeters(a, b), opts.lang);
      L.marker(mid, {
        interactive: false,
        icon: L.divIcon({
          className: "",
          html: `<span style="display:inline-block;padding:2px 6px;border-radius:999px;background:rgba(15,52,47,.92);color:#f5e6c8;font:700 10px/1.2 system-ui,sans-serif;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.35)">${label}</span>`,
          iconSize: [1, 1],
          iconAnchor: [0, 0],
        }),
      }).addTo(group);
    }

    if (mode === "area" && closed && points.length >= 3) {
      const a = points[points.length - 1]!;
      const b = points[0]!;
      const mid = L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);
      const label = formatMeters(planarMeters(a, b), opts.lang);
      L.marker(mid, {
        interactive: false,
        icon: L.divIcon({
          className: "",
          html: `<span style="display:inline-block;padding:2px 6px;border-radius:999px;background:rgba(15,52,47,.92);color:#f5e6c8;font:700 10px/1.2 system-ui,sans-serif;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.35)">${label}</span>`,
          iconSize: [1, 1],
          iconAnchor: [0, 0],
        }),
      }).addTo(group);
    }

    for (const p of points) {
      L.marker([p.lat, p.lng], {
        interactive: false,
        icon: L.divIcon({
          className: "",
          html: VERTEX_HTML,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        }),
      }).addTo(group);
    }
  }

  function unbindMap() {
    if (clickHandler) map.off("click", clickHandler);
    if (dblHandler) map.off("dblclick", dblHandler);
    clickHandler = null;
    dblHandler = null;
  }

  function bindMap() {
    unbindMap();
    clickHandler = (e) => {
      if (mode === "off" || closed) return;
      L.DomEvent.stopPropagation(e);
      const next = { lat: e.latlng.lat, lng: e.latlng.lng };
      // Close area if clicking near the first vertex (~8 m).
      if (mode === "area" && points.length >= 3) {
        const first = points[0]!;
        if (planarMeters(first, next) <= 8) {
          closed = true;
          redraw();
          emit();
          return;
        }
      }
      points.push(next);
      redraw();
      emit();
    };
    dblHandler = (e) => {
      if (mode === "off") return;
      L.DomEvent.preventDefault(e);
      L.DomEvent.stopPropagation(e);
      if (mode === "distance" && points.length >= 2) {
        // finish distance (keep open polyline)
        emit();
      } else if (mode === "area" && points.length >= 3) {
        closed = true;
        redraw();
        emit();
      }
    };
    map.on("click", clickHandler);
    map.on("dblclick", dblHandler);
  }

  return {
    setMode(next: MeasureMode) {
      mode = next;
      points = [];
      closed = false;
      group.clearLayers();
      if (mode === "off") unbindMap();
      else {
        bindMap();
        map.doubleClickZoom.disable();
      }
      if (mode === "off") map.doubleClickZoom.enable();
      emit();
    },
    finish() {
      if (mode === "area" && points.length >= 3) {
        closed = true;
        redraw();
        emit();
      } else {
        emit();
      }
    },
    clear() {
      points = [];
      closed = false;
      group.clearLayers();
      emit();
    },
    destroy() {
      unbindMap();
      group.clearLayers();
      map.removeLayer(group);
    },
  };
}

export type MeasureTool = ReturnType<typeof attachMeasureTool>;

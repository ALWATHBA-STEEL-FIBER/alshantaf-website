import type { Coords } from "@/lib/mapCoords";
import {
  formatMeters,
  fromLocalEnu,
  planarMeters,
  ringAreaSqm,
  ringPerimeterMeters,
  toLocalEnu,
} from "@/lib/mapCoords";

export type MeasureMode = "off" | "distance" | "area";

/** Preset measure line colors (architecture overlay). */
export const MEASURE_LINE_COLORS = [
  { id: "gold", hex: "#caa064", labelEn: "Gold", labelAr: "ذهبي" },
  { id: "white", hex: "#f5f5f0", labelEn: "White", labelAr: "أبيض" },
  { id: "cyan", hex: "#2ec4b6", labelEn: "Cyan", labelAr: "سماوي" },
  { id: "orange", hex: "#f4a261", labelEn: "Orange", labelAr: "برتقالي" },
  { id: "red", hex: "#e63946", labelEn: "Red", labelAr: "أحمر" },
  { id: "lime", hex: "#a8e063", labelEn: "Lime", labelAr: "ليموني" },
  { id: "blue", hex: "#4ea8de", labelEn: "Blue", labelAr: "أزرق" },
  { id: "violet", hex: "#9b5de5", labelEn: "Violet", labelAr: "بنفسجي" },
] as const;

export type MeasureLineColorId = (typeof MEASURE_LINE_COLORS)[number]["id"];

export const DEFAULT_MEASURE_LINE_COLOR: string = MEASURE_LINE_COLORS[0]!.hex;

function vertexHtml(color: string) {
  return `<span style="display:block;width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #0f342f;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`;
}

function cursorSnapHtml(color: string) {
  return `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #f5e6c8;box-shadow:0 0 0 3px rgba(15,52,47,.55),0 2px 8px rgba(0,0,0,.35);opacity:.9"></span>`;
}

export type MeasureSnapshot = {
  mode: MeasureMode;
  points: Coords[];
  /** Live total for distance, or perimeter while drawing an area. */
  lengthM: number;
  areaSqm: number | null;
  closed: boolean;
  /** True when the last placed point snapped to a parcel vertex/edge. */
  lastSnapped: boolean;
  /** Live segment length from previous point to cursor (measure mode only). */
  liveSegmentM: number | null;
};

type LeafletNS = typeof import("leaflet");
type LeafletMap = import("leaflet").Map;

const SNAP_VERTEX_HTML =
  '<span style="display:block;width:10px;height:10px;border-radius:50%;background:rgba(202,160,100,.35);border:1.5px solid #caa064;box-shadow:0 0 0 1px rgba(15,52,47,.45)"></span>';
const CURSOR_FREE_HTML =
  '<span style="display:block;width:10px;height:10px;border-radius:50%;background:rgba(245,230,200,.85);border:1.5px solid #0f342f;opacity:.85"></span>';

/** Deduped parcel vertices suitable for snap targets. */
export function parcelSnapTargets(rings: [number, number][][] | null | undefined): Coords[] {
  const out: Coords[] = [];
  const seen = new Set<string>();
  for (const ring of rings ?? []) {
    for (const pt of ring) {
      const lat = pt[0];
      const lng = pt[1];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const key = `${lat.toFixed(7)},${lng.toFixed(7)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ lat, lng });
    }
  }
  return out;
}

function parcelEdges(vertices: Coords[]): [Coords, Coords][] {
  if (vertices.length < 2) return [];
  const edges: [Coords, Coords][] = [];
  // Prefer a closed ring when points look like a parcel outline (≥3).
  const n = vertices.length;
  const closed =
    n >= 3 &&
    planarMeters(vertices[0]!, vertices[n - 1]!) > 0.05;
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % n]!;
    if (planarMeters(a, b) < 0.02) continue;
    edges.push([a, b]);
  }
  return edges;
}

/** Project a click onto the nearest point on segment AB in local ENU. */
function projectOnSegment(click: Coords, a: Coords, b: Coords): Coords {
  const origin = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  const pa = toLocalEnu(a.lat, a.lng, origin.lat, origin.lng);
  const pb = toLocalEnu(b.lat, b.lng, origin.lat, origin.lng);
  const pc = toLocalEnu(click.lat, click.lng, origin.lat, origin.lng);
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return a;
  let t = ((pc.x - pa.x) * dx + (pc.y - pa.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return fromLocalEnu(pa.x + t * dx, pa.y + t * dy, origin.lat, origin.lng);
}

export type SnapResult = {
  point: Coords;
  kind: "vertex" | "edge" | "none";
};

/**
 * Snap to parcel vertices first, then optionally edges. Radius is metres on the ground.
 */
export function snapMeasureClick(
  click: Coords,
  targets: Coords[],
  maxMeters: number,
  opts?: { edgeSnap?: boolean }
): SnapResult {
  if (!targets.length || maxMeters <= 0) return { point: click, kind: "none" };
  const edgeSnap = opts?.edgeSnap !== false;

  let bestV: Coords | null = null;
  let bestVd = maxMeters;
  for (const v of targets) {
    const d = planarMeters(click, v);
    if (d <= bestVd) {
      bestVd = d;
      bestV = v;
    }
  }
  // Prefer exact vertices within ~85% of snap radius.
  if (bestV && bestVd <= maxMeters * 0.85) {
    return { point: { lat: bestV.lat, lng: bestV.lng }, kind: "vertex" };
  }

  if (edgeSnap) {
    let bestE: Coords | null = null;
    let bestEd = maxMeters;
    for (const [a, b] of parcelEdges(targets)) {
      const p = projectOnSegment(click, a, b);
      const d = planarMeters(click, p);
      if (d < bestEd) {
        bestEd = d;
        bestE = p;
      }
    }
    if (bestE && bestEd <= maxMeters) {
      return { point: bestE, kind: "edge" };
    }
  }

  if (bestV && bestVd <= maxMeters) {
    return { point: { lat: bestV.lat, lng: bestV.lng }, kind: "vertex" };
  }
  return { point: click, kind: "none" };
}

/** Path length with a shared ENU origin for consistent cadastral accuracy. */
function pathLengthShared(pts: Coords[]): number {
  if (pts.length < 2) return 0;
  const origin = {
    lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
    lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
  };
  let sum = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = toLocalEnu(pts[i - 1]!.lat, pts[i - 1]!.lng, origin.lat, origin.lng);
    const b = toLocalEnu(pts[i]!.lat, pts[i]!.lng, origin.lat, origin.lng);
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

function snapRadiusMeters(L: LeafletNS, map: LeafletMap): number {
  const center = map.getCenter();
  const p1 = map.latLngToContainerPoint(center);
  // ~28 CSS px — comfortable finger target on mobile, tight enough on desktop.
  const p2 = L.point(p1.x + 28, p1.y);
  const ll2 = map.containerPointToLatLng(p2);
  const r = planarMeters(
    { lat: center.lat, lng: center.lng },
    { lat: ll2.lat, lng: ll2.lng }
  );
  return Math.max(1.2, Math.min(r, 35));
}

/**
 * Interactive architecture measure overlay (distance / area) with snap-to-parcel
 * vertices & edges. Independent of parcel lockEditing.
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
  const snapGroup = L.layerGroup().addTo(map);
  const cursorGroup = L.layerGroup().addTo(map);
  let mode: MeasureMode = "off";
  let points: Coords[] = [];
  let closed = false;
  let lastSnapped = false;
  let liveSegmentM: number | null = null;
  let snapTargets: Coords[] = [];
  let edgeSnap = true;
  let lineColor: string = DEFAULT_MEASURE_LINE_COLOR;
  let pendingClickTimer: number | null = null;
  let pendingClickCoords: Coords | null = null;
  let clickHandler: ((e: import("leaflet").LeafletMouseEvent) => void) | null = null;
  let moveHandler: ((e: import("leaflet").LeafletMouseEvent) => void) | null = null;
  let dblHandler: ((e: import("leaflet").LeafletMouseEvent) => void) | null = null;
  let prevDoubleClickZoom = true;

  function emit() {
    const lengthM =
      mode === "area" && points.length >= 2
        ? closed
          ? ringPerimeterMeters(points.map((p) => [p.lat, p.lng] as [number, number]))
          : pathLengthShared(points)
        : pathLengthShared(points);
    const areaSqm =
      mode === "area" && closed && points.length >= 3
        ? ringAreaSqm(points.map((p) => [p.lat, p.lng] as [number, number]))
        : null;
    opts.onChange({
      mode,
      points: [...points],
      lengthM,
      areaSqm,
      closed,
      lastSnapped,
      liveSegmentM,
    });
  }

  function drawSnapTargets() {
    snapGroup.clearLayers();
    if (mode === "off" || snapTargets.length === 0) return;
    for (const p of snapTargets) {
      L.marker([p.lat, p.lng], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "",
          html: SNAP_VERTEX_HTML,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        }),
      }).addTo(snapGroup);
    }
  }

  function redrawMeasure() {
    group.clearLayers();
    if (points.length === 0) return;

    const latlngs = points.map((p) => L.latLng(p.lat, p.lng));
    if (mode === "area" && (closed || points.length >= 2)) {
      L.polygon(latlngs, {
        color: lineColor,
        weight: 2.5,
        fillColor: lineColor,
        fillOpacity: closed ? 0.2 : 0.1,
        dashArray: closed ? undefined : "6 4",
        interactive: false,
      }).addTo(group);
    } else if (points.length >= 2) {
      L.polyline(latlngs, {
        color: lineColor,
        weight: 3,
        interactive: false,
      }).addTo(group);
    }

    const labelPairs: [Coords, Coords][] = [];
    for (let i = 1; i < points.length; i++) {
      labelPairs.push([points[i - 1]!, points[i]!]);
    }
    if (mode === "area" && closed && points.length >= 3) {
      labelPairs.push([points[points.length - 1]!, points[0]!]);
    }

    const origin =
      points.length > 0
        ? {
            lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
            lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
          }
        : null;

    for (const [a, b] of labelPairs) {
      const mid = L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);
      const dist =
        origin != null
          ? (() => {
              const pa = toLocalEnu(a.lat, a.lng, origin.lat, origin.lng);
              const pb = toLocalEnu(b.lat, b.lng, origin.lat, origin.lng);
              return Math.hypot(pb.x - pa.x, pb.y - pa.y);
            })()
          : planarMeters(a, b);
      const label = formatMeters(dist, opts.lang);
      L.marker(mid, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "",
          html: `<span style="display:inline-block;padding:2px 7px;border-radius:999px;background:rgba(15,52,47,.94);color:${lineColor};font:700 11px/1.2 system-ui,sans-serif;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.35);letter-spacing:.01em">${label}</span>`,
          iconSize: [1, 1],
          iconAnchor: [0, 0],
        }),
      }).addTo(group);
    }

    for (const p of points) {
      L.marker([p.lat, p.lng], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "",
          html: vertexHtml(lineColor),
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        }),
      }).addTo(group);
    }
  }

  function resolveClick(raw: Coords): SnapResult {
    const radius = snapRadiusMeters(L, map);
    return snapMeasureClick(raw, snapTargets, radius, { edgeSnap });
  }

  function placePoint(raw: Coords) {
    if (mode === "off" || closed) return;
    const snapped = resolveClick(raw);
    // Close area when tapping near the first vertex.
    if (mode === "area" && points.length >= 3) {
      const first = points[0]!;
      if (planarMeters(first, snapped.point) <= Math.max(1.5, snapRadiusMeters(L, map) * 0.65)) {
        closed = true;
        lastSnapped = true;
        liveSegmentM = null;
        cursorGroup.clearLayers();
        redrawMeasure();
        emit();
        return;
      }
    }
    points.push(snapped.point);
    lastSnapped = snapped.kind !== "none";
    liveSegmentM = null;
    redrawMeasure();
    emit();
  }

  function unbindMap() {
    if (pendingClickTimer != null) {
      window.clearTimeout(pendingClickTimer);
      pendingClickTimer = null;
      pendingClickCoords = null;
    }
    if (clickHandler) map.off("click", clickHandler);
    if (moveHandler) map.off("mousemove", moveHandler);
    if (dblHandler) map.off("dblclick", dblHandler);
    clickHandler = null;
    moveHandler = null;
    dblHandler = null;
    cursorGroup.clearLayers();
  }

  function finishLine() {
    if (mode === "off" || closed) return;
    if (mode === "distance" && points.length >= 2) {
      closed = true;
      liveSegmentM = null;
      cursorGroup.clearLayers();
      redrawMeasure();
      emit();
      return;
    }
    if (mode === "area" && points.length >= 3) {
      closed = true;
      liveSegmentM = null;
      cursorGroup.clearLayers();
      redrawMeasure();
      emit();
    }
  }

  function bindMap() {
    unbindMap();
    clickHandler = (e) => {
      if (mode === "off" || closed) return;
      L.DomEvent.stopPropagation(e.originalEvent);
      const coords = { lat: e.latlng.lat, lng: e.latlng.lng };
      // Delay placement so a double-click can cancel the second tap and finish the line.
      if (pendingClickTimer != null) window.clearTimeout(pendingClickTimer);
      pendingClickCoords = coords;
      pendingClickTimer = window.setTimeout(() => {
        pendingClickTimer = null;
        const next = pendingClickCoords;
        pendingClickCoords = null;
        if (next) placePoint(next);
      }, 280);
    };
    moveHandler = (e) => {
      if (mode === "off" || closed) {
        cursorGroup.clearLayers();
        liveSegmentM = null;
        return;
      }
      const snapped = resolveClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      cursorGroup.clearLayers();
      L.marker([snapped.point.lat, snapped.point.lng], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "",
          html: snapped.kind === "none" ? CURSOR_FREE_HTML : cursorSnapHtml(lineColor),
          iconSize: snapped.kind === "none" ? [10, 10] : [16, 16],
          iconAnchor: snapped.kind === "none" ? [5, 5] : [8, 8],
        }),
      }).addTo(cursorGroup);

      if (points.length >= 1) {
        const last = points[points.length - 1]!;
        liveSegmentM = planarMeters(last, snapped.point);
        L.polyline(
          [
            [last.lat, last.lng],
            [snapped.point.lat, snapped.point.lng],
          ],
          {
            color: lineColor,
            weight: 2,
            dashArray: "4 5",
            opacity: 0.85,
            interactive: false,
          }
        ).addTo(cursorGroup);
        if (liveSegmentM > 0.05) {
          const mid = L.latLng(
            (last.lat + snapped.point.lat) / 2,
            (last.lng + snapped.point.lng) / 2
          );
          L.marker(mid, {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
              className: "",
              html: `<span style="display:inline-block;padding:2px 6px;border-radius:999px;background:rgba(15,52,47,.88);color:${lineColor};font:700 10px/1.2 system-ui,sans-serif;white-space:nowrap;opacity:.95">${formatMeters(liveSegmentM, opts.lang)}</span>`,
              iconSize: [1, 1],
              iconAnchor: [0, 0],
            }),
          }).addTo(cursorGroup);
        }
      } else {
        liveSegmentM = null;
      }
      emit();
    };
    dblHandler = (e) => {
      if (mode === "off") return;
      L.DomEvent.preventDefault(e.originalEvent);
      L.DomEvent.stopPropagation(e.originalEvent);
      if (pendingClickTimer != null) {
        window.clearTimeout(pendingClickTimer);
        pendingClickTimer = null;
        pendingClickCoords = null;
      }
      finishLine();
    };
    map.on("click", clickHandler);
    map.on("mousemove", moveHandler);
    map.on("dblclick", dblHandler);
  }

  return {
    setMode(next: MeasureMode) {
      mode = next;
      points = [];
      closed = false;
      lastSnapped = false;
      liveSegmentM = null;
      group.clearLayers();
      cursorGroup.clearLayers();
      if (mode === "off") {
        unbindMap();
        if (prevDoubleClickZoom) map.doubleClickZoom.enable();
        map.getContainer().style.cursor = "";
        snapGroup.clearLayers();
      } else {
        prevDoubleClickZoom = map.doubleClickZoom.enabled();
        bindMap();
        map.doubleClickZoom.disable();
        map.getContainer().style.cursor = "crosshair";
        drawSnapTargets();
      }
      emit();
    },
    setSnapTargets(targets: Coords[]) {
      snapTargets = targets.map((t) => ({ lat: t.lat, lng: t.lng }));
      drawSnapTargets();
    },
    setEdgeSnap(enabled: boolean) {
      edgeSnap = Boolean(enabled);
    },
    setLineColor(hex: string) {
      const next = String(hex || "").trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(next)) return;
      lineColor = next;
      redrawMeasure();
    },
    finish() {
      finishLine();
    },
    undo() {
      if (closed) {
        closed = false;
      } else if (points.length > 0) {
        points.pop();
      }
      lastSnapped = false;
      liveSegmentM = null;
      cursorGroup.clearLayers();
      redrawMeasure();
      emit();
    },
    clear() {
      points = [];
      closed = false;
      lastSnapped = false;
      liveSegmentM = null;
      group.clearLayers();
      cursorGroup.clearLayers();
      emit();
    },
    destroy() {
      unbindMap();
      group.clearLayers();
      snapGroup.clearLayers();
      cursorGroup.clearLayers();
      map.removeLayer(group);
      map.removeLayer(snapGroup);
      map.removeLayer(cursorGroup);
      map.getContainer().style.cursor = "";
      if (prevDoubleClickZoom) map.doubleClickZoom.enable();
    },
  };
}

export type MeasureTool = ReturnType<typeof attachMeasureTool>;

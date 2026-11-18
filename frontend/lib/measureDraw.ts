import type { Coords } from "@/lib/mapCoords";
import {
  formatDlsArea,
  formatMeters,
  fromLocalEnu,
  planarMeters,
  ringAreaSqm,
  ringPerimeterMeters,
  toLocalEnu,
} from "@/lib/mapCoords";

export type MeasureMode = "off" | "distance" | "area";
export type MeasureKind = "distance" | "area";

/** Preset measure line colors (architecture overlay). */
export const MEASURE_LINE_COLORS = [
  { id: "gold", hex: "#caa064", labelEn: "Gold", labelAr: "ذهبي" },
  { id: "white", hex: "#f5f5f0", labelEn: "White", labelAr: "أبيض" },
  { id: "cyan", hex: "#2ec4b6", labelEn: "Cyan", labelAr: "سماوي" },
  { id: "orange", hex: "#f4a261", labelEn: "Orange", labelAr: "برتقالي" },
] as const;

export type MeasureLineColorId = (typeof MEASURE_LINE_COLORS)[number]["id"];

export const DEFAULT_MEASURE_LINE_COLOR: string = MEASURE_LINE_COLORS[0]!.hex;

export type MeasureThread = {
  id: string;
  kind: MeasureKind;
  points: Coords[];
  color: string;
  lengthM: number;
  areaSqm: number | null;
};

export type MeasureSnapshot = {
  mode: MeasureMode;
  /** Finished measurements kept on the map (distance + area can coexist). */
  threads: MeasureThread[];
  /** Active draft being drawn. */
  points: Coords[];
  /** Live total for the active draft. */
  lengthM: number;
  areaSqm: number | null;
  closed: boolean;
  lastSnapped: boolean;
  liveSegmentM: number | null;
  lineColor: string;
};

type LeafletNS = typeof import("leaflet");
type LeafletMap = import("leaflet").Map;

const SNAP_VERTEX_HTML =
  '<span style="display:block;width:10px;height:10px;border-radius:50%;background:rgba(202,160,100,.35);border:1.5px solid #caa064;box-shadow:0 0 0 1px rgba(15,52,47,.45)"></span>';
const CURSOR_FREE_HTML =
  '<span style="display:block;width:10px;height:10px;border-radius:50%;background:rgba(245,230,200,.85);border:1.5px solid #0f342f;opacity:.85"></span>';

function vertexHtml(color: string) {
  return `<span style="display:block;width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #0f342f;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`;
}

function cursorSnapHtml(color: string) {
  return `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #f5e6c8;box-shadow:0 0 0 3px rgba(15,52,47,.55),0 2px 8px rgba(0,0,0,.35);opacity:.9"></span>`;
}

function nextThreadId() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function nextColorAfter(hex: string): string {
  const i = MEASURE_LINE_COLORS.findIndex((c) => c.hex.toLowerCase() === hex.toLowerCase());
  if (i < 0) return MEASURE_LINE_COLORS[1]?.hex ?? DEFAULT_MEASURE_LINE_COLOR;
  return MEASURE_LINE_COLORS[(i + 1) % MEASURE_LINE_COLORS.length]!.hex;
}

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
  const n = vertices.length;
  const closed =
    n >= 3 && planarMeters(vertices[0]!, vertices[n - 1]!) > 0.05;
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % n]!;
    if (planarMeters(a, b) < 0.02) continue;
    edges.push([a, b]);
  }
  return edges;
}

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
  kind: "vertex" | "edge" | "line" | "fixed" | "none";
};

export type FixedSnapMeters = 0 | 1 | 5;

/** Place a point at `meters` from `from` toward `toward` (local ENU). */
export function pointAtDistance(from: Coords, toward: Coords, meters: number): Coords {
  const origin = from;
  const a = toLocalEnu(from.lat, from.lng, origin.lat, origin.lng);
  const b = toLocalEnu(toward.lat, toward.lng, origin.lat, origin.lng);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) {
    // No direction — nudge north.
    return fromLocalEnu(0, meters, origin.lat, origin.lng);
  }
  const s = meters / len;
  return fromLocalEnu(a.x + dx * s, a.y + dy * s, origin.lat, origin.lng);
}

/** Open polyline edges (no auto-close). Area rings close last→first when needed. */
function measureLineEdges(vertices: Coords[], closed: boolean): [Coords, Coords][] {
  if (vertices.length < 2) return [];
  const edges: [Coords, Coords][] = [];
  const n = vertices.length;
  const last = n - 1;
  for (let i = 0; i < last; i++) {
    const a = vertices[i]!;
    const b = vertices[i + 1]!;
    if (planarMeters(a, b) < 0.02) continue;
    edges.push([a, b]);
  }
  if (closed && n >= 3) {
    const a = vertices[last]!;
    const b = vertices[0]!;
    if (planarMeters(a, b) >= 0.05) edges.push([a, b]);
  }
  return edges;
}

/**
 * Snap to vertices first, then edges. `edgeSnap` enables edge projection on parcel `targets`.
 * Finished / draft measure polylines snap when `linePolylines` is provided.
 */
export function snapMeasureClick(
  click: Coords,
  targets: Coords[],
  maxMeters: number,
  opts?: {
    edgeSnap?: boolean;
    linePolylines?: { points: Coords[]; closed?: boolean }[];
    lineEdgeSnap?: boolean;
  }
): SnapResult {
  const edgeSnap = opts?.edgeSnap !== false;
  const linePolylines = opts?.linePolylines ?? [];
  const lineEdgeSnap = opts?.lineEdgeSnap !== false;

  let bestV: Coords | null = null;
  let bestVd = maxMeters;
  let bestKind: "vertex" | "line" = "vertex";

  for (const v of targets) {
    const d = planarMeters(click, v);
    if (d <= bestVd) {
      bestVd = d;
      bestV = v;
      bestKind = "vertex";
    }
  }
  for (const poly of linePolylines) {
    for (const v of poly.points) {
      const d = planarMeters(click, v);
      if (d <= bestVd) {
        bestVd = d;
        bestV = v;
        bestKind = "line";
      }
    }
  }

  if (bestV && bestVd <= maxMeters * 0.85) {
    return { point: { lat: bestV.lat, lng: bestV.lng }, kind: bestKind };
  }

  let bestE: Coords | null = null;
  let bestEd = maxMeters;
  let bestEKind: "edge" | "line" = "edge";

  if (edgeSnap && targets.length >= 2) {
    for (const [a, b] of parcelEdges(targets)) {
      const p = projectOnSegment(click, a, b);
      const d = planarMeters(click, p);
      if (d < bestEd) {
        bestEd = d;
        bestE = p;
        bestEKind = "edge";
      }
    }
  }
  if (lineEdgeSnap) {
    for (const poly of linePolylines) {
      for (const [a, b] of measureLineEdges(poly.points, Boolean(poly.closed))) {
        const p = projectOnSegment(click, a, b);
        const d = planarMeters(click, p);
        if (d < bestEd) {
          bestEd = d;
          bestE = p;
          bestEKind = "line";
        }
      }
    }
  }
  if (bestE && bestEd <= maxMeters) {
    return { point: bestE, kind: bestEKind };
  }

  if (bestV && bestVd <= maxMeters) {
    return { point: { lat: bestV.lat, lng: bestV.lng }, kind: bestKind };
  }
  return { point: click, kind: "none" };
}

/** Snap distance from `from` toward `click` to the nearest multiple of `stepM` (min 1 step). */
export function applyFixedLengthSnap(
  from: Coords,
  click: Coords,
  stepM: number
): SnapResult {
  if (stepM <= 0) return { point: click, kind: "none" };
  const dist = planarMeters(from, click);
  const steps = Math.max(1, Math.round(dist / stepM));
  const target = pointAtDistance(from, click, steps * stepM);
  return { point: target, kind: "fixed" };
}

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

function draftStats(kind: MeasureKind, points: Coords[], closed: boolean) {
  const lengthM =
    kind === "area" && points.length >= 2
      ? closed
        ? ringPerimeterMeters(points.map((p) => [p.lat, p.lng] as [number, number]))
        : pathLengthShared(points)
      : pathLengthShared(points);
  const areaSqm =
    kind === "area" && closed && points.length >= 3
      ? ringAreaSqm(points.map((p) => [p.lat, p.lng] as [number, number]))
      : null;
  return { lengthM, areaSqm };
}

function snapRadiusMeters(L: LeafletNS, map: LeafletMap): number {
  const center = map.getCenter();
  const p1 = map.latLngToContainerPoint(center);
  const p2 = L.point(p1.x + 28, p1.y);
  const ll2 = map.containerPointToLatLng(p2);
  const r = planarMeters(
    { lat: center.lat, lng: center.lng },
    { lat: ll2.lat, lng: ll2.lng }
  );
  return Math.max(1.2, Math.min(r, 35));
}

function drawFeature(
  L: LeafletNS,
  group: import("leaflet").LayerGroup,
  kind: MeasureKind,
  points: Coords[],
  color: string,
  closed: boolean,
  lang: "ar" | "en",
  opts?: {
    editable?: boolean;
    onVertexDragEnd?: (index: number, latlng: Coords) => void;
  }
) {
  if (points.length === 0) return;
  const latlngs = points.map((p) => L.latLng(p.lat, p.lng));
  const editable = Boolean(opts?.editable);

  if (kind === "area" && (closed || points.length >= 2)) {
    L.polygon(latlngs, {
      color,
      weight: 2.5,
      fillColor: color,
      fillOpacity: closed ? 0.18 : 0.08,
      dashArray: closed ? undefined : "6 4",
      interactive: false,
    }).addTo(group);
  } else if (points.length >= 2) {
    L.polyline(latlngs, {
      color,
      weight: 3,
      interactive: false,
    }).addTo(group);
  }

  const labelPairs: [Coords, Coords][] = [];
  for (let i = 1; i < points.length; i++) labelPairs.push([points[i - 1]!, points[i]!]);
  if (kind === "area" && closed && points.length >= 3) {
    labelPairs.push([points[points.length - 1]!, points[0]!]);
  }

  const origin = {
    lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
  };

  for (const [a, b] of labelPairs) {
    const mid = L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);
    const pa = toLocalEnu(a.lat, a.lng, origin.lat, origin.lng);
    const pb = toLocalEnu(b.lat, b.lng, origin.lat, origin.lng);
    const dist = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    const label = formatMeters(dist, lang);
    L.marker(mid, {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: "",
        html: `<span style="display:inline-block;padding:2px 7px;border-radius:999px;background:rgba(15,52,47,.94);color:${color};font:700 11px/1.2 system-ui,sans-serif;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.35);letter-spacing:.01em">${label}</span>`,
        iconSize: [1, 1],
        iconAnchor: [0, 0],
      }),
    }).addTo(group);
  }

  points.forEach((p, index) => {
    const marker = L.marker([p.lat, p.lng], {
      interactive: editable,
      draggable: editable,
      keyboard: false,
      zIndexOffset: editable ? 600 : 0,
      icon: L.divIcon({
        className: "",
        html: vertexHtml(color),
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    }).addTo(group);

    if (editable && opts?.onVertexDragEnd) {
      marker.on("click", (e) => {
        L.DomEvent.stop(e.originalEvent);
        L.DomEvent.preventDefault(e.originalEvent);
      });
      marker.on("dblclick", (e) => {
        L.DomEvent.stop(e.originalEvent);
        L.DomEvent.preventDefault(e.originalEvent);
      });
      marker.on("dragend", (e) => {
        const ll = (e.target as import("leaflet").Marker).getLatLng();
        opts.onVertexDragEnd!(index, { lat: ll.lat, lng: ll.lng });
      });
    }
  });
}

/**
 * Architecture measure overlay: multiple finished distance/area threads can
 * coexist, each with its own color. Active tool draws the current draft.
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
  let threads: MeasureThread[] = [];
  let points: Coords[] = [];
  let closed = false;
  let lastSnapped = false;
  let liveSegmentM: number | null = null;
  let snapTargets: Coords[] = [];
  let edgeSnap = true;
  let lineSnap = true;
  let fixedSnapM: FixedSnapMeters = 0;
  let lineColor: string = DEFAULT_MEASURE_LINE_COLOR;
  let pendingClickTimer: number | null = null;
  let pendingClickCoords: Coords | null = null;
  let suppressMapClickUntil = 0;
  let clickHandler: ((e: import("leaflet").LeafletMouseEvent) => void) | null = null;
  let moveHandler: ((e: import("leaflet").LeafletMouseEvent) => void) | null = null;
  let dblHandler: ((e: import("leaflet").LeafletMouseEvent) => void) | null = null;
  let prevDoubleClickZoom = true;

  function emit() {
    const kind: MeasureKind = mode === "area" ? "area" : "distance";
    const stats = draftStats(kind, points, closed);
    opts.onChange({
      mode,
      threads: threads.map((t) => ({
        ...t,
        points: t.points.map((p) => ({ ...p })),
      })),
      points: [...points],
      lengthM: stats.lengthM,
      areaSqm: stats.areaSqm,
      closed,
      lastSnapped,
      liveSegmentM,
      lineColor,
    });
  }

  function drawSnapTargets() {
    snapGroup.clearLayers();
    if (mode === "off") return;
    const pts: Coords[] = [];
    if (edgeSnap) pts.push(...snapTargets);
    if (lineSnap) {
      for (const t of threads) pts.push(...t.points);
    }
    const seen = new Set<string>();
    for (const p of pts) {
      const key = `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`;
      if (seen.has(key)) continue;
      seen.add(key);
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

  function resolveClick(raw: Coords, resolveOpts?: { skipFixed?: boolean }): SnapResult {
    const radius = snapRadiusMeters(L, map);
    const linePolylines = lineSnap
      ? [
          ...threads.map((t) => ({
            points: t.points,
            closed: t.kind === "area",
          })),
          ...(points.length >= 2 ? [{ points, closed: mode === "area" && closed }] : []),
        ]
      : [];
    // Parcel targets only when edge snap is on (vertices + edges of the land).
    const parcelTargets = edgeSnap ? snapTargets : [];
    let snapped = snapMeasureClick(raw, parcelTargets, radius, {
      edgeSnap,
      linePolylines,
      lineEdgeSnap: lineSnap,
    });

    // Fixed length from the previous draft vertex (1 m / 5 m steps).
    if (
      !resolveOpts?.skipFixed &&
      fixedSnapM > 0 &&
      points.length >= 1 &&
      !closed
    ) {
      const fixed = applyFixedLengthSnap(points[points.length - 1]!, snapped.point, fixedSnapM);
      snapped = { point: fixed.point, kind: snapped.kind === "none" ? "fixed" : snapped.kind };
    }
    return snapped;
  }

  function moveDraftVertex(index: number, raw: Coords) {
    if (index < 0 || index >= points.length) return;
    const snapped = resolveClick(raw, { skipFixed: true });
    points[index] = snapped.point;
    lastSnapped = snapped.kind !== "none";
    suppressMapClickUntil = Date.now() + 450;
    redrawAll();
    emit();
  }

  function redrawAll() {
    group.clearLayers();
    for (const t of threads) {
      drawFeature(L, group, t.kind, t.points, t.color, true, opts.lang);
    }
    if (mode !== "off" && points.length > 0) {
      drawFeature(L, group, mode, points, lineColor, closed, opts.lang, {
        editable: true,
        onVertexDragEnd: moveDraftVertex,
      });
    }
  }

  function commitDraftToThread(): boolean {
    if (mode === "off" || points.length === 0) return false;
    const kind: MeasureKind = mode === "area" ? "area" : "distance";
    const canCommit =
      kind === "distance" ? points.length >= 2 : points.length >= 3;
    if (!canCommit) return false;
    const stats = draftStats(kind, points, true);
    threads = [
      ...threads,
      {
        id: nextThreadId(),
        kind,
        points: points.map((p) => ({ ...p })),
        color: lineColor,
        lengthM: stats.lengthM,
        areaSqm: kind === "area" ? stats.areaSqm : null,
      },
    ];
    return true;
  }

  function resetDraft(keepColor = true) {
    points = [];
    closed = false;
    lastSnapped = false;
    liveSegmentM = null;
    cursorGroup.clearLayers();
    if (!keepColor) lineColor = DEFAULT_MEASURE_LINE_COLOR;
  }

  function placePoint(raw: Coords) {
    if (mode === "off" || closed) return;
    const snapped = resolveClick(raw);
    if (mode === "area" && points.length >= 3) {
      const first = points[0]!;
      if (planarMeters(first, snapped.point) <= Math.max(1.5, snapRadiusMeters(L, map) * 0.65)) {
        finishLine({ autoNew: true });
        return;
      }
    }
    points.push(snapped.point);
    lastSnapped = snapped.kind !== "none";
    liveSegmentM = null;
    redrawAll();
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

  function finishLine(optsFinish?: { autoNew?: boolean }) {
    if (mode === "off" || closed) return;
    const kind: MeasureKind = mode === "area" ? "area" : "distance";
    const ok = kind === "distance" ? points.length >= 2 : points.length >= 3;
    if (!ok) return;

    commitDraftToThread();
    const advanceColor = optsFinish?.autoNew !== false;
    resetDraft(true);
    if (advanceColor) lineColor = nextColorAfter(lineColor);
    drawSnapTargets();
    redrawAll();
    emit();
  }

  function bindMap() {
    unbindMap();
    clickHandler = (e) => {
      if (mode === "off" || closed) return;
      if (Date.now() < suppressMapClickUntil) return;
      L.DomEvent.stopPropagation(e.originalEvent);
      const coords = { lat: e.latlng.lat, lng: e.latlng.lng };
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
      finishLine({ autoNew: true });
    };
    map.on("click", clickHandler);
    map.on("mousemove", moveHandler);
    map.on("dblclick", dblHandler);
  }

  return {
    setMode(next: MeasureMode) {
      if (next === mode) {
        emit();
        return;
      }

      // Leaving measure tool — keep finished threads on the map (explicit clear() wipes).
      if (next === "off") {
        mode = "off";
        resetDraft(false);
        unbindMap();
        cursorGroup.clearLayers();
        snapGroup.clearLayers();
        redrawAll();
        if (prevDoubleClickZoom) map.doubleClickZoom.enable();
        map.getContainer().style.cursor = "";
        emit();
        return;
      }

      // Switching tools: keep finished threads; commit current draft if possible.
      if (mode !== "off") {
        commitDraftToThread();
        resetDraft(true);
      } else {
        prevDoubleClickZoom = map.doubleClickZoom.enabled();
        bindMap();
        map.doubleClickZoom.disable();
        map.getContainer().style.cursor = "crosshair";
      }

      mode = next;
      // Keep map handlers when already measuring.
      if (!clickHandler) {
        bindMap();
        map.doubleClickZoom.disable();
        map.getContainer().style.cursor = "crosshair";
      }
      drawSnapTargets();
      redrawAll();
      emit();
    },
    setSnapTargets(targets: Coords[]) {
      snapTargets = targets.map((t) => ({ lat: t.lat, lng: t.lng }));
      drawSnapTargets();
    },
    setEdgeSnap(enabled: boolean) {
      edgeSnap = Boolean(enabled);
      drawSnapTargets();
    },
    setLineSnap(enabled: boolean) {
      lineSnap = Boolean(enabled);
      drawSnapTargets();
    },
    setFixedSnapM(meters: FixedSnapMeters) {
      fixedSnapM = meters === 1 || meters === 5 ? meters : 0;
    },
    setLineColor(hex: string) {
      const next = String(hex || "").trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(next)) return;
      lineColor = next;
      redrawAll();
      emit();
    },
    /** Finish current draft into a thread, then start another with a new color. */
    newThread() {
      if (mode === "off") return;
      if (points.length > 0) finishLine({ autoNew: true });
      else {
        lineColor = nextColorAfter(lineColor);
        emit();
      }
    },
    finish() {
      finishLine({ autoNew: true });
    },
    undo() {
      if (closed) {
        closed = false;
      } else if (points.length > 0) {
        points.pop();
      } else if (threads.length > 0) {
        const last = threads[threads.length - 1]!;
        threads = threads.slice(0, -1);
        // Restore last thread as editable draft of matching kind.
        mode = last.kind;
        points = last.points.map((p) => ({ ...p }));
        lineColor = last.color;
        closed = false;
      }
      lastSnapped = false;
      liveSegmentM = null;
      cursorGroup.clearLayers();
      redrawAll();
      emit();
    },
    clear() {
      threads = [];
      resetDraft(true);
      group.clearLayers();
      cursorGroup.clearLayers();
      emit();
    },
    removeThread(id: string) {
      threads = threads.filter((t) => t.id !== id);
      redrawAll();
      emit();
    },
    /**
     * Restore finished threads + draft from another map instance
     * (fullscreen ↔ inline). Does not wipe on mode sync the way setMode("off") does.
     */
    restoreSnapshot(snap: MeasureSnapshot | null | undefined) {
      threads = (snap?.threads ?? []).map((t) => ({
        ...t,
        points: t.points.map((p) => ({ ...p })),
      }));
      points = (snap?.points ?? []).map((p) => ({ ...p }));
      closed = Boolean(snap?.closed);
      lastSnapped = Boolean(snap?.lastSnapped);
      liveSegmentM = snap?.liveSegmentM ?? null;
      if (snap?.lineColor) lineColor = snap.lineColor;

      let nextMode: MeasureMode;
      if (snap?.mode === "area" || snap?.mode === "distance") {
        nextMode = snap.mode;
      } else if (snap?.mode === "off") {
        nextMode = "off";
      } else {
        // No explicit mode on the snapshot — keep measuring if we already are.
        nextMode = mode === "off" ? "distance" : mode;
      }

      if (mode === "off" && nextMode !== "off") {
        prevDoubleClickZoom = map.doubleClickZoom.enabled();
        bindMap();
        map.doubleClickZoom.disable();
        map.getContainer().style.cursor = "crosshair";
      } else if (mode !== "off" && nextMode === "off") {
        unbindMap();
        if (prevDoubleClickZoom) map.doubleClickZoom.enable();
        map.getContainer().style.cursor = "";
        cursorGroup.clearLayers();
      } else if (nextMode !== "off") {
        if (!clickHandler) bindMap();
        map.doubleClickZoom.disable();
        map.getContainer().style.cursor = "crosshair";
      }
      mode = nextMode;
      redrawAll();
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

/** Format a finished thread for the results list. */
export function formatThreadSummary(thread: MeasureThread, lang: "ar" | "en") {
  if (thread.kind === "area" && thread.areaSqm != null && thread.areaSqm > 0) {
    return formatDlsArea(thread.areaSqm, lang);
  }
  return formatMeters(thread.lengthM, lang);
}

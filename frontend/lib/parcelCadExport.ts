import type { Coords } from "@/lib/mapCoords";
import {
  ringAreaSqm,
  ringPerimeterMeters,
  toLocalEnu,
} from "@/lib/mapCoords";
import type { MeasureSnapshot, MeasureThread } from "@/lib/measureDraw";

export type ParcelCadExportInput = {
  /** Single-parcel ring (legacy). Prefer `rings` for multi-land. */
  ring?: [number, number][];
  /** One or more cadastral rings ([lat,lng][]). Shared borders are drawn once. */
  rings?: [number, number][][];
  parcelNumber?: string | null;
  areaSqm?: number | null;
  perimeterM?: number | null;
  /** Architecture measure threads + optional draft. */
  measure?: MeasureSnapshot | null;
};

type Pt = { x: number; y: number };

const SITE = "https://alshantaf.com";
/** Snap tolerance (m) for matching shared multi-parcel borders. */
const EDGE_SNAP_M = 0.08;

function n(v: number, digits = 4) {
  return Number.isFinite(v) ? v.toFixed(digits) : "0";
}

function uniqueRing(ring: [number, number][]): [number, number][] {
  if (!ring.length) return [];
  const pts = ring.slice();
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) pts.pop();
  return pts;
}

function collectRings(input: ParcelCadExportInput): [number, number][][] {
  const raw = input.rings?.length ? input.rings : input.ring?.length ? [input.ring] : [];
  return raw.map(uniqueRing).filter((r) => r.length >= 2);
}

function ringCentroidLatLng(pts: [number, number][]): Coords {
  let lat = 0;
  let lng = 0;
  for (const p of pts) {
    lat += p[0]!;
    lng += p[1]!;
  }
  return { lat: lat / pts.length, lng: lng / pts.length };
}

function snapKey(x: number, y: number): string {
  return `${Math.round(x / EDGE_SNAP_M)},${Math.round(y / EDGE_SNAP_M)}`;
}

function edgeKey(a: Pt, b: Pt): string {
  const ka = snapKey(a.x, a.y);
  const kb = snapKey(b.x, b.y);
  return ka <= kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

type UniqueEdge = { a: Pt; b: Pt; count: number; lengthM: number };

/**
 * Collect ring edges and collapse shared multi-parcel borders to a single segment.
 * `count === 1` → exterior edge; `count >= 2` → shared internal border.
 */
function uniqueEdgesFromRings(ringsXy: Pt[][]): UniqueEdge[] {
  const map = new Map<string, UniqueEdge>();
  for (const ring of ringsXy) {
    if (ring.length < 2) continue;
    const nPts = ring.length;
    for (let i = 0; i < nPts; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % nPts]!;
      const lengthM = Math.hypot(b.x - a.x, b.y - a.y);
      if (lengthM < EDGE_SNAP_M * 0.5) continue;
      const key = edgeKey(a, b);
      const prev = map.get(key);
      if (prev) {
        prev.count += 1;
      } else {
        map.set(key, { a, b, count: 1, lengthM });
      }
    }
  }
  return [...map.values()];
}

/**
 * Minimal AutoCAD-compatible ASCII DXF (AC1015 / R2000).
 * Geometry only (English layer names) — no TEXT entities.
 * Multi-land shared borders are emitted once (not doubled).
 */
export function buildParcelCadDxf(input: ParcelCadExportInput): string {
  const rings = collectRings(input);
  if (!rings.length) throw new Error("parcel-ring");

  const allPts = rings.flat();
  const origin = ringCentroidLatLng(allPts);
  const toXy = (c: Coords): Pt => {
    const p = toLocalEnu(c.lat, c.lng, origin.lat, origin.lng);
    return { x: p.x, y: p.y };
  };
  const ringsXy = rings.map((ring) => ring.map(([lat, lng]) => toXy({ lat, lng })));
  const edges = uniqueEdgesFromRings(ringsXy);
  if (!edges.length) throw new Error("parcel-ring");

  const area =
    input.areaSqm != null && input.areaSqm > 0
      ? input.areaSqm
      : rings.reduce((sum, ring) => sum + ringAreaSqm(ring), 0);
  // Exterior-only perimeter (shared borders counted once as internal → excluded)
  const exteriorPeri = edges.filter((e) => e.count === 1).reduce((s, e) => s + e.lengthM, 0);
  const peri =
    input.perimeterM != null && input.perimeterM > 0 ? input.perimeterM : exteriorPeri;

  const lines: string[] = [];
  const push = (...pairs: Array<string | number>) => {
    for (let i = 0; i < pairs.length; i += 2) {
      lines.push(String(pairs[i]), String(pairs[i + 1]));
    }
  };
  const comment = (text: string) => {
    lines.push("999", text);
  };

  const parcelBit = input.parcelNumber?.trim() || "";
  comment(`${SITE} — parcel CAD export`);
  comment(`Units: metres | X=East Y=North | local origin at parcel centroid`);
  if (parcelBit) comment(`Parcel: ${parcelBit}`);
  if (rings.length > 1) comment(`Rings: ${rings.length} (shared borders deduplicated)`);
  comment(`Area_m2: ${n(area, 3)} | Perimeter_m: ${n(peri, 3)}`);
  comment(`WGS84_centroid: ${origin.lat.toFixed(6)}, ${origin.lng.toFixed(6)}`);
  comment(`Advisory geometry — confirm with an official survey before construction`);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (p: Pt) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  for (const e of edges) {
    grow(e.a);
    grow(e.b);
  }

  push(0, "SECTION", 2, "HEADER");
  push(9, "$ACADVER", 1, "AC1015");
  push(9, "$INSUNITS", 70, 6);
  push(9, "$MEASUREMENT", 70, 1);
  push(9, "$LUNITS", 70, 2);
  push(9, "$LUPREC", 70, 3);
  push(9, "$AUNITS", 70, 0);
  push(9, "$AUPREC", 70, 2);
  push(9, "$EXTMIN", 10, n(minX - 5), 20, n(minY - 5), 30, 0);
  push(9, "$EXTMAX", 10, n(maxX + 5), 20, n(maxY + 5), 30, 0);
  push(0, "ENDSEC");

  push(0, "SECTION", 2, "TABLES");
  push(0, "TABLE", 2, "LTYPE", 70, 1);
  push(0, "LTYPE", 2, "CONTINUOUS", 70, 0, 3, "Solid line", 72, 65, 73, 0, 40, 0);
  push(0, "ENDTAB");
  push(0, "TABLE", 2, "LAYER", 70, 5);
  const layer = (name: string, color: number) => {
    push(0, "LAYER", 2, name, 70, 0, 62, color, 6, "CONTINUOUS");
  };
  layer("0", 7);
  layer("PARCEL", 3); // green — exterior + unique edges
  layer("SHARED", 8); // dark grey — internal shared borders (once)
  layer("DIMS", 1); // red
  layer("MEASURE", 5); // blue
  push(0, "ENDTAB");
  push(0, "ENDSEC");

  push(0, "SECTION", 2, "BLOCKS");
  push(0, "ENDSEC");

  push(0, "SECTION", 2, "ENTITIES");

  // Unique edge segments — shared multi-land borders appear once
  for (const e of edges) {
    const layerName = e.count >= 2 ? "SHARED" : "PARCEL";
    push(0, "LINE", 8, layerName, 10, n(e.a.x), 20, n(e.a.y), 11, n(e.b.x), 21, n(e.b.y));
  }

  // Dimension ticks only on exterior edges (not shared internals)
  const exterior = edges.filter((e) => e.count === 1);
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const dimOffset = Math.max(2, Math.min(8, span * 0.03));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  for (const e of exterior) {
    const a = e.a;
    const b = e.b;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    // Push dimension outward from the overall footprint center
    if ((midX - cx) * nx + (midY - cy) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const a2 = { x: a.x + nx * dimOffset, y: a.y + ny * dimOffset };
    const b2 = { x: b.x + nx * dimOffset, y: b.y + ny * dimOffset };
    push(0, "LINE", 8, "DIMS", 10, n(a.x), 20, n(a.y), 11, n(a2.x), 21, n(a2.y));
    push(0, "LINE", 8, "DIMS", 10, n(b.x), 20, n(b.y), 11, n(b2.x), 21, n(b2.y));
    push(0, "LINE", 8, "DIMS", 10, n(a2.x), 20, n(a2.y), 11, n(b2.x), 21, n(b2.y));
  }

  const writePolyline = (layerName: string, points: Pt[], closed: boolean) => {
    if (points.length < 2) return;
    push(0, "LWPOLYLINE", 8, layerName, 90, points.length, 70, closed ? 1 : 0, 43, 0);
    for (const p of points) {
      grow(p);
      push(10, n(p.x), 20, n(p.y));
    }
  };

  const writeThread = (thread: MeasureThread, layerName = "MEASURE") => {
    const xy = thread.points.map(toXy);
    if (xy.length < 2) return;
    writePolyline(layerName, xy, thread.kind === "area" && xy.length >= 3);
  };

  const measure = input.measure;
  if (measure) {
    for (const t of measure.threads) writeThread(t);
    if (measure.points.length >= 2) {
      writeThread({
        id: "draft",
        kind: measure.mode === "area" ? "area" : "distance",
        points: measure.points,
        color: measure.lineColor,
        lengthM: measure.lengthM,
        areaSqm: measure.areaSqm,
      });
    }
  }

  push(0, "ENDSEC");
  push(0, "EOF");
  return lines.join("\n") + "\n";
}

function safeFileBase(parcelNumber?: string | null) {
  const parcelBit = parcelNumber?.trim() ? `-${parcelNumber.trim()}` : "";
  return `alshantaf-parcel${parcelBit}`.replace(/[^\w.\-]+/g, "_");
}

/** Download English geometry DXF (opens in AutoCAD). Binary DWG is not generated client-side. */
export function downloadParcelCadDxf(input: ParcelCadExportInput, fileName?: string) {
  const dxf = buildParcelCadDxf(input);
  const name = (fileName || `${safeFileBase(input.parcelNumber)}.dxf`).replace(/[^\w.\-]+/g, "_");
  const blob = new Blob([dxf], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.endsWith(".dxf") ? name : `${name}.dxf`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

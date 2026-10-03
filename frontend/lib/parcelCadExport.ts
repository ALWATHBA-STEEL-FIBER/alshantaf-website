import type { Coords } from "@/lib/mapCoords";
import {
  ringAreaSqm,
  ringEdgeDimensions,
  ringPerimeterMeters,
  toLocalEnu,
} from "@/lib/mapCoords";
import type { MeasureSnapshot, MeasureThread } from "@/lib/measureDraw";

export type ParcelCadExportInput = {
  ring: [number, number][];
  parcelNumber?: string | null;
  areaSqm?: number | null;
  perimeterM?: number | null;
  /** Architecture measure threads + optional draft. */
  measure?: MeasureSnapshot | null;
};

type Pt = { x: number; y: number };

const SITE = "https://alshantaf.com";

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

function ringCentroidLatLng(pts: [number, number][]): Coords {
  let lat = 0;
  let lng = 0;
  for (const p of pts) {
    lat += p[0]!;
    lng += p[1]!;
  }
  return { lat: lat / pts.length, lng: lng / pts.length };
}

/**
 * Minimal AutoCAD-compatible ASCII DXF (AC1015 / R2000).
 * Geometry only (English layer names) — no TEXT entities.
 * File comments carry alshantaf.com metadata.
 * True binary DWG is proprietary; AutoCAD / Civil 3D open this DXF directly.
 */
export function buildParcelCadDxf(input: ParcelCadExportInput): string {
  const pts = uniqueRing(input.ring);
  if (pts.length < 2) throw new Error("parcel-ring");

  const origin = ringCentroidLatLng(pts);
  const toXy = (c: Coords): Pt => {
    const p = toLocalEnu(c.lat, c.lng, origin.lat, origin.lng);
    return { x: p.x, y: p.y };
  };
  const ringXy = pts.map(([lat, lng]) => toXy({ lat, lng }));

  const area =
    input.areaSqm != null && input.areaSqm > 0 ? input.areaSqm : ringAreaSqm(input.ring);
  const peri =
    input.perimeterM != null && input.perimeterM > 0
      ? input.perimeterM
      : ringPerimeterMeters(input.ring);

  const edges = ringEdgeDimensions(input.ring);
  const lines: string[] = [];
  const push = (...pairs: Array<string | number>) => {
    for (let i = 0; i < pairs.length; i += 2) {
      lines.push(String(pairs[i]), String(pairs[i + 1]));
    }
  };
  /** DXF comment (group 999) — metadata only, not a drawing entity. */
  const comment = (text: string) => {
    lines.push("999", text);
  };

  const parcelBit = input.parcelNumber?.trim() || "";
  comment(`${SITE} — parcel CAD export`);
  comment(`Units: metres | X=East Y=North | local origin at parcel centroid`);
  if (parcelBit) comment(`Parcel: ${parcelBit}`);
  comment(`Area_m2: ${n(area, 3)} | Perimeter_m: ${n(peri, 3)}`);
  comment(`WGS84_centroid: ${origin.lat.toFixed(6)}, ${origin.lng.toFixed(6)}`);
  comment(`Advisory geometry — confirm with an official survey before construction`);

  // HEADER
  push(0, "SECTION", 2, "HEADER");
  push(9, "$ACADVER", 1, "AC1015");
  push(9, "$INSUNITS", 70, 6); // metres
  push(9, "$MEASUREMENT", 70, 1); // metric
  push(9, "$LUNITS", 70, 2);
  push(9, "$LUPREC", 70, 3);
  push(9, "$AUNITS", 70, 0);
  push(9, "$AUPREC", 70, 2);
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
  ringXy.forEach(grow);
  push(9, "$EXTMIN", 10, n(minX - 5), 20, n(minY - 5), 30, 0);
  push(9, "$EXTMAX", 10, n(maxX + 5), 20, n(maxY + 5), 30, 0);
  push(0, "ENDSEC");

  // TABLES — layers (geometry only; no TEXT layer)
  push(0, "SECTION", 2, "TABLES");
  push(0, "TABLE", 2, "LTYPE", 70, 1);
  push(0, "LTYPE", 2, "CONTINUOUS", 70, 0, 3, "Solid line", 72, 65, 73, 0, 40, 0);
  push(0, "ENDTAB");
  push(0, "TABLE", 2, "LAYER", 70, 4);
  const layer = (name: string, color: number) => {
    push(0, "LAYER", 2, name, 70, 0, 62, color, 6, "CONTINUOUS");
  };
  layer("0", 7);
  layer("PARCEL", 3); // green
  layer("DIMS", 1); // red
  layer("MEASURE", 5); // blue
  push(0, "ENDTAB");
  push(0, "ENDSEC");

  push(0, "SECTION", 2, "BLOCKS");
  push(0, "ENDSEC");

  push(0, "SECTION", 2, "ENTITIES");

  // Parcel outline
  push(0, "LWPOLYLINE", 8, "PARCEL", 90, ringXy.length, 70, 1, 43, 0);
  for (const p of ringXy) {
    push(10, n(p.x), 20, n(p.y));
  }

  // Edge dimension geometry only (extension ticks + dim line — no labels)
  const dimOffset = Math.max(2, Math.min(8, (maxX - minX + maxY - minY) * 0.03));

  for (const edge of edges) {
    const a = toXy(edge.start);
    const b = toXy(edge.end);
    grow(a);
    grow(b);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    if (midX * nx + midY * ny < 0) {
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

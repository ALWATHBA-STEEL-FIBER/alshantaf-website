import type { Coords } from "@/lib/mapCoords";
import { ringEdgeDimensions, toLocalEnu } from "@/lib/mapCoords";
import type { MeasureSnapshot, MeasureThread } from "@/lib/measureDraw";

export type ParcelCadExportInput = {
  ring?: [number, number][];
  rings?: [number, number][][];
  parcelNumber?: string | null;
  parcelNumbers?: string[] | null;
  areaSqm?: number | null;
  perimeterM?: number | null;
  /** Architecture measure threads + optional draft. */
  measure?: MeasureSnapshot | null;
};

type Pt = { x: number; y: number };

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

function midpointOnPolyline(points: Pt[]): Pt | null {
  if (points.length < 2) return null;
  const segs: Array<{ a: Pt; b: Pt; len: number }> = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len <= 1e-9) continue;
    segs.push({ a, b, len });
    total += len;
  }
  if (total <= 1e-9) return points[0] ?? null;
  let remain = total / 2;
  for (const s of segs) {
    if (remain <= s.len) {
      const t = remain / s.len;
      return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
    }
    remain -= s.len;
  }
  return segs[segs.length - 1] ? segs[segs.length - 1]!.b : null;
}

function centroid2d(points: Pt[]): Pt | null {
  if (points.length < 3) return midpointOnPolyline(points);
  let a2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    const cross = p.x * q.y - q.x * p.y;
    a2 += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  if (Math.abs(a2) < 1e-9) {
    const avg = points.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
    return { x: avg.x / points.length, y: avg.y / points.length };
  }
  return { x: cx / (3 * a2), y: cy / (3 * a2) };
}

/**
 * AutoCAD R12 ASCII DXF (AC1009).
 *
 * Online viewers accept the thinner R2000-looking files we used to emit.
 * AutoCAD / Civil 3D do not: they drop LWPOLYLINE without AcDb subclass
 * markers and often open an empty drawing. R12 POLYLINE+VERTEX is what
 * desktop AutoCAD actually loads. True binary DWG is proprietary.
 */
export function buildParcelCadDxf(input: ParcelCadExportInput): string {
  const sourceRings = (input.rings?.length ? input.rings : input.ring ? [input.ring] : [])
    .map((ring) => uniqueRing(ring))
    .filter((ring) => ring.length >= 2);
  if (!sourceRings.length) throw new Error("parcel-ring");
  const allPts = sourceRings.flat();

  const origin = ringCentroidLatLng(allPts);
  const toXy = (c: Coords): Pt => {
    const p = toLocalEnu(c.lat, c.lng, origin.lat, origin.lng);
    return { x: p.x, y: p.y };
  };
  const ringsXy = sourceRings.map((ring) => ring.map(([lat, lng]) => toXy({ lat, lng })));

  const edgesByRing = sourceRings.map((ring) => ringEdgeDimensions(ring));
  const lines: string[] = [];
  const push = (...pairs: Array<string | number>) => {
    for (let i = 0; i < pairs.length; i += 2) {
      lines.push(String(pairs[i]), String(pairs[i + 1]));
    }
  };

  const dimValue = (meters: number) => {
    if (!Number.isFinite(meters) || meters <= 0) return "0";
    const rounded = Math.round(meters * 100) / 100;
    return rounded.toFixed(2).replace(/\.00$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
  };

  const dxfText = (value: string) =>
    value.replace(/[\u0000-\u001f]/g, " ").replace(/^\s+|\s+$/g, "").slice(0, 250);

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
  ringsXy.flat().forEach(grow);

  const dimOffset = Math.max(2, Math.min(8, (maxX - minX + maxY - minY) * 0.03));
  const dimTextHeight = Math.max(0.35, Math.min(1.2, dimOffset * 0.35));

  type CadEntity =
    | { kind: "poly"; layer: string; points: Pt[]; closed: boolean }
    | { kind: "line"; layer: string; a: Pt; b: Pt }
    | { kind: "text"; layer: string; p: Pt; height: number; text: string; rotation?: number };

  const entities: CadEntity[] = [];

  for (let r = 0; r < ringsXy.length; r++) {
    const ringXy = ringsXy[r]!;
    entities.push({ kind: "poly", layer: "PARCEL", points: ringXy, closed: true });
    const parcelNo = input.parcelNumbers?.[r] || input.parcelNumber || "";
    const c = centroid2d(ringXy);
    if (parcelNo && c) {
      entities.push({ kind: "text", layer: "DIMS_NUM", p: c, height: 1.2, text: dxfText(String(parcelNo)) });
    }
  }

  for (let ri = 0; ri < edgesByRing.length; ri++) {
    const edges = edgesByRing[ri]!;
    for (const edge of edges) {
      const a = toXy(edge.start);
      const b = toXy(edge.end);
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
      grow(a2);
      grow(b2);
      entities.push({ kind: "line", layer: "DIMS", a, b: a2 });
      entities.push({ kind: "line", layer: "DIMS", a: b, b: b2 });
      entities.push({ kind: "line", layer: "DIMS", a: a2, b: b2 });
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      entities.push({
        kind: "text",
        layer: "DIMS_NUM",
        p: { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 },
        height: dimTextHeight,
        text: dimValue(edge.lengthM),
        rotation: angleDeg,
      });
    }
  }

  const writeThread = (thread: MeasureThread, layerName = "MEASURE") => {
    const xy = thread.points.map(toXy);
    if (xy.length < 2) return;
    xy.forEach(grow);
    entities.push({
      kind: "poly",
      layer: layerName,
      points: xy,
      closed: thread.kind === "area" && xy.length >= 3,
    });
    const labelPos = thread.kind === "area" ? centroid2d(xy) : midpointOnPolyline(xy);
    const value =
      thread.kind === "area" ? dimValue(thread.areaSqm ?? 0) : dimValue(thread.lengthM ?? 0);
    if (labelPos && value !== "0") {
      entities.push({ kind: "text", layer: "DIMS_NUM", p: labelPos, height: 0.9, text: value });
    }
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

  const pad = 5;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const viewH = Math.max(maxY - minY + pad * 2, maxX - minX + pad * 2, 10);

  // File must start with group 0 — AutoCAD rejects/empties files that begin with 999 comments.
  push(0, "SECTION", 2, "HEADER");
  push(9, "$ACADVER", 1, "AC1009");
  push(9, "$INSBASE", 10, "0.0", 20, "0.0", 30, "0.0");
  push(9, "$EXTMIN", 10, n(minX - pad), 20, n(minY - pad), 30, "0.0");
  push(9, "$EXTMAX", 10, n(maxX + pad), 20, n(maxY + pad), 30, "0.0");
  push(9, "$LIMMIN", 10, n(minX - pad), 20, n(minY - pad));
  push(9, "$LIMMAX", 10, n(maxX + pad), 20, n(maxY + pad));
  push(9, "$TEXTSIZE", 40, n(dimTextHeight, 3));
  push(9, "$TEXTSTYLE", 7, "STANDARD");
  push(0, "ENDSEC");

  push(0, "SECTION", 2, "TABLES");

  push(0, "TABLE", 2, "VPORT", 70, 1);
  push(
    0, "VPORT",
    2, "*ACTIVE",
    70, 0,
    10, "0.0", 20, "0.0",
    11, "1.0", 21, "1.0",
    12, n(cx), 22, n(cy),
    13, "0.0", 23, "0.0",
    14, "0.5", 24, "0.5",
    15, "0.5", 25, "0.5",
    16, "0.0", 26, "0.0", 36, "1.0",
    17, "0.0", 27, "0.0", 37, "0.0",
    40, n(viewH),
    41, "1.4",
    42, "50.0",
    43, "0.0",
    44, "0.0",
    50, "0.0",
    51, "0.0",
    71, 0,
    72, 100,
    73, 1,
    74, 3,
    75, 0,
    76, 0,
    77, 0,
    78, 0
  );
  push(0, "ENDTAB");

  push(0, "TABLE", 2, "LTYPE", 70, 1);
  push(0, "LTYPE", 2, "CONTINUOUS", 70, 64, 3, "Solid line", 72, 65, 73, 0, 40, "0.0");
  push(0, "ENDTAB");

  push(0, "TABLE", 2, "LAYER", 70, 5);
  const layer = (name: string, color: number) => {
    push(0, "LAYER", 2, name, 70, 0, 62, color, 6, "CONTINUOUS");
  };
  layer("0", 7);
  layer("PARCEL", 3);
  layer("DIMS", 1);
  layer("DIMS_NUM", 2);
  layer("MEASURE", 5);
  push(0, "ENDTAB");

  push(0, "TABLE", 2, "STYLE", 70, 1);
  push(0, "STYLE", 2, "STANDARD", 70, 0, 40, "0.0", 41, "1.0", 50, "0.0", 71, 0, 42, "1.0", 3, "txt", 4, "");
  push(0, "ENDTAB");
  push(0, "ENDSEC");

  push(0, "SECTION", 2, "BLOCKS");
  push(0, "ENDSEC");

  push(0, "SECTION", 2, "ENTITIES");
  for (const e of entities) {
    if (e.kind === "poly") {
      push(0, "POLYLINE", 8, e.layer, 66, 1, 70, e.closed ? 1 : 0, 10, "0.0", 20, "0.0", 30, "0.0");
      for (const p of e.points) {
        push(0, "VERTEX", 8, e.layer, 10, n(p.x), 20, n(p.y), 30, "0.0");
      }
      push(0, "SEQEND", 8, e.layer);
    } else if (e.kind === "line") {
      push(
        0, "LINE",
        8, e.layer,
        10, n(e.a.x), 20, n(e.a.y), 30, "0.0",
        11, n(e.b.x), 21, n(e.b.y), 31, "0.0"
      );
    } else {
      push(
        0, "TEXT",
        8, e.layer,
        10, n(e.p.x), 20, n(e.p.y), 30, "0.0",
        40, n(e.height, 3),
        1, e.text,
        50, n(e.rotation ?? 0, 3),
        7, "STANDARD",
        72, 1,
        11, n(e.p.x), 21, n(e.p.y), 31, "0.0",
        73, 2
      );
    }
  }
  push(0, "ENDSEC");
  push(0, "EOF");
  return lines.join("\r\n") + "\r\n";
}

function safeFileBase(parcelNumber?: string | null) {
  const parcelBit = parcelNumber?.trim() ? `-${parcelNumber.trim()}` : "";
  return `alshantaf-parcel${parcelBit}`.replace(/[^\w.\-]+/g, "_");
}

/** Download English geometry DXF (opens in AutoCAD). Binary DWG is not generated client-side. */
export function downloadParcelCadDxf(input: ParcelCadExportInput, fileName?: string) {
  const dxf = buildParcelCadDxf(input);
  const name = (fileName || `${safeFileBase(input.parcelNumber)}.dxf`).replace(/[^\w.\-]+/g, "_");
  const blob = new Blob([dxf], { type: "application/octet-stream" });
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

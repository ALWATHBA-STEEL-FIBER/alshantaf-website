import type { Coords } from "@/lib/mapCoords";
import {
  formatDlsArea,
  formatMeters,
  ringAreaSqm,
  ringEdgeDimensions,
  ringPerimeterMeters,
  toLocalEnu,
} from "@/lib/mapCoords";
import type { MeasureSnapshot, MeasureThread } from "@/lib/measureDraw";

export type ParcelCadExportInput = {
  ring: [number, number][];
  lang: "ar" | "en";
  parcelNumber?: string | null;
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

/** Escape DXF text control characters. */
function dxfText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\P");
}

/**
 * Minimal AutoCAD-compatible ASCII DXF (AC1015 / R2000).
 * True binary DWG is proprietary — DXF opens directly in AutoCAD / Civil 3D / LibreCAD.
 * Drawing is plan-view metres in local ENU (X=East, Y=North), no imagery.
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
    input.areaSqm != null && input.areaSqm > 0
      ? input.areaSqm
      : ringAreaSqm(input.ring);
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

  // HEADER
  push(0, "SECTION", 2, "HEADER");
  push(9, "$ACADVER", 1, "AC1015");
  push(9, "$INSUNITS", 70, 6); // metres
  push(9, "$MEASUREMENT", 70, 1); // metric
  push(9, "$LUNITS", 70, 2);
  push(9, "$LUPREC", 70, 3);
  push(9, "$AUNITS", 70, 0);
  push(9, "$AUPREC", 70, 2);
  // Approximate extents
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
  push(9, "$EXTMAX", 10, n(maxX + 5), 20, n(maxY + 12), 30, 0);
  push(0, "ENDSEC");

  // TABLES — layers
  push(0, "SECTION", 2, "TABLES");
  push(0, "TABLE", 2, "LTYPE", 70, 1);
  push(0, "LTYPE", 2, "CONTINUOUS", 70, 0, 3, "Solid line", 72, 65, 73, 0, 40, 0);
  push(0, "ENDTAB");
  push(0, "TABLE", 2, "LAYER", 70, 5);
  const layer = (name: string, color: number) => {
    push(0, "LAYER", 2, name, 70, 0, 62, color, 6, "CONTINUOUS");
  };
  layer("0", 7);
  layer("PARCEL", 3); // green
  layer("DIMS", 1); // red
  layer("MEASURE", 5); // blue
  layer("TEXT", 7); // white/black
  push(0, "ENDTAB");
  push(0, "TABLE", 2, "STYLE", 70, 1);
  push(0, "STYLE", 2, "STANDARD", 70, 0, 40, 0, 41, 1, 50, 0, 71, 0, 42, 1, 3, "txt", 4, "");
  push(0, "ENDTAB");
  push(0, "ENDSEC");

  // BLOCKS (empty required section)
  push(0, "SECTION", 2, "BLOCKS");
  push(0, "ENDSEC");

  // ENTITIES
  push(0, "SECTION", 2, "ENTITIES");

  // Parcel outline
  push(0, "LWPOLYLINE", 8, "PARCEL", 90, ringXy.length, 70, 1, 43, 0);
  for (const p of ringXy) {
    push(10, n(p.x), 20, n(p.y));
  }

  // Edge dimensions — offset parallel dimension line + ticks + length text
  const dimOffset = Math.max(2, Math.min(8, (maxX - minX + maxY - minY) * 0.03));
  const textH = Math.max(0.6, Math.min(2.2, dimOffset * 0.35));

  for (const edge of edges) {
    const a = toXy(edge.start);
    const b = toXy(edge.end);
    grow(a);
    grow(b);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // outward normal (approx: away from origin/centroid at 0,0)
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
    // extension ticks from edge toward dim line
    push(0, "LINE", 8, "DIMS", 10, n(a.x), 20, n(a.y), 11, n(a2.x), 21, n(a2.y));
    push(0, "LINE", 8, "DIMS", 10, n(b.x), 20, n(b.y), 11, n(b2.x), 21, n(b2.y));
    // dimension line
    push(0, "LINE", 8, "DIMS", 10, n(a2.x), 20, n(a2.y), 11, n(b2.x), 21, n(b2.y));
    // length label
    const label = formatMeters(edge.lengthM, input.lang);
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    let rot = ang;
    if (rot > 90) rot -= 180;
    if (rot < -90) rot += 180;
    const tx = midX + nx * (dimOffset + textH * 0.35);
    const ty = midY + ny * (dimOffset + textH * 0.35);
    push(
      0,
      "TEXT",
      8,
      "DIMS",
      10,
      n(tx),
      20,
      n(ty),
      40,
      n(textH, 3),
      1,
      dxfText(label),
      50,
      n(rot, 3),
      72,
      1,
      11,
      n(tx),
      21,
      n(ty)
    );
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
    // Segment length labels
    for (let i = 0; i < xy.length - 1; i++) {
      const p0 = xy[i]!;
      const p1 = xy[i + 1]!;
      const seg = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      if (seg < 0.05) continue;
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      let rot = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
      if (rot > 90) rot -= 180;
      if (rot < -90) rot += 180;
      push(
        0,
        "TEXT",
        8,
        layerName,
        10,
        n(mx),
        20,
        n(my + textH * 0.4),
        40,
        n(textH * 0.85, 3),
        1,
        dxfText(formatMeters(seg, input.lang)),
        50,
        n(rot, 3),
        72,
        1,
        11,
        n(mx),
        21,
        n(my + textH * 0.4)
      );
    }
    if (thread.kind === "area" && thread.areaSqm != null && thread.areaSqm > 0) {
      let cx = 0;
      let cy = 0;
      for (const p of xy) {
        cx += p.x;
        cy += p.y;
      }
      cx /= xy.length;
      cy /= xy.length;
      push(
        0,
        "TEXT",
        8,
        layerName,
        10,
        n(cx),
        20,
        n(cy),
        40,
        n(textH * 1.1, 3),
        1,
        dxfText(formatDlsArea(thread.areaSqm, input.lang)),
        72,
        1,
        11,
        n(cx),
        21,
        n(cy)
      );
    } else if (thread.kind === "distance" && thread.lengthM > 0) {
      const last = xy[xy.length - 1]!;
      push(
        0,
        "TEXT",
        8,
        layerName,
        10,
        n(last.x),
        20,
        n(last.y + textH),
        40,
        n(textH, 3),
        1,
        dxfText(`Σ ${formatMeters(thread.lengthM, input.lang)}`),
        72,
        0
      );
    }
  };

  const measure = input.measure;
  if (measure) {
    for (const t of measure.threads) writeThread(t);
    // Active draft
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

  // Title / notes (above parcel)
  const titleY = maxY + dimOffset + textH * 3;
  const titleX = (minX + maxX) / 2;
  const parcelBit = input.parcelNumber?.trim() || "";
  const title =
    input.lang === "ar"
      ? `قطعة${parcelBit ? ` ${parcelBit}` : ""} — مخطط أبعاد (أوتوكاد)`
      : `Parcel${parcelBit ? ` ${parcelBit}` : ""} — dimension drawing (AutoCAD)`;
  push(
    0,
    "TEXT",
    8,
    "TEXT",
    10,
    n(titleX),
    20,
    n(titleY),
    40,
    n(textH * 1.4, 3),
    1,
    dxfText(title),
    72,
    1,
    11,
    n(titleX),
    21,
    n(titleY)
  );

  const metaLines = [
    input.lang === "ar"
      ? `المساحة: ${formatDlsArea(area, "ar")} · المحيط: ${formatMeters(peri, "ar")}`
      : `Area: ${formatDlsArea(area, "en")} · Perimeter: ${formatMeters(peri, "en")}`,
    input.lang === "ar"
      ? "وحدات: متر · محور X شرق / Y شمال · أصل محلي عند مركز القطعة — بلا صورة قمر صناعي"
      : "Units: metres · X=East / Y=North · local origin at parcel centroid — no satellite imagery",
    input.lang === "ar"
      ? `مرجع WGS84 للمركز: ${origin.lat.toFixed(6)}, ${origin.lng.toFixed(6)}`
      : `WGS84 centroid ref: ${origin.lat.toFixed(6)}, ${origin.lng.toFixed(6)}`,
    input.lang === "ar"
      ? "إرشادي — أكّد القياسات بمسح مساحي رسمي قبل التنفيذ"
      : "Advisory — confirm with an official survey before construction",
  ];
  metaLines.forEach((line, i) => {
    push(
      0,
      "TEXT",
      8,
      "TEXT",
      10,
      n(titleX),
      20,
      n(titleY - textH * 1.8 * (i + 1)),
      40,
      n(textH * 0.85, 3),
      1,
      dxfText(line),
      72,
      1,
      11,
      n(titleX),
      21,
      n(titleY - textH * 1.8 * (i + 1))
    );
  });

  push(0, "ENDSEC");
  push(0, "EOF");
  return lines.join("\n") + "\n";
}

export function downloadParcelCadDxf(input: ParcelCadExportInput, fileName?: string) {
  const dxf = buildParcelCadDxf(input);
  const parcelBit = input.parcelNumber?.trim() ? `-${input.parcelNumber.trim()}` : "";
  const name = (fileName || `alshantaf-parcel${parcelBit}.dxf`).replace(/[^\w.\-]+/g, "_");
  const blob = new Blob([dxf], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

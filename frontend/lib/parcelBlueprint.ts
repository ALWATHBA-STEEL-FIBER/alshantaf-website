import {
  contourBandsForRelief,
  contourSegments,
  elevRangeInsidePoly,
  evenSpreadContourLevels,
  pointInPoly,
  smoothElevGrid,
} from "@/lib/elevationContours";
import {
  formatMeters,
  fromLocalEnu,
  ringEdgeDimensions,
  ringOrientedFrame,
  toLocalEnu,
  type EnuPoint,
} from "@/lib/mapCoords";

export type BlueprintMeta = {
  lang: "ar" | "en";
  brandName: string;
  sheetTitle: string;
  topViewLabel: string;
  sideViewLabel: string;
  paramsLabel: string;
  elevRangeLabel: string;
  contourStepLabel: string;
  approxNote: string;
  footerNote: string;
  governorate?: string;
  directorate?: string;
  village?: string;
  basin?: string;
  neighborhood?: string;
  parcel?: string;
  address?: string;
  coordinates?: string;
  areaLabel?: string | null;
  areaSqm?: number | null;
  perimeterM?: number | null;
  lengthM?: number | null;
  widthM?: number | null;
  notes?: string;
  industryLabel?: string;
  industryValue?: string;
  /** Shown next to zoning — discloses user-chosen classification. */
  industryUserChoseNote?: string;
  notesLabel?: string;
  labels: {
    governorate: string;
    directorate: string;
    village: string;
    basin: string;
    neighborhood: string;
    parcel: string;
    address: string;
    coordinates: string;
    area: string;
    perimeter: string;
    extent: string;
  };
};

export type ElevGridSnapshot = {
  cols: number;
  rows: number;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  elevations: number[];
};

function fmtElev(m: number, lang: "ar" | "en") {
  const n = Math.round(m);
  return lang === "ar" ? `${n} م` : `${n} m`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      // Windows Chrome/Edge can fire onload before decode finishes
      if (typeof img.decode === "function") {
        img.decode().then(() => resolve(img)).catch(() => resolve(img));
      } else {
        resolve(img);
      }
    };
    img.onerror = () => reject(new Error("image-load"));
    img.src = src;
  });
}

function delay(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}

type ImageryBox = { minLat: number; maxLat: number; minLng: number; maxLng: number };

function parseImageryBBox(header: string | null, fallback: ImageryBox): ImageryBox {
  if (!header) return fallback;
  const parts = header.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return fallback;
  const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
  if (maxLat <= minLat || maxLng <= minLng) return fallback;
  return { minLat, maxLat, minLng, maxLng };
}

function clampImageryBox(box: ImageryBox, maxSpan = 0.075): ImageryBox {
  const latC = (box.minLat + box.maxLat) / 2;
  const lngC = (box.minLng + box.maxLng) / 2;
  const latHalf = Math.min((box.maxLat - box.minLat) / 2, maxSpan / 2);
  const lngHalf = Math.min((box.maxLng - box.minLng) / 2, maxSpan / 2);
  return {
    minLat: latC - latHalf,
    maxLat: latC + latHalf,
    minLng: lngC - lngHalf,
    maxLng: lngC + lngHalf,
  };
}

/**
 * Fetch satellite PNG via same-origin proxy and fully decode before return.
 * Retries — Windows browsers often race decode / transient 503s.
 */
async function fetchSatelliteBitmap(
  box: ImageryBox,
  attempts = 3
): Promise<{ source: CanvasImageSource; width: number; height: number; bbox: ImageryBox }> {
  const safeBox = clampImageryBox(box, 0.075);
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const qs = new URLSearchParams({
        minLat: String(safeBox.minLat),
        maxLat: String(safeBox.maxLat),
        minLng: String(safeBox.minLng),
        maxLng: String(safeBox.maxLng),
      });
      const res = await fetch(`/api/location/satellite-preview?${qs.toString()}`, {
        credentials: "same-origin",
        cache: "no-cache",
        headers: { Accept: "image/png,image/*" },
      });
      if (!res.ok) throw new Error(`sat-http-${res.status}`);
      const bbox = parseImageryBBox(res.headers.get("X-Imagery-BBox"), paddedFallback(safeBox));
      const blob = await res.blob();
      if (!blob || blob.size < 256) throw new Error("sat-empty");

      if (typeof createImageBitmap === "function") {
        const bitmap = await createImageBitmap(blob);
        if (!bitmap.width || !bitmap.height) {
          bitmap.close?.();
          throw new Error("sat-decode");
        }
        return { source: bitmap, width: bitmap.width, height: bitmap.height, bbox };
      }

      const objectUrl = URL.createObjectURL(blob);
      try {
        const img = await loadImage(objectUrl);
        if (!img.naturalWidth || !img.naturalHeight) throw new Error("sat-decode");
        return { source: img, width: img.naturalWidth, height: img.naturalHeight, bbox };
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) {
      lastErr = err;
      await delay(280 * (i + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("satellite-unavailable");
}

function paddedFallback(box: ImageryBox): ImageryBox {
  const latSpan = box.maxLat - box.minLat;
  const lngSpan = box.maxLng - box.minLng;
  const padLat = Math.max(latSpan * 0.12, 0.00008);
  const padLng = Math.max(lngSpan * 0.12, 0.00008);
  return {
    minLat: box.minLat - padLat,
    maxLat: box.maxLat + padLat,
    minLng: box.minLng - padLng,
    maxLng: box.maxLng + padLng,
  };
}

type ParcelFrame = {
  origin: { lat: number; lng: number };
  enu: EnuPoint[];
  angle: number;
  lengthM: number;
  widthM: number;
  /** Rotate ENU → parcel frame (length along +X). */
  toParcel: (p: EnuPoint) => EnuPoint;
  /** Rotate parcel frame → ENU. */
  toEnu: (p: EnuPoint) => EnuPoint;
};

function buildFrame(ring: [number, number][]): ParcelFrame | null {
  const raw = ringOrientedFrame(ring);
  if (!raw) return null;
  const c = Math.cos(-raw.angle);
  const s = Math.sin(-raw.angle);
  const toParcel = (p: EnuPoint) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });
  const ic = Math.cos(raw.angle);
  const is = Math.sin(raw.angle);
  const toEnu = (p: EnuPoint) => ({ x: p.x * ic - p.y * is, y: p.x * is + p.y * ic });
  return { ...raw, toParcel, toEnu };
}

function parcelBounds(frame: ParcelFrame, padRatio: number) {
  const pts = frame.enu.map(frame.toParcel);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const pad = span * padRatio + 4;
  return {
    minX: minX - pad,
    maxX: maxX + pad,
    minY: minY - pad,
    maxY: maxY + pad,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    spanX: maxX - minX + pad * 2,
    spanY: maxY - minY + pad * 2,
    parcelPts: pts,
  };
}

function latLngBBoxForParcelFrame(frame: ParcelFrame, bounds: ReturnType<typeof parcelBounds>) {
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ].map((p) => {
    const enu = frame.toEnu(p);
    return fromLocalEnu(enu.x, enu.y, frame.origin.lat, frame.origin.lng);
  });
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const c of corners) {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

function drawNorthRose(
  ctx: CanvasRenderingContext2D,
  frame: ParcelFrame,
  lang: "ar" | "en",
  toPx: (u: number, v: number) => { x: number; y: number },
  bounds: ReturnType<typeof parcelBounds>
) {
  // Place rose near top-start of the view in parcel frame
  const anchor = { x: bounds.minX + bounds.spanX * 0.08, y: bounds.maxY - bounds.spanY * 0.1 };
  const base = toPx(anchor.x, anchor.y);
  // North unit in ENU is (0,1) → parcel frame
  const nParcel = frame.toParcel({ x: 0, y: 1 });
  const len = Math.hypot(nParcel.x, nParcel.y) || 1;
  const tipParcel = {
    x: anchor.x + (nParcel.x / len) * (bounds.spanX * 0.07),
    y: anchor.y + (nParcel.y / len) * (bounds.spanY * 0.07),
  };
  const tip = toPx(tipParcel.x, tipParcel.y);
  ctx.strokeStyle = "#e8c98a";
  ctx.fillStyle = "#e8c98a";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  const ang = Math.atan2(tip.y - base.y, tip.x - base.x);
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - Math.cos(ang - 0.4) * 12, tip.y - Math.sin(ang - 0.4) * 12);
  ctx.lineTo(tip.x - Math.cos(ang + 0.4) * 12, tip.y - Math.sin(ang + 0.4) * 12);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 18px "IBM Plex Sans Arabic",system-ui,sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(lang === "ar" ? "ش" : "N", tip.x, tip.y - 10);
}

/**
 * Parcel-aligned context map: satellite surroundings + boundary + edge dimensions + north.
 */
export async function drawParcelContextMap(opts: {
  ring: [number, number][];
  lang: "ar" | "en";
  perimeterM?: number | null;
  width?: number;
  height?: number;
  /** When satellite API fails — JPEG/PNG of the already-loaded Leaflet map. */
  mapSnapshot?: string | null;
}): Promise<HTMLCanvasElement> {
  const W = opts.width ?? 1400;
  const H = opts.height ?? 1400;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0a1f1c";
  ctx.fillRect(0, 0, W, H);

  const frame = buildFrame(opts.ring);
  if (!frame) return canvas;
  // Smaller pad on large parcels so satellite bbox stays under API limits
  const roughSpan = Math.max(frame.lengthM, frame.widthM);
  const padRatio = roughSpan > 400 ? 0.12 : roughSpan > 180 ? 0.18 : 0.26;
  const bounds = parcelBounds(frame, padRatio);
  const scale = Math.min(W, H) / Math.max(bounds.spanX, bounds.spanY);
  const ox = W / 2;
  const oy = H / 2;
  const toPx = (u: number, v: number) => ({
    x: ox + (u - bounds.cx) * scale,
    y: oy - (v - bounds.cy) * scale,
  });

  // Satellite backdrop — soft-fallback if Esri/proxy is down (don't block print).
  const box = latLngBBoxForParcelFrame(frame, bounds);
  let satOk = false;
  try {
    const sat = await fetchSatelliteBitmap(box);
    const imgBox = sat.bbox;
    const cornerParcel = [
      toLocalEnu(imgBox.maxLat, imgBox.minLng, frame.origin.lat, frame.origin.lng),
      toLocalEnu(imgBox.maxLat, imgBox.maxLng, frame.origin.lat, frame.origin.lng),
      toLocalEnu(imgBox.minLat, imgBox.maxLng, frame.origin.lat, frame.origin.lng),
      toLocalEnu(imgBox.minLat, imgBox.minLng, frame.origin.lat, frame.origin.lng),
    ].map(frame.toParcel);
    const dest = cornerParcel.map((p) => toPx(p.x, p.y));
    const sw = sat.width;
    const sh = sat.height;
    const src = [
      { x: 0, y: 0 },
      { x: sw, y: 0 },
      { x: sw, y: sh },
      { x: 0, y: sh },
    ];
    ctx.save();
    drawTexturedTri(ctx, sat.source, dest[0]!, dest[1]!, dest[2]!, src[0]!, src[1]!, src[2]!);
    drawTexturedTri(ctx, sat.source, dest[0]!, dest[2]!, dest[3]!, src[0]!, src[2]!, src[3]!);
    ctx.restore();
    if (typeof ImageBitmap !== "undefined" && sat.source instanceof ImageBitmap) {
      sat.source.close();
    }
    satOk = true;
  } catch {
    // Prefer the already-loaded Leaflet map (satellite tiles on screen) over empty grid
    let usedMap = false;
    if (opts.mapSnapshot) {
      try {
        const snap = await loadImage(opts.mapSnapshot);
        const iw = snap.naturalWidth || snap.width;
        const ih = snap.naturalHeight || snap.height;
        if (iw > 0 && ih > 0) {
          const cover = Math.max(W / iw, H / ih);
          const dw = iw * cover;
          const dh = ih * cover;
          ctx.drawImage(snap, (W - dw) / 2, (H - dh) / 2, dw, dh);
          usedMap = true;
          satOk = true;
        }
      } catch {
        usedMap = false;
      }
    }
    if (!usedMap) {
      ctx.fillStyle = "#143d37";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(200,154,88,0.2)";
      ctx.lineWidth = 1;
      for (let i = 0; i < W; i += 48) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, H);
        ctx.stroke();
      }
      for (let j = 0; j < H; j += 48) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(W, j);
        ctx.stroke();
      }
    }
  }

  // Dim surroundings slightly so parcel pops
  ctx.fillStyle = satOk ? "rgba(7,24,22,0.18)" : "rgba(7,24,22,0.08)";
  ctx.fillRect(0, 0, W, H);

  // Parcel fill + outline
  ctx.beginPath();
  bounds.parcelPts.forEach((p, i) => {
    const q = toPx(p.x, p.y);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(200,154,88,0.22)";
  ctx.fill();
  ctx.strokeStyle = "#e8c98a";
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Edge dimensions (scaled to official perimeter when close)
  const edges = ringEdgeDimensions(opts.ring);
  const sum = edges.reduce((s, e) => s + e.lengthM, 0);
  const scaleLen =
    opts.perimeterM != null &&
    opts.perimeterM > 0 &&
    sum > 0 &&
    Math.abs(opts.perimeterM - sum) / opts.perimeterM <= 0.05
      ? opts.perimeterM / sum
      : 1;
  for (const edge of edges) {
    const midEnu = toLocalEnu(edge.label.lat, edge.label.lng, frame.origin.lat, frame.origin.lng);
    const mid = frame.toParcel(midEnu);
    const q = toPx(mid.x, mid.y);
    const text = formatMeters(edge.lengthM * scaleLen, opts.lang);
    ctx.font = 'bold 28px "IBM Plex Sans Arabic",system-ui,sans-serif';
    const tw = ctx.measureText(text).width;
    const boxH = 34;
    ctx.fillStyle = "rgba(15,52,47,0.94)";
    ctx.strokeStyle = "#c89a58";
    ctx.lineWidth = 2;
    ctx.fillRect(q.x - tw / 2 - 10, q.y - boxH / 2, tw + 20, boxH);
    ctx.strokeRect(q.x - tw / 2 - 10, q.y - boxH / 2, tw + 20, boxH);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, q.x, q.y);
  }

  drawNorthRose(ctx, frame, opts.lang, toPx, bounds);
  return canvas;
}

/**
 * Same parcel-aligned frame as the context map, but contour levels instead of dimensions.
 */
export function drawParcelContourMap(opts: {
  grid: ElevGridSnapshot;
  ring: [number, number][];
  lang: "ar" | "en";
  width?: number;
  height?: number;
}): HTMLCanvasElement {
  const W = opts.width ?? 1400;
  const H = opts.height ?? 1400;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#071816";
  ctx.fillRect(0, 0, W, H);

  const frame = buildFrame(opts.ring);
  if (!frame) return canvas;
  const bounds = parcelBounds(frame, 0.12);
  const scale = Math.min(W, H) / Math.max(bounds.spanX, bounds.spanY);
  const ox = W / 2;
  const oy = H / 2;
  const toPx = (u: number, v: number) => ({
    x: ox + (u - bounds.cx) * scale,
    y: oy - (v - bounds.cy) * scale,
  });

  const elev = smoothElevGrid(Float32Array.from(opts.grid.elevations), opts.grid.cols, opts.grid.rows, 3);
  const { cols, rows, minLat, maxLat, minLng, maxLng } = opts.grid;
  const poly = frame.enu;
  const { min: zMin, max: zMax } = elevRangeInsidePoly(
    elev,
    cols,
    rows,
    (c, r) => {
      const lat = maxLat - ((r + 0.5) / rows) * (maxLat - minLat);
      const lng = minLng + ((c + 0.5) / cols) * (maxLng - minLng);
      return toLocalEnu(lat, lng, frame.origin.lat, frame.origin.lng);
    },
    poly
  );
  const relief = Math.max(0.05, zMax - zMin);
  const bands = contourBandsForRelief(relief);
  const { levels, interval } = evenSpreadContourLevels(zMin, zMax, bands);
  const majorEvery = Math.max(1, Math.round(bands / 4));

  const gridToParcel = (gx: number, gy: number) => {
    const lat = maxLat - (gy / Math.max(1, rows - 1)) * (maxLat - minLat);
    const lng = minLng + (gx / Math.max(1, cols - 1)) * (maxLng - minLng);
    const enu = toLocalEnu(lat, lng, frame.origin.lat, frame.origin.lng);
    return frame.toParcel(enu);
  };

  for (const level of levels) {
    const layerIndex = Math.round((level - zMin) / interval);
    const major = layerIndex % majorEvery === 0;
    const segs = contourSegments(elev, cols, rows, level);
    ctx.strokeStyle = major ? "rgba(232,201,138,0.95)" : "rgba(200,154,88,0.7)";
    ctx.lineWidth = major ? 2.9 : 1.6;
    ctx.beginPath();
    let labelIn: { x: number; y: number } | null = null;
    let bestIn = 0;
    let labelAny: { x: number; y: number } | null = null;
    let bestAny = 0;
    for (const [x0, y0, x1, y1] of segs) {
      const a = gridToParcel(x0, y0);
      const b = gridToParcel(x1, y1);
      const midEnu = frame.toEnu({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const inside = pointInPoly(midEnu.x, midEnu.y, poly);
      // Still stroke segments that graze the parcel edge / nearby pad
      const pa = toPx(a.x, a.y);
      const pb = toPx(b.x, b.y);
      if (
        (pa.x >= -40 && pa.x <= W + 40 && pa.y >= -40 && pa.y <= H + 40) ||
        (pb.x >= -40 && pb.x <= W + 40 && pb.y >= -40 && pb.y <= H + 40)
      ) {
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
      }
      const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
      if (len > bestAny) {
        bestAny = len;
        labelAny = mid;
      }
      if (inside && len > bestIn) {
        bestIn = len;
        labelIn = mid;
      }
    }
    ctx.stroke();

    // Every contour level gets a meter label (prefer inside parcel)
    const labelAt = labelIn ?? labelAny;
    if (labelAt && segs.length > 0) {
      const text = fmtElev(level, opts.lang);
      ctx.font = `bold ${major ? 32 : 26}px "IBM Plex Sans Arabic",system-ui,sans-serif`;
      const tw = ctx.measureText(text).width;
      const boxH = major ? 38 : 32;
      const lx = Math.max(tw / 2 + 10, Math.min(W - tw / 2 - 10, labelAt.x));
      const ly = Math.max(boxH / 2 + 4, Math.min(H - boxH / 2 - 4, labelAt.y));
      ctx.fillStyle = "rgba(7,24,22,0.92)";
      ctx.fillRect(lx - tw / 2 - 8, ly - boxH / 2, tw + 16, boxH);
      ctx.strokeStyle = major ? "rgba(232,201,138,0.75)" : "rgba(200,154,88,0.5)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(lx - tw / 2 - 8, ly - boxH / 2, tw + 16, boxH);
      ctx.fillStyle = major ? "#e8c98a" : "#d4b07a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, lx, ly);
    }
  }

  ctx.beginPath();
  bounds.parcelPts.forEach((p, i) => {
    const q = toPx(p.x, p.y);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.closePath();
  ctx.strokeStyle = "#e8c98a";
  ctx.lineWidth = 4.2;
  ctx.stroke();

  // Approx. elevations badge on the contour sheet
  const elevText =
    opts.lang === "ar"
      ? `المناسيب التقريبية: ${fmtElev(zMin, "ar")} – ${fmtElev(zMax, "ar")}`
      : `Approx. elevations: ${fmtElev(zMin, "en")} – ${fmtElev(zMax, "en")}`;
  ctx.font = 'bold 28px "IBM Plex Sans Arabic",system-ui,sans-serif';
  const elevTw = ctx.measureText(elevText).width;
  const elevPadX = 16;
  const elevPadY = 12;
  const elevBoxW = elevTw + elevPadX * 2;
  const elevBoxH = 44;
  const elevX = 18;
  const elevY = H - elevBoxH - 18;
  ctx.fillStyle = "rgba(15,52,47,0.94)";
  ctx.fillRect(elevX, elevY, elevBoxW, elevBoxH);
  ctx.strokeStyle = "#c89a58";
  ctx.lineWidth = 2;
  ctx.strokeRect(elevX, elevY, elevBoxW, elevBoxH);
  ctx.fillStyle = "#e8c98a";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(elevText, elevX + elevPadX, elevY + elevBoxH / 2);

  drawNorthRose(ctx, frame, opts.lang, toPx, bounds);
  return canvas;
}

/** @deprecated kept for callers — prefer drawParcelContourMap */
export function drawParcelTopView(opts: {
  grid: ElevGridSnapshot;
  ring: [number, number][];
  lang: "ar" | "en";
  width?: number;
  height?: number;
}): HTMLCanvasElement {
  return drawParcelContourMap(opts);
}

function drawTexturedTri(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  u0: { x: number; y: number },
  u1: { x: number; y: number },
  u2: { x: number; y: number }
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.clip();
  const denom = u0.x * (u1.y - u2.y) - u1.x * (u0.y - u2.y) + u2.x * (u0.y - u1.y);
  if (Math.abs(denom) < 1e-6) {
    ctx.restore();
    return;
  }
  const m11 = (p0.x * (u1.y - u2.y) - p1.x * (u0.y - u2.y) + p2.x * (u0.y - u1.y)) / denom;
  const m12 = (p0.x * (u2.x - u1.x) - p1.x * (u2.x - u0.x) + p2.x * (u1.x - u0.x)) / denom;
  const m13 =
    (p0.x * (u1.x * u2.y - u2.x * u1.y) - p1.x * (u0.x * u2.y - u2.x * u0.y) + p2.x * (u0.x * u1.y - u1.x * u0.y)) /
    denom;
  const m21 = (p0.y * (u1.y - u2.y) - p1.y * (u0.y - u2.y) + p2.y * (u0.y - u1.y)) / denom;
  const m22 = (p0.y * (u2.x - u1.x) - p1.y * (u2.x - u0.x) + p2.y * (u1.x - u0.x)) / denom;
  const m23 =
    (p0.y * (u1.x * u2.y - u2.x * u1.y) - p1.y * (u0.x * u2.y - u2.x * u0.y) + p2.y * (u0.x * u1.y - u1.x * u0.y)) /
    denom;
  ctx.setTransform(m11, m21, m12, m22, m13, m23);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/** Load brand mark as solid white PNG (for dark green header). */
export async function loadWhiteLogoPngDataUrl(): Promise<string | null> {
  try {
    // Prefer PNG — webp mark can invert poorly on green headers
    let img: HTMLImageElement;
    try {
      img = await loadImage("/logo-mark.png");
    } catch {
      img = await loadImage("/logo-mark.webp");
    }
    const size = Math.max(img.naturalWidth || 256, 256);
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = "source-over";
    return c.toDataURL("image/png");
  } catch {
    return null;
  }
}

/** iOS/Android (and coarse phones) — iframe.print() prints the whole app page. */
function needsPageIsolationPrint(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1);
  const android = /Android/i.test(ua);
  if (iOS || android) return true;
  try {
    return window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 900;
  } catch {
    return false;
  }
}

function waitForElementImages(root: ParentNode, timeoutMs = 8000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  if (!imgs.length) return Promise.resolve();
  return new Promise((resolve) => {
    let left = imgs.length;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const one = () => {
      left -= 1;
      if (left <= 0) done();
    };
    for (const img of imgs) {
      if (img.complete && img.naturalWidth > 0) one();
      else {
        img.addEventListener("load", one, { once: true });
        img.addEventListener("error", one, { once: true });
      }
    }
    window.setTimeout(done, timeoutMs);
  });
}

/**
 * Mobile-safe print: inject the sheet into the current document, hide everything
 * else with @media print, then call window.print(). Hidden iframes print the
 * land-check form as a multi-page screenshot on iOS/Android.
 */
async function printViaPageIsolation(html: string): Promise<void> {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const prevId = "alshantaf-blueprint-print";
  const prevGate = "alshantaf-blueprint-print-gate";
  document.getElementById(prevId)?.remove();
  document.getElementById(prevGate)?.remove();

  const host = document.createElement("div");
  host.id = prevId;
  host.setAttribute("data-blueprint-print", "1");
  for (const node of Array.from(parsed.head.querySelectorAll("style"))) {
    host.appendChild(document.importNode(node, true));
  }
  for (const node of Array.from(parsed.body.childNodes)) {
    host.appendChild(document.importNode(node, true));
  }

  const gate = document.createElement("style");
  gate.id = prevGate;
  gate.textContent = `
    @media screen {
      #${prevId} {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        overflow: auto;
        background: #f3efe6;
        -webkit-overflow-scrolling: touch;
      }
    }
    @media print {
      @page { size: A4 portrait; margin: 0; }
      html, body {
        width: 210mm !important;
        height: 297mm !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        background: #f3efe6 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body.alshantaf-printing > *:not(#${prevId}) {
        display: none !important;
        height: 0 !important;
        overflow: hidden !important;
        visibility: hidden !important;
      }
      #${prevId} {
        display: block !important;
        position: static !important;
        inset: auto !important;
        width: 210mm !important;
        height: 297mm !important;
        max-height: 297mm !important;
        overflow: hidden !important;
        background: #f3efe6 !important;
        z-index: auto !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        visibility: visible !important;
      }
      #${prevId} * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        visibility: visible !important;
      }
    }
  `;

  document.head.appendChild(gate);
  document.body.appendChild(host);
  document.body.classList.add("alshantaf-printing");

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "alshantaf-print-close";
  closeBtn.textContent = parsed.documentElement.lang === "ar" ? "إغلاق المعاينة" : "Close preview";
  closeBtn.style.cssText =
    "position:fixed;top:10px;inset-inline-end:10px;z-index:2147483647;padding:10px 14px;border:0;border-radius:999px;background:#0f342f;color:#e8c98a;font:600 14px/1.2 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25)";
  document.body.appendChild(closeBtn);

  const cleanup = () => {
    if ((cleanup as { done?: boolean }).done) return;
    (cleanup as { done?: boolean }).done = true;
    document.body.classList.remove("alshantaf-printing");
    gate.remove();
    host.remove();
    closeBtn.remove();
    window.removeEventListener("afterprint", onAfter);
  };
  const onAfter = () => cleanup();
  closeBtn.addEventListener("click", cleanup);

  // Hide close control when actually printing
  gate.textContent += `
    @media print {
      .alshantaf-print-close { display: none !important; }
    }
  `;

  try {
    await waitForElementImages(host);
    await new Promise((r) => window.setTimeout(r, 200));
    window.addEventListener("afterprint", onAfter);
    window.focus();
    window.print();
    // Resolve immediately (print UI is async). Clean up after dialog closes or timeout.
    window.setTimeout(cleanup, 90_000);
  } catch (err) {
    cleanup();
    throw err instanceof Error ? err : new Error("print-failed");
  }
}

/**
 * Open a print-ready A4 landscape blueprint with proper Arabic typography.
 * Desktop: same-origin iframe. Mobile: page-isolation print (iframe prints the form).
 */
export async function printParcelBlueprint(opts: {
  meta: BlueprintMeta;
  /** Parcel-aligned context map (satellite + dimensions). */
  contextPng: string;
  /** Parcel-aligned contour map (topo levels). */
  contourPng: string;
  elevMinM: number;
  elevMaxM: number;
  contourIntervalM: number;
  targetWindow?: Window | null;
}): Promise<void> {
  const { meta } = opts;
  const rtl = meta.lang === "ar";
  const logo = await loadWhiteLogoPngDataUrl();

  const rows: Array<[string, string]> = [];
  const push = (label: string, value?: string | null) => {
    if (value && String(value).trim()) rows.push([label, String(value).trim()]);
  };
  push(meta.labels.governorate, meta.governorate);
  push(meta.labels.directorate, meta.directorate);
  push(meta.labels.village, meta.village);
  push(meta.labels.basin, meta.basin);
  push(meta.labels.neighborhood, meta.neighborhood);
  push(meta.labels.parcel, meta.parcel);
  push(meta.labels.address, meta.address);
  push(meta.labels.coordinates, meta.coordinates);
  push(meta.labels.area, meta.areaLabel || (meta.areaSqm != null ? `${meta.areaSqm} m²` : null));
  if (meta.perimeterM != null && meta.perimeterM > 0) {
    push(meta.labels.perimeter, formatMeters(meta.perimeterM, meta.lang));
  }
  if (meta.lengthM != null && meta.widthM != null) {
    push(
      meta.labels.extent,
      `${formatMeters(meta.lengthM, meta.lang)} × ${formatMeters(meta.widthM, meta.lang)}`
    );
  }
  push(meta.elevRangeLabel, `${fmtElev(opts.elevMinM, meta.lang)} – ${fmtElev(opts.elevMaxM, meta.lang)}`);
  push(meta.contourStepLabel, fmtElev(opts.contourIntervalM, meta.lang));
  if (meta.industryLabel && meta.industryValue) {
    const shortChose =
      meta.lang === "ar" ? "اختيار المستخدم (إرشادي)" : "User-selected (advisory)";
    const zoning = meta.industryUserChoseNote
      ? `${meta.industryValue} — ${shortChose}`
      : meta.industryValue;
    push(meta.industryLabel, zoning);
  }
  if (meta.notesLabel && meta.notes) push(meta.notesLabel, meta.notes);

  const paramsHtml = rows
    .map(
      ([label, value]) => `
      <div class="row">
        <div class="lab">${escapeHtml(label)}</div>
        <div class="val">${escapeHtml(value)}</div>
      </div>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="${meta.lang}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(meta.brandName)} — ${escapeHtml(meta.sheetTitle)}</title>
<style>
  /* System fonts only — no external stylesheets (CSP / offline print safe). */
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 210mm;
    height: 297mm;
    overflow: hidden;
    font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif;
    color: #142028;
    background: #f3efe6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    width: 210mm;
    height: 297mm;
    padding: 6mm;
    display: grid;
    grid-template-rows: 14mm minmax(0, 1.35fr) minmax(0, 1.2fr) 6mm;
    gap: 3mm;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 3mm;
    background: #0f342f;
    color: #fff;
    padding: 2mm 3.5mm;
    border-radius: 2mm;
    height: 14mm;
    overflow: hidden;
  }
  .header img {
    width: 10mm;
    height: 10mm;
    object-fit: contain;
    flex-shrink: 0;
    filter: none;
  }
  .header .brand { font-weight: 700; font-size: 12pt; color: #e8c98a; line-height: 1.15; }
  .header .sub { font-size: 8pt; color: rgba(255,255,255,0.94); margin-top: 0.4mm; }
  .top {
    display: grid;
    grid-template-columns: 78mm minmax(0, 1fr);
    gap: 3mm;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }
  .panel {
    background: #fff;
    border: 0.3mm solid rgba(200,154,88,0.45);
    border-radius: 2mm;
    padding: 2.2mm;
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    break-inside: avoid;
  }
  .panel h2 {
    margin: 0 0 1.2mm;
    font-size: 8pt;
    font-weight: 700;
    color: #0f342f;
    border-bottom: 0.25mm solid rgba(200,154,88,0.35);
    padding-bottom: 1mm;
    flex-shrink: 0;
  }
  .params {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 0;
  }
  .view-panel { background: #071816; }
  .view-panel h2 { color: #e8c98a; border-color: rgba(200,154,88,0.35); }
  .view-panel .frame {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .view-panel img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
  }
  .topo {
    min-height: 0;
    height: 100%;
  }
  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 2mm;
    margin: 0;
    padding: 0.55mm 0;
    border-bottom: 0.15mm solid rgba(20,32,40,0.08);
    flex-shrink: 0;
  }
  .lab {
    font-size: 6pt;
    font-weight: 700;
    color: #5d6b74;
    margin: 0;
    flex: 0 1 auto;
    line-height: 1.2;
  }
  .val {
    font-size: 7.5pt;
    font-weight: 600;
    color: #142028;
    line-height: 1.2;
    word-break: break-word;
    text-align: end;
    max-width: 62%;
  }
  .note {
    margin-top: 1mm;
    font-size: 5.5pt;
    color: #5d6b74;
    line-height: 1.3;
    padding-top: 1mm;
    border-top: 0.2mm dashed rgba(20,32,40,0.15);
    flex-shrink: 0;
  }
  .footer {
    font-size: 6pt;
    color: #5d6b74;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 6mm;
    overflow: hidden;
  }
  @media print {
    html, body, .sheet {
      width: 210mm !important;
      height: 297mm !important;
      max-height: 297mm !important;
      overflow: hidden !important;
      margin: 0 !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  }
</style>
</head>
<body>
  <div class="sheet">
    <header class="header">
      ${logo ? `<img src="${logo}" alt="" />` : ""}
      <div>
        <div class="brand">${escapeHtml(meta.brandName)}</div>
        <div class="sub">${escapeHtml(meta.sheetTitle)}</div>
      </div>
    </header>
    <div class="top">
      <section class="panel">
        <h2>${escapeHtml(meta.paramsLabel)}</h2>
        <div class="params">${paramsHtml}</div>
        <p class="note">${escapeHtml(meta.approxNote)}</p>
      </section>
      <section class="panel view-panel">
        <h2>${escapeHtml(meta.topViewLabel)}</h2>
        <div class="frame"><img src="${opts.contextPng}" alt="" /></div>
      </section>
    </div>
    <section class="panel view-panel topo">
      <h2>${escapeHtml(meta.sideViewLabel)}</h2>
      <div class="frame"><img src="${opts.contourPng}" alt="" /></div>
    </section>
    <footer class="footer">${escapeHtml(meta.footerNote)}</footer>
  </div>
</body>
</html>`;

  const printFrom = (win: Window) =>
    new Promise<void>((resolve, reject) => {
      try {
        win.document.open();
        win.document.write(html);
        win.document.close();
      } catch (err) {
        reject(err instanceof Error ? err : new Error("write-failed"));
        return;
      }

      let started = false;
      let printed = false;

      const runPrint = () => {
        if (printed) return;
        printed = true;
        try {
          win.focus();
          win.print();
          resolve();
        } catch (err) {
          reject(err instanceof Error ? err : new Error("print-failed"));
        }
      };

      const waitImages = () => {
        if (started) return;
        started = true;
        const imgs = Array.from(win.document.images);
        if (!imgs.length) {
          window.setTimeout(runPrint, 250);
          return;
        }
        let left = imgs.length;
        const doneOne = () => {
          left -= 1;
          if (left <= 0) window.setTimeout(runPrint, 300);
        };
        for (const img of imgs) {
          // naturalWidth > 0 means the bitmap actually decoded (Windows Edge/Chrome)
          if (img.complete && img.naturalWidth > 0) doneOne();
          else {
            img.addEventListener("load", doneOne, { once: true });
            img.addEventListener("error", doneOne, { once: true });
          }
        }
        window.setTimeout(runPrint, 8000);
      };

      const kick = () => {
        // No external font loading — print as soon as images are ready
        window.setTimeout(waitImages, 100);
      };

      if (win.document.readyState === "complete") kick();
      else win.addEventListener("load", kick, { once: true });
      window.setTimeout(kick, 600);
    });

  // Explicit target window (desktop popup path)
  if (opts.targetWindow && !opts.targetWindow.closed) {
    await printFrom(opts.targetWindow);
    return;
  }

  // Mobile: never use hidden iframe — it prints the whole land-check form.
  if (needsPageIsolationPrint()) {
    await printViaPageIsolation(html);
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(iframe);
  const frameWin = iframe.contentWindow;
  if (!frameWin) {
    iframe.remove();
    // Last resort
    await printViaPageIsolation(html);
    return;
  }
  try {
    await printFrom(frameWin);
  } finally {
    window.setTimeout(() => iframe.remove(), 60_000);
  }
}

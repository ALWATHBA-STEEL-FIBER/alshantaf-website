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
  formatSideMeters,
  fromLocalEnu,
  ringEdgeDimensions,
  ringInteriorCentroid,
  ringOrientedFrame,
  toLocalEnu,
  type EnuPoint,
} from "@/lib/mapCoords";

/** Official letterhead contacts / site line (LTR in footer). */
const BLUEPRINT_CONTACTS = [
  { name: "Eng. Ahmed Alshantaf", phone: "+962799996668" },
  { name: "Eng. Mohammad Alshantaf", phone: "+962799996660" },
] as const;
const BLUEPRINT_SITE_URL = "https://alshantaf.com";
const BLUEPRINT_LOCATION_EN = "Al-Qastal Industrial — in front of \u2066JTI\u2069 factory";
/** LRI/PDI keep the Latin brand "JTI" from jumping to the start in RTL. */
const BLUEPRINT_LOCATION_AR = "المنطقة الصناعية في القسطل — أمام مصنع \u2066JTI\u2069";
const BLUEPRINT_MOTTO_EN = "Specialized in industrial real estate for over 25 years";
const BLUEPRINT_MOTTO_AR = "متخصصون في العقارات الصناعية لأكثر من 25 عاماً";

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
  /** Optional extra rows for context-specific sheets (e.g. offer print). */
  extraRows?: Array<{
    label: string;
    value?: string | null;
  }>;
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

/** Keep ASCII parentheses from jumping to the start of RTL lines. */
function stabilizeRtlAsciiPunct(text: string): string {
  return text.replace(/\(([^)]*)\)/g, "\u2068($1)\u2069");
}

function escapeHtml(s: string) {
  return stabilizeRtlAsciiPunct(s)
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
  bounds: ReturnType<typeof parcelBounds>,
  color = "#111111"
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
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
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
  ring?: [number, number][];
  rings?: [number, number][][];
  lang: "ar" | "en";
  perimeterM?: number | null;
  width?: number;
  height?: number;
  /** Parcel number drawn at the land centroid. */
  parcelNumber?: string | null;
  /** When satellite API fails — JPEG/PNG of the already-loaded Leaflet map. */
  mapSnapshot?: string | null;
}): Promise<HTMLCanvasElement> {
  const W = opts.width ?? 1400;
  const H = opts.height ?? 1400;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const sourceRings =
    opts.rings && opts.rings.length
      ? opts.rings.filter((r) => r.length >= 3)
      : opts.ring && opts.ring.length >= 3
        ? [opts.ring]
        : [];
  const primaryRing = sourceRings[0];
  if (!primaryRing) return canvas;
  const frame = buildFrame(primaryRing);
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

  // Backdrop priority:
  // 1) exact live map snapshot (map/satellite + visible context), if provided
  // 2) satellite fetch
  // 3) neutral grid fallback
  let satOk = false;
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
  // Exact live-map print mode: do not redraw parcel/dimensions on top of the snapshot.
  // This avoids duplicate labels and guarantees the PDF map panel matches the current view.
  if (usedMap) {
    return canvas;
  }
  if (!usedMap) {
    const box = latLngBBoxForParcelFrame(frame, bounds);
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
  for (const ring of sourceRings) {
    const points = ring.map(([lat, lng]) =>
      frame.toParcel(toLocalEnu(lat, lng, frame.origin.lat, frame.origin.lng))
    );
    if (!points.length) continue;
    ctx.beginPath();
    points.forEach((p, i) => {
      const q = toPx(p.x, p.y);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(200,154,88,0.22)";
    ctx.fill();
    ctx.strokeStyle = "#e8c98a";
    ctx.lineWidth = 3.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    for (const p of points) {
      const q = toPx(p.x, p.y);
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 14);
      g.addColorStop(0, "rgba(200,160,100,0.9)");
      g.addColorStop(0.5, "rgba(200,160,100,0.35)");
      g.addColorStop(1, "rgba(200,160,100,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#caa064";
      ctx.beginPath();
      ctx.arc(q.x, q.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f5e6c8";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Edge dimensions — merged sides (curves counted as one total)
  for (const ring of sourceRings) {
    const edges = ringEdgeDimensions(ring);
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
      const text = formatSideMeters(edge.lengthM * scaleLen, opts.lang, edge.kind);
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
  }

  // Land number at geometric center of the parcel
  const parcelNo = opts.parcelNumber?.trim();
  if (parcelNo) {
    const center = ringInteriorCentroid(primaryRing);
    if (center) {
      const midEnu = toLocalEnu(center.lat, center.lng, frame.origin.lat, frame.origin.lng);
      const mid = frame.toParcel(midEnu);
      const q = toPx(mid.x, mid.y);
      ctx.save();
      ctx.font = '800 42px "IBM Plex Sans Arabic",system-ui,sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.strokeText(parcelNo, q.x, q.y);
      ctx.fillStyle = "#0f342f";
      ctx.fillText(parcelNo, q.x, q.y);
      ctx.restore();
    }
  }

  drawNorthRose(ctx, frame, opts.lang, toPx, bounds, "#0f342f");
  return canvas;
}

/**
 * Same parcel-aligned frame as the context map, but contour levels instead of dimensions.
 * Ink-friendly: white ground, black contour lines.
 */
export function drawParcelContourMap(opts: {
  grid: ElevGridSnapshot;
  ring?: [number, number][];
  rings?: [number, number][][];
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
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const sourceRings =
    opts.rings && opts.rings.length
      ? opts.rings.filter((r) => r.length >= 3)
      : opts.ring && opts.ring.length >= 3
        ? [opts.ring]
        : [];
  const primaryRing = sourceRings[0];
  if (!primaryRing) return canvas;
  const frame = buildFrame(primaryRing);
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
  const polys = sourceRings.map((ring) =>
    ring.map(([lat, lng]) => toLocalEnu(lat, lng, frame.origin.lat, frame.origin.lng))
  );
  const insideAny = (x: number, y: number) => polys.some((poly) => pointInPoly(x, y, poly));
  const { min: zMin, max: zMax } = elevRangeInsidePoly(
    elev,
    cols,
    rows,
    (c, r) => {
      const lat = maxLat - ((r + 0.5) / rows) * (maxLat - minLat);
      const lng = minLng + ((c + 0.5) / cols) * (maxLng - minLng);
      return toLocalEnu(lat, lng, frame.origin.lat, frame.origin.lng);
    },
    polys[0]!
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
    ctx.strokeStyle = major ? "#111111" : "rgba(20,20,20,0.55)";
    ctx.lineWidth = major ? 2.4 : 1.2;
    ctx.beginPath();
    let labelIn: { x: number; y: number } | null = null;
    let bestIn = 0;
    let labelAny: { x: number; y: number } | null = null;
    let bestAny = 0;
    for (const [x0, y0, x1, y1] of segs) {
      const a = gridToParcel(x0, y0);
      const b = gridToParcel(x1, y1);
      const midEnu = frame.toEnu({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const inside = insideAny(midEnu.x, midEnu.y);
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

    const labelAt = labelIn ?? labelAny;
    if (labelAt && segs.length > 0) {
      const text = fmtElev(level, opts.lang);
      ctx.font = `bold ${major ? 30 : 24}px "IBM Plex Sans Arabic",system-ui,sans-serif`;
      const tw = ctx.measureText(text).width;
      const boxH = major ? 36 : 30;
      const lx = Math.max(tw / 2 + 10, Math.min(W - tw / 2 - 10, labelAt.x));
      const ly = Math.max(boxH / 2 + 4, Math.min(H - boxH / 2 - 4, labelAt.y));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(lx - tw / 2 - 7, ly - boxH / 2, tw + 14, boxH);
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = major ? 1.6 : 1.1;
      ctx.strokeRect(lx - tw / 2 - 7, ly - boxH / 2, tw + 14, boxH);
      ctx.fillStyle = "#111111";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, lx, ly);
    }
  }

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3.6;
  for (const ring of sourceRings) {
    const points = ring.map(([lat, lng]) =>
      frame.toParcel(toLocalEnu(lat, lng, frame.origin.lat, frame.origin.lng))
    );
    ctx.beginPath();
    points.forEach((p, i) => {
      const q = toPx(p.x, p.y);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.stroke();
  }

  const elevText =
    opts.lang === "ar"
      ? `المناسيب التقريبية: ${fmtElev(zMin, "ar")} – ${fmtElev(zMax, "ar")}`
      : `Approx. elevations: ${fmtElev(zMin, "en")} – ${fmtElev(zMax, "en")}`;
  ctx.font = 'bold 26px "IBM Plex Sans Arabic",system-ui,sans-serif';
  const elevTw = ctx.measureText(elevText).width;
  const elevPadX = 14;
  const elevBoxW = elevTw + elevPadX * 2;
  const elevBoxH = 40;
  const elevX = 18;
  const elevY = H - elevBoxH - 18;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(elevX, elevY, elevBoxW, elevBoxH);
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(elevX, elevY, elevBoxW, elevBoxH);
  ctx.fillStyle = "#111111";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(elevText, elevX + elevPadX, elevY + elevBoxH / 2);

  drawNorthRose(ctx, frame, opts.lang, toPx, bounds, "#111111");
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

/** Load green brand favicon for the official letterhead (larger mark at top center). */
export async function loadPrintLogoPngDataUrl(): Promise<string | null> {
  try {
    let img: HTMLImageElement;
    try {
      img = await loadImage("/icon-192.png");
    } catch {
      try {
        img = await loadImage("/icon.png");
      } catch {
        img = await loadImage("/logo-mark.png");
      }
    }
    const size = Math.max(img.naturalWidth || 256, 256);
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    return c.toDataURL("image/png");
  } catch {
    return null;
  }
}

/** @deprecated Prefer loadPrintLogoPngDataUrl for ink-friendly sheets. */
export async function loadWhiteLogoPngDataUrl(): Promise<string | null> {
  return loadPrintLogoPngDataUrl();
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

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let cur = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const trial = `${cur} ${words[i]}`;
    if (ctx.measureText(trial).width <= maxWidth) cur = trial;
    else {
      lines.push(cur);
      cur = words[i]!;
    }
  }
  lines.push(cur);
  return lines;
}

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const iw = "naturalWidth" in img && (img as HTMLImageElement).naturalWidth
    ? (img as HTMLImageElement).naturalWidth
    : (img as HTMLCanvasElement).width;
  const ih = "naturalHeight" in img && (img as HTMLImageElement).naturalHeight
    ? (img as HTMLImageElement).naturalHeight
    : (img as HTMLCanvasElement).height;
  if (!iw || !ih) return;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawCoveredImage(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const iw = "naturalWidth" in img && (img as HTMLImageElement).naturalWidth
    ? (img as HTMLImageElement).naturalWidth
    : (img as HTMLCanvasElement).width;
  const ih = "naturalHeight" in img && (img as HTMLImageElement).naturalHeight
    ? (img as HTMLImageElement).naturalHeight
    : (img as HTMLCanvasElement).height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawPaperWatermark(ctx: CanvasRenderingContext2D, W: number, H: number, alpha = 0.08) {
  ctx.save();
  ctx.strokeStyle = `rgba(15,52,47,${alpha})`;
  ctx.fillStyle = `rgba(15,52,47,${alpha})`;
  ctx.lineWidth = 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '700 34px "Segoe UI", Arial, sans-serif';

  const drawMark = () => {
    // Minimal backgroundless emblem inspired by the brand mark.
    ctx.beginPath();
    ctx.moveTo(-48, -18);
    ctx.lineTo(-48, -48);
    ctx.lineTo(-36, -58);
    ctx.lineTo(-36, -18);
    ctx.moveTo(-24, -18);
    ctx.lineTo(-24, -56);
    ctx.lineTo(-12, -68);
    ctx.lineTo(-12, -18);
    ctx.moveTo(0, -18);
    ctx.lineTo(0, -48);
    ctx.lineTo(12, -58);
    ctx.lineTo(12, -18);
    ctx.moveTo(-56, -12);
    ctx.lineTo(20, -12);
    ctx.stroke();
    ctx.fillText("ALSHANTAF", -18, 30);
  };

  for (let y = -120; y < H + 180; y += 230) {
    for (let x = -120; x < W + 220; x += 290) {
      ctx.save();
      ctx.translate(x + 145, y + 115);
      ctx.rotate(-0.33);
      drawMark();
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * Flatten the letterhead to one A4 JPEG — the only reliable single-page print on iOS Safari
 * (WebKit often ignores overflow:hidden and paginates HTML onto a blank page 2).
 */
async function composeBlueprintA4Jpeg(opts: {
  lang: "ar" | "en";
  brandName: string;
  sheetTitle: string;
  motto: string;
  location: string;
  logoDataUrl: string | null;
  contextPng: string;
  contourPng: string;
  params: Array<[string, string]>;
  paramsLabel: string;
  topViewLabel: string;
  sideViewLabel: string;
  approxNote: string;
  footerNote: string;
}): Promise<string> {
  const W = 1240;
  const H = 1754;
  const GREEN = "#0f342f";
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const rtl = opts.lang === "ar";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Green page edge
  const edge = 18;
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = edge;
  ctx.strokeRect(edge / 2, edge / 2, W - edge, H - edge);

  const padX = 44;
  const padTop = 36;
  let y = padTop;

  // Header: motto | logo (plain ellipse) | title
  const logoW = 132;
  const logoH = 96;
  const headerH = 118;
  const colW = (W - padX * 2 - logoW - 48) / 2;
  const logoX = (W - logoW) / 2;
  const logoY = y + (headerH - logoH) / 2;

  ctx.fillStyle = "#222222";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  if (opts.lang === "ar") {
    const text = stabilizeRtlAsciiPunct(opts.motto);
    let size = 20;
    while (size >= 16) {
      ctx.font = `600 ${size}px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif`;
      if (ctx.measureText(text).width <= colW - 8) break;
      size -= 1;
    }
    ctx.fillText(text, padX, y + headerH / 2 + 2);
  } else {
    ctx.font = '600 20px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
    const mottoLines = wrapCanvasText(ctx, stabilizeRtlAsciiPunct(opts.motto), colW - 8);
    const mottoBlockH = Math.min(mottoLines.length, 4) * 24;
    const mottoStartY = y + (headerH - mottoBlockH) / 2;
    mottoLines.slice(0, 4).forEach((line, i) => {
      ctx.fillText(line, padX, mottoStartY + i * 24 + 10);
    });
  }

  if (opts.logoDataUrl) {
    try {
      const logo = await loadImage(opts.logoDataUrl);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(W / 2, logoY + logoH / 2, logoW / 2, logoH / 2, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logo, logoX, logoY, logoW, logoH);
      ctx.restore();
    } catch {
      /* skip logo */
    }
  }

  ctx.fillStyle = GREEN;
  ctx.font = '700 22px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = "right";
  const titleLines = wrapCanvasText(ctx, stabilizeRtlAsciiPunct(opts.sheetTitle), colW - 8);
  const titleBlockH = Math.min(titleLines.length, 3) * 26;
  const titleStartY = y + (headerH - titleBlockH) / 2;
  titleLines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, W - padX, titleStartY + i * 26 + 11, colW);
  });

  y += headerH;
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(logoX - 12, y);
  ctx.moveTo(logoX + logoW + 12, y);
  ctx.lineTo(W - padX, y);
  ctx.stroke();
  y += 16;

  // Top: params + context map
  const topH = 640;
  const paramsW = 400;
  const gap = 16;
  const mapW = W - padX * 2 - paramsW - gap;

  // Params panel
  ctx.strokeStyle = "#222222";
  ctx.lineWidth = 2;
  ctx.strokeRect(padX, y, paramsW, topH);
  ctx.fillStyle = "#111111";
  ctx.font = '800 24px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = rtl ? "right" : "left";
  ctx.textBaseline = "top";
  const paramsTitleX = rtl ? padX + paramsW - 14 : padX + 14;
  ctx.fillText(opts.paramsLabel, paramsTitleX, y + 12, paramsW - 28);
  ctx.strokeStyle = "#222222";
  ctx.beginPath();
  ctx.moveTo(padX + 12, y + 44);
  ctx.lineTo(padX + paramsW - 12, y + 44);
  ctx.stroke();

  let rowY = y + 54;
  ctx.font = '700 18px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
  for (const [lab, val] of opts.params) {
    if (rowY > y + topH - 90) break;
    ctx.fillStyle = "#444444";
    ctx.textAlign = rtl ? "right" : "left";
    ctx.fillText(stabilizeRtlAsciiPunct(lab), paramsTitleX, rowY, paramsW * 0.42);
    ctx.fillStyle = "#111111";
    ctx.font = '600 20px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = rtl ? "left" : "right";
    const valX = rtl ? padX + 14 : padX + paramsW - 14;
    ctx.fillText(stabilizeRtlAsciiPunct(val), valX, rowY, paramsW * 0.52);
    ctx.font = '700 18px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
    rowY += 28;
  }
  ctx.fillStyle = "#555555";
  ctx.font = '500 15px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = rtl ? "right" : "left";
  const noteLines = wrapCanvasText(ctx, stabilizeRtlAsciiPunct(opts.approxNote), paramsW - 28);
  let noteY = y + topH - 14 - noteLines.slice(0, 3).length * 18;
  noteLines.slice(0, 3).forEach((line) => {
    ctx.fillText(line, paramsTitleX, noteY, paramsW - 28);
    noteY += 18;
  });

  // Topography panel (swapped to top)
  const mapX = padX + paramsW + gap;
  ctx.strokeStyle = "#222222";
  ctx.lineWidth = 2;
  ctx.strokeRect(mapX, y, mapW, topH);
  ctx.fillStyle = "#111111";
  ctx.font = '800 24px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = rtl ? "right" : "left";
  const mapTitleX = rtl ? mapX + mapW - 14 : mapX + 14;
  ctx.fillText(opts.sideViewLabel, mapTitleX, y + 12, mapW - 28);
  ctx.strokeStyle = "#222222";
  ctx.beginPath();
  ctx.moveTo(mapX + 12, y + 44);
  ctx.lineTo(mapX + mapW - 12, y + 44);
  ctx.stroke();
  const framePad = 10;
  const frameX = mapX + framePad;
  const frameY = y + 52;
  const frameW = mapW - framePad * 2;
  const frameH = topH - 52 - framePad;
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 1;
  ctx.strokeRect(frameX, frameY, frameW, frameH);
  try {
    const mapImg = await loadImage(opts.contourPng);
    drawContainedImage(ctx, mapImg, frameX + 4, frameY + 4, frameW - 8, frameH - 8);
  } catch {
    /* skip */
  }

  y += topH + 16;

  // Map panel (swapped to bottom, fills frame)
  const footerReserve = 110;
  const topoH = H - y - footerReserve - edge - 12;
  ctx.strokeStyle = "#222222";
  ctx.lineWidth = 2;
  ctx.strokeRect(padX, y, W - padX * 2, topoH);
  ctx.fillStyle = "#111111";
  ctx.font = '800 24px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = rtl ? "right" : "left";
  const topoTitleX = rtl ? W - padX - 14 : padX + 14;
  ctx.fillText(opts.topViewLabel, topoTitleX, y + 12, W - padX * 2 - 28);
  ctx.strokeStyle = "#222222";
  ctx.beginPath();
  ctx.moveTo(padX + 12, y + 44);
  ctx.lineTo(W - padX - 12, y + 44);
  ctx.stroke();
  const tFrameX = padX + framePad;
  const tFrameY = y + 52;
  const tFrameW = W - padX * 2 - framePad * 2;
  const tFrameH = topoH - 52 - framePad;
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 1;
  ctx.strokeRect(tFrameX, tFrameY, tFrameW, tFrameH);
  try {
    const topoImg = await loadImage(opts.contextPng);
    drawContainedImage(ctx, topoImg, tFrameX + 4, tFrameY + 4, tFrameW - 8, tFrameH - 8);
  } catch {
    /* skip */
  }

  y += topoH + 12;

  // Footer bar — green background, white text
  const footTop = y;
  const footH = H - edge - footTop - 4;
  ctx.fillStyle = GREEN;
  ctx.fillRect(edge, footTop, W - edge * 2, footH);

  const footPadX = padX;
  const footY = footTop + 14;
  ctx.fillStyle = "#ffffff";
  ctx.font = '800 22px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(BLUEPRINT_SITE_URL, footPadX, footY);
  ctx.font = '600 16px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
  ctx.fillText(stabilizeRtlAsciiPunct(opts.location), footPadX, footY + 26, W * 0.42);
  ctx.font = '500 13px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
  const footNote = wrapCanvasText(ctx, stabilizeRtlAsciiPunct(opts.footerNote), W * 0.42);
  footNote.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, footPadX, footY + 48 + i * 15, W * 0.42);
  });

  const contactColW = 230;
  BLUEPRINT_CONTACTS.forEach((c, i) => {
    const cx = W - padX - (BLUEPRINT_CONTACTS.length - 1 - i) * (contactColW + 16);
    ctx.fillStyle = "#ffffff";
    ctx.font = '700 16px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = "right";
    ctx.fillText(c.name, cx, footY);
    ctx.font = '800 20px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
    ctx.fillText(c.phone, cx, footY + 24);
  });

  // Keep watermark on top in mobile-rendered sheet, but very subtle.
  drawPaperWatermark(ctx, W, H, 0.05);

  return canvas.toDataURL("image/jpeg", 0.92);
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function readJpegSize(bytes: Uint8Array): { w: number; h: number } {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1]!;
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const h = (bytes[i + 5]! << 8) | bytes[i + 6]!;
      const w = (bytes[i + 7]! << 8) | bytes[i + 8]!;
      return { w, h };
    }
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    i += 2 + len;
  }
  return { w: 1240, h: 1754 };
}

/** One-page A4 PDF wrapping a full-bleed JPEG (no deps — reliable on iOS). */
function jpegDataUrlToPdfBlob(jpegDataUrl: string): Blob {
  const jpeg = dataUrlToUint8Array(jpegDataUrl);
  const { w: imgW, h: imgH } = readJpegSize(jpeg);
  const pageW = 595.28; // A4 pt
  const pageH = 841.89;

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let pos = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? enc.encode(part) : part;
    chunks.push(bytes);
    pos += bytes.length;
  };
  const objStart = () => {
    offsets.push(pos);
  };

  push("%PDF-1.4\n");
  objStart();
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objStart();
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objStart();
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n`
  );
  const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  objStart();
  push(`4 0 obj\n<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);
  objStart();
  push(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
  );
  push(jpeg);
  push("\nendstream\nendobj\n");

  const xrefPos = pos;
  push(`xref\n0 ${offsets.length}\n`);
  push("0000000000 65535 f \n");
  for (let i = 1; i < offsets.length; i++) {
    push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  push(
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`
  );

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return new Blob([out], { type: "application/pdf" });
}

/**
 * Mobile: show a one-page PDF sheet popup with Download + Print.
 * Avoids Safari HTML print (blank page 2). Preview uses the JPEG; actions use the PDF.
 */
async function openMobilePdfPopup(opts: {
  pageJpeg: string;
  lang: "ar" | "en";
  fileName: string;
}): Promise<void> {
  const { pageJpeg, lang, fileName } = opts;
  const pdfBlob = jpegDataUrlToPdfBlob(pageJpeg);
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const prevId = "alshantaf-blueprint-pdf";
  document.getElementById(prevId)?.remove();

  const ar = lang === "ar";
  const t = {
    title: ar ? "مخطط القطعة (PDF)" : "Parcel blueprint (PDF)",
    note: ar ? "صفحة واحدة · مقاس A4" : "1 page · A4",
    download: ar ? "تنزيل PDF" : "Download PDF",
    print: ar ? "طباعة" : "Print",
    open: ar ? "فتح PDF" : "Open PDF",
    close: ar ? "إغلاق" : "Close",
  };

  const host = document.createElement("div");
  host.id = prevId;
  host.setAttribute("role", "dialog");
  host.setAttribute("aria-modal", "true");
  host.dir = ar ? "rtl" : "ltr";
  host.innerHTML = `
    <div class="abp-backdrop"></div>
    <div class="abp-sheet">
      <header class="abp-head">
        <div>
          <div class="abp-title">${escapeHtml(t.title)}</div>
          <div class="abp-note">${escapeHtml(t.note)}</div>
        </div>
        <button type="button" class="abp-x" aria-label="${escapeHtml(t.close)}">×</button>
      </header>
      <div class="abp-preview">
        <img src="${pageJpeg}" alt="" />
      </div>
      <footer class="abp-actions">
        <button type="button" class="abp-btn abp-primary" data-act="download">${escapeHtml(t.download)}</button>
        <button type="button" class="abp-btn" data-act="print">${escapeHtml(t.print)}</button>
        <button type="button" class="abp-btn" data-act="open">${escapeHtml(t.open)}</button>
      </footer>
    </div>
  `;

  const style = document.createElement("style");
  style.id = "alshantaf-blueprint-pdf-style";
  style.textContent = `
    #${prevId} {
      position: fixed; inset: 0; z-index: 2147483646;
      display: flex; align-items: stretch; justify-content: center;
      padding-top: max(12px, calc(env(safe-area-inset-top, 0px) + 14px));
      padding-bottom: max(8px, env(safe-area-inset-bottom, 0px));
      font-family: "IBM Plex Sans Arabic", "Segoe UI", system-ui, sans-serif;
    }
    #${prevId} .abp-backdrop {
      position: absolute; inset: 0; background: rgba(7,24,22,0.72);
    }
    #${prevId} .abp-sheet {
      position: relative; z-index: 1; margin: 0; width: 100%; max-width: 560px;
      background: #f7f4ee; display: flex; flex-direction: column;
      max-height: 100%; box-shadow: 0 24px 64px rgba(0,0,0,.35);
      border-radius: 14px;
      overflow: hidden;
    }
    @media (min-width: 600px) {
      #${prevId} { padding: 16px; align-items: center; }
      #${prevId} .abp-sheet { border-radius: 16px; max-height: min(920px, 100%); }
    }
    #${prevId} .abp-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px; padding: 18px 16px 14px; background: #0f342f; color: #fff;
    }
    #${prevId} .abp-title { font-weight: 800; font-size: 16px; color: #e8c98a; }
    #${prevId} .abp-note { font-size: 12px; color: rgba(255,255,255,.8); margin-top: 2px; }
    #${prevId} .abp-x {
      border: 0; background: transparent; color: #e8c98a; font-size: 28px;
      line-height: 1; width: 40px; height: 40px; border-radius: 999px; cursor: pointer;
    }
    #${prevId} .abp-preview {
      flex: 1; min-height: 0; overflow: auto; -webkit-overflow-scrolling: touch;
      padding: 12px; background: #e8e2d6;
    }
    #${prevId} .abp-preview img {
      display: block; width: 100%; height: auto; background: #fff;
      box-shadow: 0 8px 24px rgba(0,0,0,.18);
    }
    #${prevId} .abp-actions {
      display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
      background: #fff; border-top: 1px solid rgba(15,52,47,.12);
    }
    #${prevId} .abp-btn {
      border: 1px solid rgba(15,52,47,.25); background: #fff; color: #0f342f;
      font-weight: 700; font-size: 13px; padding: 12px 8px; border-radius: 999px; cursor: pointer;
    }
    #${prevId} .abp-btn.abp-primary {
      background: #0f342f; color: #e8c98a; border-color: #0f342f;
    }
  `;

  const cleanup = () => {
    if ((cleanup as { done?: boolean }).done) return;
    (cleanup as { done?: boolean }).done = true;
    style.remove();
    host.remove();
    URL.revokeObjectURL(pdfUrl);
  };

  document.head.appendChild(style);
  document.body.appendChild(host);

  host.querySelector(".abp-backdrop")?.addEventListener("click", cleanup);
  host.querySelector(".abp-x")?.addEventListener("click", cleanup);

  const downloadPdf = async () => {
    const file = new File([pdfBlob], fileName, { type: "application/pdf" });
    try {
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: t.title });
        return;
      }
    } catch {
      /* user cancelled share — fall through to anchor download */
    }
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const openPdf = () => {
    const win = window.open(pdfUrl, "_blank", "noopener,noreferrer");
    if (!win) {
      // Popup blocked — navigate same tab as last resort
      window.location.href = pdfUrl;
    }
  };

  const printPdf = () => {
    // Open the real one-page PDF in Safari’s viewer (has Print / Share).
    openPdf();
  };

  host.querySelector('[data-act="download"]')?.addEventListener("click", () => {
    void downloadPdf();
  });
  host.querySelector('[data-act="print"]')?.addEventListener("click", printPdf);
  host.querySelector('[data-act="open"]')?.addEventListener("click", openPdf);
}

/**
 * Open a print-ready A4 portrait blueprint with proper Arabic typography.
 * Desktop: same-origin iframe. Mobile: one-page PDF popup (download / print / open).
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
  const logo = await loadPrintLogoPngDataUrl();
  const motto = meta.lang === "ar" ? BLUEPRINT_MOTTO_AR : BLUEPRINT_MOTTO_EN;
  const location = meta.lang === "ar" ? BLUEPRINT_LOCATION_AR : BLUEPRINT_LOCATION_EN;
  const contactsHtml = `<div class="contacts">${BLUEPRINT_CONTACTS.map(
    (c) => `
      <div class="contact-row">
        <span class="contact-name">${escapeHtml(c.name)}</span>
        <span class="contact-phone" dir="ltr">${escapeHtml(c.phone)}</span>
      </div>`
  ).join("")}</div>`;

  const rows: Array<[string, string]> = [];
  const push = (label: string, value?: string | null) => {
    if (value && String(value).trim()) rows.push([label, String(value).trim()]);
  };
  for (const row of meta.extraRows ?? []) {
    push(row.label, row.value);
  }
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
      meta.lang === "ar" ? "اختيار المستخدم \u2068(إرشادي)\u2069" : "User-selected (advisory)";
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

  const watermarkSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="240" viewBox="0 0 360 240">
      <g transform="translate(34 30) rotate(-18 146 90)" fill="none" stroke="rgba(15,52,47,0.09)" stroke-width="2">
        <path d="M78 118V84l13-10v44M103 118V76l13-12v54M128 118V84l13-10v44" />
        <path d="M70 124h86" />
      </g>
      <text x="178" y="182" text-anchor="middle" fill="rgba(15,52,47,0.09)" font-family="Segoe UI, Arial, sans-serif" font-size="31" font-weight="700" letter-spacing="2">ALSHANTAF</text>
    </svg>`
  );

  const html = `<!DOCTYPE html>
<html lang="${meta.lang}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(meta.sheetTitle)}</title>
<style>
  /* Official A4 letterhead — clipped to one page (iOS Safari safe). */
  @page { size: 210mm 297mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 210mm;
    height: 297mm;
    max-height: 297mm;
    overflow: hidden;
    font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif;
    color: #111111;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    --green: #0f342f;
    width: 210mm;
    height: 297mm;
    max-height: 297mm;
    padding: 7mm 7mm 5mm;
    display: grid;
    grid-template-rows: 28mm minmax(0, 1.15fr) minmax(0, 1.05fr) 16mm;
    gap: 2.5mm;
    overflow: hidden;
    page-break-after: avoid;
    page-break-inside: avoid;
    break-after: avoid;
    break-inside: avoid;
    border: 2.2mm solid var(--green);
    position: relative;
  }
  .sheet::after {
    content: "";
    position: absolute;
    inset: 8mm;
    background-image: url("data:image/svg+xml,${watermarkSvg}");
    background-repeat: repeat;
    background-size: 74mm 54mm;
    pointer-events: none;
    z-index: 5;
    opacity: 0.35;
  }
  .sheet > * {
    position: relative;
    z-index: 1;
  }
  .header {
    direction: ltr;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 3mm;
    height: 28mm;
    max-height: 28mm;
    min-height: 0;
    padding: 0 0 1.5mm;
    overflow: visible;
    position: relative;
  }
  .header::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 0.45mm;
    background: var(--green);
  }
  .header .motto {
    text-align: left;
    font-size: 7pt;
    font-weight: 600;
    line-height: 1.35;
    color: #222222;
    max-width: 58mm;
    justify-self: start;
    align-self: center;
  }
  .header .motto--ar {
    /* Keep Arabic motto on one visual line and avoid trailing-word wrap. */
    white-space: nowrap;
    max-width: 66mm;
    font-size: 6.7pt;
  }
  .header .logo-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    justify-self: center;
    width: 30mm;
    height: 22mm;
    overflow: hidden;
    clip-path: ellipse(50% 50% at 50% 50%);
  }
  .header .logo-wrap img {
    width: 30mm;
    height: 22mm;
    object-fit: cover;
    display: block;
  }
  .header .title-block {
    text-align: right;
    justify-self: end;
    align-self: center;
    max-width: 62mm;
  }
  .header .sub {
    font-size: 8pt;
    font-weight: 700;
    color: var(--green);
    line-height: 1.3;
  }
  .top {
    display: grid;
    grid-template-columns: 68mm minmax(0, 1fr);
    gap: 2.5mm;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }
  .panel {
    background: #ffffff;
    border: 0.25mm solid #222222;
    border-radius: 0;
    padding: 2mm;
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    break-inside: avoid;
  }
  .panel h2 {
    margin: 0 0 1mm;
    font-size: 8pt;
    font-weight: 800;
    color: #111111;
    border-bottom: 0.2mm solid #222222;
    padding-bottom: 1mm;
    flex-shrink: 0;
    letter-spacing: 0.01em;
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
  .view-panel {
    background: #ffffff;
    padding: 2mm;
  }
  .view-panel .frame {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: #ffffff;
    border: 0.2mm solid #cccccc;
    padding: 1mm;
  }
  .view-panel img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
  }
  .view-panel.map-view .frame img {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    object-fit: contain;
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
    padding: 0.45mm 0;
    border-bottom: 0.15mm solid rgba(17,17,17,0.12);
    flex-shrink: 0;
  }
  .lab {
    font-size: 6pt;
    font-weight: 700;
    color: #444444;
    margin: 0;
    flex: 0 1 auto;
    line-height: 1.2;
    unicode-bidi: isolate;
  }
  .val {
    font-size: 7pt;
    font-weight: 600;
    color: #111111;
    line-height: 1.2;
    word-break: break-word;
    text-align: end;
    max-width: 62%;
    unicode-bidi: plaintext;
  }
  .note {
    margin-top: 0.8mm;
    font-size: 5pt;
    color: #555555;
    line-height: 1.25;
    padding-top: 0.8mm;
    border-top: 0.2mm dashed rgba(17,17,17,0.25);
    flex-shrink: 0;
    unicode-bidi: plaintext;
  }
  .footer {
    direction: ltr;
    display: grid;
    grid-template-columns: 1fr 1.15fr;
    gap: 3mm;
    align-items: center;
    height: 16mm;
    max-height: 16mm;
    min-height: 0;
    margin: 0 -7mm -5mm;
    padding: 2.5mm 7mm 3mm;
    background: var(--green);
    color: #ffffff;
    overflow: hidden;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .footer-left {
    text-align: left;
    justify-self: start;
  }
  .footer-url {
    font-size: 7.5pt;
    font-weight: 800;
    color: #ffffff;
    direction: ltr;
    unicode-bidi: isolate;
  }
  .footer-loc {
    margin-top: 0.4mm;
    font-size: 6pt;
    font-weight: 600;
    color: #ffffff;
    line-height: 1.2;
    max-width: 88mm;
    unicode-bidi: plaintext;
  }
  .footer-note {
    margin-top: 0.5mm;
    font-size: 4.5pt;
    color: rgba(255,255,255,0.85);
    line-height: 1.2;
    max-width: 95mm;
    unicode-bidi: plaintext;
  }
  .footer-right {
    justify-self: end;
  }
  .contacts {
    display: flex;
    flex-direction: row;
    gap: 5mm;
    justify-content: flex-end;
    align-items: flex-end;
  }
  .contact-row {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0;
  }
  .contact-name {
    font-size: 6pt;
    font-weight: 700;
    color: #ffffff;
    line-height: 1.15;
    white-space: nowrap;
  }
  .contact-phone {
    font-size: 7.5pt;
    font-weight: 800;
    color: #ffffff;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    line-height: 1.15;
    white-space: nowrap;
  }
  @media print {
    html, body, .sheet {
      width: 210mm !important;
      height: 297mm !important;
      max-height: 297mm !important;
      overflow: hidden !important;
      margin: 0 !important;
      background: #ffffff !important;
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
      <div class="motto${meta.lang === "ar" ? " motto--ar" : ""}">${escapeHtml(motto)}</div>
      <div class="logo-wrap">
        ${logo ? `<img src="${logo}" alt="" />` : ""}
      </div>
      <div class="title-block">
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
        <h2>${escapeHtml(meta.sideViewLabel)}</h2>
        <div class="frame"><img src="${opts.contourPng}" alt="" /></div>
      </section>
    </div>
    <section class="panel view-panel topo map-view">
      <h2>${escapeHtml(meta.topViewLabel)}</h2>
      <div class="frame"><img src="${opts.contextPng}" alt="" /></div>
    </section>
    <footer class="footer">
      <div class="footer-left">
        <div class="footer-url" dir="ltr">${BLUEPRINT_SITE_URL}</div>
        <div class="footer-loc">${escapeHtml(location)}</div>
        <div class="footer-note">${escapeHtml(meta.footerNote)}</div>
      </div>
      <div class="footer-right">${contactsHtml}</div>
    </footer>
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

  const mobileSheetOpts = {
    lang: meta.lang,
    brandName: meta.brandName,
    sheetTitle: meta.sheetTitle,
    motto,
    location,
    logoDataUrl: logo,
    contextPng: opts.contextPng,
    contourPng: opts.contourPng,
    params: rows,
    paramsLabel: meta.paramsLabel,
    topViewLabel: meta.topViewLabel,
    sideViewLabel: meta.sideViewLabel,
    approxNote: meta.approxNote,
    footerNote: meta.footerNote,
  };

  const openMobilePdf = async () => {
    const pageJpeg = await composeBlueprintA4Jpeg(mobileSheetOpts);
    const parcelBit = meta.parcel?.trim() ? `-${meta.parcel.trim()}` : "";
    const fileName = `alshantaf-blueprint${parcelBit}.pdf`.replace(/[^\w.\-]+/g, "_");
    await openMobilePdfPopup({ pageJpeg, lang: meta.lang, fileName });
  };

  // Explicit target window (desktop popup path)
  if (opts.targetWindow && !opts.targetWindow.closed) {
    await printFrom(opts.targetWindow);
    return;
  }

  // Mobile: PDF popup with download / print (one A4 page — no Safari blank page 2).
  if (needsPageIsolationPrint()) {
    await openMobilePdf();
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
    await openMobilePdf();
    return;
  }
  try {
    await printFrom(frameWin);
  } finally {
    window.setTimeout(() => iframe.remove(), 60_000);
  }
}

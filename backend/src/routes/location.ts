import { Router } from "express";
import rateLimit from "express-rate-limit";
import sharp from "sharp";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";

export const locationRouter = Router();

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false });
const imageryLimiter = rateLimit({ windowMs: 60 * 1000, limit: 90, standardHeaders: true, legacyHeaders: false });
const elevationLimiter = rateLimit({ windowMs: 60 * 1000, limit: 180, standardHeaders: true, legacyHeaders: false });
const searchSchema = z.object({ q: z.string().trim().min(2).max(120) });
const imagerySchema = z.object({
  minLat: z.coerce.number().min(-90).max(90),
  minLng: z.coerce.number().min(-180).max(180),
  maxLat: z.coerce.number().min(-90).max(90),
  maxLng: z.coerce.number().min(-180).max(180),
});
const elevTileSchema = z.object({
  z: z.coerce.number().int().min(0).max(15),
  x: z.coerce.number().int().min(0),
  y: z.coerce.number().int().min(0),
});
const elevGridSchema = z.object({
  minLat: z.coerce.number().min(-90).max(90),
  minLng: z.coerce.number().min(-180).max(180),
  maxLat: z.coerce.number().min(-90).max(90),
  maxLng: z.coerce.number().min(-180).max(180),
  cols: z.coerce.number().int().min(16).max(160).optional(),
  rows: z.coerce.number().int().min(16).max(160).optional(),
});
const cache = new Map<string, { expiresAt: number; results: unknown[] }>();

function latLngToTileFrac(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y, n };
}

function decodeTerrariumBuf(rgba: Buffer, w: number, h: number): Float32Array {
  const elev = new Float32Array(w * h);
  for (let i = 0, p = 0; i < elev.length; i++, p += 4) {
    elev[i] = rgba[p]! * 256 + rgba[p + 1]! + rgba[p + 2]! / 256 - 32768;
  }
  return elev;
}

async function fetchBufferOnce(
  url: string,
  timeoutMs = 15000
): Promise<{ ok: true; buf: Buffer } | { ok: false; status: number }> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "AlshantafInvest/1.0 (parcel preview)" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { ok: false, status: response.status };
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length < 256) return { ok: false, status: response.status || 502 };
    return { ok: true, buf };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function fetchBufferWithRetries(
  url: string,
  attempts = 3
): Promise<{ ok: true; buf: Buffer } | { ok: false; status: number }> {
  let lastStatus = 0;
  for (let i = 0; i < attempts; i++) {
    const r = await fetchBufferOnce(url);
    if (r.ok) return r;
    lastStatus = r.status;
    await new Promise((res) => setTimeout(res, 220 * (i + 1)));
  }
  return { ok: false, status: lastStatus };
}

/** Mosaic XYZ raster tiles into a PNG covering a WGS84 bbox. */
async function mosaicXyzTiles(opts: {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  size: number;
  tileUrl: (z: number, x: number, y: number) => string;
  maxTiles?: number;
}): Promise<Buffer | null> {
  const { minLng, minLat, maxLng, maxLat, size } = opts;
  const maxTiles = opts.maxTiles ?? 16;
  let z = 12;
  for (let tryZ = 18; tryZ >= 10; tryZ--) {
    const nw = latLngToTileFrac(maxLat, minLng, tryZ);
    const se = latLngToTileFrac(minLat, maxLng, tryZ);
    const tilesX = Math.floor(Math.max(nw.x, se.x)) - Math.floor(Math.min(nw.x, se.x)) + 1;
    const tilesY = Math.floor(Math.max(nw.y, se.y)) - Math.floor(Math.min(nw.y, se.y)) + 1;
    z = tryZ;
    if (tilesX * tilesY <= maxTiles) break;
  }

  const nw = latLngToTileFrac(maxLat, minLng, z);
  const se = latLngToTileFrac(minLat, maxLng, z);
  const x0 = Math.floor(Math.min(nw.x, se.x));
  const x1 = Math.floor(Math.max(nw.x, se.x));
  const y0 = Math.floor(Math.min(nw.y, se.y));
  const y1 = Math.floor(Math.max(nw.y, se.y));
  if (x1 - x0 > 6 || y1 - y0 > 6) return null;

  const tileW = 256;
  const mosaicW = (x1 - x0 + 1) * tileW;
  const mosaicH = (y1 - y0 + 1) * tileW;
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const got = await fetchBufferOnce(opts.tileUrl(z, tx, ty), 12000);
      if (!got.ok) continue;
      composites.push({
        input: got.buf,
        left: (tx - x0) * tileW,
        top: (ty - y0) * tileW,
      });
    }
  }
  if (!composites.length) return null;

  const mosaic = await sharp({
    create: {
      width: mosaicW,
      height: mosaicH,
      channels: 3,
      background: { r: 20, g: 61, b: 55 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  const leftPx = Math.max(0, Math.min(mosaicW - 1, (Math.min(nw.x, se.x) - x0) * tileW));
  const topPx = Math.max(0, Math.min(mosaicH - 1, (Math.min(nw.y, se.y) - y0) * tileW));
  const rightPx = Math.max(leftPx + 1, Math.min(mosaicW, (Math.max(nw.x, se.x) - x0) * tileW));
  const bottomPx = Math.max(topPx + 1, Math.min(mosaicH, (Math.max(nw.y, se.y) - y0) * tileW));
  const cropW = Math.max(1, Math.round(rightPx - leftPx));
  const cropH = Math.max(1, Math.round(bottomPx - topPx));

  return sharp(mosaic)
    .extract({
      left: Math.floor(leftPx),
      top: Math.floor(topPx),
      width: cropW,
      height: cropH,
    })
    .resize(size, size, { fit: "fill" })
    .png()
    .toBuffer();
}

/**
 * Public, provider-isolated geocoding fallback. DLS is deliberately not proxied:
 * its map currently presents a CAPTCHA and no documented third-party endpoint.
 */
locationRouter.get(
  "/search",
  limiter,
  asyncHandler(async (req, res) => {
    const { q } = searchSchema.parse(req.query);
    const key = q.toLocaleLowerCase();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      res.json({ provider: "openstreetmap", results: cached.results });
      return;
    }

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("countrycodes", "jo");
    url.searchParams.set("addressdetails", "1");
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "AlshantafInvest/1.0 (location search)" },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) {
      res.status(503).json({ error: "Location search is temporarily unavailable. Select a point on the map instead." });
      return;
    }
    const rows = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    const results = rows
      .map((row) => ({ latitude: Number(row.lat), longitude: Number(row.lon), address: row.display_name }))
      .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
    cache.set(key, { results, expiresAt: Date.now() + 5 * 60 * 1000 });
    res.json({ provider: "openstreetmap", results });
  })
);

/**
 * Same-origin proxy for Esri World Imagery over a WGS84 bbox — used to drape
 * real land features onto the cadastral polygon in the land-check 3D view.
 * Falls back to Esri imagery tiles, then OSM, so print rarely gets a blank grid.
 */
locationRouter.get(
  "/satellite-preview",
  imageryLimiter,
  asyncHandler(async (req, res) => {
    const box = imagerySchema.parse(req.query);
    if (box.maxLat <= box.minLat || box.maxLng <= box.minLng) {
      res.status(400).json({ error: "Invalid bounding box." });
      return;
    }
    const latSpan = box.maxLat - box.minLat;
    const lngSpan = box.maxLng - box.minLng;
    if (latSpan > 0.1 || lngSpan > 0.1) {
      res.status(400).json({ error: "Bounding box too large." });
      return;
    }
    const padLat = Math.max(latSpan * 0.12, 0.00008);
    const padLng = Math.max(lngSpan * 0.12, 0.00008);
    const minLat = box.minLat - padLat;
    const maxLat = box.maxLat + padLat;
    const minLng = box.minLng - padLng;
    const maxLng = box.maxLng + padLng;

    const exportUrls = [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export" +
        `?bbox=${minLng},${minLat},${maxLng},${maxLat}` +
        "&bboxSR=4326&imageSR=4326&size=896,896&format=png&f=image&transparent=false",
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export" +
        `?bbox=${minLng},${minLat},${maxLng},${maxLat}` +
        "&bboxSR=4326&imageSR=4326&size=640,640&format=png&f=image&transparent=false",
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export" +
        `?bbox=${minLng},${minLat},${maxLng},${maxLat}` +
        "&bboxSR=4326&imageSR=4326&size=640,640&format=png&f=image&transparent=false",
    ];

    let buf: Buffer | null = null;
    let source = "esri-export";
    let lastStatus = 0;

    for (const url of exportUrls) {
      const got = await fetchBufferWithRetries(url, 2);
      if (got.ok) {
        buf = got.buf;
        break;
      }
      lastStatus = got.status;
    }

    if (!buf) {
      try {
        buf = await mosaicXyzTiles({
          minLng,
          minLat,
          maxLng,
          maxLat,
          size: 896,
          tileUrl: (z, x, y) =>
            `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
        });
        if (buf) source = "esri-tiles";
      } catch {
        buf = null;
      }
    }

    if (!buf) {
      try {
        buf = await mosaicXyzTiles({
          minLng,
          minLat,
          maxLng,
          maxLat,
          size: 896,
          tileUrl: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
        });
        if (buf) source = "osm";
      } catch {
        buf = null;
      }
    }

    if (!buf) {
      res.status(503).json({
        error: "Satellite imagery is temporarily unavailable.",
        upstream: lastStatus || undefined,
      });
      return;
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-Imagery-BBox", `${minLng},${minLat},${maxLng},${maxLat}`);
    res.setHeader("X-Imagery-Source", source);
    res.setHeader("Access-Control-Expose-Headers", "X-Imagery-BBox, X-Imagery-Source");
    res.send(buf);
  })
);

/**
 * Same-origin proxy for Mapzen Terrarium DEM tiles (AWS public elevation).
 * Used by the brand contour topography basemap (canvas needs readable pixels).
 */
locationRouter.get(
  "/elevation-tile/:z/:x/:y",
  elevationLimiter,
  asyncHandler(async (req, res) => {
    const { z, x, y } = elevTileSchema.parse(req.params);
    const max = 2 ** z;
    if (x >= max || y >= max) {
      res.status(400).json({ error: "Invalid tile coordinates." });
      return;
    }
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
    let buf: Buffer | null = null;
    let lastStatus = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": "AlshantafInvest/1.0 (elevation)" },
          signal: AbortSignal.timeout(12000),
        });
        lastStatus = response.status;
        if (!response.ok) {
          if (response.status === 404) break;
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
          continue;
        }
        const next = Buffer.from(await response.arrayBuffer());
        if (next.length < 256) {
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
          continue;
        }
        buf = next;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
    }
    if (!buf) {
      res.status(lastStatus === 404 ? 404 : 503).json({ error: "Elevation tile unavailable." });
      return;
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.send(buf);
  })
);

/**
 * Sample a WGS84 bbox into a regular elevation grid (metres) from Terrarium DEM.
 * Powers the Three.js topographic side view of a cadastral parcel.
 */
locationRouter.get(
  "/elevation-grid",
  imageryLimiter,
  asyncHandler(async (req, res) => {
    const q = elevGridSchema.parse(req.query);
    if (q.maxLat <= q.minLat || q.maxLng <= q.minLng) {
      res.status(400).json({ error: "Invalid bounding box." });
      return;
    }
    const latSpan = q.maxLat - q.minLat;
    const lngSpan = q.maxLng - q.minLng;
    if (latSpan > 0.15 || lngSpan > 0.15) {
      res.status(400).json({ error: "Bounding box too large." });
      return;
    }

    const cols = q.cols ?? 96;
    const rows = q.rows ?? 96;
    // Pick DEM zoom from span (~want several pixels per cell)
    const spanDeg = Math.max(latSpan, lngSpan);
    let z = 14;
    if (spanDeg < 0.002) z = 15;
    else if (spanDeg < 0.006) z = 15;
    else if (spanDeg < 0.02) z = 14;
    else if (spanDeg < 0.05) z = 13;
    else z = 12;

    const nw = latLngToTileFrac(q.maxLat, q.minLng, z);
    const se = latLngToTileFrac(q.minLat, q.maxLng, z);
    const tx0 = Math.floor(Math.min(nw.x, se.x));
    const tx1 = Math.floor(Math.max(nw.x, se.x));
    const ty0 = Math.floor(Math.min(nw.y, se.y));
    const ty1 = Math.floor(Math.max(nw.y, se.y));
    if (tx1 - tx0 > 4 || ty1 - ty0 > 4) {
      res.status(400).json({ error: "Too many elevation tiles required." });
      return;
    }

    type Tile = { x: number; y: number; elev: Float32Array };
    const tiles: Tile[] = [];
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${tx}/${ty}.png`;
        let buf: Buffer | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(url, {
              headers: { "User-Agent": "AlshantafInvest/1.0 (elevation-grid)" },
              signal: AbortSignal.timeout(12000),
            });
            if (!response.ok) {
              await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
              continue;
            }
            const next = Buffer.from(await response.arrayBuffer());
            if (next.length < 256) {
              await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
              continue;
            }
            buf = next;
            break;
          } catch {
            await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
          }
        }
        if (!buf) continue;
        const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        tiles.push({ x: tx, y: ty, elev: decodeTerrariumBuf(data, info.width, info.height) });
      }
    }
    if (!tiles.length) {
      res.status(503).json({ error: "Elevation data unavailable." });
      return;
    }

    const sampleAt = (lat: number, lng: number): number | null => {
      const { x: fx, y: fy } = latLngToTileFrac(lat, lng, z);
      const tx = Math.floor(fx);
      const ty = Math.floor(fy);
      const tile = tiles.find((t) => t.x === tx && t.y === ty);
      if (!tile) return null;
      const px = (fx - tx) * 255;
      const py = (fy - ty) * 255;
      const x0 = Math.max(0, Math.min(254, Math.floor(px)));
      const y0 = Math.max(0, Math.min(254, Math.floor(py)));
      const u = px - x0;
      const v = py - y0;
      const e = tile.elev;
      const a = e[y0 * 256 + x0]!;
      const b = e[y0 * 256 + x0 + 1]!;
      const c = e[(y0 + 1) * 256 + x0]!;
      const d = e[(y0 + 1) * 256 + x0 + 1]!;
      return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    };

    const elevations: number[] = new Array(cols * rows);
    let min = Infinity;
    let max = -Infinity;
    let missing = 0;
    for (let r = 0; r < rows; r++) {
      const lat = q.maxLat - ((r + 0.5) / rows) * latSpan;
      for (let c = 0; c < cols; c++) {
        const lng = q.minLng + ((c + 0.5) / cols) * lngSpan;
        const v = sampleAt(lat, lng);
        if (v == null || !Number.isFinite(v)) {
          elevations[r * cols + c] = NaN;
          missing++;
        } else {
          elevations[r * cols + c] = v;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    // Fill NaNs with nearest valid / mid
    const fill = Number.isFinite(min) && Number.isFinite(max) ? (min + max) / 2 : 0;
    for (let i = 0; i < elevations.length; i++) {
      if (!Number.isFinite(elevations[i]!)) elevations[i] = fill;
    }

    // Blend with Open-Meteo elevation (open DEM aggregate) for better local accuracy.
    // Sample a coarser lattice, then correct the Terrarium surface by local bias.
    const sources = ["mapzen-terrarium"];
    try {
      const step = Math.max(1, Math.ceil(Math.max(cols, rows) / 16));
      const lats: number[] = [];
      const lngs: number[] = [];
      const idxs: number[] = [];
      for (let r = 0; r < rows; r += step) {
        for (let c = 0; c < cols; c += step) {
          lats.push(q.maxLat - ((r + 0.5) / rows) * latSpan);
          lngs.push(q.minLng + ((c + 0.5) / cols) * lngSpan);
          idxs.push(r * cols + c);
        }
      }
      // Open-Meteo accepts comma-separated lists; batch in chunks of 80.
      const omElev = new Map<number, number>();
      for (let i = 0; i < lats.length; i += 80) {
        const batchLats = lats.slice(i, i + 80);
        const batchLngs = lngs.slice(i, i + 80);
        const batchIdx = idxs.slice(i, i + 80);
        const url =
          `https://api.open-meteo.com/v1/elevation?latitude=${batchLats.map((v) => v.toFixed(6)).join(",")}` +
          `&longitude=${batchLngs.map((v) => v.toFixed(6)).join(",")}`;
        const response = await fetch(url, {
          headers: { "User-Agent": "AlshantafInvest/1.0 (elevation-blend)" },
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) continue;
        const body = (await response.json()) as { elevation?: number[] };
        const arr = body.elevation;
        if (!Array.isArray(arr)) continue;
        for (let k = 0; k < arr.length && k < batchIdx.length; k++) {
          const v = arr[k];
          if (typeof v === "number" && Number.isFinite(v)) omElev.set(batchIdx[k]!, v);
        }
      }
      if (omElev.size >= 4) {
        sources.push("open-meteo");
        // Global bias from control points, then soft per-cell pull toward Open-Meteo samples
        let biasSum = 0;
        let biasN = 0;
        for (const [idx, om] of omElev) {
          const t = elevations[idx]!;
          if (Number.isFinite(t)) {
            biasSum += om - t;
            biasN++;
          }
        }
        const bias = biasN > 0 ? biasSum / biasN : 0;
        for (let i = 0; i < elevations.length; i++) {
          elevations[i] = elevations[i]! + bias;
        }
        // Stronger blend exactly on Open-Meteo sample cells
        for (const [idx, om] of omElev) {
          elevations[idx] = elevations[idx]! * 0.35 + om * 0.65;
        }
        min = Infinity;
        max = -Infinity;
        for (let i = 0; i < elevations.length; i++) {
          const v = elevations[i]!;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    } catch {
      // Terrarium-only fallback — Open-Meteo is best-effort
    }

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json({
      cols,
      rows,
      minLat: q.minLat,
      maxLat: q.maxLat,
      minLng: q.minLng,
      maxLng: q.maxLng,
      z,
      minElev: Number.isFinite(min) ? min : fill,
      maxElev: Number.isFinite(max) ? max : fill,
      missing,
      sources,
      elevations,
    });
  })
);

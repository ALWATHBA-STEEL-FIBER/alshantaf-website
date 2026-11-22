/**
 * Looks up a parcel's map location via the official DLS ArcGIS MapServer:
 *   https://maps.dls.gov.jo/arcgis/rest/services/DLS_Cassini_Service_STG/MapServer/3
 * ("قطع الاراضي" — cadastral parcel polygons).
 *
 * Query keys match the cadastral DLS_KEY parts:
 *   VILL_CODE (4) + HOD_CODE (3) + SECTOR_CODE (3) + PARCEL_ID (5)
 *
 * Geometry is requested in WGS84 (outSR=4326) the same way the earlier
 * accurate overlay did — without an extra datumTransformation step.
 */

import { toWesternDigits } from "./arabicDigits";

const PARCEL_LAYER_URL =
  "https://maps.dls.gov.jo/arcgis/rest/services/DLS_Cassini_Service_STG/MapServer/3/query";
const PARCEL_LINES_LAYER_URL =
  "https://maps.dls.gov.jo/arcgis/rest/services/DLS_Cassini_Service_STG/MapServer/2/query";
/** Progressive admin LOD — same layers DLS toggles by map scale. */
const GOVERNORATE_LAYER_URL =
  "https://maps.dls.gov.jo/arcgis/rest/services/DLS_Layers_Service_STG/MapServer/16/query";
const DIRECTORATE_LAYER_URL =
  "https://maps.dls.gov.jo/arcgis/rest/services/DLS_Cassini_Service_STG/MapServer/7/query";
const BASIN_LAYER_URL =
  "https://maps.dls.gov.jo/arcgis/rest/services/DLS_Cassini_Service_STG/MapServer/6/query";
const SOURCE_URL = "https://maps.dls.gov.jo/dlsweb/";
/** Public token issued by the DLS web map. Required since 2026-10-21 (ArcGIS 499). */
const MAP_TOKEN_URL = "https://maps.dls.gov.jo/dlswebapi/api/DlsWebapi/gettoken";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const LOOKUP_TIMEOUT_MS = 12_000;
const ROAD_LOOKUP_TIMEOUT_MS = 15_000;
const ADMIN_LOOKUP_TIMEOUT_MS = 18_000;

type RoadSide = "north" | "south" | "east" | "west";

export interface DlsAdjacentRoad {
  id: string;
  name: string;
  side: RoadSide;
  widthM: number | null;
  source: "osm-overpass" | "google-maps" | "dls-neighbor";
  path: [number, number][];
}

export interface DlsParcelLocationResult {
  latitude: number;
  longitude: number;
  /** Leaflet-ready rings: each ring is an array of [lat, lng] points. */
  rings: [number, number][][];
  dlsKey: string;
  villageCode: string;
  basinCode: string;
  sectorCode: string;
  parcelId: string;
  sheetNo: string | null;
  /** Calculated cadastral area in m² (SHAPE.AREA) — not the registered deed area. */
  areaSqm: number | null;
  perimeterM: number | null;
  adjacentRoads: DlsAdjacentRoad[];
  source: "DLS Cadastral Map";
  sourceUrl: string;
}

export interface DlsContextParcel {
  dlsKey: string | null;
  parcelNo: string | null;
  rings: [number, number][][];
  isSubject: boolean;
}

/** DLS progressive boundaries: country silhouette → governorates → villages/lands → parcels. */
export type DlsAdminLayer = "governorates" | "directorates" | "basins";

export interface DlsAdminFeature {
  id: string;
  layer: DlsAdminLayer;
  nameAr: string | null;
  nameEn: string | null;
  rings: [number, number][][];
}

export class DlsParcelLocationError extends Error {}

let mapTokenCache: { token: string; expiresAt: number } | null = null;
let governoratesCache: { at: number; features: DlsAdminFeature[] } | null = null;
const GOVERNORATES_CACHE_MS = 6 * 60 * 60 * 1000;

async function getDlsMapToken(signal: AbortSignal): Promise<string> {
  const issued = await issueDlsMapToken(signal);
  return issued.token;
}

/**
 * Mint / reuse the public DLS web-map token for browser ArcGIS queries.
 * Token endpoint has no CORS — browsers fetch this via our API, then talk
 * to maps.dls.gov.jo MapServer directly (ArcGIS allows our Origin).
 */
export async function issueDlsMapToken(signal?: AbortSignal): Promise<{ token: string; expiresAt: number }> {
  const now = Date.now();
  if (mapTokenCache && mapTokenCache.expiresAt - 60_000 > now) {
    return { token: mapTokenCache.token, expiresAt: mapTokenCache.expiresAt };
  }
  const controller = signal ? null : new AbortController();
  const activeSignal = signal ?? controller!.signal;
  const timer = controller ? setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS) : null;
  try {
    const res = await fetch(MAP_TOKEN_URL, {
      signal: activeSignal,
      headers: {
        Accept: "application/json",
        Referer: SOURCE_URL,
        "X-Random-Key": Math.random().toString(36).slice(2, 12),
      },
    });
    if (!res.ok) {
      throw new DlsParcelLocationError("DLS map token request failed");
    }
    const body = (await res.json()) as { token?: string; expires?: number };
    if (!body.token) throw new DlsParcelLocationError("DLS map token missing");
    mapTokenCache = {
      token: body.token,
      expiresAt: typeof body.expires === "number" && body.expires > now ? body.expires : now + 30 * 60_000,
    };
    return { token: mapTokenCache.token, expiresAt: mapTokenCache.expiresAt };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type DlsFeature = {
  attributes?: {
    VILL_CODE?: string;
    HOD_CODE?: string;
    SECTOR_CODE?: string;
    PARCEL_ID?: string;
    DLS_KEY?: string;
    PARCEL_TYPE?: number | null;
    STATUS?: number | null;
    SHEET_NO?: string | null;
    OBJECTID?: number;
    PARCEL_LINE_TYPE?: number | null;
    LAYER?: number | null;
    "SHAPE.AREA"?: number | null;
    "SHAPE.LEN"?: number | null;
    GOVERNARATE_NAME_A?: string | null;
    GOVERNARATE_NAME_E?: string | null;
    GOV_ID?: number | null;
    DIRECTORATE_NAME_A?: string | null;
    DIRECTORATE_NAME_E?: string | null;
    DIR_ID?: number | null;
    HOD_NAME_A?: string | null;
    HOD_NAME_E?: string | null;
  };
  geometry?: { rings?: number[][][] };
};

type DlsQueryBody = {
  error?: { code?: number; message?: string };
  features?: DlsFeature[];
};

type OverpassBody = {
  elements?: Array<{
    id: number;
    type: string;
    tags?: Record<string, string>;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
};

function pad(value: string, width: number): string {
  const digits = toWesternDigits(value).replace(/\D/g, "");
  if (!digits) throw new DlsParcelLocationError("Missing numeric DLS code");
  return digits.length >= width ? digits : digits.padStart(width, "0");
}

function centroidOfRings(rings: number[][][]): { lat: number; lng: number } | null {
  const ring = rings[0];
  if (!ring?.length) return null;
  let sumX = 0;
  let sumY = 0;
  const count = ring.length > 1 ? ring.length - 1 : ring.length;
  for (let i = 0; i < count; i++) {
    sumX += ring[i][0];
    sumY += ring[i][1];
  }
  return { lng: sumX / count, lat: sumY / count };
}

export async function lookupDlsParcelLocation(params: {
  villageCode: string;
  basinCode: string;
  sectorCode: string;
  parcelNumber: string;
}): Promise<DlsParcelLocationResult | null> {
  const villageCode = pad(params.villageCode, 4);
  const basinCode = pad(params.basinCode, 3);
  const sectorCode = pad(params.sectorCode, 3);
  const parcelId = pad(params.parcelNumber.trim(), 5);

  const strictWhere = [
    `VILL_CODE='${villageCode}'`,
    `HOD_CODE='${basinCode}'`,
    `SECTOR_CODE='${sectorCode}'`,
    `PARCEL_ID='${parcelId}'`,
  ].join(" AND ");
  const looseWhere = [
    `VILL_CODE='${villageCode}'`,
    `HOD_CODE='${basinCode}'`,
    `PARCEL_ID='${parcelId}'`,
  ].join(" AND ");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    async function queryFirstFeature(where: string): Promise<DlsFeature | null> {
      const rows = await queryFeatures(
        {
          where,
          outFields: "VILL_CODE,HOD_CODE,SECTOR_CODE,PARCEL_ID,DLS_KEY,SHEET_NO,SHAPE.AREA,SHAPE.LEN",
          returnGeometry: true,
          outSR: 4326,
          f: "json",
        },
        controller.signal
      );
      return rows[0] ?? null;
    }

    // Primary exact lookup; fallback drops sector in case parcel is filed under
    // a different sector code in DLS for the same basin.
    let feature = await queryFirstFeature(strictWhere);
    if (!feature?.geometry?.rings?.length) {
      feature = await queryFirstFeature(looseWhere);
    }
    return await featureToResult(feature, { villageCode, basinCode, sectorCode, parcelId });
  } catch (err) {
    if (err instanceof DlsParcelLocationError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new DlsParcelLocationError("DLS map lookup timed out");
    }
    throw new DlsParcelLocationError(err instanceof Error ? err.message : "DLS map lookup failed");
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupDlsParcelByPoint(params: {
  latitude: number;
  longitude: number;
}): Promise<DlsParcelLocationResult | null> {
  const lat = Number(params.latitude);
  const lng = Number(params.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new DlsParcelLocationError("Invalid point coordinates for DLS map lookup");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const rows = await queryFeatures(
      {
        geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
        geometryType: "esriGeometryPoint",
        inSR: 4326,
        spatialRel: "esriSpatialRelIntersects",
        outFields: "VILL_CODE,HOD_CODE,SECTOR_CODE,PARCEL_ID,DLS_KEY,SHEET_NO,SHAPE.AREA,SHAPE.LEN",
        returnGeometry: true,
        outSR: 4326,
        f: "json",
      },
      controller.signal
    );
    const feature = rows[0] ?? null;
    return await featureToResult(feature, null);
  } catch (err) {
    if (err instanceof DlsParcelLocationError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new DlsParcelLocationError("DLS map lookup timed out");
    }
    throw new DlsParcelLocationError(err instanceof Error ? err.message : "DLS map lookup failed");
  } finally {
    clearTimeout(timer);
  }
}

function normalizeParcelNo(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return String(Math.trunc(n));
  return raw;
}

function ringsFromFeature(feature: DlsFeature): [number, number][][] {
  return (feature.geometry?.rings ?? [])
    .map((ring) =>
      ring
        .map(([lng, lat]) => [lat, lng] as [number, number])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
    )
    .filter((ring) => ring.length >= 3);
}

function adminEndpoint(layer: DlsAdminLayer): string {
  if (layer === "governorates") return GOVERNORATE_LAYER_URL;
  if (layer === "directorates") return DIRECTORATE_LAYER_URL;
  return BASIN_LAYER_URL;
}

function adminOutFields(layer: DlsAdminLayer): string {
  if (layer === "governorates") return "OBJECTID,GOV_ID,GOVERNARATE_NAME_A,GOVERNARATE_NAME_E";
  if (layer === "directorates") return "OBJECTID,DIR_ID,DIRECTORATE_NAME_A,DIRECTORATE_NAME_E";
  return "OBJECTID,VILL_CODE,HOD_CODE,HOD_NAME_A,HOD_NAME_E";
}

function featureToAdmin(layer: DlsAdminLayer, feature: DlsFeature): DlsAdminFeature | null {
  const rings = ringsFromFeature(feature);
  if (!rings.length) return null;
  const attrs = feature.attributes ?? {};
  if (layer === "governorates") {
    const id = attrs.GOV_ID ?? attrs.OBJECTID;
    if (id == null) return null;
    return {
      id: `gov-${id}`,
      layer,
      nameAr: (attrs.GOVERNARATE_NAME_A || "").trim() || null,
      nameEn: (attrs.GOVERNARATE_NAME_E || "").trim() || null,
      rings,
    };
  }
  if (layer === "directorates") {
    const id = attrs.DIR_ID ?? attrs.OBJECTID;
    if (id == null) return null;
    return {
      id: `dir-${id}`,
      layer,
      nameAr: (attrs.DIRECTORATE_NAME_A || "").trim() || null,
      nameEn: (attrs.DIRECTORATE_NAME_E || "").trim() || null,
      rings,
    };
  }
  const vill = (attrs.VILL_CODE || "").trim();
  const hod = (attrs.HOD_CODE || "").trim();
  const oid = attrs.OBJECTID;
  const id = vill && hod ? `${vill}-${hod}` : oid != null ? String(oid) : null;
  if (!id) return null;
  return {
    id: `basin-${id}`,
    layer,
    nameAr: (attrs.HOD_NAME_A || "").trim() || null,
    nameEn: (attrs.HOD_NAME_E || "").trim() || null,
    rings,
  };
}

/**
 * Progressive admin boundaries for DLS-style LOD.
 * Governorates are cached (only ~15 polygons). Directorates/basins are
 * viewport-bounded and geometry-simplified for phones.
 */
export async function lookupDlsAdminByBbox(params: {
  layer: DlsAdminLayer;
  west: number;
  south: number;
  east: number;
  north: number;
  /** Degrees — larger = coarser shapes (friendlier on weak devices). */
  maxAllowableOffset?: number;
  resultRecordCount?: number;
}): Promise<DlsAdminFeature[]> {
  const layer = params.layer;
  const west = Number(params.west);
  const south = Number(params.south);
  const east = Number(params.east);
  const north = Number(params.north);
  if (![west, south, east, north].every(Number.isFinite) || east <= west || north <= south) {
    throw new DlsParcelLocationError("Invalid bbox for DLS admin lookup");
  }

  if (layer === "governorates" && governoratesCache && Date.now() - governoratesCache.at < GOVERNORATES_CACHE_MS) {
    return governoratesCache.features;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADMIN_LOOKUP_TIMEOUT_MS);
  try {
    const offset =
      typeof params.maxAllowableOffset === "number" && Number.isFinite(params.maxAllowableOffset)
        ? Math.max(0, params.maxAllowableOffset)
        : layer === "governorates"
          ? 0.008
          : layer === "directorates"
            ? 0.002
            : 0.0008;
    const limit =
      typeof params.resultRecordCount === "number" && Number.isFinite(params.resultRecordCount)
        ? Math.min(400, Math.max(1, Math.floor(params.resultRecordCount)))
        : layer === "governorates"
          ? 30
          : layer === "directorates"
            ? 80
            : 120;

    const query: Record<string, string | number | boolean> = {
      where: "1=1",
      outFields: adminOutFields(layer),
      returnGeometry: true,
      outSR: 4326,
      maxAllowableOffset: offset,
      resultRecordCount: limit,
      f: "json",
    };
    if (layer !== "governorates") {
      query.geometry = JSON.stringify({
        xmin: west,
        ymin: south,
        xmax: east,
        ymax: north,
        spatialReference: { wkid: 4326 },
      });
      query.geometryType = "esriGeometryEnvelope";
      query.inSR = 4326;
      query.spatialRel = "esriSpatialRelIntersects";
    }

    const rows = await queryFeatures(query, controller.signal, adminEndpoint(layer));
    const list: DlsAdminFeature[] = [];
    for (const row of rows) {
      const item = featureToAdmin(layer, row);
      if (item) list.push(item);
    }
    if (layer === "governorates") {
      governoratesCache = { at: Date.now(), features: list };
    }
    return list;
  } catch (err) {
    if (err instanceof DlsParcelLocationError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new DlsParcelLocationError("DLS admin boundary lookup timed out");
    }
    throw new DlsParcelLocationError(err instanceof Error ? err.message : "DLS admin boundary lookup failed");
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupDlsParcelContextByPoint(params: {
  latitude: number;
  longitude: number;
}): Promise<DlsContextParcel[]> {
  const subject = await lookupDlsParcelByPoint(params);
  if (!subject) return [];
  const primaryRing = subject.rings[0]?.filter((p) => Array.isArray(p) && p.length === 2) ?? [];
  if (primaryRing.length < 3) return [];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of primaryRing) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  // ~2 km half-span with simplified rings (fallback when client viewport query fails).
  const pad = 0.018;
  const queryGeom = {
    xmin: minLng - pad,
    ymin: minLat - pad,
    xmax: maxLng + pad,
    ymax: maxLat + pad,
    spatialReference: { wkid: 4326 },
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROAD_LOOKUP_TIMEOUT_MS);
  try {
    const rows = await queryFeatures(
      {
        where: "1=1",
        outFields: "DLS_KEY,PARCEL_ID",
        returnGeometry: true,
        geometry: JSON.stringify(queryGeom),
        geometryType: "esriGeometryEnvelope",
        inSR: 4326,
        spatialRel: "esriSpatialRelIntersects",
        outSR: 4326,
        maxAllowableOffset: 0.0002,
        resultRecordCount: 3000,
        f: "json",
      },
      controller.signal,
      PARCEL_LAYER_URL
    );
    const list: DlsContextParcel[] = [];
    for (const row of rows) {
      const rings = (row.geometry?.rings ?? [])
        .map((ring) =>
          ring
            .map(([lng, lat]) => [lat, lng] as [number, number])
            .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
        )
        .filter((ring) => ring.length >= 3);
      if (!rings.length) continue;
      const dlsKey = (row.attributes?.DLS_KEY || "").trim() || null;
      const parcelNo = normalizeParcelNo(row.attributes?.PARCEL_ID);
      const isSubject = Boolean(dlsKey && subject.dlsKey && dlsKey === subject.dlsKey);
      list.push({ dlsKey, parcelNo, rings, isSubject });
    }
    // Subject first, then numbered parcels, then unnamed shapes.
    list.sort((a, b) => Number(b.isSubject) - Number(a.isSubject) || Number(Boolean(b.parcelNo)) - Number(Boolean(a.parcelNo)));
    return list;
  } finally {
    clearTimeout(timer);
  }
}

async function queryFeatures(
  params: Record<string, string | number | boolean>,
  signal: AbortSignal,
  endpoint = PARCEL_LAYER_URL
): Promise<DlsFeature[]> {
  async function run(token: string): Promise<DlsQueryBody> {
    const url = new URL(endpoint);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    url.searchParams.set("token", token);
    const res = await fetch(url, {
      signal,
      headers: { Accept: "application/json", Referer: SOURCE_URL },
    });
    if (!res.ok) {
      throw new DlsParcelLocationError(`DLS map service returned HTTP ${res.status}`);
    }
    return (await res.json()) as DlsQueryBody;
  }

  let token = await getDlsMapToken(signal);
  let body = await run(token);
  if (body.error?.code === 499) {
    mapTokenCache = null;
    token = await getDlsMapToken(signal);
    body = await run(token);
  }
  if (body.error) {
    throw new DlsParcelLocationError(body.error.message || "DLS map query failed");
  }
  return body.features ?? [];
}

function sideFromPoint(point: [number, number], centroid: { lat: number; lng: number }): RoadSide {
  const dLat = point[0] - centroid.lat;
  const dLng = point[1] - centroid.lng;
  if (Math.abs(dLat) >= Math.abs(dLng)) return dLat >= 0 ? "north" : "south";
  return dLng >= 0 ? "east" : "west";
}

function parseRoadWidthMeters(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  // Typical OSM width is already meters; tolerate feet hints.
  if (/\bft\b|feet|foot/.test(cleaned)) return value * 0.3048;
  return value;
}

function defaultRoadWidthM(tags: Record<string, string | undefined>): number | null {
  const lanesRaw = tags.lanes;
  const lanes = lanesRaw ? Number(lanesRaw) : NaN;
  if (Number.isFinite(lanes) && lanes > 0 && lanes <= 12) {
    return Math.max(4, Math.min(40, lanes * 3.25));
  }
  switch ((tags.highway || "").toLowerCase()) {
    case "motorway":
      return 26;
    case "trunk":
      return 22;
    case "primary":
      return 16;
    case "secondary":
      return 14;
    case "tertiary":
      return 12;
    case "residential":
      return 10;
    case "unclassified":
      return 9;
    case "service":
      return 7;
    case "track":
      return 6;
    default:
      return 8;
  }
}

function pointSegmentDistanceM(
  point: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const latScale = 111320;
  const lngScale = Math.cos((point[0] * Math.PI) / 180) * 111320;
  const px = (point[1] - a[1]) * lngScale;
  const py = (point[0] - a[0]) * latScale;
  const sx = (b[1] - a[1]) * lngScale;
  const sy = (b[0] - a[0]) * latScale;
  const segLen2 = sx * sx + sy * sy;
  if (segLen2 < 1e-9) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * sx + py * sy) / segLen2));
  const dx = px - sx * t;
  const dy = py - sy * t;
  return Math.hypot(dx, dy);
}

function segmentIntersection(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number }
): boolean {
  const cross = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = cross(a1, a2, b1);
  const d2 = cross(a1, a2, b2);
  const d3 = cross(b1, b2, a1);
  const d4 = cross(b1, b2, a2);
  return d1 * d2 <= 0 && d3 * d4 <= 0;
}

function segmentSegmentDistanceM(
  a1: [number, number],
  a2: [number, number],
  b1: [number, number],
  b2: [number, number],
  refLat: number
): number {
  const latScale = 111320;
  const lngScale = Math.cos((refLat * Math.PI) / 180) * 111320;
  const A1 = { x: a1[1] * lngScale, y: a1[0] * latScale };
  const A2 = { x: a2[1] * lngScale, y: a2[0] * latScale };
  const B1 = { x: b1[1] * lngScale, y: b1[0] * latScale };
  const B2 = { x: b2[1] * lngScale, y: b2[0] * latScale };
  if (segmentIntersection(A1, A2, B1, B2)) return 0;
  const d1 = pointSegmentDistanceM(a1, b1, b2);
  const d2 = pointSegmentDistanceM(a2, b1, b2);
  const d3 = pointSegmentDistanceM(b1, a1, a2);
  const d4 = pointSegmentDistanceM(b2, a1, a2);
  return Math.min(d1, d2, d3, d4);
}

function ringCentroid(ring: [number, number][]): { lat: number; lng: number } {
  let lat = 0;
  let lng = 0;
  for (const [a, b] of ring) {
    lat += a;
    lng += b;
  }
  return { lat: lat / ring.length, lng: lng / ring.length };
}

function isMissingDlsIdentity(attrs: DlsFeature["attributes"] | undefined): boolean {
  const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const vill = clean(attrs?.VILL_CODE);
  const hod = clean(attrs?.HOD_CODE);
  const sec = clean(attrs?.SECTOR_CODE);
  const parcel = clean(attrs?.PARCEL_ID).toUpperCase();
  const key = clean(attrs?.DLS_KEY);
  if (!key && (!vill || !hod || !sec || !parcel)) return true;
  return !vill && !hod && !sec && (!parcel || parcel === "0" || parcel === "00000" || parcel === "ROAD");
}

async function detectAdjacentRoadsFromNeighborParcels(
  rings: [number, number][][],
  selfDlsKey?: string | null
): Promise<DlsAdjacentRoad[]> {
  const primaryRing = rings[0]?.filter((p) => Array.isArray(p) && p.length === 2) ?? [];
  if (primaryRing.length < 3) return [];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of primaryRing) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const latPad = Math.max((maxLat - minLat) * 0.75, 0.0005);
  const lngPad = Math.max((maxLng - minLng) * 0.75, 0.0005);
  const queryGeom = {
    xmin: minLng - lngPad,
    ymin: minLat - latPad,
    xmax: maxLng + lngPad,
    ymax: maxLat + latPad,
    spatialReference: { wkid: 4326 },
  };
  const centroid = ringCentroid(primaryRing);
  const localAbort = new AbortController();
  const timer = setTimeout(() => localAbort.abort(), ROAD_LOOKUP_TIMEOUT_MS);
  try {
    const rows = await queryFeatures(
      {
        where: "1=1",
        outFields: "OBJECTID,VILL_CODE,HOD_CODE,SECTOR_CODE,PARCEL_ID,DLS_KEY,PARCEL_TYPE,STATUS,SHAPE.AREA,SHAPE.LEN",
        returnGeometry: true,
        geometry: JSON.stringify(queryGeom),
        geometryType: "esriGeometryEnvelope",
        inSR: 4326,
        spatialRel: "esriSpatialRelIntersects",
        outSR: 4326,
        resultRecordCount: 520,
        f: "json",
      },
      localAbort.signal,
      PARCEL_LAYER_URL
    );
    const bestBySide = new Map<RoadSide, { road: DlsAdjacentRoad; distance: number }>();
    const latScale = 111320;
    const lngScale = Math.cos((centroid.lat * Math.PI) / 180) * 111320;
    const edgeLengthM = (a: [number, number], b: [number, number]) =>
      Math.hypot((b[0] - a[0]) * latScale, (b[1] - a[1]) * lngScale);
    for (const feature of rows) {
      const attrs = feature.attributes;
      const fKey = (attrs?.DLS_KEY || "").trim();
      if (selfDlsKey && fKey && fKey === selfDlsKey) continue;
      const missingIdentity = isMissingDlsIdentity(attrs);
      const neighborRings = feature.geometry?.rings ?? [];
      for (const rawRing of neighborRings) {
        const nRing: [number, number][] = rawRing
          .map(([lng, lat]) => [lat, lng] as [number, number])
          .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
        if (nRing.length < 3) continue;
        let bestDist = Number.POSITIVE_INFINITY;
        let nearestEdgeIndex = -1;
        const touching: Array<{ edgeIndex: number; edgeLenM: number; edgeDist: number }> = [];
        for (let i = 0; i < primaryRing.length; i++) {
          const a = primaryRing[i]!;
          const b = primaryRing[(i + 1) % primaryRing.length]!;
          const lenM = edgeLengthM(a, b);
          if (lenM < 0.6) continue;
          let edgeBestDist = Number.POSITIVE_INFINITY;
          for (let j = 0; j < nRing.length; j++) {
            const c = nRing[j]!;
            const d = nRing[(j + 1) % nRing.length]!;
            const dist = segmentSegmentDistanceM(a, b, c, d, centroid.lat);
            if (dist < edgeBestDist) edgeBestDist = dist;
          }
          if (edgeBestDist < bestDist) {
            bestDist = edgeBestDist;
            nearestEdgeIndex = i;
          }
          if (edgeBestDist <= 2.2) touching.push({ edgeIndex: i, edgeLenM: lenM, edgeDist: edgeBestDist });
        }
        if (!touching.length && (!missingIdentity || !Number.isFinite(bestDist) || bestDist > 10 || nearestEdgeIndex < 0)) continue;
        const sharedLenM = touching.reduce((sum, item) => sum + item.edgeLenM, 0);
        if (touching.length && sharedLenM < 12) continue;
        const areaSqm = typeof attrs?.["SHAPE.AREA"] === "number" && Number.isFinite(attrs["SHAPE.AREA"]) ? attrs["SHAPE.AREA"] : null;
        const perimeterM = typeof attrs?.["SHAPE.LEN"] === "number" && Number.isFinite(attrs["SHAPE.LEN"]) ? attrs["SHAPE.LEN"] : null;
        const estimatedWidth =
          areaSqm && sharedLenM > 0
            ? Math.max(2, Math.min(80, areaSqm / sharedLenM))
            : null;
        const stripWidthEstimate =
          areaSqm && perimeterM && perimeterM > 0
            ? Math.max(2, Math.min(80, (2 * areaSqm) / perimeterM))
            : null;
        const parcelType = typeof attrs?.PARCEL_TYPE === "number" ? attrs.PARCEL_TYPE : null;
        const parcelId = (attrs?.PARCEL_ID || "").trim();
        const roadLikeType = parcelType === 0;
        const roadLikeId = !parcelId || parcelId === "0" || parcelId === "00000";
        if (!missingIdentity && !roadLikeType && !roadLikeId) continue;
        let dominant = touching[0] ?? null;
        if (dominant) {
          for (const t of touching) {
            if (t.edgeLenM > dominant.edgeLenM) dominant = t;
          }
        } else if (nearestEdgeIndex >= 0) {
          const a = primaryRing[nearestEdgeIndex]!;
          const b = primaryRing[(nearestEdgeIndex + 1) % primaryRing.length]!;
          dominant = { edgeIndex: nearestEdgeIndex, edgeLenM: edgeLengthM(a, b), edgeDist: bestDist };
        }
        if (!dominant) continue;
        if (!touching.length && (!stripWidthEstimate || stripWidthEstimate < 3 || stripWidthEstimate > 80)) {
          continue;
        }
        const p1 = primaryRing[dominant.edgeIndex]!;
        const p2 = primaryRing[(dominant.edgeIndex + 1) % primaryRing.length]!;
        const mid: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
        const side = sideFromPoint(mid, centroid);
        const widthRaw = estimatedWidth ?? stripWidthEstimate;
        const widthM = widthRaw && Number.isFinite(widthRaw) ? Math.round(widthRaw * 10) / 10 : null;
        const road: DlsAdjacentRoad = {
          id: `dls-neighbor-${attrs?.OBJECTID ?? dominant.edgeIndex}`,
          name: "Street",
          side,
          widthM,
          source: "dls-neighbor",
          path: [p1, p2],
        };
        const prev = bestBySide.get(side);
        const score = Math.max(0, bestDist) - Math.min(40, sharedLenM / 5) - (widthM ? 5 : 0);
        if (!prev || score < prev.distance) {
          bestBySide.set(side, { road, distance: score });
        }
      }
    }
    return Array.from(bestBySide.values()).map((v) => v.road);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}


function polylineLengthApproxM(path: [number, number][], refLat: number): number {
  if (path.length < 2) return 0;
  const latScale = 111320;
  const lngScale = Math.cos((refLat * Math.PI) / 180) * 111320;
  let sum = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const dx = (b[1] - a[1]) * lngScale;
    const dy = (b[0] - a[0]) * latScale;
    sum += Math.hypot(dx, dy);
  }
  return sum;
}

async function estimateRoadWidthFromNearbyMissingParcels(rings: [number, number][][]): Promise<number | null> {
  const primaryRing = rings[0]?.filter((p) => Array.isArray(p) && p.length === 2) ?? [];
  if (primaryRing.length < 3) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of primaryRing) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const latPad = Math.max((maxLat - minLat) * 0.8, 0.0006);
  const lngPad = Math.max((maxLng - minLng) * 0.8, 0.0006);
  const queryGeom = {
    xmin: minLng - lngPad,
    ymin: minLat - latPad,
    xmax: maxLng + lngPad,
    ymax: maxLat + latPad,
    spatialReference: { wkid: 4326 },
  };
  const centroid = ringCentroid(primaryRing);
  const localAbort = new AbortController();
  const timer = setTimeout(() => localAbort.abort(), ROAD_LOOKUP_TIMEOUT_MS);
  try {
    const rows = await queryFeatures(
      {
        where: "DLS_KEY IS NULL OR DLS_KEY = '' OR PARCEL_ID IS NULL OR PARCEL_ID = '' OR PARCEL_ID = '0' OR PARCEL_ID = '00000'",
        outFields: "OBJECTID,PARCEL_ID,DLS_KEY,PARCEL_TYPE,SHAPE.AREA,SHAPE.LEN",
        returnGeometry: true,
        geometry: JSON.stringify(queryGeom),
        geometryType: "esriGeometryEnvelope",
        inSR: 4326,
        spatialRel: "esriSpatialRelIntersects",
        outSR: 4326,
        resultRecordCount: 220,
        f: "json",
      },
      localAbort.signal,
      PARCEL_LAYER_URL
    );
    let best: { widthM: number; distance: number } | null = null;
    for (const feature of rows) {
      if (!isMissingDlsIdentity(feature.attributes)) continue;
      const attrs = feature.attributes;
      const areaSqm = typeof attrs?.["SHAPE.AREA"] === "number" && Number.isFinite(attrs["SHAPE.AREA"]) ? attrs["SHAPE.AREA"] : null;
      const perimeterM =
        typeof attrs?.["SHAPE.LEN"] === "number" && Number.isFinite(attrs["SHAPE.LEN"]) ? attrs["SHAPE.LEN"] : null;
      if (!areaSqm || !perimeterM || perimeterM <= 0) continue;
      const widthM = (2 * areaSqm) / perimeterM;
      if (!Number.isFinite(widthM) || widthM < 3 || widthM > 80) continue;
      const neighborRings = feature.geometry?.rings ?? [];
      let bestDist = Number.POSITIVE_INFINITY;
      for (const rawRing of neighborRings) {
        const nRing: [number, number][] = rawRing
          .map(([lng, lat]) => [lat, lng] as [number, number])
          .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
        if (nRing.length < 3) continue;
        for (let i = 0; i < primaryRing.length; i++) {
          const a = primaryRing[i]!;
          const b = primaryRing[(i + 1) % primaryRing.length]!;
          for (let j = 0; j < nRing.length; j++) {
            const c = nRing[j]!;
            const d = nRing[(j + 1) % nRing.length]!;
            const dist = segmentSegmentDistanceM(a, b, c, d, centroid.lat);
            if (dist < bestDist) bestDist = dist;
          }
        }
      }
      if (!Number.isFinite(bestDist) || bestDist > 16) continue;
      if (!best || bestDist < best.distance) {
        best = { widthM: Math.round(widthM * 10) / 10, distance: bestDist };
      }
    }
    return best?.widthM ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function detectAdjacentRoadsFromDlsLines(rings: [number, number][][]): Promise<DlsAdjacentRoad[]> {
  const primaryRing = rings[0]?.filter((p) => Array.isArray(p) && p.length === 2) ?? [];
  if (primaryRing.length < 3) return [];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of primaryRing) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const latPad = Math.max((maxLat - minLat) * 0.8, 0.00055);
  const lngPad = Math.max((maxLng - minLng) * 0.8, 0.00055);
  const queryGeom = {
    xmin: minLng - lngPad,
    ymin: minLat - latPad,
    xmax: maxLng + lngPad,
    ymax: maxLat + latPad,
    spatialReference: { wkid: 4326 },
  };
  const centroid = ringCentroid(primaryRing);
  const localAbort = new AbortController();
  const timer = setTimeout(() => localAbort.abort(), ROAD_LOOKUP_TIMEOUT_MS);
  try {
    const rows = await queryFeatures(
      {
        where: "1=1",
        outFields: "OBJECTID,SHAPE.LEN,PARCEL_LINE_TYPE",
        returnGeometry: true,
        geometry: JSON.stringify(queryGeom),
        geometryType: "esriGeometryEnvelope",
        inSR: 4326,
        spatialRel: "esriSpatialRelIntersects",
        outSR: 4326,
        resultRecordCount: 120,
        f: "json",
      },
      localAbort.signal,
      PARCEL_LINES_LAYER_URL
    );
    const bestBySide = new Map<RoadSide, { road: DlsAdjacentRoad; distance: number }>();
    let nearestOverall: { road: DlsAdjacentRoad; distance: number } | null = null;
    for (const feature of rows) {
      const rawPaths = (feature.geometry as { paths?: number[][][] } | undefined)?.paths ?? [];
      for (const rawPath of rawPaths) {
        const path: [number, number][] = rawPath
          .map(([lng, lat]) => [lat, lng] as [number, number])
          .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
        if (path.length < 2) continue;
        const shapeLen = feature.attributes?.["SHAPE.LEN"];
        const lenM =
          typeof shapeLen === "number" && Number.isFinite(shapeLen)
            ? shapeLen
            : polylineLengthApproxM(path, centroid.lat);
        // Prefer longer corridors, but do not hard-drop short segments.
        const lengthPenalty = lenM < 30 ? 25 : lenM < 70 ? 10 : 0;

        let bestDist = Number.POSITIVE_INFINITY;
        let nearestPoint: [number, number] | null = null;
        let nearestIndex = 0;
        let nearestRingIndex = 0;
        for (let pi = 0; pi < path.length - 1; pi++) {
          const r1 = path[pi]!;
          const r2 = path[pi + 1]!;
          for (let i = 0; i < primaryRing.length; i++) {
            const a = primaryRing[i]!;
            const b = primaryRing[(i + 1) % primaryRing.length]!;
            const d = segmentSegmentDistanceM(r1, r2, a, b, centroid.lat);
            if (d < bestDist) {
              bestDist = d;
              nearestPoint = [(r1[0] + r2[0]) / 2, (r1[1] + r2[1]) / 2];
              nearestIndex = pi;
              nearestRingIndex = i;
            }
          }
        }
        bestDist += lengthPenalty;
        if (!nearestPoint || !Number.isFinite(bestDist) || bestDist > 260) continue;
        const edgeStart = primaryRing[nearestRingIndex]!;
        const edgeEnd = primaryRing[(nearestRingIndex + 1) % primaryRing.length]!;
        const edgeMid: [number, number] = [(edgeStart[0] + edgeEnd[0]) / 2, (edgeStart[1] + edgeEnd[1]) / 2];
        const side = sideFromPoint(edgeMid, centroid);
        const segFrom = Math.max(0, nearestIndex - 18);
        const segTo = Math.min(path.length, nearestIndex + 19);
        const localPath = path.slice(segFrom, segTo);
        const road: DlsAdjacentRoad = {
          id: `dls-line-${feature.attributes?.OBJECTID ?? side}`,
          name: "Street",
          side,
          widthM: null,
          source: "osm-overpass",
          path: localPath.length >= 2 ? localPath : path,
        };
        const prev = bestBySide.get(side);
        if (!prev || bestDist < prev.distance) {
          bestBySide.set(side, { road, distance: bestDist });
        }
        if (!nearestOverall || bestDist < nearestOverall.distance) {
          nearestOverall = { road, distance: bestDist };
        }
      }
    }
    const bySide = Array.from(bestBySide.values()).map((v) => v.road);
    if (bySide.length) return bySide;
    if (!nearestOverall) return [];
    if (nearestOverall.road.widthM == null) {
      const inferredWidth = await estimateRoadWidthFromNearbyMissingParcels(rings);
      nearestOverall.road.widthM = inferredWidth ?? 10;
    }
    return [nearestOverall.road];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function detectNearestRoadFromDlsLines(rings: [number, number][][]): Promise<DlsAdjacentRoad[]> {
  const primaryRing = rings[0]?.filter((p) => Array.isArray(p) && p.length === 2) ?? [];
  if (primaryRing.length < 3) return [];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of primaryRing) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const latPad = Math.max((maxLat - minLat) * 1.2, 0.0012);
  const lngPad = Math.max((maxLng - minLng) * 1.2, 0.0012);
  const queryGeom = {
    xmin: minLng - lngPad,
    ymin: minLat - latPad,
    xmax: maxLng + lngPad,
    ymax: maxLat + latPad,
    spatialReference: { wkid: 4326 },
  };
  const centroid = ringCentroid(primaryRing);
  const localAbort = new AbortController();
  const timer = setTimeout(() => localAbort.abort(), ROAD_LOOKUP_TIMEOUT_MS);
  try {
    const rows = await queryFeatures(
      {
        where: "1=1",
        outFields: "OBJECTID,SHAPE.LEN,PARCEL_LINE_TYPE",
        returnGeometry: true,
        geometry: JSON.stringify(queryGeom),
        geometryType: "esriGeometryEnvelope",
        inSR: 4326,
        spatialRel: "esriSpatialRelIntersects",
        outSR: 4326,
        resultRecordCount: 220,
        f: "json",
      },
      localAbort.signal,
      PARCEL_LINES_LAYER_URL
    );
    let nearestOverall: { road: DlsAdjacentRoad; distance: number } | null = null;
    for (const feature of rows) {
      const rawPaths = (feature.geometry as { paths?: number[][][] } | undefined)?.paths ?? [];
      for (const rawPath of rawPaths) {
        const path: [number, number][] = rawPath
          .map(([lng, lat]) => [lat, lng] as [number, number])
          .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
        if (path.length < 2) continue;
        let bestDist = Number.POSITIVE_INFINITY;
        let nearestIndex = 0;
        let nearestRingIndex = 0;
        for (let pi = 0; pi < path.length - 1; pi++) {
          const r1 = path[pi]!;
          const r2 = path[pi + 1]!;
          for (let i = 0; i < primaryRing.length; i++) {
            const a = primaryRing[i]!;
            const b = primaryRing[(i + 1) % primaryRing.length]!;
            const d = segmentSegmentDistanceM(r1, r2, a, b, centroid.lat);
            if (d < bestDist) {
              bestDist = d;
              nearestIndex = pi;
              nearestRingIndex = i;
            }
          }
        }
        if (!Number.isFinite(bestDist)) continue;
        const edgeStart = primaryRing[nearestRingIndex]!;
        const edgeEnd = primaryRing[(nearestRingIndex + 1) % primaryRing.length]!;
        const edgeMid: [number, number] = [(edgeStart[0] + edgeEnd[0]) / 2, (edgeStart[1] + edgeEnd[1]) / 2];
        const side = sideFromPoint(edgeMid, centroid);
        const segFrom = Math.max(0, nearestIndex - 18);
        const segTo = Math.min(path.length, nearestIndex + 19);
        const localPath = path.slice(segFrom, segTo);
        const road: DlsAdjacentRoad = {
          id: `dls-line-nearest-${feature.attributes?.OBJECTID ?? side}`,
          name: "Street",
          side,
          widthM: null,
          source: "dls-neighbor",
          path: localPath.length >= 2 ? localPath : path,
        };
        if (!nearestOverall || bestDist < nearestOverall.distance) {
          nearestOverall = { road, distance: bestDist };
        }
      }
    }
    if (!nearestOverall) return [];
    if (nearestOverall.road.widthM == null) {
      const inferredWidth = await estimateRoadWidthFromNearbyMissingParcels(rings);
      nearestOverall.road.widthM = inferredWidth ?? 10;
    }
    return [nearestOverall.road];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function detectAdjacentRoads(
  rings: [number, number][][],
  selfDlsKey?: string | null
): Promise<DlsAdjacentRoad[]> {
  const primaryRing = rings[0]?.filter((p) => Array.isArray(p) && p.length === 2) ?? [];
  if (primaryRing.length < 3) return [];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of primaryRing) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const latPad = Math.max((maxLat - minLat) * 0.6, 0.00045);
  const lngPad = Math.max((maxLng - minLng) * 0.6, 0.00045);
  const south = minLat - latPad;
  const west = minLng - lngPad;
  const north = maxLat + latPad;
  const east = maxLng + lngPad;
  const overpassQuery = `[out:json][timeout:8];
(
  way["highway"](${south},${west},${north},${east});
);
out tags geom;`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROAD_LOOKUP_TIMEOUT_MS);
  try {
    let body: OverpassBody | null = null;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json,text/plain,*/*",
        },
        body: new URLSearchParams({ data: overpassQuery }),
        signal: controller.signal,
      });
      if (!response.ok) continue;
      body = (await response.json()) as OverpassBody;
      break;
    }
    if (!body) return [];
    const centroid = ringCentroid(primaryRing);
    const results: DlsAdjacentRoad[] = [];
    const bestBySide = new Map<RoadSide, { road: DlsAdjacentRoad; distance: number }>();
  const fallbackBySide = new Map<RoadSide, { road: DlsAdjacentRoad; distance: number }>();
  const NEAR_BOUNDARY_M = 80;
  const FAR_BOUNDARY_M = 260;
    for (const element of body.elements ?? []) {
      if (element.type !== "way") continue;
      const geom = element.geometry ?? [];
      if (geom.length < 2) continue;
      const path: [number, number][] = geom
        .map((point) => [point.lat, point.lon] as [number, number])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
      if (path.length < 2) continue;
      let bestDist = Number.POSITIVE_INFINITY;
      let nearestPoint: [number, number] | null = null;
      let nearestIndex = 0;
      let nearestRingIndex = 0;
      for (let pi = 0; pi < path.length - 1; pi++) {
        const r1 = path[pi]!;
        const r2 = path[pi + 1]!;
        for (let i = 0; i < primaryRing.length; i++) {
          const a = primaryRing[i]!;
          const b = primaryRing[(i + 1) % primaryRing.length]!;
          const d = segmentSegmentDistanceM(r1, r2, a, b, centroid.lat);
          if (d < bestDist) {
            bestDist = d;
            nearestPoint = [(r1[0] + r2[0]) / 2, (r1[1] + r2[1]) / 2];
            nearestIndex = pi;
            nearestRingIndex = i;
          }
        }
      }
      if (!Number.isFinite(bestDist) || !nearestPoint || bestDist > FAR_BOUNDARY_M) continue;
      const tags = element.tags ?? {};
      const roadName = tags.name || tags["name:ar"] || tags.ref || "Street";
      const widthExplicit = parseRoadWidthMeters(tags.width);
      const widthM = widthExplicit ?? defaultRoadWidthM(tags);
      const edgeStart = primaryRing[nearestRingIndex]!;
      const edgeEnd = primaryRing[(nearestRingIndex + 1) % primaryRing.length]!;
      const edgeMid: [number, number] = [(edgeStart[0] + edgeEnd[0]) / 2, (edgeStart[1] + edgeEnd[1]) / 2];
      const side = sideFromPoint(edgeMid, centroid);
      // Keep only a local segment around the nearest point to avoid drawing remote geometry.
      const segFrom = Math.max(0, nearestIndex - 14);
      const segTo = Math.min(path.length, nearestIndex + 15);
      const localPath = path.slice(segFrom, segTo);
      const road: DlsAdjacentRoad = {
        id: `osm-${element.id}`,
        name: roadName,
        side,
        widthM,
        source: "osm-overpass",
        path: localPath.length >= 2 ? localPath : path,
      };
      if (bestDist <= NEAR_BOUNDARY_M) {
        const prev = bestBySide.get(side);
        if (!prev || bestDist < prev.distance) {
          bestBySide.set(side, { road, distance: bestDist });
        }
      } else {
        const prev = fallbackBySide.get(side);
        if (!prev || bestDist < prev.distance) {
          fallbackBySide.set(side, { road, distance: bestDist });
        }
      }
    }
    if (!bestBySide.size) {
      for (const [side, candidate] of fallbackBySide.entries()) {
        bestBySide.set(side, candidate);
      }
    }
    for (const { road } of bestBySide.values()) results.push(road);
    if (results.length) return results;
    const neighborBased = await detectAdjacentRoadsFromNeighborParcels(rings, selfDlsKey);
    if (neighborBased.length) return neighborBased;
    return await detectAdjacentRoadsFromDlsLines(rings);
  } catch {
    const neighborBased = await detectAdjacentRoadsFromNeighborParcels(rings, selfDlsKey);
    if (neighborBased.length) return neighborBased;
    return await detectAdjacentRoadsFromDlsLines(rings);
  } finally {
    clearTimeout(timer);
  }
}

async function featureToResult(
  feature: DlsFeature | null,
  fallbackCodes: { villageCode: string; basinCode: string; sectorCode: string; parcelId: string } | null
): Promise<DlsParcelLocationResult | null> {
  if (!feature?.geometry?.rings?.length) return null;
  const center = centroidOfRings(feature.geometry.rings);
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return null;

  const rings: [number, number][][] = feature.geometry.rings.map((ring) =>
    ring.map(([lng, lat]) => [lat, lng] as [number, number])
  );
  const villageCode = feature.attributes?.VILL_CODE || fallbackCodes?.villageCode || "";
  const basinCode = feature.attributes?.HOD_CODE || fallbackCodes?.basinCode || "";
  const sectorCode = feature.attributes?.SECTOR_CODE || fallbackCodes?.sectorCode || "";
  const parcelId = feature.attributes?.PARCEL_ID || fallbackCodes?.parcelId || "";
  if (!villageCode || !basinCode || !sectorCode || !parcelId) return null;

  const areaRaw = feature.attributes?.["SHAPE.AREA"];
  const lenRaw = feature.attributes?.["SHAPE.LEN"];

  // Street detection is intentionally disabled: UI now relies on parcel-grid context only.
  const adjacentRoads: DlsAdjacentRoad[] = [];

  return {
    latitude: center.lat,
    longitude: center.lng,
    rings,
    dlsKey: feature.attributes?.DLS_KEY || `${villageCode}${basinCode}${sectorCode}${parcelId}`,
    villageCode,
    basinCode,
    sectorCode,
    parcelId,
    sheetNo: feature.attributes?.SHEET_NO ?? null,
    areaSqm: typeof areaRaw === "number" && Number.isFinite(areaRaw) ? areaRaw : null,
    perimeterM: typeof lenRaw === "number" && Number.isFinite(lenRaw) ? lenRaw : null,
    adjacentRoads,
    source: "DLS Cadastral Map",
    sourceUrl: SOURCE_URL,
  };
}

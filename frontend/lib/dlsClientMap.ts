"use client";

/**
 * Browser-side DLS ArcGIS queries.
 * Token is fetched from our API (gettoken has no CORS); MapServer calls go
 * straight from the user device to maps.dls.gov.jo.
 *
 * Requests are gated + cached (see dlsMapCache) so pan/zoom stays light.
 */

import {
  getCachedAdmin,
  getCachedParcels,
  padBBox,
  runDlsQuery,
  setCachedAdmin,
  setCachedParcels,
  type BBox,
} from "@/lib/dlsMapCache";

export type DlsAdminLayer = "governorates" | "directorates" | "basins";

export type DlsAdminFeature = {
  id: string;
  layer: DlsAdminLayer;
  nameAr: string | null;
  nameEn: string | null;
  rings: [number, number][][];
};

export type DlsContextParcel = {
  dlsKey: string | null;
  parcelNo: string | null;
  rings: [number, number][][];
  isSubject: boolean;
};

const PARCEL_LAYER_URL =
  "https://maps.dls.gov.jo/arcgis/rest/services/DLS_Cassini_Service_STG/MapServer/3/query";
const GOVERNORATE_LAYER_URL =
  "https://maps.dls.gov.jo/arcgis/rest/services/DLS_Layers_Service_STG/MapServer/16/query";
const DIRECTORATE_LAYER_URL =
  "https://maps.dls.gov.jo/arcgis/rest/services/DLS_Cassini_Service_STG/MapServer/7/query";
const BASIN_LAYER_URL =
  "https://maps.dls.gov.jo/arcgis/rest/services/DLS_Cassini_Service_STG/MapServer/6/query";

type DlsFeature = {
  attributes?: Record<string, unknown>;
  geometry?: { rings?: number[][][] };
};

type DlsQueryBody = {
  error?: { code?: number; message?: string };
  features?: DlsFeature[];
};

let tokenCache: { token: string; expiresAt: number } | null = null;
let tokenInflight: Promise<string> | null = null;

async function getClientDlsToken(signal?: AbortSignal): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - 60_000 > now) return tokenCache.token;
  if (tokenInflight) return tokenInflight;

  tokenInflight = (async () => {
    const res = await fetch("/api/submissions/dls-map-token", {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "default",
    });
    if (!res.ok) throw new Error(`dls-token-${res.status}`);
    const body = (await res.json()) as { token?: string; expiresAt?: number };
    if (!body.token) throw new Error("dls-token-missing");
    tokenCache = {
      token: body.token,
      expiresAt:
        typeof body.expiresAt === "number" && body.expiresAt > now
          ? body.expiresAt
          : now + 30 * 60_000,
    };
    return tokenCache.token;
  })();

  try {
    return await tokenInflight;
  } finally {
    tokenInflight = null;
  }
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

function strAttr(attrs: Record<string, unknown> | undefined, key: string): string | null {
  const v = attrs?.[key];
  if (typeof v === "string") {
    const t = v.trim();
    return t || null;
  }
  return null;
}

function numAttr(attrs: Record<string, unknown> | undefined, key: string): number | null {
  const v = attrs?.[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function featureToAdmin(layer: DlsAdminLayer, feature: DlsFeature): DlsAdminFeature | null {
  const rings = ringsFromFeature(feature);
  if (!rings.length) return null;
  const attrs = feature.attributes ?? {};
  if (layer === "governorates") {
    const id = numAttr(attrs, "GOV_ID") ?? numAttr(attrs, "OBJECTID");
    if (id == null) return null;
    return {
      id: `gov-${id}`,
      layer,
      nameAr: strAttr(attrs, "GOVERNARATE_NAME_A"),
      nameEn: strAttr(attrs, "GOVERNARATE_NAME_E"),
      rings,
    };
  }
  if (layer === "directorates") {
    const id = numAttr(attrs, "DIR_ID") ?? numAttr(attrs, "OBJECTID");
    if (id == null) return null;
    return {
      id: `dir-${id}`,
      layer,
      nameAr: strAttr(attrs, "DIRECTORATE_NAME_A"),
      nameEn: strAttr(attrs, "DIRECTORATE_NAME_E"),
      rings,
    };
  }
  const vill = strAttr(attrs, "VILL_CODE") || "";
  const hod = strAttr(attrs, "HOD_CODE") || "";
  const oid = numAttr(attrs, "OBJECTID");
  const id = vill && hod ? `${vill}-${hod}` : oid != null ? String(oid) : null;
  if (!id) return null;
  return {
    id: `basin-${id}`,
    layer,
    nameAr: strAttr(attrs, "HOD_NAME_A"),
    nameEn: strAttr(attrs, "HOD_NAME_E"),
    rings,
  };
}

async function queryFeatures(
  endpoint: string,
  params: Record<string, string | number | boolean>,
  signal?: AbortSignal,
  gateKey?: string
): Promise<DlsFeature[]> {
  async function run(token: string): Promise<DlsQueryBody> {
    const url = new URL(endpoint);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    url.searchParams.set("token", token);
    const res = await fetch(url.toString(), {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
      // Never send our site cookies to the government map host.
      credentials: "omit",
      referrerPolicy: "strict-origin-when-cross-origin",
    });
    if (!res.ok) throw new Error(`dls-query-${res.status}`);
    return (await res.json()) as DlsQueryBody;
  }

  const exec = async () => {
    let token = await getClientDlsToken(signal);
    let body = await run(token);
    if (body.error?.code === 499) {
      tokenCache = null;
      token = await getClientDlsToken(signal);
      body = await run(token);
    }
    if (body.error) throw new Error(body.error.message || "dls-query-failed");
    return body.features ?? [];
  };

  if (!gateKey) return exec();
  return runDlsQuery(gateKey, signal, exec);
}

let governoratesMem: { at: number; features: DlsAdminFeature[] } | null = null;
const GOV_CACHE_MS = 6 * 60 * 60 * 1000;

/** Progressive admin boundaries — runs on the user device against DLS ArcGIS. */
export async function fetchDlsAdminByBboxClient(params: {
  layer: DlsAdminLayer;
  west: number;
  south: number;
  east: number;
  north: number;
  zoom?: number;
  maxAllowableOffset?: number;
  resultRecordCount?: number;
  signal?: AbortSignal;
}): Promise<DlsAdminFeature[]> {
  const { layer, west, south, east, north, signal } = params;
  if (layer === "governorates" && governoratesMem && Date.now() - governoratesMem.at < GOV_CACHE_MS) {
    return governoratesMem.features;
  }

  const view: BBox = { west, south, east, north };
  const zoom = typeof params.zoom === "number" ? params.zoom : 12;
  if (layer !== "governorates") {
    const hit = getCachedAdmin<DlsAdminFeature[]>(layer, view, zoom);
    if (hit) return hit;
  }

  const fetchBox = layer === "governorates" ? view : padBBox(view, 0.4);
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
      ? Math.min(200, Math.max(1, Math.floor(params.resultRecordCount)))
      : layer === "governorates"
        ? 30
        : layer === "directorates"
          ? 60
          : 80;

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
      xmin: fetchBox.west,
      ymin: fetchBox.south,
      xmax: fetchBox.east,
      ymax: fetchBox.north,
      spatialReference: { wkid: 4326 },
    });
    query.geometryType = "esriGeometryEnvelope";
    query.inSR = 4326;
    query.spatialRel = "esriSpatialRelIntersects";
  }

  const gateKey = `admin|${layer}|${fetchBox.west.toFixed(3)}|${fetchBox.south.toFixed(3)}|${fetchBox.east.toFixed(3)}|${fetchBox.north.toFixed(3)}`;
  const rows = await queryFeatures(adminEndpoint(layer), query, signal, gateKey);
  const list: DlsAdminFeature[] = [];
  for (const row of rows) {
    const item = featureToAdmin(layer, row);
    if (item) list.push(item);
  }
  if (layer === "governorates") {
    governoratesMem = { at: Date.now(), features: list };
  } else {
    setCachedAdmin(layer, fetchBox, zoom, list);
  }
  return list;
}

function normalizeParcelNo(value: unknown): string | null {
  let raw = "";
  if (typeof value === "number" && Number.isFinite(value)) {
    raw = String(Math.trunc(value));
  } else if (typeof value === "string") {
    raw = value.trim();
  } else {
    return null;
  }
  if (!raw || raw === "0" || /^0+$/.test(raw)) return null;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return String(Math.trunc(n));
  return raw;
}

/** Prefer PARCEL_ID; ArcGIS often returns it as a number. Fall back to DLS_KEY tail. */
function parcelNoFromAttrs(attrs: Record<string, unknown> | undefined): string | null {
  const fromId = normalizeParcelNo(attrs?.PARCEL_ID);
  if (fromId) return fromId;
  const keyRaw = attrs?.DLS_KEY;
  const key =
    typeof keyRaw === "number" && Number.isFinite(keyRaw)
      ? String(Math.trunc(keyRaw))
      : typeof keyRaw === "string"
        ? keyRaw.trim()
        : "";
  if (key.length >= 5) {
    return normalizeParcelNo(key.slice(-5));
  }
  return null;
}

/**
 * Hard ceiling per request — denser than this tanks phones and hammers DLS.
 * Prefer zoom-scaled limits via parcelRecordLimitForZoom().
 */
export const DLS_PARCEL_GRID_MAX = 1200;

export function parcelSimplifyOffsetForZoom(zoom: number): number {
  if (zoom < 14) return 0.00055;
  if (zoom < 14.5) return 0.00038;
  if (zoom < 15.5) return 0.00022;
  if (zoom < 16.5) return 0.00012;
  return 0.00006;
}

export function parcelRecordLimitForZoom(zoom: number): number {
  if (zoom < 14) return 400;
  if (zoom < 15) return 700;
  if (zoom < 16) return 900;
  if (zoom < 17) return 1100;
  return DLS_PARCEL_GRID_MAX;
}

/**
 * Parcel grid for the visible map. Pads + caches the bbox so small pans
 * reuse the last payload instead of re-hitting ArcGIS.
 */
export async function fetchDlsParcelsByBboxClient(params: {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom?: number;
  maxAllowableOffset?: number;
  resultRecordCount?: number;
  subjectDlsKey?: string | null;
  subjectParcelNo?: string | null;
  signal?: AbortSignal;
}): Promise<DlsContextParcel[]> {
  const { west, south, east, north, signal } = params;
  if (![west, south, east, north].every(Number.isFinite) || east <= west || north <= south) {
    return [];
  }
  const view: BBox = { west, south, east, north };
  const zoom = typeof params.zoom === "number" && Number.isFinite(params.zoom) ? params.zoom : 15;
  const cached = getCachedParcels<DlsContextParcel[]>(view, zoom);
  if (cached) {
    return tagSubject(cached, params.subjectDlsKey, params.subjectParcelNo);
  }

  const fetchBox = padBBox(view, 0.35);
  const offset =
    typeof params.maxAllowableOffset === "number" && Number.isFinite(params.maxAllowableOffset)
      ? Math.max(0, params.maxAllowableOffset)
      : parcelSimplifyOffsetForZoom(zoom);
  const limit = Math.min(
    DLS_PARCEL_GRID_MAX,
    Math.max(
      80,
      typeof params.resultRecordCount === "number" && Number.isFinite(params.resultRecordCount)
        ? Math.floor(params.resultRecordCount)
        : parcelRecordLimitForZoom(zoom)
    )
  );

  const gateKey = `parcels|${fetchBox.west.toFixed(3)}|${fetchBox.south.toFixed(3)}|${fetchBox.east.toFixed(3)}|${fetchBox.north.toFixed(3)}|${limit}`;
  const rows = await queryFeatures(
    PARCEL_LAYER_URL,
    {
      where: "1=1",
      outFields: "DLS_KEY,PARCEL_ID",
      returnGeometry: true,
      geometry: JSON.stringify({
        xmin: fetchBox.west,
        ymin: fetchBox.south,
        xmax: fetchBox.east,
        ymax: fetchBox.north,
        spatialReference: { wkid: 4326 },
      }),
      geometryType: "esriGeometryEnvelope",
      inSR: 4326,
      spatialRel: "esriSpatialRelIntersects",
      outSR: 4326,
      maxAllowableOffset: offset,
      resultRecordCount: limit,
      f: "json",
    },
    signal,
    gateKey
  );

  const list: DlsContextParcel[] = [];
  for (const row of rows) {
    const rings = ringsFromFeature(row);
    if (!rings.length) continue;
    const dlsKey = strAttr(row.attributes, "DLS_KEY");
    const parcelNo = parcelNoFromAttrs(row.attributes);
    list.push({ dlsKey, parcelNo, rings, isSubject: false });
  }
  setCachedParcels(fetchBox, zoom, list);
  return tagSubject(list, params.subjectDlsKey, params.subjectParcelNo);
}

function tagSubject(
  parcels: DlsContextParcel[],
  subjectDlsKey?: string | null,
  subjectParcelNo?: string | null
): DlsContextParcel[] {
  const subjectKey = (subjectDlsKey || "").trim() || null;
  const subjectNo = normalizeParcelNo(subjectParcelNo ?? null);
  const list = parcels.map((p) => ({
    ...p,
    isSubject: Boolean(
      (subjectKey && p.dlsKey && p.dlsKey === subjectKey) ||
        (subjectNo && p.parcelNo && p.parcelNo === subjectNo)
    ),
  }));
  list.sort(
    (a, b) =>
      Number(b.isSubject) - Number(a.isSubject) ||
      Number(Boolean(b.parcelNo)) - Number(Boolean(a.parcelNo))
  );
  return list;
}

/** Neighbor parcel grid around a point — used as fallback when map bounds unavailable. */
export async function fetchDlsContextByPointClient(params: {
  latitude: number;
  longitude: number;
  signal?: AbortSignal;
}): Promise<DlsContextParcel[]> {
  const lat = Number(params.latitude);
  const lng = Number(params.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  // ~1.2 km half-span — enough for a parcel-zoom viewport without a huge pull.
  const pad = 0.011;
  return fetchDlsParcelsByBboxClient({
    west: lng - pad,
    south: lat - pad,
    east: lng + pad,
    north: lat + pad,
    zoom: 15,
    maxAllowableOffset: 0.00022,
    resultRecordCount: parcelRecordLimitForZoom(15),
    signal: params.signal,
  });
}

"use client";

/**
 * Browser-side DLS ArcGIS queries.
 * Token is fetched from our API (gettoken has no CORS); MapServer calls go
 * straight from the user device to maps.dls.gov.jo.
 */

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
      cache: "no-store",
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
  signal?: AbortSignal
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
    });
    if (!res.ok) throw new Error(`dls-query-${res.status}`);
    return (await res.json()) as DlsQueryBody;
  }

  let token = await getClientDlsToken(signal);
  let body = await run(token);
  if (body.error?.code === 499) {
    tokenCache = null;
    token = await getClientDlsToken(signal);
    body = await run(token);
  }
  if (body.error) throw new Error(body.error.message || "dls-query-failed");
  return body.features ?? [];
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
  maxAllowableOffset?: number;
  resultRecordCount?: number;
  signal?: AbortSignal;
}): Promise<DlsAdminFeature[]> {
  const { layer, west, south, east, north, signal } = params;
  if (layer === "governorates" && governoratesMem && Date.now() - governoratesMem.at < GOV_CACHE_MS) {
    return governoratesMem.features;
  }

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

  const rows = await queryFeatures(adminEndpoint(layer), query, signal);
  const list: DlsAdminFeature[] = [];
  for (const row of rows) {
    const item = featureToAdmin(layer, row);
    if (item) list.push(item);
  }
  if (layer === "governorates") {
    governoratesMem = { at: Date.now(), features: list };
  }
  return list;
}

function normalizeParcelNo(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return String(Math.trunc(n));
  return raw;
}

/** Practical ceiling — DLS allows more, but 3k keeps phones responsive. */
export const DLS_PARCEL_GRID_MAX = 3000;

export function parcelSimplifyOffsetForZoom(zoom: number): number {
  if (zoom < 14.5) return 0.0004;
  if (zoom < 15.5) return 0.00022;
  if (zoom < 16.5) return 0.00012;
  return 0.00005;
}

/**
 * Parcel grid for the visible map (DLS-style): as far as the viewport,
 * simplified geometry so ~2–3k lots load in roughly half a second.
 */
export async function fetchDlsParcelsByBboxClient(params: {
  west: number;
  south: number;
  east: number;
  north: number;
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
  const offset =
    typeof params.maxAllowableOffset === "number" && Number.isFinite(params.maxAllowableOffset)
      ? Math.max(0, params.maxAllowableOffset)
      : 0.00015;
  const limit = Math.min(
    DLS_PARCEL_GRID_MAX,
    Math.max(
      100,
      typeof params.resultRecordCount === "number" && Number.isFinite(params.resultRecordCount)
        ? Math.floor(params.resultRecordCount)
        : DLS_PARCEL_GRID_MAX
    )
  );

  const rows = await queryFeatures(
    PARCEL_LAYER_URL,
    {
      where: "1=1",
      outFields: "DLS_KEY,PARCEL_ID",
      returnGeometry: true,
      geometry: JSON.stringify({
        xmin: west,
        ymin: south,
        xmax: east,
        ymax: north,
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
    signal
  );

  const subjectKey = (params.subjectDlsKey || "").trim() || null;
  const subjectNo = normalizeParcelNo(params.subjectParcelNo ?? null);
  const list: DlsContextParcel[] = [];
  for (const row of rows) {
    const rings = ringsFromFeature(row);
    if (!rings.length) continue;
    const dlsKey = strAttr(row.attributes, "DLS_KEY");
    const parcelNo = normalizeParcelNo(row.attributes?.PARCEL_ID);
    const isSubject = Boolean(
      (subjectKey && dlsKey && dlsKey === subjectKey) ||
        (subjectNo && parcelNo && parcelNo === subjectNo)
    );
    list.push({ dlsKey, parcelNo, rings, isSubject });
  }
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

  // ~2 km half-span — fills a typical parcel-zoom viewport.
  const pad = 0.018;
  return fetchDlsParcelsByBboxClient({
    west: lng - pad,
    south: lat - pad,
    east: lng + pad,
    north: lat + pad,
    maxAllowableOffset: 0.0002,
    resultRecordCount: DLS_PARCEL_GRID_MAX,
    signal: params.signal,
  });
}

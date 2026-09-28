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
const SOURCE_URL = "https://maps.dls.gov.jo/dlsweb/";
const LOOKUP_TIMEOUT_MS = 12_000;

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
  source: "DLS Cadastral Map";
  sourceUrl: string;
}

export class DlsParcelLocationError extends Error {}

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

  const where = [
    `VILL_CODE='${villageCode}'`,
    `HOD_CODE='${basinCode}'`,
    `SECTOR_CODE='${sectorCode}'`,
    `PARCEL_ID='${parcelId}'`,
  ].join(" AND ");

  const url = new URL(PARCEL_LAYER_URL);
  url.searchParams.set("where", where);
  url.searchParams.set(
    "outFields",
    "VILL_CODE,HOD_CODE,SECTOR_CODE,PARCEL_ID,DLS_KEY,SHEET_NO,SHAPE.AREA,SHAPE.LEN"
  );
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("f", "json");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new DlsParcelLocationError(`DLS map service returned HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      error?: { message?: string };
      features?: Array<{
        attributes?: {
          VILL_CODE?: string;
          HOD_CODE?: string;
          SECTOR_CODE?: string;
          PARCEL_ID?: string;
          DLS_KEY?: string;
          SHEET_NO?: string | null;
          "SHAPE.AREA"?: number | null;
          "SHAPE.LEN"?: number | null;
        };
        geometry?: { rings?: number[][][] };
      }>;
    };
    if (body.error) {
      throw new DlsParcelLocationError(body.error.message || "DLS map query failed");
    }
    const feature = body.features?.[0];
    if (!feature?.geometry?.rings?.length) return null;

    const center = centroidOfRings(feature.geometry.rings);
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return null;

    const rings: [number, number][][] = feature.geometry.rings.map((ring) =>
      ring.map(([lng, lat]) => [lat, lng] as [number, number])
    );

    const areaRaw = feature.attributes?.["SHAPE.AREA"];
    const lenRaw = feature.attributes?.["SHAPE.LEN"];

    return {
      latitude: center.lat,
      longitude: center.lng,
      rings,
      dlsKey: feature.attributes?.DLS_KEY || `${villageCode}${basinCode}${sectorCode}${parcelId}`,
      villageCode,
      basinCode,
      sectorCode,
      parcelId: feature.attributes?.PARCEL_ID || parcelId,
      sheetNo: feature.attributes?.SHEET_NO ?? null,
      areaSqm: typeof areaRaw === "number" && Number.isFinite(areaRaw) ? areaRaw : null,
      perimeterM: typeof lenRaw === "number" && Number.isFinite(lenRaw) ? lenRaw : null,
      source: "DLS Cadastral Map",
      sourceUrl: SOURCE_URL,
    };
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

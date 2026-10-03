import { ApiError } from "@/lib/api";
import { parseParcelNumbers } from "@/lib/parcelNumbers";

export type ParcelLocationResult = {
  latitude: number;
  longitude: number;
  rings: [number, number][][];
  dlsKey: string;
  villageCode: string;
  basinCode: string;
  sectorCode: string;
  parcelId: string;
  sheetNo: string | null;
  areaSqm: number | null;
  perimeterM: number | null;
  source: string;
  sourceUrl: string;
};

export type ParcelCodes = {
  villageCode: string;
  basinCode: string;
  sectorCode: string;
};

type LookupFn = (data: ParcelCodes & { parcelNumber: string }) => Promise<ParcelLocationResult>;

function isMissingParcel(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

/**
 * Fetch one or more cadastral parcels and merge rings / area / perimeter.
 * Multi-parcel fields like "706, 707, 708, 709" are split and queried individually.
 * Missing parcels (404) are skipped so adjacent valid parcels still render.
 */
export async function fetchMergedParcelLocation(
  codes: ParcelCodes,
  parcelField: string,
  lookup: LookupFn
): Promise<ParcelLocationResult> {
  const numbers = parseParcelNumbers(parcelField);
  if (!numbers.length) {
    throw new Error("No parcel numbers");
  }

  const results: ParcelLocationResult[] = [];
  let lastError: unknown = null;
  // Sequential keeps DLS rate limits happy; 4 parcels ≈ 5–6s total.
  for (const parcelNumber of numbers) {
    try {
      results.push(await lookup({ ...codes, parcelNumber }));
    } catch (err) {
      lastError = err;
      if (isMissingParcel(err)) continue;
      // Non-404 on a single parcel: still try the rest; fail only if none succeed.
    }
  }

  if (!results.length) {
    if (lastError) throw lastError;
    throw new Error("No parcel geometry");
  }

  const rings = results.flatMap((r) => r.rings);
  let areaSum = 0;
  let periSum = 0;
  let areaOk = false;
  let periOk = false;
  let latSum = 0;
  let lngSum = 0;
  for (const r of results) {
    if (r.areaSqm != null && Number.isFinite(r.areaSqm)) {
      areaSum += r.areaSqm;
      areaOk = true;
    }
    if (r.perimeterM != null && Number.isFinite(r.perimeterM)) {
      periSum += r.perimeterM;
      periOk = true;
    }
    latSum += r.latitude;
    lngSum += r.longitude;
  }

  const first = results[0]!;
  return {
    latitude: latSum / results.length,
    longitude: lngSum / results.length,
    rings,
    dlsKey: results.map((r) => r.dlsKey).join("+"),
    villageCode: first.villageCode,
    basinCode: first.basinCode,
    sectorCode: first.sectorCode,
    parcelId: results.map((r) => r.parcelId).join(","),
    sheetNo: first.sheetNo,
    areaSqm: areaOk ? areaSum : null,
    perimeterM: periOk ? periSum : null,
    source: first.source,
    sourceUrl: first.sourceUrl,
  };
}

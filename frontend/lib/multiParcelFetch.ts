export type ParcelLookupCodes = {
  villageCode: string;
  basinCode: string;
  sectorCode: string;
};

export type ParcelLocationItem = {
  parcelNo: string;
  latitude: number;
  longitude: number;
  rings: [number, number][][];
  adjacentRoads: Array<{
    id: string;
    name: string;
    side: "north" | "south" | "east" | "west";
    widthM: number | null;
    source: "osm-overpass" | "google-maps" | "dls-neighbor";
    path: [number, number][];
  }>;
  areaSqm: number | null;
  perimeterM: number | null;
  dlsKey: string;
};

export async function fetchAndMergeParcelLocations(
  parcelNos: string[],
  codes: ParcelLookupCodes,
  fetchOne: (payload: ParcelLookupCodes & { parcelNumber: string }) => Promise<{
    latitude: number;
    longitude: number;
    rings: [number, number][][];
    adjacentRoads: Array<{
      id: string;
      name: string;
      side: "north" | "south" | "east" | "west";
      widthM: number | null;
      source: "osm-overpass" | "google-maps" | "dls-neighbor";
      path: [number, number][];
    }>;
    dlsKey: string;
    areaSqm: number | null;
    perimeterM: number | null;
  }>
): Promise<{ items: ParcelLocationItem[]; missing: string[] }> {
  const unique = Array.from(new Set(parcelNos.map((p) => p.trim()).filter(Boolean)));
  if (!unique.length) return { items: [], missing: [] };
  const settled = await Promise.allSettled(
    unique.map(async (parcelNo) => ({
      parcelNo,
      location: await fetchOne({ ...codes, parcelNumber: parcelNo }),
    }))
  );
  const items: ParcelLocationItem[] = [];
  const missing: string[] = [];
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    const { parcelNo, location } = result.value;
    if (!location.rings?.[0]?.length) {
      missing.push(parcelNo);
      continue;
    }
    items.push({
      parcelNo,
      latitude: location.latitude,
      longitude: location.longitude,
      rings: location.rings,
      adjacentRoads: location.adjacentRoads ?? [],
      areaSqm: location.areaSqm ?? null,
      perimeterM: location.perimeterM ?? null,
      dlsKey: location.dlsKey,
    });
  }
  for (const parcelNo of unique) {
    if (!items.find((item) => item.parcelNo === parcelNo) && !missing.includes(parcelNo)) {
      missing.push(parcelNo);
    }
  }
  return { items, missing };
}

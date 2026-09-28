export interface DlsOption {
  value: string;
  label: string;
}

export interface DlsBasin extends DlsOption {
  neighborhoods: DlsOption[];
}

export interface DlsVillage extends DlsOption {
  basins: DlsBasin[];
}

export interface DlsDirectorate extends DlsOption {
  villages: DlsVillage[];
}

export interface DlsGovernorate extends DlsOption {
  directorates: DlsDirectorate[];
}

export interface DlsData {
  governorates: DlsGovernorate[];
}

let cache: Promise<DlsData> | null = null;

export function loadDlsLocations(): Promise<DlsData> {
  if (!cache) {
    cache = fetch("/data/dls-locations.json")
      .then((res) => (res.ok ? res.json() : { governorates: [] }))
      .catch(() => ({ governorates: [] }));
  }
  return cache;
}

export function directoratesForGovernorate(data: DlsData, governorateLabel: string): DlsDirectorate[] {
  return data.governorates.find((g) => g.label === governorateLabel)?.directorates ?? [];
}

export function villagesForDirectorate(data: DlsData, governorateLabel: string, directorateLabel: string): DlsVillage[] {
  const directorates = directoratesForGovernorate(data, governorateLabel);
  return directorates.find((d) => d.label === directorateLabel)?.villages ?? [];
}

// Government basin/neighborhood labels carry their official number in parentheses
// (e.g. "قطنة الجنوبي(3)", "(7) ابو عبيده") — sort by that number rather than the
// scrape order or a string sort, which would put "10" before "2".
function embeddedNumber(label: string): number {
  const match = label.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
}

function sortByEmbeddedNumber<T extends DlsOption>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const diff = embeddedNumber(a.label) - embeddedNumber(b.label);
    return diff !== 0 ? diff : a.label.localeCompare(b.label, "ar");
  });
}

// On the official DLS form (apex-dls.dls.gov.jo), basins without a per-block
// neighborhood breakdown still expose a real option named "جدول الأحياء"
// (value 0). That is the correct selection there — keep it. Only blank
// labels from scrape noise are dropped.
const JUNK_NEIGHBORHOOD_LABELS = new Set([""]);

export function basinsForVillage(
  data: DlsData,
  governorateLabel: string,
  directorateLabel: string,
  villageLabel: string
): DlsBasin[] {
  const villages = villagesForDirectorate(data, governorateLabel, directorateLabel);
  const basins = villages.find((v) => v.label === villageLabel)?.basins ?? [];
  return sortByEmbeddedNumber(basins);
}

export function neighborhoodsForBasin(
  data: DlsData,
  governorateLabel: string,
  directorateLabel: string,
  villageLabel: string,
  basinLabel: string
): DlsOption[] {
  const basins = basinsForVillage(data, governorateLabel, directorateLabel, villageLabel);
  const neighborhoods = basins.find((b) => b.label === basinLabel)?.neighborhoods ?? [];
  return sortByEmbeddedNumber(neighborhoods.filter((n) => !JUNK_NEIGHBORHOOD_LABELS.has(n.label.trim())));
}

/** Resolve the numeric cadastral codes for a selected cascade path — used to
 * query the DLS ArcGIS parcel layer (VILL_CODE / HOD_CODE / SECTOR_CODE). */
export function codesForSelection(
  data: DlsData,
  governorateLabel: string,
  directorateLabel: string,
  villageLabel: string,
  basinLabel: string,
  neighborhoodLabel: string
): { villageCode: string; basinCode: string; sectorCode: string } | null {
  const village = villagesForDirectorate(data, governorateLabel, directorateLabel).find((v) => v.label === villageLabel);
  const basin = village?.basins.find((b) => b.label === basinLabel);
  const neighborhood = basin?.neighborhoods.find((n) => n.label === neighborhoodLabel);
  if (!village?.value || !basin?.value || neighborhood?.value === undefined || neighborhood?.value === "") {
    return null;
  }
  return {
    villageCode: village.value,
    basinCode: basin.value,
    sectorCode: neighborhood.value,
  };
}

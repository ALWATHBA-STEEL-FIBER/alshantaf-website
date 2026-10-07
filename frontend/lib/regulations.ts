import type { IndustryType } from "./types";
import { SETBACKS, type SetbackInfo } from "./setbacks";

export type RegulationProfile = {
  key: IndustryType;
  setbacks: SetbackInfo;
};

/** Industrial classifications used on listings / owner publish forms. */
export const INDUSTRIAL_ORDER: IndustryType[] = [
  "lightSpecial",
  "light",
  "mediumSpecial",
  "medium",
  "industrialCraft",
  "industrialHeavy",
  "industrialTransformative",
  "industrialGeneral",
  "agriToIndustrial",
  "technical",
];

/** Residential + agricultural zoning (Amman detailed + general). */
export const RESIDENTIAL_ORDER: IndustryType[] = [
  "residentialA",
  "residentialB",
  "residentialC",
  "residentialD",
  "residentialPopular",
  "residentialHighDensity",
  "greenWithinA",
  "greenWithinB",
  "greenWithinC",
  "greenWithinD",
  "residentialPrivateA",
  "residentialPrivateB",
  "residentialPrivateC",
  "residentialRural",
  "residentialGreen",
  "residentialAgri",
  "agriFacilities",
];

/** Commercial inside Amman Governorate (GAM / أمانة عمّان). */
export const COMMERCIAL_AMMAN_ORDER: IndustryType[] = [
  "commercialCentral",
  "commercialShowrooms",
  "commercialLinear",
  "commercialOffice",
  "commercialIndustrial",
  "commercialNeighborhoodService",
  "commercialCenter",
  "commercialOrdinaryA",
  "commercialOrdinaryB",
  "commercialOrdinaryC",
  "commercialWithinD",
  "commercialLocal",
  "commercialComplex",
  "mixedUse",
  "mixedUseUrban",
  "mixedUseEntertainment",
];

/**
 * Commercial outside Amman — same structural classes as the general commercial
 * table, with guidance to confirm with the local municipality.
 */
export const COMMERCIAL_OUTSIDE_ORDER: IndustryType[] = [
  "commercialOutsideCentral",
  "commercialOutsideShowrooms",
  "commercialOutsideLinear",
  "commercialOutsideLocal",
];

/** @deprecated Prefer COMMERCIAL_AMMAN_ORDER + COMMERCIAL_OUTSIDE_ORDER. */
export const COMMERCIAL_ORDER: IndustryType[] = [
  ...COMMERCIAL_AMMAN_ORDER,
  ...COMMERCIAL_OUTSIDE_ORDER,
];

/** Full zoning list for land-check guidance. */
export const REGULATION_ORDER: IndustryType[] = [
  ...INDUSTRIAL_ORDER,
  ...RESIDENTIAL_ORDER,
  ...COMMERCIAL_AMMAN_ORDER,
  ...COMMERCIAL_OUTSIDE_ORDER,
];

export const ALL_INDUSTRY_TYPES = REGULATION_ORDER;

export function regulationProfile(key: IndustryType): RegulationProfile {
  return { key, setbacks: SETBACKS[key] };
}

export function isIndustrialZoning(key: IndustryType) {
  return (INDUSTRIAL_ORDER as readonly string[]).includes(key);
}

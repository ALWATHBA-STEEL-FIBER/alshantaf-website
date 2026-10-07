import { type IndustryTypeKey } from "./industryTypes";

export class AmmanZoningLookupError extends Error {}

export type AmmanZoningResult = {
  industryType: IndustryTypeKey | null;
  zoningNo: string | null;
  zoningName: string | null;
  districtName: string | null;
  sourceUrl: string;
  latitude: number | null;
  longitude: number | null;
};

/**
 * Live lookup against ammancitygis.gov.jo is intentionally disabled.
 *
 * Greater Amman Municipality GIS publishes:
 * - free viewer (Amman Explorer) for human use in the browser
 * - paid GIS services via the municipality website
 * Direct REST queries return "Token Required"; their public proxy only allows
 * their own site Referer. We do not spoof that or consume those services from
 * this product.
 */
export async function lookupAmmanZoning(_params: {
  latitude?: number;
  longitude?: number;
  villageCode?: string;
  basinCode?: string;
  sectorCode?: string;
  parcelNumber?: string;
}): Promise<AmmanZoningResult | null> {
  throw new AmmanZoningLookupError(
    "Live Amman City GIS lookup is disabled. Confirm zoning from Greater Amman Municipality official services, then select it manually."
  );
}

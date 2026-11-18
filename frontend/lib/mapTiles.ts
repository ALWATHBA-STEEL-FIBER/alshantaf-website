/** Shared Leaflet basemap zoom / tile URLs. */

/** Interactive map zoom ceiling when not measuring. */
export const MAP_MAX_ZOOM = 19;
/** Extra overzoom while architecture-measuring (tiles scale past native). */
export const MEASURE_MAX_ZOOM = 22;

/**
 * Esri World Imagery often has no cooked tiles past z18 in parts of Jordan
 * (returns a grey "Map data not yet available" JPEG). Keep satellite
 * maxNativeZoom at 18 so Leaflet overzooms real imagery instead.
 */
export const SAT_MAX_NATIVE_ZOOM = 18;
/** OSM has reliable coverage through this zoom. */
export const OSM_MAX_NATIVE_ZOOM = 19;

/** Prefer this when fitting a parcel so we stay on real satellite tiles. */
export const PARCEL_FIT_MAX_ZOOM = SAT_MAX_NATIVE_ZOOM;

export const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

/**
 * blankTile=false → missing zooms return HTTP 404 (Leaflet can overzoom)
 * instead of Esri's placeholder "Map data not yet available" image.
 */
export const ESRI_SAT_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false";

/** Lighter tile behaviour for phones — fewer redraws while panning/zooming. */
function deviceTileTuning() {
  const mobile =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(max-width: 768px)")?.matches ||
      window.matchMedia?.("(pointer: coarse)")?.matches);
  return {
    updateWhenIdle: Boolean(mobile),
    updateWhenZooming: !mobile,
    keepBuffer: mobile ? 1 : 2,
  };
}

export function osmTileOptions() {
  return {
    attribution: "© OpenStreetMap",
    maxNativeZoom: OSM_MAX_NATIVE_ZOOM,
    maxZoom: MEASURE_MAX_ZOOM,
    crossOrigin: true as const,
    ...deviceTileTuning(),
  };
}

export function satTileOptions() {
  return {
    attribution: "© Esri",
    maxNativeZoom: SAT_MAX_NATIVE_ZOOM,
    maxZoom: MEASURE_MAX_ZOOM,
    crossOrigin: true as const,
    ...deviceTileTuning(),
  };
}

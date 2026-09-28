const COORDS_RE = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

/** WGS84 semi-major axis (m). */
const WGS84_A = 6378137;
/** WGS84 flattening. */
const WGS84_F = 1 / 298.257223563;

export interface Coords {
  lat: number;
  lng: number;
}

type EnuPoint = { x: number; y: number };

export function parseCoords(value: string | null | undefined): Coords | null {
  if (!value) return null;
  const match = value.match(COORDS_RE);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Best-effort extraction of a lat,lng pair out of a pasted Google Maps link —
 * covers the common share-link shapes. Returns null for short links (maps.app.goo.gl)
 * or plus-code links, which need the pin/coordinates mode instead. */
export function extractCoordsFromMapsUrl(url: string): Coords | null {
  const direct = parseCoords(url);
  if (direct) return direct;
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    // malformed percent-encoding — fall back to the raw string
  }
  const patterns = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&]q=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&]query=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&]ll=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
  ];
  for (const re of patterns) {
    const m = decoded.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    }
  }
  return null;
}

export function coordsToString({ lat, lng }: Coords): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/** Format DLS calculated area (m²) for the owner form — includes Jordan dunums (1 = 1000 m²).
 * Numbers are always Western digits so parcel/size fields stay machine-readable. */
export function formatDlsArea(sqm: number, lang: "ar" | "en"): string {
  const sqmStr = sqm.toLocaleString("en-JO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
  const dunums = sqm / 1000;
  const dunumStr = dunums.toLocaleString("en-JO", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  });
  return lang === "ar" ? `${sqmStr} م² · ${dunumStr} دونم` : `${sqmStr} m² · ${dunumStr} dunums`;
}

export function mapsLinkFromCoords({ lat, lng }: Coords): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function mapsEmbedSrc({ lat, lng }: Coords, zoom = 16): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}&z=${zoom}&output=embed`;
}

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

function toDeg(r: number) {
  return (r * 180) / Math.PI;
}

/** Meridian radius of curvature at latitude (WGS84). */
function meridianRadius(latRad: number) {
  const e2 = WGS84_F * (2 - WGS84_F);
  const s = Math.sin(latRad);
  return (WGS84_A * (1 - e2)) / Math.pow(1 - e2 * s * s, 1.5);
}

/** Prime vertical radius of curvature at latitude (WGS84). */
function primeVerticalRadius(latRad: number) {
  const e2 = WGS84_F * (2 - WGS84_F);
  const s = Math.sin(latRad);
  return WGS84_A / Math.sqrt(1 - e2 * s * s);
}

/** Local east/north metres relative to an origin — accurate for cadastral-scale
 * parcels (tens to a few thousand metres). */
export function toLocalEnu(lat: number, lng: number, originLat: number, originLng: number): EnuPoint {
  return toEnu(lat, lng, originLat, originLng);
}

/**
 * Local east/north metres relative to an origin — accurate for cadastral-scale
 * parcels (tens to a few thousand metres).
 */
function toEnu(lat: number, lng: number, originLat: number, originLng: number): EnuPoint {
  const lat0 = toRad(originLat);
  const mLat = meridianRadius(lat0);
  const mLng = primeVerticalRadius(lat0) * Math.cos(lat0);
  return {
    x: toRad(lng - originLng) * mLng,
    y: toRad(lat - originLat) * mLat,
  };
}

function fromEnu(point: EnuPoint, originLat: number, originLng: number): Coords {
  const lat0 = toRad(originLat);
  const mLat = meridianRadius(lat0);
  const mLng = primeVerticalRadius(lat0) * Math.cos(lat0);
  return {
    lat: originLat + toDeg(point.y / mLat),
    lng: originLng + toDeg(point.x / mLng),
  };
}

/** Inverse of toLocalEnu — ENU metres back to WGS84. */
export function fromLocalEnu(x: number, y: number, originLat: number, originLng: number): Coords {
  return fromEnu({ x, y }, originLat, originLng);
}

function uniqueRing(ring: [number, number][]): [number, number][] {
  if (!ring.length) return [];
  const pts = ring.slice();
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) pts.pop();
  return pts;
}

function ringCentroid(pts: [number, number][]): Coords {
  let lat = 0;
  let lng = 0;
  for (const [la, ln] of pts) {
    lat += la;
    lng += ln;
  }
  return { lat: lat / pts.length, lng: lng / pts.length };
}

/** Geodesic distance on the WGS84 sphere (haversine) — kept for call sites that need a quick estimate. */
export function haversineMeters(a: Coords, b: Coords): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Planar (local ENU) distance in metres — preferred for parcel edges. */
export function planarMeters(a: Coords, b: Coords): number {
  const origin = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  const pa = toEnu(a.lat, a.lng, origin.lat, origin.lng);
  const pb = toEnu(b.lat, b.lng, origin.lat, origin.lng);
  return Math.hypot(pb.x - pa.x, pb.y - pa.y);
}

/**
 * Minimum-area oriented bounding box for a local ENU polygon.
 * Returns length (longer side) × width (shorter side) in metres,
 * plus the ENU yaw that aligns length with +X.
 */
function orientedExtents(enu: EnuPoint[]): { lengthM: number; widthM: number; angle: number } | null {
  if (enu.length < 2) return null;
  let bestArea = Infinity;
  let bestW = 0;
  let bestH = 0;
  let bestAngle = 0;

  for (let i = 0; i < enu.length; i++) {
    const a = enu[i]!;
    const b = enu[(i + 1) % enu.length]!;
    const edgeLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (edgeLen < 1e-6) continue;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of enu) {
      const rx = p.x * cos - p.y * sin;
      const ry = p.x * sin + p.y * cos;
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    }
    const w = maxX - minX;
    const h = maxY - minY;
    const area = w * h;
    if (area < bestArea) {
      bestArea = area;
      bestW = w;
      bestH = h;
      bestAngle = angle;
    }
  }

  if (!Number.isFinite(bestArea) || bestArea <= 0) return null;
  // Keep length along +X in the parcel frame
  if (bestH > bestW) {
    return { lengthM: bestH, widthM: bestW, angle: bestAngle + Math.PI / 2 };
  }
  return { lengthM: bestW, widthM: bestH, angle: bestAngle };
}

/** Axis-aligned N–S / E–W extents (legacy). Prefer ringOrientedExtents for parcels. */
export function ringExtentsMeters(ring: [number, number][]): { northSouthM: number; eastWestM: number } | null {
  const oriented = ringOrientedExtents(ring);
  if (!oriented) return null;
  // Map oriented length/width onto the previous field names for callers that still expect them.
  return { eastWestM: oriented.widthM, northSouthM: oriented.lengthM };
}

/** Oriented parcel extents (length × width) in metres from local ENU geometry. */
export function ringOrientedExtents(
  ring: [number, number][]
): { lengthM: number; widthM: number } | null {
  const pts = uniqueRing(ring);
  if (pts.length < 2) return null;
  const origin = ringCentroid(pts);
  const enu = pts.map(([lat, lng]) => toEnu(lat, lng, origin.lat, origin.lng));
  const frame = orientedExtents(enu);
  if (!frame) return null;
  return { lengthM: frame.lengthM, widthM: frame.widthM };
}

/**
 * Parcel drawing frame: ENU origin at centroid, yaw aligns length with +X.
 * `angle` is radians in ENU (east=X, north=Y).
 */
export function ringOrientedFrame(ring: [number, number][]): {
  origin: Coords;
  enu: EnuPoint[];
  angle: number;
  lengthM: number;
  widthM: number;
} | null {
  const pts = uniqueRing(ring);
  if (pts.length < 3) return null;
  const origin = ringCentroid(pts);
  const enu = pts.map(([lat, lng]) => toEnu(lat, lng, origin.lat, origin.lng));
  const frame = orientedExtents(enu);
  if (!frame) return null;
  return { origin, enu, angle: frame.angle, lengthM: frame.lengthM, widthM: frame.widthM };
}

/** Local east/north metres for a lat/lng ring — for schematic / isometric views. */
export function ringToLocalEnu(ring: [number, number][]): EnuPoint[] {
  const pts = uniqueRing(ring);
  if (pts.length < 2) return [];
  const origin = ringCentroid(pts);
  return pts.map(([lat, lng]) => toEnu(lat, lng, origin.lat, origin.lng));
}

export type { EnuPoint };

export type RingEdgeDimension = {
  mid: Coords;
  lengthM: number;
  /** Unit outward-ish offset hint for label placement (lat/lng degrees, tiny). */
  label: Coords;
};

/**
 * Edge midpoints + lengths for drawing dimension labels on a parcel ring ([lat,lng][]).
 * Lengths use a local WGS84 ENU plane (accurate at cadastral scale).
 */
export function ringEdgeDimensions(ring: [number, number][]): RingEdgeDimension[] {
  const pts = uniqueRing(ring);
  if (pts.length < 2) return [];
  const origin = ringCentroid(pts);
  const enu = pts.map(([lat, lng]) => toEnu(lat, lng, origin.lat, origin.lng));
  const edges: RingEdgeDimension[] = [];

  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const ea = enu[i]!;
    const eb = enu[(i + 1) % enu.length]!;
    const dx = eb.x - ea.x;
    const dy = eb.y - ea.y;
    const lengthM = Math.hypot(dx, dy);
    if (lengthM < 0.25) continue;

    const midEnu = { x: (ea.x + eb.x) / 2, y: (ea.y + eb.y) / 2 };
    const mid = fromEnu(midEnu, origin.lat, origin.lng);

    // Offset label ~1.8 m perpendicular to the edge (outward from ring centroid).
    const inv = lengthM > 0 ? 1 / lengthM : 0;
    let nx = -dy * inv;
    let ny = dx * inv;
    const cx = midEnu.x;
    const cy = midEnu.y;
    // Flip normal so it points away from centroid (0,0 in ENU after recentering — centroid is origin).
    if (nx * cx + ny * cy < 0) {
      nx = -nx;
      ny = -ny;
    }
    const label = fromEnu({ x: midEnu.x + nx * 1.8, y: midEnu.y + ny * 1.8 }, origin.lat, origin.lng);

    edges.push({ mid, lengthM, label });
  }
  return edges;
}

/** Sum of planar edge lengths (client-side perimeter). */
export function ringPerimeterMeters(ring: [number, number][]): number {
  return ringEdgeDimensions(ring).reduce((sum, edge) => sum + edge.lengthM, 0);
}

export function formatMeters(meters: number, lang: "ar" | "en"): string {
  let rounded: number;
  if (meters >= 100) rounded = Math.round(meters * 10) / 10;
  else if (meters >= 10) rounded = Math.round(meters * 10) / 10;
  else rounded = Math.round(meters * 100) / 100;
  const n = rounded.toLocaleString("en-JO", {
    maximumFractionDigits: meters >= 10 ? 1 : 2,
    minimumFractionDigits: 0,
  });
  return lang === "ar" ? `${n} م` : `${n} m`;
}

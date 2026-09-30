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

/**
 * True area centroid of a closed ring (shoelace in local ENU).
 * Falls inside the parcel for typical cadastral polygons — use for on-map labels.
 */
export function ringInteriorCentroid(ring: [number, number][]): Coords | null {
  const pts = uniqueRing(ring);
  if (pts.length === 0) return null;
  if (pts.length < 3) return { lat: pts[0]![0], lng: pts[0]![1] };
  const origin = ringCentroid(pts);
  const enu = pts.map(([lat, lng]) => toEnu(lat, lng, origin.lat, origin.lng));
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < enu.length; i++) {
    const p = enu[i]!;
    const q = enu[(i + 1) % enu.length]!;
    const cross = p.x * q.y - q.x * p.y;
    twiceArea += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  if (Math.abs(twiceArea) < 1e-12) return origin;
  return fromEnu({ x: cx / (3 * twiceArea), y: cy / (3 * twiceArea) }, origin.lat, origin.lng);
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
  /** Straight run vs densified curve (merged soft bends). */
  kind: "edge" | "curve";
  /** Endpoints of this logical side (for corner glow). */
  start: Coords;
  end: Coords;
  /**
   * CSS rotation (degrees) so the label text runs along the edge on a north-up map.
   * Flipped ±180° when needed so text stays upright/readable.
   */
  bearingDeg: number;
};

/** Soft bend still counts as the same curve/side; sharper = hard corner break. */
const COLLINEAR_DEG = 10;
const CURVE_MAX_DEG = 38;
const MIN_SIDE_M = 0.2;

function turnDegrees(prev: EnuPoint, curr: EnuPoint, next: EnuPoint): number {
  const ax = curr.x - prev.x;
  const ay = curr.y - prev.y;
  const bx = next.x - curr.x;
  const by = next.y - curr.y;
  if (Math.hypot(ax, ay) < 1e-9 || Math.hypot(bx, by) < 1e-9) return 0;
  let d = ((Math.atan2(by, bx) - Math.atan2(ay, ax)) * 180) / Math.PI;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/**
 * Edge midpoints + lengths for drawing dimension labels on a parcel ring ([lat,lng][]).
 * Collinear runs and soft bends (curves) are merged into one side with total length,
 * so densified arcs don't spawn dozens of tiny dimension labels.
 */
export function ringEdgeDimensions(ring: [number, number][]): RingEdgeDimension[] {
  const pts = uniqueRing(ring);
  if (pts.length < 2) return [];
  const n = pts.length;
  const origin = ringCentroid(pts);
  const enu = pts.map(([lat, lng]) => toEnu(lat, lng, origin.lat, origin.lng));

  const turns: number[] = new Array(n);
  const hardCorner: boolean[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = turnDegrees(enu[(i - 1 + n) % n]!, enu[i]!, enu[(i + 1) % n]!);
    turns[i] = t;
    hardCorner[i] = Math.abs(t) >= CURVE_MAX_DEG;
  }

  // At least one break so a fully smooth loop still yields one side.
  if (!hardCorner.some(Boolean)) hardCorner[0] = true;

  const breakIdx: number[] = [];
  for (let i = 0; i < n; i++) if (hardCorner[i]) breakIdx.push(i);
  if (breakIdx.length === 0) breakIdx.push(0);

  const sides: RingEdgeDimension[] = [];

  for (let bi = 0; bi < breakIdx.length; bi++) {
    const i0 = breakIdx[bi]!;
    const i1 = breakIdx[(bi + 1) % breakIdx.length]!;
    const path: number[] = [i0];
    let j = (i0 + 1) % n;
    let guard = 0;
    while (j !== i1 && guard < n + 2) {
      path.push(j);
      j = (j + 1) % n;
      guard++;
    }
    path.push(i1);
    if (path.length < 2) continue;

    let lengthM = 0;
    for (let k = 0; k < path.length - 1; k++) {
      const a = enu[path[k]!]!;
      const b = enu[path[k + 1]!]!;
      lengthM += Math.hypot(b.x - a.x, b.y - a.y);
    }
    if (lengthM < MIN_SIDE_M) continue;

    let maxSoft = 0;
    for (let k = 1; k < path.length - 1; k++) {
      maxSoft = Math.max(maxSoft, Math.abs(turns[path[k]!]!));
    }
    const kind: "edge" | "curve" =
      path.length > 2 && maxSoft >= COLLINEAR_DEG ? "curve" : "edge";

    // Midpoint by arc length along the side
    let remaining = lengthM / 2;
    let midEnu = enu[path[0]!]!;
    let tanX = 1;
    let tanY = 0;
    for (let k = 0; k < path.length - 1; k++) {
      const a = enu[path[k]!]!;
      const b = enu[path[k + 1]!]!;
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (seg < 1e-9) continue;
      if (remaining <= seg) {
        const t = remaining / seg;
        midEnu = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        tanX = (b.x - a.x) / seg;
        tanY = (b.y - a.y) / seg;
        break;
      }
      remaining -= seg;
      midEnu = b;
      tanX = (b.x - a.x) / seg;
      tanY = (b.y - a.y) / seg;
    }

    const mid = fromEnu(midEnu, origin.lat, origin.lng);
    // Midline label: sit on the geometric midpoint of the side (no side offset).
    // Bearing rotates text along the edge so it reads as that side's length.
    let bearingDeg = (Math.atan2(-tanY, tanX) * 180) / Math.PI;
    if (bearingDeg > 90 || bearingDeg < -90) bearingDeg += 180;
    const start = pts[i0]!;
    const end = pts[i1]!;
    sides.push({
      mid,
      lengthM,
      label: mid,
      kind,
      start: { lat: start[0], lng: start[1] },
      end: { lat: end[0], lng: end[1] },
      bearingDeg,
    });
  }

  return sides;
}

/** Distinct hard-corner vertices for glow markers (lat/lng pairs). */
export function ringCornerPoints(ring: [number, number][]): Coords[] {
  const pts = uniqueRing(ring);
  if (pts.length < 2) return [];
  const n = pts.length;
  const origin = ringCentroid(pts);
  const enu = pts.map(([lat, lng]) => toEnu(lat, lng, origin.lat, origin.lng));
  const corners: Coords[] = [];
  for (let i = 0; i < n; i++) {
    const t = Math.abs(turnDegrees(enu[(i - 1 + n) % n]!, enu[i]!, enu[(i + 1) % n]!));
    // Include hard corners and also mild bends so short edges stay visible
    if (t >= COLLINEAR_DEG || n <= 8) {
      corners.push({ lat: pts[i]![0], lng: pts[i]![1] });
    }
  }
  // Always show every vertex when the ring is sparse; when dense, hard+mild only.
  // If somehow empty, fall back to all vertices.
  if (corners.length === 0) {
    return pts.map(([lat, lng]) => ({ lat, lng }));
  }
  return corners;
}

/** Sum of planar edge lengths (client-side perimeter) — uses raw segments, not merged sides. */
export function ringPerimeterMeters(ring: [number, number][]): number {
  const pts = uniqueRing(ring);
  if (pts.length < 2) return 0;
  const origin = ringCentroid(pts);
  const enu = pts.map(([lat, lng]) => toEnu(lat, lng, origin.lat, origin.lng));
  let sum = 0;
  for (let i = 0; i < enu.length; i++) {
    const a = enu[i]!;
    const b = enu[(i + 1) % enu.length]!;
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

/** Planar shoelace area in m² for a lat/lng ring (client-side measure tool). */
export function ringAreaSqm(ring: [number, number][]): number {
  const pts = uniqueRing(ring);
  if (pts.length < 3) return 0;
  const origin = ringCentroid(pts);
  const enu = pts.map(([lat, lng]) => toEnu(lat, lng, origin.lat, origin.lng));
  let twice = 0;
  for (let i = 0; i < enu.length; i++) {
    const a = enu[i]!;
    const b = enu[(i + 1) % enu.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
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

/** Dimension label text; curves get a small arc mark so merged bends read as one side. */
export function formatSideMeters(
  meters: number,
  lang: "ar" | "en",
  kind: "edge" | "curve" = "edge"
): string {
  const base = formatMeters(meters, lang);
  if (kind !== "curve") return base;
  return lang === "ar" ? `⌒ ${base}` : `⌒ ${base}`;
}

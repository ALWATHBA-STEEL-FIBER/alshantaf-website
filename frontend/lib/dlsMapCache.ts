/**
 * Client-side DLS query hygiene: TTL cache, covering-bbox reuse,
 * single-flight coalescing, and a hard concurrency gate so pan/zoom
 * never floods maps.dls.gov.jo or our token proxy.
 */

export type BBox = { west: number; south: number; east: number; north: number };

const CACHE_TTL_MS = 90_000;
const CACHE_MAX = 24;
/** Prefer one in-flight ArcGIS call on phones; two on desktop. */
const MAX_INFLIGHT =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(max-width: 768px)")?.matches ||
    window.matchMedia?.("(pointer: coarse)")?.matches)
    ? 1
    : 2;

type CacheRow<T> = {
  key: string;
  bbox: BBox;
  zoomBand: number;
  at: number;
  value: T;
};

const parcelCache: CacheRow<unknown>[] = [];
const adminCache: CacheRow<unknown>[] = [];
const inflight = new Map<string, Promise<unknown>>();
let active = 0;
const waiters: Array<() => void> = [];

function zoomBand(zoom: number): number {
  // Coarse bands so tiny zoom wobble reuses the same payload.
  if (zoom < 14) return 13;
  if (zoom < 15) return 14;
  if (zoom < 16) return 15;
  if (zoom < 17) return 16;
  return 17;
}

export function dlsZoomBand(zoom: number): number {
  return zoomBand(zoom);
}

/** Expand viewport so small pans hit cache instead of re-querying DLS. */
export function padBBox(b: BBox, ratio = 0.35): BBox {
  const w = Math.max(1e-6, b.east - b.west);
  const h = Math.max(1e-6, b.north - b.south);
  return {
    west: b.west - w * ratio,
    south: b.south - h * ratio,
    east: b.east + w * ratio,
    north: b.north + h * ratio,
  };
}

export function bboxContained(outer: BBox, inner: BBox): boolean {
  return (
    outer.west <= inner.west &&
    outer.south <= inner.south &&
    outer.east >= inner.east &&
    outer.north >= inner.north
  );
}

function quantize(b: BBox, digits = 3): string {
  const q = (n: number) => n.toFixed(digits);
  return `${q(b.west)},${q(b.south)},${q(b.east)},${q(b.north)}`;
}

function prune<T>(rows: CacheRow<T>[]) {
  const now = Date.now();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (now - rows[i]!.at > CACHE_TTL_MS) rows.splice(i, 1);
  }
  while (rows.length > CACHE_MAX) rows.shift();
}

function lookupCovering<T>(rows: CacheRow<T>[], bbox: BBox, band: number): T | null {
  prune(rows);
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!;
    if (row.zoomBand !== band) continue;
    if (Date.now() - row.at > CACHE_TTL_MS) continue;
    if (bboxContained(row.bbox, bbox)) return row.value;
  }
  return null;
}

function store<T>(rows: CacheRow<T>[], key: string, bbox: BBox, band: number, value: T) {
  const idx = rows.findIndex((r) => r.key === key);
  if (idx >= 0) rows.splice(idx, 1);
  rows.push({ key, bbox, zoomBand: band, at: Date.now(), value });
  prune(rows);
}

async function acquire(): Promise<void> {
  if (active < MAX_INFLIGHT) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active += 1;
}

function release() {
  active = Math.max(0, active - 1);
  const next = waiters.shift();
  if (next) next();
}

/**
 * Run an ArcGIS/token-backed query under the concurrency gate.
 * Identical keys coalesce to one in-flight promise.
 */
export async function runDlsQuery<T>(
  key: string,
  signal: AbortSignal | undefined,
  fn: () => Promise<T>
): Promise<T> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const job = (async () => {
    await acquire();
    try {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return await fn();
    } finally {
      release();
      inflight.delete(key);
    }
  })();

  inflight.set(key, job);
  return job;
}

export function getCachedParcels<T>(bbox: BBox, zoom: number): T | null {
  return lookupCovering(parcelCache as CacheRow<T>[], bbox, zoomBand(zoom));
}

export function setCachedParcels<T>(bbox: BBox, zoom: number, value: T) {
  const band = zoomBand(zoom);
  store(parcelCache as CacheRow<T>[], `p|${band}|${quantize(bbox)}`, bbox, band, value);
}

export function getCachedAdmin<T>(layer: string, bbox: BBox, zoom: number): T | null {
  return lookupCovering(adminCache as CacheRow<T>[], bbox, zoomBand(zoom) + (layer === "governorates" ? 0 : 0));
}

export function setCachedAdmin<T>(layer: string, bbox: BBox, zoom: number, value: T) {
  const band = layer === "governorates" ? 0 : zoomBand(zoom);
  store(
    adminCache as CacheRow<T>[],
    `a|${layer}|${band}|${quantize(bbox, layer === "governorates" ? 1 : 3)}`,
    bbox,
    band,
    value
  );
}

/** Stable viewport key for UI dedupe (settle-only loaders). */
export function viewportDedupeKey(zoom: number, bbox: BBox): string {
  return `${zoomBand(zoom)}|${quantize(bbox, 3)}`;
}

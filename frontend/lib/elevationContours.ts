/** Shared DEM decode + marching-squares contours (Mapzen Terrarium encoding). */

export function decodeTerrarium(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const elev = new Float32Array(w * h);
  for (let i = 0, p = 0; i < elev.length; i++, p += 4) {
    elev[i] = data[p]! * 256 + data[p + 1]! + data[p + 2]! / 256 - 32768;
  }
  return elev;
}

export function elevRange(elev: Float32Array): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < elev.length; i++) {
    const v = elev[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

/** Adaptive contour interval (metres) from zoom + local relief. */
export function contourInterval(z: number, reliefM: number): number {
  let base = 100;
  if (z >= 17) base = 1;
  else if (z >= 16) base = 2;
  else if (z >= 15) base = 2.5;
  else if (z >= 14) base = 5;
  else if (z >= 13) base = 8;
  else if (z >= 12) base = 12;
  else if (z >= 11) base = 20;
  else if (z >= 9) base = 40;
  // Flat parcels: tighten so the wireframe still has shape
  if (Number.isFinite(reliefM)) {
    if (reliefM < 4) base = Math.min(base, 0.5);
    else if (reliefM < 10) base = Math.min(base, 1);
    else if (reliefM < 25) base = Math.min(base, 2);
  }
  return Math.max(0.5, base);
}

export type ContourSeg = [number, number, number, number];

/** Marching-squares segments for one isolevel. Coordinates in grid index space. */
export function contourSegments(elev: Float32Array, w: number, h: number, level: number): ContourSeg[] {
  const segs: ContourSeg[] = [];
  const at = (x: number, y: number) => elev[y * w + x]!;

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const a = at(x, y);
      const b = at(x + 1, y);
      const c = at(x + 1, y + 1);
      const d = at(x, y + 1);
      const code =
        (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (d >= level ? 1 : 0);
      if (code === 0 || code === 15) continue;

      const lerp = (v0: number, v1: number) => {
        const t = (level - v0) / (v1 - v0 || 1e-9);
        return Math.max(0, Math.min(1, t));
      };
      const topX = x + lerp(a, b);
      const topY = y;
      const rightX = x + 1;
      const rightY = y + lerp(b, c);
      const bottomX = x + lerp(d, c);
      const bottomY = y + 1;
      const leftX = x;
      const leftY = y + lerp(a, d);

      const push = (x0: number, y0: number, x1: number, y1: number) => segs.push([x0, y0, x1, y1]);

      switch (code) {
        case 1:
        case 14:
          push(leftX, leftY, bottomX, bottomY);
          break;
        case 2:
        case 13:
          push(bottomX, bottomY, rightX, rightY);
          break;
        case 3:
        case 12:
          push(leftX, leftY, rightX, rightY);
          break;
        case 4:
        case 11:
          push(topX, topY, rightX, rightY);
          break;
        case 5:
          push(leftX, leftY, topX, topY);
          push(bottomX, bottomY, rightX, rightY);
          break;
        case 6:
        case 9:
          push(topX, topY, bottomX, bottomY);
          break;
        case 7:
        case 8:
          push(leftX, leftY, topX, topY);
          break;
        case 10:
          push(topX, topY, rightX, rightY);
          push(leftX, leftY, bottomX, bottomY);
          break;
        default:
          break;
      }
    }
  }
  return segs;
}

export function collectContourLevels(min: number, max: number, interval: number, maxLevels = 80): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const start = Math.ceil(min / interval) * interval;
  const levels: number[] = [];
  for (let level = start; level <= max + 1e-6; level += interval) {
    levels.push(Number(level.toFixed(4)));
    if (levels.length >= maxLevels) break;
  }
  return levels;
}

/** Ray-cast point-in-polygon for a closed ring of [x,y]. */
export function pointInPoly(x: number, y: number, ring: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]!.x;
    const yi = ring[i]!.y;
    const xj = ring[j]!.x;
    const yj = ring[j]!.y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Bilinear sample of a height field (grid index space). */
export function sampleBilinear(elev: Float32Array, w: number, h: number, x: number, y: number): number {
  const x0 = Math.max(0, Math.min(w - 2, Math.floor(x)));
  const y0 = Math.max(0, Math.min(h - 2, Math.floor(y)));
  const fx = Math.max(0, Math.min(1, x - x0));
  const fy = Math.max(0, Math.min(1, y - y0));
  const a = elev[y0 * w + x0]!;
  const b = elev[y0 * w + x0 + 1]!;
  const c = elev[(y0 + 1) * w + x0]!;
  const d = elev[(y0 + 1) * w + x0 + 1]!;
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/**
 * Gaussian-ish box blur on a height field so marching-squares isolines
 * read as smooth topography instead of stair-step DEM noise.
 */
export function smoothElevGrid(elev: Float32Array, w: number, h: number, passes = 2): Float32Array {
  let src = Float32Array.from(elev);
  let dst = new Float32Array(w * h);
  const at = (grid: Float32Array, x: number, y: number) =>
    grid[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))]!;

  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // 3×3 kernel, centre weighted higher
        const v =
          at(src, x - 1, y - 1) * 1 +
          at(src, x, y - 1) * 2 +
          at(src, x + 1, y - 1) * 1 +
          at(src, x - 1, y) * 2 +
          at(src, x, y) * 4 +
          at(src, x + 1, y) * 2 +
          at(src, x - 1, y + 1) * 1 +
          at(src, x, y + 1) * 2 +
          at(src, x + 1, y + 1) * 1;
        dst[y * w + x] = v / 16;
      }
    }
    const tmp = src;
    src = dst;
    dst = tmp;
  }
  return src;
}

/** Hypsometric tint: deep green valleys → gold ridges (0..1 normalized elev). */
export function elevTintRgb(t: number): [number, number, number] {
  const u = Math.max(0, Math.min(1, t));
  // #0a2e28 → #1f554a → #c89a58 → #e8c98a
  const stops: Array<[number, number, number, number]> = [
    [0, 10, 46, 40],
    [0.35, 15, 85, 74],
    [0.65, 200, 154, 88],
    [1, 232, 201, 138],
  ];
  let i = 0;
  while (i < stops.length - 2 && u > stops[i + 1]![0]) i++;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  const f = (u - a[0]) / (b[0] - a[0] || 1);
  return [
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
    Math.round(a[3] + (b[3] - a[3]) * f),
  ];
}

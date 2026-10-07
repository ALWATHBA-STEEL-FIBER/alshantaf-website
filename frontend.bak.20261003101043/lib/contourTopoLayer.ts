/**
 * High-quality Leaflet contour topography from Mapzen Terrarium DEM tiles.
 * Gold isolines on deep green — brand wireframe topo scan.
 */

import {
  collectContourLevels,
  contourInterval,
  contourSegments,
  decodeTerrarium,
  elevRange,
  sampleBilinear,
  smoothElevGrid,
} from "@/lib/elevationContours";

type LeafletNS = typeof import("leaflet");

const BG = "#071816";
const LINE = "rgba(200, 154, 88, 0.82)";
const MAJOR = "rgba(232, 201, 138, 0.98)";
const GLOW = "rgba(200, 154, 88, 0.28)";

/** Render tile at 2× for crisp contours on retina / when Leaflet upscales past z15. */
const RENDER_SIZE = 512;

function drawContours(
  ctx: CanvasRenderingContext2D,
  elev: Float32Array,
  w: number,
  h: number,
  interval: number,
  scaleX: number,
  scaleY: number
) {
  const { min, max } = elevRange(elev);
  const relief = max - min;
  if (!Number.isFinite(relief) || relief < 0.15) {
    ctx.strokeStyle = "rgba(200,154,88,0.14)";
    ctx.lineWidth = 0.7;
    for (let i = 0; i < RENDER_SIZE; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, RENDER_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(RENDER_SIZE, i);
      ctx.stroke();
    }
    return;
  }

  const levels = collectContourLevels(min, max, interval, 96);
  const drawSet = (stroke: string, width: number, majorOnly: boolean) => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const level of levels) {
      const major = Math.abs(Math.round(level / interval) % 5) < 1e-6;
      if (majorOnly !== major) continue;
      for (const [x0, y0, x1, y1] of contourSegments(elev, w, h, level)) {
        ctx.moveTo(x0 * scaleX, y0 * scaleY);
        ctx.lineTo(x1 * scaleX, y1 * scaleY);
      }
    }
    ctx.stroke();
  };

  drawSet(GLOW, 3.2, false);
  drawSet(LINE, 1.05, false);
  drawSet(MAJOR, 1.75, true);

  // Elevation labels on every major contour — always place at least one when segs exist
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const placed: Array<{ x: number; y: number }> = [];
  const tooClose = (x: number, y: number) =>
    placed.some((p) => Math.hypot(p.x - x, p.y - y) < 36);

  for (const level of levels) {
    const major = Math.round(level / interval) % 5 === 0;
    if (!major) continue;
    const segs = contourSegments(elev, w, h, level);
    if (!segs.length) continue;

    // Prefer longest mid-tile segment; fall back to any segment midpoint
    let best: { x: number; y: number; len: number } | null = null;
    let fallback: { x: number; y: number; len: number } | null = null;
    for (const [x0, y0, x1, y1] of segs) {
      const ax = x0 * scaleX;
      const ay = y0 * scaleY;
      const bx = x1 * scaleX;
      const by = y1 * scaleY;
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const len = Math.hypot(bx - ax, by - ay);
      const inPad = mx > 28 && mx < RENDER_SIZE - 28 && my > 28 && my < RENDER_SIZE - 28;
      if (!fallback || len > fallback.len) fallback = { x: mx, y: my, len };
      if (inPad && (!best || len > best.len)) best = { x: mx, y: my, len };
    }
    const pick = best ?? fallback;
    if (!pick) continue;
    let lx = Math.max(22, Math.min(RENDER_SIZE - 22, pick.x));
    let ly = Math.max(16, Math.min(RENDER_SIZE - 16, pick.y));
    // Nudge away from previously placed labels so numbers stay readable
    if (tooClose(lx, ly)) {
      lx = Math.max(22, Math.min(RENDER_SIZE - 22, lx + 18));
      ly = Math.max(16, Math.min(RENDER_SIZE - 16, ly + 14));
    }
    const text = `${Math.round(level)} m`;
    ctx.font = "bold 12px system-ui,sans-serif";
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(7,24,22,0.92)";
    ctx.fillRect(lx - tw / 2 - 4, ly - 8, tw + 8, 16);
    ctx.strokeStyle = "rgba(232,201,138,0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(lx - tw / 2 - 4, ly - 8, tw + 8, 16);
    ctx.fillStyle = "#e8c98a";
    ctx.fillText(text, lx, ly);
    placed.push({ x: lx, y: ly });
  }
}

/**
 * Upsample a DEM window with bilinear filtering into a denser grid for smoother
 * marching-squares when Leaflet is past native DEM zoom (z15).
 */
function upsampleElev(src: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  const out = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = (x / Math.max(1, dw - 1)) * (sw - 1);
      const sy = (y / Math.max(1, dh - 1)) * (sh - 1);
      out[y * dw + x] = sampleBilinear(src, sw, sh, sx, sy);
    }
  }
  return out;
}

export function createContourTopoLayer(L: LeafletNS) {
  const ContourTopo = L.GridLayer.extend({
    createTile(coords: { x: number; y: number; z: number }, done: (err: Error | null, tile?: HTMLElement) => void) {
      const canvas = document.createElement("canvas");
      canvas.width = RENDER_SIZE;
      canvas.height = RENDER_SIZE;
      // Leaflet sizes the tile via CSS to map tile size; hi-res canvas stays sharp.
      canvas.style.width = "256px";
      canvas.style.height = "256px";
      const ctx = canvas.getContext("2d", { willReadFrequently: true, alpha: false });
      if (!ctx) {
        done(new Error("Canvas unavailable"));
        return canvas;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, RENDER_SIZE, RENDER_SIZE);

      const z = Math.min(coords.z, 15);
      const scale = 2 ** (coords.z - z);
      const nx = Math.floor(coords.x / scale);
      const ny = Math.floor(coords.y / scale);
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        try {
          const off = document.createElement("canvas");
          off.width = 256;
          off.height = 256;
          const octx = off.getContext("2d", { willReadFrequently: true });
          if (!octx) throw new Error("offscreen");
          octx.drawImage(img, 0, 0);
          const { data } = octx.getImageData(0, 0, 256, 256);
          const elev = decodeTerrarium(data, 256, 256);

          let grid: Float32Array;
          let gw: number;
          let gh: number;

          if (scale > 1) {
            const subW = 256 / scale;
            const ox = (coords.x % scale) * subW;
            const oy = (coords.y % scale) * subW;
            const sw = Math.max(16, Math.floor(subW));
            const cropped = new Float32Array(sw * sw);
            for (let y = 0; y < sw; y++) {
              for (let x = 0; x < sw; x++) {
                cropped[y * sw + x] = sampleBilinear(elev, 256, 256, ox + x, oy + y);
              }
            }
            // Dense upsample so contours stay smooth when zoomed in past DEM native res
            const dense = Math.min(256, Math.max(96, sw * 8));
            grid = upsampleElev(cropped, sw, sw, dense, dense);
            gw = dense;
            gh = dense;
          } else {
            grid = elev;
            gw = 256;
            gh = 256;
          }

          // Soften DEM stair-steps before isolines
          grid = smoothElevGrid(grid, gw, gh, scale > 1 ? 3 : 2);

          const { min, max } = elevRange(grid);
          const interval = contourInterval(coords.z, max - min);
          drawContours(ctx, grid, gw, gh, interval, RENDER_SIZE / (gw - 1), RENDER_SIZE / (gh - 1));
          done(null, canvas);
        } catch (err) {
          done(err instanceof Error ? err : new Error("contour failed"), canvas);
        }
      };
      img.onerror = () => done(new Error("DEM tile failed"), canvas);
      img.src = `/api/location/elevation-tile/${z}/${nx}/${ny}`;
      return canvas;
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (ContourTopo as any)({
    attribution: "Terrain © Mapzen / AWS",
    maxZoom: 19,
    maxNativeZoom: 15,
    minZoom: 5,
    tileSize: 256,
    opacity: 1,
  }) as import("leaflet").GridLayer;
}

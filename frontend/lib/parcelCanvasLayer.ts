"use client";

import {
  formatSideMeters,
  ringCornerPoints,
  ringEdgeDimensions,
  ringInteriorCentroid,
} from "@/lib/mapCoords";

export type ParcelCanvasOpts = {
  rings: [number, number][][];
  showDimensions: boolean;
  perimeterM?: number | null;
  lang: "ar" | "en";
  parcelNumber?: string | null;
  parcelLabel?: string;
};

type LeafletMap = import("leaflet").Map;
type LeafletNS = typeof import("leaflet");

type ParcelLayerInst = import("leaflet").Layer & {
  options: ParcelCanvasOpts;
  _map?: LeafletMap;
  _canvas?: HTMLCanvasElement;
  _onRedraw?: () => void;
  setParcelOptions: (o: ParcelCanvasOpts) => void;
  getBounds: () => import("leaflet").LatLngBounds;
};

/**
 * Single canvas overlay: land fill/stroke, corners, edge lengths, and parcel number
 * are painted together in screen pixels — no DivIcon/marker anchoring drift.
 */
export function createParcelCanvasLayer(L: LeafletNS, opts: ParcelCanvasOpts): ParcelLayerInst {
  const ParcelCanvasLayer = L.Layer.extend({
    initialize(this: ParcelLayerInst, options: ParcelCanvasOpts) {
      this.options = options;
    },

    onAdd(this: ParcelLayerInst) {
      const map = this._map!;
      const canvas = L.DomUtil.create("canvas", "parcel-canvas-layer") as HTMLCanvasElement;
      canvas.style.pointerEvents = "none";
      this._canvas = canvas;
      map.getPanes().overlayPane.appendChild(canvas);

      this._onRedraw = () => {
        if (!this._canvas || !this._map) return;
        paintParcelCanvas(L, this._map, this._canvas, this.options);
      };

      map.on("move zoom zoomend viewreset resize", this._onRedraw);
      requestAnimationFrame(() => this._onRedraw?.());
      window.setTimeout(() => this._onRedraw?.(), 50);
      window.setTimeout(() => this._onRedraw?.(), 200);
    },

    onRemove(this: ParcelLayerInst) {
      if (this._onRedraw && this._map) {
        this._map.off("move zoom zoomend viewreset resize", this._onRedraw);
      }
      if (this._canvas) L.DomUtil.remove(this._canvas);
      this._canvas = undefined;
    },

    setParcelOptions(this: ParcelLayerInst, next: ParcelCanvasOpts) {
      this.options = next;
      this._onRedraw?.();
    },

    getBounds(this: ParcelLayerInst) {
      const ring = this.options.rings[0];
      if (!ring?.length) return L.latLngBounds([0, 0], [0, 0]);
      return L.latLngBounds(ring.map(([lat, lng]) => [lat, lng] as [number, number]));
    },
  });

  return new (ParcelCanvasLayer as unknown as new (o: ParcelCanvasOpts) => ParcelLayerInst)(opts);
}

function paintParcelCanvas(
  L: LeafletNS,
  map: LeafletMap,
  canvas: HTMLCanvasElement,
  opts: ParcelCanvasOpts
) {
  const ring = opts.rings[0];
  if (!ring?.length) return;

  const size = map.getSize();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(size.x * dpr));
  canvas.height = Math.max(1, Math.floor(size.y * dpr));
  canvas.style.width = `${size.x}px`;
  canvas.style.height = `${size.y}px`;

  // Pin canvas to the visible map viewport in the overlay pane
  const topLeft = map.containerPointToLayerPoint([0, 0]);
  L.DomUtil.setPosition(canvas, topLeft);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size.x, size.y);

  const pts = ring.map(([lat, lng]) => map.latLngToContainerPoint([lat, lng]));

  // Fill
  ctx.beginPath();
  pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(200,160,100,0.22)";
  ctx.fill();

  // Outer glow
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(200,160,100,0.45)";
  ctx.lineWidth = 8;
  ctx.stroke();

  // Crisp outline
  ctx.strokeStyle = "#0f342f";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Corners
  const hard = new Set(
    ringCornerPoints(ring).map((c) => `${c.lat.toFixed(7)},${c.lng.toFixed(7)}`)
  );
  const seen = new Set<string>();
  for (let i = 0; i < ring.length; i++) {
    const [lat, lng] = ring[i]!;
    const key = `${lat.toFixed(7)},${lng.toFixed(7)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = pts[i]!;
    const isHard = hard.has(key);
    const r = isHard ? 5 : 3.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(200,160,100,0.35)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#caa064";
    ctx.fill();
    ctx.strokeStyle = "#f5e6c8";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Length chips at exact edge midpoints (same pass as the lines)
  if (opts.showDimensions) {
    const edges = ringEdgeDimensions(ring);
    const sum = edges.reduce((s, e) => s + e.lengthM, 0);
    const scale =
      opts.perimeterM != null &&
      opts.perimeterM > 0 &&
      sum > 0 &&
      Math.abs(opts.perimeterM - sum) / opts.perimeterM <= 0.05
        ? opts.perimeterM / sum
        : 1;

    for (const edge of edges) {
      const mid = map.latLngToContainerPoint([edge.mid.lat, edge.mid.lng]);
      const text = formatSideMeters(edge.lengthM * scale, opts.lang, edge.kind);
      const rad = (edge.bearingDeg * Math.PI) / 180;

      ctx.save();
      ctx.translate(mid.x, mid.y);
      ctx.rotate(rad);
      ctx.font = '700 11px system-ui, "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const tw = ctx.measureText(text).width;
      const bw = tw + 16;
      const bh = 22;
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2);
      ctx.fillStyle = "rgba(15,52,47,0.96)";
      ctx.fill();
      ctx.strokeStyle = "#caa064";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, 0, 0.5);
      ctx.restore();
    }
  }

  // Parcel number — badge geometric center = land centroid pixel
  const parcelNo = opts.parcelNumber?.trim();
  if (parcelNo) {
    const center = ringInteriorCentroid(ring);
    if (center) {
      const c = map.latLngToContainerPoint([center.lat, center.lng]);
      const title = opts.parcelLabel || "";
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.font = '600 9px system-ui, "IBM Plex Sans Arabic", sans-serif';
      const titleW = title ? ctx.measureText(title).width : 0;
      ctx.font = '800 16px system-ui, "IBM Plex Sans Arabic", sans-serif';
      const numW = ctx.measureText(parcelNo).width;
      const bw = Math.max(titleW, numW) + 28;
      const bh = title ? 48 : 36;
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 12);
      ctx.fillStyle = "rgba(15,52,47,0.96)";
      ctx.fill();
      ctx.strokeStyle = "#caa064";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (title) {
        ctx.font = '600 9px system-ui, "IBM Plex Sans Arabic", sans-serif';
        ctx.fillStyle = "rgba(232,201,138,0.85)";
        ctx.fillText(title, 0, -9);
        ctx.font = '800 16px system-ui, "IBM Plex Sans Arabic", sans-serif';
        ctx.fillStyle = "#e8c98a";
        ctx.fillText(parcelNo, 0, 10);
      } else {
        ctx.fillStyle = "#e8c98a";
        ctx.fillText(parcelNo, 0, 0);
      }
      ctx.restore();
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

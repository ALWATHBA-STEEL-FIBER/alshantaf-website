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
type LeafletPoint = import("leaflet").Point;
type LeafletLatLng = import("leaflet").LatLng;

type ParcelLayerInst = import("leaflet").Layer & {
  options: ParcelCanvasOpts;
  _map?: LeafletMap;
  _canvas?: HTMLCanvasElement;
  _onRedraw?: () => void;
  _onZoomAnim?: (e: { zoom: number; center: LeafletLatLng }) => void;
  /** Geographic NW corner of the canvas (layer-pinned). */
  _nwLatLng?: LeafletLatLng;
  setParcelOptions: (o: ParcelCanvasOpts) => void;
  getBounds: () => import("leaflet").LatLngBounds;
};

type MapProj = LeafletMap & {
  _latLngToNewLayerPoint?: (
    latlng: import("leaflet").LatLngExpression,
    zoom: number,
    center: LeafletLatLng
  ) => LeafletPoint;
};

const LABEL_PAD_PX = 72;

/**
 * Geo-pinned canvas overlay: placed in map layer coordinates so the overlay
 * pane keeps it stuck to the land on pan; redrawn on zoom. Label fonts stay
 * fixed screen pixels (do not grow when zooming out).
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
      canvas.style.position = "absolute";
      canvas.style.left = "0";
      canvas.style.top = "0";
      this._canvas = canvas;
      map.getPanes().overlayPane.appendChild(canvas);

      this._onRedraw = () => {
        if (!this._canvas || !this._map) return;
        paintParcelCanvas(L, this._map, this._canvas, this.options, this);
      };

      this._onZoomAnim = (e) => {
        if (!this._canvas || !this._map || !this._nwLatLng) return;
        const mapAny = this._map as MapProj;
        if (typeof mapAny._latLngToNewLayerPoint !== "function") return;
        const topLeft = mapAny._latLngToNewLayerPoint(this._nwLatLng, e.zoom, e.center);
        const scale = this._map.getZoomScale(e.zoom);
        L.DomUtil.setTransform(this._canvas, topLeft, scale);
      };

      // Pan: overlayPane CSS transform keeps layer-coords stuck — no per-frame redraw.
      map.on("viewreset zoom zoomend moveend resize", this._onRedraw);
      if (map.options.zoomAnimation) {
        map.on("zoomanim", this._onZoomAnim);
      }
      requestAnimationFrame(() => this._onRedraw?.());
      window.setTimeout(() => this._onRedraw?.(), 50);
      window.setTimeout(() => this._onRedraw?.(), 200);
    },

    onRemove(this: ParcelLayerInst) {
      if (this._map) {
        if (this._onRedraw) {
          this._map.off("viewreset zoom zoomend moveend resize", this._onRedraw);
        }
        if (this._onZoomAnim) {
          this._map.off("zoomanim", this._onZoomAnim);
        }
      }
      if (this._canvas) L.DomUtil.remove(this._canvas);
      this._canvas = undefined;
      this._nwLatLng = undefined;
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

function collectAnchorLatLngs(opts: ParcelCanvasOpts): [number, number][] {
  const ring = opts.rings[0];
  if (!ring?.length) return [];
  const out: [number, number][] = ring.map(([lat, lng]) => [lat, lng]);
  if (opts.showDimensions) {
    for (const edge of ringEdgeDimensions(ring)) {
      out.push([edge.mid.lat, edge.mid.lng]);
      out.push([edge.label.lat, edge.label.lng]);
    }
  }
  const center = ringInteriorCentroid(ring);
  if (center) out.push([center.lat, center.lng]);
  return out;
}

function paintParcelCanvas(
  L: LeafletNS,
  map: LeafletMap,
  canvas: HTMLCanvasElement,
  opts: ParcelCanvasOpts,
  layer: ParcelLayerInst
) {
  const ring = opts.rings[0];
  if (!ring?.length) return;

  const anchors = collectAnchorLatLngs(opts);
  if (!anchors.length) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [lat, lng] of anchors) {
    const p = map.latLngToLayerPoint([lat, lng]);
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return;

  const origin = L.point(Math.floor(minX - LABEL_PAD_PX), Math.floor(minY - LABEL_PAD_PX));
  const size = L.point(
    Math.max(1, Math.ceil(maxX + LABEL_PAD_PX) - origin.x),
    Math.max(1, Math.ceil(maxY + LABEL_PAD_PX) - origin.y)
  );

  // Pin canvas NW in layer space — moves with the map pane on pan
  layer._nwLatLng = map.layerPointToLatLng(origin);
  L.DomUtil.setPosition(canvas, origin);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(size.x * dpr));
  canvas.height = Math.max(1, Math.floor(size.y * dpr));
  canvas.style.width = `${size.x}px`;
  canvas.style.height = `${size.y}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size.x, size.y);

  const toLocal = (lat: number, lng: number) => {
    const p = map.latLngToLayerPoint([lat, lng]);
    return { x: p.x - origin.x, y: p.y - origin.y };
  };

  const pts = ring.map(([lat, lng]) => toLocal(lat, lng));

  ctx.beginPath();
  pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(200,160,100,0.22)";
  ctx.fill();

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(200,160,100,0.45)";
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.strokeStyle = "#0f342f";
  ctx.lineWidth = 2.5;
  ctx.stroke();

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
      const mid = toLocal(edge.mid.lat, edge.mid.lng);
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

  const parcelNo = opts.parcelNumber?.trim();
  if (parcelNo) {
    const center = ringInteriorCentroid(ring);
    if (center) {
      const c = toLocal(center.lat, center.lng);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.font = '800 14px system-ui, "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.strokeText(parcelNo, 0, 0);
      ctx.fillStyle = "#0f342f";
      ctx.fillText(parcelNo, 0, 0);
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

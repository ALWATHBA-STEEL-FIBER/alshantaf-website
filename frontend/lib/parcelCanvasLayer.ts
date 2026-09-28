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
  _poly?: import("leaflet").Polygon;
  _corners?: import("leaflet").LayerGroup;
  _onRedraw?: () => void;
  _onZoomStart?: () => void;
  _onZoomEnd?: () => void;
  _raf?: number;
  setParcelOptions: (o: ParcelCanvasOpts) => void;
  getBounds: () => import("leaflet").LatLngBounds;
};

/**
 * DLS-accurate parcel overlay:
 * - Native Leaflet polygon + corner markers track the map projection through zoom/pan.
 * - A viewport canvas draws length chips + parcel number in fixed screen pixels.
 * - No CSS zoom-scale on the geometry (that was drifting the outline off the land).
 */
export function createParcelCanvasLayer(L: LeafletNS, opts: ParcelCanvasOpts): ParcelLayerInst {
  const ParcelOverlay = L.Layer.extend({
    initialize(this: ParcelLayerInst, options: ParcelCanvasOpts) {
      this.options = options;
    },

    onAdd(this: ParcelLayerInst) {
      const map = this._map!;

      this._poly = L.polygon([], {
        color: "#0f342f",
        weight: 2.5,
        opacity: 1,
        fillColor: "#c8a064",
        fillOpacity: 0.22,
        lineJoin: "round",
        lineCap: "round",
        interactive: false,
        className: "parcel-dls-outline",
      }).addTo(map);

      this._corners = L.layerGroup().addTo(map);

      // Labels above outline/corners (overlayPane=400) — stay inside the map.
      if (!map.getPane("parcelLabelPane")) {
        map.createPane("parcelLabelPane");
        const pane = map.getPane("parcelLabelPane")!;
        pane.style.zIndex = "650";
        pane.style.pointerEvents = "none";
      }
      const canvas = L.DomUtil.create("canvas", "parcel-canvas-layer") as HTMLCanvasElement;
      canvas.style.pointerEvents = "none";
      canvas.style.position = "absolute";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.zIndex = "1";
      this._canvas = canvas;
      map.getPane("parcelLabelPane")!.appendChild(canvas);

      this._onRedraw = () => {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = requestAnimationFrame(() => {
          this._raf = undefined;
          if (!this._map || !this._canvas) return;
          syncGeometry(L, this);
          paintLabels(L, this._map, this._canvas, this.options);
        });
      };

      this._onZoomStart = () => {
        if (this._canvas) this._canvas.style.visibility = "hidden";
      };
      this._onZoomEnd = () => {
        if (this._canvas) this._canvas.style.visibility = "visible";
        this._onRedraw?.();
      };

      map.on("move viewreset resize", this._onRedraw);
      map.on("zoomstart", this._onZoomStart);
      map.on("zoomend", this._onZoomEnd);
      // Instant zoom (no animation) still needs a mid-zoom redraw
      map.on("zoom", this._onRedraw);

      syncGeometry(L, this);
      paintLabels(L, map, canvas, this.options);
    },

    onRemove(this: ParcelLayerInst) {
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._map) {
        if (this._onRedraw) {
          this._map.off("move viewreset resize zoom", this._onRedraw);
        }
        if (this._onZoomStart) this._map.off("zoomstart", this._onZoomStart);
        if (this._onZoomEnd) this._map.off("zoomend", this._onZoomEnd);
      }
      if (this._poly) {
        this._poly.remove();
        this._poly = undefined;
      }
      if (this._corners) {
        this._corners.clearLayers();
        this._corners.remove();
        this._corners = undefined;
      }
      if (this._canvas) L.DomUtil.remove(this._canvas);
      this._canvas = undefined;
    },

    setParcelOptions(this: ParcelLayerInst, next: ParcelCanvasOpts) {
      this.options = next;
      syncGeometry(L, this);
      if (this._map && this._canvas) paintLabels(L, this._map, this._canvas, next);
    },

    getBounds(this: ParcelLayerInst) {
      const ring = this.options.rings[0];
      if (!ring?.length) return L.latLngBounds([0, 0], [0, 0]);
      return L.latLngBounds(ring.map(([lat, lng]) => [lat, lng] as [number, number]));
    },
  });

  return new (ParcelOverlay as unknown as new (o: ParcelCanvasOpts) => ParcelLayerInst)(opts);
}

function syncGeometry(L: LeafletNS, layer: ParcelLayerInst) {
  const ring = layer.options.rings[0];
  if (!ring?.length || !layer._poly || !layer._corners) return;

  const latlngs = ring.map(([lat, lng]) => L.latLng(lat, lng));
  layer._poly.setLatLngs(latlngs);

  layer._corners.clearLayers();
  const hard = new Set(
    ringCornerPoints(ring).map((c) => `${c.lat.toFixed(7)},${c.lng.toFixed(7)}`)
  );
  const seen = new Set<string>();
  for (const [lat, lng] of ring) {
    const key = `${lat.toFixed(7)},${lng.toFixed(7)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const isHard = hard.has(key);
    L.circleMarker([lat, lng], {
      radius: isHard ? 5 : 3.5,
      color: "#f5e6c8",
      weight: 1.5,
      fillColor: "#caa064",
      fillOpacity: 1,
      opacity: 1,
      interactive: false,
    }).addTo(layer._corners);
  }
}

/** Labels only — fixed CSS px, pinned via container points each frame. */
function paintLabels(
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

  const topLeft = map.containerPointToLayerPoint([0, 0]);
  L.DomUtil.setPosition(canvas, topLeft);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size.x, size.y);

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

  const parcelNo = opts.parcelNumber?.trim();
  if (parcelNo) {
    const center = ringInteriorCentroid(ring);
    if (center) {
      const c = map.latLngToContainerPoint([center.lat, center.lng]);
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

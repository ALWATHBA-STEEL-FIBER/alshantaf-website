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
  /** One polygon per cadastral ring (multi-land). */
  _polys?: import("leaflet").FeatureGroup;
  _corners?: import("leaflet").LayerGroup;
  _onRedraw?: () => void;
  _onZoomStart?: () => void;
  _onZoomEnd?: () => void;
  _raf?: number;
  setParcelOptions: (o: ParcelCanvasOpts) => void;
  getBounds: () => import("leaflet").LatLngBounds;
};

const POLY_STYLE = {
  color: "#0f342f",
  weight: 2.5,
  opacity: 1,
  fillColor: "#c8a064",
  fillOpacity: 0.22,
  lineJoin: "round" as const,
  lineCap: "round" as const,
  interactive: false,
  className: "parcel-dls-outline",
};

function validRings(rings: [number, number][][] | undefined): [number, number][][] {
  return (rings ?? []).filter((r) => r?.length >= 3);
}

/**
 * DLS-accurate parcel overlay:
 * - Native Leaflet polygons + corner markers for every ring (multi-land).
 * - A viewport canvas draws length chips + parcel number in fixed screen pixels.
 */
export function createParcelCanvasLayer(L: LeafletNS, opts: ParcelCanvasOpts): ParcelLayerInst {
  const ParcelOverlay = L.Layer.extend({
    initialize(this: ParcelLayerInst, options: ParcelCanvasOpts) {
      this.options = options;
    },

    onAdd(this: ParcelLayerInst) {
      const map = this._map!;

      this._polys = L.featureGroup().addTo(map);
      this._corners = L.layerGroup().addTo(map);

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
      if (this._polys) {
        this._polys.clearLayers();
        this._polys.remove();
        this._polys = undefined;
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
      const rings = validRings(this.options.rings);
      if (!rings.length) return L.latLngBounds([0, 0], [0, 0]);
      const pts = rings.flat().map(([lat, lng]) => [lat, lng] as [number, number]);
      return L.latLngBounds(pts);
    },
  });

  return new (ParcelOverlay as unknown as new (o: ParcelCanvasOpts) => ParcelLayerInst)(opts);
}

function syncGeometry(L: LeafletNS, layer: ParcelLayerInst) {
  const rings = validRings(layer.options.rings);
  if (!layer._polys || !layer._corners) return;

  layer._polys.clearLayers();
  layer._corners.clearLayers();
  if (!rings.length) return;

  const seen = new Set<string>();
  for (const ring of rings) {
    const latlngs = ring.map(([lat, lng]) => L.latLng(lat, lng));
    L.polygon(latlngs, POLY_STYLE).addTo(layer._polys);

    const hard = new Set(
      ringCornerPoints(ring).map((c) => `${c.lat.toFixed(7)},${c.lng.toFixed(7)}`)
    );
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
}

/** Labels only — fixed CSS px, pinned via container points each frame. */
function paintLabels(
  L: LeafletNS,
  map: LeafletMap,
  canvas: HTMLCanvasElement,
  opts: ParcelCanvasOpts
) {
  const rings = validRings(opts.rings);
  if (!rings.length) return;

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
    // Scale each ring independently when a single official perimeter is provided
    // for one lot; for multi-land, leave scale at 1 (sum of sides ≈ SHAPE.LEN per ring).
    const multi = rings.length > 1;
    for (const ring of rings) {
      const edges = ringEdgeDimensions(ring);
      const sum = edges.reduce((s, e) => s + e.lengthM, 0);
      const scale =
        !multi &&
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
  }

  const parcelNo = opts.parcelNumber?.trim();
  if (parcelNo) {
    // Label each ring with its own number when "706, 707, …"; else one label at center.
    const parts = parcelNo.split(/[,،]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === rings.length && parts.length > 1) {
      for (let i = 0; i < rings.length; i++) {
        const center = ringInteriorCentroid(rings[i]!);
        if (!center) continue;
        drawParcelLabel(ctx, map, center.lat, center.lng, parts[i]!);
      }
    } else {
      const center =
        rings.length === 1
          ? ringInteriorCentroid(rings[0]!)
          : (() => {
              let lat = 0;
              let lng = 0;
              let n = 0;
              for (const ring of rings) {
                for (const p of ring) {
                  lat += p[0]!;
                  lng += p[1]!;
                  n++;
                }
              }
              return n ? { lat: lat / n, lng: lng / n } : null;
            })();
      if (center) drawParcelLabel(ctx, map, center.lat, center.lng, parcelNo);
    }
  }
}

function drawParcelLabel(
  ctx: CanvasRenderingContext2D,
  map: LeafletMap,
  lat: number,
  lng: number,
  text: string
) {
  const c = map.latLngToContainerPoint([lat, lng]);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.font = '800 14px system-ui, "IBM Plex Sans Arabic", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = "#0f342f";
  ctx.fillText(text, 0, 0);
  ctx.restore();
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

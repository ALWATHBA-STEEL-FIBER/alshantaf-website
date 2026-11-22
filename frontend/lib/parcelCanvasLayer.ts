"use client";

import {
  formatSideMeters,
  ringCornerPoints,
  ringEdgeDimensions,
  ringInteriorCentroid,
} from "@/lib/mapCoords";

/** DLS cadastral red — matches maps.dls.gov.jo parcel grid. */
export const DLS_PARCEL_RED = "#e31c1c";
export const DLS_PARCEL_RED_SOFT = "rgba(227, 28, 28, 0.14)";

export type ParcelCanvasOpts = {
  rings: [number, number][][];
  contextParcels?: Array<{
    rings: [number, number][][];
    parcelNo?: string | null;
    isSubject?: boolean;
  }> | null;
  showContextGrid?: boolean;
  showDimensions: boolean;
  perimeterM?: number | null;
  lang: "ar" | "en";
  parcelNumber?: string | null;
  parcelNumbers?: string[] | null;
  parcelLabel?: string;
  /**
   * Click a neighboring cadastral cell to switch selection (DLS-style).
   * Subject outline stays non-interactive so map pin-drop still works.
   */
  onContextParcelClick?: (coords: { lat: number; lng: number; parcelNo?: string | null }) => void;
  /** When false, neighbor cells are drawn but not clickable. */
  contextInteractive?: boolean;
};

type LeafletMap = import("leaflet").Map;
type LeafletNS = typeof import("leaflet");

type ParcelLayerInst = import("leaflet").Layer & {
  options: ParcelCanvasOpts;
  _map?: LeafletMap;
  _canvas?: HTMLCanvasElement;
  _polys?: import("leaflet").LayerGroup;
  _corners?: import("leaflet").LayerGroup;
  _svg?: import("leaflet").SVG;
  _onRedraw?: () => void;
  _raf?: number;
  _geomKey?: string;
  setParcelOptions: (o: ParcelCanvasOpts) => void;
  getBounds: () => import("leaflet").LatLngBounds;
};

/** SVG avoids Canvas-renderer ghost strokes when the grid rebuilds (preferCanvas maps). */
function parcelSvgRenderer(L: LeafletNS, map: LeafletMap): import("leaflet").SVG {
  const keyed = map as LeafletMap & { _alshantafParcelSvg?: import("leaflet").SVG };
  if (!keyed._alshantafParcelSvg) {
    keyed._alshantafParcelSvg = L.svg({ padding: 0.6 });
  }
  return keyed._alshantafParcelSvg;
}

/**
 * DLS-accurate parcel overlay:
 * - Native Leaflet polygons + corner markers track the map projection through zoom/pan.
 * - A viewport canvas draws length chips + parcel numbers in fixed screen pixels.
 * - Geometry is rebuilt only when rings/options change (not on every pan) so clicks stay reliable.
 */
export function createParcelCanvasLayer(L: LeafletNS, opts: ParcelCanvasOpts): ParcelLayerInst {
  const ParcelOverlay = L.Layer.extend({
    initialize(this: ParcelLayerInst, options: ParcelCanvasOpts) {
      this.options = options;
    },

    onAdd(this: ParcelLayerInst) {
      const map = this._map!;

      this._polys = L.layerGroup().addTo(map);

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
          // Labels only on pan/zoom — rebuilding polygons every frame ate clicks.
          paintLabels(L, this._map, this._canvas, this.options);
        });
      };

      map.on("move viewreset resize", this._onRedraw);
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
      const subject = this.options.rings.flat();
      if (subject.length) {
        return L.latLngBounds(subject.map(([lat, lng]) => [lat, lng] as [number, number]));
      }
      const ctx = (this.options.contextParcels ?? []).flatMap((p) => p.rings ?? []).flat();
      if (ctx.length) {
        return L.latLngBounds(ctx.map(([lat, lng]) => [lat, lng] as [number, number]));
      }
      return L.latLngBounds([0, 0], [0, 0]);
    },
  });

  return new (ParcelOverlay as unknown as new (o: ParcelCanvasOpts) => ParcelLayerInst)(opts);
}

function ringFingerprint(ring: [number, number][]): string {
  if (!ring.length) return "";
  const a = ring[0]!;
  const b = ring[Math.floor(ring.length / 2)]!;
  const c = ring[ring.length - 1]!;
  return `${ring.length}:${a[0].toFixed(5)},${a[1].toFixed(5)}:${b[0].toFixed(5)},${b[1].toFixed(5)}:${c[0].toFixed(5)},${c[1].toFixed(5)}`;
}

function geometryKey(opts: ParcelCanvasOpts): string {
  const rings = (opts.rings ?? []).map(ringFingerprint).join("|");
  const ctx = (opts.contextParcels ?? [])
    .map((p) => {
      const outer = p.rings?.[0];
      return `${p.parcelNo ?? ""}:${p.isSubject ? 1 : 0}:${outer ? ringFingerprint(outer) : ""}`;
    })
    .join("||");
  const clickable =
    opts.contextInteractive !== false && typeof opts.onContextParcelClick === "function" ? 1 : 0;
  return `${rings}::${ctx}::${opts.showContextGrid !== false ? 1 : 0}::${clickable}`;
}

function syncGeometry(L: LeafletNS, layer: ParcelLayerInst) {
  if (!layer._polys || !layer._corners || !layer._map) return;
  const rings = layer.options.rings.filter((ring) => ring.length > 0);
  const drawContext = layer.options.showContextGrid !== false;
  const hasContext =
    drawContext &&
    (layer.options.contextParcels ?? []).some((p) =>
      (p.rings ?? []).some((ring) => ring.length >= 3)
    );
  // Allow a cadastral grid with no subject selected (browse-before-pick).
  if (!rings.length && !hasContext) return;

  const nextKey = geometryKey(layer.options);
  // Rebuild only when rings/context change — not on every pan (clicks stay reliable).
  if (layer._geomKey === nextKey && layer._polys.getLayers().length > 0) {
    return;
  }
  layer._geomKey = nextKey;

  const svg = parcelSvgRenderer(L, layer._map);
  layer._polys.clearLayers();
  layer._corners.clearLayers();

  const contextInteractive =
    layer.options.contextInteractive !== false && typeof layer.options.onContextParcelClick === "function";
  const contextParcels = layer.options.contextParcels ?? [];
  if (drawContext) {
    // Cap drawn neighbors so dense cadastral areas stay smooth on phones.
    const MAX_CONTEXT_POLYS = 700;
    let drawn = 0;
    const seen = new Set<string>();
    for (const parcel of contextParcels) {
      if (parcel.isSubject) continue;
      const outer = parcel.rings?.[0];
      if (!outer || outer.length < 3) continue;
      const id = `${parcel.parcelNo ?? ""}:${ringFingerprint(outer)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      if (drawn >= MAX_CONTEXT_POLYS) break;
      drawn += 1;
      const poly = L.polygon(
        outer.map(([lat, lng]) => L.latLng(lat, lng)),
        {
          color: DLS_PARCEL_RED,
          weight: 1.5,
          opacity: 0.95,
          fillColor: DLS_PARCEL_RED,
          fillOpacity: contextInteractive ? 0.01 : 0,
          lineJoin: "round",
          lineCap: "round",
          interactive: contextInteractive,
          className: "parcel-dls-context",
          bubblingMouseEvents: true,
          renderer: svg,
        }
      );
      if (contextInteractive) {
        const parcelNo = parcel.parcelNo ?? null;
        poly.on("click", (e: import("leaflet").LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          const cb = layer.options.onContextParcelClick;
          if (!cb) return;
          cb({
            lat: e.latlng.lat,
            lng: e.latlng.lng,
            parcelNo,
          });
        });
      }
      poly.addTo(layer._polys);
    }
  }
  if (rings.length) {
    // Subject: one polygon (outer + holes) so edges aren't stroked twice.
    const latLngs = rings.map((ring) => ring.map(([lat, lng]) => L.latLng(lat, lng)));
    L.polygon(latLngs as import("leaflet").LatLngExpression[][], {
      color: DLS_PARCEL_RED,
      weight: 3.5,
      opacity: 1,
      fillColor: DLS_PARCEL_RED,
      fillOpacity: 0.12,
      lineJoin: "round",
      lineCap: "round",
      interactive: false,
      className: "parcel-dls-outline",
      renderer: svg,
    }).addTo(layer._polys);
  }

  if (!rings.length) return;
  const hard = new Set<string>();
  for (const ring of rings) {
    for (const c of ringCornerPoints(ring)) {
      hard.add(`${c.lat.toFixed(7)},${c.lng.toFixed(7)}`);
    }
  }
  const seen = new Set<string>();
  for (const ring of rings) {
    for (const [lat, lng] of ring) {
      const key = `${lat.toFixed(7)},${lng.toFixed(7)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const isHard = hard.has(key);
      L.circleMarker([lat, lng], {
        radius: isHard ? 4 : 3,
        color: "#ffffff",
        weight: 1.25,
        fillColor: DLS_PARCEL_RED,
        fillOpacity: 1,
        opacity: 1,
        interactive: false,
        renderer: svg,
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
  const rings = opts.rings.filter((ring) => ring.length > 0);
  const hasContextLabels =
    opts.showContextGrid !== false &&
    (opts.contextParcels ?? []).some((p) => Boolean(p.parcelNo) && !p.isSubject);
  if (!rings.length && !hasContextLabels) return;

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

  if (opts.showDimensions && rings.length) {
    for (const ring of rings) {
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
  }

  const numbers =
    opts.parcelNumbers && opts.parcelNumbers.length
      ? opts.parcelNumbers
      : opts.parcelNumber?.trim()
        ? [opts.parcelNumber.trim()]
        : [];
  for (let i = 0; i < rings.length; i++) {
    const parcelNo = numbers[i] || numbers[0];
    if (!parcelNo) continue;
    const center = ringInteriorCentroid(rings[i]);
    if (!center) continue;
    const c = map.latLngToContainerPoint([center.lat, center.lng]);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.font = '800 13px system-ui, "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.strokeText(parcelNo, 0, 0);
    ctx.fillStyle = "#111111";
    ctx.fillText(parcelNo, 0, 0);
    ctx.restore();
  }
  if (opts.showContextGrid !== false) {
    const contextParcels = opts.contextParcels ?? [];
    for (const parcel of contextParcels) {
      if (parcel.isSubject || !parcel.parcelNo) continue;
      const ring = parcel.rings?.[0];
      if (!ring || ring.length < 3) continue;
      const center = ringInteriorCentroid(ring);
      if (!center) continue;
      const c = map.latLngToContainerPoint([center.lat, center.lng]);
      if (c.x < -48 || c.y < -48 || c.x > size.x + 48 || c.y > size.y + 48) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.font = '700 12px system-ui, "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.strokeText(parcel.parcelNo, 0, 0);
      ctx.fillStyle = "#111111";
      ctx.fillText(parcel.parcelNo, 0, 0);
      ctx.restore();
    }
  }
  if (!numbers.length && opts.parcelLabel && rings[0]?.length) {
    const center = ringInteriorCentroid(rings[0]);
    if (center) {
      const c = map.latLngToContainerPoint([center.lat, center.lng]);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.font = '700 11px system-ui, "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(17,17,17,0.95)";
      ctx.fillText(opts.parcelLabel, 0, 0);
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

"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  contourBandsForRelief,
  contourSegments,
  elevRangeInsidePoly,
  elevTintRgb,
  evenSpreadContourLevels,
  pointInPoly,
  smoothElevGrid,
} from "@/lib/elevationContours";
import {
  formatMeters,
  toLocalEnu,
} from "@/lib/mapCoords";
import {
  drawParcelContextMap,
  drawParcelContourMap,
  printParcelBlueprint,
  type BlueprintMeta,
  type ElevGridSnapshot,
} from "@/lib/parcelBlueprint";
import type { AdjacentRoad, ParcelRing } from "@/components/LocationInput";

export type ParcelSideViewHandle = {
  printBlueprint: (opts?: { mapSnapshot?: string | null }) => Promise<void>;
  isReady: () => boolean;
};

type Props = {
  polygon: ParcelRing[] | null | undefined;
  title: string;
  note: string;
  lengthLabel: string;
  widthLabel: string;
  schematicNote: string;
  disclaimer: string;
  googleEarthCta: string;
  googleMapsCta: string;
  loadingLabel: string;
  fullscreenLabel: string;
  exitFullscreenLabel: string;
  lang: "ar" | "en";
  blueprintMeta?: BlueprintMeta;
  onReadyChange?: (ready: boolean) => void;
  /** Fires once when elevation load finishes (success or failure). */
  onSettledChange?: () => void;
  /** When true, omit outer card chrome (parent section already provides it). */
  embedded?: boolean;
  /**
   * Fill the parent map stage edge-to-edge — no nested card, no inner
   * fullscreen chrome, canvas uses the full surface. Used when topography
   * replaces the 2D map in place.
   */
  fillSurface?: boolean;
  adjacentRoads?: AdjacentRoad[] | null;
};

type ElevGrid = ElevGridSnapshot & {
  minElev: number;
  maxElev: number;
};

type SceneBundle = {
  THREE: typeof import("three");
  scene: import("three").Scene;
  camera: import("three").PerspectiveCamera;
  renderer: import("three").WebGLRenderer;
};

function ringBBox(ring: [number, number][]) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of ring) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

function ringCentroidLatLng(ring: [number, number][]) {
  let lat = 0;
  let lng = 0;
  for (const [a, b] of ring) {
    lat += a;
    lng += b;
  }
  return { lat: lat / ring.length, lng: lng / ring.length };
}

function googleEarthUrl(lat: number, lng: number, spanM: number) {
  const distance = Math.max(180, Math.min(2500, spanM * 4.5));
  return `https://earth.google.com/web/@${lat.toFixed(6)},${lng.toFixed(6)},${Math.round(distance * 0.35)}a,${Math.round(distance)}d,35y,60h,60t,0r`;
}

function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/@${lat.toFixed(6)},${lng.toFixed(6)},120a,35y,45h,60t/data=!3m1!1e3`;
}

function elevLabel(m: number, lang: "ar" | "en") {
  const n = Math.round(m);
  return lang === "ar" ? `${n} م` : `${n} m`;
}

function makeLabelSprite(
  THREE: typeof import("three"),
  text: string,
  major: boolean
): import("three").Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 64);
  ctx.font = `bold ${major ? 28 : 22}px "IBM Plex Sans Arabic",system-ui,sans-serif`;
  const tw = ctx.measureText(text).width;
  const padX = 14;
  const boxW = tw + padX * 2;
  const boxH = major ? 36 : 30;
  const bx = (256 - boxW) / 2;
  const by = (64 - boxH) / 2;
  ctx.fillStyle = "rgba(7,24,22,0.88)";
  ctx.strokeStyle = major ? "rgba(232,201,138,0.95)" : "rgba(200,154,88,0.7)";
  ctx.lineWidth = 2;
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.strokeRect(bx, by, boxW, boxH);
  ctx.fillStyle = major ? "#e8c98a" : "#c89a58";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 10;
  const scale = major ? 16 : 13;
  sprite.scale.set(scale, scale * 0.28, 1);
  return sprite;
}

export const ParcelSideView = forwardRef<ParcelSideViewHandle, Props>(function ParcelSideView(
  {
    polygon,
    title,
    note,
    lengthLabel,
    widthLabel,
    schematicNote,
    disclaimer,
    googleEarthCta,
    googleMapsCta,
    loadingLabel,
    fullscreenLabel,
    exitFullscreenLabel,
    lang,
    blueprintMeta,
    onReadyChange,
    onSettledChange,
    embedded = false,
    fillSurface = false,
    adjacentRoads = null,
  },
  ref
) {
  const rings = useMemo(
    () =>
      (polygon ?? [])
        .map((ring) => {
          const pts = ring.slice();
          const first = pts[0];
          const last = pts[pts.length - 1];
          if (first && last && first[0] === last[0] && first[1] === last[1]) pts.pop();
          return pts;
        })
        .filter((pts) => pts.length >= 3),
    [polygon]
  );
  const mountRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const bundleRef = useRef<SceneBundle | null>(null);
  const gridRef = useRef<ElevGrid | null>(null);
  const intervalRef = useRef(2);
  const metaRef = useRef(blueprintMeta);
  metaRef.current = blueprintMeta;
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [elevHint, setElevHint] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenRef = useRef(fullscreen);
  fullscreenRef.current = fullscreen;

  const model = useMemo(() => {
    if (!rings.length) return null;
    const allPts = rings.flat();
    const origin = ringCentroidLatLng(allPts);
    const enuRings = rings.map((pts) =>
      pts.map(([lat, lng]) => toLocalEnu(lat, lng, origin.lat, origin.lng))
    );
    const bbox = ringBBox(allPts);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const ringEnu of enuRings) {
      for (const p of ringEnu) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }
    const span = Math.max(maxX - minX, maxY - minY, 1);
    const extents = { lengthM: maxY - minY, widthM: maxX - minX };
    return { rings, allPts, enuRings, origin, extents, span, bbox, centroid: origin };
  }, [rings]);
  const modelRef = useRef(model);
  modelRef.current = model;

  useImperativeHandle(ref, () => ({
    isReady: () => !!gridRef.current && !!modelRef.current,
    printBlueprint: async (opts) => {
      const modelNow = modelRef.current;
      const grid = gridRef.current;
      const meta = metaRef.current;
      if (!modelNow || !grid || !meta) {
        throw new Error("not-ready");
      }

      const topCanvas = await drawParcelContextMap({
        rings: modelNow.rings,
        lang,
        perimeterM: meta.perimeterM,
        // Generate a landscape map panel so the PDF map view reads wider.
        width: 2080,
        height: 1240,
        parcelNumber: meta.parcel,
        mapSnapshot: opts?.mapSnapshot ?? null,
      });
      const contourCanvas = drawParcelContourMap({
        grid,
        rings: modelNow.rings,
        lang,
        width: 2080,
        height: 1560,
      });
      const contextPng = topCanvas.toDataURL("image/jpeg", 0.92);
      const contourPng = contourCanvas.toDataURL("image/jpeg", 0.92);
      // Contour panel is required; context may use map snapshot without satellite API
      if (contourPng.length < 4000) throw new Error("contour-failed");
      if (contextPng.length < 2000) throw new Error("context-failed");
      const elev = smoothElevGrid(Float32Array.from(grid.elevations), grid.cols, grid.rows, 3);
      const printPolys = modelNow.enuRings.map((ringEnu) => ringEnu.map((p) => ({ x: p.x, y: p.y })));
      let elevMinM = Number.POSITIVE_INFINITY;
      let elevMaxM = Number.NEGATIVE_INFINITY;
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          const lat = grid.maxLat - ((r + 0.5) / grid.rows) * (grid.maxLat - grid.minLat);
          const lng = grid.minLng + ((c + 0.5) / grid.cols) * (grid.maxLng - grid.minLng);
          const enu = toLocalEnu(lat, lng, modelNow.origin.lat, modelNow.origin.lng);
          const inside = printPolys.some((poly) => pointInPoly(enu.x, enu.y, poly));
          if (!inside) continue;
          const z = elev[r * grid.cols + c]!;
          if (z < elevMinM) elevMinM = z;
          if (z > elevMaxM) elevMaxM = z;
        }
      }
      if (!Number.isFinite(elevMinM) || !Number.isFinite(elevMaxM)) {
        elevMinM = grid.minElev;
        elevMaxM = grid.maxElev;
      }

      await printParcelBlueprint({
        meta: {
          ...meta,
          lang,
          lengthM: modelNow.extents?.lengthM ?? meta.lengthM ?? null,
          widthM: modelNow.extents?.widthM ?? meta.widthM ?? null,
        },
        contextPng,
        contourPng,
        elevMinM,
        elevMaxM,
        contourIntervalM: intervalRef.current,
      });
    },
  }));

  useEffect(() => {
    onReadyChange?.(status === "ready");
  }, [status, onReadyChange]);

  useEffect(() => {
    if (status === "ready" || status === "failed") onSettledChange?.();
  }, [status, onSettledChange]);

  useEffect(() => {
    if (!model || !mountRef.current) {
      setStatus("idle");
      return;
    }

    const mount = mountRef.current;
    let cancelled = false;
    let renderer: import("three").WebGLRenderer | null = null;
    let controls: { dispose: () => void; update: () => void } | null = null;
    let raf = 0;
    const disposables: Array<{ dispose: () => void }> = [];

    setStatus("loading");
    setElevHint(null);
    bundleRef.current = null;

    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      if (cancelled || !mountRef.current) return;

      const padLat = Math.max((model.bbox.maxLat - model.bbox.minLat) * 0.08, 0.00005);
      const padLng = Math.max((model.bbox.maxLng - model.bbox.minLng) * 0.08, 0.00005);
      let minLat = model.bbox.minLat - padLat;
      let maxLat = model.bbox.maxLat + padLat;
      let minLng = model.bbox.minLng - padLng;
      let maxLng = model.bbox.maxLng + padLng;
      // Keep elevation-grid under API span limits for large parcels
      const latC = (minLat + maxLat) / 2;
      const lngC = (minLng + maxLng) / 2;
      const maxSpan = 0.14;
      if (maxLat - minLat > maxSpan) {
        minLat = latC - maxSpan / 2;
        maxLat = latC + maxSpan / 2;
      }
      if (maxLng - minLng > maxSpan) {
        minLng = lngC - maxSpan / 2;
        maxLng = lngC + maxSpan / 2;
      }
      const qs = new URLSearchParams({
        minLat: String(minLat),
        maxLat: String(maxLat),
        minLng: String(minLng),
        maxLng: String(maxLng),
        cols: "128",
        rows: "128",
      });

      let grid: ElevGrid | null = gridRef.current;
      if (!grid) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch(`/api/location/elevation-grid?${qs}`, { cache: "no-cache" });
            if (!res.ok) throw new Error(`elevation-grid-${res.status}`);
            grid = (await res.json()) as ElevGrid;
            break;
          } catch {
            if (attempt === 2) throw new Error("elevation-grid");
            await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
          }
        }
      }
      if (!grid) throw new Error("elevation-grid");
      if (cancelled) return;
      gridRef.current = grid;

      const rawElev = Float32Array.from(grid.elevations);
      const elev = smoothElevGrid(rawElev, grid.cols, grid.rows, 3);
      const origin = model.origin;
      const polyEnuRings = model.enuRings.map((ringEnu) => ringEnu.map((p) => ({ x: p.x, y: p.y })));
      const pointInsideSelected = (x: number, y: number) =>
        polyEnuRings.some((poly) => pointInPoly(x, y, poly));
      const latAt = (row: number) => grid.maxLat - ((row + 0.5) / grid.rows) * (grid.maxLat - grid.minLat);
      const lngAt = (col: number) => grid.minLng + ((col + 0.5) / grid.cols) * (grid.maxLng - grid.minLng);
      // Elevation range from the land itself (not the padded DEM around it)
      let zMin = Number.POSITIVE_INFINITY;
      let zMax = Number.NEGATIVE_INFINITY;
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          const enu = toLocalEnu(latAt(r), lngAt(c), origin.lat, origin.lng);
          if (!pointInsideSelected(enu.x, enu.y)) continue;
          const z = elev[r * grid.cols + c]!;
          if (z < zMin) zMin = z;
          if (z > zMax) zMax = z;
        }
      }
      if (!Number.isFinite(zMin) || !Number.isFinite(zMax)) {
        const fallback = elevRangeInsidePoly(
          elev,
          grid.cols,
          grid.rows,
          (c, r) => toLocalEnu(latAt(r), lngAt(c), origin.lat, origin.lng),
          polyEnuRings[0]!
        );
        zMin = fallback.min;
        zMax = fallback.max;
      }
      const relief = Math.max(0.05, zMax - zMin);
      // Near true vertical scale (1 m ≈ 1 m). Mild boost only on nearly flat parcels.
      const exag = relief < 1.25 ? 1.2 : relief < 2.5 ? 1.1 : 1;
      // Divide the land's elevation difference into equal mathematical layers
      const bands = contourBandsForRelief(relief);
      const { levels, interval } = evenSpreadContourLevels(zMin, zMax, bands);
      const majorEvery = Math.max(1, Math.round(bands / 4));
      intervalRef.current = interval;
      setElevHint(`${elevLabel(zMin, lang)} – ${elevLabel(zMax, lang)}`);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x071816);

      const w = mount.clientWidth || 840;
      const fillH = mount.clientHeight;
      const h =
        fillSurface || fullscreenRef.current
          ? Math.max(280, fillH || Math.round(w * 0.72))
          : Math.max(280, Math.round(w * 0.48));
      const camera = new THREE.PerspectiveCamera(38, w / h, 0.5, model.span * 20);
      const camDist = model.span * 1.85;
      camera.position.set(-camDist * 0.75, relief * exag * 1.35 + model.span * 0.35, camDist * 0.85);
      camera.lookAt(0, relief * exag * 0.35, 0);

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height =
        fillSurface || fullscreenRef.current ? "100%" : "auto";
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "none";
      mount.replaceChildren(renderer.domElement);
      bundleRef.current = { THREE, scene, camera, renderer };

      scene.add(new THREE.AmbientLight(0xd4b07a, 0.72));
      const key = new THREE.DirectionalLight(0xfff6e4, 1.15);
      key.position.set(-1.2, 2.4, 1.1);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x7a9e94, 0.45);
      fill.position.set(1.4, 0.8, -1);
      scene.add(fill);

      const contourGroup = new THREE.Group();
      scene.add(contourGroup);

      const toWorld = (col: number, row: number, elevM: number) => {
        const enu = toLocalEnu(latAt(row), lngAt(col), origin.lat, origin.lng);
        return new THREE.Vector3(enu.x, (elevM - zMin) * exag, -enu.y);
      };

      const toWorldFrac = (gx: number, gy: number, elevM: number) => {
        const lat = grid.maxLat - (gy / Math.max(1, grid.rows - 1)) * (grid.maxLat - grid.minLat);
        const lng = grid.minLng + (gx / Math.max(1, grid.cols - 1)) * (grid.maxLng - grid.minLng);
        const enu = toLocalEnu(lat, lng, origin.lat, origin.lng);
        return new THREE.Vector3(enu.x, (elevM - zMin) * exag, -enu.y);
      };

      for (const level of levels) {
        const layerIndex = Math.round((level - zMin) / interval);
        const major = layerIndex % majorEvery === 0;
        const segs = contourSegments(elev, grid.cols, grid.rows, level);
        const positions: number[] = [];
        let labelPos: import("three").Vector3 | null = null;
        let bestLen = 0;
        let labelAny: import("three").Vector3 | null = null;
        let bestAny = 0;
        for (const [x0, y0, x1, y1] of segs) {
          const midX = (x0 + x1) / 2;
          const midY = (y0 + y1) / 2;
          const midLat = grid.maxLat - (midY / Math.max(1, grid.rows - 1)) * (grid.maxLat - grid.minLat);
          const midLng = grid.minLng + (midX / Math.max(1, grid.cols - 1)) * (grid.maxLng - grid.minLng);
          const midEnu = toLocalEnu(midLat, midLng, origin.lat, origin.lng);
          const a = toWorldFrac(x0, y0, level);
          const b = toWorldFrac(x1, y1, level);
          const inside = pointInsideSelected(midEnu.x, midEnu.y);
          if (inside) {
            positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
            const len = a.distanceTo(b);
            if (len > bestLen) {
              bestLen = len;
              labelPos = a.clone().add(b).multiplyScalar(0.5);
            }
          }
          const anyLen = a.distanceTo(b);
          if (anyLen > bestAny) {
            bestAny = anyLen;
            labelAny = a.clone().add(b).multiplyScalar(0.5);
          }
        }
        if (positions.length < 6) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        disposables.push(geo);
        const mat = new THREE.LineBasicMaterial({
          color: major ? 0xe8c98a : 0xc89a58,
          transparent: true,
          opacity: major ? 1 : 0.82,
          depthWrite: false,
          depthTest: true,
        });
        disposables.push(mat);
        const lines = new THREE.LineSegments(geo, mat);
        lines.renderOrder = 2;
        contourGroup.add(lines);

        // Always label every contour level that has geometry (prefer inside parcel)
        const labelAt = labelPos ?? labelAny;
        if (labelAt) {
          const sprite = makeLabelSprite(THREE, elevLabel(level, lang), major);
          sprite.position.copy(labelAt);
          sprite.position.y += major ? 1.8 : 1.2;
          const map = sprite.material.map;
          if (map) disposables.push(map);
          disposables.push(sprite.material);
          contourGroup.add(sprite);
        }
      }

      {
        const positions: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];
        const cols = grid.cols;
        const rows = grid.rows;
        const inside = new Uint8Array(cols * rows);
        const range = Math.max(0.01, zMax - zMin);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const enu = toLocalEnu(latAt(r), lngAt(c), origin.lat, origin.lng);
            inside[r * cols + c] = pointInsideSelected(enu.x, enu.y) ? 1 : 0;
            const e = elev[r * cols + c]!;
            const v = toWorld(c, r, e);
            positions.push(v.x, v.y, v.z);
            const [cr, cg, cb] = elevTintRgb((e - zMin) / range);
            colors.push(cr / 255, cg / 255, cb / 255);
          }
        }
        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const i00 = r * cols + c;
            const i10 = r * cols + c + 1;
            const i01 = (r + 1) * cols + c;
            const i11 = (r + 1) * cols + c + 1;
            if (!(inside[i00] && inside[i10] && inside[i01] && inside[i11])) continue;
            indices.push(i00, i01, i10, i10, i01, i11);
          }
        }
        if (indices.length) {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
          geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
          geo.setIndex(indices);
          geo.computeVertexNormals();
          disposables.push(geo);
          const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            metalness: 0.08,
            roughness: 0.62,
            transparent: true,
            opacity: 0.92,
            side: THREE.DoubleSide,
            flatShading: false,
          });
          disposables.push(mat);
          const mesh = new THREE.Mesh(geo, mat);
          mesh.renderOrder = 0;
          scene.add(mesh);

          // Slightly lifted wire-lite overlay for volume edges
          const wire = new THREE.Mesh(
            geo,
            new THREE.MeshBasicMaterial({
              color: 0xc89a58,
              wireframe: true,
              transparent: true,
              opacity: 0.12,
              depthWrite: false,
            })
          );
          wire.renderOrder = 1;
          disposables.push(wire.material);
          scene.add(wire);
        }
      }

      {
        const outline: number[] = [];
        for (let rIdx = 0; rIdx < model.enuRings.length; rIdx++) {
          const ringEnu = model.enuRings[rIdx]!;
          const ringLatLng = model.rings[rIdx]!;
          for (let i = 0; i <= ringEnu.length; i++) {
            const p = ringEnu[i % ringEnu.length]!;
            const [lat, lng] = ringLatLng[i % ringLatLng.length]!;
            const col = Math.max(
              0,
              Math.min(grid.cols - 1, Math.round(((lng - grid.minLng) / (grid.maxLng - grid.minLng)) * (grid.cols - 1)))
            );
            const row = Math.max(
              0,
              Math.min(grid.rows - 1, Math.round(((grid.maxLat - lat) / (grid.maxLat - grid.minLat)) * (grid.rows - 1)))
            );
            const e = elev[row * grid.cols + col]!;
            outline.push(p.x, (e - zMin) * exag + 0.45, -p.y);
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(outline, 3));
        disposables.push(geo);
        const mat = new THREE.LineBasicMaterial({ color: 0xe8c98a, linewidth: 2 });
        disposables.push(mat);
        const line = new THREE.Line(geo, mat);
        line.renderOrder = 3;
        scene.add(line);
      }

      // Info-only mode: adjacent street details are shown in the textual cards.

      const orbit = new OrbitControls(camera, renderer.domElement);
      orbit.enableDamping = true;
      orbit.dampingFactor = 0.08;
      orbit.target.set(0, relief * exag * 0.3, 0);
      orbit.minDistance = model.span * 0.4;
      orbit.maxDistance = model.span * 6;
      orbit.maxPolarAngle = Math.PI * 0.48;
      orbit.update();
      controls = orbit;

      const onResize = () => {
        if (!renderer || !mountRef.current) return;
        const nw = mountRef.current.clientWidth || w;
        const fs = fullscreenRef.current || fillSurface;
        const nh = fs
          ? Math.max(280, mountRef.current.clientHeight || Math.round(window.innerHeight * 0.85))
          : Math.max(280, Math.round(nw * 0.48));
        camera.aspect = nw / Math.max(1, nh);
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh, false);
        renderer.domElement.style.height = fs ? "100%" : "auto";
      };
      window.addEventListener("resize", onResize);
      // Size after portal/layout paint
      [40, 120, 280].forEach((ms) => window.setTimeout(onResize, ms));

      const tick = () => {
        if (cancelled) return;
        raf = requestAnimationFrame(tick);
        controls?.update();
        renderer?.render(scene, camera);
      };
      tick();
      setStatus("ready");

      (mount as HTMLDivElement & { __cleanup?: () => void; __resize?: () => void }).__cleanup = () => {
        window.removeEventListener("resize", onResize);
      };
      (mount as HTMLDivElement & { __cleanup?: () => void; __resize?: () => void }).__resize = onResize;
    })().catch(() => {
      if (!cancelled) setStatus("failed");
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      const extra = (mount as HTMLDivElement & { __cleanup?: () => void }).__cleanup;
      extra?.();
      controls?.dispose();
      disposables.forEach((d) => d.dispose());
      renderer?.dispose();
      bundleRef.current = null;
      if (renderer?.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      mount.replaceChildren();
    };
  }, [model, lang, fullscreen, fillSurface]);

  // Body scroll lock + Escape while portal fullscreen is open
  useEffect(() => {
    if (!fullscreen) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    const onTouchMove = (e: TouchEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.(".parcel-side-mount, .parcel-fs-portal-toolbar")) return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
      document.documentElement.style.overflow = prevHtmlOverflow;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, [fullscreen]);

  if (!model) return null;

  const earthHref = googleEarthUrl(model.centroid.lat, model.centroid.lng, model.span);
  const mapsHref = googleMapsUrl(model.centroid.lat, model.centroid.lng);

  const toolbar = (fs: boolean) => (
    <div
      className={`${fs ? "parcel-fs-portal-toolbar" : ""} shrink-0 flex flex-wrap items-center justify-end gap-2 px-2 py-2 ${
        fs ? "bg-[#0f342f] border-b border-gold/35" : "bg-[#0a1f1c] border-b border-gold/25"
      }`}
    >
      <button
        type="button"
        onClick={() => setFullscreen((v) => !v)}
        className={`h-8 px-3 rounded-full border text-[11px] font-bold transition-colors ${
          fs
            ? "border-gold bg-gold text-[#0a1f1c]"
            : "border-gold/40 bg-[#0f342f] text-gold hover:border-gold"
        }`}
        aria-pressed={fs}
      >
        {fs ? exitFullscreenLabel : fullscreenLabel}
      </button>
    </div>
  );

  const googleLinks = (
    <div className="flex flex-wrap items-center gap-1.5 px-1 pt-2">
      <a
        href={earthHref}
        target="_blank"
        rel="noopener noreferrer"
        className="h-7 px-2.5 rounded-full bg-green text-white text-[10px] font-bold inline-flex items-center hover:bg-green-2 transition-colors"
      >
        {googleEarthCta}
      </a>
      <a
        href={mapsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="h-7 px-2.5 rounded-full border border-gold/40 bg-[#0a1f1c] text-gold text-[10px] font-bold inline-flex items-center hover:border-gold transition-colors"
      >
        {googleMapsCta}
      </a>
    </div>
  );

  const viewer = (fs: boolean) => (
    <div
      ref={fs ? shellRef : undefined}
      className={
        fs
          ? "parcel-fs-portal fixed inset-0 z-[10000] flex flex-col gap-2 bg-[#0a1f1c] p-3 overflow-hidden"
          : "parcel-side-shell mt-2 rounded-lg overflow-hidden border border-gold/30 bg-[#071816] flex flex-col gap-0 p-0"
      }
      style={
        fs
          ? {
              paddingTop: "max(0.75rem, calc(env(safe-area-inset-top, 0px) + 0.4rem))",
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
            }
          : undefined
      }
      role={fs ? "dialog" : undefined}
      aria-modal={fs ? true : undefined}
    >
      {toolbar(fs)}
      <div className={`relative min-h-0 ${fs ? "flex-1 flex flex-col" : ""}`}>
        <div
          ref={mountRef}
          className={`parcel-side-mount w-full ${fs ? "flex-1 min-h-0 h-full" : "min-h-[280px]"}`}
        />
        {(status === "loading" || status === "idle") && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#071816]/80 text-xs font-bold text-gold-2">
            {loadingLabel}
          </div>
        )}
        {status === "failed" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#071816]/90 text-xs font-bold text-gold/80 px-4 text-center">
            {schematicNote}
          </div>
        )}
      </div>
      {fs && (
        <div className="shrink-0 flex flex-wrap items-center gap-1.5 px-1">
          <a
            href={earthHref}
            target="_blank"
            rel="noopener noreferrer"
            className="h-7 px-2.5 rounded-full bg-green text-white text-[10px] font-bold inline-flex items-center"
          >
            {googleEarthCta}
          </a>
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="h-7 px-2.5 rounded-full border border-gold/40 text-gold text-[10px] font-bold inline-flex items-center"
          >
            {googleMapsCta}
          </a>
        </div>
      )}
    </div>
  );

  /** Edge-to-edge map-stage surface — one plane, floating chips, no nested frames. */
  if (fillSurface) {
    return (
      <div className="absolute inset-0 overflow-hidden bg-[#071816]" role="region" aria-label={title}>
        <div ref={mountRef} className="parcel-side-mount absolute inset-0 h-full w-full" />
        {(status === "loading" || status === "idle") && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#071816]/85 text-xs font-bold text-gold-2">
            {loadingLabel}
          </div>
        )}
        {status === "failed" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#071816]/90 px-6 text-center text-xs font-bold text-gold/80">
            {schematicNote}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-2 bg-gradient-to-b from-[#071816]/90 via-[#071816]/35 to-transparent px-3 pb-8 pt-2.5">
          <div className="min-w-0 max-w-[min(100%,22rem)]">
            {elevHint ? (
              <p className="text-[11px] font-bold tabular-nums text-gold">
                <span className="font-semibold text-gold/70">
                  {lang === "ar" ? "المناسيب: " : "Elevations: "}
                </span>
                {elevHint}
              </p>
            ) : null}
            {model.extents ? (
              <p className="mt-0.5 text-[10px] tabular-nums text-gold-2/90">
                {lengthLabel} {formatMeters(model.extents.lengthM, lang)} · {widthLabel}{" "}
                {formatMeters(model.extents.widthM, lang)}
              </p>
            ) : null}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-end justify-between gap-2 bg-gradient-to-t from-[#071816]/95 via-[#071816]/45 to-transparent px-3 pb-2.5 pt-10">
          <p className="max-w-[16rem] text-[9px] leading-snug text-gold-2/65">{disclaimer}</p>
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
            <a
              href={earthHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center rounded-md bg-gold px-2.5 text-[10px] font-bold text-green"
            >
              {googleEarthCta}
            </a>
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center rounded-md border border-gold/45 bg-[#0a1f1c]/90 px-2.5 text-[10px] font-bold text-gold"
            >
              {googleMapsCta}
            </a>
          </div>
        </div>
      </div>
    );
  }

  const body = (
    <>
      <div className={`flex flex-wrap items-end justify-between gap-2 ${embedded ? "px-1" : "px-3 pt-3"}`}>
        <div>
          {!embedded && <p className="text-[10px] font-bold text-gold tracking-wide">{title}</p>}
          <p className={`text-[11px] leading-snug ${embedded ? "text-gold-2/90" : "text-ink-soft mt-0.5"}`}>
            {note}
          </p>
          {elevHint && (
            <p className={`text-[11px] tabular-nums mt-1 ${embedded ? "text-gold" : "text-green"}`}>
              <span className={embedded ? "text-gold/70" : "text-ink-soft"}>
                {lang === "ar" ? "المناسيب التقريبية: " : "Approx. elevations: "}
              </span>
              <b>{elevHint}</b>
            </p>
          )}
        </div>
        {model.extents && !fullscreen && (
          <p className={`text-[11px] tabular-nums ${embedded ? "text-gold-2" : "text-ink"}`}>
            <span className={embedded ? "text-gold/70" : "text-ink-soft"}>{lengthLabel}: </span>
            <b>{formatMeters(model.extents.lengthM, lang)}</b>
            <span className={embedded ? "text-gold/70" : "text-ink-soft"}> · {widthLabel}: </span>
            <b>{formatMeters(model.extents.widthM, lang)}</b>
          </p>
        )}
      </div>

      {!fullscreen && viewer(false)}
      {fullscreen && typeof document !== "undefined" && createPortal(viewer(true), document.body)}
      {!fullscreen && googleLinks}

      <p
        className={`px-1 pt-2 pb-1 text-[10px] font-medium leading-snug ${
          embedded
            ? "text-amber-200/90"
            : "px-3 pb-2 text-amber-900/90 bg-amber-50 border-t border-amber-200/80"
        }`}
      >
        {disclaimer}
      </p>
      <p className={`px-1 pb-1 text-[10px] leading-snug ${embedded ? "text-gold-2/70" : "px-3 pb-3 text-ink-soft"}`}>
        {schematicNote}
      </p>
    </>
  );

  if (embedded) {
    return <div className="mt-1">{body}</div>;
  }

  return (
    <div className="mt-3 rounded-xl border border-gold/35 bg-gradient-to-br from-white via-white to-gold/10 overflow-hidden">
      {body}
    </div>
  );
});

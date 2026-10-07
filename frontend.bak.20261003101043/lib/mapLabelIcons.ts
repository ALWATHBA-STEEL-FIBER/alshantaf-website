"use client";

/** Leaflet DivIcons centered on a lat/lng (explicit iconAnchor — CSS translate is unreliable). */

export function parcelDimDivIcon(
  L: typeof import("leaflet"),
  text: string,
  bearingDeg: number
): import("leaflet").DivIcon {
  const w = 96;
  const h = 32;
  return L.divIcon({
    className: "parcel-dim-label",
    html: `<div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;pointer-events:none">
      <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:rgba(15,52,47,.96);color:#fff;font:700 11px/1.15 system-ui,sans-serif;white-space:nowrap;letter-spacing:.01em;box-shadow:0 0 0 1.5px #caa064,0 2px 6px rgba(0,0,0,.35);transform:rotate(${bearingDeg}deg)">${text}</span>
    </div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h / 2],
  });
}

export function parcelNumberDivIcon(
  L: typeof import("leaflet"),
  title: string,
  number: string
): import("leaflet").DivIcon {
  const w = 112;
  const h = 56;
  return L.divIcon({
    className: "parcel-num-label",
    html: `<div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;pointer-events:none">
      <div style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:8px 14px;border-radius:12px;background:rgba(15,52,47,.96);color:#e8c98a;box-shadow:0 4px 18px rgba(0,0,0,.4);border:1.5px solid #caa064">
        <span style="font:600 9px/1 system-ui,sans-serif;letter-spacing:.06em;opacity:.85">${title}</span>
        <span style="font:800 16px/1 system-ui,sans-serif;letter-spacing:.02em">${number}</span>
      </div>
    </div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h / 2],
  });
}

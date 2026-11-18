"use client";

import { useEffect, useId, useState } from "react";

type Basemap = "map" | "satellite";
export type EditTool = "lines" | "space";
export type SurfaceView = "map" | "topo";

export type DlsMapControlsLabels = {
  zoomIn: string;
  zoomOut: string;
  tools: string;
  toolsClose: string;
  edit: string;
  editLines: string;
  editSpace: string;
  topo: string;
  topoMap: string;
  locate: string;
  locating: string;
  home: string;
  layers: string;
  layersMap: string;
  layersSatellite: string;
  compass: string;
  /** @deprecated kept for older call sites */
  draw?: string;
  /** @deprecated kept for older call sites */
  measure?: string;
};

type Props = {
  labels: DlsMapControlsLabels;
  basemap: Basemap;
  /** Active edit tool when measuring; null when off. */
  editTool?: EditTool | null;
  surfaceView?: SurfaceView;
  locating?: boolean;
  locateDisabled?: boolean;
  topoDisabled?: boolean;
  className?: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** Select lines (distance) or space (area) edit mode. Pass null to exit. */
  onEditToolChange: (tool: EditTool | null) => void;
  onSurfaceViewChange: (view: SurfaceView) => void;
  onLocate: () => void;
  onHome: () => void;
  onToggleLayers: () => void;
  onCompass: () => void;
};

const btn =
  "flex h-10 w-10 items-center justify-center bg-white text-[#3a4650] shadow-[0_1px_4px_rgba(0,0,0,0.28)] transition-colors hover:bg-[#f5f7f8] active:bg-[#e8ecee] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold disabled:opacity-55";
const btnActive = "bg-gold text-green hover:bg-gold-2 active:bg-gold-2";
const flyBtn =
  "flex h-10 w-10 items-center justify-center text-[#3a4650] transition-colors hover:bg-[#f0f3f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold";

function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconMinus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconMeter() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 14.5 14.5 4a2 2 0 0 1 2.8 2.8L6.8 17.3A2 2 0 0 1 4 14.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m8 11 1.2 1.2M10.5 8.5l1.2 1.2M13 6l1.2 1.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M16.2 3.2h4.2M18.3 1.2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}
function IconLines() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 17 17 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="4" cy="17" r="2" fill="currentColor" />
      <circle cx="17" cy="4" r="2" fill="currentColor" />
      <circle cx="10.5" cy="10.5" r="1.5" fill="currentColor" />
    </svg>
  );
}
function IconSpace() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 5h8l5 5v8H7L4 12 6 5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <circle cx="6" cy="5" r="1.35" fill="currentColor" />
      <circle cx="14" cy="5" r="1.35" fill="currentColor" />
      <circle cx="19" cy="10" r="1.35" fill="currentColor" />
      <circle cx="18" cy="18" r="1.35" fill="currentColor" />
      <circle cx="7" cy="18" r="1.35" fill="currentColor" />
      <circle cx="4" cy="12" r="1.35" fill="currentColor" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconTopo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 18 8.5 9l3.2 5.2L15 10l6 8H3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.14"
      />
      <path d="M5 18c2-1.2 3.5-1.2 5 0s3.2 1.4 5 .2 3-.8 4-.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".75" />
    </svg>
  );
}
function IconLocate() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconLayers({ satellite }: { satellite: boolean }) {
  return satellite ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 14c2.2-2 4.2-3 6-3s3.5 1.4 5 3 3 3 5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="9" r="1.4" fill="currentColor" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m4 9 8-4 8 4-8 4-8-4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m4 13 8 4 8-4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m4 17 8 4 8-4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function IconCompass() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 5.5 14.4 12 12 18.5 9.6 12 12 5.5Z" fill="currentColor" opacity=".9" />
      <circle cx="12" cy="12" r="1.2" fill="#fff" />
    </svg>
  );
}

/**
 * DLS-style vertical map widget stack — zoom / tools flyout with edit (lines|space)
 * + topography pills, gold active state for Al Shantaf.
 */
export function DlsMapControls({
  labels,
  basemap,
  editTool = null,
  surfaceView = "map",
  locating = false,
  locateDisabled = false,
  topoDisabled = false,
  className = "",
  onZoomIn,
  onZoomOut,
  onEditToolChange,
  onSurfaceViewChange,
  onLocate,
  onHome,
  onToggleLayers,
  onCompass,
}: Props) {
  const [toolsOpen, setToolsOpen] = useState(Boolean(editTool));
  const panelId = useId();
  const editing = editTool != null;
  const topoOn = surfaceView === "topo";

  useEffect(() => {
    if (editTool) setToolsOpen(true);
  }, [editTool]);

  function closeTools() {
    setToolsOpen(false);
    if (editTool) onEditToolChange(null);
  }

  function toggleTools() {
    if (toolsOpen) closeTools();
    else setToolsOpen(true);
  }

  function pickTool(tool: EditTool) {
    setToolsOpen(true);
    onEditToolChange(editTool === tool ? null : tool);
  }

  function toggleTopo() {
    if (topoDisabled) return;
    if (!topoOn && editing) onEditToolChange(null);
    onSurfaceViewChange(topoOn ? "map" : "topo");
  }

  // Always LTR so the flyout opens clear of the left stack and icon order stays stable in Arabic.
  return (
    <div
      className={`pointer-events-auto relative flex flex-col items-start gap-1.5 ${className}`}
      role="toolbar"
      aria-label="Map tools"
      dir="ltr"
    >
      <div className="overflow-hidden rounded-[2px] shadow-[0_1px_4px_rgba(0,0,0,0.28)]">
        <button type="button" className={`${btn} rounded-none border-b border-[#d5dbe0]`} onClick={onZoomIn} aria-label={labels.zoomIn} title={labels.zoomIn}>
          <IconPlus />
        </button>
        <button type="button" className={`${btn} rounded-none`} onClick={onZoomOut} aria-label={labels.zoomOut} title={labels.zoomOut}>
          <IconMinus />
        </button>
      </div>

      <div className="relative overflow-visible">
        <button
          type="button"
          className={`${btn} rounded-[2px] ${toolsOpen || editing ? btnActive : ""}`}
          onClick={toggleTools}
          aria-label={labels.tools}
          aria-expanded={toolsOpen}
          aria-controls={panelId}
          title={labels.tools}
        >
          <IconMeter />
        </button>

        {toolsOpen && (
          <div
            id={panelId}
            className="absolute left-[calc(100%+0.4rem)] top-0 z-40 flex items-center overflow-hidden rounded-[2px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.28)]"
          >
            <button
              type="button"
              className={`${flyBtn} border-e border-[#d5dbe0] ${editTool === "lines" ? btnActive : ""}`}
              onClick={() => pickTool("lines")}
              aria-label={labels.editLines}
              aria-pressed={editTool === "lines"}
              title={labels.editLines}
            >
              <IconLines />
            </button>
            <button
              type="button"
              className={`${flyBtn} border-e border-[#d5dbe0] ${editTool === "space" ? btnActive : ""}`}
              onClick={() => pickTool("space")}
              aria-label={labels.editSpace}
              aria-pressed={editTool === "space"}
              title={labels.editSpace}
            >
              <IconSpace />
            </button>
            <button
              type="button"
              className={flyBtn}
              onClick={closeTools}
              aria-label={labels.toolsClose}
              title={labels.toolsClose}
            >
              <IconClose />
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className={`${btn} rounded-[2px] ${topoOn ? btnActive : ""}`}
        onClick={toggleTopo}
        disabled={topoDisabled}
        aria-label={topoOn ? labels.topoMap : labels.topo}
        aria-pressed={topoOn}
        title={topoOn ? labels.topoMap : labels.topo}
      >
        <IconTopo />
      </button>

      <button
        type="button"
        className={`${btn} rounded-[2px]`}
        onClick={onLocate}
        disabled={locateDisabled || locating || topoOn}
        aria-label={locating ? labels.locating : labels.locate}
        title={locating ? labels.locating : labels.locate}
      >
        <IconLocate />
      </button>

      <button
        type="button"
        className={`${btn} rounded-[2px]`}
        onClick={onHome}
        disabled={topoOn}
        aria-label={labels.home}
        title={labels.home}
      >
        <IconHome />
      </button>

      <button
        type="button"
        className={`${btn} rounded-[2px]`}
        onClick={onToggleLayers}
        disabled={topoOn}
        aria-label={basemap === "satellite" ? labels.layersMap : labels.layersSatellite}
        title={basemap === "satellite" ? labels.layersMap : labels.layersSatellite}
      >
        <IconLayers satellite={basemap === "satellite"} />
      </button>

      <button
        type="button"
        className={`${btn} !h-11 !w-11 !rounded-full`}
        onClick={onCompass}
        disabled={topoOn}
        aria-label={labels.compass}
        title={labels.compass}
      >
        <IconCompass />
      </button>
    </div>
  );
}

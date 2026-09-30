"use client";

import type { MeasureMode, MeasureSnapshot } from "@/lib/measureDraw";
import { MEASURE_LINE_COLORS } from "@/lib/measureDraw";
import { formatDlsArea, formatMeters } from "@/lib/mapCoords";

export type MeasureToolbarLabels = {
  measureEnter: string;
  measureExit: string;
  measureLabel: string;
  measureDistance: string;
  measureArea: string;
  measureTotal: string;
  measureClear: string;
  measureFinish: string;
  measureUndo: string;
  measureSnapOn: string;
  measureEdgeSnap: string;
  measureLineColor: string;
  measureHintDistance: string;
  measureHintArea: string;
  dimensionsArea: string;
};

type Props = {
  mode: MeasureMode;
  snap: MeasureSnapshot | null;
  hasParcelSnap: boolean;
  edgeSnap: boolean;
  onEdgeSnapChange: (v: boolean) => void;
  lineColor: string;
  onLineColorChange: (hex: string) => void;
  lang: "ar" | "en";
  labels: MeasureToolbarLabels;
  /** Dark gold-on-green chrome (fullscreen) vs light (inline map). */
  variant?: "light" | "dark";
  onEnter: () => void;
  onExit: () => void;
  onModeChange: (m: Exclude<MeasureMode, "off">) => void;
  onUndo: () => void;
  onClear: () => void;
  onFinish: () => void;
};

function IconRuler({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.5 16.5 16.5 3.5a2.1 2.1 0 0 1 3 3L6.5 19.5a2.1 2.1 0 0 1-3-3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="m7 13 1.2 1.2M10 10l1.2 1.2M13 7l1.2 1.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPolygon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4h7l5 6-3 9H6L4 10 7 4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="4" r="1.4" fill="currentColor" />
      <circle cx="14" cy="4" r="1.4" fill="currentColor" />
      <circle cx="19" cy="10" r="1.4" fill="currentColor" />
      <circle cx="16" cy="19" r="1.4" fill="currentColor" />
      <circle cx="6" cy="19" r="1.4" fill="currentColor" />
      <circle cx="4" cy="10" r="1.4" fill="currentColor" />
    </svg>
  );
}

function IconUndo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 7 5 11l4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 11h9a5 5 0 0 1 0 10h-3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTrash({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M7 7l1 12h8l1-12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 12 5 5 9-10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClose({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconMagnet({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3v8a5 5 0 0 0 10 0V3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path d="M7 3h3v5H7V3Zm7 0h3v5h-3V3Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Architecture measure chrome — enter/exit + tool strip.
 * Touch targets ≥44px; wraps cleanly on narrow screens.
 */
export function MeasureToolbar({
  mode,
  snap,
  hasParcelSnap,
  edgeSnap,
  onEdgeSnapChange,
  lineColor,
  onLineColorChange,
  lang,
  labels: lp,
  variant = "light",
  onEnter,
  onExit,
  onModeChange,
  onUndo,
  onClear,
  onFinish,
}: Props) {
  const dark = variant === "dark";
  const measuring = mode !== "off";

  const shell = dark
    ? "rounded-xl border border-gold/40 bg-[#0f342f] text-gold"
    : "rounded-xl border border-line bg-surface-2/95 text-ink shadow-sm";
  const btnIdle = dark
    ? "border-gold/35 bg-[#0a1f1c] text-gold/85 hover:text-gold"
    : "border-line bg-white text-ink-soft hover:text-ink";
  const btnActive = "bg-green text-white border-green";
  const btnAccent = dark
    ? "border-gold bg-gold/15 text-gold"
    : "border-green bg-green/10 text-green";
  const btnExit = dark
    ? "border-gold bg-gold text-[#0a1f1c]"
    : "border-green bg-green text-white";
  const hintCls = dark ? "text-gold/80" : "text-ink-soft";
  const panelCls = dark
    ? "rounded-xl border border-gold/35 bg-[#0f342f] text-gold-2"
    : "rounded-xl border border-line bg-surface-2/80 text-ink";
  const muted = dark ? "text-gold/70" : "text-ink-soft";
  const title = dark ? "text-gold" : "text-green";

  if (!measuring) {
    return (
      <button
        type="button"
        onClick={onEnter}
        className={`inline-flex items-center gap-2 min-h-11 px-3.5 rounded-full border text-[12px] font-bold transition-colors ${btnIdle} ${dark ? "" : ""}`}
        aria-label={lp.measureEnter}
      >
        <IconRuler className="w-[18px] h-[18px] shrink-0" />
        <span>{lp.measureEnter}</span>
      </button>
    );
  }

  const canFinish = mode === "area" && snap && snap.points.length >= 3 && !snap.closed;
  const canUndo = Boolean(snap && (snap.points.length > 0 || snap.closed));
  const totalLive =
    snap && snap.points.length > 0
      ? snap.lengthM + (snap.closed || snap.liveSegmentM == null ? 0 : snap.liveSegmentM)
      : snap?.liveSegmentM ?? null;

  return (
    <div className={`w-full space-y-2 ${shell} p-2`} role="toolbar" aria-label={lp.measureLabel}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-1.5 ${title}`}>
          <IconRuler className="w-4 h-4" />
          {lp.measureLabel}
        </span>
        {hasParcelSnap && (
          <>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${btnAccent}`}
              title={lp.measureSnapOn}
            >
              <IconMagnet />
              {lp.measureSnapOn}
            </span>
            <button
              type="button"
              onClick={() => onEdgeSnapChange(!edgeSnap)}
              className={`inline-flex items-center gap-1 min-h-9 px-2.5 rounded-full border text-[10px] font-bold transition-colors ${
                edgeSnap ? btnAccent : btnIdle
              }`}
              aria-pressed={edgeSnap}
              title={lp.measureEdgeSnap}
            >
              {lp.measureEdgeSnap}
            </button>
          </>
        )}
        {snap?.lastSnapped && (
          <span className={`text-[10px] font-bold ${title}`}>●</span>
        )}
        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onExit}
            className={`inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full border text-[12px] font-bold ${btnExit}`}
            aria-label={lp.measureExit}
          >
            <IconClose className="w-[18px] h-[18px]" />
            <span>{lp.measureExit}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-1.5">
        <button
          type="button"
          onClick={() => onModeChange("distance")}
          className={`inline-flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-[4.5rem] px-2.5 rounded-xl border text-[11px] font-bold transition-colors ${
            mode === "distance" ? btnActive : btnIdle
          }`}
          aria-pressed={mode === "distance"}
        >
          <IconRuler className="w-[18px] h-[18px]" />
          {lp.measureDistance}
        </button>
        <button
          type="button"
          onClick={() => onModeChange("area")}
          className={`inline-flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-[4.5rem] px-2.5 rounded-xl border text-[11px] font-bold transition-colors ${
            mode === "area" ? btnActive : btnIdle
          }`}
          aria-pressed={mode === "area"}
        >
          <IconPolygon className="w-[18px] h-[18px]" />
          {lp.measureArea}
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={`inline-flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-[3.75rem] px-2 rounded-xl border text-[11px] font-bold disabled:opacity-40 ${btnIdle}`}
          aria-label={lp.measureUndo}
        >
          <IconUndo className="w-[18px] h-[18px]" />
          {lp.measureUndo}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!canUndo}
          className={`inline-flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-[3.75rem] px-2 rounded-xl border text-[11px] font-bold disabled:opacity-40 ${btnIdle}`}
          aria-label={lp.measureClear}
        >
          <IconTrash className="w-[18px] h-[18px]" />
          {lp.measureClear}
        </button>
        {canFinish && (
          <button
            type="button"
            onClick={onFinish}
            className={`inline-flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-[4.25rem] px-2.5 rounded-xl border text-[11px] font-bold ${btnAccent}`}
            aria-label={lp.measureFinish}
          >
            <IconCheck className="w-[18px] h-[18px]" />
            {lp.measureFinish}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`text-[10px] font-bold px-0.5 ${muted}`}>{lp.measureLineColor}</span>
        <div
          className="inline-flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label={lp.measureLineColor}
        >
          {MEASURE_LINE_COLORS.map((c) => {
            const selected = lineColor.toLowerCase() === c.hex.toLowerCase();
            const name = lang === "ar" ? c.labelAr : c.labelEn;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onLineColorChange(c.hex)}
                className={`relative h-9 w-9 rounded-full border-2 transition-transform ${
                  selected ? "scale-110 border-white shadow-[0_0_0_2px_rgba(15,52,47,.85)]" : "border-black/20 opacity-90 hover:opacity-100"
                }`}
                style={{ backgroundColor: c.hex }}
                aria-label={name}
                aria-pressed={selected}
                title={name}
              />
            );
          })}
        </div>
      </div>

      <p className={`text-[11px] leading-snug px-0.5 ${hintCls}`}>
        {mode === "distance" ? lp.measureHintDistance : lp.measureHintArea}
      </p>

      {snap && (snap.points.length > 0 || (snap.liveSegmentM != null && snap.liveSegmentM > 0)) && (
        <div className={`${panelCls} px-3 py-2`}>
          <ul className="space-y-0.5 text-[11px] leading-snug">
            {totalLive != null && totalLive > 0 && (
              <li>
                <span className={muted}>{lp.measureTotal}: </span>
                <b>{formatMeters(totalLive, lang)}</b>
                {snap.liveSegmentM != null && snap.liveSegmentM > 0 && !snap.closed && (
                  <span className={muted}>
                    {" "}
                    (+{formatMeters(snap.liveSegmentM, lang)})
                  </span>
                )}
              </li>
            )}
            {snap.areaSqm != null && snap.areaSqm > 0 && (
              <li>
                <span className={muted}>{lp.dimensionsArea}: </span>
                <b>{formatDlsArea(snap.areaSqm, lang)}</b>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";

import type { FixedSnapMeters, MeasureMode, MeasureSnapshot } from "@/lib/measureDraw";
import { MEASURE_LINE_COLORS } from "@/lib/measureDraw";

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
  measureNewLine: string;
  measureThreads: string;
  measureSnapOn: string;
  measureEdgeSnap: string;
  measureLineSnap: string;
  measureFixed1m: string;
  measureFixed5m: string;
  measureLineColor: string;
  measureHintDistance: string;
  measureHintArea: string;
  measureExportCad: string;
  measureExportCadHint: string;
  dimensionsArea: string;
};

type Props = {
  mode: MeasureMode;
  snap: MeasureSnapshot | null;
  hasParcelSnap: boolean;
  edgeSnap: boolean;
  onEdgeSnapChange: (v: boolean) => void;
  lineSnap: boolean;
  onLineSnapChange: (v: boolean) => void;
  fixedSnapM: FixedSnapMeters;
  onFixedSnapMChange: (v: FixedSnapMeters) => void;
  lineColor: string;
  onLineColorChange: (hex: string) => void;
  lang: "ar" | "en";
  labels: MeasureToolbarLabels;
  variant?: "light" | "dark";
  onEnter: () => void;
  onModeChange: (m: Exclude<MeasureMode, "off">) => void;
  onUndo: () => void;
  onClear: () => void;
  onFinish: () => void;
  onNewLine: () => void;
  /** Download AutoCAD DXF (parcel + dims + measure lines). */
  onExportCad?: () => void;
  canExportCad?: boolean;
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

function IconPlus({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconCad({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6.5h16v11H4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M4 9h3v6H4M17 9h3v6h-3" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Architecture measure chrome — multi-thread distance/area with per-line colors.
 */
export function MeasureToolbar({
  mode,
  snap,
  hasParcelSnap,
  edgeSnap,
  onEdgeSnapChange,
  lineSnap,
  onLineSnapChange,
  fixedSnapM,
  onFixedSnapMChange,
  lineColor,
  onLineColorChange,
  lang,
  labels: lp,
  variant = "light",
  onEnter,
  onModeChange,
  onUndo,
  onClear,
  onFinish,
  onNewLine,
  onExportCad,
  canExportCad = false,
}: Props) {
  const dark = variant === "dark";
  const measuring = mode !== "off";

  const shell = dark
    ? "rounded-xl border border-gold/40 bg-[#0f342f] text-gold"
    : "rounded-xl border border-line bg-surface-2/95 text-ink shadow-sm";
  const btnIdle = dark
    ? "border-gold/35 bg-[#0a1f1c] text-gold/70 hover:text-gold"
    : "border-line bg-white text-ink-soft hover:text-ink";
  const btnActive = dark
    ? "bg-gold text-[#0a1f1c] border-gold ring-2 ring-white/90 ring-offset-2 ring-offset-[#0f342f] shadow-md scale-[1.03]"
    : "bg-green text-white border-green ring-2 ring-green/40 ring-offset-2 ring-offset-white shadow-md scale-[1.03]";
  const btnAccent = dark
    ? "border-gold bg-gold/15 text-gold"
    : "border-green bg-green/10 text-green";
  const btnSelectedToggle = dark
    ? "bg-gold text-[#0a1f1c] border-gold ring-2 ring-white/80 ring-offset-1 ring-offset-[#0f342f]"
    : "bg-green text-white border-green ring-2 ring-green/35 ring-offset-1 ring-offset-white";
  const hintCls = dark ? "text-gold/80" : "text-ink-soft";
  const muted = dark ? "text-gold/70" : "text-ink-soft";
  const title = dark ? "text-gold" : "text-green";

  if (!measuring) {
    return (
      <button
        type="button"
        onClick={onEnter}
        className={`inline-flex items-center gap-2 min-h-11 px-3.5 rounded-full border text-[12px] font-bold transition-colors ${btnIdle}`}
        aria-label={lp.measureEnter}
      >
        <IconRuler className="w-[18px] h-[18px] shrink-0" />
        <span>{lp.measureEnter}</span>
      </button>
    );
  }

  const canFinish =
    Boolean(snap) &&
    !snap!.closed &&
    ((mode === "area" && snap!.points.length >= 3) ||
      (mode === "distance" && snap!.points.length >= 2));
  const canUndo = Boolean(
    snap && (snap.points.length > 0 || snap.closed || snap.threads.length > 0)
  );
  const canClear = canUndo;

  return (
    <div className={`w-full space-y-2 ${shell} p-2`} role="toolbar" aria-label={lp.measureLabel}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-1.5 ${title}`}>
          <IconRuler className="w-4 h-4" />
          {lp.measureLabel}
        </span>
        <div className="flex flex-wrap items-center gap-1.5 w-full">
          {hasParcelSnap && (
            <button
              type="button"
              onClick={() => onEdgeSnapChange(!edgeSnap)}
              className={`inline-flex items-center gap-1 min-h-9 px-2.5 rounded-full border text-[10px] font-bold transition-all ${
                edgeSnap ? btnSelectedToggle : btnIdle
              }`}
              aria-pressed={edgeSnap}
              title={lp.measureEdgeSnap}
            >
              {lp.measureEdgeSnap}
            </button>
          )}
          <button
            type="button"
            onClick={() => onLineSnapChange(!lineSnap)}
            className={`inline-flex items-center gap-1 min-h-9 px-2.5 rounded-full border text-[10px] font-bold transition-all ${
              lineSnap ? btnSelectedToggle : btnIdle
            }`}
            aria-pressed={lineSnap}
            title={lp.measureLineSnap}
          >
            {lp.measureLineSnap}
          </button>
          <button
            type="button"
            onClick={() => onFixedSnapMChange(fixedSnapM === 1 ? 0 : 1)}
            className={`inline-flex items-center gap-1 min-h-9 px-2.5 rounded-full border text-[10px] font-bold transition-all ${
              fixedSnapM === 1 ? btnSelectedToggle : btnIdle
            }`}
            aria-pressed={fixedSnapM === 1}
            title={lp.measureFixed1m}
          >
            {lp.measureFixed1m}
          </button>
          <button
            type="button"
            onClick={() => onFixedSnapMChange(fixedSnapM === 5 ? 0 : 5)}
            className={`inline-flex items-center gap-1 min-h-9 px-2.5 rounded-full border text-[10px] font-bold transition-all ${
              fixedSnapM === 5 ? btnSelectedToggle : btnIdle
            }`}
            aria-pressed={fixedSnapM === 5}
            title={lp.measureFixed5m}
          >
            {lp.measureFixed5m}
          </button>
          {snap?.lastSnapped && <span className={`text-[10px] font-bold ${title}`}>●</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-1.5">
        <button
          type="button"
          onClick={() => onModeChange("distance")}
          className={`inline-flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-[4.5rem] px-2.5 rounded-xl border text-[11px] font-bold transition-all ${
            mode === "distance" ? btnActive : btnIdle
          }`}
          aria-pressed={mode === "distance"}
        >
          <IconRuler className="w-[18px] h-[18px]" />
          {lp.measureDistance}
          {mode === "distance" && (
            <span className="text-[9px] font-extrabold tracking-wide opacity-90">●</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onModeChange("area")}
          className={`inline-flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-[4.5rem] px-2.5 rounded-xl border text-[11px] font-bold transition-all ${
            mode === "area" ? btnActive : btnIdle
          }`}
          aria-pressed={mode === "area"}
        >
          <IconPolygon className="w-[18px] h-[18px]" />
          {lp.measureArea}
          {mode === "area" && (
            <span className="text-[9px] font-extrabold tracking-wide opacity-90">●</span>
          )}
        </button>
        <button
          type="button"
          onClick={onNewLine}
          className={`inline-flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-[4.25rem] px-2 rounded-xl border text-[11px] font-bold ${btnAccent}`}
          aria-label={lp.measureNewLine}
          title={lp.measureNewLine}
        >
          <IconPlus className="w-[18px] h-[18px]" />
          {lp.measureNewLine}
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
          disabled={!canClear}
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
                  selected
                    ? "scale-110 border-white shadow-[0_0_0_3px_rgba(15,52,47,.9)]"
                    : "border-black/20 opacity-75 hover:opacity-100"
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

      {onExportCad && (
        <div className="flex flex-col gap-1 pt-0.5">
          <button
            type="button"
            onClick={onExportCad}
            disabled={!canExportCad}
            className={`inline-flex items-center justify-center gap-2 min-h-11 w-full px-3 rounded-xl border text-[12px] font-bold transition-all disabled:opacity-40 ${btnAccent}`}
            aria-label={lp.measureExportCad}
            title={lp.measureExportCadHint}
          >
            <IconCad className="w-[18px] h-[18px] shrink-0" />
            <span>{lp.measureExportCad}</span>
          </button>
          <p className={`text-[10px] leading-snug px-0.5 ${muted}`}>{lp.measureExportCadHint}</p>
        </div>
      )}
    </div>
  );
}

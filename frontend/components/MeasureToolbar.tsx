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
  onExportCad?: () => void;
  canExportCad?: boolean;
  compact?: boolean;
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
  compact = false,
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
  const shellPad = compact ? "p-1.5" : "p-2";
  const shellGap = compact ? "space-y-1.5" : "space-y-2";
  const rowGap = compact ? "gap-1" : "gap-1.5";
  const chipSize = compact ? "min-h-8 px-2 text-[9px]" : "min-h-9 px-2.5 text-[10px]";
  const actionSize = compact ? "min-h-10 min-w-[3.7rem] px-1.5 text-[10px]" : "min-h-11 min-w-[4.5rem] px-2.5 text-[11px]";
  const iconSize = compact ? "w-4 h-4" : "w-[18px] h-[18px]";
  const colorDotSize = compact ? "h-8 w-8" : "h-9 w-9";
  const hintText = compact ? "text-[10px]" : "text-[11px]";

  if (!measuring) {
    return (
      <button
        type="button"
        onClick={onEnter}
        className={`inline-flex items-center gap-1.5 border font-bold transition-colors ${
          compact
            ? "h-7 px-2.5 rounded-md text-[10px] sm:h-8 sm:px-3 sm:text-[11px]"
            : "min-h-11 px-3.5 rounded-md text-[12px]"
        } ${btnIdle}`}
        aria-label={lp.measureEnter}
      >
        <IconRuler className={`${compact ? "w-3.5 h-3.5" : "w-[18px] h-[18px]"} shrink-0`} />
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

  if (compact) {
    return (
      <div
        className={`w-full overflow-x-auto ${shell} p-1.5`}
        role="toolbar"
        aria-label={lp.measureLabel}
      >
        <div className="inline-flex min-w-max items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1 ${title}`}>
            <IconRuler className="w-4 h-4" />
            {lp.measureLabel}
          </span>

          {hasParcelSnap && (
            <button
              type="button"
              onClick={() => onEdgeSnapChange(!edgeSnap)}
              className={`inline-flex items-center gap-1 h-8 px-2 rounded-full border text-[9px] font-bold transition-all ${
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
            className={`inline-flex items-center gap-1 h-8 px-2 rounded-full border text-[9px] font-bold transition-all ${
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
            className={`inline-flex items-center gap-1 h-8 px-2 rounded-full border text-[9px] font-bold transition-all ${
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
            className={`inline-flex items-center gap-1 h-8 px-2 rounded-full border text-[9px] font-bold transition-all ${
              fixedSnapM === 5 ? btnSelectedToggle : btnIdle
            }`}
            aria-pressed={fixedSnapM === 5}
            title={lp.measureFixed5m}
          >
            {lp.measureFixed5m}
          </button>

          <button
            type="button"
            onClick={() => onModeChange("distance")}
            className={`inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border text-[10px] font-bold transition-all ${
              mode === "distance" ? btnActive : btnIdle
            }`}
            aria-pressed={mode === "distance"}
            title={lp.measureDistance}
          >
            <IconRuler className="w-4 h-4" />
            {lp.measureDistance}
          </button>
          <button
            type="button"
            onClick={() => onModeChange("area")}
            className={`inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border text-[10px] font-bold transition-all ${
              mode === "area" ? btnActive : btnIdle
            }`}
            aria-pressed={mode === "area"}
            title={lp.measureArea}
          >
            <IconPolygon className="w-4 h-4" />
            {lp.measureArea}
          </button>
          <button
            type="button"
            onClick={onNewLine}
            className={`inline-flex items-center gap-1 h-9 px-2 rounded-lg border text-[10px] font-bold ${btnAccent}`}
            aria-label={lp.measureNewLine}
            title={lp.measureNewLine}
          >
            <IconPlus className="w-4 h-4" />
            {lp.measureNewLine}
          </button>
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={`inline-flex items-center gap-1 h-9 px-2 rounded-lg border text-[10px] font-bold disabled:opacity-40 ${btnIdle}`}
            aria-label={lp.measureUndo}
            title={lp.measureUndo}
          >
            <IconUndo className="w-4 h-4" />
            {lp.measureUndo}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!canClear}
            className={`inline-flex items-center gap-1 h-9 px-2 rounded-lg border text-[10px] font-bold disabled:opacity-40 ${btnIdle}`}
            aria-label={lp.measureClear}
            title={lp.measureClear}
          >
            <IconTrash className="w-4 h-4" />
            {lp.measureClear}
          </button>
          {canFinish && (
            <button
              type="button"
              onClick={onFinish}
              className={`inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border text-[10px] font-bold ${btnAccent}`}
              aria-label={lp.measureFinish}
              title={lp.measureFinish}
            >
              <IconCheck className="w-4 h-4" />
              {lp.measureFinish}
            </button>
          )}
          {onExportCad && (
            <button
              type="button"
              onClick={onExportCad}
              disabled={!canExportCad}
              className={`inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border text-[10px] font-bold disabled:opacity-40 ${
                dark ? "border-gold/40 bg-[#0a1f1c] text-gold/85" : "border-line bg-white text-ink-soft"
              }`}
              aria-label={lp.measureExportCad}
              title={canExportCad ? lp.measureExportCad : lp.measureExportCadHint}
            >
              <span className="text-[9px] font-black tracking-wide">DXF</span>
              {lp.measureExportCad}
            </button>
          )}

          <span className={`text-[9px] font-bold px-0.5 ${muted}`}>{lp.measureLineColor}</span>
          <div className="inline-flex items-center gap-1" role="group" aria-label={lp.measureLineColor}>
            {MEASURE_LINE_COLORS.map((c) => {
              const selected = lineColor.toLowerCase() === c.hex.toLowerCase();
              const name = lang === "ar" ? c.labelAr : c.labelEn;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onLineColorChange(c.hex)}
                  className={`relative h-7 w-7 rounded-full border-2 transition-transform ${
                    selected
                      ? "scale-110 border-white shadow-[0_0_0_2px_rgba(15,52,47,.9)]"
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
      </div>
    );
  }

  return (
    <div className={`w-full ${shellGap} ${shell} ${shellPad}`} role="toolbar" aria-label={lp.measureLabel}>
      <div className={`flex flex-wrap items-center ${rowGap}`}>
        <span className={`inline-flex items-center gap-1.5 ${compact ? "text-[10px]" : "text-[11px]"} font-bold px-1.5 ${title}`}>
          <IconRuler className="w-4 h-4" />
          {lp.measureLabel}
        </span>
        <div className={`flex flex-wrap items-center ${rowGap} w-full`}>
          {hasParcelSnap && (
            <button
              type="button"
              onClick={() => onEdgeSnapChange(!edgeSnap)}
              className={`inline-flex items-center gap-1 rounded-full border font-bold transition-all ${chipSize} ${
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
            className={`inline-flex items-center gap-1 rounded-full border font-bold transition-all ${chipSize} ${
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
            className={`inline-flex items-center gap-1 rounded-full border font-bold transition-all ${chipSize} ${
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
            className={`inline-flex items-center gap-1 rounded-full border font-bold transition-all ${chipSize} ${
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

      <div className={`flex flex-wrap items-stretch ${rowGap}`}>
        <button
          type="button"
          onClick={() => onModeChange("distance")}
          className={`inline-flex flex-col items-center justify-center gap-0.5 rounded-xl border font-bold transition-all ${actionSize} ${
            mode === "distance" ? btnActive : btnIdle
          }`}
          aria-pressed={mode === "distance"}
        >
          <IconRuler className={iconSize} />
          {lp.measureDistance}
          {mode === "distance" && (
            <span className="text-[9px] font-extrabold tracking-wide opacity-90">●</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onModeChange("area")}
          className={`inline-flex flex-col items-center justify-center gap-0.5 rounded-xl border font-bold transition-all ${actionSize} ${
            mode === "area" ? btnActive : btnIdle
          }`}
          aria-pressed={mode === "area"}
        >
          <IconPolygon className={iconSize} />
          {lp.measureArea}
          {mode === "area" && (
            <span className="text-[9px] font-extrabold tracking-wide opacity-90">●</span>
          )}
        </button>
        <button
          type="button"
          onClick={onNewLine}
          className={`inline-flex flex-col items-center justify-center gap-0.5 min-h-10 min-w-[3.5rem] px-1.5 rounded-xl border ${compact ? "text-[10px]" : "text-[11px]"} font-bold ${btnAccent}`}
          aria-label={lp.measureNewLine}
          title={lp.measureNewLine}
        >
          <IconPlus className={iconSize} />
          {lp.measureNewLine}
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={`inline-flex flex-col items-center justify-center gap-0.5 min-h-10 min-w-[3.25rem] px-1.5 rounded-xl border ${compact ? "text-[10px]" : "text-[11px]"} font-bold disabled:opacity-40 ${btnIdle}`}
          aria-label={lp.measureUndo}
        >
          <IconUndo className={iconSize} />
          {lp.measureUndo}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!canClear}
          className={`inline-flex flex-col items-center justify-center gap-0.5 min-h-10 min-w-[3.25rem] px-1.5 rounded-xl border ${compact ? "text-[10px]" : "text-[11px]"} font-bold disabled:opacity-40 ${btnIdle}`}
          aria-label={lp.measureClear}
        >
          <IconTrash className={iconSize} />
          {lp.measureClear}
        </button>
        {canFinish && (
          <button
            type="button"
            onClick={onFinish}
            className={`inline-flex flex-col items-center justify-center gap-0.5 min-h-10 min-w-[3.6rem] px-1.5 rounded-xl border ${compact ? "text-[10px]" : "text-[11px]"} font-bold ${btnAccent}`}
            aria-label={lp.measureFinish}
          >
            <IconCheck className={iconSize} />
            {lp.measureFinish}
          </button>
        )}
        {onExportCad && (
          <button
            type="button"
            onClick={onExportCad}
            disabled={!canExportCad}
            className={`inline-flex flex-col items-center justify-center gap-0.5 min-h-10 min-w-[4rem] px-1.5 rounded-xl border ${compact ? "text-[10px]" : "text-[11px]"} font-bold disabled:opacity-40 ${
              dark ? "border-gold/40 bg-[#0a1f1c] text-gold/85" : "border-line bg-white text-ink-soft"
            }`}
            aria-label={lp.measureExportCad}
            title={canExportCad ? lp.measureExportCad : lp.measureExportCadHint}
          >
            <span className="text-[10px] font-black tracking-wide">DXF</span>
            {lp.measureExportCad}
          </button>
        )}
      </div>

      <div className={`flex flex-wrap items-center ${rowGap}`}>
        <span className={`${compact ? "text-[9px]" : "text-[10px]"} font-bold px-0.5 ${muted}`}>{lp.measureLineColor}</span>
        <div
          className={`inline-flex flex-wrap items-center ${rowGap}`}
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
                className={`relative ${colorDotSize} rounded-full border-2 transition-transform ${
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

      <p className={`${hintText} leading-snug px-0.5 ${hintCls}`}>
        {mode === "distance" ? lp.measureHintDistance : lp.measureHintArea}
      </p>
    </div>
  );
}

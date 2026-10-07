"use client";

import type { MeasureSnapshot, MeasureThread } from "@/lib/measureDraw";
import { formatThreadSummary } from "@/lib/measureDraw";
import { formatDlsArea, formatMeters } from "@/lib/mapCoords";

export type MeasureOverlayLabels = {
  measureThreads: string;
  measureDistance: string;
  measureArea: string;
  measureTotal: string;
  measureClear: string;
  dimensionsArea: string;
};

type Props = {
  snap: MeasureSnapshot | null;
  lang: "ar" | "en";
  labels: MeasureOverlayLabels;
  /** Fullscreen dark map vs inline light map. */
  variant?: "light" | "dark";
  onRemoveThread?: (id: string) => void;
};

/**
 * Floating transparent measurements panel drawn over the map (does not steal toolbar space).
 */
export function MeasureThreadsOverlay({
  snap,
  lang,
  labels: lp,
  variant = "light",
  onRemoveThread,
}: Props) {
  const threads = snap?.threads ?? [];
  const showDraft =
    Boolean(snap) &&
    (snap!.points.length > 0 || (snap!.liveSegmentM != null && snap!.liveSegmentM > 0));
  if (threads.length === 0 && !showDraft) return null;

  const dark = variant === "dark";
  const shell = dark
    ? "border-white/20 bg-[#0a1f1c]/55 text-gold-2 shadow-[0_8px_28px_rgba(0,0,0,.35)] backdrop-blur-[6px]"
    : "border-white/35 bg-[#0f342f]/50 text-gold-2 shadow-[0_8px_28px_rgba(0,0,0,.28)] backdrop-blur-[6px]";
  const muted = "text-gold/75";
  const title = "text-gold";
  const removeBtn =
    "ms-auto shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-gold/80 hover:bg-white/10 hover:text-gold";

  const totalLive =
    snap && snap.points.length > 0
      ? snap.lengthM + (snap.closed || snap.liveSegmentM == null ? 0 : snap.liveSegmentM)
      : snap?.liveSegmentM ?? null;

  return (
    <div
      className={`map-measure-overlay pointer-events-none absolute z-20 max-h-[42%] max-w-[min(18rem,72%)] overflow-y-auto rounded-xl border px-2.5 py-2 ${shell}`}
      style={{
        top: "0.5rem",
        insetInlineStart: "0.5rem",
      }}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {threads.length > 0 && (
        <div className="pointer-events-auto">
          <p className={`text-[10px] font-bold tracking-wide mb-1 ${title}`}>
            {lp.measureThreads} ({threads.length})
          </p>
          <ul className="space-y-1">
            {threads.map((t: MeasureThread, i: number) => (
              <li key={t.id} className="flex items-center gap-1.5 text-[11px] leading-snug">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/35"
                  style={{ backgroundColor: t.color }}
                  aria-hidden
                />
                <span className={muted}>
                  {t.kind === "area" ? lp.measureArea : lp.measureDistance} {i + 1}:
                </span>
                <b className="min-w-0 truncate text-gold-2">{formatThreadSummary(t, lang)}</b>
                {onRemoveThread && (
                  <button
                    type="button"
                    onClick={() => onRemoveThread(t.id)}
                    className={removeBtn}
                    aria-label={lp.measureClear}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showDraft && snap && (
        <div className={`pointer-events-none ${threads.length > 0 ? "mt-2 border-t border-white/15 pt-1.5" : ""}`}>
          <ul className="space-y-0.5 text-[11px] leading-snug">
            {totalLive != null && totalLive > 0 && (
              <li>
                <span className={muted}>{lp.measureTotal}: </span>
                <b className="text-gold-2">{formatMeters(totalLive, lang)}</b>
                {snap.liveSegmentM != null && snap.liveSegmentM > 0 && !snap.closed && (
                  <span className={muted}> (+{formatMeters(snap.liveSegmentM, lang)})</span>
                )}
              </li>
            )}
            {snap.areaSqm != null && snap.areaSqm > 0 && (
              <li>
                <span className={muted}>{lp.dimensionsArea}: </span>
                <b className="text-gold-2">{formatDlsArea(snap.areaSqm, lang)}</b>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

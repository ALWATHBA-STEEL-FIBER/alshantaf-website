"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLanguage } from "@/lib/LanguageProvider";

export type ParcelMapTab = {
  id: string;
  label: string;
  /** Short label for the narrow desktop rail */
  railLabel?: string;
};

export type ParcelMapHeaderChrome = {
  fullscreenLabel: string;
  measureExitLabel: string;
  showExitMeasure: boolean;
  showBackToMap?: boolean;
  backToMapLabel?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  status?: ReactNode;
  tabs: ParcelMapTab[];
  /** Panel body per tab id */
  panels: Record<string, ReactNode>;
  /** Full-bleed map surface */
  map: ReactNode;
  /** Sticky actions under the active panel (submit / print) */
  footer?: ReactNode;
  defaultTab?: string;
};

type ChromeCtx = {
  setHeaderChrome: (chrome: ParcelMapHeaderChrome | null) => void;
  setHeaderHandlers: (handlers: {
    onFullscreen: () => void;
    onExitMeasure: () => void;
    onBackToMap: () => void;
  }) => void;
};

const WorkspaceChromeContext = createContext<ChromeCtx | null>(null);

/** Map children register fullscreen / exit-measure controls into the workspace header. */
export function useParcelMapHeaderActions() {
  return useContext(WorkspaceChromeContext);
}

/**
 * DLS maps.dls.gov.jo–inspired shell: map-first viewport, side search panel
 * (desktop) / closable bottom sheet with tabs (mobile) — Al Shantaf theme.
 */
export function ParcelMapWorkspace({
  title,
  subtitle,
  status,
  tabs,
  panels,
  map,
  footer,
  defaultTab,
}: Props) {
  const { lang } = useLanguage();
  const baseId = useId();
  const initial = defaultTab && tabs.some((t) => t.id === defaultTab) ? defaultTab : tabs[0]?.id;
  const [tab, setTab] = useState(initial || "search");
  /** Mobile: map-first; details sheet opens on demand. */
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [headerChrome, setHeaderChromeState] = useState<ParcelMapHeaderChrome | null>(null);
  const headerHandlersRef = useRef({
    onFullscreen: () => {},
    onExitMeasure: () => {},
    onBackToMap: () => {},
  });

  const setHeaderChrome = useCallback((chrome: ParcelMapHeaderChrome | null) => {
    setHeaderChromeState((prev) => {
      if (prev === chrome) return prev;
      if (
        prev &&
        chrome &&
        prev.fullscreenLabel === chrome.fullscreenLabel &&
        prev.measureExitLabel === chrome.measureExitLabel &&
        prev.showExitMeasure === chrome.showExitMeasure &&
        prev.showBackToMap === chrome.showBackToMap &&
        prev.backToMapLabel === chrome.backToMapLabel
      ) {
        return prev;
      }
      return chrome;
    });
  }, []);

  const setHeaderHandlers = useCallback(
    (handlers: {
      onFullscreen: () => void;
      onExitMeasure: () => void;
      onBackToMap: () => void;
    }) => {
      headerHandlersRef.current = handlers;
    },
    []
  );

  const chromeApi = useMemo(
    () => ({ setHeaderChrome, setHeaderHandlers }),
    [setHeaderChrome, setHeaderHandlers]
  );

  useEffect(() => {
    if (!tabs.some((t) => t.id === tab) && tabs[0]) setTab(tabs[0].id);
  }, [tabs, tab]);

  const activePanel = panels[tab] ?? null;
  const sheetOpenLabel = lang === "ar" ? "التفاصيل" : "Details";
  const sheetCloseLabel = lang === "ar" ? "إخفاء" : "Hide";
  const sheetPeek = tabs.map((t) => t.railLabel || t.label).join(" · ");

  return (
    <WorkspaceChromeContext.Provider value={chromeApi}>
      <section
        className="parcel-map-workspace relative flex h-[calc(100svh-var(--header-h))] max-h-[calc(100svh-var(--header-h))] w-full flex-col overflow-hidden bg-[#0a1f1c] text-white"
        aria-label={title}
      >
        {/* Compact brand strip — map chrome actions live here (not over the map) */}
        <header className="relative z-20 flex shrink-0 items-center gap-1.5 border-b border-white/10 bg-green px-2.5 py-1.5 sm:gap-3 sm:px-4 sm:py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-extrabold tracking-wide text-gold sm:text-sm">{title}</p>
            {subtitle ? (
              <p className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-white/65 sm:text-[11px]">{subtitle}</p>
            ) : null}
          </div>
          {headerChrome ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              {headerChrome.showBackToMap ? (
                <button
                  type="button"
                  onClick={() => headerHandlersRef.current.onBackToMap()}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-gold px-2 text-[10px] font-bold text-green shadow-sm hover:bg-gold-2 sm:h-8 sm:gap-1.5 sm:px-2.5 sm:text-[11px]"
                  aria-label={headerChrome.backToMapLabel || headerChrome.fullscreenLabel}
                >
                  {headerChrome.backToMapLabel || "Map"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => headerHandlersRef.current.onFullscreen()}
                className="inline-flex h-7 items-center justify-center rounded-md border border-white/20 bg-white/95 px-2 text-[10px] font-bold text-[#3a4650] shadow-sm hover:bg-white sm:h-8 sm:px-2.5 sm:text-[11px]"
              >
                {headerChrome.fullscreenLabel}
              </button>
              {headerChrome.showExitMeasure ? (
                <button
                  type="button"
                  onClick={() => headerHandlersRef.current.onExitMeasure()}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-gold px-2 text-[10px] font-bold text-green shadow-sm hover:bg-gold-2 sm:h-8 sm:gap-1.5 sm:px-2.5 sm:text-[11px]"
                  aria-label={headerChrome.measureExitLabel}
                >
                  {headerChrome.measureExitLabel}
                </button>
              ) : null}
            </div>
          ) : null}
          {status ? <div className="shrink-0 text-[10px] text-white/80 sm:text-[11px]">{status}</div> : null}
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Desktop side panel + icon rail (RTL: sits on the inline-start / right in Arabic) */}
          <aside className="relative z-20 hidden min-h-0 w-[min(26rem,38vw)] shrink-0 md:flex">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col border-e border-white/10 bg-green">
              <div className="flex shrink-0 gap-1 border-b border-white/10 p-2">
                {tabs.map((t) => {
                  const active = t.id === tab;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      id={`${baseId}-desk-${t.id}`}
                      aria-selected={active}
                      onClick={() => setTab(t.id)}
                      className={`h-9 flex-1 rounded-md px-2 text-[11px] font-bold transition-colors ${
                        active ? "bg-gold text-green" : "bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div className="parcel-panel-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 text-ink">
                <div className="rounded-md bg-[#f3efe6] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">{activePanel}</div>
              </div>
              {footer ? (
                <div className="parcel-panel-footer shrink-0 border-t border-white/10 bg-green-2/80 p-2.5">{footer}</div>
              ) : null}
            </div>
            <nav
              aria-label={title}
              className="flex w-12 shrink-0 flex-col items-center gap-1 bg-[#0a2824] py-2"
            >
              {tabs.map((t) => {
                const active = t.id === tab;
                return (
                  <button
                    key={`rail-${t.id}`}
                    type="button"
                    title={t.label}
                    aria-label={t.label}
                    aria-pressed={active}
                    onClick={() => setTab(t.id)}
                    className={`flex h-11 w-10 flex-col items-center justify-center rounded-md text-[9px] font-bold leading-tight transition-colors ${
                      active
                        ? "bg-gold/20 text-gold ring-1 ring-gold/50"
                        : "text-white/55 hover:bg-white/5 hover:text-white/90"
                    }`}
                  >
                    <span className="mb-0.5 h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                    {(t.railLabel || t.label).slice(0, 4)}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Map stage — clipped stacking context so map tools never cover the sheet */}
          <div className="relative z-10 min-h-0 flex-1 isolate overflow-hidden bg-[#071816]">
            <div className="absolute inset-0 overflow-hidden">{map}</div>
          </div>

          {/* Mobile: compact closable sheet — fixed height, one scroll surface */}
          <div
            className={`relative z-30 flex flex-col overflow-hidden border-t border-white/15 bg-green md:hidden ${
              sheetExpanded
                ? "h-[min(38svh,18rem)] max-h-[min(38svh,18rem)] shrink-0"
                : "h-9 max-h-9 shrink-0"
            }`}
          >
            <div className="flex h-9 w-full shrink-0 items-center gap-1 border-b border-white/10 px-1.5">
              {!sheetExpanded ? (
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 px-1 text-white/80"
                  aria-expanded={false}
                  onClick={() => setSheetExpanded(true)}
                >
                  <span className="mx-0.5 h-0.5 w-7 shrink-0 rounded-full bg-white/40" aria-hidden />
                  <span className="truncate text-[11px] font-bold tracking-wide">
                    {`${sheetOpenLabel} · ${sheetPeek}`}
                  </span>
                  <svg className="ms-auto h-3.5 w-3.5 shrink-0 text-gold" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <>
                  <div className="flex min-w-0 flex-1 gap-1">
                    {tabs.map((t) => {
                      const active = t.id === tab;
                      return (
                        <button
                          key={`mob-${t.id}`}
                          type="button"
                          id={`${baseId}-mob-${t.id}`}
                          aria-selected={active}
                          onClick={() => setTab(t.id)}
                          className={`h-7 min-w-0 flex-1 truncate rounded-md px-1.5 text-[10px] font-bold transition-colors ${
                            active ? "bg-gold text-green" : "bg-white/5 text-white/80 hover:bg-white/10"
                          }`}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSheetExpanded(false)}
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-white/20 bg-white/10 px-2 text-[10px] font-bold text-white/90 hover:bg-white/15"
                    aria-label={sheetCloseLabel}
                  >
                    <span>{sheetCloseLabel}</span>
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {sheetExpanded ? (
              <>
                <div className="parcel-panel-body min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-1.5 py-1.5 text-ink touch-pan-y">
                  <div className="rounded-md bg-[#f3efe6] p-2">{activePanel}</div>
                </div>
                {footer ? (
                  <div className="parcel-panel-footer shrink-0 border-t border-white/10 bg-green-2/90 px-1.5 py-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
                    {footer}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </section>
    </WorkspaceChromeContext.Provider>
  );
}

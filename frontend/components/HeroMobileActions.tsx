"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageProvider";
import { useJourney } from "@/lib/journey/JourneyProvider";
import { emptyJourney, type JourneyIntent } from "@/lib/journey/types";

type ActionKey = JourneyIntent | "list_asset";

/** Custom industrial marks — stroke only, no lucide defaults, no icon wells. */
function ActionIcon({ name, className }: { name: ActionKey; className?: string }) {
  const c = className ?? "h-8 w-8 shrink-0 text-gold transition-colors group-active:text-gold/80";
  switch (name) {
    case "find_land":
      return (
        <svg className={c} viewBox="0 0 32 32" fill="none" aria-hidden>
          <path d="M4 23 11.2 5.5h9.6L28 23H4Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
          <path d="M11.2 5.5V23M20.8 5.5V23M7.2 14.8h17.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".8" />
          <circle cx="16" cy="17.2" r="1.35" fill="currentColor" />
        </svg>
      );
    case "build_hangar":
      return (
        <svg className={c} viewBox="0 0 32 32" fill="none" aria-hidden>
          <path d="M2.5 16 16 4.5 29.5 16V27.5H2.5V16Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
          <path d="M2.5 16h27" stroke="currentColor" strokeWidth="1.2" />
          <path d="M12 27.5V18.2h8v9.3" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
          <path d="M7.5 20.5h2.8M21.7 20.5h2.8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
        </svg>
      );
    case "invest":
      return (
        <svg className={c} viewBox="0 0 32 32" fill="none" aria-hidden>
          <path d="M5 25V15M12 25V9.5M19 25v-9M26 25V7" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
          <path d="m5 18 7-6.2 6.5 4.4L26.5 7" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21.2 7H26.5v5.2" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "land_check":
      return (
        <svg className={c} viewBox="0 0 32 32" fill="none" aria-hidden>
          <path
            d="M16 4c-4.9 0-8.8 3.7-8.8 8.3 0 5.8 8.8 15.7 8.8 15.7s8.8-9.9 8.8-15.7C24.8 7.7 20.9 4 16 4Z"
            stroke="currentColor"
            strokeWidth="1.55"
            strokeLinejoin="round"
          />
          <path d="m12.2 12.1 2.6 2.6 5.1-5.2" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "list_asset":
      return (
        <svg className={c} viewBox="0 0 32 32" fill="none" aria-hidden>
          <path d="M6 5.5h14.5L26 12v14.5H6V5.5Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
          <path d="M20.5 5.5V12H26" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M16 16.2v7.2M12.4 19.8h7.2" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
        </svg>
      );
  }
}

const secondaryClass =
  "group relative flex min-h-[4.25rem] min-w-0 cursor-pointer flex-col items-center justify-center gap-1.5 px-1.5 py-2.5 text-center " +
  "transition-colors duration-200 active:bg-white/[0.08] hover:bg-white/[0.04] " +
  "focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold";

export function HeroMobileActions() {
  const { t } = useLanguage();
  const { patch, reset } = useJourney();
  const router = useRouter();
  const labels = t.hero.quickActions;

  function startIntent(intent: Exclude<JourneyIntent, "find_land">) {
    reset();
    if (intent === "land_check") {
      patch(emptyJourney({ intent: "land_check" }));
      router.push("/land-check");
      return;
    }
    if (intent === "build_hangar") {
      patch(emptyJourney({ intent: "build_hangar", investmentType: null }));
    } else {
      patch(emptyJourney({ intent: "invest" }));
    }
    router.push("/journey");
  }

  return (
    <nav
      aria-label={labels.title}
      className="md:hidden mx-auto mt-5 w-full max-w-[22.5rem] animate-hero-rise delay-3"
    >
      <p className="mb-1 text-center text-[13px] font-bold tracking-normal text-white">
        {labels.title}
      </p>
      <p className="mb-3 text-center text-[11px] leading-snug text-white/75">{labels.driveHint}</p>

      {/* Primary: check + list — first actions after landing */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => startIntent("land_check")}
          className="group flex min-h-[5.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-gold/45 bg-gold px-3 py-3.5 text-center shadow-[0_14px_28px_-16px_rgba(200,154,88,0.85)] transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <ActionIcon name="land_check" className="h-8 w-8 shrink-0 text-green" />
          <span className="text-[13px] font-extrabold leading-tight text-green">{labels.land_check}</span>
          <span className="text-[10px] font-semibold leading-snug text-green/75">{labels.land_checkHint}</span>
        </button>

        <Link
          href="/request-publish"
          className="group flex min-h-[5.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-white/35 bg-white px-3 py-3.5 text-center shadow-[0_14px_28px_-16px_rgba(0,0,0,0.45)] transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <ActionIcon name="list_asset" className="h-8 w-8 shrink-0 text-green" />
          <span className="text-[13px] font-extrabold leading-tight text-green">{labels.list_asset}</span>
          <span className="text-[10px] font-semibold leading-snug text-green/70">{labels.list_assetHint}</span>
        </Link>
      </div>

      {/* Secondary paths */}
      <div className="mt-2.5 overflow-hidden rounded-xl border border-white/[0.14] bg-black/35 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.7)]">
        <div className="grid grid-cols-3">
          <Link href="/offers" className={`${secondaryClass} border-e border-white/[0.1]`}>
            <ActionIcon name="find_land" className="h-6 w-6 shrink-0 text-gold" />
            <span className="text-[11px] font-semibold leading-tight text-balance text-white/95">
              {labels.find_land}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => startIntent("build_hangar")}
            className={`${secondaryClass} border-e border-white/[0.1]`}
          >
            <ActionIcon name="build_hangar" className="h-6 w-6 shrink-0 text-gold" />
            <span className="text-[11px] font-semibold leading-tight text-balance text-white/95">
              {labels.build_hangar}
            </span>
          </button>
          <button type="button" onClick={() => startIntent("invest")} className={secondaryClass}>
            <ActionIcon name="invest" className="h-6 w-6 shrink-0 text-gold" />
            <span className="text-[11px] font-semibold leading-tight text-balance text-white/95">
              {labels.invest}
            </span>
          </button>
        </div>
      </div>

      <p className="mt-2 text-center text-[10px] leading-snug text-white/50">{labels.eyebrow}</p>
    </nav>
  );
}

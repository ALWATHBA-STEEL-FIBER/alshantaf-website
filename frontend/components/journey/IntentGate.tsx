"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageProvider";
import { useJourney } from "@/lib/journey/JourneyProvider";
import { emptyJourney, type JourneyIntent } from "@/lib/journey/types";

const INTENTS: JourneyIntent[] = ["find_land", "build_hangar", "invest", "land_check"];

export function IntentGate() {
  const { t } = useLanguage();
  const { patch, reset } = useJourney();
  const router = useRouter();
  const copy = t.journey;

  function start(intent: JourneyIntent) {
    reset();
    if (intent === "land_check") {
      patch(emptyJourney({ intent: "land_check" }));
      router.push("/land-check");
      return;
    }
    if (intent === "build_hangar") {
      patch(emptyJourney({ intent: "build_hangar", investmentType: null }));
    } else if (intent === "invest") {
      patch(emptyJourney({ intent: "invest" }));
    } else {
      patch(emptyJourney({ intent: "find_land" }));
    }
    router.push("/journey");
  }

  return (
    <section id="what-do-you-want" className="py-16 md:py-20">
      <div className="mx-auto max-w-[1240px] px-4">
        <div className="max-w-2xl">
          <span className="text-gold text-xs font-bold tracking-wide">{copy.eyebrow}</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-2 text-balance">{copy.title}</h2>
          <p className="text-ink-soft mt-3 leading-relaxed">{copy.subtitle}</p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {INTENTS.map((key) => {
            const item = copy.intents[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => start(key)}
                className="group text-start rounded-3xl border border-line bg-white/85 p-6 md:p-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/45 hover:shadow-[0_24px_44px_-30px_rgba(15,52,47,0.45)]"
              >
                <span className="block w-10 h-[3px] rounded-full bg-gold mb-4" aria-hidden />
                <h3 className="text-lg md:text-xl font-bold leading-snug group-hover:text-green transition-colors">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-ink-soft leading-relaxed">{item.note}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-green">
                  {item.cta}
                  <span aria-hidden className="rtl:rotate-180">
                    →
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

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
    if (intent === "find_land") {
      router.push("/offers");
      return;
    }
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
    <section id="what-do-you-want" className="py-14 md:py-20">
      <div className="mx-auto max-w-[1240px] px-4">
        <div className="max-w-2xl">
          <span className="text-gold text-xs font-bold tracking-wide">{copy.eyebrow}</span>
          <h2 className="mt-2 text-balance text-3xl font-bold md:text-4xl">{copy.title}</h2>
          <p className="mt-3 leading-relaxed text-ink-soft">{copy.subtitle}</p>
        </div>

        <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2">
          {INTENTS.map((key) => {
            const item = copy.intents[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => start(key)}
                className="group cursor-pointer rounded-3xl border border-line bg-white/85 p-5 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/45 hover:shadow-[0_24px_44px_-30px_rgba(15,52,47,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold md:p-7"
              >
                <span className="mb-4 block h-[3px] w-10 rounded-full bg-gold" aria-hidden />
                <h3 className="text-lg font-bold leading-snug transition-colors group-hover:text-green md:text-xl">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.note}</p>
                <span className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-green">
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

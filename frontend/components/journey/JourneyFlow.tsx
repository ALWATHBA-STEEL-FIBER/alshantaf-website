"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageProvider";
import { useJourney } from "@/lib/journey/JourneyProvider";
import { matchListings } from "@/lib/journey/match";
import type { HangarGoal, InvestmentType } from "@/lib/journey/types";
import { AREA_GUIDE_SLUGS, AREA_OTHER_SLUGS, areaFilterBySlug, areaFilterLabel } from "@/lib/areaFilters";
import { INDUSTRIAL_ORDER } from "@/lib/regulations";
import { SETBACKS } from "@/lib/setbacks";
import { toWesternDigits } from "@/lib/arabicDigits";
import { localizePriceLabel, localizeSizeLabel } from "@/lib/localizePlace";
import type { IndustryType, Listing } from "@/lib/types";

const AREA_PRESETS = [500, 1000, 2000, 5000, 10000];
const BUDGET_PRESETS = [50_000, 100_000, 250_000, 500_000, 1_000_000];
const REGION_SLUGS = [...AREA_GUIDE_SLUGS, ...AREA_OTHER_SLUGS.slice(0, 4)];

export function JourneyFlow({ listings }: { listings: Listing[] }) {
  const { t, lang } = useLanguage();
  const { state, step, patch, hydrated } = useJourney();
  const router = useRouter();
  const copy = t.journey;
  const [customArea, setCustomArea] = useState("");
  const [customBudget, setCustomBudget] = useState("");

  useEffect(() => {
    if (!hydrated) return;
    if (!state.intent) {
      router.replace("/#what-do-you-want");
      return;
    }
    if (state.intent === "land_check" || step === "land_check") {
      router.replace("/land-check");
    }
  }, [hydrated, state.intent, step, router]);

  const match = useMemo(() => matchListings(listings, state), [listings, state]);

  if (!hydrated || !state.intent) {
    return <div className="py-24 text-center text-sm text-ink-soft">{copy.loading}</div>;
  }

  if (step === "land_check") {
    return <div className="py-24 text-center text-sm text-ink-soft">{copy.redirecting}</div>;
  }

  return (
    <section className="py-10 md:py-14">
      <div className="mx-auto max-w-[720px] px-4">
        <p className="text-gold text-xs font-bold tracking-wide">{copy.flowEyebrow}</p>
        <h1 className="text-2xl md:text-3xl font-bold mt-2">{copy.flowTitle}</h1>

        {step === "hangar_goal" && (
          <StepShell title={copy.questions.hangarGoal} hint={copy.oneAtATime}>
            <div className="grid gap-3">
              {(["own_industry", "invest_rent"] as HangarGoal[]).map((goal) => (
                <ChoiceButton
                  key={goal}
                  label={copy.hangarGoals[goal].title}
                  note={copy.hangarGoals[goal].note}
                  onClick={() => {
                    if (goal === "invest_rent") {
                      patch({ hangarGoal: goal, investmentType: "land_plus_hangar" });
                    } else {
                      patch({ hangarGoal: goal });
                    }
                  }}
                />
              ))}
            </div>
          </StepShell>
        )}

        {step === "investment_type" && (
          <StepShell title={copy.questions.investmentType} hint={copy.oneAtATime}>
            <div className="grid gap-3">
              {(["industrial_land", "ready_hangar", "land_plus_hangar"] as InvestmentType[]).map((key) => (
                <ChoiceButton
                  key={key}
                  label={copy.investmentTypes[key]}
                  onClick={() => patch({ investmentType: key })}
                />
              ))}
            </div>
          </StepShell>
        )}

        {step === "industry" && (
          <StepShell title={copy.questions.industry} hint={copy.oneAtATime}>
            <div className="grid gap-2 sm:grid-cols-2">
              {INDUSTRIAL_ORDER.map((key) => (
                <ChoiceButton
                  key={key}
                  label={t.regulations.types[key]?.title ?? key}
                  active={state.industryType === key}
                  onClick={() => patch({ industryType: key as IndustryType })}
                />
              ))}
            </div>
          </StepShell>
        )}

        {step === "area" && (
          <StepShell title={copy.questions.area} hint={copy.oneAtATime}>
            <div className="flex flex-wrap gap-2">
              {AREA_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => patch({ areaSqm: n })}
                  className={`h-11 px-4 rounded-full border text-sm font-bold ${
                    state.areaSqm === n ? "border-green bg-green text-white" : "border-line bg-white"
                  }`}
                >
                  {n.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO")} m²
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                dir="ltr"
                value={customArea}
                onChange={(e) => setCustomArea(toWesternDigits(e.target.value).replace(/[^\d]/g, ""))}
                placeholder={copy.customArea}
                className="min-w-0 flex-1 h-11 rounded-xl border border-line bg-white px-3 text-sm"
              />
              <button
                type="button"
                className="h-11 px-4 rounded-xl bg-green text-white text-sm font-bold"
                onClick={() => {
                  const n = Number(customArea);
                  if (n > 0) patch({ areaSqm: n });
                }}
              >
                {copy.continue}
              </button>
            </div>
          </StepShell>
        )}

        {step === "region" && (
          <StepShell title={copy.questions.region} hint={copy.oneAtATime}>
            <div className="grid gap-2 sm:grid-cols-2">
              {REGION_SLUGS.map((slug) => {
                const def = areaFilterBySlug(slug);
                if (!def) return null;
                return (
                  <ChoiceButton
                    key={slug}
                    label={areaFilterLabel(def, lang)}
                    active={state.regionSlug === slug}
                    onClick={() => patch({ regionSlug: slug })}
                  />
                );
              })}
              <ChoiceButton
                label={copy.anyRegion}
                active={state.regionSlug === "any"}
                onClick={() => patch({ regionSlug: "any" })}
              />
            </div>
          </StepShell>
        )}

        {step === "budget" && (
          <StepShell title={copy.questions.budget} hint={copy.oneAtATime}>
            <div className="flex flex-wrap gap-2">
              {BUDGET_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => patch({ budgetJod: n })}
                  className={`h-11 px-4 rounded-full border text-sm font-bold ${
                    state.budgetJod === n ? "border-green bg-green text-white" : "border-line bg-white"
                  }`}
                >
                  {n.toLocaleString(lang === "ar" ? "ar-JO" : "en-JO")} {copy.jod}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                dir="ltr"
                value={customBudget}
                onChange={(e) => setCustomBudget(toWesternDigits(e.target.value).replace(/[^\d]/g, ""))}
                placeholder={copy.customBudget}
                className="min-w-0 flex-1 h-11 rounded-xl border border-line bg-white px-3 text-sm"
              />
              <button
                type="button"
                className="h-11 px-4 rounded-xl bg-green text-white text-sm font-bold"
                onClick={() => {
                  const n = Number(customBudget);
                  if (n > 0) patch({ budgetJod: n });
                }}
              >
                {copy.continue}
              </button>
            </div>
          </StepShell>
        )}

        {step === "has_land" && (
          <StepShell title={copy.questions.hasLand} hint={copy.oneAtATime}>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceButton label={copy.yes} onClick={() => patch({ hasLand: true })} />
              <ChoiceButton label={copy.no} onClick={() => patch({ hasLand: false })} />
            </div>
          </StepShell>
        )}

        {step === "results" && (
          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-bold">{copy.resultsTitle}</h2>
            {match.budgetMismatch && (
              <div className="rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm leading-relaxed">
                <p className="font-bold text-ink">{copy.budgetMismatchTitle}</p>
                <p className="mt-1 text-ink-soft">{copy.budgetMismatchNote}</p>
              </div>
            )}
            {match.matches.length === 0 && <p className="text-sm text-ink-soft">{copy.noInventoryNote}</p>}
            {match.matches.map(({ listing, kind, noteKey }) => (
              <Link
                key={listing.id}
                href={`/offers/${listing.id}`}
                onClick={() => patch({ selectedListingId: listing.id })}
                className="block rounded-2xl border border-line bg-white p-4 hover:border-gold/50 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <b className="text-sm">{listing.title}</b>
                    <p className="text-xs text-ink-soft mt-1">
                      {listing.area}
                      {listing.size ? ` · ${localizeSizeLabel(listing.size, lang)}` : ""}
                      {listing.price ? ` · ${localizePriceLabel(listing.price, lang)}` : ""}
                    </p>
                  </div>
                  {kind === "budget_alt" && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gold/15 text-[#6b4d1f]">
                      {copy.altBadge}
                    </span>
                  )}
                  {kind === "near" && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-surface-2 text-ink-soft">
                      {copy.nearBadge}
                    </span>
                  )}
                </div>
                {noteKey && <p className="mt-2 text-[11px] text-ink-soft">{copy.matchNotes[noteKey]}</p>}
                {state.intent === "build_hangar" && state.hasLand === false && (
                  <p className="mt-2 text-xs font-bold text-green">{copy.buildHangarOnThis}</p>
                )}
              </Link>
            ))}
            <div className="pt-4 flex flex-wrap gap-3">
              <Link href="/contact" className="h-11 px-5 rounded-full bg-green text-white text-sm font-bold flex items-center">
                {copy.advisorCta}
              </Link>
              <Link href="/offers" className="h-11 px-5 rounded-full border border-line text-sm font-bold flex items-center">
                {copy.browseAll}
              </Link>
            </div>
          </div>
        )}

        {step === "hangar_specs" && state.industryType && (
          <HangarSpecs industryType={state.industryType} areaSqm={state.areaSqm} />
        )}
      </div>
    </section>
  );
}

function ChoiceButton({
  label,
  note,
  onClick,
  active,
}: {
  label: string;
  note?: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-start rounded-2xl border px-4 py-3.5 transition-colors ${
        active ? "border-green bg-green/10 text-green" : "border-line bg-white hover:border-gold/50"
      }`}
    >
      <span className="font-bold text-sm block">{label}</span>
      {note && <span className="text-xs text-ink-soft mt-1 block leading-relaxed">{note}</span>}
    </button>
  );
}

function StepShell({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="text-lg md:text-xl font-bold">{title}</h2>
      <p className="text-xs text-ink-soft mt-1.5">{hint}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function HangarSpecs({ industryType, areaSqm }: { industryType: IndustryType; areaSqm: number | null }) {
  const { t } = useLanguage();
  const copy = t.journey;
  const info = SETBACKS[industryType];
  const title = t.regulations.types[industryType]?.title ?? industryType;

  return (
    <div className="mt-8 rounded-3xl border border-line bg-white p-6 space-y-4">
      <h2 className="text-xl font-bold">{copy.hangarSpecsTitle}</h2>
      <p className="text-sm text-ink-soft leading-relaxed">{copy.hangarSpecsNote}</p>
      <p className="text-sm">
        <b>{copy.questions.industry}:</b> {title}
        {areaSqm ? (
          <>
            {" · "}
            <b>{copy.questions.area}:</b> {areaSqm.toLocaleString()} m²
          </>
        ) : null}
      </p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-[10px] text-ink-soft">{copy.specs.frontal}</dt>
          <dd className="font-bold mt-0.5">{info.frontal} m</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-[10px] text-ink-soft">{copy.specs.side}</dt>
          <dd className="font-bold mt-0.5">{info.side} m</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-[10px] text-ink-soft">{copy.specs.rear}</dt>
          <dd className="font-bold mt-0.5">{info.rear} m</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-[10px] text-ink-soft">{copy.specs.build}</dt>
          <dd className="font-bold mt-0.5">{info.buildPercentage}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-3 col-span-2">
          <dt className="text-[10px] text-ink-soft">{copy.specs.height}</dt>
          <dd className="font-bold mt-0.5">{info.height} m</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-3 pt-2">
        <Link href="/land-check" className="h-11 px-5 rounded-full border border-line text-sm font-bold flex items-center">
          {copy.backToLandCheck}
        </Link>
        <Link href="/contact" className="h-11 px-5 rounded-full bg-green text-white text-sm font-bold flex items-center">
          {copy.advisorCta}
        </Link>
      </div>
    </div>
  );
}

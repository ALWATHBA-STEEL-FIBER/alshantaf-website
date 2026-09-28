import type { JourneyState, JourneyStepId } from "./types";

/**
 * Computes the remaining step queue for the current journey.
 * Only unanswered / unfinished steps are returned — answered fields are skipped.
 */
export function remainingSteps(state: JourneyState): JourneyStepId[] {
  if (!state.intent) return ["intent"];

  if (state.intent === "land_check") {
    return ["land_check"];
  }

  // Hangar → invest/rent reuses invest logic (no duplicate questionnaire).
  const effectiveIntent =
    state.intent === "build_hangar" && state.hangarGoal === "invest_rent" ? "invest" : state.intent;

  if (state.intent === "build_hangar" && !state.hangarGoal) {
    return ["hangar_goal"];
  }

  const steps: JourneyStepId[] = [];

  if (effectiveIntent === "invest") {
    if (!state.investmentType && !(state.intent === "build_hangar" && state.hangarGoal === "invest_rent")) {
      steps.push("investment_type");
    }
    // Building hangar for rent implies land + hangar investment type.
    if (!state.budgetJod) steps.push("budget");
    if (!state.regionSlug) steps.push("region");
    if (!state.areaSqm) steps.push("area");
    steps.push("results");
    return steps;
  }

  if (effectiveIntent === "find_land") {
    if (!state.industryType) steps.push("industry");
    if (!state.areaSqm) steps.push("area");
    if (!state.regionSlug) steps.push("region");
    steps.push("results");
    return steps;
  }

  // build_hangar + own_industry
  if (!state.industryType) steps.push("industry");
  if (!state.areaSqm) steps.push("area");
  if (state.hasLand === null) steps.push("has_land");

  if (state.hasLand === true) {
    if (!state.landCheckDone) steps.push("land_check");
    steps.push("hangar_specs");
    return steps;
  }

  if (state.hasLand === false) {
    if (!state.regionSlug) steps.push("region");
    steps.push("results");
    return steps;
  }

  return steps;
}

export function currentStep(state: JourneyState): JourneyStepId {
  return remainingSteps(state)[0] ?? "results";
}

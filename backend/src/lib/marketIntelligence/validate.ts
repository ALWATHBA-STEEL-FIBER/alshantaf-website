/** Fail-safe validation before inserting market observations. */

export type ObservationInput = {
  metricKey: string;
  value: number;
  unit: string;
  currency?: string | null;
  periodEnd: string; // YYYY-MM-DD
  sourceUrl: string;
  isEstimate?: boolean;
};

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateObservation(input: ObservationInput): ValidationResult {
  if (!Number.isFinite(input.value)) return { ok: false, reason: "non_finite_value" };
  if (input.value < 0 && !input.metricKey.includes("change")) {
    return { ok: false, reason: "negative_value" };
  }
  if (!input.sourceUrl || !/^https?:\/\//i.test(input.sourceUrl)) {
    return { ok: false, reason: "missing_source_url" };
  }
  const end = new Date(`${input.periodEnd}T00:00:00.000Z`);
  if (Number.isNaN(end.getTime())) return { ok: false, reason: "bad_period_end" };
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (end.getTime() > tomorrow.getTime()) return { ok: false, reason: "future_dated" };

  if (input.unit === "percent" && (input.value < -100 || input.value > 1000)) {
    return { ok: false, reason: "percent_out_of_range" };
  }
  if (input.unit === "JOD_million" && input.currency && input.currency !== "JOD") {
    return { ok: false, reason: "currency_unit_mismatch" };
  }
  if (input.unit === "USD_million" && input.currency === "JOD") {
    return { ok: false, reason: "jod_usd_confusion" };
  }
  return { ok: true };
}

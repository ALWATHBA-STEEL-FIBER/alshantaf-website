"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import {
  loadDlsLocations,
  directoratesForGovernorate,
  villagesForDirectorate,
  basinsForVillage,
  neighborhoodsForBasin,
  type DlsData,
  type DlsOption,
} from "@/lib/dlsLocations";
import { GOVERNORATE_EN, DIRECTORATE_EN } from "@/lib/dlsTranslations";
import { localizePlaceName } from "@/lib/localizePlace";

interface CascadeOption {
  value: string;
  /** Canonical label — this is what's stored as the form value, regardless of UI language. */
  label: string;
  /** Text shown in the dropdown; falls back to `label` when there's no translation. */
  display: string;
}

const inputClass = "w-full h-9 rounded-md border border-line bg-surface-2 px-2.5 text-[13px] outline-none focus:border-gold";
const labelClass = "text-[11px] font-bold text-ink-soft";

interface Props {
  governorate: string;
  directorate: string;
  village: string;
  basin: string;
  neighborhood: string;
  onChange: (fields: { governorate?: string; directorate?: string; village?: string; basin?: string; neighborhood?: string }) => void;
  labels: { governorate: string; directorate: string; village: string; basin: string; neighborhood: string; other?: string };
  /** Whether governorate/directorate/village/basin are required for submission. Defaults to
   * true (the public request form); admin editing of pre-existing listings passes false so
   * opening an older, not-yet-tagged listing doesn't block saving unrelated edits. */
  required?: boolean;
  /** First step number shown beside the governorate field. Defaults to 1. */
  startNumber?: number;
  /** When false, labels render without sequence numbers. Defaults to true. */
  numbered?: boolean;
  /** `stack` = one field per line (public forms). `grid` = two columns (admin). */
  layout?: "stack" | "grid" | "desktop-grid";
}

/** Closed DLS picklists only — no free-text / "other" fallback. Options come from the
 * same governorate→…→neighborhood cascade used on apex-dls.dls.gov.jo. */
function CascadeField({
  step,
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled,
  required,
  loading,
  numbered,
}: {
  step?: number;
  label: string;
  placeholder: string;
  value: string;
  options: CascadeOption[];
  onChange: (label: string) => void;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  numbered?: boolean;
}) {
  const matches = options.some((o) => o.label === value);

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center gap-1.5">
        {numbered && step != null && (
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-green text-[10px] font-bold text-white">
            {step}
          </span>
        )}
        <label className={labelClass}>{label}</label>
      </div>
      <select
        className={inputClass}
        value={matches ? value : ""}
        disabled={disabled || loading || (!loading && options.length === 0)}
        required={required && options.length > 0}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          {loading ? "…" : placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.label}>
            {o.display}
          </option>
        ))}
      </select>
    </div>
  );
}

export function LocationCascade({
  governorate,
  directorate,
  village,
  basin,
  neighborhood,
  onChange,
  labels,
  required = true,
  startNumber = 1,
  numbered = true,
  layout = "stack",
}: Props) {
  const { lang, t } = useLanguage();
  const [data, setData] = useState<DlsData>({ governorates: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDlsLocations()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  // Governorate/directorate names are a small, fixed set with real, verified
  // English names (dlsTranslations.ts). Villages/basins/neighborhoods run into
  // the thousands, so those fall back to an automatic transliteration in
  // English mode — readable, but not an official translation.
  const withDisplay = (opts: DlsOption[], dict?: Record<string, string>): CascadeOption[] =>
    opts.map((o) => ({
      value: o.value,
      label: o.label,
      display: lang !== "en" ? o.label : dict?.[o.label] ?? localizePlaceName(o.label, "en"),
    }));

  const governorateOptions = withDisplay(data.governorates, GOVERNORATE_EN);
  const directorateOptions = withDisplay(governorate ? directoratesForGovernorate(data, governorate) : [], DIRECTORATE_EN);
  const villageOptions = withDisplay(governorate && directorate ? villagesForDirectorate(data, governorate, directorate) : []);
  const basinOptions = withDisplay(
    governorate && directorate && village ? basinsForVillage(data, governorate, directorate, village) : []
  );
  const neighborhoodOptions = withDisplay(
    governorate && directorate && village && basin ? neighborhoodsForBasin(data, governorate, directorate, village, basin) : []
  );

  // When DLS exposes exactly one neighborhood for the selected basin (commonly
  // "جدول الأحياء"), select it automatically so the admin-value lookup can run.
  const neighborhoodKey = neighborhoodOptions.map((o) => o.label).join("\0");
  useEffect(() => {
    if (loading || !basin) return;
    const options = neighborhoodKey ? neighborhoodKey.split("\0") : [];
    if (options.length === 1 && neighborhood !== options[0]) {
      onChange({ neighborhood: options[0] });
      return;
    }
    if (neighborhood && options.length > 0 && !options.includes(neighborhood)) {
      onChange({ neighborhood: "" });
    }
    // onChange is intentionally omitted — parents pass an inline updater.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, basin, neighborhood, neighborhoodKey]);

  const n = startNumber;

  return (
    <div
      className={
        layout === "grid"
          ? "grid w-full gap-3 sm:grid-cols-2"
          : layout === "desktop-grid"
            ? "flex w-full flex-col gap-3 xl:grid xl:grid-cols-2 xl:gap-2.5"
            : "flex w-full flex-col gap-3"
      }
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <CascadeField
        step={n}
        numbered={numbered}
        label={labels.governorate}
        placeholder={t.owners.chooseGovernorate}
        value={governorate}
        options={governorateOptions}
        required={required}
        loading={loading}
        onChange={(v) => onChange({ governorate: v, directorate: "", village: "", basin: "", neighborhood: "" })}
      />
      <CascadeField
        step={n + 1}
        numbered={numbered}
        label={labels.directorate}
        placeholder={t.owners.chooseDirectorate}
        value={directorate}
        options={directorateOptions}
        required={required}
        loading={loading}
        disabled={!governorate}
        onChange={(v) => onChange({ directorate: v, village: "", basin: "", neighborhood: "" })}
      />
      <CascadeField
        step={n + 2}
        numbered={numbered}
        label={labels.village}
        placeholder={t.owners.chooseVillage}
        value={village}
        options={villageOptions}
        required={required}
        loading={loading}
        disabled={!directorate}
        onChange={(v) => onChange({ village: v, basin: "", neighborhood: "" })}
      />
      <CascadeField
        step={n + 3}
        numbered={numbered}
        label={labels.basin}
        placeholder={t.owners.chooseBasin}
        value={basin}
        options={basinOptions}
        required={required}
        loading={loading}
        disabled={!village}
        onChange={(v) => {
          // Set the sole neighborhood immediately so submit isn't blocked while
          // waiting for the effect below (common when the option is "جدول الأحياء").
          const next = withDisplay(
            governorate && directorate && village
              ? neighborhoodsForBasin(data, governorate, directorate, village, v)
              : []
          );
          onChange({
            basin: v,
            neighborhood: next.length === 1 ? next[0].label : "",
          });
        }}
      />
      <CascadeField
        step={n + 4}
        numbered={numbered}
        label={labels.neighborhood}
        placeholder={t.owners.chooseNeighborhood}
        value={neighborhood}
        options={neighborhoodOptions}
        required={required && neighborhoodOptions.length > 0}
        loading={loading}
        disabled={!basin || neighborhoodOptions.length === 0}
        onChange={(v) => onChange({ neighborhood: v })}
      />
    </div>
  );
}

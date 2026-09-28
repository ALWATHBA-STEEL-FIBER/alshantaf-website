"use client";

import { useLanguage } from "@/lib/LanguageProvider";
import { SETBACKS } from "@/lib/setbacks";
import { COMMERCIAL_AMMAN_ORDER, COMMERCIAL_OUTSIDE_ORDER, INDUSTRIAL_ORDER, REGULATION_ORDER, RESIDENTIAL_ORDER } from "@/lib/regulations";
import type { IndustryType } from "@/lib/types";

type Props = {
  value: IndustryType | "";
  onChange?: (value: IndustryType | "") => void;
  /** When true, show as read-only facts for a fixed industry (offer detail). */
  readOnly?: boolean;
  /** Land-check shows all zoning; listing/owner forms stay industrial-only. */
  scope?: "all" | "industrial";
  className?: string;
};

function formatSetbackValue(
  raw: string,
  metersLabel: string,
  onRequest: string,
  floorsRoof: string,
  heightExRoof: string,
  asResidential: string
) {
  if (raw === "on-request") return onRequest;
  if (raw === "as-residential") return asResidential;
  if (raw === "—") return "—";
  if (raw === "2+roof") return floorsRoof;
  if (raw === "9-ex-roof") return heightExRoof;
  if (/^\d+(\.\d+)?(-\d+(\.\d+)?)?$/.test(raw)) return `${raw} ${metersLabel}`;
  return raw;
}

export function RegulationGuide({ value, onChange, readOnly = false, scope = "all", className }: Props) {
  const { t } = useLanguage();
  const selected = value || null;
  const guide = selected ? t.regulations.types[selected] : null;
  const setbacks = selected ? SETBACKS[selected] : null;
  const options = scope === "industrial" ? INDUSTRIAL_ORDER : REGULATION_ORDER;

  return (
    <div className={className ?? "rounded-2xl border border-line bg-white/80 p-4 sm:p-5"}>
      {!readOnly && (
        <div>
          <label className="text-xs font-bold text-ink-soft mb-1 block">{t.regulations.selectLabel}</label>
          <select
            className="w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold"
            value={value}
            onChange={(e) => onChange?.(e.target.value as IndustryType | "")}
          >
            <option value="">{t.regulations.selectPlaceholder}</option>
            {scope === "all" ? (
              <>
                <optgroup label={t.regulations.groupIndustrial}>
                  {INDUSTRIAL_ORDER.map((key) => (
                    <option key={key} value={key}>
                      {t.offers.industry[key]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t.regulations.groupResidential}>
                  {RESIDENTIAL_ORDER.map((key) => (
                    <option key={key} value={key}>
                      {t.offers.industry[key]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t.regulations.groupCommercialAmman}>
                  {COMMERCIAL_AMMAN_ORDER.map((key) => (
                    <option key={key} value={key}>
                      {t.offers.industry[key]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t.regulations.groupCommercialOutside}>
                  {COMMERCIAL_OUTSIDE_ORDER.map((key) => (
                    <option key={key} value={key}>
                      {t.offers.industry[key]}
                    </option>
                  ))}
                </optgroup>
              </>
            ) : (
              options.map((key) => (
                <option key={key} value={key}>
                  {t.offers.industry[key]}
                </option>
              ))
            )}
          </select>
          <p className="text-[11px] text-red-600 mt-2 leading-relaxed font-medium">{t.regulations.disclaimer}</p>
        </div>
      )}

      {guide && setbacks && (
        <div className={readOnly ? "" : "mt-4 pt-4 border-t border-line"}>
          {readOnly && (
            <p className="text-xs font-bold text-green mb-3">{t.regulations.panelTitle}</p>
          )}
          {!readOnly && (
            <p className="text-sm font-bold text-ink mb-3">{guide.title}</p>
          )}
          <p className="text-sm text-ink-soft leading-relaxed">{guide.summary}</p>

          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-green/20 bg-green/5 p-3.5">
              <p className="text-xs font-bold text-green mb-2">{t.regulations.allowedTitle}</p>
              <ul className="space-y-1.5 text-sm text-ink">
                {guide.allowed.map((item) => (
                  <li key={item} className="flex gap-2 leading-snug">
                    <span className="text-green shrink-0" aria-hidden>
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5">
              <p className="text-xs font-bold text-red-700 mb-2">{t.regulations.restrictedTitle}</p>
              <ul className="space-y-1.5 text-sm text-ink">
                {guide.restricted.map((item) => (
                  <li key={item} className="flex gap-2 leading-snug">
                    <span className="text-red-600 shrink-0" aria-hidden>
                      ✕
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-line bg-surface-2/80 p-3.5">
            <p className="text-xs font-bold text-green mb-3">{t.owners.setbacksTitle}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
              {(
                [
                  ["frontal", setbacks.frontal],
                  ["side", setbacks.side],
                  ["rear", setbacks.rear],
                  ["build", setbacks.buildPercentage],
                  ["floors", setbacks.floors],
                  ["height", setbacks.height],
                ] as const
              ).map(([key, raw]) => {
                const label =
                  key === "frontal"
                    ? t.owners.setbacksFrontal
                    : key === "side"
                      ? t.owners.setbacksSide
                      : key === "rear"
                        ? t.owners.setbacksRear
                        : key === "build"
                          ? t.owners.setbacksBuildPercentage
                          : key === "floors"
                            ? t.owners.setbacksFloors
                            : t.owners.setbacksHeight;
                const display =
                  key === "build"
                    ? raw === "on-request"
                      ? t.owners.setbacksOnRequest
                      : raw === "as-residential"
                        ? t.owners.setbacksAsResidential
                        : raw
                    : formatSetbackValue(
                        raw,
                        t.owners.setbacksMeters,
                        t.owners.setbacksOnRequest,
                        t.owners.setbacksFloorsRoof,
                        t.owners.setbacksHeightExRoof,
                        t.owners.setbacksAsResidential
                      );
                return (
                  <div key={key}>
                    <small className="block text-[10px] text-ink-soft">{label}</small>
                    <b className="text-sm">{display}</b>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

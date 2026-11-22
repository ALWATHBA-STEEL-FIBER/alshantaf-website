"use client";

import type { CommissionBasis, CommissionRule } from "@/lib/investApi";
import { BASIS_LABELS, Field, MoneyInput, inputCls, useT } from "./ui";

export function CommissionEditor({
  rule,
  onChange,
  shareLosses,
  onShareLosses,
  coordinatorParticipates,
  onCoordinatorParticipates,
  disabled,
}: {
  rule: CommissionRule;
  onChange: (r: CommissionRule) => void;
  shareLosses: boolean;
  onShareLosses: (v: boolean) => void;
  coordinatorParticipates: boolean;
  onCoordinatorParticipates: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { t, lang } = useT();
  const usesPct = rule.basis !== "fixed";
  const usesFixed = rule.basis === "fixed" || rule.basis === "hybrid";
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {(Object.keys(BASIS_LABELS) as CommissionBasis[]).map((b) => {
          const [ar, en, dar, den] = BASIS_LABELS[b];
          const on = rule.basis === b;
          return (
            <button
              key={b}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...rule, basis: b })}
              className={`text-start rounded-xl border p-3 transition ${on ? "border-green bg-green/5 ring-2 ring-green/20" : "border-line bg-white hover:bg-surface-2"}`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-4 w-4 rounded-full border-2 ${on ? "border-green bg-green" : "border-line"}`} />
                <span className="text-sm font-bold text-green">{lang === "ar" ? ar : en}</span>
                {b === "investor_net_profit" ? (
                  <span className="text-[10px] font-bold text-gold bg-gold/10 rounded px-1.5">{t("الأشيع", "Common")}</span>
                ) : null}
              </div>
              <div className="text-[11px] text-ink-soft mt-1 leading-relaxed">{lang === "ar" ? dar : den}</div>
            </button>
          );
        })}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {usesPct ? (
          <Field label={t("نسبة المنسق %", "Coordinator %")}>
            <div className="relative">
              <input
                className={`${inputCls} !pr-10 tabular-nums text-left`}
                dir="ltr"
                inputMode="decimal"
                disabled={disabled}
                value={String(rule.percent ?? "")}
                onChange={(e) => onChange({ ...rule, percent: e.target.value.replace(/[^0-9.]/g, "") })}
              />
              <span className="absolute inset-y-0 right-3 flex items-center text-sm font-bold text-ink-soft pointer-events-none">%</span>
            </div>
          </Field>
        ) : null}
        {usesFixed ? (
          <Field label={t("المبلغ الثابت", "Fixed amount")}>
            <MoneyInput value={String(rule.fixedAmount ?? "")} onChange={(v) => onChange({ ...rule, fixedAmount: v })} disabled={disabled} />
          </Field>
        ) : null}
      </div>
      <div className="space-y-2">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 accent-[var(--color-green)]" checked={shareLosses} disabled={disabled} onChange={(e) => onShareLosses(e.target.checked)} />
          <span>
            <span className="font-bold">{t("في حال الخسارة: يتحملها الجميع حسب الحصص", "On a loss: everyone shares it by ownership")}</span>
            <span className="block text-[11px] text-ink-soft">
              {t(
                "بدون هذا الخيار يُرجَع رأس المال أولاً ثم المصاريف، فيتحمل من دفع المصاريف الخسارة وحده.",
                "Without it, capital is returned first, then expenses — so whoever paid expenses carries the loss alone."
              )}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1 accent-[var(--color-green)]"
            checked={coordinatorParticipates}
            disabled={disabled}
            onChange={(e) => onCoordinatorParticipates(e.target.checked)}
          />
          <span>
            <span className="font-bold">{t("المنسق يأخذ ربح حصته أيضاً", "Coordinator also earns profit on his share")}</span>
            <span className="block text-[11px] text-ink-soft">
              {t("ألغِ التحديد إذا كان المنسق يأخذ العمولة فقط دون نصيب من الربح.", "Untick if the coordinator only takes the cut, no profit share.")}
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

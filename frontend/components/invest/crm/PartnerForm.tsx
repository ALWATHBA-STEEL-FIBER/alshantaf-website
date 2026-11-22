"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { crmApi, type PartnerFull, type PartnerRow } from "@/lib/investApi";
import { ErrorNote, Field, Modal, btnGhost, btnPrimary, inputCls, useT } from "./ui";

type Draft = {
  name: string;
  kind: string;
  phone: string;
  email: string;
  nationalId: string;
  city: string;
  address: string;
  bankDetails: string;
  notes: string;
  portalEmail: string;
  portalPassword: string;
};

function draftFrom(p?: PartnerFull | null): Draft {
  return {
    name: p?.legalName ?? "",
    kind: p?.kind ?? "individual",
    phone: p?.phone ?? "",
    email: p?.email ?? "",
    nationalId: p?.nationalId ?? "",
    city: p?.city ?? "",
    address: p?.address ?? "",
    bankDetails: p?.bankDetails ?? "",
    notes: p?.notes ?? "",
    portalEmail: p?.portal?.email ?? "",
    portalPassword: "",
  };
}

/**
 * Create or edit a partner. Warns about likely duplicates (same phone / national ID / email / name)
 * and lets the user pick the existing record instead.
 */
export function PartnerFormModal({
  open,
  onClose,
  partner,
  initialName,
  onSaved,
  onPickExisting,
}: {
  open: boolean;
  onClose: () => void;
  partner?: PartnerFull | null;
  initialName?: string;
  onSaved: (p: { id: string; name: string; code: string | null }) => void;
  onPickExisting?: (p: PartnerRow) => void;
}) {
  const { t } = useT();
  const [d, setD] = useState<Draft>(() => ({ ...draftFrom(partner), name: partner?.legalName ?? initialName ?? "" }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dups, setDups] = useState<PartnerRow[]>([]);
  const [showMore, setShowMore] = useState(Boolean(partner));
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setD((x) => ({ ...x, [k]: e.target.value }));

  async function save(force = false) {
    setError("");
    if (!d.name.trim()) {
      setError(t("الاسم مطلوب", "Name is required"));
      return;
    }
    setBusy(true);
    const payload: Record<string, unknown> = {
      name: d.name,
      kind: d.kind,
      phone: d.phone,
      email: d.email,
      city: d.city,
      address: d.address,
      notes: d.notes,
      force,
    };
    // National ID / bank are write-only on edit: empty means "keep what is stored".
    if (!partner || d.nationalId.trim()) payload.nationalId = d.nationalId;
    if (!partner || d.bankDetails.trim()) payload.bankDetails = d.bankDetails;
    if (d.portalEmail && d.portalPassword) {
      payload.portalEmail = d.portalEmail;
      payload.portalPassword = d.portalPassword;
    }
    try {
      if (partner) {
        const p = await crmApi.updatePartner(partner.id, payload);
        onSaved({ id: p.id, name: p.name, code: p.code });
      } else {
        const p = await crmApi.createPartner(payload);
        onSaved({ id: p.id, name: p.name, code: p.code });
      }
      setDups([]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const found = await crmApi
          .duplicates({ phone: d.phone, email: d.email, nationalId: d.nationalId, excludeId: partner?.id })
          .catch(() => []);
        setDups(found);
        if (!found.length) setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : t("تعذّر الحفظ", "Save failed"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={partner ? t("تعديل بيانات الشريك", "Edit partner") : t("شريك جديد", "New partner")}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field label={t("الاسم الكامل *", "Full name *")}>
            <input className={inputCls} value={d.name} onChange={set("name")} autoFocus />
          </Field>
          <Field label={t("النوع", "Type")}>
            <select className={inputCls} value={d.kind} onChange={set("kind")}>
              <option value="individual">{t("فرد", "Individual")}</option>
              <option value="company">{t("شركة", "Company")}</option>
            </select>
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={t("الهاتف", "Phone")}>
            <input className={inputCls} dir="ltr" inputMode="tel" value={d.phone} onChange={set("phone")} placeholder="07XXXXXXXX" />
          </Field>
          <Field
            label={d.kind === "company" ? t("الرقم الوطني للمنشأة", "Company national no.") : t("الرقم الوطني / الجواز", "National ID / passport")}
            hint={
              partner?.hasNationalId
                ? t(`محفوظ (…${partner.nationalIdLast4 ?? ""}) — اتركه فارغاً للإبقاء عليه`, `Saved (…${partner.nationalIdLast4 ?? ""}) — leave empty to keep`)
                : t("مشفّر، ويمكن البحث به", "Encrypted, still searchable")
            }
          >
            <input className={inputCls} dir="ltr" value={d.nationalId} onChange={set("nationalId")} />
          </Field>
        </div>

        {!showMore ? (
          <button type="button" className="text-xs font-bold text-green underline" onClick={() => setShowMore(true)}>
            + {t("بريد، مدينة، عنوان، حساب بنكي، دخول البوابة", "Email, city, address, bank, portal login")}
          </button>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t("البريد الإلكتروني", "Email")}>
                <input className={inputCls} dir="ltr" type="email" value={d.email} onChange={set("email")} />
              </Field>
              <Field label={t("المدينة", "City")}>
                <input className={inputCls} value={d.city} onChange={set("city")} />
              </Field>
            </div>
            <Field label={t("العنوان", "Address")}>
              <input className={inputCls} value={d.address} onChange={set("address")} />
            </Field>
            <Field
              label={t("الحساب البنكي / IBAN", "Bank account / IBAN")}
              hint={partner?.hasBankDetails ? t("محفوظ — اتركه فارغاً للإبقاء عليه", "Saved — leave empty to keep") : t("مشفّر", "Encrypted")}
            >
              <input className={inputCls} dir="ltr" value={d.bankDetails} onChange={set("bankDetails")} />
            </Field>
            <Field label={t("ملاحظات", "Notes")}>
              <textarea className={`${inputCls} h-20 py-2`} value={d.notes} onChange={set("notes")} />
            </Field>
            <div className="rounded-xl bg-surface-2 p-3 space-y-2">
              <div className="text-xs font-bold text-green">{t("دخول بوابة المستثمر (اختياري)", "Investor portal login (optional)")}</div>
              <div className="grid sm:grid-cols-2 gap-2">
                <input className={inputCls} dir="ltr" type="email" placeholder="email" value={d.portalEmail} onChange={set("portalEmail")} />
                <input
                  className={inputCls}
                  dir="ltr"
                  type="password"
                  autoComplete="new-password"
                  placeholder={partner?.portal ? t("كلمة مرور جديدة", "New password") : t("كلمة المرور", "Password")}
                  value={d.portalPassword}
                  onChange={set("portalPassword")}
                />
              </div>
            </div>
          </>
        )}

        {dups.length ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
            <div className="text-sm font-bold text-amber-900">
              {t("يوجد شريك مسجّل بنفس البيانات:", "A partner with the same details already exists:")}
            </div>
            {dups.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-amber-200 px-3 py-2">
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">
                    {p.name} <span className="text-ink-soft font-medium">· {p.code}</span>
                  </div>
                  <div className="text-[11px] text-ink-soft" dir="ltr">
                    {[p.phone, p.email, p.nationalIdLast4 ? `ID …${p.nationalIdLast4}` : null].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {onPickExisting ? (
                  <button type="button" className="h-9 px-3 rounded-lg bg-green text-white text-xs font-bold" onClick={() => onPickExisting(p)}>
                    {t("استخدمه", "Use this")}
                  </button>
                ) : null}
              </div>
            ))}
            <button type="button" className="text-xs font-bold text-amber-900 underline" onClick={() => void save(true)} disabled={busy}>
              {t("لا، هذا شخص مختلف — احفظ على أي حال", "No, different person — save anyway")}
            </button>
          </div>
        ) : null}

        <ErrorNote message={error} />
        <div className="flex gap-2 pt-1">
          <button type="submit" className={`${btnPrimary} flex-1`} disabled={busy}>
            {busy ? "…" : partner ? t("حفظ التعديلات", "Save changes") : t("إضافة الشريك", "Add partner")}
          </button>
          <button type="button" className={btnGhost} onClick={onClose}>
            {t("إلغاء", "Cancel")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

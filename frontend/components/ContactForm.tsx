"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { useSettings } from "@/lib/SettingsProvider";
import { useTeam } from "@/lib/TeamProvider";
import { api, ApiError } from "@/lib/api";
import { openWhatsapp } from "@/lib/whatsapp";
import { PhoneIcon, WhatsappIcon } from "@/components/icons";
import { toWesternDigits } from "@/lib/arabicDigits";

const inputClass =
  "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none transition-colors focus:border-gold focus:bg-white";
const labelClass = "text-xs font-bold text-ink-soft mb-1 block";

export function ContactForm() {
  const { t } = useLanguage();
  const settings = useSettings();
  const team = useTeam();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [requestType, setRequestType] = useState("");
  const [industryType, setIndustryType] = useState("");
  const [activityType, setActivityType] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [doneSerial, setDoneSerial] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) {
      setError(t.contact.nameRequired);
      return;
    }
    if (!phone) {
      setError(t.contact.phoneRequired);
      return;
    }
    if (!requestType) {
      setError(t.contact.requestTypeRequired);
      return;
    }
    if (!message.trim()) {
      setError(t.contact.detailsRequired);
      return;
    }
    setError("");
    setSaving(true);
    try {
      const requestTypeLabel = t.contact.requestTypes[requestType as keyof typeof t.contact.requestTypes] || requestType;
      const result = await api.createContactRequest({
        name,
        phone,
        requestType: requestTypeLabel,
        industryType: industryType || undefined,
        activityType: activityType || undefined,
        details: message,
      });
      setDoneSerial(result.serialNo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.contact.submitFailed);
    } finally {
      setSaving(false);
    }
  }

  function openWhatsAppDraft() {
    const requestTypeLabel = requestType ? t.contact.requestTypes[requestType as keyof typeof t.contact.requestTypes] : "";
    const lines = [
      "مرحبًا، أرغب في إرسال طلب عبر موقع الشنتف للعقار والاستثمار.",
      "",
      `الاسم: ${name}`,
      `رقم الهاتف: ${phone}`,
      `نوع الطلب: ${requestTypeLabel}`,
      `نوع الصناعة: ${industryType}`,
      `النشاط الصناعي: ${activityType}`,
      `تفاصيل الطلب: ${message}`,
      doneSerial ? `رقم الطلب: ${doneSerial}` : "",
      "",
      "سأرسل الآن الصور والمخططات وملفات PDF المتعلقة بالفرصة.",
    ].filter(Boolean);
    openWhatsapp(lines.join("\n"), settings.whatsappNumber);
  }

  return (
    <section id="contact" className="py-16 md:py-20">
      <div className="mx-auto max-w-[1240px] px-4">
        <div className="overflow-hidden rounded-[2rem] border border-line bg-white shadow-[0_30px_70px_-42px_rgba(15,52,47,0.4)] grid lg:grid-cols-[0.95fr_1.15fr]">
          <aside className="relative bg-green text-white p-8 md:p-10 overflow-hidden">
            <div className="absolute -top-16 -end-10 w-56 h-56 rounded-full bg-gold/20 blur-3xl pointer-events-none" aria-hidden />
            <div className="absolute bottom-0 start-0 w-72 h-40 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.1),transparent_60%)] pointer-events-none" aria-hidden />
            <div className="relative">
              <span className="text-gold text-xs font-bold tracking-wide">{t.contact.eyebrow}</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-3 text-balance">{t.contact.title}</h2>
              <p className="text-white/75 mt-4 leading-relaxed">{t.contact.subtitle}</p>

              <div className="mt-10 space-y-4">
                {team.length > 0 && (
                  <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm space-y-3">
                    {team.map((member) => (
                      <div key={member.name}>
                        <b className="block text-sm">{member.name}</b>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1" dir="ltr">
                          {member.phone && (
                            <a href={`tel:${member.phone.replace(/[^0-9+]/g, "")}`} className="flex items-center gap-1.5 text-xs text-white/85 hover:text-gold transition-colors">
                              <PhoneIcon className="w-3.5 h-3.5" /> {member.phone}
                            </a>
                          )}
                          {member.whatsapp && (
                            <a
                              href={`https://wa.me/${member.whatsapp.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener"
                              className="flex items-center gap-1.5 text-xs text-white/85 hover:text-gold transition-colors"
                            >
                              <WhatsappIcon className="w-3.5 h-3.5" /> WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <ContactFact label={t.contact.email} value={settings.contactEmail} href={`mailto:${settings.contactEmail}`} />
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
                  <b className="block text-xs text-white/55">{t.contact.serviceArea}</b>
                  <span className="font-bold text-sm mt-1 block">{t.contact.serviceAreaValue}</span>
                </div>
              </div>
            </div>
          </aside>

          {doneSerial ? (
            <div className="p-6 md:p-10 flex flex-col gap-4 justify-center">
              <p className="text-gold text-xs font-bold tracking-wide">{t.contact.sentEyebrow}</p>
              <h3 className="font-bold text-2xl text-green">{t.contact.sentTitle}</h3>
              <p className="text-sm text-ink-soft leading-relaxed">{t.contact.sentNote}</p>
              <p className="text-sm font-bold" dir="ltr">
                {t.contact.reference}: {doneSerial}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  onClick={openWhatsAppDraft}
                  className="h-11 px-5 rounded-full bg-green text-white text-sm font-bold hover:bg-green-2 transition-colors"
                >
                  {t.contact.continueWhatsapp}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDoneSerial(null);
                    setName("");
                    setPhone("");
                    setRequestType("");
                    setIndustryType("");
                    setActivityType("");
                    setMessage("");
                  }}
                  className="h-11 px-5 rounded-full border border-line text-sm font-bold hover:border-gold/50 transition-colors"
                >
                  {t.contact.sendAnother}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 md:p-10 flex flex-col gap-3">
              <h3 className="font-bold text-lg">{t.contact.formTitle}</h3>
              <p className="text-xs text-ink-soft">{t.contact.formSubtitle}</p>
              <div className="grid sm:grid-cols-2 gap-3 mt-2">
                <div>
                  <label className={labelClass}>{t.contact.name}</label>
                  <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <label className={labelClass}>{t.contact.phone}</label>
                  <input className={inputClass} value={phone} onChange={(e) => setPhone(toWesternDigits(e.target.value))} required />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>{t.contact.requestType}</label>
                  <select className={inputClass} value={requestType} onChange={(e) => setRequestType(e.target.value)} required>
                    <option value="">{t.contact.selectRequestType}</option>
                    {Object.entries(t.contact.requestTypes).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t.contact.industryType}</label>
                  <select className={inputClass} value={industryType} onChange={(e) => setIndustryType(e.target.value)}>
                    <option value="">{t.owners.selectIndustry}</option>
                    <option value={t.offers.industry.lightSpecial}>{t.offers.industry.lightSpecial}</option>
                    <option value={t.offers.industry.light}>{t.offers.industry.light}</option>
                    <option value={t.offers.industry.mediumSpecial}>{t.offers.industry.mediumSpecial}</option>
                    <option value={t.offers.industry.medium}>{t.offers.industry.medium}</option>
                    <option value={t.offers.industry.agriToIndustrial}>{t.offers.industry.agriToIndustrial}</option>
                    <option value={t.offers.industry.technical}>{t.offers.industry.technical}</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t.contact.activityType}</label>
                  <select className={inputClass} value={activityType} onChange={(e) => setActivityType(e.target.value)}>
                    <option value="">{t.owners.selectActivity}</option>
                    {Object.values(t.activities).map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>{t.contact.requestDetails}</label>
                  <textarea className={`${inputClass} h-28 py-2`} value={message} onChange={(e) => setMessage(e.target.value)} required />
                </div>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="mt-2 h-12 rounded-full bg-green text-white font-bold hover:bg-green-2 transition-colors shadow-[0_14px_28px_-16px_rgba(15,52,47,0.7)] disabled:opacity-60"
              >
                {saving ? t.contact.sending : t.contact.submit}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function ContactFact({
  label,
  value,
  href,
  ltr,
}: {
  label: string;
  value: string;
  href: string;
  ltr?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
      <b className="block text-xs text-white/55">{label}</b>
      <a dir={ltr ? "ltr" : undefined} className="font-bold text-sm mt-1 inline-block hover:text-gold transition-colors" href={href}>
        {value}
      </a>
    </div>
  );
}

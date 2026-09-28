"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { useToast } from "./Toast";
import { Spinner, SkeletonBlock } from "./EmptyState";
import type { AdminSettings } from "@/lib/types";
import { toWesternDigits } from "@/lib/arabicDigits";

const inputClass = "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";
const labelClass = "text-xs font-bold text-ink-soft mb-1 block";

export function SettingsManager() {
  const { t } = useLanguage();
  const { showSuccess, showError } = useToast();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    api.adminSettings().then((s) => {
      if (!ignore) setSettings(s);
    });
    return () => {
      ignore = true;
    };
  }, []);

  if (!settings) {
    return (
      <div>
        <SkeletonBlock className="h-8 w-40 mb-6" />
        <SkeletonBlock className="h-96 max-w-2xl" />
      </div>
    );
  }

  const update = (key: keyof AdminSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSettings((s) => (s ? { ...s, [key]: e.target.value } : s));

  const updateDigits = (key: "whatsappNumber" | "contactPhone1" | "contactPhone2") => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setSettings((s) => (s ? { ...s, [key]: toWesternDigits(e.target.value) } : s));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      showSuccess(t.admin.settingsSaved);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-green mb-6">{t.admin.settings}</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-line p-6 flex flex-col gap-4 max-w-2xl">
        <div>
          <label className={labelClass}>{t.admin.whatsappNumber}</label>
          <input
            className={inputClass}
            value={settings.whatsappNumber}
            onChange={updateDigits("whatsappNumber")}
            pattern="[0-9]+"
            title={t.admin.digitsOnly}
            required
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t.admin.contactPhone1}</label>
            <input className={inputClass} value={settings.contactPhone1} onChange={updateDigits("contactPhone1")} required />
          </div>
          <div>
            <label className={labelClass}>{t.admin.contactPhone2}</label>
            <input className={inputClass} value={settings.contactPhone2} onChange={updateDigits("contactPhone2")} required />
          </div>
        </div>
        <div>
          <label className={labelClass}>{t.admin.contactEmail}</label>
          <input type="email" className={inputClass} value={settings.contactEmail} onChange={update("contactEmail")} required />
        </div>
        <div>
          <label className={labelClass}>{t.admin.facebookUrl}</label>
          <input type="url" dir="ltr" className={inputClass} value={settings.facebookUrl} onChange={update("facebookUrl")} placeholder="https://facebook.com/..." />
        </div>
        <div>
          <label className={labelClass}>{t.admin.instagramUrl}</label>
          <input type="url" dir="ltr" className={inputClass} value={settings.instagramUrl ?? ""} onChange={update("instagramUrl")} placeholder="https://instagram.com/..." />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.submissionsEnabled === "true"}
            onChange={(e) => setSettings((s) => (s ? { ...s, submissionsEnabled: e.target.checked ? "true" : "false" } : s))}
          />
          {t.admin.submissionsEnabled}
        </label>
        <div>
          <label className={labelClass}>{t.admin.maintenanceBanner}</label>
          <textarea className={`${inputClass} h-20 py-2`} value={settings.maintenanceBanner} onChange={update("maintenanceBanner")} maxLength={300} />
        </div>

        <button type="submit" disabled={saving} className="h-12 rounded-full bg-green text-white font-bold self-start px-8 disabled:opacity-60 flex items-center gap-2">
          {saving && <Spinner className="w-4 h-4" />}
          {t.admin.save}
        </button>
      </form>
    </div>
  );
}

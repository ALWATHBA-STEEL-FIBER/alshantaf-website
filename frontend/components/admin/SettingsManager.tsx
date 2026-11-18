"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { useToast } from "./Toast";
import { Spinner, SkeletonBlock } from "./EmptyState";
import { useAdminSession } from "@/lib/adminPermissions";
import type { AdminAiConfig, AdminSettings } from "@/lib/types";
import { toWesternDigits } from "@/lib/arabicDigits";

const inputClass = "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold";
const labelClass = "text-xs font-bold text-ink-soft mb-1 block";

function keyStatusLabel(
  t: ReturnType<typeof useLanguage>["t"],
  set: boolean,
  source: "db" | "env" | null,
  hint: string | null
) {
  if (!set) return t.admin.aiConfigKeyMissing;
  const src =
    source === "env" ? t.admin.aiConfigKeyEnv : source === "db" ? t.admin.aiConfigKeyDb : t.admin.aiConfigKeySet;
  return hint ? `${src} · ${hint}` : src;
}

export function SettingsManager() {
  const { t } = useLanguage();
  const { isFull } = useAdminSession();
  const { showSuccess, showError } = useToast();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [knowledge, setKnowledge] = useState("");
  const [knowledgeMeta, setKnowledgeMeta] = useState<{ defaultLength: number; maxChars: number } | null>(null);
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);
  const [knowledgeLoaded, setKnowledgeLoaded] = useState(false);
  const [aiConfig, setAiConfig] = useState<AdminAiConfig | null>(null);
  const [openaiKeyDraft, setOpenaiKeyDraft] = useState("");
  const [groqKeyDraft, setGroqKeyDraft] = useState("");
  const [clearOpenaiKey, setClearOpenaiKey] = useState(false);
  const [clearGroqKey, setClearGroqKey] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    api.adminSettings().then((s) => {
      if (!ignore) setSettings(s);
    });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!isFull) return;
    let ignore = false;
    api
      .assistantKnowledge()
      .then((row) => {
        if (ignore) return;
        setKnowledge(row.content);
        setKnowledgeMeta({ defaultLength: row.defaultLength, maxChars: row.maxChars });
        setKnowledgeLoaded(true);
      })
      .catch((err) => {
        if (!ignore) showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
      });
    api
      .aiConfig()
      .then((row) => {
        if (!ignore) setAiConfig(row);
      })
      .catch((err) => {
        if (!ignore) showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
      });
    return () => {
      ignore = true;
    };
  }, [isFull, showError, t.admin.saveFailed]);

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

      {isFull ? (
        <form
          className="bg-white rounded-2xl border border-line p-6 flex flex-col gap-4 max-w-2xl mt-8"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!aiConfig) return;
            setAiSaving(true);
            try {
              const updated = await api.updateAiConfig({
                provider: aiConfig.provider,
                openaiModel: aiConfig.openaiModel,
                openaiTemperature: aiConfig.openaiTemperature,
                openaiReasoningEffort: aiConfig.openaiReasoningEffort,
                openaiMaxCompletionTokens: aiConfig.openaiMaxCompletionTokens,
                groqModel: aiConfig.groqModel,
                groqTemperature: aiConfig.groqTemperature,
                guardEnabled: aiConfig.guardEnabled,
                guardModel: aiConfig.guardModel,
                guardThreshold: aiConfig.guardThreshold,
                ...(openaiKeyDraft.trim() ? { openaiApiKey: openaiKeyDraft.trim() } : {}),
                ...(groqKeyDraft.trim() ? { groqApiKey: groqKeyDraft.trim() } : {}),
                ...(clearOpenaiKey ? { clearOpenaiApiKey: true } : {}),
                ...(clearGroqKey ? { clearGroqApiKey: true } : {}),
              });
              setAiConfig(updated);
              setOpenaiKeyDraft("");
              setGroqKeyDraft("");
              setClearOpenaiKey(false);
              setClearGroqKey(false);
              showSuccess(t.admin.aiConfigSaved);
            } catch (err) {
              showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
            } finally {
              setAiSaving(false);
            }
          }}
        >
          <div>
            <h2 className="text-lg font-bold text-green">{t.admin.aiConfigTitle}</h2>
            <p className="text-xs text-ink-soft mt-1 leading-relaxed">{t.admin.aiConfigNote}</p>
            {aiConfig ? (
              <p className="text-xs font-bold text-ink mt-2">
                {t.admin.aiConfigActive}:{" "}
                {aiConfig.activeProvider
                  ? `${aiConfig.activeProvider} · ${aiConfig.activeModel}`
                  : t.admin.aiConfigInactive}
              </p>
            ) : null}
          </div>

          {!aiConfig ? (
            <SkeletonBlock className="h-64" />
          ) : (
            <>
              <div>
                <label className={labelClass}>{t.admin.aiConfigProvider}</label>
                <select
                  className={inputClass}
                  value={aiConfig.provider}
                  onChange={(e) =>
                    setAiConfig((c) =>
                      c ? { ...c, provider: e.target.value as AdminAiConfig["provider"] } : c
                    )
                  }
                >
                  <option value="auto">{t.admin.aiConfigProviderAuto}</option>
                  <option value="openai">{t.admin.aiConfigProviderOpenai}</option>
                  <option value="groq">{t.admin.aiConfigProviderGroq}</option>
                </select>
              </div>

              <div className="border-t border-line pt-4 flex flex-col gap-3">
                <p className="text-sm font-bold text-ink">OpenAI</p>
                <p className="text-[11px] text-ink-soft">
                  {keyStatusLabel(t, aiConfig.openaiKeySet, aiConfig.openaiKeySource, aiConfig.openaiKeyHint)}
                </p>
                <div>
                  <label className={labelClass}>{t.admin.aiConfigOpenaiKey}</label>
                  <input
                    type="password"
                    autoComplete="off"
                    dir="ltr"
                    className={inputClass}
                    value={openaiKeyDraft}
                    onChange={(e) => {
                      setOpenaiKeyDraft(e.target.value);
                      if (e.target.value) setClearOpenaiKey(false);
                    }}
                    placeholder={t.admin.aiConfigKeyPlaceholder}
                  />
                </div>
                {aiConfig.openaiKeySource === "db" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={clearOpenaiKey}
                      onChange={(e) => {
                        setClearOpenaiKey(e.target.checked);
                        if (e.target.checked) setOpenaiKeyDraft("");
                      }}
                    />
                    {t.admin.aiConfigClearKey}
                  </label>
                ) : null}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t.admin.aiConfigModel}</label>
                    <input
                      dir="ltr"
                      className={inputClass}
                      value={aiConfig.openaiModel}
                      onChange={(e) => setAiConfig((c) => (c ? { ...c, openaiModel: e.target.value } : c))}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t.admin.aiConfigTemperature}</label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      dir="ltr"
                      className={inputClass}
                      value={aiConfig.openaiTemperature}
                      onChange={(e) =>
                        setAiConfig((c) =>
                          c ? { ...c, openaiTemperature: Number(e.target.value) } : c
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t.admin.aiConfigReasoning}</label>
                    <select
                      className={inputClass}
                      value={aiConfig.openaiReasoningEffort}
                      onChange={(e) =>
                        setAiConfig((c) =>
                          c
                            ? {
                                ...c,
                                openaiReasoningEffort: e.target.value as AdminAiConfig["openaiReasoningEffort"],
                              }
                            : c
                        )
                      }
                    >
                      <option value="none">{t.admin.aiConfigReasoningNone}</option>
                      <option value="low">{t.admin.aiConfigReasoningLow}</option>
                      <option value="medium">{t.admin.aiConfigReasoningMedium}</option>
                      <option value="high">{t.admin.aiConfigReasoningHigh}</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{t.admin.aiConfigMaxTokens}</label>
                    <input
                      type="number"
                      min={256}
                      max={4000}
                      step={50}
                      dir="ltr"
                      className={inputClass}
                      value={aiConfig.openaiMaxCompletionTokens}
                      onChange={(e) =>
                        setAiConfig((c) =>
                          c ? { ...c, openaiMaxCompletionTokens: Number(e.target.value) } : c
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-line pt-4 flex flex-col gap-3">
                <p className="text-sm font-bold text-ink">Groq</p>
                <p className="text-[11px] text-ink-soft">
                  {keyStatusLabel(t, aiConfig.groqKeySet, aiConfig.groqKeySource, aiConfig.groqKeyHint)}
                </p>
                <div>
                  <label className={labelClass}>{t.admin.aiConfigGroqKey}</label>
                  <input
                    type="password"
                    autoComplete="off"
                    dir="ltr"
                    className={inputClass}
                    value={groqKeyDraft}
                    onChange={(e) => {
                      setGroqKeyDraft(e.target.value);
                      if (e.target.value) setClearGroqKey(false);
                    }}
                    placeholder={t.admin.aiConfigKeyPlaceholder}
                  />
                </div>
                {aiConfig.groqKeySource === "db" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={clearGroqKey}
                      onChange={(e) => {
                        setClearGroqKey(e.target.checked);
                        if (e.target.checked) setGroqKeyDraft("");
                      }}
                    />
                    {t.admin.aiConfigClearKey}
                  </label>
                ) : null}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t.admin.aiConfigModel}</label>
                    <input
                      dir="ltr"
                      className={inputClass}
                      value={aiConfig.groqModel}
                      onChange={(e) => setAiConfig((c) => (c ? { ...c, groqModel: e.target.value } : c))}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t.admin.aiConfigTemperature}</label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      dir="ltr"
                      className={inputClass}
                      value={aiConfig.groqTemperature}
                      onChange={(e) =>
                        setAiConfig((c) => (c ? { ...c, groqTemperature: Number(e.target.value) } : c))
                      }
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={aiConfig.guardEnabled}
                    onChange={(e) =>
                      setAiConfig((c) => (c ? { ...c, guardEnabled: e.target.checked } : c))
                    }
                  />
                  {t.admin.aiConfigGuardEnabled}
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t.admin.aiConfigGuardModel}</label>
                    <input
                      dir="ltr"
                      className={inputClass}
                      value={aiConfig.guardModel}
                      onChange={(e) => setAiConfig((c) => (c ? { ...c, guardModel: e.target.value } : c))}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t.admin.aiConfigGuardThreshold}</label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      dir="ltr"
                      className={inputClass}
                      value={aiConfig.guardThreshold}
                      onChange={(e) =>
                        setAiConfig((c) => (c ? { ...c, guardThreshold: Number(e.target.value) } : c))
                      }
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={aiSaving}
                className="h-12 rounded-full bg-green text-white font-bold self-start px-8 disabled:opacity-60 flex items-center gap-2"
              >
                {aiSaving && <Spinner className="w-4 h-4" />}
                {t.admin.aiConfigSave}
              </button>
            </>
          )}
        </form>
      ) : null}

      {isFull ? (
        <form
          className="bg-white rounded-2xl border border-line p-6 flex flex-col gap-4 max-w-4xl mt-8"
          onSubmit={async (e) => {
            e.preventDefault();
            setKnowledgeSaving(true);
            try {
              const row = await api.updateAssistantKnowledge(knowledge);
              setKnowledge(row.content);
              setKnowledgeMeta({ defaultLength: row.defaultLength, maxChars: row.maxChars });
              showSuccess(t.admin.assistantKnowledgeSaved);
            } catch (err) {
              showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
            } finally {
              setKnowledgeSaving(false);
            }
          }}
        >
          <div>
            <h2 className="text-lg font-bold text-green">{t.admin.assistantKnowledgeTitle}</h2>
            <p className="text-xs text-ink-soft mt-1 leading-relaxed">{t.admin.assistantKnowledgeNote}</p>
          </div>
          {!knowledgeLoaded ? (
            <SkeletonBlock className="h-64" />
          ) : (
            <>
              <textarea
                dir="rtl"
                className={`${inputClass} min-h-[28rem] h-[32rem] py-3 font-mono text-[13px] leading-relaxed`}
                value={knowledge}
                maxLength={knowledgeMeta?.maxChars ?? 160000}
                onChange={(e) => setKnowledge(e.target.value)}
              />
              <p className="text-[11px] text-ink-soft">
                {knowledge.length.toLocaleString()} / {(knowledgeMeta?.maxChars ?? 160000).toLocaleString()}{" "}
                {t.admin.assistantKnowledgeChars}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={knowledgeSaving}
                  className="h-12 rounded-full bg-green text-white font-bold px-8 disabled:opacity-60 flex items-center gap-2"
                >
                  {knowledgeSaving && <Spinner className="w-4 h-4" />}
                  {t.admin.assistantKnowledgeSave}
                </button>
                <button
                  type="button"
                  disabled={knowledgeSaving}
                  className="h-12 rounded-full border border-line px-6 font-bold text-ink disabled:opacity-60"
                  onClick={async () => {
                    if (!window.confirm(t.admin.assistantKnowledgeReset)) return;
                    setKnowledgeSaving(true);
                    try {
                      const row = await api.resetAssistantKnowledge();
                      setKnowledge(row.content);
                      setKnowledgeMeta({ defaultLength: row.defaultLength, maxChars: row.maxChars });
                      showSuccess(t.admin.assistantKnowledgeResetDone);
                    } catch (err) {
                      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
                    } finally {
                      setKnowledgeSaving(false);
                    }
                  }}
                >
                  {t.admin.assistantKnowledgeReset}
                </button>
              </div>
            </>
          )}
        </form>
      ) : null}
    </div>
  );
}

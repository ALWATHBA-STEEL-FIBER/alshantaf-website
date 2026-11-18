import { prisma } from "../prisma";

export const DEFAULT_OPENAI_MODEL = "gpt-6-luna";
export const DEFAULT_GROQ_MODEL = "allam-2-7b";
export const DEFAULT_GROQ_GUARD_MODEL = "meta-llama/llama-prompt-guard-2-86m";
/** Low effort keeps Luna sharp for structured JSON without burning reasoning tokens. */
export const DEFAULT_OPENAI_REASONING_EFFORT = "low";
export const DEFAULT_OPENAI_MAX_COMPLETION_TOKENS = 900;
/** Match wsteelfiber website/CS flexibility (~0.55). */
export const DEFAULT_OPENAI_TEMPERATURE = 0.55;

export type AiProviderChoice = "auto" | "openai" | "groq";
export type OpenAiReasoningEffort = "none" | "low" | "medium" | "high";

export type AiConfigResolved = {
  provider: AiProviderChoice;
  openaiApiKey: string;
  openaiModel: string;
  openaiTemperature: number;
  openaiReasoningEffort: OpenAiReasoningEffort;
  openaiMaxCompletionTokens: number;
  groqApiKey: string;
  groqModel: string;
  groqTemperature: number;
  guardModel: string;
  guardThreshold: number;
  guardEnabled: boolean;
};

export type AiConfigPublic = {
  provider: AiProviderChoice;
  openaiModel: string;
  openaiTemperature: number;
  openaiReasoningEffort: OpenAiReasoningEffort;
  openaiMaxCompletionTokens: number;
  openaiKeySet: boolean;
  openaiKeyHint: string | null;
  openaiKeySource: "db" | "env" | null;
  groqModel: string;
  groqTemperature: number;
  groqKeySet: boolean;
  groqKeyHint: string | null;
  groqKeySource: "db" | "env" | null;
  guardEnabled: boolean;
  guardModel: string;
  guardThreshold: number;
  activeProvider: "openai" | "groq" | null;
  activeModel: string | null;
};

const KEYS = {
  provider: "aiProvider",
  openaiApiKey: "openaiApiKey",
  openaiModel: "openaiModel",
  openaiTemperature: "openaiTemperature",
  openaiReasoningEffort: "openaiReasoningEffort",
  openaiMaxCompletionTokens: "openaiMaxCompletionTokens",
  groqApiKey: "groqApiKey",
  groqModel: "groqModel",
  groqTemperature: "groqTemperature",
  guardEnabled: "aiGuardEnabled",
  guardModel: "aiGuardModel",
  guardThreshold: "aiGuardThreshold",
} as const;

let cache: { at: number; value: AiConfigResolved } | null = null;
const CACHE_MS = 5_000;

function clampTemp(n: number) {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULT_OPENAI_TEMPERATURE;
}

function clampThreshold(n: number) {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.85;
}

function clampMaxTokens(n: number) {
  if (!Number.isFinite(n)) return DEFAULT_OPENAI_MAX_COMPLETION_TOKENS;
  return Math.min(4000, Math.max(256, Math.round(n)));
}

function parseReasoningEffort(raw: string | undefined): OpenAiReasoningEffort {
  const v = (raw || "").trim().toLowerCase();
  if (v === "none" || v === "low" || v === "medium" || v === "high") return v;
  return DEFAULT_OPENAI_REASONING_EFFORT;
}

function maskHint(key: string | null | undefined): string | null {
  const k = key?.trim();
  if (!k) return null;
  if (k.length <= 8) return "••••";
  return `${k.slice(0, 7)}…${k.slice(-4)}`;
}

async function readDbMap(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(KEYS) } },
  });
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

function pickKey(dbValue: string | undefined, envValue: string | undefined): { key: string; source: "db" | "env" | null } {
  const db = dbValue?.trim() ?? "";
  if (db) return { key: db, source: "db" };
  const env = envValue?.trim() ?? "";
  if (env) return { key: env, source: "env" };
  return { key: "", source: null };
}

export function invalidateAiConfigCache() {
  cache = null;
}

export async function getAiConfigResolved(force = false): Promise<AiConfigResolved> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  const db = await readDbMap();
  const openai = pickKey(db[KEYS.openaiApiKey], process.env.OPENAI_API_KEY);
  const groq = pickKey(db[KEYS.groqApiKey], process.env.GROQ_API_KEY);

  const providerRaw = (db[KEYS.provider] || "openai").trim().toLowerCase();
  const provider: AiProviderChoice =
    providerRaw === "auto" || providerRaw === "groq" || providerRaw === "openai" ? providerRaw : "openai";

  const openaiTemp = clampTemp(
    Number(db[KEYS.openaiTemperature] ?? process.env.OPENAI_TEMPERATURE ?? DEFAULT_OPENAI_TEMPERATURE)
  );
  const groqTemp = clampTemp(Number(db[KEYS.groqTemperature] ?? process.env.GROQ_TEMPERATURE ?? "0.15"));
  const guardThreshold = clampThreshold(
    Number(db[KEYS.guardThreshold] ?? process.env.GROQ_GUARD_THRESHOLD ?? "0.85")
  );
  const guardEnabledRaw = (db[KEYS.guardEnabled] ?? process.env.GROQ_GUARD_ENABLED ?? "1").trim();
  const guardEnabled = guardEnabledRaw !== "0" && guardEnabledRaw !== "false";
  const maxTokens = clampMaxTokens(
    Number(
      db[KEYS.openaiMaxCompletionTokens] ??
        process.env.OPENAI_MAX_COMPLETION_TOKENS ??
        DEFAULT_OPENAI_MAX_COMPLETION_TOKENS
    )
  );

  const value: AiConfigResolved = {
    provider,
    openaiApiKey: openai.key,
    openaiModel: db[KEYS.openaiModel]?.trim() || process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    openaiTemperature: openaiTemp,
    openaiReasoningEffort: parseReasoningEffort(
      db[KEYS.openaiReasoningEffort] ?? process.env.OPENAI_REASONING_EFFORT
    ),
    openaiMaxCompletionTokens: maxTokens,
    groqApiKey: groq.key,
    groqModel: db[KEYS.groqModel]?.trim() || process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
    groqTemperature: groqTemp,
    guardModel:
      db[KEYS.guardModel]?.trim() ||
      process.env.GROQ_GUARD_MODEL?.trim() ||
      DEFAULT_GROQ_GUARD_MODEL,
    guardThreshold,
    guardEnabled,
  };

  cache = { at: Date.now(), value };
  return value;
}

export function resolveActiveProvider(cfg: AiConfigResolved): "openai" | "groq" | null {
  if (cfg.provider === "openai") return cfg.openaiApiKey ? "openai" : null;
  if (cfg.provider === "groq") return cfg.groqApiKey ? "groq" : null;
  if (cfg.openaiApiKey) return "openai";
  if (cfg.groqApiKey) return "groq";
  return null;
}

export async function getAiConfigPublic(): Promise<AiConfigPublic> {
  const db = await readDbMap();
  const openai = pickKey(db[KEYS.openaiApiKey], process.env.OPENAI_API_KEY);
  const groq = pickKey(db[KEYS.groqApiKey], process.env.GROQ_API_KEY);
  const resolved = await getAiConfigResolved(true);
  const activeProvider = resolveActiveProvider(resolved);

  return {
    provider: resolved.provider,
    openaiModel: resolved.openaiModel,
    openaiTemperature: resolved.openaiTemperature,
    openaiReasoningEffort: resolved.openaiReasoningEffort,
    openaiMaxCompletionTokens: resolved.openaiMaxCompletionTokens,
    openaiKeySet: Boolean(openai.key),
    openaiKeyHint: maskHint(openai.key),
    openaiKeySource: openai.source,
    groqModel: resolved.groqModel,
    groqTemperature: resolved.groqTemperature,
    groqKeySet: Boolean(groq.key),
    groqKeyHint: maskHint(groq.key),
    groqKeySource: groq.source,
    guardEnabled: resolved.guardEnabled,
    guardModel: resolved.guardModel,
    guardThreshold: resolved.guardThreshold,
    activeProvider,
    activeModel:
      activeProvider === "openai"
        ? resolved.openaiModel
        : activeProvider === "groq"
          ? resolved.groqModel
          : null,
  };
}

export type AiConfigPatch = {
  provider?: AiProviderChoice;
  openaiModel?: string;
  openaiTemperature?: number;
  openaiReasoningEffort?: OpenAiReasoningEffort;
  openaiMaxCompletionTokens?: number;
  openaiApiKey?: string;
  clearOpenaiApiKey?: boolean;
  groqModel?: string;
  groqTemperature?: number;
  groqApiKey?: string;
  clearGroqApiKey?: boolean;
  guardEnabled?: boolean;
  guardModel?: string;
  guardThreshold?: number;
};

async function upsert(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

async function remove(key: string) {
  await prisma.setting.deleteMany({ where: { key } });
}

export async function setAiConfig(patch: AiConfigPatch): Promise<AiConfigPublic> {
  if (patch.provider) await upsert(KEYS.provider, patch.provider);
  if (typeof patch.openaiModel === "string") await upsert(KEYS.openaiModel, patch.openaiModel.trim());
  if (typeof patch.openaiTemperature === "number") {
    await upsert(KEYS.openaiTemperature, String(clampTemp(patch.openaiTemperature)));
  }
  if (patch.openaiReasoningEffort) {
    await upsert(KEYS.openaiReasoningEffort, parseReasoningEffort(patch.openaiReasoningEffort));
  }
  if (typeof patch.openaiMaxCompletionTokens === "number") {
    await upsert(KEYS.openaiMaxCompletionTokens, String(clampMaxTokens(patch.openaiMaxCompletionTokens)));
  }
  if (patch.clearOpenaiApiKey) await remove(KEYS.openaiApiKey);
  else if (typeof patch.openaiApiKey === "string" && patch.openaiApiKey.trim()) {
    await upsert(KEYS.openaiApiKey, patch.openaiApiKey.trim());
  }

  if (typeof patch.groqModel === "string") await upsert(KEYS.groqModel, patch.groqModel.trim());
  if (typeof patch.groqTemperature === "number") {
    await upsert(KEYS.groqTemperature, String(clampTemp(patch.groqTemperature)));
  }
  if (patch.clearGroqApiKey) await remove(KEYS.groqApiKey);
  else if (typeof patch.groqApiKey === "string" && patch.groqApiKey.trim()) {
    await upsert(KEYS.groqApiKey, patch.groqApiKey.trim());
  }

  if (typeof patch.guardEnabled === "boolean") {
    await upsert(KEYS.guardEnabled, patch.guardEnabled ? "1" : "0");
  }
  if (typeof patch.guardModel === "string") await upsert(KEYS.guardModel, patch.guardModel.trim());
  if (typeof patch.guardThreshold === "number") {
    await upsert(KEYS.guardThreshold, String(clampThreshold(patch.guardThreshold)));
  }

  invalidateAiConfigCache();
  return getAiConfigPublic();
}

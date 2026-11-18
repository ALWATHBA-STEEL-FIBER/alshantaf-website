import {
  getAiConfigResolved,
  resolveActiveProvider,
  type AiConfigResolved,
} from "./aiConfig";
import { GroqRequestError, groqChatJson, scorePromptRisk, type GroqMessage } from "./groq";
import { OpenAiRequestError, openaiChatJson, type OpenAiMessage } from "./openai";

export type LlmMessage = GroqMessage | OpenAiMessage;

export class AiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public rateLimited: boolean
  ) {
    super(message);
    this.name = "AiRequestError";
  }
}

export async function getResolvedAi(): Promise<{
  cfg: AiConfigResolved;
  provider: "openai" | "groq" | null;
}> {
  const cfg = await getAiConfigResolved();
  return { cfg, provider: resolveActiveProvider(cfg) };
}

export async function aiEnabled() {
  const { provider } = await getResolvedAi();
  return provider !== null;
}

export async function activeChatModel() {
  const { cfg, provider } = await getResolvedAi();
  if (provider === "openai") return cfg.openaiModel;
  if (provider === "groq") return cfg.groqModel;
  return null;
}

export async function activeGuardModel() {
  const cfg = await getAiConfigResolved();
  if (!cfg.groqApiKey || !cfg.guardEnabled) return null;
  return cfg.guardModel;
}

export async function guardThreshold() {
  const cfg = await getAiConfigResolved();
  return cfg.guardThreshold;
}

export { scorePromptRisk };

export async function llmChatJson(params: {
  messages: LlmMessage[];
  temperature?: number;
}) {
  const { cfg, provider } = await getResolvedAi();
  if (!provider) {
    throw new AiRequestError("No AI provider configured", 503, false);
  }

  try {
    if (provider === "openai") {
      return await openaiChatJson({
        messages: params.messages as OpenAiMessage[],
        temperature: params.temperature ?? cfg.openaiTemperature,
        apiKey: cfg.openaiApiKey,
        model: cfg.openaiModel,
      });
    }
    return await groqChatJson({
      messages: params.messages as GroqMessage[],
      temperature: params.temperature ?? cfg.groqTemperature,
      apiKey: cfg.groqApiKey,
      model: cfg.groqModel,
    });
  } catch (err) {
    if (err instanceof OpenAiRequestError || err instanceof GroqRequestError) {
      throw new AiRequestError(err.message, err.status, err.rateLimited);
    }
    throw err;
  }
}

export {
  DEFAULT_OPENAI_MODEL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_GROQ_GUARD_MODEL,
} from "./aiConfig";

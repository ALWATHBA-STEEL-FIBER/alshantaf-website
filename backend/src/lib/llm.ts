import {
  groqChatJson,
  GroqRequestError,
  scorePromptRisk,
  guardThreshold,
  DEFAULT_GROQ_MODEL,
  DEFAULT_GROQ_GUARD_MODEL,
  type GroqMessage,
} from "./groq";
import {
  openaiChatJson,
  openaiConfigured,
  openaiModel,
  OpenAIRequestError,
  type ChatMessage,
} from "./openai";

export type LlmMessage = ChatMessage;

export class LlmRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public rateLimited: boolean,
    public provider: "openai" | "groq"
  ) {
    super(message);
    this.name = "LlmRequestError";
  }
}

export function llmConfigured() {
  return openaiConfigured() || Boolean(process.env.GROQ_API_KEY?.trim());
}

export function activeLlmProvider(): "openai" | "groq" | null {
  if (openaiConfigured()) return "openai";
  if (process.env.GROQ_API_KEY?.trim()) return "groq";
  return null;
}

export function activeChatModel(): string {
  const provider = activeLlmProvider();
  if (provider === "openai") return openaiModel();
  if (provider === "groq") return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  return "none";
}

export function llmStatus() {
  return {
    provider: activeLlmProvider(),
    model: activeChatModel(),
    openaiEnabled: openaiConfigured(),
    groqEnabled: Boolean(process.env.GROQ_API_KEY?.trim()),
    guardModel: process.env.GROQ_GUARD_MODEL?.trim() || DEFAULT_GROQ_GUARD_MODEL,
  };
}

export { scorePromptRisk, guardThreshold };

export async function chatJson(params: {
  messages: LlmMessage[];
  temperature?: number;
}): Promise<string> {
  const provider = activeLlmProvider();
  if (!provider) {
    throw new LlmRequestError("No LLM API key configured", 503, false, "groq");
  }

  try {
    if (provider === "openai") {
      return await openaiChatJson(params);
    }
    return await groqChatJson({
      messages: params.messages as GroqMessage[],
      temperature: params.temperature,
    });
  } catch (err) {
    if (err instanceof OpenAIRequestError) {
      throw new LlmRequestError(err.message, err.status, err.rateLimited, "openai");
    }
    if (err instanceof GroqRequestError) {
      throw new LlmRequestError(err.message, err.status, err.rateLimited, "groq");
    }
    throw err;
  }
}

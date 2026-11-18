import { DEFAULT_OPENAI_MODEL, getAiConfigResolved } from "./aiConfig";

export { DEFAULT_OPENAI_MODEL };

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export type OpenAiMessage = { role: "system" | "user" | "assistant"; content: string };

export class OpenAiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public rateLimited: boolean
  ) {
    super(message);
    this.name = "OpenAiRequestError";
  }
}

type OpenAiChatResponse = {
  choices?: Array<{
    message: {
      role: "assistant";
      content: string | null;
    };
  }>;
  error?: { message?: string; code?: string; type?: string };
};

async function openaiPost(
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs = 45_000
) {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = (await res.json().catch(() => ({}))) as OpenAiChatResponse;
  if (!res.ok || data.error) {
    const msg = data.error?.message || `OpenAI request failed (${res.status})`;
    const rateLimited =
      res.status === 429 ||
      /rate limit|tokens per|requests per|TPM|RPM/i.test(msg);
    throw new OpenAiRequestError(msg, res.status, rateLimited);
  }
  return data;
}

function isGpt6Family(model: string) {
  return /^gpt-6/i.test(model.trim());
}

export async function openaiChatJson(params: {
  messages: OpenAiMessage[];
  temperature?: number;
  apiKey?: string;
  model?: string;
}) {
  const cfg = await getAiConfigResolved();
  const apiKey = params.apiKey?.trim() || cfg.openaiApiKey;
  if (!apiKey) throw new OpenAiRequestError("OPENAI_API_KEY is not configured", 503, false);

  const model = params.model?.trim() || cfg.openaiModel || DEFAULT_OPENAI_MODEL;
  const temperature =
    typeof params.temperature === "number" && Number.isFinite(params.temperature)
      ? Math.min(1, Math.max(0, params.temperature))
      : cfg.openaiTemperature;

  // GPT-6 Luna/Sol only accept default temperature (omit the field).
  const body: Record<string, unknown> = isGpt6Family(model)
    ? {
        model,
        max_completion_tokens: cfg.openaiMaxCompletionTokens,
        reasoning_effort: cfg.openaiReasoningEffort,
        response_format: { type: "json_object" },
        messages: params.messages,
      }
    : {
        model,
        temperature,
        top_p: 0.9,
        max_tokens: cfg.openaiMaxCompletionTokens,
        response_format: { type: "json_object" },
        messages: params.messages,
      };

  const data = await openaiPost(apiKey, body, 60_000);

  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new OpenAiRequestError("Empty OpenAI response", 502, false);
  return content.trim();
}

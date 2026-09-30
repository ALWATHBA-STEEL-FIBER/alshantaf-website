const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/** Efficient high-volume OpenAI model for the site assistant. */
export const DEFAULT_OPENAI_MODEL = "gpt-6-luna";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class OpenAIRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public rateLimited: boolean
  ) {
    super(message);
    this.name = "OpenAIRequestError";
  }
}

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
    };
  }>;
  error?: { message?: string; code?: string; type?: string };
};

function apiKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new OpenAIRequestError("OPENAI_API_KEY is not configured", 503, false);
  return key;
}

export function openaiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function openaiModel() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export function openaiReasoningEffort() {
  const raw = (process.env.OPENAI_REASONING_EFFORT || "none").trim().toLowerCase();
  const allowed = new Set(["none", "low", "medium", "high", "xhigh", "max"]);
  return allowed.has(raw) ? raw : "none";
}

async function openaiPost(body: Record<string, unknown>, timeoutMs = 45_000) {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = (await res.json().catch(() => ({}))) as OpenAIChatResponse;
  if (!res.ok || data.error) {
    const msg = data.error?.message || `OpenAI request failed (${res.status})`;
    const rateLimited =
      res.status === 429 || /rate limit|tokens per|requests per|RPM|TPM/i.test(msg);
    throw new OpenAIRequestError(msg, res.status, rateLimited);
  }
  return data;
}

/** JSON-object chat completion for the assistant planner. */
export async function openaiChatJson(params: {
  messages: ChatMessage[];
  temperature?: number;
}) {
  const data = await openaiPost(
    {
      model: openaiModel(),
      temperature: params.temperature ?? 0.3,
      max_completion_tokens: 1200,
      reasoning_effort: openaiReasoningEffort(),
      response_format: { type: "json_object" },
      messages: params.messages,
    },
    60_000
  );

  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new OpenAIRequestError("Empty OpenAI response", 502, false);
  return content.trim();
}

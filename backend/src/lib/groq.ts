import {
  DEFAULT_GROQ_GUARD_MODEL,
  DEFAULT_GROQ_MODEL,
  getAiConfigResolved,
} from "./aiConfig";

export { DEFAULT_GROQ_GUARD_MODEL, DEFAULT_GROQ_MODEL };

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export type GroqMessage = { role: "system" | "user" | "assistant"; content: string };

export class GroqRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public rateLimited: boolean
  ) {
    super(message);
    this.name = "GroqRequestError";
  }
}

type GroqChatResponse = {
  choices?: Array<{
    message: {
      role: "assistant";
      content: string | null;
    };
  }>;
  error?: { message?: string; code?: string; type?: string };
};

async function groqPost(
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs = 20_000
) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = (await res.json().catch(() => ({}))) as GroqChatResponse;
  if (!res.ok || data.error) {
    const msg = data.error?.message || `Groq request failed (${res.status})`;
    const rateLimited =
      res.status === 429 ||
      /rate limit|tokens per|requests per|RPD|TPM/i.test(msg);
    throw new GroqRequestError(msg, res.status, rateLimited);
  }
  return data;
}

/**
 * Llama Prompt Guard 2 — returns jailbreak/injection risk in [0, 1].
 * Fail-open: on any API/network error returns 0 so the user still gets a reply.
 */
export async function scorePromptRisk(userText: string): Promise<{ score: number; skipped: boolean }> {
  const cfg = await getAiConfigResolved();
  if (!cfg.guardEnabled || !cfg.groqApiKey) return { score: 0, skipped: true };

  try {
    const data = await groqPost(
      cfg.groqApiKey,
      {
        model: cfg.guardModel || DEFAULT_GROQ_GUARD_MODEL,
        temperature: 0,
        max_completion_tokens: 16,
        messages: [{ role: "user", content: userText.slice(0, 2000) }],
      },
      8_000
    );
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "0";
    const score = Number.parseFloat(raw);
    if (!Number.isFinite(score)) return { score: 0, skipped: true };
    return { score: Math.min(1, Math.max(0, score)), skipped: false };
  } catch {
    return { score: 0, skipped: true };
  }
}

export async function guardThreshold() {
  const cfg = await getAiConfigResolved();
  return cfg.guardThreshold;
}

export async function groqChatJson(params: {
  messages: GroqMessage[];
  temperature?: number;
  apiKey?: string;
  model?: string;
}) {
  const cfg = await getAiConfigResolved();
  const apiKey = params.apiKey?.trim() || cfg.groqApiKey;
  if (!apiKey) throw new GroqRequestError("GROQ_API_KEY is not configured", 503, false);

  const model = params.model?.trim() || cfg.groqModel || DEFAULT_GROQ_MODEL;
  const temperature =
    typeof params.temperature === "number" && Number.isFinite(params.temperature)
      ? Math.min(1, Math.max(0, params.temperature))
      : cfg.groqTemperature;

  const data = await groqPost(
    apiKey,
    {
      model,
      temperature,
      top_p: 0.85,
      max_completion_tokens: 650,
      response_format: { type: "json_object" },
      messages: params.messages,
    },
    45_000
  );

  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new GroqRequestError("Empty Groq response", 502, false);
  return content.trim();
}

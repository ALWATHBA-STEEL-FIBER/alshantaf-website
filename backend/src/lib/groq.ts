const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Highest chat RPD among conversational Groq models for this account (~7K/day). */
export const DEFAULT_GROQ_MODEL = "allam-2-7b";

/** Prompt-injection classifier — ~14.4K RPD; returns a risk score, not chat text. */
export const DEFAULT_GROQ_GUARD_MODEL = "meta-llama/llama-prompt-guard-2-86m";

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

function apiKey() {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw new GroqRequestError("GROQ_API_KEY is not configured", 503, false);
  return key;
}

async function groqPost(body: Record<string, unknown>, timeoutMs = 20_000) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
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
  const enabled = process.env.GROQ_GUARD_ENABLED !== "0";
  if (!enabled) return { score: 0, skipped: true };

  try {
    const model = process.env.GROQ_GUARD_MODEL?.trim() || DEFAULT_GROQ_GUARD_MODEL;
    const data = await groqPost(
      {
        model,
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

export function guardThreshold() {
  const n = Number(process.env.GROQ_GUARD_THRESHOLD ?? "0.85");
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.85;
}

export async function groqChatJson(params: {
  messages: GroqMessage[];
  temperature?: number;
}) {
  const model = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  const data = await groqPost(
    {
      model,
      temperature: params.temperature ?? 0.3,
      max_completion_tokens: 900,
      response_format: { type: "json_object" },
      messages: params.messages,
    },
    45_000
  );

  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new GroqRequestError("Empty Groq response", 502, false);
  return content.trim();
}

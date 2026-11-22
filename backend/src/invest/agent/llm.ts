/**
 * LLM + speech client for the admin investment assistant.
 * Uses the same provider keys as the site (Admin → AI config) but its own model settings,
 * prompts and storage: nothing here reads or writes the public website assistant's data.
 */
import { getAiConfigResolved } from "../../lib/aiConfig";

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ChatMsg =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

export type ToolSpec = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export class AgentLlmError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

type Provider = {
  kind: "openai" | "groq";
  base: string;
  key: string;
  model: string;
  reasoning: string | null;
  vision: boolean;
};

const OPENAI_BASE = "https://api.openai.com/v1";
const GROQ_BASE = "https://api.groq.com/openai/v1";

async function provider(): Promise<Provider> {
  const cfg = await getAiConfigResolved();
  const pref = (process.env.INVEST_AGENT_PROVIDER || "").trim().toLowerCase();
  const useOpenAi = cfg.openaiApiKey && pref !== "groq";
  if (useOpenAi) {
    const model = process.env.INVEST_AGENT_MODEL?.trim() || cfg.openaiModel;
    return {
      kind: "openai",
      base: OPENAI_BASE,
      key: cfg.openaiApiKey,
      model,
      // Chat Completions only allows function tools with reasoning_effort "none" on GPT-6.
      reasoning: /^(gpt-6|gpt-5|o\d)/i.test(model) ? process.env.INVEST_AGENT_REASONING?.trim() || "none" : null,
      vision: true,
    };
  }
  if (cfg.groqApiKey) {
    return {
      kind: "groq",
      base: GROQ_BASE,
      key: cfg.groqApiKey,
      model: process.env.INVEST_AGENT_GROQ_MODEL?.trim() || "openai/gpt-oss-120b",
      reasoning: null,
      vision: false,
    };
  }
  throw new AgentLlmError("لم يتم إعداد مفتاح ذكاء اصطناعي (الإعدادات ← الذكاء الاصطناعي)", 503);
}

export async function agentAvailable() {
  try {
    await provider();
    return true;
  } catch {
    return false;
  }
}

export async function agentSupportsVision() {
  try {
    return (await provider()).vision;
  } catch {
    return false;
  }
}

async function post(p: Provider, pathName: string, body: unknown, timeoutMs: number) {
  const res = await fetch(`${p.base}${pathName}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok || data.error) {
    const msg = data.error?.message || `AI request failed (${res.status})`;
    console.error("[invest-agent] llm error", res.status, msg);
    throw new AgentLlmError(res.status === 429 ? "خدمة الذكاء الاصطناعي مشغولة، حاول بعد قليل" : "تعذّر الاتصال بخدمة الذكاء الاصطناعي", res.status === 429 ? 429 : 502);
  }
  return data;
}

/** One chat-completions turn with tools. Returns the assistant message. */
export async function agentChat(messages: ChatMsg[], tools: ToolSpec[]) {
  const p = await provider();
  const body: Record<string, unknown> = {
    model: p.model,
    messages: p.vision ? messages : stripImages(messages),
    tools,
    tool_choice: "auto",
    max_completion_tokens: Number(process.env.INVEST_AGENT_MAX_TOKENS) || 4000,
  };
  if (p.reasoning) body.reasoning_effort = p.reasoning;
  else body.temperature = 0.2;
  if (p.kind === "openai") body.parallel_tool_calls = false;
  const data = (await post(p, "/chat/completions", body, 90_000)) as {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
  };
  const m = data.choices?.[0]?.message;
  if (!m) throw new AgentLlmError("رد فارغ من خدمة الذكاء الاصطناعي");
  return { content: m.content ?? "", toolCalls: (m.tool_calls ?? []).filter((t) => t.type === "function") };
}

function stripImages(messages: ChatMsg[]): ChatMsg[] {
  return messages.map((m) =>
    m.role === "user" && Array.isArray(m.content)
      ? {
          role: "user",
          content: m.content
            .map((c) => (c.type === "text" ? c.text : "[صورة مرفقة — لا يمكن قراءتها بهذا النموذج]"))
            .join("\n"),
        }
      : m
  );
}

/** Speech → text (Arabic first). */
export async function transcribeAudio(buf: Buffer, mime: string, filename: string) {
  const p = await provider();
  const models =
    p.kind === "openai"
      ? [process.env.INVEST_AGENT_STT_MODEL?.trim() || "gpt-4o-transcribe", "whisper-1"]
      : [process.env.INVEST_AGENT_GROQ_STT_MODEL?.trim() || "whisper-large-v3-turbo"];
  let lastErr = "";
  for (const model of [...new Set(models)]) {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buf)], { type: mime }), filename);
    form.append("model", model);
    form.append("language", "ar");
    form.append(
      "prompt",
      "محادثة عن مشاريع أراضي وشركاء في الأردن: دينار، دفعة أولى، مصاريف، تسجيل، قطعة، حوض، منسق، رأس مال."
    );
    const res = await fetch(`${p.base}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.key}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    const data = (await res.json().catch(() => ({}))) as { text?: string; error?: { message?: string } };
    if (res.ok && typeof data.text === "string") return data.text.trim();
    lastErr = data.error?.message || String(res.status);
    console.error("[invest-agent] stt error", model, lastErr);
  }
  throw new AgentLlmError("تعذّر تحويل الصوت إلى نص");
}

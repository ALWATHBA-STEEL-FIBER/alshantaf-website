import fs from "fs";
import path from "path";
import type { GroqMessage } from "./groq";

const PACK_VERSION = "2026-09-30";

type KnowledgeChunk = {
  id: string;
  title: string;
  body: string;
  haystack: string;
};

type TrainingExample = {
  user: string;
  assistant: string;
  haystack: string;
};

type PackCache = {
  systemPrompt: string;
  chunks: KnowledgeChunk[];
  examples: TrainingExample[];
  loadedAt: number;
};

let cache: PackCache | null = null;

function knowledgeRoot(): string {
  // Runtime: dist/lib → ../../knowledge ; Dev (tsx): src/lib → ../../knowledge
  const candidates = [
    path.join(__dirname, "..", "..", "knowledge"),
    path.join(process.cwd(), "knowledge"),
    path.join(process.cwd(), "backend", "knowledge"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "01-SYSTEM-PROMPT-AR.txt"))) return dir;
  }
  return candidates[0];
}

function readUtf8(file: string): string {
  try {
    return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").trim();
  } catch {
    return "";
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}+]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function scoreOverlap(queryTokens: string[], haystack: string): number {
  if (!queryTokens.length || !haystack) return 0;
  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += token.length >= 4 ? 2 : 1;
  }
  return score;
}

function splitKnowledgeSections(md: string): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  const parts = md.split(/\n(?=##\s+)/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith("##")) continue;
    const nl = trimmed.indexOf("\n");
    const title = (nl >= 0 ? trimmed.slice(0, nl) : trimmed).replace(/^##\s+/, "").trim();
    const body = (nl >= 0 ? trimmed.slice(nl + 1) : "").trim();
    if (!body) continue;
    const idMatch = title.match(/^(K\d+)/i);
    chunks.push({
      id: idMatch?.[1] ?? title.slice(0, 24),
      title,
      body,
      haystack: `${title}\n${body}`.toLowerCase(),
    });
  }
  return chunks;
}

function parseTrainingExamples(jsonl: string): TrainingExample[] {
  const out: TrainingExample[] = [];
  for (const line of jsonl.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as {
        messages?: Array<{ role?: string; content?: string }>;
      };
      const messages = row.messages ?? [];
      // Prefer the first user/assistant turn (single-turn examples dominate the pack).
      const user = messages.find((m) => m.role === "user")?.content?.trim();
      const assistant = messages.find((m) => m.role === "assistant")?.content?.trim();
      if (!user || !assistant) continue;
      out.push({
        user,
        assistant,
        haystack: `${user}\n${assistant}`.toLowerCase(),
      });
    } catch {
      // skip bad lines
    }
  }
  return out;
}

function loadPack(): PackCache {
  if (cache) return cache;
  const root = knowledgeRoot();
  const systemPrompt = readUtf8(path.join(root, "01-SYSTEM-PROMPT-AR.txt"));
  const kb = readUtf8(path.join(root, "02-KNOWLEDGE-BASE-AR.md"));
  const sources = readUtf8(path.join(root, "07-SOURCES-AND-VERIFICATION.md"));
  const jsonl = readUtf8(path.join(root, "04-TRAINING-EXAMPLES.jsonl"));

  const chunks = [
    ...splitKnowledgeSections(kb),
    ...splitKnowledgeSections(sources).map((c) => ({
      ...c,
      id: `SRC-${c.id}`,
      title: `مصدر — ${c.title}`,
    })),
  ];

  cache = {
    systemPrompt:
      systemPrompt ||
      "أنت مساعد الشنتف للعقار والاستثمار. أجب بمهنية من السياق الموثق فقط.",
    chunks,
    examples: parseTrainingExamples(jsonl),
    loadedAt: Date.now(),
  };
  return cache;
}

/** Exposed for status / ops checks. */
export function knowledgePackStatus() {
  const pack = loadPack();
  return {
    version: PACK_VERSION,
    systemPromptChars: pack.systemPrompt.length,
    chunks: pack.chunks.length,
    examples: pack.examples.length,
    root: knowledgeRoot(),
  };
}

export function retrieveKnowledgeContext(query: string, maxChars = 5500): string {
  const pack = loadPack();
  if (!pack.chunks.length) return "";

  const tokens = tokenize(query);
  const ranked = pack.chunks
    .map((chunk) => ({ chunk, score: scoreOverlap(tokens, chunk.haystack) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked: KnowledgeChunk[] =
    ranked.length > 0
      ? ranked.slice(0, 5).map((r) => r.chunk)
      : pack.chunks.filter((c) => /^K0[1-4]\b/i.test(c.id)).slice(0, 3);

  let out = "";
  for (const chunk of picked) {
    const block = `### ${chunk.title}\n${chunk.body}\n\n`;
    if (out.length + block.length > maxChars) {
      const room = maxChars - out.length - 40;
      if (room > 200) out += block.slice(0, room) + "…\n";
      break;
    }
    out += block;
  }
  return out.trim();
}

export function selectFewShotMessages(query: string, limit = 4): GroqMessage[] {
  const pack = loadPack();
  if (!pack.examples.length) return [];

  const tokens = tokenize(query);
  const ranked = pack.examples
    .map((ex, index) => ({
      ex,
      index,
      score: scoreOverlap(tokens, ex.haystack),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const chosen =
    ranked[0]?.score > 0
      ? ranked.slice(0, limit).map((r) => r.ex)
      : pack.examples.slice(0, Math.min(limit, 3));

  const messages: GroqMessage[] = [];
  for (const ex of chosen) {
    messages.push({ role: "user", content: ex.user });
    messages.push({
      role: "assistant",
      content: JSON.stringify({
        reply: ex.assistant,
        service_id: null,
        offer_query: null,
      }),
    });
  }
  return messages;
}

export function getPackSystemPrompt(): string {
  return loadPack().systemPrompt;
}

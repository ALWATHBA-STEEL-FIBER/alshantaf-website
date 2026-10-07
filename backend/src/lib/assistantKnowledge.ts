import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../prisma";

export const ASSISTANT_KNOWLEDGE_KEY = "assistantMasterKnowledge";
export const ASSISTANT_KNOWLEDGE_MAX_CHARS = 160_000;
const PROMPT_BUDGET_CHARS = 10_000;
const ALWAYS_INCLUDE_CHARS = 3_200;

let fileDefaultCache: string | null = null;
let dbCache: { value: string; at: number } | null = null;

function loadBundledDefault(): string {
  if (fileDefaultCache) return fileDefaultCache;
  const candidates = [
    join(process.cwd(), "src/knowledge/alshantaf-industrial-master-ar.txt"),
    join(__dirname, "../knowledge/alshantaf-industrial-master-ar.txt"),
    join(__dirname, "../../src/knowledge/alshantaf-industrial-master-ar.txt"),
  ];
  for (const path of candidates) {
    try {
      fileDefaultCache = readFileSync(path, "utf8").replace(/^\uFEFF/, "").trim();
      if (fileDefaultCache) return fileDefaultCache;
    } catch {
      /* try next */
    }
  }
  fileDefaultCache = "";
  return fileDefaultCache;
}

export function defaultAssistantKnowledge(): string {
  return loadBundledDefault();
}

export function invalidateAssistantKnowledgeCache() {
  dbCache = null;
}

export async function getAssistantKnowledge(): Promise<string> {
  if (dbCache && Date.now() - dbCache.at < 30_000) return dbCache.value;
  const row = await prisma.setting.findUnique({ where: { key: ASSISTANT_KNOWLEDGE_KEY } });
  const value = (row?.value?.trim() ? row.value : loadBundledDefault()).trim();
  dbCache = { value, at: Date.now() };
  return value;
}

export async function setAssistantKnowledge(raw: string): Promise<string> {
  const value = raw.replace(/\r\n/g, "\n").trim();
  if (value.length > ASSISTANT_KNOWLEDGE_MAX_CHARS) {
    throw new Error(`Knowledge text exceeds ${ASSISTANT_KNOWLEDGE_MAX_CHARS} characters`);
  }
  await prisma.setting.upsert({
    where: { key: ASSISTANT_KNOWLEDGE_KEY },
    create: { key: ASSISTANT_KNOWLEDGE_KEY, value },
    update: { value },
  });
  dbCache = { value, at: Date.now() };
  return value;
}

export async function resetAssistantKnowledge(): Promise<string> {
  const value = loadBundledDefault();
  await prisma.setting.upsert({
    where: { key: ASSISTANT_KNOWLEDGE_KEY },
    create: { key: ASSISTANT_KNOWLEDGE_KEY, value },
    update: { value },
  });
  dbCache = { value, at: Date.now() };
  return value;
}

function splitSections(text: string): string[] {
  const parts = text.split(/\n(?=(?:\d{2}\s*\|)|(?:القسم\s))/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function scoreSection(section: string, query: string): number {
  const q = query.toLowerCase();
  if (!q) return 0;
  const hay = section.toLowerCase();
  let score = 0;
  for (const token of q.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3)) {
    if (hay.includes(token)) score += 2 + Math.min(token.length, 8);
  }
  return score;
}

/** Inject identity + query-matched slices so Groq stays within context. */
export async function knowledgeForPrompt(userText: string): Promise<string> {
  const full = await getAssistantKnowledge();
  if (!full) return "";
  const sections = splitSections(full);
  if (!sections.length) return full.slice(0, PROMPT_BUDGET_CHARS);

  const head = sections[0].slice(0, ALWAYS_INCLUDE_CHARS);
  const scored = sections
    .slice(1)
    .map((section) => ({ section, score: scoreSection(section, userText) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked: string[] = [head];
  let used = head.length;
  for (const row of scored) {
    if (picked.length >= 8) break;
    if (used + row.section.length + 8 > PROMPT_BUDGET_CHARS) {
      const room = PROMPT_BUDGET_CHARS - used - 8;
      if (room > 400) {
        picked.push(row.section.slice(0, room));
        used += room;
      }
      break;
    }
    picked.push(row.section);
    used += row.section.length + 8;
  }

  if (picked.length === 1 && sections.length > 1) {
    for (const extra of sections.slice(1, 4)) {
      if (used + extra.length > PROMPT_BUDGET_CHARS) break;
      picked.push(extra);
      used += extra.length;
    }
  }

  return picked.join("\n\n---\n\n");
}

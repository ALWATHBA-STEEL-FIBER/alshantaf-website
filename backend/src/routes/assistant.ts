import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import {
  buildSystemPrompt,
  listServices,
  listingDigestForPrompt,
  searchOffers,
  type OfferCardPayload,
  type ServiceCardPayload,
} from "../lib/assistantCatalog";
import { blockedPromptReply, buildFallbackReply } from "../lib/assistantFallback";
import {
  getPackSystemPrompt,
  knowledgePackStatus,
  retrieveKnowledgeContext,
  selectFewShotMessages,
} from "../lib/assistantKnowledge";
import {
  DEFAULT_GROQ_GUARD_MODEL,
  DEFAULT_GROQ_MODEL,
  GroqRequestError,
  groqChatJson,
  guardThreshold,
  scorePromptRisk,
  type GroqMessage,
} from "../lib/groq";

export const assistantRouter = Router();

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

const bodySchema = z.object({
  lang: z.enum(["ar", "en"]).default("ar"),
  messages: z.array(messageSchema).min(1).max(16),
});

export type AssistantCard =
  | { type: "offer"; offer: OfferCardPayload }
  | { type: "service"; service: ServiceCardPayload };

const VALID_SERVICES = new Set([
  "opportunities",
  "offers",
  "publish",
  "land-check",
  "track",
  "my-offer",
  "contact",
  "services",
  "gov-dls",
  "gov-jfda",
  "gov-env",
]);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // Never fail the user — soft degrade with a deterministic reply.
  handler: (req, res) => {
    const lang = req.body?.lang === "en" ? "en" : "ar";
    const [service] = listServices(lang, ["contact"]);
    res.status(200).json({
      reply:
        lang === "ar"
          ? "لحظة من فضلك — الطلبات كثيرة الآن. يمكنك التواصل معنا مباشرة من البطاقة أدناه، أو أعد المحاولة بعد قليل."
          : "One moment — traffic is high right now. Contact us from the card below, or try again shortly.",
      cards: service ? [{ type: "service" as const, service }] : [],
      degraded: true,
    });
  },
});

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeServiceId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toLowerCase().replace(/_/g, "-");
  if (!cleaned || cleaned === "null" || cleaned === "none") return null;
  for (const part of cleaned.split(/[|,/\s]+/)) {
    const id = part.trim();
    if (VALID_SERVICES.has(id)) return id;
  }
  return VALID_SERVICES.has(cleaned) ? cleaned : null;
}

async function cardsFromPlan(plan: Record<string, unknown>, lang: "ar" | "en"): Promise<{
  reply: string;
  cards: AssistantCard[];
}> {
  const reply =
    typeof plan.reply === "string" && plan.reply.trim()
      ? plan.reply.trim()
      : lang === "ar"
        ? "كيف يمكنني مساعدتك؟"
        : "How can I help?";

  const cards: AssistantCard[] = [];
  const offerQuery = plan.offer_query;

  if (offerQuery && typeof offerQuery === "object" && !Array.isArray(offerQuery)) {
    const q = offerQuery as Record<string, unknown>;
    const listingNos = Array.isArray(q.listing_nos)
      ? q.listing_nos.filter((n): n is string => typeof n === "string")
      : Array.isArray(q.listingNos)
        ? q.listingNos.filter((n): n is string => typeof n === "string")
        : undefined;
    const offers = await searchOffers({
      q: typeof q.q === "string" ? q.q : undefined,
      area: typeof q.area === "string" ? q.area : undefined,
      industryType: typeof q.industryType === "string" ? q.industryType : undefined,
      listingNos,
      limit: typeof q.limit === "number" ? q.limit : 2,
    });
    for (const offer of offers.slice(0, 2)) {
      cards.push({ type: "offer", offer });
    }
  }

  const serviceId = normalizeServiceId(plan.service_id ?? plan.serviceId);
  if (serviceId) {
    const [service] = listServices(lang, [serviceId]);
    if (service) cards.push({ type: "service", service });
  }

  return { reply, cards };
}

assistantRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    res.json({
      enabled: true,
      model: process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
      guardModel: process.env.GROQ_GUARD_MODEL?.trim() || DEFAULT_GROQ_GUARD_MODEL,
      aiEnabled: Boolean(process.env.GROQ_API_KEY?.trim()),
      knowledge: knowledgePackStatus(),
    });
  })
);

assistantRouter.post(
  "/chat",
  limiter,
  asyncHandler(async (req, res) => {
    const body = bodySchema.parse(req.body);
    const last = body.messages[body.messages.length - 1];
    if (last.role !== "user") {
      res.status(400).json({ error: "Last message must be from the user" });
      return;
    }

    // 1) Prompt Guard (14.4K RPD) — block obvious jailbreaks; fail-open on guard errors.
    if (process.env.GROQ_API_KEY?.trim()) {
      const { score, skipped } = await scorePromptRisk(last.content);
      if (!skipped && score >= guardThreshold()) {
        const blocked = blockedPromptReply(body.lang);
        res.json({ ...blocked, guarded: true });
        return;
      }
    }

    // 2) No API key → deterministic helper still works (offers/services from DB).
    if (!process.env.GROQ_API_KEY?.trim()) {
      const fallback = await buildFallbackReply(last.content, body.lang);
      res.json(fallback);
      return;
    }

    // 3) AI chat — on rate limit / any failure, never surface an error to the user.
    try {
      const digest = await listingDigestForPrompt(body.lang);
      const knowledgeContext = retrieveKnowledgeContext(last.content);
      const fewShots = selectFewShotMessages(last.content, 4);
      const history: GroqMessage[] = [
        {
          role: "system",
          content: buildSystemPrompt(body.lang, digest, {
            packSystemPrompt: getPackSystemPrompt(),
            knowledgeContext,
          }),
        },
        ...fewShots,
        ...body.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ];

      const raw = await groqChatJson({ messages: history });
      const plan = extractJsonObject(raw);

      if (!plan) {
        const fallback = await buildFallbackReply(last.content, body.lang);
        res.json(fallback);
        return;
      }

      const { reply, cards } = await cardsFromPlan(plan, body.lang);
      res.json({ reply, cards });
    } catch (err) {
      const fallback = await buildFallbackReply(last.content, body.lang);
      res.json({
        ...fallback,
        degraded: true,
        reason: err instanceof GroqRequestError && err.rateLimited ? "rate_limit" : "ai_unavailable",
      });
    }
  })
);

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import {
  buildSystemPrompt,
  extractListingNos,
  listServices,
  listingDigestForPrompt,
  searchOffers,
  searchOffersForUserText,
  type OfferCardPayload,
  type ServiceCardPayload,
} from "../lib/assistantCatalog";
import { blockedPromptReply, buildFallbackReply } from "../lib/assistantFallback";
import { detectNavServiceIntent, isNonBrowseServiceIntent, isPublishIntent } from "../lib/assistantIntent";
import { developerCreditReply, isDeveloperCreditQuestion } from "../lib/devSignature";
import { knowledgeForPrompt } from "../lib/assistantKnowledge";
import {
  AiRequestError,
  activeChatModel,
  activeGuardModel,
  aiEnabled,
  guardThreshold,
  llmChatJson,
  scorePromptRisk,
  type LlmMessage,
} from "../lib/llm";

export const assistantRouter = Router();

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

const bodySchema = z.object({
  lang: z.enum(["ar", "en"]).default("ar"),
  messages: z.array(messageSchema).min(1).max(16),
  context: z
    .object({
      offer: z
        .object({
          id: z.string().trim().min(1).max(128),
          listingNo: z.string().trim().min(1).max(64),
          title: z.string().trim().min(1).max(220),
          area: z.string().trim().min(1).max(120),
          industryType: z.string().trim().min(1).max(64),
          dealType: z.string().trim().min(1).max(64),
          status: z.string().trim().min(1).max(64),
          size: z.string().trim().max(120).optional().nullable(),
          price: z.string().trim().max(120).optional().nullable(),
          description: z.string().trim().max(600).optional(),
        })
        .optional(),
    })
    .optional(),
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

function mergeOffers(...groups: OfferCardPayload[][]) {
  const seen = new Set<string>();
  const out: OfferCardPayload[] = [];
  for (const group of groups) {
    for (const offer of group) {
      if (seen.has(offer.id)) continue;
      seen.add(offer.id);
      out.push(offer);
      if (out.length >= 3) return out;
    }
  }
  return out;
}

function looksEmptyOfOffers(reply: string) {
  return /لا توجد|لم أجد|ما في|ما فيش|no (published|matching|available)?\s*offers?|sorry/i.test(reply);
}

function sizeHint(lang: "ar" | "en", mode: "approx" | "min" | null) {
  if (mode === "min") {
    return lang === "ar"
      ? "هذه عروض بمساحة طلبك فأكثر، من العروض المنشورة حاليًا."
      : "These published offers meet your minimum size (this size and larger).";
  }
  if (mode === "approx") {
    return lang === "ar"
      ? "المساحة تقريبية: إن طلبت نحو 2 دونم قد أظهر 1.7 أو 3 إن كانت الأقرب المتاح."
      : "Size is approximate: a 2-dunum ask can include 1.7 or 3 if those are the closest live offers.";
  }
  return null;
}

/** Strip invented LST codes and prefer grounded, card-backed wording. */
function groundReply(
  reply: string,
  lang: "ar" | "en",
  offers: OfferCardPayload[],
  allowedListingNos: Set<string>
): string {
  let text = reply.trim();
  const mentioned = extractListingNos(text);
  for (const code of mentioned) {
    if (!allowedListingNos.has(code)) {
      text = text.replace(new RegExp(`\\b${code}\\b`, "gi"), lang === "ar" ? "أحد العروض المتاحة" : "an available offer");
    }
  }

  // Soften common hallucinated urgency / certainty phrases.
  text = text
    .replace(/آخر قطعة|آخر فرصة|مضمون(?:ة)?(?: الربح)?|السعر (?:سيرتفع|يرتفع) غدًا/gi, "")
    .replace(/\blast (?:plot|parcel|chance)\b|\bguaranteed returns?\b|\bprice will (?:go|rise) tomorrow\b/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (offers.length && looksEmptyOfOffers(text)) {
    const nos = offers.map((o) => o.listingNo).join(lang === "ar" ? "، " : ", ");
    text =
      lang === "ar"
        ? `وجدت عروضًا منشورة تناسب بحثك (${nos}). التفاصيل في البطاقات أدناه.`
        : `I found published offers that fit your search (${nos}). Details are in the cards below.`;
  }

  return text || (lang === "ar" ? "كيف يمكنني مساعدتك؟" : "How can I help?");
}

function navServiceGuideReply(lang: "ar" | "en", serviceId: string, planReply?: string) {
  const [service] = listServices(lang, [serviceId]);
  const mentioningOffers =
    typeof planReply === "string" &&
    (/وجدت عروض|إليك .*العروض|here are (?:offers|the closest)|found (?:offers|two|three)/i.test(planReply) ||
      looksEmptyOfOffers(planReply));
  const fallbacks: Record<string, { ar: string; en: string }> = {
    publish: {
      ar: "لنشر أرضك أو فرصتك ابدأ من طلب النشر كمالك أو وسيط؛ بعد الإرسال يراجع الفريق الطلب قبل اعتماده. البطاقة تحت تفتح النموذج.",
      en: "To list your land or opportunity, start a publish request as an owner or broker; after you submit, the team reviews it before it goes live. The card below opens the form.",
    },
    "land-check": {
      ar: "تقدر تفحص المساحة والقيمة الإدارية والملاءمة الأولية من فحص الأرض — بدون نشر عرض. افتح البطاقة تحت وكمّل بيانات القطعة.",
      en: "You can check area, administrative value, and initial zoning fit from land check — without publishing. Open the card below and enter the parcel details.",
    },
    track: {
      ar: "لتتبع طلب النشر أدخل رمز التتبع اللي وصلك بعد الإرسال من صفحة التتبع. إذا الرمز مش معك، راجعي إيميلك أو تواصل معنا.",
      en: "To track a publish request, enter the tracking code you received after submitting. If you don’t have it, check your email or contact us.",
    },
    "my-offer": {
      ar: "إدارة عرضك المنشور تتم من بوابة المالك برمز الوصول الخاص فيك. البطاقة تحت تفتح البوابة.",
      en: "Manage your published listing from the owner portal with your access code. The card below opens the portal.",
    },
  };
  const fb = fallbacks[serviceId];
  const reply =
    typeof planReply === "string" && planReply.trim() && !mentioningOffers
      ? planReply.trim()
      : lang === "ar"
        ? fb?.ar || "هذه الخطوة الأنسب لطلبك — افتح البطاقة للمتابعة."
        : fb?.en || "This is the best next step for your request — open the card to continue.";
  return {
    reply,
    cards: (service ? [{ type: "service" as const, service }] : []) as AssistantCard[],
  };
}

async function cardsFromPlan(
  plan: Record<string, unknown>,
  lang: "ar" | "en",
  userText: string,
  digestListingNos: Set<string>
): Promise<{
  reply: string;
  cards: AssistantCard[];
}> {
  const planServiceId = normalizeServiceId(plan.service_id ?? plan.serviceId);
  const navId = detectNavServiceIntent(userText) || planServiceId;
  if (navId && isNonBrowseServiceIntent(userText)) {
    return navServiceGuideReply(lang, navId, typeof plan.reply === "string" ? plan.reply : undefined);
  }
  if (planServiceId === "publish" || isPublishIntent(userText)) {
    return navServiceGuideReply(lang, "publish", typeof plan.reply === "string" ? plan.reply : undefined);
  }

  let reply =
    typeof plan.reply === "string" && plan.reply.trim()
      ? plan.reply.trim()
      : lang === "ar"
        ? "كيف يمكنني مساعدتك؟"
        : "How can I help?";

  const cards: AssistantCard[] = [];
  const offerQuery = plan.offer_query;
  let planOffers: OfferCardPayload[] = [];

  if (offerQuery && typeof offerQuery === "object" && !Array.isArray(offerQuery)) {
    const q = offerQuery as Record<string, unknown>;
    const listingNos = Array.isArray(q.listing_nos)
      ? q.listing_nos.filter((n): n is string => typeof n === "string")
      : Array.isArray(q.listingNos)
        ? q.listingNos.filter((n): n is string => typeof n === "string")
        : undefined;
    // Drop hallucinated listing numbers before DB lookup.
    const safeNos = listingNos?.map((n) => n.trim().toUpperCase()).filter((n) => digestListingNos.has(n));
    planOffers = await searchOffers({
      q: typeof q.q === "string" ? q.q : undefined,
      area: typeof q.area === "string" ? q.area : undefined,
      industryType: typeof q.industryType === "string" ? q.industryType : undefined,
      listingNos: safeNos?.length ? safeNos : undefined,
      limit: typeof q.limit === "number" ? q.limit : 3,
    });
  }

  const live = await searchOffersForUserText(userText, {
    area: offerQuery && typeof offerQuery === "object" && !Array.isArray(offerQuery) && typeof (offerQuery as { area?: unknown }).area === "string"
      ? (offerQuery as { area: string }).area
      : undefined,
    q: offerQuery && typeof offerQuery === "object" && !Array.isArray(offerQuery) && typeof (offerQuery as { q?: unknown }).q === "string"
      ? (offerQuery as { q: string }).q
      : undefined,
    limit: 3,
  });

  const offers = live.intent.wantsOffers || planOffers.length
    ? mergeOffers(live.offers, planOffers)
    : planOffers;

  for (const offer of offers) {
    cards.push({ type: "offer", offer });
  }

  const allowed = new Set([...digestListingNos, ...offers.map((o) => o.listingNo.toUpperCase())]);
  reply = groundReply(reply, lang, offers, allowed);

  if (offers.length && live.intent.size) {
    const hint = sizeHint(lang, live.intent.size.mode);
    if (hint && !reply.includes(hint.slice(0, 18))) {
      reply = `${reply}\n\n${hint}`;
    }
  }

  if (planServiceId) {
    const [service] = listServices(lang, [planServiceId]);
    if (service) cards.push({ type: "service", service });
  } else if (live.intent.wantsOffers && !offers.length) {
    const [service] = listServices(lang, ["opportunities"]);
    if (service) cards.push({ type: "service", service });
  }

  return { reply, cards };
}

assistantRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const [model, guardModel, enabled] = await Promise.all([
      activeChatModel(),
      activeGuardModel(),
      aiEnabled(),
    ]);
    res.json({
      enabled: true,
      model,
      guardModel,
      aiEnabled: enabled,
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

    // 1) Prompt Guard (Groq classifier when a Groq key is available) — fail-open on errors.
    {
      const { score, skipped } = await scorePromptRisk(last.content);
      const threshold = await guardThreshold();
      if (!skipped && score >= threshold) {
        const blocked = blockedPromptReply(body.lang);
        res.json({ ...blocked, guarded: true });
        return;
      }
    }

    // 2) Craft credit — hard layer under the editable playbook (never in admin knowledge UI).
    if (isDeveloperCreditQuestion(last.content)) {
      res.json({ reply: developerCreditReply(body.lang), cards: [] });
      return;
    }

    // 3) No AI provider → deterministic helper still works (offers/services from DB).
    if (!(await aiEnabled())) {
      const fallback = await buildFallbackReply(last.content, body.lang);
      res.json(fallback);
      return;
    }

    // 4) AI chat (OpenAI preferred, else Groq) — never surface provider errors to the user.
    try {
      const digest = await listingDigestForPrompt(body.lang);
      const digestListingNos = new Set(extractListingNos(digest));
      const knowledge = await knowledgeForPrompt(last.content, body.lang);
      const history: LlmMessage[] = [
        { role: "system", content: buildSystemPrompt(body.lang, digest, body.context?.offer, knowledge) },
        ...body.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ];

      const raw = await llmChatJson({ messages: history });
      const plan = extractJsonObject(raw);

      if (!plan) {
        const fallback = await buildFallbackReply(last.content, body.lang);
        res.json(fallback);
        return;
      }

      const { reply, cards } = await cardsFromPlan(plan, body.lang, last.content, digestListingNos);
      res.json({ reply, cards });
    } catch (err) {
      const fallback = await buildFallbackReply(last.content, body.lang);
      res.json({
        ...fallback,
        degraded: true,
        reason: err instanceof AiRequestError && err.rateLimited ? "rate_limit" : "ai_unavailable",
      });
    }
  })
);

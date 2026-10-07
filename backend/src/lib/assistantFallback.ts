import { listServices, searchOffersForUserText, type AssistantLang, type OfferCardPayload, type ServiceCardPayload } from "./assistantCatalog";
import { detectArea } from "./assistantIntent";
import { developerCreditReply, isDeveloperCreditQuestion } from "./devSignature";

export type FallbackCard =
  | { type: "offer"; offer: OfferCardPayload }
  | { type: "service"; service: ServiceCardPayload };

function detectServiceId(text: string): string | null {
  if (/تتبع|tracking|track\b/i.test(text)) return "track";
  if (/فحص|تنظيم|land[- ]?check|regulation/i.test(text)) return "land-check";
  if (/أنشر|انشر|نشر|publish|مالك|وسيط|owner|broker/i.test(text)) return "publish";
  if (/بوابة|my[- ]?offer|رمز الوصول|access code/i.test(text)) return "my-offer";
  if (/تواصل|اتصل|contact|واتساب|whatsapp|دعم|support/i.test(text)) return "contact";
  if (/خدم/i.test(text) || /\bservices?\b/i.test(text)) return "services";
  if (/قيمة إدارية|دائرة الأراضي|\bdls\b/i.test(text)) return "gov-dls";
  if (/غذاء|دواء|\bjfda\b/i.test(text)) return "gov-jfda";
  if (/بيئة|environment|moenv/i.test(text)) return "gov-env";
  if (/فرص|عروض|أراض|ارض|أرض|industrial|offers?|opportunit/i.test(text)) return "opportunities";
  return null;
}

/** Deterministic assistant used when Groq chat is unavailable or rate-limited. */
export async function buildFallbackReply(
  userText: string,
  lang: AssistantLang
): Promise<{ reply: string; cards: FallbackCard[]; degraded: true }> {
  if (isDeveloperCreditQuestion(userText)) {
    return { reply: developerCreditReply(lang), cards: [], degraded: true };
  }

  const { offers, intent } = await searchOffersForUserText(userText, { limit: 3 });
  const cards: FallbackCard[] = [];
  const area = intent.area || detectArea(userText);

  if (intent.wantsOffers) {
    if (offers.length) {
      for (const offer of offers) cards.push({ type: "offer", offer });
      const sizeNote =
        intent.size?.mode === "min"
          ? lang === "ar"
            ? " هذه العروض بمساحة طلبك فأكثر."
            : " These offers are your size and larger."
          : intent.size
            ? lang === "ar"
              ? " المساحة تقريبية من العروض المنشورة حاليًا."
              : " Size is approximate from currently published offers."
            : "";
      const reply =
        lang === "ar"
          ? area
            ? `وجدت عروضًا قد تناسب بحثك في ${area}.${sizeNote} يمكنك فتح التفاصيل أو التواصل عبر واتساب.`
            : `إليك أقرب العروض المتاحة حاليًا.${sizeNote} يمكنك فتح التفاصيل أو التواصل عبر واتساب.`
          : area
            ? `Here are offers that may match your search in ${area}.${sizeNote} Open details or reach us on WhatsApp.`
            : `Here are the closest available offers.${sizeNote} Open details or reach us on WhatsApp.`;
      const [service] = listServices(lang, ["opportunities"]);
      if (service) cards.push({ type: "service", service });
      return { reply, cards, degraded: true };
    }

    const [service] = listServices(lang, ["opportunities"]);
    if (service) cards.push({ type: "service", service });
    const reply =
      lang === "ar"
        ? area
          ? `عذرًا، لا توجد عروض منشورة حاليًا في ${area} ضمن المساحة المطلوبة. يمكنك استعراض الفرص الأخرى من البطاقة أدناه.`
          : "عذرًا، لم أجد عرضًا مطابقًا الآن. يمكنك استعراض الفرص المتاحة من البطاقة أدناه."
        : area
          ? `Sorry — no published offers in ${area} at that size right now. Browse other opportunities below.`
          : "Sorry — no matching offer right now. Browse available opportunities below.";
    return { reply, cards, degraded: true };
  }

  const serviceId = detectServiceId(userText) ?? "contact";
  const [service] = listServices(lang, [serviceId]);
  if (service) cards.push({ type: "service", service });

  const reply =
    lang === "ar"
      ? "يمكنني توجيهك داخل الموقع. هذه الخدمة الأنسب لطلبك — أخبرني إن احتجت خيارًا آخر."
      : "I can guide you on this site. Here’s the best next step for your request — ask if you want another option.";

  return { reply, cards, degraded: true };
}

export function blockedPromptReply(lang: AssistantLang): { reply: string; cards: FallbackCard[] } {
  const [service] = listServices(lang, ["contact"]);
  return {
    reply:
      lang === "ar"
        ? "لا أستطيع تنفيذ هذا الطلب. إذا كنت تبحث عن فرصة أو خدمة على موقع الشنتف، صِغ سؤالك بشكل مباشر أو تواصل مع الفريق."
        : "I can’t help with that request. If you’re looking for an Alshantaf offer or service, ask directly or contact the team.",
    cards: service ? [{ type: "service", service }] : [],
  };
}

import { prisma } from "../prisma";
import { parseAreaSqm, sqmToDunums } from "./areaParse";
import { developerCreditLayer } from "./devSignature";
import { parseOfferIntent, sizeRank, type SizeFilter } from "./assistantIntent";
import { serializeListing } from "./serialize";

export type AssistantLang = "ar" | "en";

export type ServiceCardPayload = {
  id: string;
  title: string;
  note: string;
  href: string;
  cta: string;
  external?: boolean;
};

export type OfferCardPayload = {
  id: string;
  listingNo: string;
  title: string;
  area: string;
  price: string | null;
  size: string | null;
  status: string;
  industryType: string;
  dealType: string;
  mainImage: string | null;
  featured: boolean;
  phone: string | null;
  description: string;
};

const SERVICES_AR: ServiceCardPayload[] = [
  {
    id: "opportunities",
    title: "استعراض الفرص الصناعية",
    note: "تصفّح الأراضي والعروض الصناعية المنشورة مع التفاصيل والموقع وحالة العرض.",
    href: "/opportunities",
    cta: "عرض الفرص",
  },
  {
    id: "offers",
    title: "كل العروض",
    note: "قائمة كاملة بالعروض المتاحة مع فلاتر المنطقة والصناعة والحالة.",
    href: "/offers",
    cta: "تصفح العروض",
  },
  {
    id: "publish",
    title: "نشر أرضك أو فرصتك",
    note: "قدّم عرضك كمالك أو وسيط ليُراجع ويعتمد قبل النشر على المنصة.",
    href: "/request-publish",
    cta: "ابدأ الطلب",
  },
  {
    id: "land-check",
    title: "فحص الأرض والتنظيم",
    note: "افحص المساحة والقيمة الإدارية والسعر الاسترشادي وما يناسب التصنيف التنظيمي — دون نشر عرض.",
    href: "/land-check",
    cta: "افحص أرضك",
  },
  {
    id: "track",
    title: "تتبع طلب النشر",
    note: "أدخل رمز التتبع لمتابعة حالة طلبك بعد الإرسال.",
    href: "/track",
    cta: "تتبع الطلب",
  },
  {
    id: "my-offer",
    title: "بوابة مالك العرض",
    note: "إدارة عرضك المنشور عبر رمز الوصول الخاص بالمالك.",
    href: "/my-offer",
    cta: "فتح البوابة",
  },
  {
    id: "contact",
    title: "استفسارات عامة ودعم",
    note: "تواصل مع فريق الشنتف لأي استفسار حول الأراضي الصناعية أو المنصة.",
    href: "/contact",
    cta: "تواصل معنا",
  },
  {
    id: "services",
    title: "صفحة الخدمات",
    note: "نظرة شاملة على خدمات الشنتف والأدوات الحكومية المرتبطة.",
    href: "/services",
    cta: "عرض الخدمات",
  },
  {
    id: "gov-dls",
    title: "القيمة الإدارية للأراضي",
    note: "دائرة الأراضي والمساحة — الاستعلام عن القيمة الإدارية المعتمدة.",
    href: "https://apex-dls.dls.gov.jo/ords/f?p=104:2",
    cta: "فتح البوابة",
    external: true,
  },
  {
    id: "gov-jfda",
    title: "مؤسسة الغذاء والدواء",
    note: "التراخيص والاشتراطات للأنشطة الغذائية والدوائية.",
    href: "https://www.jfda.jo/",
    cta: "زيارة الموقع",
    external: true,
  },
  {
    id: "gov-env",
    title: "تصاريح البيئة",
    note: "وزارة البيئة — التصاريح والاشتراطات البيئية للمشاريع الصناعية.",
    href: "https://env-per.moenv.gov.jo",
    cta: "زيارة الموقع",
    external: true,
  },
];

const SERVICES_EN: ServiceCardPayload[] = [
  {
    id: "opportunities",
    title: "Browse industrial opportunities",
    note: "Explore published industrial land offers with details, location, and status.",
    href: "/opportunities",
    cta: "View opportunities",
  },
  {
    id: "offers",
    title: "All offers",
    note: "Full listing grid with area, industry, and status filters.",
    href: "/offers",
    cta: "Browse offers",
  },
  {
    id: "publish",
    title: "Publish your land or opportunity",
    note: "Submit as an owner or broker for review before it goes live.",
    href: "/request-publish",
    cta: "Start request",
  },
  {
    id: "land-check",
    title: "Land & regulation check",
    note: "Check area, administrative value, indicative pricing, and zoning fit — without publishing.",
    href: "/land-check",
    cta: "Check land",
  },
  {
    id: "track",
    title: "Track a publish request",
    note: "Enter your tracking code to follow request status.",
    href: "/track",
    cta: "Track request",
  },
  {
    id: "my-offer",
    title: "Owner offer portal",
    note: "Manage your published offer with the owner access code.",
    href: "/my-offer",
    cta: "Open portal",
  },
  {
    id: "contact",
    title: "General inquiries & support",
    note: "Reach the Alshantaf team about industrial land or the platform.",
    href: "/contact",
    cta: "Contact us",
  },
  {
    id: "services",
    title: "Services page",
    note: "Overview of Alshantaf services and related government tools.",
    href: "/services",
    cta: "View services",
  },
  {
    id: "gov-dls",
    title: "DLS administrative land value",
    note: "Official Department of Lands & Survey administrative value lookup.",
    href: "https://apex-dls.dls.gov.jo/ords/f?p=104:2",
    cta: "Open portal",
    external: true,
  },
  {
    id: "gov-jfda",
    title: "Jordan FDA",
    note: "Licensing and requirements for food and pharmaceutical activities.",
    href: "https://www.jfda.jo/",
    cta: "Visit site",
    external: true,
  },
  {
    id: "gov-env",
    title: "Environment permits",
    note: "Ministry of Environment permits for industrial projects.",
    href: "https://env-per.moenv.gov.jo",
    cta: "Visit site",
    external: true,
  },
];

const SERVICE_ALIASES: Record<string, string> = {
  land_check: "land-check",
  landcheck: "land-check",
  "land check": "land-check",
  request_publish: "publish",
  "request-publish": "publish",
  publish_request: "publish",
  owner: "my-offer",
  "my_offer": "my-offer",
  myoffer: "my-offer",
  dls: "gov-dls",
  "gov_dls": "gov-dls",
  jfda: "gov-jfda",
  "gov_jfda": "gov-jfda",
  env: "gov-env",
  environment: "gov-env",
  "gov_env": "gov-env",
  opportunities_page: "opportunities",
  contact_us: "contact",
};

function normalizeServiceId(raw: string) {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "-");
  return SERVICE_ALIASES[key] ?? SERVICE_ALIASES[raw.trim().toLowerCase()] ?? key;
}

export function listServices(lang: AssistantLang, ids?: string[]): ServiceCardPayload[] {
  const all = lang === "ar" ? SERVICES_AR : SERVICES_EN;
  // One service card at a time — take the first requested id only.
  if (!ids?.length) return all.filter((s) => s.id === "opportunities").slice(0, 1);
  for (const raw of ids) {
    const id = normalizeServiceId(raw);
    const match = all.find((s) => s.id === id);
    if (match) return [match];
  }
  return all.filter((s) => s.id === "contact").slice(0, 1);
}

type PromptOfferContext = {
  id: string;
  listingNo: string;
  title: string;
  area: string;
  industryType: string;
  dealType: string;
  status: string;
  size?: string | null;
  price?: string | null;
  description?: string;
};

export function serviceCatalogForPrompt(lang: AssistantLang) {
  const all = lang === "ar" ? SERVICES_AR : SERVICES_EN;
  const when =
    lang === "ar"
      ? ({
          opportunities: "بحث عن فرص منشورة",
          offers: "تصفح كل العروض/فلاتر",
          publish: "مالك/وسيط يريد نشر أرضه",
          "land-check": "فحص قطعة قبل القرار — بلا نشر",
          track: "تتبع طلب نشر برمز",
          "my-offer": "إدارة عرض منشور برمز وصول",
          contact: "استفسار عام / دعم بشري",
          services: "نظرة خدمات المنصة",
          "gov-dls": "قيمة إدارية رسمية",
          "gov-jfda": "تراخيص غذاء/دواء",
          "gov-env": "تصاريح بيئة",
        } as Record<string, string>)
      : ({
          opportunities: "browse published opportunities",
          offers: "all listings / filters",
          publish: "owner/broker wants to list land",
          "land-check": "check a parcel before deciding — no listing",
          track: "track a publish request by code",
          "my-offer": "manage a live listing with access code",
          contact: "general inquiry / human support",
          services: "platform services overview",
          "gov-dls": "official administrative value",
          "gov-jfda": "food/drug licensing",
          "gov-env": "environment permits",
        } as Record<string, string>);
  return all
    .map((s) => `- ${s.id}: ${s.title} → ${s.href} (${when[s.id] || s.note})`)
    .join("\n");
}

function toOfferCard(listing: ReturnType<typeof serializeListing>): OfferCardPayload {
  return {
    id: listing.id,
    listingNo: listing.listingNo,
    title: listing.title,
    area: listing.area,
    price: listing.price,
    size: listing.size,
    status: listing.status,
    industryType: listing.industryType,
    dealType: listing.dealType,
    mainImage: listing.mainImage,
    featured: listing.featured,
    phone: listing.phone,
    description: listing.description.slice(0, 220),
  };
}

export async function searchOffers(opts: {
  q?: string;
  area?: string;
  industryType?: string;
  listingNos?: string[];
  size?: SizeFilter | null;
  limit?: number;
}): Promise<OfferCardPayload[]> {
  const limit = Math.min(Math.max(opts.limit ?? 3, 1), 4);
  const listings = await prisma.listing.findMany({
    where: {
      publishStatus: "published",
      status: { notIn: ["canceled", "sold"] },
      ...(opts.industryType ? { industryType: opts.industryType as never } : {}),
      ...(opts.listingNos?.length
        ? { listingNo: { in: opts.listingNos.map((n) => n.trim().toUpperCase()) } }
        : {}),
    },
    include: { media: true },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    take: 48,
  });

  const areaNeedle = opts.area?.trim().toLowerCase();
  const qNeedle = opts.q?.trim().toLowerCase();

  const ranked = listings
    .map((row) => {
      const listing = serializeListing(row);
      const area = listing.area.toLowerCase();
      const blob =
        `${listing.title} ${listing.listingNo} ${listing.area} ${listing.village || ""} ${listing.basin || ""} ${listing.parcel || ""} ${listing.description}`.toLowerCase();
      if (areaNeedle && !area.includes(areaNeedle) && !blob.includes(areaNeedle) && !opts.size) {
        return null;
      }
      if (qNeedle && !blob.includes(qNeedle) && !opts.size && !areaNeedle && !opts.listingNos?.length) {
        return null;
      }
      const sizePenalty = sizeRank(opts.size ?? null, listing.size);
      if (!Number.isFinite(sizePenalty)) return null;
      let score = sizePenalty;
      if (areaNeedle && (area.includes(areaNeedle) || blob.includes(areaNeedle))) score -= 40;
      if (listing.importance === "titanium" || listing.featured) score -= 8;
      else if (listing.importance === "platinum") score -= 5;
      else if (listing.importance === "golden") score -= 3;
      return { card: toOfferCard(listing), score };
    })
    .filter((row): row is { card: OfferCardPayload; score: number } => row != null)
    .sort((a, b) => a.score - b.score);

  if (ranked.length) return ranked.slice(0, limit).map((row) => row.card);

  if (opts.area || opts.size) {
    const loose = listings
      .map((row) => {
        const listing = serializeListing(row);
        const sizePenalty = sizeRank(opts.size ?? null, listing.size);
        if (!Number.isFinite(sizePenalty)) return null;
        return { card: toOfferCard(listing), score: sizePenalty - (listing.featured ? 8 : 0) };
      })
      .filter((row): row is { card: OfferCardPayload; score: number } => row != null)
      .sort((a, b) => a.score - b.score);
    return loose.slice(0, limit).map((row) => row.card);
  }

  return listings.slice(0, limit).map((row) => toOfferCard(serializeListing(row)));
}

export async function searchOffersForUserText(
  text: string,
  extra?: { listingNos?: string[]; q?: string; area?: string; limit?: number }
) {
  const intent = parseOfferIntent(text);
  const offers = await searchOffers({
    area: extra?.area || intent.area || undefined,
    q: extra?.q,
    listingNos: extra?.listingNos,
    size: intent.size,
    limit: extra?.limit ?? 3,
  });
  return { offers, intent };
}

/** Live listing codes are SH-AREA-#### (legacy LST- kept for safety). */
export const LISTING_NO_RE = /\b(?:SH-[A-Z]{2,5}-\d{3,5}|LST-[A-Z0-9]+)\b/gi;

export function extractListingNos(text: string): string[] {
  return [...text.matchAll(LISTING_NO_RE)].map((m) => m[0].toUpperCase());
}

export async function listingDigestForPrompt(lang: AssistantLang) {
  const listings = await prisma.listing.findMany({
    where: { publishStatus: "published", status: { notIn: ["canceled", "sold"] } },
    select: {
      listingNo: true,
      title: true,
      area: true,
      village: true,
      basin: true,
      parcel: true,
      price: true,
      size: true,
      industryType: true,
      dealType: true,
      status: true,
      featured: true,
      importance: true,
      description: true,
    },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    // Know every live land — catalog is small; do not truncate.
    take: 200,
  });

  if (!listings.length) {
    return lang === "ar" ? "لا توجد عروض منشورة حاليًا." : "No published offers right now.";
  }

  const header =
    lang === "ar"
      ? "SH | العنوان | المنطقة | القرية | الحوض | القطعة | المساحة | دونم | السعر | الصناعة | الصفقة | الحالة | نبذة"
      : "SH | title | area | village | basin | parcel | size | dunum | price | industry | deal | status | note";

  const rows = listings.map((l) => {
    const sqm = parseAreaSqm(l.size);
    const dunum = sqm ? sqmToDunums(sqm).toFixed(2) : "-";
    const tier =
      l.importance && l.importance !== "none"
        ? ` | ${l.importance}`
        : l.featured
          ? " | titanium"
          : "";
    const note = (l.description || "").replace(/\s+/g, " ").trim().slice(0, 90);
    return `${l.listingNo} | ${l.title} | ${l.area} | ${l.village || "-"} | ${l.basin || "-"} | ${l.parcel || "-"} | ${l.size || "-"} | ${dunum} | ${l.price || "-"} | ${l.industryType} | ${l.dealType} | ${l.status}${tier} | ${note || "-"}`;
  });

  return [header, ...rows].join("\n");
}

export function buildSystemPrompt(
  lang: AssistantLang,
  digest: string,
  offerContext?: PromptOfferContext,
  knowledge = ""
) {
  const services = serviceCatalogForPrompt(lang);
  const schema = `{"reply":"string","service_id":"opportunities|offers|publish|land-check|track|my-offer|contact|services|gov-dls|gov-jfda|gov-env|null","offer_query":{"area":"string|null","q":"string|null","listing_nos":["SH-…"]|null,"limit":3}|null}`;
  const knowledgeBlock = knowledge.trim()
    ? lang === "ar"
      ? `\nمرجع داخلي للإدارة (لا ترسله كاملًا للزائر؛ طبّق قواعده على الرد):\n${knowledge.trim()}\n`
      : `\nInternal admin playbook (do not paste it to the visitor; follow it for answers):\n${knowledge.trim()}\n`
    : "";
  const craftLayer = developerCreditLayer(lang);
  const contextBlock = offerContext
    ? lang === "ar"
      ? `\nسياق صفحة المستخدم الحالية (مرجعية مباشرة للإجابة):\n${offerContext.listingNo} | ${offerContext.title} | ${offerContext.area} | ${offerContext.size || "-"} | ${offerContext.price || "-"} | ${offerContext.industryType} | ${offerContext.dealType} | ${offerContext.status}\n${offerContext.description ? `وصف مختصر: ${offerContext.description}` : ""}`
      : `\nCurrent page context (direct reference for answers):\n${offerContext.listingNo} | ${offerContext.title} | ${offerContext.area} | ${offerContext.size || "-"} | ${offerContext.price || "-"} | ${offerContext.industryType} | ${offerContext.dealType} | ${offerContext.status}\n${offerContext.description ? `Short description: ${offerContext.description}` : ""}`
    : "";

  if (lang === "ar") {
    return `أنت مساعد خدمة عملاء الشنتف للاستثمار العقاري الصناعي في الأردن (ALSHANTAF INVEST).

الهوية والأسلوب (نفس مرونة مساعد الوثبة ستيل فايبر):
- مساعد خدمة عملاء فقط — قصير، دافئ، واثق، بلهجة أردنية واتساب طبيعية عند المناسبة.
- مو منشور تسويقي ولا روبوت ولا قوائم جامدة. فكرة واحدة لكل رد غالبًا.
- حشوات طبيعية لما تناسب اللحظة (لا تجبرها كل رسالة): تمام، أكيد، إن شاء الله، طبعا.
- جاوب على السؤال أولًا؛ غيّر الصياغة كل مرة. اسأل سؤال متابعة واحد فقط إن نقص معلومة جوهرية — وغالبًا لا تسأل.
- واثق بالحقائق الموجودة في الملخص؛ تردّد ناعم فقط للمجهول الحقيقي.

أرجع JSON فقط (لا Markdown خارج الحقول). الشكل:
${schema}

قبل الرد صنّف حالة الزائر ذهنيًا:
A) يبحث عن فرصة/أرض / يسأل عن أراضينا → offer_query + بطاقات عروض (إلزامي عند ذكر منطقة/مساحة/أرض)
B) يريد نشر أرضه → publish فقط
C) فحص/تنظيم → land-check
D) تتبع طلب → track
E) إدارة عرضه → my-offer
F) معلومة سوق/قيمة/جهة حكومية → اشرح + service_id المناسب
G) ضائع في الموقع → خطوة تنقل واحدة

قواعد ملزمة:
1) لغة reply = لغة آخر رسالة للمستخدم.
2) مصادر الحقائق فقط: ملخص العروض + سياق الصفحة + المرجع الداخلي + خريطة الموقع. إن جهلت قل ذلك بصدق.
3) ممنوع اختلاق رقم عرض SH-/سعر/مساحة/هاتف/منطقة غير موجودة في الملخص.
4) نشر/إضافة عرض: service_id=publish و offer_query=null — لا تعرض عروض الآخرين.
5) عندما يسأل عن أراض/عروض/منطقة: عبّئ offer_query (area أو listing_nos من الملخص، حد 3) حتى تظهر البطاقات.
6) المساحة التقريبية مقابل «فأكثر» كما في المرجع.
7) سياق صفحة العرض الحالي أولوية عند السؤال عنه.
8) طبقة المطوّر أدناه فقط لسؤال «من طوّر هذا»؛ لا تنقلها في الرد.
9) لا مبالغة («مضمون / آخر فرصة»). لا تسرد كل الخدمات.

معرّفات الخدمات ومتى تُستخدم:
${services}

${knowledgeBlock}
${craftLayer}
${contextBlock}

عروض منشورة حاليًا — اعرفها كلها؛ المصدر الوحيد للعروض (لا تضف غيرها):
${digest}`;
  }

  return `You are the Alshantaf Invest customer-service assistant for industrial real estate in Jordan.

IDENTITY & VOICE (same flexibility as the Al Wathba Steel Fiber assistant):
- Customer-service AI only — short, warm, confident. Arabic: natural Jordanian WhatsApp. English: clear and helpful.
- No brochure tone, no robotic lists. Usually one idea per reply.
- Natural fillers when they fit (don’t force every message). Answer first; vary wording every turn.
- Ask at most ONE follow-up, and only if a key fact is missing — often ask none.
- State digest facts confidently; soft uncertainty only for true unknowns.

Return ONLY JSON (no markdown outside fields). Shape:
${schema}

Mentally classify the visitor case first:
A) Looking for land/opportunity / asking about our lands → offer_query + offer cards (required when area/size/land is mentioned)
B) Wants to post their land → publish only
C) Parcel/zoning check → land-check
D) Track a submission → track
E) Manage their listing → my-offer
F) Market/admin-value/gov question → explain + matching service_id
G) Lost on the site → one navigation step

Hard rules:
1) reply language = latest user message language.
2) Facts only from offer digest + page context + playbook + site map. If unsure, say so honestly.
3) Never invent SH- listing codes / price / size / phone / area not in the digest.
4) Post/publish/list their land: service_id=publish and offer_query=null — do not show other people’s listings.
5) When they ask about lands/offers/an area: fill offer_query (area or listing_nos from digest, max 3) so cards appear.
6) Approximate vs minimum size rules as in playbook.
7) Current page offer context wins for questions about that offer.
8) Developer layer below only for “who built this”; never quote it.
9) No hype (“guaranteed / last chance”). Don’t dump every service.

Service IDs and when to use them:
${services}

${knowledgeBlock}
${craftLayer}
${contextBlock}

Published offers right now — know all of them; only source (invent none):
${digest}`;
}

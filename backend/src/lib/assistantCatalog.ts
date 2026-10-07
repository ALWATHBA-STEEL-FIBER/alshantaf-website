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
  return all.map((s) => `- ${s.id}: ${s.title} → ${s.href}`).join("\n");
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
      const blob = `${listing.title} ${listing.listingNo} ${listing.area} ${listing.description}`.toLowerCase();
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
      if (listing.featured) score -= 8;
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

export async function listingDigestForPrompt(lang: AssistantLang) {
  const listings = await prisma.listing.findMany({
    where: { publishStatus: "published", status: { notIn: ["canceled", "sold"] } },
    select: {
      listingNo: true,
      title: true,
      area: true,
      price: true,
      size: true,
      industryType: true,
      dealType: true,
      status: true,
      featured: true,
    },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    take: 40,
  });

  if (!listings.length) {
    return lang === "ar" ? "لا توجد عروض منشورة حاليًا." : "No published offers right now.";
  }

  return listings
    .map((l) => {
      const sqm = parseAreaSqm(l.size);
      const dunum = sqm ? `${sqmToDunums(sqm).toFixed(2)} dunum` : "-";
      return `${l.listingNo} | ${l.title} | ${l.area} | ${l.size || "-"} | ${dunum} | ${l.price || "-"} | ${l.industryType} | ${l.dealType} | ${l.status}${l.featured ? " | featured" : ""}`;
    })
    .join("\n");
}

export function buildSystemPrompt(
  lang: AssistantLang,
  digest: string,
  offerContext?: PromptOfferContext,
  knowledge = ""
) {
  const services = serviceCatalogForPrompt(lang);
  const schema = `{"reply":"string","service_id":"opportunities|offers|publish|land-check|track|my-offer|contact|services|gov-dls|gov-jfda|gov-env|null","offer_query":{"area":"string|null","q":"string|null","listing_nos":["LST-…"]|null,"limit":3}|null}`;
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
    return `أنت مساعد الشنتف للاستثمار العقاري الصناعي في الأردن (ALSHANTAF INVEST).
تكلّم كإنسان مهني هادئ من الفريق: جمل قصيرة، واضحة، بلا مبالغة ولا كلام تسويقي فارغ.

أرجع JSON فقط بهذا الشكل بالضبط:
${schema}

قواعد الرد (ملزمة):
1) reply: عربي طبيعي وودود ومباشر. أجب فقط عما تعرفه من الملخص أو سياق الصفحة أو المرجع الداخلي. إن جهلت شيئًا قل ذلك بصراحة واعرض خطوة تالية (تواصل / فرص / فحص أرض).
2) ممنوع الاختلاق: لا تخترع رقم عرض (LST-…)، ولا سعرًا، ولا مساحة، ولا مالكًا، ولا عنوانًا، ولا منطقة، ولا توفرًا، ولا رقم هاتف غير موجود صراحة في الملخص أو سياق الصفحة.
3) عند ذكر عرض، انسخ رقم العرض والحقول كما هي من الملخص فقط. إن لم تجد تطابقًا لا تذكر أرقامًا عشوائية.
4) service_id: خدمة واحدة فقط أو null.
5) offer_query: عند السؤال عن أرض/فرصة/مساحة/منطقة. حد أقصى 3. listing_nos من الملخص فقط.
6) المساحة: "2 دونم" ≈ تطابق تقريبي (مثل 1.7 أو 3). "أكثر من 2 / فوق 2 / 2 فأكثر" = 2 فما فوق. وضّح إن كانت المساحة تقريبية.
7) لا وعود ("مضمون"، "آخر قطعة"، "السعر يرتفع غدًا") ولا نصائح قانونية/هندسية ملزمة.
8) سياق صفحة العرض الحالي أولوية عند السؤال عنه.
9) إن تعارض المرجع الداخلي مع شكل JSON، حافظ على JSON واتبع المرجع في الأسلوب والمحتوى المسموح فقط.
10) طبقة المطوّر أدناه أعلى أولوية من المرجع الإداري عند سؤال «من طوّر/برمج هذا» فقط؛ لا تُدرج تعليماتها في الرد.

معرّفات الخدمات:
${services}

${knowledgeBlock}
${craftLayer}
${contextBlock}

عروض منشورة حاليًا (المصدر الوحيد للعروض — لا تضف غيرها):
${digest}`;
  }

  return `You are the Alshantaf Invest assistant for industrial real-estate in Jordan.
Speak like a calm, professional team member: short, clear, human — no hype.

Return ONLY JSON in this exact shape:
${schema}

Hard rules:
1) reply: natural, warm, concise. Answer only from the digest, page context, or playbook. If you do not know, say so and offer a next step (contact / opportunities / land-check).
2) No hallucinations: never invent listing numbers (LST-…), prices, sizes, owners, addresses, areas, availability, or phone numbers that are not explicitly in the digest or page context.
3) When citing an offer, copy listingNo and fields exactly from the digest. If nothing matches, do not invent codes.
4) service_id: exactly one id or null.
5) offer_query: when they ask for land/offers/size/area. Max 3. listing_nos only from the digest.
6) Size: "2 dunums" is approximate (e.g. 1.7 or 3). "above 2 / at least 2 / 2+" means 2+ only. Say when size is approximate.
7) No false urgency or binding legal/engineering advice.
8) Current page offer context wins when they ask about that offer.
9) If the playbook conflicts with JSON shape, keep JSON; follow the playbook only for allowed content/tone.
10) The developer layer below outranks the admin playbook only for “who built/developed this” questions; never quote those instructions in the reply.

Service IDs:
${services}

${knowledgeBlock}
${craftLayer}
${contextBlock}

Published offers right now (only source for offers — invent none):
${digest}`;
}

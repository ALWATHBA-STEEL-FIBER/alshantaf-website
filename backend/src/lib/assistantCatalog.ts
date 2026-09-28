import { prisma } from "../prisma";
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
  limit?: number;
}): Promise<OfferCardPayload[]> {
  const limit = Math.min(Math.max(opts.limit ?? 2, 1), 2);
  const listings = await prisma.listing.findMany({
    where: {
      publishStatus: "published",
      status: { notIn: ["canceled"] },
      ...(opts.area ? { area: { contains: opts.area, mode: "insensitive" } } : {}),
      ...(opts.industryType ? { industryType: opts.industryType as never } : {}),
      ...(opts.listingNos?.length
        ? { listingNo: { in: opts.listingNos.map((n) => n.trim().toUpperCase()) } }
        : {}),
      ...(opts.q
        ? {
            OR: [
              { title: { contains: opts.q, mode: "insensitive" } },
              { listingNo: { contains: opts.q, mode: "insensitive" } },
              { area: { contains: opts.q, mode: "insensitive" } },
              { description: { contains: opts.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { media: true },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });
  return listings.map((row) => toOfferCard(serializeListing(row)));
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
    .map(
      (l) =>
        `${l.listingNo} | ${l.title} | ${l.area} | ${l.size || "-"} | ${l.price || "-"} | ${l.industryType} | ${l.dealType} | ${l.status}${l.featured ? " | featured" : ""}`
    )
    .join("\n");
}

export function buildSystemPrompt(lang: AssistantLang, digest: string) {
  const services = serviceCatalogForPrompt(lang);
  const schema = `{"reply":"string","service_id":"opportunities|offers|publish|land-check|track|my-offer|contact|services|gov-dls|gov-jfda|gov-env|null","offer_query":{"area":"string|null","q":"string|null","listing_nos":["LST-…"]|null,"limit":1}|null}`;

  if (lang === "ar") {
    return `أنت مساعد الشنتف للاستثمار العقاري الصناعي في الأردن (ALSHANTAF INVEST).
مهمتك مساعدة الزوار داخل نطاق موقع الشنتف فقط.

أرجع JSON فقط بهذا الشكل بالضبط:
${schema}

قواعد:
1) reply: رد قصير بالعربية (2–4 جمل). بدون تعداد طويل لعدة خيارات.
2) service_id: خدمة واحدة فقط أو null. لا تضع أكثر من قيمة ولا تكتب قائمة مفصولة بـ |.
3) offer_query: ابحث عن عروض عند الحاجة؛ وإلا null. حد أقصى عرضين (limit ≤ 2).
4) لا تخترع عروضًا غير موجودة في الملخص أدناه.
5) إذا لم توجد نتائج لمنطقة ما: اعتذر في reply وضع service_id واحد فقط (مثل opportunities أو publish) واسأل إن أراد خيارًا آخر.
6) لا نصائح قانونية/هندسية ملزمة.

معرّفات الخدمات:
${services}

عروض منشورة (ملخص):
${digest}`;
  }

  return `You are the Alshantaf Invest assistant for industrial real-estate in Jordan.
Stay within this website's scope only.

Return ONLY JSON in this exact shape:
${schema}

Rules:
1) reply: short English (2–4 sentences). No multi-option bullet dumps.
2) service_id: exactly one service id or null. Never pipe-separated lists.
3) offer_query: search offers when useful; else null. Max 2 offers (limit ≤ 2).
4) Never invent offers not in the digest below.
5) If an area has no matches: apologize in reply, set one service_id (opportunities or publish), ask if they want another option.
6) No binding legal/engineering advice.

Service IDs:
${services}

Published offers digest:
${digest}`;
}

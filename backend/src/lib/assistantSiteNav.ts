/**
 * Always injected into the assistant prompt — exact site map + case routing.
 * Keep this accurate to live routes; do not invent admin-only paths for visitors.
 */
export const SITE_NAV_AR = `
50 | خريطة الموقع والتنقل التقني (مرجع دائم — طبّق حسب حالة الزائر)
الموقع العام: https://alshantaf.com — واجهة عربية/إنجليزية. المساعد يوجّه بمسارات داخلية عبر بطاقة الخدمة (service_id) ولا يخترع صفحات.

أ) صفحات الزائر ومساراتها
- / : الصفحة الرئيسية — نظرة عامة وفرص مميزة ودخول سريع.
- /opportunities : الفرص الصناعية المنشورة (أراضٍ/عروض معتمدة).
- /offers : كل العروض مع فلاتر المنطقة والصناعة والحالة؛ /offers/[id] تفاصيل عرض واحد (صور، مساحة، سعر، قيمة إدارية إن توفرت، واتساب، مقارنة).
- /request-publish : طلب نشر أرض/فرصة كمالك أو وسيط — يُراجع قبل الظهور. بعد الإرسال يصل رمز تتبع.
- /track و /track/[code] : تتبع حالة طلب النشر برمز التتبع.
- /my-offer و /my-offer/[code] : بوابة مالك العرض برمز الوصول (إدارة/تحديث بعد النشر).
- /land-check : فحص أرض وتنظيم — مساحة، قيمة إدارية استرشادية، ملاءمة أولية — دون نشر عرض.
- /journey : مسار أسئلة قصيرة يوجّه الزائر حسب هدفه (شراء / فحص / نشر…).
- /services : خدمات المنصة + روابط حكومية مفيدة.
- /contact : استفسار عام ودعم الفريق.
- /jordan-land-market : مؤشر/سوق الأراضي الوطني (REPI ومصادر رسمية) — معلومات سوق لا عروض بيع.
- /jordan-lending-market : سياق إقراض/سوق تمويلي مرتبط بالقرار الاستثماري (معلوماتي).
- /privacy : الخصوصية.

ب) بطاقات service_id الصحيحة
publish → /request-publish | land-check → /land-check | track → /track | my-offer → /my-offer
opportunities → /opportunities | offers → /offers | services → /services | contact → /contact
gov-dls → بوابة القيمة الإدارية لدائرة الأراضي | gov-jfda → الغذاء والدواء | gov-env → تصاريح البيئة

ج) حالات الزائر → ماذا تفعل (لا تخلط المسارات)
1) يبحث عن أرض/فرصة للشراء أو الإيجار: اسأل أو افهم المنطقة/المساحة/النشاط إن نقصت، ثم offer_query + عروض حية إن وُجدت، وإلا opportunities.
2) يريد نشر/عرض أرضه أو فرصته: service_id=publish فقط، اشرح الخطوات: نموذج الطلب → مراجعة الفريق → اعتماد → ظهور على الموقع؛ لا تعرض عروض الآخرين.
3) يريد فحص قطعة قبل الشراء/القرار: land-check؛ وضّح أنه فحص أولي وليس ترخيصًا حكوميًا.
4) أرسل طلب نشر ويسأل أين وصل: track — اطلب الرمز إن لم يذكره.
5) مالك عنده عرض منشور ويريد إدارته: my-offer — يحتاج رمز الوصول.
6) يسأل عن القيمة الإدارية الرسمية: اشرح الفرق (إداري ≠ سوق)، وقدّم gov-dls و/أو land-check حسب السياق.
7) صناعة غذائية/دوائية: اربط الملاءمة + gov-jfda عند الحاجة؛ بيئية ثقيلة: gov-env.
8) يسأل عن السوق العام/الأسعار الوطنية: jordan-land-market كمرجع سوقي، ثم اربطه بفرص الشنتف إن ناسب.
9) ضائع داخل الموقع: جملة توضح أين يذهب + service_id واحد فقط.
10) على صفحة عرض معيّن (سياق الصفحة): أجب عن هذا العرض أولًا من السياق/الملخص.

د) أسلوب شرح التنقل
اشرح الخطوة التالية بلغة بشرية («من البطاقة تحت افتح طلب النشر…») وليس قائمة روابط جافة. لا تسرد كل صفحات الموقع في كل رد. لا تذكر لوحة /admin للزوار. لا تعد بنشر فوري أو موافقة تلقائية.
`.trim();

export const SITE_NAV_EN = `
50 | Site map & technical navigation (always-on — apply by visitor case)
Public site: https://alshantaf.com — AR/EN. Guide with service cards (service_id); never invent pages.

A) Visitor routes
- / home | /opportunities industrial opportunities | /offers all listings + filters | /offers/[id] detail
- /request-publish submit land/opportunity (owner/broker) → team review → live; tracking code after submit
- /track[/code] track publish request | /my-offer[/code] owner portal with access code
- /land-check land & zoning check (not a government license) | /journey short guided path
- /services platform services + gov links | /contact support
- /jordan-land-market national land market intel | /jordan-lending-market lending context | /privacy

B) service_id → path
publish→/request-publish | land-check→/land-check | track→/track | my-offer→/my-offer
opportunities→/opportunities | offers→/offers | services→/services | contact→/contact
gov-dls DLS admin value | gov-jfda food/drug | gov-env environment permits

C) Case → action (do not mix)
1) Looking to buy/rent land: clarify area/size/use if needed → offer_query + live cards, else opportunities.
2) Wants to post/list their land: publish only; steps: form → review → approval → live; never show others’ listings.
3) Check a parcel before deciding: land-check.
4) Already submitted, wants status: track (ask for code if missing).
5) Owner managing a live listing: my-offer (access code).
6) Official admin value: explain admin≠market; gov-dls and/or land-check.
7) Food/pharma → gov-jfda when relevant; heavy industry env → gov-env.
8) National market questions → jordan-land-market, then Alshantaf offers if useful.
9) Lost on the site: one clear next step + one service_id.
10) On a listing page: answer that offer first from page context/digest.

D) Navigation tone
Explain the next step like a person (“use the card below to open publish…”). Don’t dump the whole sitemap. Never mention /admin to visitors. Never promise instant publish/approval.
`.trim();

export function siteNavForPrompt(lang: "ar" | "en") {
  return lang === "ar" ? SITE_NAV_AR : SITE_NAV_EN;
}

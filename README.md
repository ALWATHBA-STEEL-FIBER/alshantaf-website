# ALSHANTAF INVEST — Premium Prototype V2

نسخة تشغيلية مبدئية لمنصة الشنتف للاستثمار والتطوير.

## ما تم بناؤه
- واجهة فخمة Mobile-first.
- العربية والإنجليزية مع تبديل الاتجاه RTL/LTR.
- هيكل أسواق متعدد الدول؛ الأردن مفعّل، والسعودية والإمارات جاهزتان للإضافة لاحقًا.
- رحلة مستثمر قصيرة من 4 أسئلة.
- فرص محمية لا تكشف المالك أو الموقع الدقيق.
- مسار سريع لمالك الأرض ثم نموذج وثائق داخلي.
- بوابة احترافية للدراسات والقوانين والكلف والعوائد.
- PWA قابلة للتثبيت.

## ملاحظة تقنية
الحفظ الحالي تجريبي داخل LocalStorage على الجهاز. النسخة الإنتاجية تحتاج Backend آمن، قاعدة بيانات، تخزين وثائق مشفر، صلاحيات مستخدمين، ولوحة إدارة.

## التوسع حسب الدولة
الملف يحتوي على COUNTRY_CONFIG. عند إضافة دولة جديدة يتم ربط:
- العملة.
- قواعد التنظيم والاستعمال.
- الجهات والموافقات.
- نطاقات الأسعار والكلف.
- الفرص الخاصة بالسوق.
- اللغات المطلوبة.

## Backend + Next.js MVP (new)

The `backend/` (Node/Express + Prisma/Postgres) and `frontend/` (Next.js) folders are a
real, self-hosted replacement for the LocalStorage prototype above. The original static
site at the repo root is untouched and keeps serving `alshantaf.com` via GitHub Pages
until you cut over.

### Run it

```bash
cp .env.example .env   # edit JWT_SECRET / ADMIN_EMAIL / ADMIN_PASSWORD / POSTGRES_PASSWORD
docker compose up --build
```

Then open `http://localhost` — the public site, and `http://localhost/admin/login`
with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `.env`.

This is the same command you'll run on a VPS later — Postgres, the API, the Next.js
app and nginx all come up together, with uploaded files and the database persisted to
local volumes (`backend/uploads/`, and the `pgdata` Docker volume).

### What's included

- Real Postgres-backed listings and owner/broker submissions (replacing the two
  `localStorage` keys the old admin pages used).
- Cookie-based admin login (`backend/prisma/seed.ts` creates the one admin user from
  `ADMIN_EMAIL`/`ADMIN_PASSWORD`) — the admin pages are no longer wide open.
- File uploads saved to a local, centralized volume instead of base64-in-browser or the
  old Google Apps Script → Drive hack.
- The public site's hero, live offers grid, owner/broker submission form, contact form
  and footer are ported to Next.js with the real bilingual AR/EN copy, still opening
  WhatsApp the same way, now backed by the real API.

### Not yet ported

The marketing site has a lot more sections (the visual-story image mosaic, the
government-services investor tools, the multi-country teaser, success-partners logos,
full mobile drawer parity). Those weren't carried over in this pass — say the word and
they can be ported next.

## Version 6 updates
- New integrated administrative-front + factory/warehouse hero image.
- Clean vector ALSHANTAF logo with corrected Arabic wording: للعقار والاستثمار.
- Both phone numbers retained in header, footer and mobile menu.
- Developed area metric updated to 1,000,000 m².
- Bilingual Success Partners section added.
- Abdeen Elite Home uses the official hosted logo with a branded fallback.

import type { Metadata } from "next";
import { getServerDict } from "@/lib/serverLang";
import { PageHeaderSpacer } from "@/components/PageHeaderSpacer";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDict();
  return {
    title: t.privacyPage.title,
    description: t.privacyPage.intro,
    alternates: { canonical: "/privacy" },
    openGraph: { title: t.privacyPage.title, description: t.privacyPage.intro, url: "/privacy" },
  };
}

export default async function PrivacyPage() {
  const { t } = await getServerDict();

  return (
    <>
      <PageHeaderSpacer />
      <BreadcrumbJsonLd items={[{ name: t.nav.home, path: "/" }, { name: t.privacyPage.title, path: "/privacy" }]} />
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-[760px] px-4">
          <h1 className="text-3xl md:text-4xl font-bold">{t.privacyPage.title}</h1>
          <p className="text-ink-soft text-sm mt-2">{t.privacyPage.updated}</p>
          <p className="mt-6 text-ink-soft leading-relaxed">{t.privacyPage.intro}</p>

          <div className="mt-10 flex flex-col gap-8">
            {t.privacyPage.sections.map((section) => (
              <div key={section.title}>
                <h2 className="text-lg font-bold text-green">{section.title}</h2>
                <p className="mt-2 text-ink-soft leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

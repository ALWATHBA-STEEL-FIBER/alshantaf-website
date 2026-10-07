import type { Metadata } from "next";
import { getServerDict } from "@/lib/serverLang";
import { PageHeaderSpacer } from "@/components/PageHeaderSpacer";
import { TrackForm } from "@/components/TrackForm";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDict();
  return {
    title: t.trackPage.title,
    description: t.trackPage.subtitle,
    alternates: { canonical: "/track" },
    robots: { index: false, follow: true },
  };
}

export default async function TrackPage() {
  const { t } = await getServerDict();

  return (
    <>
      <PageHeaderSpacer />
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-[560px] px-4">
          <span className="text-gold text-xs font-bold tracking-wide">{t.trackPage.eyebrow}</span>
          <h1 className="text-3xl font-bold mt-2">{t.trackPage.title}</h1>
          <p className="text-ink-soft mt-3 leading-relaxed">{t.trackPage.subtitle}</p>
          <div className="mt-8 bg-white rounded-2xl border border-line p-6">
            <TrackForm />
          </div>
        </div>
      </section>
    </>
  );
}

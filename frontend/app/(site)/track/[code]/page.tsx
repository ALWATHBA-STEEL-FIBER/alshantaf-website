import type { Metadata } from "next";
import { getSubmissionTrackingServer } from "@/lib/api";
import { getServerDict } from "@/lib/serverLang";
import { toWesternDigits } from "@/lib/arabicDigits";
import { PageHeaderSpacer } from "@/components/PageHeaderSpacer";
import { TrackForm } from "@/components/TrackForm";
import { TrackStatus } from "@/components/TrackStatus";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDict();
  return {
    title: t.trackPage.title,
    description: t.trackPage.subtitle,
    robots: { index: false, follow: true },
  };
}

export default async function TrackCodePage(props: PageProps<"/track/[code]">) {
  const { code: rawCode } = await props.params;
  const code = toWesternDigits(decodeURIComponent(rawCode)).toUpperCase();
  const { t } = await getServerDict();
  const tracking = await getSubmissionTrackingServer(code);

  return (
    <>
      <PageHeaderSpacer />
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-[560px] px-4">
          <span className="text-gold text-xs font-bold tracking-wide">{t.trackPage.eyebrow}</span>
          <h1 className="text-3xl font-bold mt-2">{t.trackPage.title}</h1>
          <p className="text-ink-soft mt-3 leading-relaxed">{t.trackPage.subtitle}</p>
          <div className="mt-8 bg-white rounded-2xl border border-line p-6">
            <TrackForm initialCode={code} />
          </div>

          {tracking ? <TrackStatus tracking={tracking} /> : (
            <p className="mt-6 text-sm text-red-600 bg-red-50 rounded-xl p-4">{t.trackPage.notFound}</p>
          )}
        </div>
      </section>
    </>
  );
}

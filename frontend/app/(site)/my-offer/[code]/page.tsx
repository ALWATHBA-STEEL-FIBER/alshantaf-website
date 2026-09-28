import type { Metadata } from "next";
import { getServerDict } from "@/lib/serverLang";
import { PageHeaderSpacer } from "@/components/PageHeaderSpacer";
import { MyOfferPortal } from "@/components/MyOfferPortal";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDict();
  return {
    title: t.myOffer.title,
    robots: { index: false, follow: false },
  };
}

export default async function MyOfferCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <PageHeaderSpacer />
      <MyOfferPortal initialCode={code} />
    </>
  );
}

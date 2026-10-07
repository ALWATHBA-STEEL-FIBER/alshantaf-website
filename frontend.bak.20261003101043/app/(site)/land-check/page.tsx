import type { Metadata } from "next";
import { getServerDict } from "@/lib/serverLang";
import { PageHeaderSpacer } from "@/components/PageHeaderSpacer";
import { LandCheckForm } from "@/components/LandCheckForm";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDict();
  return {
    title: t.landCheck.title,
    description: t.landCheck.subtitle,
    alternates: { canonical: "/land-check" },
    openGraph: { title: t.landCheck.title, description: t.landCheck.subtitle, url: "/land-check" },
  };
}

export default async function LandCheckPage() {
  const { t } = await getServerDict();

  return (
    <>
      <PageHeaderSpacer />
      <BreadcrumbJsonLd
        items={[
          { name: t.nav.home, path: "/" },
          { name: t.landCheck.pageCta, path: "/land-check" },
        ]}
      />
      <LandCheckForm />
    </>
  );
}

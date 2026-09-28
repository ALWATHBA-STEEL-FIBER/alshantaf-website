import type { Metadata } from "next";
import { getServerDict } from "@/lib/serverLang";
import { PageHeaderSpacer } from "@/components/PageHeaderSpacer";
import { OwnerForm } from "@/components/OwnerForm";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDict();
  return {
    title: t.owners.title,
    description: t.owners.subtitle,
    alternates: { canonical: "/request-publish" },
    openGraph: { title: t.owners.title, description: t.owners.subtitle, url: "/request-publish" },
  };
}

export default async function RequestPublishPage() {
  const { t } = await getServerDict();

  return (
    <>
      <PageHeaderSpacer />
      <BreadcrumbJsonLd items={[{ name: t.nav.home, path: "/" }, { name: t.nav.cta, path: "/request-publish" }]} />
      <OwnerForm />
    </>
  );
}

import type { Metadata } from "next";
import { getServerDict } from "@/lib/serverLang";
import { PageHeaderSpacer } from "@/components/PageHeaderSpacer";
import { ContactForm } from "@/components/ContactForm";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDict();
  return {
    title: t.contact.title,
    description: t.contact.subtitle,
    alternates: { canonical: "/contact" },
    openGraph: { title: t.contact.title, description: t.contact.subtitle, url: "/contact" },
  };
}

export default async function ContactPage() {
  const { t } = await getServerDict();

  return (
    <>
      <PageHeaderSpacer />
      <BreadcrumbJsonLd items={[{ name: t.nav.home, path: "/" }, { name: t.nav.contact, path: "/contact" }]} />
      <ContactForm />
    </>
  );
}

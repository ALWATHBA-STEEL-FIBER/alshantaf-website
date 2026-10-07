"use client";

import Link from "next/link";
import { useSettings } from "@/lib/SettingsProvider";
import { useLanguage } from "@/lib/LanguageProvider";
import { offerWhatsappLink } from "@/lib/whatsapp";
import {
  localizeListingTitle,
  localizePlaceName,
  localizePriceLabel,
  localizeSizeLabel,
} from "@/lib/localizePlace";
import type { AssistantOfferCard, AssistantServiceCard } from "@/lib/types";

export function AssistantOfferCardView({ offer }: { offer: AssistantOfferCard }) {
  const { t, lang } = useLanguage();
  const settings = useSettings();
  const title = localizeListingTitle(offer.title, lang);
  const area = localizePlaceName(offer.area, lang);
  const size = localizeSizeLabel(offer.size, lang);
  const price = localizePriceLabel(offer.price, lang);

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_12px_28px_-22px_rgba(15,52,47,0.45)]">
      <div className="relative h-28 bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={offer.mainImage || "/industrial-clean-wide.webp"}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <span className="absolute bottom-2 start-2 rounded-full bg-white/92 px-2 py-0.5 text-[10px] font-bold">
          {area}
        </span>
        {offer.featured && (
          <span className="absolute top-2 end-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-[#152126]">
            {t.offers.featured}
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-bold leading-snug text-green line-clamp-2">{title}</h4>
          <span dir="ltr" className="shrink-0 font-mono text-[10px] text-ink-soft">
            {offer.listingNo}
          </span>
        </div>
        <p className="line-clamp-2 text-xs text-ink-soft leading-relaxed">{offer.description}</p>
        <div className="grid grid-cols-2 gap-2 border-t border-line pt-2 text-xs">
          <div>
            <small className="block text-[10px] text-ink-soft">{t.offers.size}</small>
            <b className="font-bold">{size || t.assistant.onRequest}</b>
          </div>
          <div>
            <small className="block text-[10px] text-ink-soft">{t.offers.price}</small>
            <b className="font-bold">{price || t.assistant.onRequest}</b>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link
            href={`/offers/${offer.id}`}
            className="flex h-9 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold hover:bg-line/50"
          >
            {t.assistant.details}
          </Link>
          <a
            href={offerWhatsappLink(offer.phone, offer.listingNo, title, settings.whatsappNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center justify-center rounded-full bg-green text-[11px] font-bold text-white hover:bg-green-2"
          >
            {t.assistant.whatsapp}
          </a>
        </div>
      </div>
    </article>
  );
}

export function AssistantServiceCardView({ service }: { service: AssistantServiceCard }) {
  const className =
    "block rounded-2xl border border-line bg-white p-3.5 transition-colors hover:border-gold/45 shadow-[0_12px_28px_-22px_rgba(15,52,47,0.45)]";
  const body = (
    <>
      <span className="mb-2 block h-[2px] w-8 rounded-full bg-gold" aria-hidden />
      <h4 className="text-sm font-bold leading-snug text-green">{service.title}</h4>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-soft line-clamp-3">{service.note}</p>
      <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-green">
        {service.cta}
        <span aria-hidden className="rtl:rotate-180">
          →
        </span>
      </span>
    </>
  );

  if (service.external || service.href.startsWith("http")) {
    return (
      <a href={service.href} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    );
  }

  return (
    <Link href={service.href} className={className}>
      {body}
    </Link>
  );
}

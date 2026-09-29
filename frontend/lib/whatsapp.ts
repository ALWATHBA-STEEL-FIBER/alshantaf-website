import { openExternalUrl } from "@/lib/externalNav";

const FALLBACK_WHATSAPP = "962799996668";

export function openWhatsapp(text: string, phone: string = FALLBACK_WHATSAPP) {
  openExternalUrl(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
}

export function offerWhatsappLink(phone: string | null, listingNo: string, title: string, fallback: string = FALLBACK_WHATSAPP) {
  const source = phone || fallback.replace(/^962/, "0");
  const digits = source.replace(/\D/g, "").replace(/^0/, "");
  const text = `مرحبًا، أرغب بالاستفسار عن العرض ${listingNo}: ${title}`;
  return `https://wa.me/962${digits}?text=${encodeURIComponent(text)}`;
}

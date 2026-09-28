"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";
import { useSettings } from "@/lib/SettingsProvider";
import { useTeam } from "@/lib/TeamProvider";
import { Logo } from "@/components/Logo";
import { EmailIcon, PhoneIcon, WhatsappIcon, FacebookIcon, InstagramIcon } from "@/components/icons";

export function Footer() {
  const { t } = useLanguage();
  const settings = useSettings();
  const team = useTeam();

  return (
    <footer className="relative mt-20 overflow-hidden bg-green text-white/85">
      <div className="absolute inset-0 opacity-30 pointer-events-none" aria-hidden>
        <div className="absolute -top-24 -end-16 w-72 h-72 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute bottom-0 start-0 w-80 h-56 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_60%)]" />
      </div>
      <div className="relative mx-auto max-w-[1240px] px-4 py-16 grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="flex flex-col items-center text-center md:mx-auto">
          <Logo light className="h-[calc(var(--spacing)*50)] w-auto md:mt-[calc(var(--spacing)*-18)]" />
          <b className="text-sm text-white">{t.footer.taglineName}</b>
          <p className="text-sm leading-relaxed text-white/70 max-w-sm mt-1">{t.footer.taglineDetail}</p>
        </div>
        <div className="flex flex-col gap-2.5 text-sm">
          <h4 className="font-bold text-gold mb-1">{t.footer.linksTitle}</h4>
          <Link href="/opportunities" className="hover:text-gold transition-colors w-fit">
            {t.nav.opportunities}
          </Link>
          <Link href="/offers" className="hover:text-gold transition-colors w-fit">
            {t.nav.offers}
          </Link>
          <Link href="/services" className="hover:text-gold transition-colors w-fit">
            {t.nav.services}
          </Link>
          <Link href="/request-publish" className="hover:text-gold transition-colors w-fit">
            {t.nav.cta}
          </Link>
          <Link href="/land-check" className="hover:text-gold transition-colors w-fit">
            {t.landCheck.pageCta}
          </Link>
          <Link href="/my-offer" className="hover:text-gold transition-colors w-fit">
            {t.myOffer.eyebrow}
          </Link>
          <Link href="/contact" className="hover:text-gold transition-colors w-fit">
            {t.nav.contact}
          </Link>
        </div>
        <div className="flex flex-col gap-4 text-sm">
          <div>
            <h4 className="font-bold text-gold mb-2">{t.footer.contactTitle}</h4>
            {team.length > 0 && (
              <div className="flex flex-col gap-3 mb-3">
                {team.map((member) => (
                  <div key={member.name} className="flex flex-col gap-1">
                    <span className="font-bold text-white">{member.name}</span>
                    {member.phone && (
                      <a
                        href={`tel:${member.phone.replace(/[^0-9+]/g, "")}`}
                        dir="ltr"
                        className="flex items-center gap-2 hover:text-gold transition-colors w-fit text-white/75"
                      >
                        <PhoneIcon className="w-4 h-4 shrink-0" /> {member.phone}
                      </a>
                    )}
                    {member.whatsapp && (
                      <a
                        href={`https://wa.me/${member.whatsapp.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener"
                        dir="ltr"
                        className="flex items-center gap-2 hover:text-gold transition-colors w-fit text-white/75"
                      >
                        <WhatsappIcon className="w-4 h-4 shrink-0" /> WhatsApp
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2.5 pt-3 border-t border-white/10" dir="ltr">
            <a href={`mailto:${settings.contactEmail}`} className="flex items-center gap-2 hover:text-gold transition-colors w-fit">
              <EmailIcon className="w-4 h-4 shrink-0" /> {settings.contactEmail}
            </a>
            {settings.facebookUrl && (
              <a
                href={settings.facebookUrl}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-2 hover:text-gold transition-colors w-fit"
              >
                <FacebookIcon className="w-4 h-4 shrink-0" /> Facebook
              </a>
            )}
            {settings.instagramUrl && (
              <a
                href={settings.instagramUrl}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-2 hover:text-gold transition-colors w-fit"
              >
                <InstagramIcon className="w-4 h-4 shrink-0" /> Instagram
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="relative border-t border-white/10 py-5 text-center text-xs text-white/55 flex flex-col sm:flex-row items-center justify-center gap-2">
        <span>© 2026 ALSHANTAF INVEST — {t.footer.rights}</span>
        <span className="hidden sm:inline">·</span>
        <Link href="/privacy" className="hover:text-gold transition-colors">
          {t.footer.privacyLink}
        </Link>
      </div>
    </footer>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/LanguageProvider";
import { useSettings } from "@/lib/SettingsProvider";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { MenuIcon, CloseIcon, EmailIcon, FacebookIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { openSiteAssistant } from "@/lib/assistantUi";

const NAV_ITEMS = ["home", "opportunities", "offers", "landMarket", "services", "contact"] as const;
const NAV_HREF: Record<(typeof NAV_ITEMS)[number], string> = {
  home: "/",
  opportunities: "/opportunities",
  offers: "/offers",
  landMarket: "/jordan-land-market",
  services: "/services",
  contact: "/contact",
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const { t, toggleLanguage } = useLanguage();
  const settings = useSettings();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navPath, setNavPath] = useState(pathname);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isHome = pathname === "/";
  const transparent = isHome && !scrolled;

  // Close the mobile drawer when the route changes (adjust state during render).
  if (pathname !== navPath) {
    setNavPath(pathname);
    if (drawerOpen) setDrawerOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty("--header-h", `${Math.round(entry.contentRect.height)}px`);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrolled]);

  return (
    <div ref={wrapperRef} className="fixed top-0 inset-x-0 z-40">
      {/* Homescreen / notched devices — fill + push chrome below the island */}
      <div
        className={`transition-colors duration-300 ${transparent ? "bg-transparent" : "bg-green"}`}
        style={{ height: "env(safe-area-inset-top, 0px)" }}
        aria-hidden
      />
      <MaintenanceBanner />

      <div
        className={`text-xs transition-colors duration-300 ${
          transparent ? "text-white/90" : "bg-green text-white/90"
        }`}
      >
        <div className="mx-auto max-w-[1240px] px-4 flex items-center justify-between h-10 gap-3">
          <div className="hidden sm:flex items-center gap-4">
            <a className="flex items-center gap-1.5 hover:text-gold transition-colors" href={`mailto:${settings.contactEmail}`}>
              <EmailIcon className="w-3.5 h-3.5" /> {settings.contactEmail}
            </a>
            {settings.facebookUrl && (
              <a
                className="flex items-center gap-1.5 hover:text-gold transition-colors"
                href={settings.facebookUrl}
                target="_blank"
                rel="noopener"
                aria-label="Facebook"
              >
                <FacebookIcon className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-3 ms-auto">
            <span>{t.utility.country}</span>
            <button className="font-bold hover:text-gold transition-colors" onClick={toggleLanguage} type="button">
              {t.utility.toggle}
            </button>
          </div>
        </div>
      </div>

      <header
        className={`transition-all duration-300 ${
          transparent
            ? "bg-transparent"
            : "bg-white/90 backdrop-blur-xl border-b border-line/80 shadow-[0_10px_40px_-24px_rgba(17,58,52,0.35)]"
        }`}
      >
        <div className="mx-auto max-w-[1240px] px-3 sm:px-4 h-14 sm:h-[76px] flex items-center justify-between gap-2 sm:gap-4">
          <Link href="/" className="shrink-0 flex items-center gap-1.5 sm:gap-3 min-w-0">
            <Logo light={transparent} className="h-8 w-auto sm:h-12" />
            <span
              className={`font-brand flex flex-col leading-tight text-[10px] sm:text-sm font-bold tracking-wide transition-colors ${
                transparent ? "text-white" : "text-green"
              }`}
            >
              <span>{t.brand.line1}</span>
              <span>{t.brand.line2}</span>
            </span>
          </Link>

          <nav
            className={`hidden lg:flex items-center gap-1 p-1 rounded-full border backdrop-blur-md ${
              transparent
                ? "border-white/20 bg-white/10 text-white"
                : "border-line bg-surface-2/80 text-ink"
            }`}
          >
            {NAV_ITEMS.map((key) => {
              const active = isActivePath(pathname, NAV_HREF[key]);
              return (
                <Link
                  key={key}
                  href={NAV_HREF[key]}
                  className={`relative px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                    active
                      ? transparent
                        ? "text-white"
                        : "text-green"
                      : transparent
                        ? "text-white/75 hover:text-white"
                        : "text-ink-soft hover:text-green"
                  }`}
                >
                  {t.nav[key]}
                  {active && (
                    <span className="absolute inset-0 -z-10 rounded-full bg-white/15" aria-hidden>
                      <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-7 h-1 rounded-t-full bg-gold shadow-[0_0_16px_rgba(202,160,100,0.75)]" />
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={toggleLanguage}
              className={`h-10 px-4 rounded-full border text-xs font-bold transition-colors ${
                transparent ? "border-white/40 text-white hover:bg-white/10" : "border-line text-ink hover:bg-surface-2"
              }`}
              type="button"
            >
              {t.utility.toggle}
            </button>
            <Link
              href="/land-check"
              aria-current={isActivePath(pathname, "/land-check") ? "page" : undefined}
              className={`h-11 px-4 rounded-full border text-sm font-bold flex items-center transition-colors ${
                isActivePath(pathname, "/land-check")
                  ? transparent
                    ? "border-gold bg-white/20 text-white ring-1 ring-gold/60"
                    : "border-green bg-green/10 text-green ring-1 ring-green/25"
                  : transparent
                    ? "border-white/40 text-white hover:bg-white/10"
                    : "border-line bg-white/80 text-ink hover:border-gold/50 hover:bg-white"
              }`}
            >
              {t.landCheck.pageCta}
            </Link>
            <Link
              href="/request-publish"
              aria-current={isActivePath(pathname, "/request-publish") ? "page" : undefined}
              className={`h-11 px-5 rounded-full text-sm font-bold flex items-center transition-colors ${
                isActivePath(pathname, "/request-publish")
                  ? transparent
                    ? "bg-gold text-green ring-2 ring-white/40 shadow-[0_10px_24px_-12px_rgba(202,160,100,0.9)]"
                    : "bg-green-2 text-white ring-2 ring-gold/50 shadow-[0_10px_24px_-12px_rgba(17,58,52,0.8)]"
                  : "bg-green text-white hover:bg-green-2 shadow-[0_10px_24px_-12px_rgba(17,58,52,0.8)]"
              }`}
            >
              {t.nav.cta}
            </Link>
          </div>

          <div className="flex lg:hidden items-center gap-1.5 shrink-0">
            <Link
              href="/land-check"
              aria-current={isActivePath(pathname, "/land-check") ? "page" : undefined}
              className={`h-9 px-2.5 rounded-full text-[11px] font-bold flex items-center whitespace-nowrap transition-colors ${
                isActivePath(pathname, "/land-check")
                  ? transparent
                    ? "border border-gold bg-white/20 text-white"
                    : "border border-green bg-green/10 text-green"
                  : transparent
                    ? "border border-white/40 text-white hover:bg-white/10"
                    : "border border-line bg-white text-green hover:border-gold/50"
              }`}
            >
              {t.landCheck.pageCta}
            </Link>
            <button
              className={`h-9 w-9 rounded-full border flex items-center justify-center transition-colors ${
                transparent ? "border-white/40 text-white" : "border-line text-ink"
              }`}
              onClick={() => setDrawerOpen(true)}
              type="button"
              aria-label="menu"
            >
              <MenuIcon />
            </button>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} aria-label="close" />
          <div className="absolute inset-y-0 start-0 w-[82%] max-w-xs bg-white p-5 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] flex flex-col gap-1 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4 gap-3">
              <Link href="/" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2.5 min-w-0">
                <Logo className="h-11 w-auto shrink-0" />
                <span className="font-brand flex flex-col leading-tight text-xs font-bold tracking-wide text-green">
                  <span>{t.brand.line1}</span>
                  <span>{t.brand.line2}</span>
                </span>
              </Link>
              <button onClick={() => setDrawerOpen(false)} type="button" aria-label="close" className="shrink-0">
                <CloseIcon />
              </button>
            </div>
            {NAV_ITEMS.map((key) => {
              const active = isActivePath(pathname, NAV_HREF[key]);
              return (
                <Link
                  key={key}
                  href={NAV_HREF[key]}
                  onClick={() => {
                    setDrawerOpen(false);
                    window.setTimeout(() => openSiteAssistant(), 180);
                  }}
                  className={`flex min-h-12 items-center border-b border-line py-3 text-start transition-colors ${
                    active ? "font-bold text-green" : "text-ink"
                  } ${key === "offers" ? "font-bold" : ""}`}
                >
                  {t.nav[key]}
                </Link>
              );
            })}
            <Link
              href="/offers"
              onClick={() => setDrawerOpen(false)}
              className="mt-4 flex h-12 cursor-pointer items-center justify-center rounded-full bg-green text-sm font-bold text-white transition-colors hover:bg-green-2"
            >
              {t.offers.viewAllCta}
            </Link>
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                openSiteAssistant();
              }}
              className="mt-2 flex h-11 cursor-pointer items-center justify-center rounded-full border border-line text-sm font-bold text-ink"
            >
              {t.assistant.open}
            </button>
            <Link
              href="/land-check"
              onClick={() => setDrawerOpen(false)}
              aria-current={isActivePath(pathname, "/land-check") ? "page" : undefined}
              className={`mt-2 flex h-11 cursor-pointer items-center justify-center rounded-full border text-sm font-bold transition-colors ${
                isActivePath(pathname, "/land-check")
                  ? "border-green bg-green/10 text-green ring-1 ring-green/25"
                  : "border-line text-ink hover:border-gold/50"
              }`}
            >
              {t.landCheck.pageCta}
            </Link>
            <Link
              href="/request-publish"
              onClick={() => setDrawerOpen(false)}
              aria-current={isActivePath(pathname, "/request-publish") ? "page" : undefined}
              className={`flex h-11 cursor-pointer items-center justify-center rounded-full text-sm font-bold transition-colors ${
                isActivePath(pathname, "/request-publish")
                  ? "bg-green-2 text-white ring-2 ring-gold/50"
                  : "bg-green text-white hover:bg-green-2"
              }`}
            >
              {t.nav.cta}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

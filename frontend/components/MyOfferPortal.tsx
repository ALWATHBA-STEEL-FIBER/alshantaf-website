"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { toWesternDigits } from "@/lib/arabicDigits";
import { localizeListingTitle, localizePlaceName } from "@/lib/localizePlace";
import type { Listing, PropertyStatus } from "@/lib/types";
import { EyeIcon } from "@/components/icons";

const inputClass =
  "w-full h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold font-mono";

export function MyOfferPortal({ initialCode = "" }: { initialCode?: string }) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [codeInput, setCodeInput] = useState(initialCode);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(Boolean(initialCode));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(code: string) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await api.ownerListing(code);
      setListing(data);
    } catch (err) {
      setListing(null);
      setError(err instanceof ApiError ? err.message : t.myOffer.notFound);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialCode) load(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  function openCode(e: React.FormEvent) {
    e.preventDefault();
    const code = toWesternDigits(codeInput.trim()).toUpperCase();
    if (!code) return;
    router.push(`/my-offer/${encodeURIComponent(code)}`);
  }

  async function setStatus(status: PropertyStatus) {
    if (!listing?.ownerAccessCode) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api.updateOwnerListing(listing.ownerAccessCode, { status });
      setListing(updated);
      setMessage(t.myOffer.saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function toggleSms(smsOptIn: boolean) {
    if (!listing?.ownerAccessCode) return;
    setBusy(true);
    try {
      const updated = await api.updateOwnerListing(listing.ownerAccessCode, { smsOptIn });
      setListing(updated);
      setMessage(t.myOffer.saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function hardDelete() {
    if (!listing?.ownerAccessCode) return;
    const typed = window.prompt(t.myOffer.deleteConfirmPrompt);
    if (!typed || typed.trim() !== listing.listingNo) return;
    setBusy(true);
    try {
      await api.deleteOwnerListing(listing.ownerAccessCode, listing.listingNo);
      setListing(null);
      setMessage(t.myOffer.deleted);
      router.push("/my-offer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-[720px] px-4">
        <span className="text-gold text-xs font-bold tracking-wide">{t.myOffer.eyebrow}</span>
        <h1 className="text-3xl md:text-4xl font-bold mt-2 text-balance">{t.myOffer.title}</h1>
        <p className="text-ink-soft mt-3 leading-relaxed">{t.myOffer.subtitle}</p>

        {!initialCode && (
          <form onSubmit={openCode} className="mt-8 bg-white rounded-2xl border border-line p-5 flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-ink-soft mb-1 block">{t.myOffer.codeLabel}</label>
              <input
                className={inputClass}
                dir="ltr"
                value={codeInput}
                onChange={(e) => setCodeInput(toWesternDigits(e.target.value).toUpperCase())}
                placeholder={t.myOffer.codePlaceholder}
                required
              />
            </div>
            <button type="submit" className="h-11 mt-5 sm:mt-6 px-6 rounded-full bg-green text-white font-bold text-sm">
              {t.myOffer.openCta}
            </button>
          </form>
        )}

        {loading && <p className="mt-8 text-sm text-ink-soft">{t.landCheck.submitting}</p>}
        {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-6 text-sm text-green font-bold">{message}</p>}

        {listing && (
          <div className="mt-8 bg-white rounded-[1.75rem] border border-line p-5 sm:p-7 flex flex-col gap-5 shadow-[0_24px_50px_-36px_rgba(15,52,47,0.35)]">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-green" dir="ltr">
                  {listing.listingNo}
                </p>
                <h2 className="text-xl font-bold mt-1">{localizeListingTitle(listing.title, lang)}</h2>
                {listing.area && <p className="text-sm text-gold font-bold mt-1">{localizePlaceName(listing.area, lang)}</p>}
              </div>
              <div className="bg-surface-2 rounded-2xl px-4 py-3 text-center min-w-[7rem]">
                <small className="block text-[10px] text-ink-soft">{t.myOffer.views}</small>
                <b className="text-2xl flex items-center justify-center gap-1.5">
                  <EyeIcon className="w-5 h-5" /> {listing.viewCount}
                </b>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-surface-2 p-3">
                <small className="block text-[10px] text-ink-soft">{t.myOffer.status}</small>
                <b>{t.offers.status[listing.status]}</b>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <small className="block text-[10px] text-ink-soft">{t.myOffer.publish}</small>
                <b>{t.admin.tabsListings[listing.publishStatus]}</b>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-green"
                checked={listing.smsOptIn !== false}
                disabled={busy}
                onChange={(e) => toggleSms(e.target.checked)}
              />
              {t.myOffer.smsToggle}
            </label>

            <div className="grid sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={busy || listing.status === "sold"}
                onClick={() => setStatus("sold")}
                className="h-11 rounded-full bg-amber-50 text-amber-900 text-sm font-bold disabled:opacity-50"
              >
                {t.myOffer.markSold}
              </button>
              <button
                type="button"
                disabled={busy || listing.status === "canceled"}
                onClick={() => setStatus("canceled")}
                className="h-11 rounded-full bg-red-50 text-red-700 text-sm font-bold disabled:opacity-50"
              >
                {t.myOffer.markCanceled}
              </button>
              <button
                type="button"
                disabled={busy || listing.status === "available"}
                onClick={() => setStatus("available")}
                className="h-11 rounded-full bg-surface-2 text-sm font-bold disabled:opacity-50"
              >
                {t.myOffer.markAvailable}
              </button>
            </div>

            {listing.ownerAccessCode && (
              <p className="text-[11px] text-ink-soft" dir="ltr">
                {t.myOffer.portalLinkHint}: /my-offer/{listing.ownerAccessCode}
              </p>
            )}

            <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
              <p className="text-sm font-bold text-red-700">{t.myOffer.deleteTitle}</p>
              <p className="text-xs text-ink-soft mt-1 leading-relaxed">{t.myOffer.deleteNote}</p>
              <button
                type="button"
                disabled={busy}
                onClick={hardDelete}
                className="mt-3 h-10 px-4 rounded-full bg-red-600 text-white text-xs font-bold disabled:opacity-50"
              >
                {t.myOffer.deleteCta}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

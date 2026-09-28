"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { localizeListingTitle, localizePlaceName } from "@/lib/localizePlace";
import { useToast } from "./Toast";
import { EmptyState, Spinner, SkeletonBlock } from "./EmptyState";
import { EyeIcon } from "@/components/icons";
import type { Listing, PublishStatus } from "@/lib/types";
import { ListingForm } from "./ListingForm";

type Action = "publish" | "feature" | "delete";
type Tab = "all" | PublishStatus;

const STATUS_DOT: Record<PublishStatus, string> = {
  published: "bg-green",
  draft: "bg-amber-500",
  archived: "bg-ink-soft",
};

export function ListingsManager() {
  const { t, lang } = useLanguage();
  const { showSuccess, showError } = useToast();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [editing, setEditing] = useState<Listing | null | "new">(null);
  const [busy, setBusy] = useState<{ id: string; action: Action } | null>(null);

  async function load() {
    const data = await api.adminListings();
    setListings(data);
  }

  useEffect(() => {
    let ignore = false;
    api.adminListings().then((data) => {
      if (ignore) return;
      setListings(data);
      setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  async function runAction(id: string, action: Action, label: string, run: () => Promise<unknown>) {
    setBusy({ id, action });
    try {
      await run();
      await load();
      showSuccess(label);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Something went wrong — please try again");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(listing: Listing) {
    const ok = window.confirm(`${t.admin.deleteForever}\n\n${t.admin.deleteForeverConfirm}\n\n${listing.listingNo}`);
    if (!ok) return;
    const typed = window.prompt(t.admin.deleteForeverConfirm);
    if (typed?.trim() !== listing.listingNo) return;
    await runAction(listing.id, "delete", `${listing.listingNo} — ${t.admin.delete}`, () => api.deleteListing(listing.id));
  }

  const isBusy = (id: string, action: Action) => busy?.id === id && busy.action === action;
  const rowBusy = (id: string) => busy?.id === id;

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: listings.length, published: 0, draft: 0, archived: 0 };
    listings.forEach((l) => c[l.publishStatus]++);
    return c;
  }, [listings]);

  const visible = tab === "all" ? listings : listings.filter((l) => l.publishStatus === tab);

  const tabs: Tab[] = ["all", "published", "draft", "archived"];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-green">{t.admin.listingsTitle}</h1>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="h-11 px-5 rounded-full bg-green text-white text-sm font-bold whitespace-nowrap"
        >
          {t.admin.addListing}
        </button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            type="button"
            className={`h-9 px-4 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1.5 ${
              tab === key ? "bg-green text-white" : "bg-white border border-line text-ink-soft"
            }`}
          >
            {t.admin.tabsListings[key]}
            <span className={`text-[10px] ${tab === key ? "text-white/80" : "text-ink-soft"}`}>{counts[key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-64" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState title={t.admin.noListingsTitle} note={t.admin.noListingsNote} />
      ) : visible.length === 0 ? (
        <EmptyState title={t.admin.noListingsInTab} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((listing) => (
            <article key={listing.id} className="bg-white rounded-2xl border border-line overflow-hidden flex flex-col">
              <div className="h-40 bg-surface-2 relative">
                <img
                  src={listing.mainImage || "/industrial-clean-wide.webp"}
                  alt={localizeListingTitle(listing.title, lang)}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2 start-2 bg-white/95 rounded-full px-2 py-1 text-[10px] font-bold flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[listing.publishStatus]}`} />
                  {t.admin.tabsListings[listing.publishStatus]}
                </span>
              </div>
              <div className="p-4 flex flex-col gap-2 flex-1">
                <div className="flex justify-between items-center text-[11px] text-ink-soft">
                  <span className="flex items-center gap-1" title={t.admin.viewCount}>
                    <EyeIcon className="w-3.5 h-3.5" /> {listing.viewCount}
                  </span>
                  <span>{t.offers.status[listing.status]}</span>
                  <span dir="ltr" className="font-mono text-green">{listing.listingNo}</span>
                </div>
                <h3 className="font-bold">{localizeListingTitle(listing.title, lang)}</h3>
                {listing.area ? (
                  <p className="text-xs text-gold font-bold">{localizePlaceName(listing.area, lang)}</p>
                ) : null}
                {listing.ownerAccessCode && (
                  <p className="text-[10px] font-mono text-ink-soft" dir="ltr">
                    {t.admin.ownerCode}: {listing.ownerAccessCode}
                  </p>
                )}
                <p className="text-xs text-ink-soft line-clamp-2">{listing.description}</p>
                <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditing(listing)}
                    disabled={rowBusy(listing.id)}
                    className="h-9 rounded-lg bg-green text-white text-xs font-bold disabled:opacity-50"
                  >
                    {t.admin.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      runAction(
                        listing.id,
                        "publish",
                        listing.publishStatus === "published" ? `${listing.listingNo} — ${t.admin.unpublish}` : `${listing.listingNo} — ${t.admin.publish}`,
                        () => api.togglePublish(listing.id, listing.publishStatus === "published" ? "draft" : "published")
                      )
                    }
                    disabled={rowBusy(listing.id)}
                    className="h-9 rounded-lg bg-surface-2 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isBusy(listing.id, "publish") && <Spinner className="w-3.5 h-3.5" />}
                    {listing.publishStatus === "published" ? t.admin.unpublish : t.admin.publish}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      runAction(
                        listing.id,
                        "feature",
                        listing.featured ? `${listing.listingNo} — ${t.admin.unfeature}` : `${listing.listingNo} — ${t.admin.feature}`,
                        () => api.toggleFeature(listing.id, !listing.featured)
                      )
                    }
                    disabled={rowBusy(listing.id)}
                    className="h-9 rounded-lg bg-surface-2 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isBusy(listing.id, "feature") && <Spinner className="w-3.5 h-3.5" />}
                    {listing.featured ? t.admin.unfeature : t.admin.feature}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(listing)}
                    disabled={rowBusy(listing.id)}
                    className="h-9 rounded-lg bg-red-50 text-red-600 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                    title={t.admin.deleteForever}
                  >
                    {isBusy(listing.id, "delete") && <Spinner className="w-3.5 h-3.5" />}
                    {t.admin.deleteForever}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing !== null && (
        <ListingForm
          listing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            const wasNew = editing === "new";
            setEditing(null);
            load();
            showSuccess(wasNew ? t.admin.listingCreated : t.admin.listingUpdated);
          }}
        />
      )}
    </div>
  );
}

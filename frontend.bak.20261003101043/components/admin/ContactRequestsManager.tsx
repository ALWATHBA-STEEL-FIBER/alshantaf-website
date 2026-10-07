"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { useToast } from "./Toast";
import { EmptyState, Spinner, SkeletonBlock } from "./EmptyState";
import { MessageIcon, PhoneIcon, WhatsappIcon } from "@/components/icons";
import type { ContactRequest, ContactRequestStatus } from "@/lib/types";

const STATUS_STYLE: Record<ContactRequestStatus, string> = {
  new: "bg-surface-2 text-ink",
  contacted: "bg-amber-50 text-amber-700",
  closed: "bg-green/10 text-green",
};

type Tab = "all" | ContactRequestStatus;

export function ContactRequestsManager() {
  const { t } = useLanguage();
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const data = await api.adminContactRequests();
      setRows(data);
      setNotesDraft(Object.fromEntries(data.map((c) => [c.id, c.adminNotes ?? ""])));
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (tab !== "all" && c.status !== tab) return false;
      if (!query) return true;
      return [c.serialNo, c.name, c.phone, c.requestType, c.details]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(query));
    });
  }, [rows, tab, search]);

  async function patch(id: string, data: { status?: ContactRequestStatus; adminNotes?: string | null }) {
    setBusyId(id);
    try {
      const updated = await api.updateContactRequest(id, data);
      setRows((prev) => prev.map((c) => (c.id === id ? updated : c)));
      showSuccess(t.admin.confirm);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm(`${t.admin.delete}?`)) return;
    setBusyId(id);
    try {
      await api.deleteContactRequest(id);
      setRows((prev) => prev.filter((c) => c.id !== id));
      showSuccess(t.admin.delete);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusyId(null);
    }
  }

  const tabs: Tab[] = ["all", "new", "contacted", "closed"];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-green flex items-center gap-2">
            <MessageIcon className="w-5 h-5" />
            {t.admin.contactRequests}
          </h1>
          <p className="text-sm text-ink-soft mt-1">{t.admin.contactRequestsNote}</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.admin.contactSearchPlaceholder}
          className="h-10 w-full sm:w-72 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-gold"
        />
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {tabs.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`h-9 px-3 rounded-full text-xs font-bold ${
              tab === key ? "bg-green text-white" : "bg-white border border-line"
            }`}
          >
            {t.admin.tabsContact[key]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-36" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title={search || tab !== "all" ? t.admin.noSearchResults : t.admin.noContactTitle}
          note={search || tab !== "all" ? t.admin.noContactInTab : t.admin.noContactNote}
        />
      ) : (
        <div className="grid gap-4">
          {visible.map((row) => {
            const busy = busyId === row.id;
            return (
              <article key={row.id} className="bg-white rounded-2xl border border-line p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="font-mono text-sm text-green" dir="ltr">
                        {row.serialNo}
                      </b>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_STYLE[row.status]}`}>
                        {t.admin.tabsContact[row.status]}
                      </span>
                    </div>
                    <h2 className="font-bold text-lg mt-1">{row.name}</h2>
                    <p className="text-sm text-ink-soft mt-1">{row.requestType}</p>
                  </div>
                  <span className="text-xs text-ink-soft">{new Date(row.createdAt).toLocaleString()}</span>
                </div>

                <p className="text-sm text-ink mt-3 leading-relaxed whitespace-pre-wrap">{row.details}</p>

                <div className="mt-3 flex flex-wrap gap-3 text-sm" dir="ltr">
                  <a href={`tel:${row.phone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-1.5 text-green font-bold">
                    <PhoneIcon className="w-3.5 h-3.5" /> {row.phone}
                  </a>
                  <a
                    href={`https://wa.me/${row.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1.5 text-green font-bold"
                  >
                    <WhatsappIcon className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                </div>

                {(row.industryType || row.activityType) && (
                  <p className="text-xs text-ink-soft mt-2">
                    {[row.industryType, row.activityType].filter(Boolean).join(" · ")}
                  </p>
                )}

                <div className="mt-4">
                  <label className="text-[11px] font-bold text-ink-soft mb-1 block">{t.admin.landCheckCard.adminNotes}</label>
                  <textarea
                    className="w-full h-20 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-gold"
                    value={notesDraft[row.id] ?? ""}
                    onChange={(e) => setNotesDraft((d) => ({ ...d, [row.id]: e.target.value }))}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => patch(row.id, { adminNotes: notesDraft[row.id] ?? "" })}
                    className="h-9 px-3 rounded-full border border-line text-xs font-bold disabled:opacity-60"
                  >
                    {busy ? <Spinner className="w-3.5 h-3.5" /> : t.admin.landCheckCard.saveNotes}
                  </button>
                  {row.status !== "contacted" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => patch(row.id, { status: "contacted" })}
                      className="h-9 px-3 rounded-full bg-amber-50 text-amber-800 text-xs font-bold disabled:opacity-60"
                    >
                      {t.admin.landCheckCard.markContacted}
                    </button>
                  )}
                  {row.status !== "closed" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => patch(row.id, { status: "closed" })}
                      className="h-9 px-3 rounded-full bg-green/10 text-green text-xs font-bold disabled:opacity-60"
                    >
                      {t.admin.landCheckCard.markClosed}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(row.id)}
                    className="h-9 px-3 rounded-full bg-red-50 text-red-700 text-xs font-bold disabled:opacity-60 ms-auto"
                  >
                    {t.admin.landCheckCard.delete}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

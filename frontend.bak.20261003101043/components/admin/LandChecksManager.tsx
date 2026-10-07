"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { useToast } from "./Toast";
import { EmptyState, Spinner, SkeletonBlock } from "./EmptyState";
import { localizePlaceName } from "@/lib/localizePlace";
import { formatMoney } from "@/lib/adminPricing";
import type { LandCheck, LandCheckStatus } from "@/lib/types";

const STATUS_STYLE: Record<LandCheckStatus, string> = {
  new: "bg-surface-2 text-ink",
  contacted: "bg-amber-50 text-amber-700",
  closed: "bg-green/10 text-green",
};

type Tab = "all" | LandCheckStatus;

export function LandChecksManager() {
  const { t, lang } = useLanguage();
  const { showSuccess, showError } = useToast();
  const [checks, setChecks] = useState<LandCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const data = await api.adminLandChecks();
      setChecks(data);
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
    return checks.filter((c) => {
      if (tab !== "all" && c.status !== tab) return false;
      if (!query) return true;
      return [c.serialNo, c.name, c.phone, c.village, c.basin, c.parcel, c.email]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(query));
    });
  }, [checks, tab, search]);

  async function patch(id: string, data: { status?: LandCheckStatus; adminNotes?: string | null }) {
    setBusyId(id);
    try {
      const updated = await api.updateLandCheck(id, data);
      setChecks((prev) => prev.map((c) => (c.id === id ? updated : c)));
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
      await api.deleteLandCheck(id);
      setChecks((prev) => prev.filter((c) => c.id !== id));
      showSuccess(t.admin.delete);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.saveFailed);
    } finally {
      setBusyId(null);
    }
  }

  const card = t.admin.landCheckCard;

  if (loading) {
    return (
      <div>
        <SkeletonBlock className="h-8 w-48 mb-6" />
        <SkeletonBlock className="h-40 mb-4" />
        <SkeletonBlock className="h-40" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-green mb-4">{t.admin.sidebar.landChecks}</h1>
      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "new", "contacted", "closed"] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`h-9 px-3 rounded-full text-xs font-bold ${
              tab === key ? "bg-green text-white" : "bg-surface-2 text-ink-soft"
            }`}
          >
            {t.admin.tabsLandChecks[key]}
          </button>
        ))}
      </div>
      <input
        className="w-full max-w-md h-11 rounded-xl border border-line bg-white px-3 text-sm mb-6 outline-none focus:border-gold"
        placeholder={t.admin.landCheckSearchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {checks.length === 0 ? (
        <EmptyState title={t.admin.noLandChecksTitle} note={t.admin.noLandChecksNote} />
      ) : visible.length === 0 ? (
        <EmptyState title={search ? t.admin.noSearchResults : t.admin.noLandChecksInTab} />
      ) : (
        <div className="grid gap-4">
          {visible.map((c) => (
            <article key={c.id} className="bg-white rounded-2xl border border-line p-5">
              <div className="flex flex-wrap justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <b className="font-mono text-sm" dir="ltr">
                      {c.serialNo}
                    </b>
                    <span className={`text-[11px] px-2 py-1 rounded-full font-bold ${STATUS_STYLE[c.status]}`}>
                      {t.admin.tabsLandChecks[c.status]}
                    </span>
                    {c.isDraft && (
                      <span className="text-[11px] px-2 py-1 rounded-full font-bold bg-amber-50 text-amber-800">
                        {card.draft}
                      </span>
                    )}
                    {!c.parcel && (
                      <span className="text-[11px] px-2 py-1 rounded-full font-bold bg-surface-2 text-ink-soft">
                        {card.incomplete}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft mt-1">{new Date(c.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-sm font-bold">
                  {c.village ? localizePlaceName(c.village, lang) : "—"}
                  {c.parcel ? ` — ${c.parcel}` : ""}
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-2 text-sm mb-3">
                <div>
                  <small className="block text-[10px] text-ink-soft">{card.contact}</small>
                  {c.name || c.phone || c.email
                    ? [c.name, c.phone, c.email].filter(Boolean).join(" · ")
                    : card.noContact}
                </div>
                <div>
                  <small className="block text-[10px] text-ink-soft">{t.admin.submissionCard.governorate}</small>
                  {c.governorate || c.directorate
                    ? `${c.governorate ? localizePlaceName(c.governorate, lang) : "—"} / ${c.directorate ? localizePlaceName(c.directorate, lang) : "—"}`
                    : "—"}
                </div>
                <div>
                  <small className="block text-[10px] text-ink-soft">{card.parcel}</small>
                  {[c.basin ? localizePlaceName(c.basin, lang) : null, c.neighborhood, c.parcel]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </div>
                <div>
                  <small className="block text-[10px] text-ink-soft">{card.area}</small>
                  {c.areaLabel || (c.areaSqm != null ? `${c.areaSqm} m²` : "—")}
                </div>
                <div>
                  <small className="block text-[10px] text-ink-soft">{card.perimeter}</small>
                  {c.perimeterM != null ? `${Math.round(c.perimeterM)} m` : "—"}
                </div>
                <div>
                  <small className="block text-[10px] text-ink-soft">{card.adminValue}</small>
                  {c.administrativeValue != null ? `${formatMoney(c.administrativeValue, lang)} JOD` : "—"}
                </div>
                <div>
                  <small className="block text-[10px] text-ink-soft">{card.median}</small>
                  {c.estimatedMedian != null ? `${formatMoney(c.estimatedMedian, lang)} JOD` : "—"}
                </div>
                <div>
                  <small className="block text-[10px] text-ink-soft">{card.regulation}</small>
                  {c.industryType ? t.offers.industry[c.industryType] : "—"}
                </div>
                <div>
                  <small className="block text-[10px] text-ink-soft">{card.dlsKey}</small>
                  <span className="font-mono text-xs" dir="ltr">
                    {c.dlsKey || "—"}
                  </span>
                </div>
                {c.notes && (
                  <div className="sm:col-span-3">
                    <small className="block text-[10px] text-ink-soft">{card.notes}</small>
                    {c.notes}
                  </div>
                )}
              </div>

              <div className="mb-3">
                <label className="text-[10px] text-ink-soft font-bold block mb-1">{card.adminNotes}</label>
                <textarea
                  className="w-full h-20 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-gold"
                  value={notesDraft[c.id] ?? ""}
                  onChange={(e) => setNotesDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => patch(c.id, { adminNotes: notesDraft[c.id] ?? "" })}
                  className="h-9 px-3 rounded-lg border border-line text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                >
                  {busyId === c.id && <Spinner className="w-3.5 h-3.5" />}
                  {card.saveNotes}
                </button>
                {c.status !== "contacted" && (
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => patch(c.id, { status: "contacted" })}
                    className="h-9 px-3 rounded-lg bg-amber-50 text-amber-800 text-xs font-bold disabled:opacity-50"
                  >
                    {card.markContacted}
                  </button>
                )}
                {c.status !== "closed" && (
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => patch(c.id, { status: "closed" })}
                    className="h-9 px-3 rounded-lg bg-green/10 text-green text-xs font-bold disabled:opacity-50"
                  >
                    {card.markClosed}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => remove(c.id)}
                  className="h-9 px-3 rounded-lg text-red-600 text-xs font-bold disabled:opacity-50 ms-auto"
                >
                  {card.delete}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

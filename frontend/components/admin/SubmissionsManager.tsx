"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { localizePlaceName } from "@/lib/localizePlace";
import { useToast } from "./Toast";
import { EmptyState, Spinner, SkeletonBlock } from "./EmptyState";
import { ApproveSubmissionModal } from "./ApproveSubmissionModal";
import type { Submission, SubmissionStatus } from "@/lib/types";

const STATUS_STYLE: Record<SubmissionStatus, string> = {
  pending: "bg-surface-2 text-ink",
  duplicate_review: "bg-amber-50 text-amber-700",
  needs_info: "bg-amber-50 text-amber-700",
  approved: "bg-green/10 text-green",
  rejected: "bg-red-50 text-red-600",
};

type Action = "needs_info" | "rejected";
type Tab = "all" | SubmissionStatus;

export function SubmissionsManager() {
  const { t, lang } = useLanguage();
  const { showSuccess, showError } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<{ id: string; action: Action } | null>(null);
  const [approving, setApproving] = useState<Submission | null>(null);

  async function load() {
    setSubmissions(await api.adminSubmissions());
  }

  useEffect(() => {
    let ignore = false;
    api.adminSubmissions().then((data) => {
      if (ignore) return;
      setSubmissions(data);
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

  const isBusy = (id: string, action: Action) => busy?.id === id && busy.action === action;
  const rowBusy = (id: string) => busy?.id === id;

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: submissions.length, pending: 0, duplicate_review: 0, needs_info: 0, approved: 0, rejected: 0 };
    submissions.forEach((s) => c[s.status]++);
    return c;
  }, [submissions]);

  const byTab = tab === "all" ? submissions : submissions.filter((s) => s.status === tab);
  const query = search.trim().toLowerCase();
  const visible = query
    ? byTab.filter((s) =>
        [s.applicant, s.village, s.serialNo, s.trackingCode].some((field) => field?.toLowerCase().includes(query))
      )
    : byTab;
  const tabs: Tab[] = ["all", "pending", "duplicate_review", "needs_info", "approved", "rejected"];

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-green mb-4">{t.admin.submissionsTitle}</h1>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t.admin.submissionSearchPlaceholder}
        className="w-full h-11 rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-gold mb-4"
      />

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
            {t.admin.tabsSubmissions[key]}
            <span className={`text-[10px] ${tab === key ? "text-white/80" : "text-ink-soft"}`}>{counts[key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-40" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <EmptyState title={t.admin.noSubmissionsTitle} note={t.admin.noSubmissionsNote} />
      ) : visible.length === 0 ? (
        <EmptyState title={query ? t.admin.noSearchResults : t.admin.noSubmissionsInTab} />
      ) : (
        <div className="grid gap-4">
          {visible.map((s) => (
            <article key={s.id} className="bg-white rounded-2xl border border-line p-5">
              <div className="flex flex-wrap justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <b>{localizePlaceName(s.village || "", lang) || "—"} — {s.parcel}</b>
                    <span className="text-[10px] font-mono text-ink-soft bg-surface-2 px-1.5 py-0.5 rounded" dir="ltr">
                      {s.serialNo}
                    </span>
                  </div>
                  <p className="text-xs text-ink-soft">
                    {s.applicant} • {new Date(s.submittedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-[11px] bg-surface-2 px-2 py-1 rounded-full">
                    {s.source === "broker" ? t.admin.submissionCard.broker : t.admin.submissionCard.owner}
                  </span>
                  {s.duplicate && <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-1 rounded-full">{t.admin.submissionCard.duplicate}</span>}
                  <span className={`text-[11px] px-2 py-1 rounded-full font-bold ${STATUS_STYLE[s.status]}`}>{t.admin.tabsSubmissions[s.status]}</span>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-2 text-sm mb-3">
                <div>
                  <small className="block text-[10px] text-ink-soft">{t.admin.submissionCard.governorate}</small>
                  {s.governorate ? localizePlaceName(s.governorate, lang) : "—"}
                </div>
                <div>
                  <small className="block text-[10px] text-ink-soft">{t.admin.submissionCard.basinParcel}</small>
                  {s.basin ? localizePlaceName(s.basin, lang) : "—"} / {s.parcel || "—"}
                </div>
                <div>
                  <small className="block text-[10px] text-ink-soft">{t.admin.submissionCard.phone}</small>
                  {s.phone}
                </div>
                <div className="sm:col-span-3">
                  <small className="block text-[10px] text-ink-soft">{t.admin.submissionCard.details}</small>
                  {s.details}
                </div>
              </div>

              {(s.images.length > 0 || s.video || s.document) && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {s.images.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener">
                      <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-line" />
                    </a>
                  ))}
                  {s.video && (
                    <a
                      href={s.video}
                      target="_blank"
                      rel="noopener"
                      className="w-16 h-16 rounded-lg border border-line bg-surface-2 flex items-center justify-center text-[10px] font-bold text-ink-soft"
                    >
                      ▶ {t.admin.submissionCard.video}
                    </a>
                  )}
                  {s.document && (
                    <a
                      href={s.document}
                      target="_blank"
                      rel="noopener"
                      className="w-16 h-16 rounded-lg border border-line bg-surface-2 flex items-center justify-center text-[10px] font-bold text-ink-soft"
                    >
                      {t.admin.submissionCard.pdf}
                    </a>
                  )}
                </div>
              )}

              {(s.reviewer || s.reviewNote || s.reviewedAt) && (
                <div className="bg-surface-2 rounded-lg p-3 mb-3 text-xs text-ink-soft">
                  {s.reviewer && (
                    <span>
                      {t.admin.submissionCard.reviewedBy} <b className="text-ink">{s.reviewer}</b>
                    </span>
                  )}
                  {s.reviewedAt && <span> • {new Date(s.reviewedAt).toLocaleString()}</span>}
                  {s.reviewNote && <p className="mt-1">{s.reviewNote}</p>}
                </div>
              )}

              {s.convertedListingId && <p className="text-xs text-green mb-3">{t.admin.submissionCard.convertedNote}</p>}

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                {!s.convertedListingId && (
                  <button
                    onClick={() => setApproving(s)}
                    disabled={rowBusy(s.id)}
                    type="button"
                    className="h-9 px-3 rounded-lg bg-green text-white text-xs font-bold disabled:opacity-50"
                  >
                    {t.admin.approve}
                  </button>
                )}
                <button
                  onClick={() =>
                    runAction(s.id, "needs_info", `${t.admin.requestedInfoFrom} ${s.applicant}`, () =>
                      api.updateSubmission(s.id, { status: "needs_info", reviewer: "Alshantaf Admin" })
                    )
                  }
                  disabled={rowBusy(s.id)}
                  type="button"
                  className="h-9 px-3 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isBusy(s.id, "needs_info") && <Spinner className="w-3.5 h-3.5" />}
                  {t.admin.needsInfo}
                </button>
                <button
                  onClick={() =>
                    runAction(s.id, "rejected", t.admin.submissionRejected, () =>
                      api.updateSubmission(s.id, { status: "rejected", reviewer: "Alshantaf Admin" })
                    )
                  }
                  disabled={rowBusy(s.id)}
                  type="button"
                  className="h-9 px-3 rounded-lg bg-red-50 text-red-600 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isBusy(s.id, "rejected") && <Spinner className="w-3.5 h-3.5" />}
                  {t.admin.reject}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {approving && (
        <ApproveSubmissionModal
          submission={approving}
          onClose={() => setApproving(null)}
          onApproved={() => {
            setApproving(null);
            load();
          }}
        />
      )}
    </div>
  );
}

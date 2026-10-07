"use client";

import { useLanguage } from "@/lib/LanguageProvider";
import { localizePlaceName } from "@/lib/localizePlace";
import type { SubmissionTracking } from "@/lib/types";

const STATUS_DOT: Record<SubmissionTracking["status"], string> = {
  pending: "bg-surface-2 text-ink",
  duplicate_review: "bg-amber-50 text-amber-700",
  needs_info: "bg-amber-50 text-amber-700",
  approved: "bg-green/10 text-green",
  rejected: "bg-red-50 text-red-600",
};

export function TrackStatus({ tracking }: { tracking: SubmissionTracking }) {
  const { t, lang } = useLanguage();

  return (
    <div className="mt-8 bg-white rounded-2xl border border-line p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <small className="block text-[10px] text-ink-soft">{t.trackPage.serialLabel}</small>
          <b className="font-mono">{tracking.serialNo}</b>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${STATUS_DOT[tracking.status]}`}>
          {t.admin.tabsSubmissions[tracking.status]}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-5">
        {tracking.village && (
          <div>
            <small className="block text-[10px] text-ink-soft">{t.trackPage.villageLabel}</small>
            <span className="text-sm">{localizePlaceName(tracking.village, lang)}</span>
          </div>
        )}
        <div>
          <small className="block text-[10px] text-ink-soft">{t.trackPage.submittedLabel}</small>
          <span className="text-sm">{new Date(tracking.submittedAt).toLocaleDateString()}</span>
        </div>
        {tracking.reviewedAt && (
          <div>
            <small className="block text-[10px] text-ink-soft">{t.trackPage.reviewedLabel}</small>
            <span className="text-sm">{new Date(tracking.reviewedAt).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {tracking.reviewNote && (
        <div className="mt-4 bg-amber-50 text-amber-800 rounded-xl p-3 text-sm">
          <small className="block text-[10px] font-bold">{t.trackPage.reviewNoteLabel}</small>
          {tracking.reviewNote}
        </div>
      )}

      {tracking.convertedListingId && (
        <a
          href={`/offers/${tracking.convertedListingId}`}
          className="mt-4 block bg-green/10 text-green rounded-xl p-3 text-sm font-bold text-center hover:bg-green/15 transition-colors"
        >
          {t.trackPage.convertedNote}
        </a>
      )}
    </div>
  );
}

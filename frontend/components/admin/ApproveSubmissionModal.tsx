"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { useToast } from "./Toast";
import { Spinner } from "./EmptyState";
import { CheckIcon } from "@/components/icons";
import type { StandbyImage, Submission } from "@/lib/types";

export function ApproveSubmissionModal({
  submission,
  onClose,
  onApproved,
}: {
  submission: Submission;
  onClose: () => void;
  onApproved: () => void;
}) {
  const { t } = useLanguage();
  const { showSuccess, showError } = useToast();
  const [publish, setPublish] = useState(true);
  const [includeParcel, setIncludeParcel] = useState(false);
  const [includePrice, setIncludePrice] = useState(true);
  const [includeDocument, setIncludeDocument] = useState(false);
  const [includeVideo, setIncludeVideo] = useState(true);
  const [selectedImages, setSelectedImages] = useState<string[]>([...submission.images]);
  const [standby, setStandby] = useState<StandbyImage[]>([]);
  const [standbyLoading, setStandbyLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    api
      .standbyImages()
      .then((items) => {
        if (!ignore) setStandby(items);
      })
      .catch(() => {
        if (!ignore) setStandby([]);
      })
      .finally(() => {
        if (!ignore) setStandbyLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  function toggleImage(url: string) {
    setSelectedImages((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const listing = await api.approveSubmission(submission.id, {
        publish,
        includeParcel,
        includePrice,
        includeDocument,
        includeVideo,
        imageUrls: selectedImages,
      });
      showSuccess(`${listing.listingNo} ${publish ? t.admin.approveModal.approvedPublished : t.admin.approveModal.approvedDraft}`);
      onApproved();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.approveModal.approveFailed);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedSet = new Set(selectedImages);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-green">{t.admin.approveModal.title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-ink-soft">
            {t.admin.close}
          </button>
        </div>
        <p className="text-xs text-ink-soft -mt-2">{t.admin.approveModal.subtitle}</p>

        <label className="flex items-center justify-between gap-2 bg-surface-2 rounded-xl p-3">
          <span className="text-sm font-bold">{t.admin.approveModal.publishNow}</span>
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="w-5 h-5 accent-green" />
        </label>

        <div className="grid gap-2">
          <label className="flex items-center justify-between gap-2 border border-line rounded-xl p-3">
            <span className="text-sm">{t.admin.approveModal.exactLand}</span>
            <input type="checkbox" checked={includeParcel} onChange={(e) => setIncludeParcel(e.target.checked)} className="w-5 h-5 accent-green" />
          </label>
          <label className="flex items-center justify-between gap-2 border border-line rounded-xl p-3">
            <span className="text-sm">
              {t.admin.approveModal.price} {submission.price ? `(${submission.price})` : t.admin.approveModal.priceNotProvided}
            </span>
            <input
              type="checkbox"
              checked={includePrice}
              disabled={!submission.price}
              onChange={(e) => setIncludePrice(e.target.checked)}
              className="w-5 h-5 accent-green"
            />
          </label>
          {submission.document && (
            <label className="flex items-center justify-between gap-2 border border-line rounded-xl p-3">
              <span className="text-sm">{t.admin.approveModal.pdf}</span>
              <input type="checkbox" checked={includeDocument} onChange={(e) => setIncludeDocument(e.target.checked)} className="w-5 h-5 accent-green" />
            </label>
          )}
          {submission.video && (
            <label className="flex items-center justify-between gap-2 border border-line rounded-xl p-3">
              <span className="text-sm">{t.admin.approveModal.video}</span>
              <input type="checkbox" checked={includeVideo} onChange={(e) => setIncludeVideo(e.target.checked)} className="w-5 h-5 accent-green" />
            </label>
          )}
        </div>

        <div>
          <p className="text-xs font-bold text-ink-soft mb-2">
            {t.admin.approveModal.images} ({selectedImages.length} {t.admin.approveModal.selected})
          </p>

          {submission.images.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] font-bold text-green mb-2">{t.admin.approveModal.submissionImages}</p>
              <div className="grid grid-cols-4 gap-2">
                {submission.images.map((url) => (
                  <ImagePick key={url} url={url} checked={selectedSet.has(url)} onToggle={() => toggleImage(url)} />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] font-bold text-green mb-2">{t.admin.approveModal.standbyImages}</p>
            {standbyLoading ? (
              <div className="flex items-center gap-2 text-xs text-ink-soft py-3">
                <Spinner className="w-4 h-4" />
              </div>
            ) : standby.length === 0 ? (
              <p className="text-xs text-ink-soft bg-surface-2 rounded-xl p-3">{t.admin.approveModal.noStandby}</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {standby.map((item) => (
                  <ImagePick key={item.id} url={item.url} checked={selectedSet.has(item.url)} onToggle={() => toggleImage(item.url)} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={submitting} className="h-11 px-5 rounded-full border border-line text-sm font-bold">
            {t.admin.approveModal.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="h-11 px-6 rounded-full bg-green text-white text-sm font-bold disabled:opacity-60 flex items-center gap-2"
          >
            {submitting && <Spinner className="w-4 h-4" />}
            {publish ? t.admin.approveModal.confirmPublish : t.admin.approveModal.confirmDraft}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImagePick({ url, checked, onToggle }: { url: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative rounded-lg overflow-hidden border-2 ${checked ? "border-green" : "border-transparent opacity-40"}`}
    >
      <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-16 object-cover" />
      {checked && (
        <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-green text-white flex items-center justify-center">
          <CheckIcon />
        </span>
      )}
    </button>
  );
}

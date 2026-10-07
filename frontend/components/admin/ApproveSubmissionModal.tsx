"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { useToast } from "./Toast";
import { Spinner } from "./EmptyState";
import { CheckIcon } from "@/components/icons";
import { normalizeDecimalInput, toWesternDigits } from "@/lib/arabicDigits";
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
  const m = t.admin.approveModal;
  const [publish, setPublish] = useState(true);
  const [includeParcel, setIncludeParcel] = useState(false);
  const [includePrice, setIncludePrice] = useState(Boolean(submission.price));
  const [includeDocument, setIncludeDocument] = useState(false);
  const [includeVideo, setIncludeVideo] = useState(true);
  const [showEstimatedValue, setShowEstimatedValue] = useState(true);
  const [selectedImages, setSelectedImages] = useState<string[]>([...submission.images]);
  const [standby, setStandby] = useState<StandbyImage[]>([]);
  const [standbyLoading, setStandbyLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [edits, setEdits] = useState({
    title: submission.village ? `أرض صناعية في ${submission.village}` : "",
    price: submission.price ?? "",
    description: submission.details ?? "",
    phone: submission.phone ?? "",
    village: submission.village ?? "",
    basin: submission.basin ?? "",
    neighborhood: submission.neighborhood ?? "",
    parcel: submission.parcel ?? "",
  });

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

  function updateEdit(key: keyof typeof edits) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const raw = e.target.value;
      const value =
        key === "price" || key === "phone" || key === "parcel"
          ? toWesternDigits(raw)
          : raw;
      setEdits((f) => ({ ...f, [key]: value }));
    };
  }

  async function handleConfirm() {
    const normalizedPrice = normalizeDecimalInput(edits.price);
    if (includePrice && normalizedPrice && !/^\d+(\.\d+)?$/.test(normalizedPrice)) {
      showError(m.pricePerSqmNumberError);
      return;
    }
    setSubmitting(true);
    try {
      const listing = await api.approveSubmission(submission.id, {
        publish,
        includeParcel,
        includePrice,
        includeDocument,
        includeVideo,
        showEstimatedValue,
        imageUrls: selectedImages,
        edits: {
          title: edits.title.trim() || undefined,
          price: normalizedPrice || undefined,
          description: edits.description.trim() || undefined,
          phone: edits.phone.trim() || undefined,
          village: edits.village.trim() || undefined,
          basin: edits.basin.trim() || undefined,
          neighborhood: edits.neighborhood.trim() || undefined,
          parcel: edits.parcel.trim() || undefined,
        },
      });
      showSuccess(
        `${listing.listingNo} ${publish ? m.approvedPublished : m.approvedDraft}`
      );
      onApproved();
    } catch (err) {
      showError(err instanceof ApiError ? err.message : m.approveFailed);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedSet = new Set(selectedImages);
  const inputClass =
    "w-full h-10 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-gold/50";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-green">{m.title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-ink-soft">
            {t.admin.close}
          </button>
        </div>
        <p className="text-xs text-ink-soft -mt-2">{m.subtitle}</p>

        <label className="flex items-center justify-between gap-2 bg-surface-2 rounded-xl p-3">
          <span className="text-sm font-bold">{m.publishNow}</span>
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            className="w-5 h-5 accent-green"
          />
        </label>

        <div className="rounded-xl border border-line p-3 flex flex-col gap-2.5">
          <p className="text-xs font-bold text-green">{m.editBeforePublish}</p>
          <label className="text-[11px] font-bold text-ink-soft">
            {m.editTitle}
            <input className={`${inputClass} mt-1`} value={edits.title} onChange={updateEdit("title")} />
          </label>
          <label className="text-[11px] font-bold text-ink-soft">
            {m.editPrice}
            <input
              className={`${inputClass} mt-1`}
              dir="ltr"
              value={edits.price}
              onChange={updateEdit("price")}
              inputMode="decimal"
              pattern="^\\d+(\\.\\d+)?$"
              placeholder="60"
              disabled={!includePrice}
            />
            <p className="mt-1 text-[10px] font-normal text-ink-soft">{m.pricePerSqmNote}</p>
          </label>
          <label className="text-[11px] font-bold text-ink-soft">
            {m.editPhone}
            <input className={`${inputClass} mt-1`} dir="ltr" value={edits.phone} onChange={updateEdit("phone")} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-bold text-ink-soft">
              {m.editVillage}
              <input className={`${inputClass} mt-1`} value={edits.village} onChange={updateEdit("village")} />
            </label>
            <label className="text-[11px] font-bold text-ink-soft">
              {m.editParcel}
              <input
                className={`${inputClass} mt-1`}
                dir="ltr"
                value={edits.parcel}
                onChange={updateEdit("parcel")}
                disabled={!includeParcel}
              />
            </label>
            <label className="text-[11px] font-bold text-ink-soft">
              {m.editBasin}
              <input
                className={`${inputClass} mt-1`}
                value={edits.basin}
                onChange={updateEdit("basin")}
                disabled={!includeParcel}
              />
            </label>
            <label className="text-[11px] font-bold text-ink-soft">
              {m.editNeighborhood}
              <input
                className={`${inputClass} mt-1`}
                value={edits.neighborhood}
                onChange={updateEdit("neighborhood")}
                disabled={!includeParcel}
              />
            </label>
          </div>
          <label className="text-[11px] font-bold text-ink-soft">
            {m.editDescription}
            <textarea
              className="mt-1 w-full min-h-[88px] rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-gold/50"
              value={edits.description}
              onChange={updateEdit("description")}
            />
          </label>
        </div>

        <div className="grid gap-2">
          <label className="flex items-center justify-between gap-2 border border-line rounded-xl p-3">
            <span className="text-sm">{m.exactLand}</span>
            <input
              type="checkbox"
              checked={includeParcel}
              onChange={(e) => setIncludeParcel(e.target.checked)}
              className="w-5 h-5 accent-green"
            />
          </label>
          <label className="flex items-center justify-between gap-2 border border-line rounded-xl p-3">
            <span className="text-sm">
              {m.price} {edits.price ? `(${edits.price})` : m.priceNotProvided}
            </span>
            <input
              type="checkbox"
              checked={includePrice}
              onChange={(e) => setIncludePrice(e.target.checked)}
              className="w-5 h-5 accent-green"
            />
          </label>
          <label className="flex items-center justify-between gap-2 border border-line rounded-xl p-3">
            <span className="text-sm">{m.showEstimatedValue}</span>
            <input
              type="checkbox"
              checked={showEstimatedValue}
              onChange={(e) => setShowEstimatedValue(e.target.checked)}
              className="w-5 h-5 accent-green"
            />
          </label>
          {submission.document && (
            <label className="flex items-center justify-between gap-2 border border-line rounded-xl p-3">
              <span className="text-sm">{m.pdf}</span>
              <input
                type="checkbox"
                checked={includeDocument}
                onChange={(e) => setIncludeDocument(e.target.checked)}
                className="w-5 h-5 accent-green"
              />
            </label>
          )}
          {submission.video && (
            <label className="flex items-center justify-between gap-2 border border-line rounded-xl p-3">
              <span className="text-sm">{m.video}</span>
              <input
                type="checkbox"
                checked={includeVideo}
                onChange={(e) => setIncludeVideo(e.target.checked)}
                className="w-5 h-5 accent-green"
              />
            </label>
          )}
        </div>

        <div>
          <p className="text-xs font-bold text-ink-soft mb-2">
            {m.images} ({selectedImages.length} {m.selected})
          </p>

          {submission.images.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] font-bold text-green mb-2">{m.submissionImages}</p>
              <div className="grid grid-cols-4 gap-2">
                {submission.images.map((url) => (
                  <ImagePick key={url} url={url} checked={selectedSet.has(url)} onToggle={() => toggleImage(url)} />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] font-bold text-green mb-2">{m.standbyImages}</p>
            {standbyLoading ? (
              <div className="flex items-center gap-2 text-xs text-ink-soft py-3">
                <Spinner className="w-4 h-4" />
              </div>
            ) : standby.length === 0 ? (
              <p className="text-xs text-ink-soft bg-surface-2 rounded-xl p-3">{m.noStandby}</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {standby.map((item) => (
                  <ImagePick
                    key={item.id}
                    url={item.url}
                    checked={selectedSet.has(item.url)}
                    onToggle={() => toggleImage(item.url)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-11 px-5 rounded-full border border-line text-sm font-bold"
          >
            {m.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="h-11 px-6 rounded-full bg-green text-white text-sm font-bold disabled:opacity-60 flex items-center gap-2"
          >
            {submitting && <Spinner className="w-4 h-4" />}
            {publish ? m.confirmPublish : m.confirmDraft}
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

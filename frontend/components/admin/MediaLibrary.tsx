"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { api, ApiError } from "@/lib/api";
import { useToast } from "./Toast";
import { EmptyState, Spinner, SkeletonBlock } from "./EmptyState";
import type { MediaItem, StandbyImage } from "@/lib/types";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function MediaLibrary() {
  const { t } = useLanguage();
  const { showSuccess, showError } = useToast();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [standby, setStandby] = useState<StandbyImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [deletingStandby, setDeletingStandby] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [media, standbyItems] = await Promise.all([api.media(), api.standbyImages()]);
    setItems(media);
    setStandby(standbyItems);
  }

  useEffect(() => {
    let ignore = false;
    Promise.all([api.media(), api.standbyImages()]).then(([media, standbyItems]) => {
      if (!ignore) {
        setItems(media);
        setStandby(standbyItems);
        setLoading(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  async function handleDelete(item: MediaItem) {
    if (item.used) {
      showError(t.admin.fileInUse);
      return;
    }
    if (!confirm(`${t.admin.deleteFile}: ${item.filename}?`)) return;
    setDeletingFile(item.filename);
    try {
      await api.deleteMedia(item.filename);
      await load();
      showSuccess(`${item.filename} — ${t.admin.mediaDeleted}`);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.deleteFileFailed);
    } finally {
      setDeletingFile(null);
    }
  }

  async function handleStandbyUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError(t.admin.standbyUploadFailed);
      return;
    }
    setUploading(true);
    try {
      const uploaded = await api.upload(file);
      await api.createStandbyImage({ url: uploaded.url, title: file.name.replace(/\.[^.]+$/, "") });
      await load();
      showSuccess(t.admin.standbyAdded);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.standbyUploadFailed);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteStandby(item: StandbyImage) {
    if (!confirm(`${t.admin.standbyRemove}: ${item.title || item.url}?`)) return;
    setDeletingStandby(item.id);
    try {
      await api.deleteStandbyImage(item.id);
      await load();
      showSuccess(t.admin.standbyDeleted);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t.admin.standbyDeleteFailed);
    } finally {
      setDeletingStandby(null);
    }
  }

  const isImage = (filename: string) => /\.(webp|jpg|jpeg|png|gif)$/i.test(filename);
  const standbyUrls = new Set(standby.map((s) => s.url));

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-green">{t.admin.standbyTitle}</h1>
            <p className="text-xs text-ink-soft mt-1 max-w-xl">{t.admin.standbyNote}</p>
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleStandbyUpload} />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="h-10 px-4 rounded-full bg-green text-white text-xs font-bold disabled:opacity-60 inline-flex items-center gap-2"
            >
              {uploading && <Spinner className="w-3.5 h-3.5" />}
              {uploading ? t.admin.standbyUploading : t.admin.standbyUpload}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-40" />
            ))}
          </div>
        ) : standby.length === 0 ? (
          <EmptyState title={t.admin.standbyEmpty} note={t.admin.standbyNote} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {standby.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl border border-gold/40 overflow-hidden">
                <div className="h-24 bg-surface-2">
                  <img src={item.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                </div>
                <div className="p-2">
                  <p className="text-[10px] text-ink-soft truncate">{item.title || item.url.split("/").pop()}</p>
                  <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full bg-gold/15 text-[#6b4d1f] font-bold">
                    {t.admin.standbyTitle}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteStandby(item)}
                    disabled={deletingStandby === item.id}
                    className="w-full mt-2 h-7 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold disabled:opacity-40 flex items-center justify-center gap-1"
                  >
                    {deletingStandby === item.id && <Spinner className="w-3 h-3" />}
                    {t.admin.standbyRemove}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-green">{t.admin.media}</h2>
          <span className="text-xs text-ink-soft">
            {items.length} {t.admin.files}
          </span>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-40" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title={t.admin.noMediaTitle} note={t.admin.noMediaNote} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {items.map((item) => (
              <div key={item.filename} className="bg-white rounded-2xl border border-line overflow-hidden">
                <div className="h-24 bg-surface-2 flex items-center justify-center">
                  {isImage(item.filename) ? (
                    <img src={item.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-ink-soft font-bold">{item.filename.split(".").pop()?.toUpperCase()}</span>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[10px] text-ink-soft truncate">{item.filename}</p>
                  <div className="flex items-center justify-between mt-1 gap-1 flex-wrap">
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full ${item.used ? "bg-green/10 text-green" : "bg-amber-50 text-amber-700"}`}
                    >
                      {item.used ? t.admin.used : t.admin.unused}
                    </span>
                    {standbyUrls.has(item.url) && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/15 text-[#6b4d1f] font-bold">standby</span>
                    )}
                    <span className="text-[9px] text-ink-soft">{formatBytes(item.size)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={item.used || deletingFile === item.filename}
                    className="w-full mt-2 h-7 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold disabled:opacity-40 flex items-center justify-center gap-1"
                  >
                    {deletingFile === item.filename && <Spinner className="w-3 h-3" />}
                    {t.admin.delete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

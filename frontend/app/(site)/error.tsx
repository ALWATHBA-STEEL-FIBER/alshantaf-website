"use client";

import { useEffect } from "react";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("site error", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center rounded-3xl border border-line bg-white p-8 shadow-[0_24px_60px_-36px_rgba(15,52,47,0.45)]">
        <p className="text-gold text-xs font-bold tracking-wide">ALSHANTAF</p>
        <h1 className="mt-2 text-2xl font-bold text-green">تعذّر تحميل الصفحة</h1>
        <p className="mt-2 text-sm text-ink-soft leading-relaxed">
          This page couldn’t load. Reload to try again, or go back.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="h-11 px-6 rounded-full bg-green text-white text-sm font-bold hover:bg-green-2"
          >
            Reload
          </button>
          <a
            href="/"
            className="h-11 px-6 rounded-full border border-line text-sm font-bold flex items-center justify-center hover:border-gold/50"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

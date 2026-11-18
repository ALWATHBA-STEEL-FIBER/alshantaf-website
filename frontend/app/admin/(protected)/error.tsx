"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-line bg-white p-6 text-center">
        <h1 className="text-lg font-bold text-green">Admin page failed to load</h1>
        <p className="text-xs text-ink-soft mt-2">{error?.message || "Unexpected error"}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 h-10 px-5 rounded-full bg-green text-white text-xs font-bold"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

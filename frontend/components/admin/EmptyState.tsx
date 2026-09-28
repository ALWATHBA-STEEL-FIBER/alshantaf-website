export function EmptyState({ title, note }: { title: string; note?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-line p-12 text-center">
      <div className="w-10 h-10 rounded-full bg-surface-2 mx-auto mb-3" aria-hidden />
      <b className="block text-ink">{title}</b>
      {note && <p className="text-sm text-ink-soft mt-1">{note}</p>}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-2 rounded-xl ${className}`} />;
}

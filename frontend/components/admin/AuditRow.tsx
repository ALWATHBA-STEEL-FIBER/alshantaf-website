"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/LanguageProvider";
import { formatAudit, TONE_CLASS } from "@/lib/auditFormat";
import type { AuditLogEntry } from "@/lib/types";

export function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const display = formatAudit(entry, t);
  const hasMore = Boolean(entry.metadata && Object.keys(entry.metadata).length > 0);

  return (
    <div className="p-3">
      <button
        type="button"
        onClick={() => hasMore && setExpanded((v) => !v)}
        className={`w-full flex flex-wrap items-center justify-between gap-2 text-start ${hasMore ? "cursor-pointer" : "cursor-default"}`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TONE_CLASS[display.tone]}`} aria-hidden />

          <span className="min-w-0">
            <b className="text-sm block">{display.label}</b>
            <span className="text-xs text-ink-soft block truncate">
              {entry.actorEmail}
              {display.detail ? ` · ${display.detail}` : ""}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-ink-soft whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</span>
          {hasMore && <span className="text-ink-soft text-xs">{expanded ? "▲" : "▼"}</span>}
        </span>
      </button>
      {expanded && entry.metadata && (
        <pre className="mt-2 bg-surface-2 rounded-lg p-3 text-[11px] text-ink-soft overflow-x-auto" dir="ltr">
          {JSON.stringify(entry.metadata, null, 2)}
        </pre>
      )}
      {expanded && entry.ip && <p className="mt-1 text-[10px] text-ink-soft">IP: {entry.ip}</p>}
    </div>
  );
}
